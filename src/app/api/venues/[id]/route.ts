import { respond } from "@/lib/api";
import { getVenueDetail } from "@/lib/services/venues";

/** GET /api/venues/{id} - Chi tiết sân đã duyệt. */
export async function GET(_request: Request, ctx: RouteContext<"/api/venues/[id]">) {
  const { id } = await ctx.params;
  return respond(await getVenueDetail(Number(id)));
}
