import { readJson, respond } from "@/lib/api";
import { expireTagsInRoute, venueTags } from "@/lib/cache-tags";
import { getMyVenue, setVenueSuspended, updateVenue } from "@/lib/services/owner";

/** GET /api/owner/venues/{id} - Thông tin đầy đủ một sân của chủ sân. */
export async function GET(_request: Request, ctx: RouteContext<"/api/owner/venues/[id]">) {
  const { id } = await ctx.params;
  return respond(await getMyVenue(Number(id)));
}

/**
 * PUT /api/owner/venues/{id} - Cập nhật thông tin sân.
 * Thân yêu cầu chỉ có { status: "suspended" | "approved" } thì tạm ngừng hoặc mở lại sân.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/owner/venues/[id]">) {
  const { id } = await ctx.params;
  const body = (await readJson(request)) as Record<string, unknown>;
  if (Object.keys(body).length === 1 && (body.status === "suspended" || body.status === "approved")) {
    const result = await setVenueSuspended(Number(id), body.status === "suspended");
    if (result.ok) expireTagsInRoute(venueTags(Number(id)));
    return respond(result.ok ? { ok: true, data: { venue: { id: Number(id), ...result.data } } } : result);
  }
  const result = await updateVenue(Number(id), body);
  if (result.ok) expireTagsInRoute(venueTags(Number(id)));
  return respond(result.ok ? { ok: true, data: { venue: result.data } } : result);
}
