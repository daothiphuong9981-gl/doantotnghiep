import "server-only";
import { revalidateTag, updateTag } from "next/cache";

/**
 * Tag của Data Cache (unstable_cache) cho dữ liệu CÔNG KHAI: sân đã duyệt, bảng giá, ảnh, sân con, đánh giá đang hiện.
 * Không bao giờ gắn tag/lưu đệm dữ liệu theo người dùng (phiên, lượt đặt, thông báo, ngân hàng, giờ trống).
 */
export const CACHE_TAG = {
  /** Danh sách sân mặc định + mọi trang chi tiết sân */
  venues: "venues",
  /** Chi tiết một sân (thông tin, giá, ảnh, sân con) */
  venue: (id: number) => `venue:${id}`,
  /** Điểm trung bình đánh giá (mọi sân và từng sân) */
  ratings: "ratings",
  /** Mọi trang đánh giá đầu tiên của các sân (đổi tên/xóa tài khoản người viết, ẩn/trả lời theo mã đánh giá) */
  reviews: "reviews",
  /** Trang đánh giá đầu tiên của một sân */
  venueReviews: (id: number) => `reviews:${id}`,
} as const;

/** Sân thay đổi (thông tin, giá, ảnh, sân con, trạng thái duyệt/tạm ngừng): chi tiết, danh sách, đánh giá của sân đó. */
export function venueTags(venueId: number): string[] {
  const id = Number(venueId);
  if (!Number.isInteger(id) || id <= 0) return [CACHE_TAG.venues, CACHE_TAG.ratings, CACHE_TAG.reviews];
  return [CACHE_TAG.venues, CACHE_TAG.venue(id), CACHE_TAG.ratings, CACHE_TAG.venueReviews(id)];
}

/** Đánh giá thay đổi (gửi, sửa, trả lời, ẩn/hiện) */
export const REVIEW_TAGS = [CACHE_TAG.ratings, CACHE_TAG.reviews];

/** Dữ liệu công khai có thể chứa thông tin của một tài khoản (tên người viết đánh giá, SĐT/sân của chủ sân). */
export const ACCOUNT_TAGS = [CACHE_TAG.venues, CACHE_TAG.ratings, CACHE_TAG.reviews];

/**
 * Trong Server Action: hết hạn ngay (updateTag) để người vừa sửa thấy ngay thay đổi của mình.
 */
export function expireTagsInAction(tags: string[]) {
  for (const tag of tags) updateTag(tag);
}

/**
 * Trong Route Handler (updateTag không dùng được ở đây): hết hạn ngay thay vì "max" (phục vụ dữ liệu cũ một lần)
 * vì các thay đổi này là ẩn đánh giá, gỡ sân, xóa tài khoản... cần biến mất ngay; lưu lượng sửa rất nhỏ.
 */
export function expireTagsInRoute(tags: string[]) {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}
