"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui/controls";
import { describeDate, formatVnd, slotRange } from "@/lib/format";
import type { Availability } from "@/lib/services/venues";
import type { Role, SlotState } from "@/lib/types";

interface Picked {
  court_id: number;
  court_name: string;
  booking_date: string;
  start_time: string;
  price: number;
}

const keyOf = (courtId: number, date: string, time: string) => `${courtId}|${date}|${time}`;

/**
 * Chạy fn ngay, và chạy lại một lần khi phần tử thật sự có kích thước (lúc trang còn đang tải,
 * nội dung có thể nằm ẩn nên mọi phép đo vị trí đều bằng 0). Trả về hàm dọn dẹp cho useEffect.
 */
function whenVisible(el: HTMLElement, fn: () => void) {
  fn();
  if (el.clientWidth > 0) return undefined;
  const observer = new ResizeObserver(() => {
    if (el.clientWidth > 0) {
      fn();
      observer.disconnect();
    }
  });
  observer.observe(el);
  return () => observer.disconnect();
}
const shortPrice = (price: number | null) => (price === null ? "—" : `${Math.round(price / 1000)}k`);

const CELL: Record<SlotState | "selected" | "noprice", string> = {
  available: "border border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-700 cursor-pointer",
  selected: "border border-amber-500 bg-amber-400 font-bold text-slate-900 cursor-pointer",
  held: "bg-orange-100 text-orange-700 cursor-not-allowed",
  booked: "bg-slate-100 text-slate-400 cursor-not-allowed",
  past: "bg-slate-50 text-slate-300 cursor-not-allowed",
  noprice: "bg-slate-50 text-slate-300 cursor-not-allowed",
};
const LABEL: Record<SlotState, string> = { available: "Trống", held: "Đang giữ", booked: "Đã đặt", past: "Đã qua" };

/**
 * PB14, PB15 - Lưới khung giờ: chọn nhiều ô của nhiều sân con rồi giữ chỗ trong một lượt.
 * Ô đang được người khác giữ hoặc đã đặt không bấm được.
 */
