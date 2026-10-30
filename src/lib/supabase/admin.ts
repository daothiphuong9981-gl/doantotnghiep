import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Client quyền service_role: BỎ QUA Row Level Security. Chỉ dùng cho tác vụ hệ thống không gắn với người dùng
 * đang đăng nhập (hiện chỉ có hàng đợi email). "server-only" làm build lỗi nếu lỡ import vào code chạy ở trình duyệt.
 * Khóa lấy ở Supabase: Project Settings > API Keys > service_role (hoặc secret key). Không đặt tiền tố NEXT_PUBLIC_.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
