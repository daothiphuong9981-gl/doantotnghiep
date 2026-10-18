import Link from "next/link";
import { BookingItems, StatusChip } from "@/components/booking/status";
import { OwnerBookingActions } from "@/components/owner/booking-actions";
import { Alert, buttonClass, inputClass } from "@/components/ui/controls";
import { formatDateTime, formatVnd, isValidDate } from "@/lib/format";
import { listOwnerBookings } from "@/lib/services/bookings";

export const metadata = { title: "Lịch đặt sân - Cầu Lông Đà Nẵng" };

const TABS = [
  { status: "awaiting_confirmation", label: "Chờ xác nhận thanh toán", count: "awaiting_confirmation" },
  { status: "holding", label: "Đang giữ chỗ", count: "holding" },
  { status: "confirmed", label: "Đã xác nhận", count: "confirmed" },
  { status: "", label: "Tất cả", count: null },
] as const;

// PB16 - Chủ sân xem lịch đặt và xác nhận thanh toán thủ công
export default async function OwnerBookingsPage({ searchParams }: PageProps<"/owner/bookings">) {
  const query = await searchParams;
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");
  const status = TABS.some((t) => t.status === one("status")) && "status" in query ? one("status") : "awaiting_confirmation";
  const venueId = Number(one("venue_id")) || undefined;
  const date = isValidDate(one("date")) ? one("date") : undefined;
  const result = await listOwnerBookings({ venueId, date, status: status || undefined });

  const href = (nextStatus: string) => {
    const params = new URLSearchParams({ status: nextStatus });
    if (venueId) params.set("venue_id", String(venueId));
    if (date) params.set("date", date);
    return `/owner/bookings?${params}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Lịch đặt sân</h1>
      {!result.ok ? <Alert>{result.message}</Alert> : null}
      {result.ok ? (
        <>
          <form className="flex flex-wrap items-end gap-3" action="/owner/bookings">
            <input type="hidden" name="status" value={status} />
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Sân</span>
              <select name="venue_id" defaultValue={venueId ?? ""} className={`${inputClass} w-56`}>
                <option value="">Tất cả sân của tôi</option>
                {result.data.venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Ngày chơi</span>
              <input type="date" name="date" defaultValue={date ?? ""} className={`${inputClass} w-44`} />
            </label>
            <button className={buttonClass("outline")}>Lọc</button>
          </form>

          <nav className="flex flex-wrap gap-2" aria-label="Trạng thái lượt đặt">
            {TABS.map((tab) => (
              <Link
                key={tab.status}
                href={href(tab.status)}
                aria-current={tab.status === status ? "page" : undefined}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
                  tab.status === status ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.label}
                {tab.count ? ` (${result.data.summary[tab.count]})` : ""}
              </Link>
            ))}
          </nav>

          {result.data.bookings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Không có lượt đặt nào ở mục này.</p>
          ) : null}
          {result.data.bookings.map((b) => (
            <article key={b.id} className="rounded-xl border border-slate-200 bg-white p-4" data-testid="owner-booking" data-code={b.code}>
              <div className="flex flex-wrap items-center gap-2">
                <b>{b.code}</b>
                <StatusChip status={b.status} />
                <span className="text-sm text-slate-500">{b.venue_name}</span>
                <span className="flex-1" />
                <span className="text-xs text-slate-500">Đặt lúc {formatDateTime(b.created_at)}</span>
              </div>
              <p className="mb-2 mt-1 text-sm">
                Người đặt: <b>{b.player_name}</b>
                {b.player_phone ? ` · ${b.player_phone}` : ""}
              </p>
              <BookingItems items={b.items} />
              <div className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2 text-sm">
                <div>
                  Tổng tiền: <b className="text-brand-700">{formatVnd(b.total_amount)}</b> · Nội dung chuyển khoản: <b>{b.code}</b>
                </div>
                {b.paid_reported_at ? (
                  <div className="text-slate-600">
                    Người chơi báo đã chuyển khoản lúc {formatDateTime(b.paid_reported_at)}
                    {b.transfer_note ? ` — “${b.transfer_note}”` : ""}
                  </div>
                ) : null}
                {b.status === "holding" ? <div className="text-slate-600">Giữ chỗ đến {formatDateTime(b.hold_expires_at)}, chưa báo thanh toán.</div> : null}
                {b.status === "cancelled" && b.cancel_reason ? <div className="text-red-700">Lý do hủy: {b.cancel_reason}</div> : null}
              </div>
              {b.status === "awaiting_confirmation" && !b.can_cancel ? (
                <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="overdue">
                  Đã đến giờ chơi mà lượt này chưa được xác nhận. Kiểm tra tài khoản rồi chọn &ldquo;Đã nhận tiền&rdquo; hoặc &ldquo;Chưa nhận được&rdquo;.
                </div>
              ) : null}
              {/* Lượt chờ xác nhận luôn xử lý được, kể cả sau giờ chơi (migration 0007) */}
              {b.can_cancel || b.status === "awaiting_confirmation" ? <OwnerBookingActions id={b.id} status={b.status} /> : null}
            </article>
          ))}
        </>
      ) : null}
    </div>
  );
}
