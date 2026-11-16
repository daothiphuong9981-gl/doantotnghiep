"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui/controls";
import { PasswordInput } from "@/components/ui/password-input";
import { loginAction, resendConfirmationAction, type FormState } from "../actions";

/** Ô ẩn `next` lấy từ ?next= trên URL (đúng cả khi tới đây bằng chuyển trang phía trình duyệt). */
function NextField() {
  return <input type="hidden" name="next" value={useSearchParams().get("next") ?? ""} />;
}

/** Nút gửi lại thư xác nhận, hiện khi đăng nhập báo email chưa xác nhận. Form riêng (không lồng form). */
function ResendConfirmation({ email }: { email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resendConfirmationAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="email" value={email} />
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Đang gửi..." : "Gửi lại thư xác nhận"}
      </Button>
    </form>
  );
}

/** Thông báo theo URL: liên kết trong thư hết hạn. */
function LinkNotice() {
  if (useSearchParams().get("link") !== "expired") return null;
  return <Alert tone="info">Liên kết xác nhận đã hết hạn hoặc đã được dùng. Nếu tài khoản đã xác nhận, hãy đăng nhập bình thường.</Alert>;
}

/**
 * Trang đăng nhập là trang tĩnh nên không nhận `next` từ máy chủ: chỉ riêng ô ẩn `next` đọc URL ở trình duyệt (bọc
 * Suspense, HTML tĩnh để trống), còn form có sẵn trong HTML và gửi thẳng Server Action nên bấm trước khi hydrate xong
 * vẫn đăng nhập được (khi đó về trang mặc định). Máy chủ chỉ cho chuyển tới đường dẫn nội bộ (safeNext trong actions.ts).
 */
export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <Suspense fallback={<input type="hidden" name="next" value="" />}>
          <NextField />
          <LinkNotice />
        </Suspense>
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required />
        </Field>
        <div>
          <Field label="Mật khẩu">
            <PasswordInput name="password" autoComplete="current-password" required />
          </Field>
          <div className="mt-1.5 text-right">
            <Link href="/forgot-password" className="text-sm font-semibold text-brand-700">
              Quên mật khẩu?
            </Link>
          </div>
        </div>
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
      {state.needsConfirm && state.values?.email ? <ResendConfirmation key={state.values.email} email={state.values.email} /> : null}
    </div>
  );
}
