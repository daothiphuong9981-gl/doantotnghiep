import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["recovery", "signup", "email", "invite", "magiclink", "email_change"];

/**
 * GET /auth/confirm - Trang đón liên kết trong thư của Supabase Auth (đặt lại mật khẩu, xác nhận đăng ký).
 * - ?token_hash=...&type=recovery|signup (mẫu thư đã sửa theo README): mở được trên máy nào cũng được.
 * - ?code=... (mẫu thư mặc định, luồng PKCE): chỉ đúng trên trình duyệt đã gửi yêu cầu.
 * Thành công: lưu phiên vào cookie rồi chuyển tới `next` (chỉ đường dẫn nội bộ). Thất bại: về trang báo liên kết hết hạn.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const isRecovery = type === "recovery" || params.get("next") === "/reset-password";
  const fallbackNext = isRecovery ? "/reset-password" : "/?confirmed=1";
  const next = safeNext(params.get("next")) ?? fallbackNext;

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  // redirect() của next/navigation: cookie phiên vừa ghi qua cookies() đi kèm phản hồi chuyển hướng
  if (ok) redirect(next);
  redirect(isRecovery ? "/forgot-password?link=expired" : "/login?link=expired");
}
