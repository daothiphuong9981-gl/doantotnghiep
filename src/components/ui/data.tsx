import Link from "next/link";
import type { ReactNode } from "react";

/** Hàng thẻ lọc dạng viên thuốc (liên kết). */
export function PillTabs({ label, tabs, current }: { label: string; tabs: { key: string; href: string; text: string }[]; current: string }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label={label}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
            tab.key === current ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {tab.text}
        </Link>
      ))}
    </nav>
  );
}

export function StatCard({ label, value, note, testId }: { label: string; value: ReactNode; note?: string; testId?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900" data-testid={testId}>
        {value}
      </div>
      {note ? <div className="mt-0.5 text-xs text-slate-500">{note}</div> : null}
    </div>
  );
}

/**
 * Biểu đồ cột đơn giản bằng CSS (không cần thư viện). Số liệu chi tiết luôn có trong bảng bên dưới biểu đồ,
 * nên biểu đồ được ẩn với trình đọc màn hình.
 */
export function BarChart({ data, unit }: { data: { label: string; value: number; title?: string }[]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" aria-hidden data-testid="bar-chart">
      <div className="flex h-44 items-end gap-1">
        {data.map((d) => (
          <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={d.title ?? `${d.label}: ${d.value} ${unit}`}>
            <span className="text-[10px] font-semibold text-slate-600">{d.value > 0 ? d.value : ""}</span>
            <div
              className={`w-full max-w-10 rounded-t ${d.value > 0 ? "bg-brand-600" : "bg-slate-200"}`}
              style={{ height: `${d.value > 0 ? Math.max(4, (d.value / max) * 100) : 1}%` }}
              data-value={d.value}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 border-t border-slate-200 pt-1">
        {data.map((d, i) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-slate-500">
            {data.length <= 16 || i % Math.ceil(data.length / 16) === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
