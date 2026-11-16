"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { renameCourtAction, setCourtActiveAction } from "@/app/owner/actions";
import { Alert, buttonClass, Chip, inputClass } from "@/components/ui/controls";
import type { Court } from "@/lib/types";

/**
 * Quản lý từng sân con: đổi tên, ngừng / mở lại một sân cụ thể (ví dụ sân 3 đang sửa mặt sân).
 * Sân con còn khung giờ đã đặt sắp tới không ngừng được (trigger 0015), thông báo nêu lượt gần nhất.
 */
export function CourtManager({ venueId, courts }: { venueId: number; courts: Court[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [names, setNames] = useState<Record<number, string>>(() => Object.fromEntries(courts.map((c) => [c.id, c.name])));
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  function run(task: () => Promise<{ error?: string; success?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await task();
      setMessage(result.error ? { tone: "error", text: result.error } : { tone: "success", text: result.success ?? "Đã lưu." });
      router.refresh();
    });
  }

  function toggle(court: Court) {
    if (court.is_active && !window.confirm(`Ngừng ${court.name}? Người chơi sẽ không đặt được sân con này cho tới khi bạn mở lại.`)) return;
    run(() => setCourtActiveAction(venueId, court.id, !court.is_active));
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="courts-heading">
      <h2 id="courts-heading" className="text-lg font-bold">
        Sân con
      </h2>
      <p className="mb-3 text-sm text-slate-500">Đổi tên hoặc tạm ngừng từng sân con. Số sân con đang hoạt động cũng đổi được ở ô “Số sân con” phía trên.</p>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <ul className="mt-3 flex flex-col divide-y divide-slate-100">
        {courts.map((court) => {
          const name = names[court.id] ?? court.name;
          const changed = name.trim() !== court.name;
          return (
            <li key={court.id} className="flex flex-wrap items-center gap-2 py-2">
              <label className="sr-only" htmlFor={`court-${court.id}`}>
                Tên {court.name}
              </label>
              <input
                id={`court-${court.id}`}
                value={name}
                maxLength={40}
                onChange={(e) => setNames((all) => ({ ...all, [court.id]: e.target.value }))}
                className={`${inputClass} w-48`}
              />
              {court.is_active ? <Chip tone="green">Đang hoạt động</Chip> : <Chip tone="gray">Đã ngừng</Chip>}
              <span className="flex-1" />
              {changed ? (
                <button type="button" disabled={pending} onClick={() => run(() => renameCourtAction(venueId, court.id, name))} className={buttonClass("primary", "h-8 px-3 text-xs")}>
                  Lưu tên
                </button>
              ) : null}
              <button type="button" disabled={pending} onClick={() => toggle(court)} className={buttonClass(court.is_active ? "danger" : "outline", "h-8 px-3 text-xs")}>
                {court.is_active ? "Ngừng" : "Mở lại"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
