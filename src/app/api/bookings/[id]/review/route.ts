import { readJson, respond } from "@/lib/api";
import { expireTagsInRoute, REVIEW_TAGS } from "@/lib/cache-tags";
import { getMyBookingReview, submitReview } from "@/lib/services/reviews";

/** GET /api/bookings/{id}/review - Trạng thái đánh giá lượt đặt của người chơi đang đăng nhập. */
export async function GET(_request: Request, ctx: RouteContext<"/api/bookings/[id]/review">) {
  const { id } = await ctx.params;
  return respond(await getMyBookingReview(Number(id)));
}

/** PUT /api/bookings/{id}/review - { rating: 1-5, comment?, is_anonymous? } tạo hoặc sửa đánh giá (trong 24 giờ sau giờ chơi). */
export async function PUT(request: Request, ctx: RouteContext<"/api/bookings/[id]/review">) {
  const { id } = await ctx.params;
  const result = await submitReview(Number(id), await readJson(request));
  if (result.ok) expireTagsInRoute(REVIEW_TAGS);
  return respond(result);
}
