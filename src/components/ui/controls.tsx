import type { ComponentProps, ReactNode } from "react";

const base =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
const variants = {
  primary: "border-brand-700 bg-brand-700 text-white hover:bg-brand-800",
  outline: "border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
  danger: "border-red-200 bg-white text-red-700 hover:bg-red-50",
};

export function buttonClass(variant: keyof typeof variants = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: keyof typeof variants }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-700 focus:ring-2 focus:ring-brand-100";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

const chipTones = {
  gray: "bg-slate-100 text-slate-700",
  green: "bg-brand-100 text-brand-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  orange: "bg-orange-100 text-orange-700",
};

export function Chip({ tone = "gray", children }: { tone?: keyof typeof chipTones; children: ReactNode }) {
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${chipTones[tone]}`}>{children}</span>;
}

export function Alert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const tones = {
    error: "bg-red-50 text-red-700 border-red-200",
    success: "bg-brand-50 text-brand-800 border-brand-200",
    info: "bg-orange-50 text-orange-800 border-orange-200",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

/** Ô thay cho ảnh sân khi chưa có ảnh: hình sân cầu lông cách điệu. */
export function CourtPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-700 to-teal-400 ${className}`} aria-hidden>
      <div className="absolute inset-x-[18%] inset-y-[14%] border-2 border-white/75" />
      <div className="absolute inset-x-[18%] top-1/2 h-0.5 bg-white/75" />
    </div>
  );
}
