import { PUBLIC_CACHE, respond } from "@/lib/api";
import { getVenueDetail } from "@/lib/services/venues";

/** GET /api/venues/{id} - Chi tiết sân đã duyệt. Công khai, không đọc cookie: CDN giữ 5 phút. */
export async function GET(_request: Request, ctx: RouteContext<"/api/venues/[id]">) {
  const { id } = await ctx.params;
  return respond(await getVenueDetail(Number(id)), 200, PUBLIC_CACHE.long);
}
