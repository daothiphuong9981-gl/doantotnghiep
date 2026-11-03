"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui/controls";
import { loginAction, type FormState } from "../actions";

/** Ô ẩn `next` lấy từ ?next= trên URL (đúng cả khi tới đây bằng chuyển trang phía trình duyệt). */
function NextField() {
  return <input type="hidden" name="next" value={useSearchParams().get("next") ?? ""} />;
}

/**
 * Trang đăng nhập là trang tĩnh nên không nhận `next` từ máy chủ: chỉ riêng ô ẩn `next` đọc URL ở trình duyệt (bọc
 * Suspense, HTML tĩnh để trống), còn form có sẵn trong HTML và gửi thẳng Server Action nên bấm trước khi hydrate xong
 * vẫn đăng nhập được (khi đó về trang mặc định). Máy chủ chỉ cho chuyển tới đường dẫn nội bộ (safeNext trong actions.ts).
 */
export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Suspense fallback={<input type="hidden" name="next" value="" />}>
        <NextField />
      </Suspense>
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
