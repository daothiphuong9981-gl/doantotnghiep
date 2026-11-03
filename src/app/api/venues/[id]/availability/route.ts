import type { NextRequest } from "next/server";
import { PUBLIC_CACHE, respond } from "@/lib/api";
import { todayInVietnam } from "@/lib/format";
import { getAvailability } from "@/lib/services/venues";

/** GET /api/venues/{id}/availability?date=YYYY-MM-DD - Trạng thái khung giờ theo sân con. Đổi theo phút: không lưu đệm. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/venues/[id]/availability">) {
  const { id } = await ctx.params;
  const date = request.nextUrl.searchParams.get("date") ?? todayInVietnam();
  return respond(await getAvailability(Number(id), date), 200, PUBLIC_CACHE.none);
}
