import { respond } from "@/lib/api";
import { getBooking } from "@/lib/services/bookings";

/** GET /api/bookings/{id} - Chi tiết lượt đặt, thông tin chuyển khoản và giờ máy chủ. */
export async function GET(_request: Request, ctx: RouteContext<"/api/bookings/[id]">) {
  const { id } = await ctx.params;
  return respond(await getBooking(Number(id)));
}
