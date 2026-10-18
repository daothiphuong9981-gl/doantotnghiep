import { readJson, respond } from "@/lib/api";
import { reportPayment } from "@/lib/services/bookings";

/** PUT /api/bookings/{id}/payment-report - Người chơi báo đã chuyển khoản. */
export async function PUT(request: Request, ctx: RouteContext<"/api/bookings/[id]/payment-report">) {
  const { id } = await ctx.params;
  return respond(await reportPayment(Number(id), await readJson(request)));
}
