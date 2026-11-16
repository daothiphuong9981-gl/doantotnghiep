import type { PriceSlot } from "./types";

// Hằng số và hàm kiểm tra dùng chung cho cả trình duyệt lẫn máy chủ.
// Tách khỏi validation.ts để component phía client không kéo theo zod (~110 KB) vào gói JS.

export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png"];

/**
 * Các giờ trong giờ mở cửa chưa có giá ngày thường (người chơi không đặt được). Cuối tuần không khai giá thì dùng giá
 * ngày thường nên chỉ cần kiểm tra ngày thường. Trả về danh sách "HH:00".
 */
export function uncoveredHours(prices: PriceSlot[], openTime: string, closeTime: string): string[] {
  const open = Number(openTime.slice(0, 2));
  const close = Number(closeTime.slice(0, 2)) + (closeTime.slice(3, 5) !== "00" ? 1 : 0);
  const out: string[] = [];
  for (let h = open; h < close; h += 1) {
    const t = `${String(h).padStart(2, "0")}:00`;
    if (!prices.some((p) => p.day_type === "weekday" && p.start_time <= t && t < p.end_time)) out.push(t);
  }
  return out;
}

/** Tìm cặp khung giá cùng loại ngày bị chồng giờ lên nhau. Trả về thông báo lỗi hoặc null. */
export function findPriceOverlap(prices: PriceSlot[]): string | null {
  const label = { weekday: "ngày thường", weekend: "cuối tuần" } as const;
  for (let i = 0; i < prices.length; i += 1) {
    for (let j = i + 1; j < prices.length; j += 1) {
      const a = prices[i];
      const b = prices[j];
      if (a.day_type === b.day_type && a.start_time < b.end_time && b.start_time < a.end_time) {
        return `Khung giá ${a.start_time}–${a.end_time} và ${b.start_time}–${b.end_time} (${label[a.day_type]}) bị trùng giờ`;
      }
    }
  }
  return null;
}
