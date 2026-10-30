import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SlotPicker } from "@/components/booking/slot-picker";
import { ReviewList } from "@/components/reviews/review-list";
import { RatingBadge, Stars } from "@/components/reviews/stars";
import { Map } from "@/components/map/map";
import { buttonClass, Chip, CourtPlaceholder } from "@/components/ui/controls";
import { addDays, currentHourInVietnam, describeDate, formatVnd, isValidDate, todayInVietnam } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { listVenueReviews } from "@/lib/services/reviews";
import { getAvailability, getVenueDetail } from "@/lib/services/venues";
import { imageUrl } from "@/lib/supabase/env";
import { directionsUrl } from "@/lib/venue-filter";

const DAY_LABEL = { weekday: "Ngày thường", weekend: "Cuối tuần" } as const;

// PB11, PB14 - Trang chi tiết sân: khách xem được; người chơi chọn khung giờ và giữ chỗ
export default async function VenuePage({ params, searchParams }: PageProps<"/venues/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const venueId = Number(id);
  // Phiên đăng nhập không phụ thuộc thông tin sân: lấy song song, bớt một lượt chờ Supabase
  // Đánh giá cũng không phụ thuộc thông tin sân: lấy cùng lúc
  const [detail, session, reviews] = await Promise.all([getVenueDetail(venueId), getSession(), listVenueReviews(venueId)]);
  if (!detail.ok) notFound();
  const { venue, prices, images } = detail.data;

  const today = todayInVietnam();
  // Mặc định xem hôm nay; nếu hôm nay đã hết khung giờ thì xem ngày mai
  const closeHour = Number(venue.close_time.slice(0, 2));
  const defaultDate = currentHourInVietnam() >= closeHour - 1 ? addDays(today, 1) : today;
  const requested = typeof query.date === "string" ? query.date : defaultDate;
  const date = isValidDate(requested) && requested >= today && requested <= addDays(today, venue.advance_days) ? requested : defaultDate;
  // Giờ được chọn sẵn khi đi từ trợ lý AI hoặc bộ lọc khung giờ
  const focusTime = typeof query.time === "string" && /^([01]\d|2[0-3]):00$/.test(query.time) ? query.time : null;
  const availability = await getAvailability(venueId, date);
  const days = Array.from({ length: venue.advance_days + 1 }, (_, i) => addDays(today, i));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="grid h-40 grid-cols-4 gap-2">
          {images.length > 0 ? (
            images.slice(0, 3).map((img, i) => (
              <Image
                key={img.id}
                src={imageUrl(img.storage_path) ?? ""}
                alt={`Ảnh ${i + 1} của ${venue.name}`}
                width={i === 0 ? 720 : 360}
                height={320}
                sizes={i === 0 ? "(min-width: 1024px) 400px, 50vw" : "(min-width: 1024px) 200px, 25vw"}
                preload={i === 0}
                className={`h-40 w-full rounded-xl object-cover ${i === 0 ? "col-span-2" : ""}`}
              />
            ))
          ) : (
            <>
              <CourtPlaceholder className="col-span-2 h-40" />
              <CourtPlaceholder className="h-40" />
              <CourtPlaceholder className="h-40" />
            </>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-extrabold">{venue.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            📍 {venue.address} · {venue.ward_name} · mở cửa {venue.open_time} – {venue.close_time}
            {venue.contact_phone ? ` · ${venue.contact_phone}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reviews.ok ? <RatingBadge avg={reviews.data.summary.avg} count={reviews.data.summary.count} /> : null}
            <Chip>{detail.data.courts.length} sân con</Chip>
            <Chip tone="orange">Giữ chỗ {venue.hold_minutes} phút</Chip>
            <Chip>Đặt trước tối đa {venue.advance_days} ngày</Chip>
          </div>
          {venue.description ? <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{venue.description}</p> : null}
        </div>

        <section>
          <h2 className="mb-2 text-base font-bold">Chọn ngày và khung giờ</h2>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => {
              const info = describeDate(d);
              const active = d === date;
              return (
                <Link
                  key={d}
                  href={`/venues/${venueId}?date=${d}`}
                  scroll={false}
                  className={`flex h-12 w-16 flex-none flex-col items-center justify-center rounded-lg border text-sm ${
                    active ? "border-brand-700 bg-brand-50 font-bold text-brand-700" : "border-slate-300 bg-white"
                  }`}
                >
                  <span className="text-xs">{info.weekday}</span>
                  <b>{info.short}</b>
                </Link>
              );
            })}
          </div>
          {availability.ok ? (
            availability.data.courts.length === 0 ? (
              <p className="text-sm text-slate-500">Sân chưa khai báo sân con.</p>
            ) : (
              <SlotPicker venueId={venueId} availability={availability.data} holdMinutes={venue.hold_minutes} maxSlots={venue.max_slots_per_booking} focusTime={focusTime} role={session?.profile.role ?? null} />
            )
          ) : (
            <p className="text-sm text-red-600">{availability.message}</p>
          )}
        </section>

        <section id="danh-gia">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold">Đánh giá từ người đã thuê sân</h2>
            {reviews.ok && reviews.data.summary.count > 0 && reviews.data.summary.avg !== null ? (
              <span className="flex items-center gap-1.5 text-sm text-slate-600">
                <Stars value={reviews.data.summary.avg} />
                <b>{reviews.data.summary.avg.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b>
                <span>({reviews.data.summary.count} đánh giá)</span>
              </span>
            ) : null}
          </div>
          {reviews.ok ? (
            <ReviewList venueId={venueId} initial={reviews.data.reviews} hasMore={reviews.data.has_more} />
          ) : (
            <p className="text-sm text-red-600">{reviews.message}</p>
          )}
        </section>
      </div>

      <aside className="flex w-full flex-col gap-4 lg:w-80">
        <div className="rounded-xl border border-slate-200 bg-white">
          <h2 className="px-4 pt-4 text-base font-bold">Bảng giá</h2>
          {prices.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Chủ sân chưa khai báo bảng giá.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {prices.map((p) => (
                  <tr key={`${p.day_type}-${p.start_time}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 text-slate-500">{DAY_LABEL[p.day_type]}</td>
                    <td className="py-2">
                      {p.start_time} – {p.end_time}
                    </td>
                    <td className="px-4 py-2 text-right font-extrabold text-brand-700">{formatVnd(p.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="h-56 overflow-hidden rounded-xl border border-slate-200">
          <Map pins={[{ id: venue.id, latitude: venue.latitude, longitude: venue.longitude, label: "Sân", title: venue.name }]} activeId={venue.id} />
        </div>
        <a href={directionsUrl(venue.latitude, venue.longitude)} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "w-full")}>
          Chỉ đường tới sân (xe máy) ↗
        </a>
      </aside>
    </div>
  );
}
