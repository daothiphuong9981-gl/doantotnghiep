"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createOfflineBookingAction } from "@/app/owner/actions";
import { Alert, Button, Field, Input } from "@/components/ui/controls";
import { describeDate, formatVnd } from "@/lib/format";
import type { Availability } from "@/lib/services/venues";

const CELL = {
  available: "border border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-700 cursor-pointer",
  selected: "border border-amber-500 bg-amber-400 font-bold text-slate-900 cursor-pointer",
  held: "bg-orange-100 text-orange-700 cursor-not-allowed",
  booked: "bg-slate-100 text-slate-400 cursor-not-allowed",
  past: "bg-slate-50 text-slate-300 cursor-not-allowed",
} as const;
const LABEL = { available: "Trống", held: "Đang giữ", booked: "Đã đặt", past: "Đã qua" } as const;

/** Lưới chọn khung giờ + thông tin khách cho lượt đặt hộ / khóa giờ của chủ sân. */
export function OfflineBookingForm({ venueId, availability }: { venueId: number; availability: Availability }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<"walk_in" | "block">("walk_in");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const key = (courtId: number, time: string) => `${courtId}|${time}`;
  const priceOf = new Map(availability.courts.flatMap((c) => c.slots.map((s) => [key(c.id, s.start_time), s.price ?? 0] as const)));
  const total = kind === "walk_in" ? [...picked].reduce((sum, k) => sum + (priceOf.get(k) ?? 0), 0) : 0;

  function toggle(k: string) {
    setError(null);
    setDone(null);
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(k)) next.delete(k);
      else if (next.size < 48) next.add(k);
      return next;
    });
  }

  function submit() {
    if (picked.size === 0) return setError("Hãy chọn ít nhất một khung giờ.");
    if (kind === "walk_in" && name.trim().length < 2) return setError("Hãy nhập tên khách.");
    setError(null);
    startTransition(async () => {
      const items = [...picked].map((k) => {
        const [court, time] = k.split("|");
        return { court_id: Number(court), booking_date: availability.date, start_time: time };
      });
      const result = await createOfflineBookingAction({ venue_id: venueId, kind, items, guest_name: name, guest_phone: phone });
      if (result.error) {
        setError(result.error);
      } else {
        setDone(result.code ?? "");
        setPicked(new Set());
        setName("");
        setPhone("");
      }
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-slate-600">Loại</legend>
        <div className="grid max-w-md grid-cols-2 gap-2">
          {(
            [
              ["walk_in", "Đặt hộ khách"],
              ["block", "Khóa khung giờ"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 has-[:checked]:font-bold has-[:checked]:text-brand-700"
            >
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="accent-brand-700" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="mb-1.5 text-sm font-semibold">Ngày {describeDate(availability.date).full} — bấm ô trống để chọn</p>
        {availability.courts.length === 0 ? (
          <Alert tone="info">Sân chưa có sân con nào đang hoạt động.</Alert>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-2 py-1.5 text-left">Sân con</th>
                  {availability.hours.map((h) => (
                    <th key={h} className="px-1 py-1.5 font-semibold text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {availability.courts.map((court) => (
                  <tr key={court.id} className="border-t border-slate-100">
                    <th className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 text-left">{court.name}</th>
                    {court.slots.map((slot) => {
                      const k = key(court.id, slot.start_time);
                      const selected = picked.has(k);
                      const state = selected ? "selected" : slot.state;
                      return (
                        <td key={k} className="p-0.5">
                          <button
                            type="button"
                            disabled={slot.state !== "available" || pending}
                            onClick={() => toggle(k)}
                            aria-pressed={selected}
                            aria-label={`${court.name} lúc ${slot.start_time}: ${selected ? "đã chọn" : LABEL[slot.state]}`}
                            className={`h-9 w-full min-w-12 rounded-md ${CELL[state]}`}
                          >
                            {selected ? "✓" : slot.state === "available" ? (slot.price === null ? "—" : `${Math.round(slot.price / 1000)}k`) : LABEL[slot.state]}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={kind === "walk_in" ? "Tên khách" : "Ghi chú (không bắt buộc)"}>
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={kind === "walk_in" ? "Ví dụ: Anh Minh" : "Ví dụ: Bảo trì mặt sân"} />
        </Field>
        {kind === "walk_in" ? (
          <Field label="Số điện thoại khách (không bắt buộc)">
            <Input value={phone} inputMode="numeric" maxLength={12} onChange={(e) => setPhone(e.target.value)} placeholder="0905xxxxxx" />
          </Field>
        ) : null}
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {done !== null ? (
        <Alert tone="success">
          Đã tạo lượt {done}.{" "}
          <Link href="/owner/bookings?status=confirmed" className="font-semibold underline">
            Xem trong lịch đặt
          </Link>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-sm text-slate-600">
          {picked.size} khung giờ{kind === "walk_in" ? ` · ${formatVnd(total)} (thu tại sân)` : ""}
        </span>
        <Button type="button" onClick={submit} disabled={pending || picked.size === 0}>
          {pending ? "Đang lưu..." : kind === "walk_in" ? "Tạo lượt đặt hộ" : "Khóa các khung giờ"}
        </Button>
      </div>
    </section>
  );
}
