import type { NextRequest } from "next/server";
import { respond } from "@/lib/api";
import { listOwnerBookings } from "@/lib/services/bookings";

/** GET /api/owner/bookings?venue_id=&date=&status= - Lịch đặt các sân của chủ sân. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const result = await listOwnerBookings({
    venueId: params.get("venue_id") ? Number(params.get("venue_id")) : undefined,
    date: params.get("date") ?? undefined,
    status: params.get("status") ?? undefined,
  });
  return respond(result.ok ? { ok: true, data: { summary: result.data.summary, bookings: result.data.bookings } } : result);
}
