import { readJson, respond } from "@/lib/api";
import { expireTagsInRoute, venueTags } from "@/lib/cache-tags";
import { replacePrices } from "@/lib/services/owner";

/** PUT /api/owner/venues/{id}/prices - Thay toàn bộ bảng giá của sân. */
export async function PUT(request: Request, ctx: RouteContext<"/api/owner/venues/[id]/prices">) {
  const { id } = await ctx.params;
  const body = (await readJson(request)) as { prices?: unknown };
  const result = await replacePrices(Number(id), body.prices);
  if (result.ok) expireTagsInRoute(venueTags(Number(id)));
  return respond(result.ok ? { ok: true, data: { prices: result.data } } : result);
}
