import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getSession, homeOf } from "@/lib/auth";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Đăng ký - Cầu Lông Đà Nẵng" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect(homeOf(session.profile.role));
  return (
    <AuthShell title="Đăng ký tài khoản">
      <RegisterForm />
    </AuthShell>
  );
}
