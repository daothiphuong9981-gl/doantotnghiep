import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getSession, homeOf } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Đăng nhập - Cầu Lông Đà Nẵng" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await getSession();
  if (session) redirect(homeOf(session.profile.role));
  const { next } = await searchParams;
  return (
    <AuthShell title="Đăng nhập">
      <LoginForm next={typeof next === "string" ? next : ""} />
    </AuthShell>
  );
}
