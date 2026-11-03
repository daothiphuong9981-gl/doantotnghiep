import { AuthShell } from "@/components/auth-shell";
import { RedirectIfSignedIn } from "@/components/navbar-session";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Đăng ký - Cầu Lông Đà Nẵng" };
// Trang tĩnh, giống nhau với mọi người (CDN trả ngay). Build báo lỗi nếu có ai thêm cookies() vào đây.
// Người đã đăng nhập được chuyển hướng ở trình duyệt (RedirectIfSignedIn).
export const dynamic = "error";

export default function RegisterPage() {
  return (
    <AuthShell title="Đăng ký tài khoản">
      <RedirectIfSignedIn />
      <RegisterForm />
    </AuthShell>
  );
}
