import { requireSession } from "@/lib/auth";
import { DeleteAccountForm, PasswordForm, ProfileForm } from "./account-forms";

export const metadata = { title: "Tài khoản - Cầu Lông Đà Nẵng" };

export default async function AccountPage() {
  const session = await requireSession();
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-6 py-8 md:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="mb-4 text-lg font-bold">Thông tin cá nhân</h1>
        <ProfileForm fullName={session.profile.full_name} phone={session.profile.phone} email={session.email} />
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">Đổi mật khẩu</h2>
        <PasswordForm />
      </section>
      {session.profile.role !== "admin" ? (
        <section className="rounded-xl border border-red-200 bg-white p-6 md:col-span-2">
          <h2 className="mb-3 text-lg font-bold text-red-700">Xóa tài khoản</h2>
          <DeleteAccountForm role={session.profile.role} />
        </section>
      ) : null}
    </div>
  );
}
