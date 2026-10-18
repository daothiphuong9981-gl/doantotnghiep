import { readJson, respond } from "@/lib/api";
import { reviewVenue } from "@/lib/services/admin";

/** PUT /api/admin/venues/{id}/review - { action: "approve" | "reject" | "hide" | "unhide", reason? } */
export async function PUT(request: Request, ctx: RouteContext<"/api/admin/venues/[id]/review">) {
  const { id } = await ctx.params;
  return respond(await reviewVenue(Number(id), await readJson(request)));
}
