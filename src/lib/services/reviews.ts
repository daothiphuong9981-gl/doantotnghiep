import { unstable_cache } from "next/cache";
import { CACHE_TAG } from "@/lib/cache-tags";
import { dbFail } from "@/lib/db-errors";
import { publicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import {
  fail,
  ok,
  type AdminReview,
  type MyReviewState,
  type OwnerReview,
  type PublicReview,
  type RatingSummary,
  type Result,
  type ReviewStatus,
} from "@/lib/types";
import { replySchema, reviewSchema } from "@/lib/validation";

/**
 * Đánh giá sân (0012_venue_reviews.sql). Mọi quy tắc (ai được đánh giá, cửa sổ 24 giờ sau giờ chơi, ẩn tên,
 * quyền trả lời, quyền ẩn) nằm trong các hàm cơ sở dữ liệu; ở đây chỉ kiểm tra định dạng đầu vào và đổi lỗi.
 */

export const REVIEWS_PAGE_SIZE = 20;

const validId = (id: number) => Number.isInteger(id) && id > 0;

type RatingRow = { venue_id: number; rating_avg: number | string; rating_count: number };

/**
 * Điểm trung bình theo sân (dữ liệu công khai, hàm security definer không dùng auth.uid()): client ẩn danh, lưu đệm
 * 300 giây với tag "ratings" (gửi/sửa/ẩn đánh giá, đổi trạng thái sân thì xóa ngay). Lỗi thì ném ra để không lưu đệm.
 * Lưu mảng dòng (Map không qua được bộ lưu đệm JSON).
 */
const cachedRatings = unstable_cache(
  async (venueIds: number[] | null): Promise<RatingRow[]> => {
    const { data, error } = await publicClient().rpc("venue_rating_summary", { p_venue_ids: venueIds });
    if (error) throw new Error(error.message);
    return (data ?? []) as RatingRow[];
  },
  ["venue-ratings-v1"],
  { revalidate: 300, tags: [CACHE_TAG.ratings] },
);

/** Điểm trung bình theo sân; venueIds bỏ trống = mọi sân đã duyệt (danh sách trang chủ). Lỗi thì trả Map rỗng như trước. */
export async function ratingSummaries(venueIds?: number[]): Promise<Map<number, RatingSummary>> {
  let rows: RatingRow[] = [];
  try {
    rows = await cachedRatings(venueIds && venueIds.length > 0 ? [...venueIds].sort((a, b) => a - b) : null);
  } catch {
    rows = [];
  }
  return new Map(rows.map((r) => [Number(r.venue_id), { avg: Number(r.rating_avg), count: Number(r.rating_count) }]));
}

/** Một trang đánh giá đang hiện của một sân (ném lỗi để không lưu đệm khi truy vấn hỏng). */
async function loadReviewPage(venueId: number, offset: number): Promise<PublicReview[]> {
  const { data, error } = await publicClient().rpc("list_venue_reviews", { p_venue_id: venueId, p_limit: REVIEWS_PAGE_SIZE + 1, p_offset: offset });
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicReview[];
}

/**
 * Đánh giá đang hiện của một sân (mới nhất trước) kèm điểm trung bình. Trang đầu (hiện trên trang chi tiết sân) lưu đệm
 * 300 giây, tag "reviews:<id>", "reviews", "venue:<id>"; các trang sau đọc trực tiếp. Tên người viết đã được ẩn danh
 * trong SQL (review_author) nên kết quả giống nhau với mọi người xem.
 */
export async function listVenueReviews(venueId: number, page = 0): Promise<Result<{ reviews: PublicReview[]; summary: RatingSummary; has_more: boolean }>> {
  if (!validId(venueId)) return fail(404, "Không tìm thấy sân");
  const pageIndex = Math.max(0, Math.floor(page));
  const offset = pageIndex * REVIEWS_PAGE_SIZE;
  const list = async (): Promise<PublicReview[] | null> => {
    try {
      if (pageIndex > 0) return await loadReviewPage(venueId, offset);
      return await unstable_cache(() => loadReviewPage(venueId, 0), ["venue-reviews-v1", String(venueId)], {
        revalidate: 300,
        tags: [CACHE_TAG.reviews, CACHE_TAG.venueReviews(venueId), CACHE_TAG.venue(venueId)],
      })();
    } catch {
      return null;
    }
  };
  const [rows, summaries] = await Promise.all([list(), ratingSummaries([venueId])]);
  if (!rows) return fail(500, "Không tải được đánh giá");
  return ok({
    reviews: rows.slice(0, REVIEWS_PAGE_SIZE),
    summary: summaries.get(venueId) ?? { avg: null, count: 0 },
    has_more: rows.length > REVIEWS_PAGE_SIZE,
  });
}

/** Trạng thái đánh giá một lượt đặt của người chơi đang đăng nhập; null nếu không phải lượt của họ. */
export async function getMyBookingReview(bookingId: number): Promise<Result<MyReviewState | null>> {
  if (!validId(bookingId)) return fail(404, "Không tìm thấy lượt đặt");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_booking_review", { p_booking_id: bookingId });
  if (error) return dbFail(error, "Không tải được đánh giá");
  return ok((data as MyReviewState | null) ?? null);
}

/** Các lượt đặt của người chơi đang trong 24 giờ được đánh giá (0013), để danh sách lượt đặt hiện nút "Đánh giá sân". */
export async function reviewableBookings(): Promise<Map<number, { deadline: string; reviewed: boolean }>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_reviewable_bookings");
  return new Map(
    ((data ?? []) as { booking_id: number; deadline: string; reviewed: boolean }[]).map((r) => [Number(r.booking_id), { deadline: r.deadline, reviewed: r.reviewed }]),
  );
}

