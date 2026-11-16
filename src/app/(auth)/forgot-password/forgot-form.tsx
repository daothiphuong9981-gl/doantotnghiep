"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui/controls";
import { forgotPasswordAction, type FormState } from "../actions";

function ExpiredNotice() {
  if (useSearchParams().get("link") !== "expired") return null;
  return <Alert tone="info">Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được dùng. Hãy nhập email để nhận liên kết mới.</Alert>;
}

/** Nhập email để nhận liên kết đặt lại mật khẩu. */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Suspense fallback={null}>
        <ExpiredNotice />
      </Suspense>
      <p className="text-sm text-slate-600">Nhập email bạn đã dùng để đăng ký. Chúng tôi sẽ gửi một liên kết để bạn đặt mật khẩu mới.</p>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required />
      </Field>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Đang gửi..." : state.success ? "Gửi lại liên kết" : "Gửi liên kết đặt lại"}
      </Button>
      <p className="text-sm text-slate-500">
        Nhớ ra mật khẩu?{" "}
        <Link href="/login" className="font-semibold text-brand-700">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
