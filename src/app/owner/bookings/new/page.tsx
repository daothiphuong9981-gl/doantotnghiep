import Link from "next/link";
import { OfflineBookingForm } from "@/components/owner/offline-booking-form";
import { Alert, buttonClass, inputClass } from "@/components/ui/controls";
import { addDays, isValidDate, todayInVietnam } from "@/lib/format";
import { getMyVenue, listMyVenues } from "@/lib/services/owner";
import { buildAvailability, takenSlots } from "@/lib/services/venues";

export const metadata = { title: "Đặt hộ khách / Khóa giờ - Cầu Lông Đà Nẵng" };

/**
 * Chủ sân đặt hộ khách gọi điện / đến trực tiếp, hoặc khóa khung giờ (bảo trì, giải đấu riêng).
 * Chọn sân và ngày bằng form GET; lưới khung giờ đọc trực tiếp (không lưu đệm) như trang chi tiết sân.
 */
export default async function OfflineBookingPage({ searchParams }: PageProps<"/owner/bookings/new">) {
  const query = await searchParams;
  const today = todayInVietnam();
  const venues = await listMyVenues();
  const usable = venues.ok ? venues.data.filter((v) => v.status === "approved" || v.status === "suspended" || v.status === "pending") : [];
  const venueId = Number(query.venue_id) || usable[0]?.id;
  const rawDate = typeof query.date === "string" ? query.date : today;
  const date = isValidDate(rawDate) && rawDate >= today && rawDate <= addDays(today, 60) ? rawDate : today;

  const [detail, rows] = venueId ? await Promise.all([getMyVenue(venueId), takenSlots(venueId, date)]) : [null, null];
  const availability =
    detail?.ok && rows
      ? buildAvailability({ venue: detail.data.venue, prices: detail.data.prices, courts: detail.data.courts.filter((c) => c.is_active) }, date, rows)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-extrabold">Đặt hộ khách / Khóa giờ</h1>
        <Link href="/owner/bookings?status=confirmed" className={buttonClass("outline")}>
          ← Lịch đặt sân
        </Link>
      </div>
      <p className="text-sm text-slate-600">
        Dùng khi khách gọi điện hoặc đến trực tiếp, hoặc khi bạn cần giữ sân cho việc riêng (bảo trì, giải đấu). Khung giờ sẽ hiện &ldquo;Đã đặt&rdquo; với người chơi khác
        nên không bị đặt trùng. Lượt đặt hộ được xác nhận ngay, tiền thu trực tiếp tại sân.
      </p>
      {!venues.ok ? <Alert>{venues.message}</Alert> : null}
      {venues.ok && usable.length === 0 ? <Alert tone="info">Bạn chưa có sân nào đang hoạt động.</Alert> : null}
      {usable.length > 0 ? (
        <form className="flex flex-wrap items-end gap-3" action="/owner/bookings/new">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Sân</span>
            <select name="venue_id" defaultValue={venueId} className={`${inputClass} w-56`}>
              {usable.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Ngày</span>
            <input type="date" name="date" min={today} max={addDays(today, 60)} defaultValue={date} className={`${inputClass} w-44`} />
          </label>
          <button className={buttonClass("outline")}>Xem khung giờ</button>
        </form>
      ) : null}
      {venueId && detail && !detail.ok ? <Alert>{detail.message}</Alert> : null}
      {venueId && detail?.ok && !rows ? <Alert>Không tải được khung giờ. Vui lòng thử lại.</Alert> : null}
      {availability && venueId ? <OfflineBookingForm key={`${venueId}-${date}`} venueId={venueId} availability={availability} /> : null}
    </div>
  );
}