export function SlotPicker({
  venueId,
  availability,
  holdMinutes,
  maxSlots,
  focusTime = null,
  role,
}: {
  venueId: number;
  availability: Availability;
  holdMinutes: number;
  /** Số khung giờ tối đa trong một lượt, do chủ sân thiết lập */
  maxSlots: number;
  /** Giờ cần làm nổi bật và cuộn tới (đi từ trợ lý AI hoặc bộ lọc khung giờ) */
  focusTime?: string | null;
  role: Role | null;
}) {
  const router = useRouter();
  const { date } = availability;
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const focusRef = useRef<HTMLTableCellElement>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [focusTime, date]);

  /** Giờ đầu tiên còn ít nhất một sân con trống và có giá. */
  const firstOpenHour = useMemo(
    () => availability.hours.find((_, i) => availability.courts.some((c) => c.slots[i]?.state === "available" && c.slots[i]?.price !== null)) ?? null,
    [availability],
  );
  // Máy tính, máy tính bảng: không có giờ cần làm nổi bật thì cuộn ngang bảng tới giờ trống đầu tiên
  // (buổi sáng đã qua nằm bên trái), chỉ cuộn trong khung bảng chứ không kéo cả trang.
  const tableBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = tableBox.current;
    if (focusTime || !firstOpenHour || !box) return;
    const scroll = () => {
      const th = box.querySelector<HTMLElement>(`th[data-hour="${firstOpenHour}"]`);
      const first = box.querySelector<HTMLElement>("th");
      if (th && first && box.clientWidth > 0) box.scrollLeft = Math.max(0, th.offsetLeft - first.offsetWidth - 8);
    };
    return whenVisible(box, scroll);
  }, [focusTime, firstOpenHour, date]);


  // Tải lại lưới định kỳ để thấy ô vừa được giữ hoặc vừa được trả lại
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(timer);
  }, [router]);

  // Ô đã chọn của ngày đang xem mà không còn trống (người khác vừa giữ) thì tự bỏ khỏi lựa chọn
  const stateOf = useMemo(() => {
    const map = new Map<string, SlotState>();
    for (const court of availability.courts) for (const slot of court.slots) map.set(keyOf(court.id, date, slot.start_time), slot.state);
    return map;
  }, [availability, date]);
  const selection = picked.filter((p) => p.booking_date !== date || stateOf.get(keyOf(p.court_id, p.booking_date, p.start_time)) === "available");
  const selectedKeys = new Set(selection.map((p) => keyOf(p.court_id, p.booking_date, p.start_time)));
  const total = selection.reduce((sum, p) => sum + p.price, 0);

  function toggle(courtId: number, courtName: string, time: string, price: number) {
    setError(null);
    const key = keyOf(courtId, date, time);
    if (selectedKeys.has(key)) {
      setPicked(selection.filter((p) => keyOf(p.court_id, p.booking_date, p.start_time) !== key));
      return;
    }
    if (selection.length >= maxSlots) {
      setError(`Sân này cho đặt tối đa ${maxSlots} khung giờ trong một lượt.`);
      return;
    }
    setPicked([...selection, { court_id: courtId, court_name: courtName, booking_date: date, start_time: time, price }]);
  }

  const canBook = role === null || role === "player";

  async function hold() {
    if (!role) {
      router.push(`/login?next=${encodeURIComponent(`/venues/${venueId}?date=${date}`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_id: venueId,
          items: selection.map(({ court_id, booking_date, start_time }) => ({ court_id, booking_date, start_time })),
        }),
      });
      const body = await res.json();
      if (res.status === 201) {
        router.push(`/bookings/${body.data.booking.id}`);
        return;
      }
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/venues/${venueId}?date=${date}`)}`);
        return;
      }
      setError(body.message ?? "Không giữ được chỗ. Vui lòng thử lại.");
      if (res.status === 409 && body.data?.conflicts) {
        const taken = new Set<string>(body.data.conflicts.map((c: Picked) => keyOf(c.court_id, c.booking_date, c.start_time)));
        setPicked(selection.filter((p) => !taken.has(keyOf(p.court_id, p.booking_date, p.start_time))));
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="-mb-1 text-xs text-slate-500 sm:hidden">Vuốt ngang bảng để xem các giờ khác. Cột tên sân luôn cố định bên trái.</p>
      <div ref={tableBox} className="overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white [-webkit-overflow-scrolling:touch]">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Khung giờ ngày {describeDate(date).full}. Bấm vào ô trống để chọn.</caption>
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left shadow-[2px_0_4px_-2px_rgba(15,23,42,0.15)]">Sân</th>
              {availability.hours.map((h) => (
                <th
                  key={h}
                  data-hour={h}
                  ref={h === focusTime ? focusRef : undefined}
                  data-focus={h === focusTime ? "true" : undefined}
                  className={`px-1 py-2 font-semibold ${h === focusTime ? "bg-amber-100 text-amber-800" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {availability.courts.map((court) => (
              <tr key={court.id} className="border-t border-slate-100">
                <th className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 text-left shadow-[2px_0_4px_-2px_rgba(15,23,42,0.15)]">{court.name}</th>
                {court.slots.map((slot) => {
                  const selected = selectedKeys.has(keyOf(court.id, date, slot.start_time));
                  const bookable = slot.state === "available" && slot.price !== null && canBook;
                  const look = selected ? "selected" : slot.state === "available" && slot.price === null ? "noprice" : slot.state;
                  const text = selected ? "✓ Chọn" : slot.state === "available" ? shortPrice(slot.price) : LABEL[slot.state];
                  return (
                    <td key={slot.start_time} className={`p-1 ${slot.start_time === focusTime ? "bg-amber-50" : ""}`}>
                      <button
                        type="button"
                        disabled={!bookable}
                        aria-pressed={selected}
                        aria-label={`${court.name}, ${slotRange(slot.start_time)}, ${
                          slot.state === "available" ? (slot.price !== null ? formatVnd(slot.price) : "chưa có giá") : LABEL[slot.state]
                        }`}
                        data-court={court.name}
                        data-time={slot.start_time}
                        data-state={selected ? "selected" : slot.state}
                        onClick={() => slot.price !== null && toggle(court.id, court.name, slot.start_time, slot.price)}
                        className={`flex h-11 w-full min-w-16 touch-manipulation items-center justify-center rounded-md text-xs sm:h-8 sm:min-w-14 ${CELL[look]}`}
                      >
                        {text}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {focusTime ? <p className="text-xs font-semibold text-amber-700">Khung giờ {focusTime} bạn tìm đang được tô nổi bật. Hãy chọn sân con còn trống.</p> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-3 w-5 rounded border border-brand-200 bg-brand-50" /> Trống (giá/giờ)
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-3 w-5 rounded bg-amber-400" /> Bạn chọn
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-3 w-5 rounded bg-orange-100" /> Đang được giữ chỗ
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-3 w-5 rounded bg-slate-100" /> Đã đặt
        </span>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {!canBook ? (
        <p className="text-sm text-slate-500">Chỉ tài khoản người chơi mới đặt được sân.</p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4" aria-live="polite">
          <h3 className="mb-2 text-sm font-bold">Lượt đặt của bạn</h3>
          {selection.length === 0 ? (
            <p className="text-sm text-slate-500">
              Bấm vào các ô trống để chọn. Một lượt đặt có thể gồm nhiều sân con và nhiều khung giờ (tối đa {maxSlots}). Mỗi khung giờ 60 phút.
            </p>
          ) : (
            <ul className="mb-3 divide-y divide-slate-100 text-sm" data-testid="selection">
              {[...selection]
                .sort((a, b) => keyOf(0, a.booking_date, a.start_time).localeCompare(keyOf(0, b.booking_date, b.start_time)) || a.court_id - b.court_id)
                .map((p) => (
                  <li key={keyOf(p.court_id, p.booking_date, p.start_time)} className="flex items-center gap-3 py-1.5">
                    <span className="w-20 flex-none text-slate-500">
                      {describeDate(p.booking_date).weekday} {describeDate(p.booking_date).short}
                    </span>
                    <b className="w-20 flex-none">{p.court_name}</b>
                    <span className="flex-1">{slotRange(p.start_time)}</span>
                    <span className="font-semibold">{formatVnd(p.price)}</span>
                  </li>
                ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 text-sm">
              Tổng tiền: <b className="text-lg text-brand-700" data-testid="total">{formatVnd(total)}</b>
            </div>
            <Button onClick={hold} disabled={busy || selection.length === 0}>
              {busy ? "Đang giữ chỗ..." : "Giữ chỗ và thanh toán"}
            </Button>
          </div>
          {selection.length > 0 ? (
            <div
              className="fixed inset-x-0 bottom-0 z-[1100] border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden"
              data-testid="mobile-hold-bar"
            >
              {error ? <p className="mb-1 text-xs font-medium text-red-600">{error}</p> : null}
              <div className="flex items-center gap-3">
                <div className="flex-1 leading-tight">
                  <div className="text-xs text-slate-500">{selection.length} khung giờ</div>
                  <b className="text-lg text-brand-700">{formatVnd(total)}</b>
                </div>
                <Button onClick={hold} disabled={busy} className="h-11">
                  {busy ? "Đang giữ chỗ..." : "Giữ chỗ và thanh toán"}
                </Button>
              </div>
            </div>
          ) : null}
          {selection.length > 0 ? <div className="h-20 sm:hidden" aria-hidden /> : null}
          <p className="mt-2 text-xs text-slate-500">
            Sau khi bấm, sân được giữ cho bạn trong {holdMinutes} phút để chuyển khoản. Quá thời gian mà chưa báo thanh toán, sân tự động được trả lại cho
            người khác đặt.
          </p>
        </div>
      )}
    </div>
  );
}
