import { Chip } from "@/components/ui/controls";
import { describeDate, formatVnd, slotRange } from "@/lib/format";
import type { BookingItem, BookingStatus } from "@/lib/types";

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: "orange" | "yellow" | "green" | "red" | "gray" }> = {
  holding: { label: "Đang giữ chỗ", tone: "orange" },
  awaiting_confirmation: { label: "Chờ chủ sân xác nhận", tone: "yellow" },
  confirmed: { label: "Đã xác nhận", tone: "green" },
  cancelled: { label: "Đã hủy", tone: "red" },
  expired: { label: "Hết hạn giữ chỗ", tone: "gray" },
};

export function StatusChip({ status }: { status: BookingStatus }) {
  return <Chip tone={BOOKING_STATUS[status].tone}>{BOOKING_STATUS[status].label}</Chip>;
}

/** Các dòng chi tiết của một lượt đặt: ngày, sân con, khung giờ, giá. */
export function BookingItems({ items }: { items: BookingItem[] }) {
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {items.map((item) => (
        <li key={`${item.court_id}-${item.booking_date}-${item.start_time}`} className="flex items-center gap-3 py-1.5">
          <span className="w-24 flex-none text-slate-500">
            {describeDate(item.booking_date).weekday} {describeDate(item.booking_date).short}
          </span>
          <b className="w-20 flex-none">{item.court_name}</b>
          <span className="flex-1">{slotRange(item.start_time)}</span>
          <span className="font-semibold">{formatVnd(item.price)}</span>
        </li>
      ))}
    </ul>
  );
}
