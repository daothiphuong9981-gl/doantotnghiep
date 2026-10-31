import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PaymentPanel } from "@/components/booking/payment-panel";
import { BookingItems, StatusChip } from "@/components/booking/status";
import { ReviewForm } from "@/components/reviews/review-form";
import { formatDateTime, formatVnd } from "@/lib/format";
import { getBooking } from "@/lib/services/bookings";
import { getMyBookingReview } from "@/lib/services/reviews";

export const metadata = { title: "Thanh toán lượt đặt - Cầu Lông Đà Nẵng" };

// PB18 - Trang thanh toán và chi tiết một lượt đặt
export default async function BookingPage({ params }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  // Trạng thái đánh giá lấy song song (hàm cơ sở dữ liệu tự kiểm tra lượt đặt thuộc người đang đăng nhập)
  const [result, review] = await Promise.all([getBooking(Number(id)), getMyBookingReview(Number(id))]);
  if (!result.ok) {
    if (result.status === 401) redirect(`/login?next=/bookings/${id}`);
    notFound();
  }
  const { booking, payment, server_time } = result.data;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 lg:flex-row">
      <section className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-extrabold">
            Lượt đặt <span data-testid="booking-code">{booking.code}</span>
          </h1>
          <StatusChip status={booking.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          <Link href={`/venues/${booking.venue_id}`} className="font-semibold text-brand-700 hover:underline">
            {booking.venue_name}
          </Link>{" "}
          · {booking.venue_address}
        </p>
        <p className="mt-1 text-xs text-slate-500">Tạo lúc {formatDateTime(booking.created_at)}</p>

        <h2 className="mb-1 mt-5 text-sm font-bold">Sân con và khung giờ</h2>
        <BookingItems items={booking.items} />
        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-sm font-semibold">Tổng tiền</span>
          <b className="text-xl text-brand-700" data-testid="booking-total">
            {formatVnd(booking.total_amount)}
          </b>
        </div>
        <p className="mt-6 text-sm">
          <Link href="/bookings" className="font-semibold text-brand-700 hover:underline">
            ← Lịch đặt của tôi
          </Link>
        </p>
      </section>
      <aside className="flex w-full flex-col gap-4 lg:w-[400px]">
        <PaymentPanel booking={booking} payment={payment} serverTime={server_time} />
        {review.ok && review.data ? <ReviewForm bookingId={booking.id} bookingStatus={booking.status} state={review.data} /> : null}
      </aside>
    </div>
  );
}
