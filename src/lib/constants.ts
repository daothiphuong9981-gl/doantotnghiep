/**
 * Quy định đặt sân do chủ sân thiết lập cho từng sân (cột tương ứng trong bảng venues).
 * min, max khớp với ràng buộc CHECK trong 0004_venue_rules.sql.
 */
export const BOOKING_RULES = {
  /** Số khung giờ tối đa trong một lượt đặt */
  max_slots_per_booking: { min: 1, max: 50, default: 20 },
  /** Số ngày được đặt trước tính từ hôm nay */
  advance_days: { min: 1, max: 30, default: 7 },
  /** Số lượt đang giữ chỗ cùng lúc của một người chơi tại sân */
  max_active_holds: { min: 1, max: 10, default: 2 },
} as const;

/** Số trang kết quả, giới hạn chung */
export const PAGE_SIZE = 20;
