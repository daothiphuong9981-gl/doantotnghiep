import { readJson, respond } from "@/lib/api";
import { ownerSetBookingStatus } from "@/lib/services/bookings";

/** PUT /api/owner/bookings/{id}/status - { action: "confirm_payment" | "cancel", reason? } */
export async function PUT(request: Request, ctx: RouteContext<"/api/owner/bookings/[id]/status">) {
  const { id } = await ctx.params;
  return respond(await ownerSetBookingStatus(Number(id), await readJson(request)));
}
