import { createClient } from "@/lib/supabase/server";
import { fail, ok, type Profile, type Result } from "@/lib/types";
import { forgotPasswordSchema, loginSchema, passwordSchema, registerSchema, resetPasswordSchema } from "@/lib/validation";

const first = (issues: { message: string }[]) => issues[0]?.message ?? "Dữ liệu không hợp lệ";

/** Supabase Auth giới hạn số lần thử (đăng nhập, gửi thư): báo đúng lý do thay vì "sai mật khẩu". */
function isRateLimited(error: { code?: string; status?: number } | null | undefined): boolean {
  return Boolean(error && (error.status === 429 || error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit"));
}
const RATE_LIMITED = "Bạn thao tác quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.";

/** PB03 - Đăng ký tài khoản người chơi hoặc chủ sân. */
export async function register(input: unknown): Promise<Result<{ user: Pick<Profile, "id" | "full_name" | "role">; needsEmailConfirm: boolean }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return fail(400, first(parsed.error.issues));
  const { full_name, email, phone, password, role } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Hồ sơ (bảng profiles) được tạo bởi trigger handle_new_user từ các thông tin này
    options: { data: { full_name, phone, role } },
  });
  if (error) {
    if (error.code === "user_already_exists" || /already registered/i.test(error.message)) {
      return fail(409, "Email đã được sử dụng");
    }
    if (error.code === "weak_password") return fail(400, "Mật khẩu quá yếu");
    if (isRateLimited(error)) return fail(429, RATE_LIMITED);
    return fail(400, "Không đăng ký được. Vui lòng thử lại.");
  }
  // Khi Supabase bật xác nhận email, email đã tồn tại trả về user không có identities
  if (data.user && (data.user.identities?.length ?? 0) === 0) return fail(409, "Email đã được sử dụng");
  if (!data.user) return fail(500, "Không đăng ký được. Vui lòng thử lại.");

  return ok({ user: { id: data.user.id, full_name, role }, needsEmailConfirm: !data.session });
}

/** PB04 - Đăng nhập. Không tiết lộ email có tồn tại hay không. */
export async function login(input: unknown): Promise<Result<{ user: Pick<Profile, "id" | "full_name" | "role"> }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail(400, first(parsed.error.issues));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") return fail(412, "Email chưa được xác nhận. Hãy mở thư xác nhận trong hộp thư, hoặc bấm gửi lại bên dưới.");
    if (isRateLimited(error)) return fail(429, RATE_LIMITED);
    return fail(401, "Email hoặc mật khẩu không đúng");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_locked, lock_reason")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return fail(401, "Email hoặc mật khẩu không đúng");
  }
  if (profile.is_locked) {
    await supabase.auth.signOut();
    return fail(403, `Tài khoản đã bị khóa${profile.lock_reason ? `. Lý do: ${profile.lock_reason}` : ""}. Vui lòng liên hệ quản trị viên (trang Liên hệ).`);
  }
  return ok({ user: { id: profile.id, full_name: profile.full_name, role: profile.role } });
}

/** PB04 - Đăng xuất. */
export async function logout(): Promise<Result<null>> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return ok(null);
}

/** PB04 - Đổi mật khẩu, yêu cầu nhập đúng mật khẩu hiện tại. */
export async function changePassword(input: unknown): Promise<Result<null>> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return fail(400, first(parsed.error.issues));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return fail(401, "Bạn cần đăng nhập");

  const check = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.current_password });
  if (isRateLimited(check.error)) return fail(429, RATE_LIMITED);
  if (check.error) return fail(400, "Mật khẩu hiện tại không đúng");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });
  if (error) {
    if (error.code === "same_password") return fail(400, "Mật khẩu mới phải khác mật khẩu hiện tại");
    return fail(400, "Không đổi được mật khẩu. Vui lòng thử lại.");
  }
  return ok(null);
}

/**
 * Quên mật khẩu: Supabase gửi thư có liên kết đặt lại. Luôn trả cùng một câu (kể cả email chưa đăng ký) để không lộ
 * email nào có tài khoản; chỉ báo lỗi khi bị giới hạn tần suất. redirectTo phải nằm trong Redirect URLs của Supabase.
 */
export async function requestPasswordReset(input: unknown, origin: string): Promise<Result<null>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fail(400, first(parsed.error.issues));
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  if (isRateLimited(error)) return fail(429, RATE_LIMITED);
  return ok(null);
}

/** Phiên hiện tại có được tạo từ liên kết đặt lại mật khẩu trong vòng 1 giờ không (claim amr trong JWT đã ký). */
export async function hasRecoverySession(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const amr = (data?.claims as { amr?: { method?: string; timestamp?: number }[] } | undefined)?.amr ?? [];
  const now = Math.floor(Date.now() / 1000);
  return amr.some((m) => (m.method === "recovery" || m.method === "otp") && typeof m.timestamp === "number" && now - m.timestamp < 3600);
}

/**
 * Đặt mật khẩu mới sau khi mở liên kết trong thư. Chỉ cho phép với phiên vừa tạo từ liên kết (không phải phiên đăng nhập
 * bình thường, vì như vậy ai cầm máy đang đăng nhập cũng đổi được mật khẩu mà không cần mật khẩu cũ).
 * Đặt xong đăng xuất mọi phiên khác (máy khác có thể đang bị người lạ dùng).
 */
export async function resetPassword(input: unknown): Promise<Result<null>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fail(400, first(parsed.error.issues));
  if (!(await hasRecoverySession())) return fail(401, "Liên kết đặt lại mật khẩu đã hết hạn. Hãy yêu cầu gửi lại.");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail(401, "Liên kết đặt lại mật khẩu đã hết hạn. Hãy yêu cầu gửi lại.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return fail(400, "Mật khẩu mới phải khác mật khẩu cũ");
    if (error.code === "weak_password") return fail(400, "Mật khẩu quá yếu");
    if (isRateLimited(error)) return fail(429, RATE_LIMITED);
    return fail(400, "Không đặt lại được mật khẩu. Vui lòng thử lại.");
  }
  await supabase.auth.signOut({ scope: "others" });
  const { data: profile } = await supabase.from("profiles").select("is_locked").eq("id", auth.user.id).maybeSingle();
  if (!profile || profile.is_locked) {
    await supabase.auth.signOut();
    return fail(403, "Đã đặt mật khẩu mới, nhưng tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên.");
  }
  return ok(null);
}

/** Gửi lại thư xác nhận đăng ký (khi đăng nhập báo email chưa xác nhận). Không lộ email có tồn tại hay không. */
export async function resendSignupConfirmation(input: unknown, origin: string): Promise<Result<null>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fail(400, first(parsed.error.issues));
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data.email, options: { emailRedirectTo: `${origin}/auth/confirm` } });
  if (isRateLimited(error)) return fail(429, RATE_LIMITED);
  return ok(null);
}
