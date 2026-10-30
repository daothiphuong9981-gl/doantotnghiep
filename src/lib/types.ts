export type Role = "player" | "owner" | "admin";
export type VenueStatus = "pending" | "approved" | "rejected" | "suspended" | "hidden";
export type DayType = "weekday" | "weekend";
export type SlotState = "available" | "held" | "booked" | "past";

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: Role;
  is_locked: boolean;
}

export interface Ward {
  id: number;
  name: string;
  type: string;
}

/** Sân hiển thị ở danh sách và bản đồ. */
export interface VenueCard {
  id: number;
  name: string;
  address: string;
  ward_id: number;
  ward_name: string;
  latitude: number;
  longitude: number;
  min_price: number | null;
  court_count: number;
  thumbnail: string | null;
  distance_km?: number | null;
  /** Số sân con còn trống ở khung giờ đang lọc (chỉ có khi lọc theo ngày, giờ). */
  free_courts?: number | null;
}

export type BookingStatus = "holding" | "awaiting_confirmation" | "confirmed" | "cancelled" | "expired";

export interface BookingItem {
  court_id: number;
  court_name: string;
  booking_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  price: number;
}

/** Một lượt đặt: nhiều sân con, nhiều khung giờ của cùng một cơ sở sân. */
export interface Booking {
  id: number;
  code: string;
  venue_id: number;
  venue_name: string;
  venue_address: string;
  total_amount: number;
  status: BookingStatus;
  hold_expires_at: string;
  paid_reported_at: string | null;
  transfer_note: string | null;
  confirmed_at: string | null;
  cancel_reason: string | null;
  /** Người hủy là chủ sân (true) hay chính người chơi (false); null nếu chưa hủy. */
  cancelled_by_owner: boolean | null;
  created_at: string;
  is_past: boolean;
  can_cancel: boolean;
  items: BookingItem[];
}

export interface PaymentInfo {
  bank_name: string;
  bank_bin: string | null;
  account_number: string;
  account_name: string;
  amount: number;
  content: string;
  /** Mã VietQR điền sẵn số tiền, nội dung; chỉ có khi lượt đặt đang giữ chỗ và sân đã chọn ngân hàng hợp lệ */
  qr: { payload: string; image: string } | null;
}

export interface PriceSlot {
  id?: number;
  day_type: DayType;
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  price: number;
}

export interface Court {
  id: number;
  name: string;
  is_active: boolean;
}

export interface VenueImage {
  id: number;
  storage_path: string;
  sort_order: number;
}

export interface Venue {
  id: number;
  owner_id: string | null;
  ward_id: number;
  name: string;
  address: string;
  description: string | null;
  contact_phone: string | null;
  latitude: number;
  longitude: number;
  open_time: string;
  close_time: string;
  hold_minutes: number;
  max_slots_per_booking: number;
  advance_days: number;
  max_active_holds: number;
  bank_name: string;
  bank_bin: string | null;
  bank_account_number: string;
  bank_account_name: string;
  status: VenueStatus;
  reject_reason: string | null;
}

export type NotificationKind = "booking_new" | "payment_reported" | "booking_confirmed" | "booking_cancelled" | "booking_expired" | "venue_reviewed";

/** Thông báo trong ứng dụng (bảng notifications). */
export interface AppNotification {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Đường dẫn trong website để xem chi tiết */
  link: string;
  read_at: string | null;
  created_at: string;
}

/** Kết quả chung của tầng dịch vụ: thành công kèm dữ liệu, hoặc lỗi kèm mã HTTP. */
export type Result<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

export const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
export const fail = (status: number, message: string): Result<never> => ({ ok: false, status, message });
