import { dbFail } from "@/lib/db-errors";
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

/** Điểm trung bình theo sân; venueIds bỏ trống = mọi sân đã duyệt (danh sách trang chủ). */
export async function ratingSummaries(venueIds?: number[]): Promise<Map<number, RatingSummary>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("venue_rating_summary", { p_venue_ids: venueIds ?? null });
  return new Map(
    ((data ?? []) as { venue_id: number; rating_avg: number | string; rating_count: number }[]).map((r) => [
      Number(r.venue_id),
      { avg: Number(r.rating_avg), count: Number(r.rating_count) },
    ]),
  );
}

/** Đánh giá đang hiện của một sân (mới nhất trước) kèm điểm trung bình. */
export async function listVenueReviews(venueId: number, page = 0): Promise<Result<{ reviews: PublicReview[]; summary: RatingSummary; has_more: boolean }>> {
  if (!validId(venueId)) return fail(404, "Không tìm thấy sân");
  const offset = Math.max(0, Math.floor(page)) * REVIEWS_PAGE_SIZE;
  const supabase = await createClient();
  const [list, summaries] = await Promise.all([
    supabase.rpc("list_venue_reviews", { p_venue_id: venueId, p_limit: REVIEWS_PAGE_SIZE + 1, p_offset: offset }),
    ratingSummaries([venueId]),
  ]);
  if (list.error) return fail(500, "Không tải được đánh giá");
  const rows = (list.data ?? []) as PublicReview[];
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
