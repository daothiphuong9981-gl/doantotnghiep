import { dbFail } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/types";
import { profileSchema } from "@/lib/validation";

export interface Me {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
}

/** PB05 - Hồ sơ của người đang đăng nhập. */
export async function getMe(): Promise<Result<Me>> {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return fail(401, "Bạn cần đăng nhập");
  const { data } = await supabase.from("profiles").select("id, full_name, phone, role").eq("id", user.id).maybeSingle();
  if (!data) return fail(404, "Không tìm thấy hồ sơ");
  return ok({ ...data, email: user.email ?? "" });
}

/** PB05 - Cập nhật họ tên, số điện thoại. Email không sửa được. */
export async function updateMe(input: unknown): Promise<Result<Pick<Me, "id" | "full_name" | "phone">>> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return fail(401, "Bạn cần đăng nhập");

  const { data, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id)
    .select("id, full_name, phone")
    .maybeSingle();
  if (error || !data) return fail(400, "Không cập nhật được hồ sơ");
  return ok(data);
}

/**
 * PB27 - Người dùng tự xóa tài khoản sau khi nhập lại mật khẩu.
 * Dữ liệu cá nhân bị xóa; các lượt đặt cũ được giữ ở dạng ẩn danh. Từ chối (409) nếu còn lượt đặt chưa diễn ra.
 */
export async function deleteMe(input: unknown): Promise<Result<null>> {
  const password = (input as { password?: unknown })?.password;
  if (typeof password !== "string" || !password) return fail(400, "Hãy nhập mật khẩu để xác nhận");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return fail(401, "Bạn cần đăng nhập");
  const check = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (check.error) return fail(400, "Mật khẩu không đúng");

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return dbFail(error, "Không xóa được tài khoản. Vui lòng thử lại.");
  // Phiên đăng nhập không còn hợp lệ: xóa cookie ở trình duyệt
  await supabase.auth.signOut({ scope: "local" });
  return ok(null);
}
