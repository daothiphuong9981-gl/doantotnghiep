import Link from "next/link";
import { BookingItems, StatusChip } from "@/components/booking/status";
import { OwnerBookingActions } from "@/components/owner/booking-actions";
import { Alert, buttonClass, Chip, inputClass } from "@/components/ui/controls";
import { formatDateTime, formatVnd, isValidDate } from "@/lib/format";
import { listOwnerBookings } from "@/lib/services/bookings";

export const metadata = { title: "Lịch đặt sân - Cầu Lông Đà Nẵng" };

const TABS = [
  { status: "awaiting_confirmation", label: "Chờ xác nhận thanh toán", count: "awaiting_confirmation" },
  { status: "holding", label: "Đang giữ chỗ", count: "holding" },
  { status: "confirmed", label: "Đã xác nhận", count: "confirmed" },
  { status: "closed", label: "Đã hủy, hết hạn", count: "closed" },
  { status: "", label: "Tất cả", count: null },
] as const;
const KIND_LABEL = { walk_in: "Đặt hộ", block: "Khóa giờ" } as const;

// PB16 - Chủ sân xem lịch đặt và xác nhận thanh toán thủ công
export default async function OwnerBookingsPage({ searchParams }: PageProps<"/owner/bookings">) {
  const query = await searchParams;
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");
  // Link trong thông báo cũ dùng status=cancelled / expired: mở tab "Đã hủy, hết hạn"
  const rawStatus = one("status") === "cancelled" || one("status") === "expired" ? "closed" : one("status");
  const status = TABS.some((t) => t.status === rawStatus) && "status" in query ? rawStatus : "awaiting_confirmation";
  const venueId = Number(one("venue_id")) || undefined;
  const date = isValidDate(one("date")) ? one("date") : undefined;
  const q = one("q").trim().slice(0, 100);
  const page = Number(one("page")) > 0 ? Math.floor(Number(one("page"))) : 1;
  const result = await listOwnerBookings({ venueId, date, status: status || undefined, q: q || undefined, page });

  const href = (nextStatus: string, nextPage = 1) => {
    const params = new URLSearchParams({ status: nextStatus });
    if (venueId) params.set("venue_id", String(venueId));
    if (date) params.set("date", date);
    if (q) params.set("q", q);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/owner/bookings?${params}`;
  };
  const pages = result.ok ? Math.max(1, Math.ceil(result.data.total / result.data.page_size)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-extrabold">Lịch đặt sân</h1>
        <Link href="/owner/bookings/new" className={buttonClass("primary")}>
          + Đặt hộ khách / Khóa giờ
        </Link>
      </div>
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
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Mã lượt, tên hoặc SĐT khách</span>
              <input type="search" name="q" defaultValue={q} placeholder="DS1234, Nguyễn Văn A, 0905..." className={`${inputClass} w-64`} />
            </label>
            <button className={buttonClass("outline")}>Lọc</button>
            {venueId || date || q ? (
              <Link href={`/owner/bookings?status=${status}`} className="self-center text-sm font-semibold text-brand-700">
                Bỏ lọc
              </Link>
            ) : null}
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
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              {q ? `Không tìm thấy lượt đặt nào khớp với “${q}” ở mục này.` : "Không có lượt đặt nào ở mục này."}
            </p>
          ) : (
            <p className="text-sm text-slate-500">{result.data.total} lượt đặt</p>
          )}
          {result.data.bookings.map((b) => (
            <article key={b.id} className="rounded-xl border border-slate-200 bg-white p-4" data-testid="owner-booking" data-code={b.code}>
              <div className="flex flex-wrap items-center gap-2">
                <b>{b.code}</b>
                <StatusChip status={b.status} />
                {b.kind !== "online" ? <Chip tone="blue">{KIND_LABEL[b.kind]}</Chip> : null}
                <span className="text-sm text-slate-500">{b.venue_name}</span>
                <span className="flex-1" />
                <span className="text-xs text-slate-500">Đặt lúc {formatDateTime(b.created_at)}</span>
              </div>
              <p className="mb-2 mt-1 text-sm">
                {b.kind === "block" ? null : "Người đặt: "}
                <b>{b.player_name}</b>
                {b.player_phone ? (
                  <>
                    {" · "}
                    <a href={`tel:${b.player_phone}`} className="text-brand-700">
                      {b.player_phone}
                    </a>
                  </>
                ) : null}
              </p>
              <BookingItems items={b.items} />
              <div className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2 text-sm">
                {b.kind === "online" ? (
                  <div>
                    Tổng tiền: <b className="text-brand-700">{formatVnd(b.total_amount)}</b> · Nội dung chuyển khoản: <b>{b.code}</b>
                  </div>
                ) : b.kind === "walk_in" ? (
                  <div>
                    Tổng tiền: <b className="text-brand-700">{formatVnd(b.total_amount)}</b> · Thu trực tiếp tại sân
                  </div>
                ) : null}
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
              {b.can_cancel || b.status === "awaiting_confirmation" ? <OwnerBookingActions id={b.id} status={b.status} kind={b.kind} /> : null}
            </article>
          ))}
          {pages > 1 ? (
            <nav className="flex items-center gap-3 text-sm" aria-label="Phân trang">
              {page > 1 ? (
                <Link href={href(status, page - 1)} className={buttonClass("outline", "h-9")}>
                  ← Trang trước
                </Link>
              ) : null}
              <span className="text-slate-500">
                Trang {Math.min(page, pages)}/{pages}
              </span>
              {page < pages ? (
                <Link href={href(status, page + 1)} className={buttonClass("outline", "h-9")}>
                  Trang sau →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
