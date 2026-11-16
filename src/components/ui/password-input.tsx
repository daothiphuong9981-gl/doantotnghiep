"use client";

import { useState, type ComponentProps } from "react";
import { inputClass } from "./controls";

/**
 * Ô mật khẩu có nút ẩn/hiện. Nút là type="button" nên không gửi form; aria-pressed + nhãn cho trình đọc màn hình.
 * Khi chưa hydrate xong ô vẫn là type="password" bình thường (nhập và gửi form được).
 */
export function PasswordInput({ className = "", ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Ẩn mật khẩu" : "Hiện mật khẩu";
  return (
    <span className="relative block">
      <input {...props} type={visible ? "text" : "password"} className={`${inputClass} pr-11 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-700"
      >
        {visible ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 5.4-1.6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  );
}