/** Người chơi tạo hoặc sửa đánh giá cho lượt đặt của mình. */
export async function submitReview(bookingId: number, input: unknown): Promise<Result<MyReviewState | null>> {
  if (!validId(bookingId)) return fail(404, "Không tìm thấy lượt đặt");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", {
    p_booking_id: bookingId,
    p_rating: parsed.data.rating,
    p_comment: parsed.data.comment || null,
    p_anonymous: parsed.data.is_anonymous,
  });
  if (error) return dbFail(error, "Không lưu được đánh giá. Vui lòng thử lại.");
  return getMyBookingReview(bookingId);
}

/** Chủ sân: đánh giá của các sân mình (người viết ẩn tên thì không lộ tên, mã lượt). */
export async function listOwnerReviews(venueId?: number): Promise<Result<OwnerReview[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("owner_list_reviews", { p_venue_id: venueId ?? null });
  if (error) return dbFail(error, "Không tải được đánh giá");
  return ok((data ?? []) as OwnerReview[]);
}

/** Chủ sân trả lời (hoặc xóa câu trả lời khi gửi rỗng). */
export async function replyReview(reviewId: number, input: unknown): Promise<Result<{ id: number }>> {
  if (!validId(reviewId)) return fail(404, "Không tìm thấy đánh giá");
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_review", { p_review_id: reviewId, p_reply: parsed.data.reply || null });
  if (error) return dbFail(error, "Không lưu được câu trả lời");
  return ok({ id: reviewId });
}

const REVIEW_STATUSES: ReviewStatus[] = ["visible", "hidden"];

/** Quản trị viên: mọi đánh giá, lọc theo trạng thái. */
export async function listAdminReviews(status?: string): Promise<Result<AdminReview[]>> {
  if (status && !REVIEW_STATUSES.includes(status as ReviewStatus)) return fail(400, "Trạng thái không hợp lệ");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_reviews", { p_status: status || null });
  if (error) return dbFail(error, "Không tải được đánh giá");
  return ok((data ?? []) as AdminReview[]);
}

/** Quản trị viên ẩn (bắt buộc lý do) hoặc hiện lại một đánh giá. */
export async function setReviewStatus(reviewId: number, input: unknown): Promise<Result<{ id: number; status: ReviewStatus }>> {
  if (!validId(reviewId)) return fail(404, "Không tìm thấy đánh giá");
  const body = (input ?? {}) as { status?: unknown; reason?: unknown };
  if (body.status !== "visible" && body.status !== "hidden") return fail(400, "Trạng thái không hợp lệ");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (body.status === "hidden" && !reason) return fail(400, "Hãy nhập lý do ẩn đánh giá");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_review_status", { p_review_id: reviewId, p_status: body.status, p_reason: reason || null });
  if (error) return dbFail(error, "Không cập nhật được đánh giá");
  return ok({ id: reviewId, status: body.status });
}
