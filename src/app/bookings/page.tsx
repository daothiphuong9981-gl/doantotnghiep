import Link from "next/link";
import { redirect } from "next/navigation";
import { Countdown } from "@/components/booking/countdown";
import { BookingItems, StatusChip } from "@/components/booking/status";
import { Alert, buttonClass } from "@/components/ui/controls";
import { formatDateTime, formatVnd } from "@/lib/format";
import { listMyBookings } from "@/lib/services/bookings";

export const metadata = { title: "Lịch đặt của tôi - Cầu Lông Đà Nẵng" };

const TABS = [
  { scope: "", label: "Tất cả" },
  { scope: "upcoming", label: "Sắp tới" },
  { scope: "past", label: "Đã chơi" },
  { scope: "closed", label: "Đã hủy, hết hạn" },
];

// PB17 - Lịch sử đặt sân của người chơi
export default async function MyBookingsPage({ searchParams }: PageProps<"/bookings">) {
  const query = await searchParams;
  const scope = typeof query.scope === "string" && TABS.some((t) => t.scope === query.scope) ? query.scope : "";
  const result = await listMyBookings(scope || undefined);
  if (!result.ok && result.status === 401) redirect("/login?next=/bookings");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-extrabold">Lịch đặt của tôi</h1>
      <nav className="flex flex-wrap gap-2" aria-label="Lọc lượt đặt">
        {TABS.map((tab) => (
          <Link
            key={tab.scope}
            href={tab.scope ? `/bookings?scope=${tab.scope}` : "/bookings"}
            aria-current={tab.scope === scope ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
              tab.scope === scope ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {!result.ok ? <Alert>{result.message}</Alert> : null}
      {result.ok && result.data.bookings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Chưa có lượt đặt nào ở mục này.{" "}
          <Link href="/" className="font-semibold text-brand-700 hover:underline">
            Tìm sân
          </Link>
        </p>
      ) : null}
      {result.ok
        ? result.data.bookings.map((b) => (
            <article key={b.id} className="rounded-xl border border-slate-200 bg-white p-4" data-testid="booking-card" data-status={b.status}>
              <div className="flex flex-wrap items-center gap-2">
                <b>{b.code}</b>
                <StatusChip status={b.status} />
                {b.status === "holding" ? (
                  <span className="text-xs font-semibold text-orange-600">
                    <Countdown expiresAt={b.hold_expires_at} serverTime={result.data.server_time} />
                  </span>
                ) : null}
                <span className="flex-1" />
                <span className="text-xs text-slate-500">{formatDateTime(b.created_at)}</span>
              </div>
              <p className="mb-2 mt-1 text-sm">
                <Link href={`/venues/${b.venue_id}`} className="font-semibold hover:underline">
                  {b.venue_name}
                </Link>
                <span className="text-slate-500"> · {b.venue_address}</span>
              </p>
              <BookingItems items={b.items} />
              {b.status === "cancelled" && b.cancel_reason ? (
                <p className="mt-2 text-sm text-red-700">
                  {b.cancelled_by_owner ? "Chủ sân hủy" : "Bạn đã hủy"}. Lý do: {b.cancel_reason}
                </p>
              ) : null}
              <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
                <span className="flex-1 text-sm">
                  Tổng tiền: <b className="text-brand-700">{formatVnd(b.total_amount)}</b>
                </span>
                <Link href={`/bookings/${b.id}`} className={buttonClass(b.status === "holding" ? "primary" : "outline", "h-9")}>
                  {b.status === "holding" ? "Thanh toán" : "Chi tiết"}
                </Link>
              </div>
            </article>
          ))
        : null}
    </div>
  );
}
