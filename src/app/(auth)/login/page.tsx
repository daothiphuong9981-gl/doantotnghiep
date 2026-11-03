import { AuthShell } from "@/components/auth-shell";
import { RedirectIfSignedIn } from "@/components/navbar-session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Đăng nhập - Cầu Lông Đà Nẵng" };
// Trang tĩnh, giống nhau với mọi người (CDN trả ngay). Build báo lỗi nếu có ai thêm cookies()/searchParams vào đây.
// Người đã đăng nhập được chuyển hướng ở trình duyệt (RedirectIfSignedIn); `next` đọc từ URL lúc gửi form.
export const dynamic = "error";

export default function LoginPage() {
  return (
    <AuthShell title="Đăng nhập">
      <RedirectIfSignedIn />
      <LoginForm />
    </AuthShell>
  );
}
