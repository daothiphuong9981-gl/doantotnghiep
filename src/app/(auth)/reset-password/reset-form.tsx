"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui/controls";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPasswordAction, type FormState } from "../actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Mật khẩu mới" hint="Từ 8 đến 72 ký tự">
        <PasswordInput name="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>
      <Field label="Nhập lại mật khẩu mới">
        <PasswordInput name="password_confirm" autoComplete="new-password" required />
      </Field>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <p className="text-xs text-slate-500">Sau khi đặt mật khẩu mới, các thiết bị khác đang đăng nhập tài khoản này sẽ bị đăng xuất.</p>
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Đang lưu..." : "Lưu mật khẩu mới"}
      </Button>
    </form>
  );
}
