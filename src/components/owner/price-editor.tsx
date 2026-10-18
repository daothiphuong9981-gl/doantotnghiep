"use client";

import { useState, useTransition } from "react";
import { savePricesAction } from "@/app/owner/actions";
import { Alert, Button, inputClass } from "@/components/ui/controls";
import type { PriceSlot } from "@/lib/types";
import { findPriceOverlap } from "@/lib/validation";

const EMPTY: PriceSlot = { day_type: "weekday", start_time: "05:00", end_time: "17:00", price: 50000 };

/** PB08 - Bảng giá theo khung giờ, tách ngày thường và cuối tuần. */
export function PriceEditor({ venueId, initial }: { venueId: number; initial: PriceSlot[] }) {
  const [rows, setRows] = useState<PriceSlot[]>(initial.length > 0 ? initial : [EMPTY]);
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  const update = (index: number, patch: Partial<PriceSlot>) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setMessage({});
  };

  function save() {
    const invalid = rows.find((r) => !(r.end_time > r.start_time) || !Number.isFinite(r.price) || r.price < 0);
    if (invalid) return setMessage({ error: "Giờ kết thúc phải sau giờ bắt đầu và giá không được âm" });
    const overlap = findPriceOverlap(rows);
    if (overlap) return setMessage({ error: overlap });
    startTransition(async () => setMessage(await savePricesAction(venueId, rows)));
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center px-4 py-3">
        <h2 className="text-base font-bold">Bảng giá theo khung giờ</h2>
        <span className="flex-1" />
        <Button variant="outline" className="h-8 px-3 text-xs" type="button" onClick={() => setRows((r) => [...r, { ...EMPTY }])}>
          + Thêm
        </Button>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs text-slate-500">
            <th className="px-4 py-2">Loại ngày</th>
            <th className="px-2 py-2">Từ</th>
            <th className="px-2 py-2">Đến</th>
            <th className="px-2 py-2">Giá/giờ (đ)</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-4 py-1.5">
                <select
                  aria-label="Loại ngày"
                  value={row.day_type}
                  onChange={(ev) => update(i, { day_type: ev.target.value as PriceSlot["day_type"] })}
                  className={`${inputClass} h-9 min-w-32`}
                >
                  <option value="weekday">Ngày thường</option>
                  <option value="weekend">Cuối tuần</option>
                </select>
              </td>
              <td className="px-2 py-1.5">
                <input aria-label="Giờ bắt đầu" type="time" step={3600} value={row.start_time} onChange={(ev) => update(i, { start_time: ev.target.value })} className={`${inputClass} h-9`} />
              </td>
              <td className="px-2 py-1.5">
                <input aria-label="Giờ kết thúc" type="time" step={3600} value={row.end_time} onChange={(ev) => update(i, { end_time: ev.target.value })} className={`${inputClass} h-9`} />
              </td>
              <td className="px-2 py-1.5">
                <input aria-label="Giá một giờ" type="number" min={0} step={1000} value={row.price} onChange={(ev) => update(i, { price: Number(ev.target.value) })} className={`${inputClass} h-9 min-w-24`} />
              </td>
              <td className="px-2 py-1.5 text-right">
                <button type="button" aria-label="Xóa khung giá" onClick={() => setRows((r) => r.filter((_, k) => k !== i))} disabled={rows.length === 1} className="px-2 text-slate-400 hover:text-red-600 disabled:opacity-30">
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {message.error ? <Alert>{message.error}</Alert> : null}
        {message.success ? <Alert tone="success">{message.success}</Alert> : null}
        <Button type="button" onClick={save} disabled={pending} className="self-end">
          {pending ? "Đang lưu..." : "Lưu bảng giá"}
        </Button>
      </div>
    </section>
  );
}
