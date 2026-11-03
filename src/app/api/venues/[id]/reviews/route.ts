import { PUBLIC_CACHE, respond } from "@/lib/api";
import { listVenueReviews } from "@/lib/services/reviews";

/**
 * GET /api/venues/{id}/reviews?page=0 - Đánh giá đang hiện của sân (công khai) kèm điểm trung bình.
 * Không đọc cookie (client ẩn danh, tên người viết đã ẩn danh trong SQL): CDN giữ 60 giây.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/venues/[id]/reviews">) {
  const { id } = await ctx.params;
  const page = Number(new URL(request.url).searchParams.get("page") ?? 0);
  return respond(await listVenueReviews(Number(id), Number.isFinite(page) ? page : 0), 200, PUBLIC_CACHE.short);
}
