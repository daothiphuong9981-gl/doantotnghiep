"use client";

import { useActionState } from "react";
import { changePasswordAction, deleteAccountAction, updateProfileAction, type FormState } from "@/app/(auth)/actions";
import { Alert, Button, Field, Input } from "@/components/ui/controls";
import { PasswordInput } from "@/components/ui/password-input";

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Email" hint="Email dùng để đăng nhập, không sửa được">
        <Input value={email} disabled readOnly className="bg-slate-50 text-slate-500" />
      </Field>
      <Field label="Họ và tên">
        <Input name="full_name" defaultValue={state.values?.full_name ?? fullName} required />
      </Field>
      <Field label="Số điện thoại">
        <Input name="phone" inputMode="numeric" defaultValue={state.values?.phone ?? phone} required />
      </Field>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Đang lưu..." : "Lưu thông tin"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate key={state.success ? "done" : "form"}>
      <Field label="Mật khẩu hiện tại">
        <PasswordInput name="current_password" autoComplete="current-password" required />
      </Field>
      <Field label="Mật khẩu mới" hint="Từ 8 đến 72 ký tự">
        <PasswordInput name="new_password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>
      <Field label="Nhập lại mật khẩu mới">
        <PasswordInput name="new_password_confirm" autoComplete="new-password" required />
      </Field>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Đang đổi..." : "Đổi mật khẩu"}
      </Button>
    </form>
  );
}

/** PB27 - Xóa tài khoản: nhập lại mật khẩu và đánh dấu xác nhận. */
export function DeleteAccountForm({ role }: { role: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccountAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-slate-600">
        Khi xóa tài khoản, họ tên, email, số điện thoại của bạn bị xóa khỏi hệ thống và không khôi phục được. Các lượt đặt cũ được giữ lại ở dạng ẩn danh để
        chủ sân đối chiếu.
        {role === "owner" ? " Sân chưa từng có lượt đặt sẽ bị xóa; sân đã có lượt đặt sẽ bị ẩn và xóa thông tin liên hệ, tài khoản nhận tiền." : ""} Bạn cần hủy
        các lượt đặt chưa diễn ra trước khi xóa.
      </p>
      <Field label="Mật khẩu hiện tại">
        <PasswordInput name="password" autoComplete="current-password" required />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" className="mt-0.5" />
        <span>Tôi hiểu rằng thao tác này không hoàn tác được.</span>
      </label>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" variant="danger" disabled={pending} className="self-start">
        {pending ? "Đang xóa..." : "Xóa tài khoản"}
      </Button>
    </form>
  );
}
