import { createClient } from "@/lib/supabase/server";
import { fail, ok, type Profile, type Result } from "@/lib/types";
import { loginSchema, passwordSchema, registerSchema } from "@/lib/validation";

const first = (issues: { message: string }[]) => issues[0]?.message ?? "Dữ liệu không hợp lệ";

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
    if (error?.code === "email_not_confirmed") return fail(401, "Email chưa được xác nhận. Hãy kiểm tra hộp thư.");
    return fail(401, "Email hoặc mật khẩu không đúng");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_locked")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return fail(401, "Email hoặc mật khẩu không đúng");
  }
  if (profile.is_locked) {
    await supabase.auth.signOut();
    return fail(403, "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.");
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
  if (check.error) return fail(400, "Mật khẩu hiện tại không đúng");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });
  if (error) {
    if (error.code === "same_password") return fail(400, "Mật khẩu mới phải khác mật khẩu hiện tại");
    return fail(400, "Không đổi được mật khẩu. Vui lòng thử lại.");
  }
  return ok(null);
}
