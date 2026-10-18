import { readJson, respond } from "@/lib/api";
import { replacePrices } from "@/lib/services/owner";

/** PUT /api/owner/venues/{id}/prices - Thay toàn bộ bảng giá của sân. */
export async function PUT(request: Request, ctx: RouteContext<"/api/owner/venues/[id]/prices">) {
  const { id } = await ctx.params;
  const body = (await readJson(request)) as { prices?: unknown };
  const result = await replacePrices(Number(id), body.prices);
  return respond(result.ok ? { ok: true, data: { prices: result.data } } : result);
}
