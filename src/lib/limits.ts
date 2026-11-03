import type { PriceSlot } from "./types";

// Hằng số và hàm kiểm tra dùng chung cho cả trình duyệt lẫn máy chủ.
// Tách khỏi validation.ts để component phía client không kéo theo zod (~110 KB) vào gói JS.

export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png"];

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
