"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui/controls";
import { loginAction, type FormState } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required />
      </Field>
      <Field label="Mật khẩu">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <p className="text-sm text-slate-500">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="font-semibold text-brand-700">
          Đăng ký
        </Link>
      </p>
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}
