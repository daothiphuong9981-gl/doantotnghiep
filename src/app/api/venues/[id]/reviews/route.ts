import { respond } from "@/lib/api";
import { listVenueReviews } from "@/lib/services/reviews";

/** GET /api/venues/{id}/reviews?page=0 - Đánh giá đang hiện của sân (công khai) kèm điểm trung bình. */
export async function GET(request: Request, ctx: RouteContext<"/api/venues/[id]/reviews">) {
  const { id } = await ctx.params;
  const page = Number(new URL(request.url).searchParams.get("page") ?? 0);
  return respond(await listVenueReviews(Number(id), Number.isFinite(page) ? page : 0));
}
