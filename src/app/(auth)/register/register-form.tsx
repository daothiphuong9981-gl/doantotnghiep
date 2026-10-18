"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui/controls";
import { registerAction, type FormState } from "../actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, {});
  const v = state.values ?? {};
  if (state.success) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{state.success}</Alert>
        <Link href="/login" className="font-semibold text-brand-700">
          Tới trang đăng nhập
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Họ và tên">
        <Input name="full_name" autoComplete="name" defaultValue={v.full_name} required />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" defaultValue={v.email} required />
      </Field>
      <Field label="Số điện thoại">
        <Input name="phone" inputMode="numeric" autoComplete="tel" placeholder="0905xxxxxx" defaultValue={v.phone} required />
      </Field>
      <Field label="Mật khẩu" hint="Ít nhất 8 ký tự">
        <Input name="password" type="password" autoComplete="new-password" required />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-slate-600">Bạn là</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["player", "Người chơi"],
            ["owner", "Chủ sân"],
          ].map(([value, label]) => (
            <label
              key={value}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 has-[:checked]:font-bold has-[:checked]:text-brand-700"
            >
              <input type="radio" name="role" value={value} defaultChecked={(v.role ?? "player") === value} className="accent-brand-700" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-xs text-slate-500">
        <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 accent-brand-700" />
        <span>
          Tôi đã đọc và đồng ý với{" "}
          <Link href="/privacy" target="_blank" className="font-semibold text-brand-700">
            Thông báo xử lý dữ liệu cá nhân
          </Link>
          . Hệ thống chỉ thu thập họ tên, email, số điện thoại để phục vụ việc đặt sân.
        </span>
      </label>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Đang đăng ký..." : "Đăng ký"}
      </Button>
      <p className="text-sm text-slate-500">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-semibold text-brand-700">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
