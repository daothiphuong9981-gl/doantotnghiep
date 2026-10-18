import { respond } from "@/lib/api";
import { cancelMyBooking } from "@/lib/services/bookings";

/** PUT /api/bookings/{id}/cancel - Người chơi hủy lượt đặt khi chưa đến giờ chơi. */
export async function PUT(_request: Request, ctx: RouteContext<"/api/bookings/[id]/cancel">) {
  const { id } = await ctx.params;
  return respond(await cancelMyBooking(Number(id)));
}
