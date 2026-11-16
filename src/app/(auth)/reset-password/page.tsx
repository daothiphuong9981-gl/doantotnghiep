import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Alert, buttonClass } from "@/components/ui/controls";
import { hasRecoverySession } from "@/lib/services/auth";
import { ResetPasswordForm } from "./reset-form";

export const metadata = { title: "Đặt lại mật khẩu - Cầu Lông Đà Nẵng" };

/**
 * Tới đây từ /auth/confirm sau khi mở liên kết trong thư (phiên đặt lại mật khẩu đã lưu vào cookie).
 * Trang động vì phải đọc phiên; mở trực tiếp hoặc liên kết quá 1 giờ thì báo hết hạn.
 */
export default async function ResetPasswordPage() {
  const allowed = await hasRecoverySession();
  return (
    <AuthShell title="Đặt mật khẩu mới">
      {allowed ? (
        <ResetPasswordForm />
      ) : (
        <div className="flex flex-col gap-4">
          <Alert tone="info">Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn (liên kết chỉ dùng được trong 1 giờ).</Alert>
          <Link href="/forgot-password" className={buttonClass("primary", "h-11")}>
            Gửi lại liên kết
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
