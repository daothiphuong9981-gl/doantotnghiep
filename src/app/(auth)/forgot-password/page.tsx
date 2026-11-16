import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata = { title: "Quên mật khẩu - Cầu Lông Đà Nẵng" };
// Trang tĩnh; thông báo "liên kết hết hạn" (?link=expired) đọc ở trình duyệt.
export const dynamic = "error";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Quên mật khẩu">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
