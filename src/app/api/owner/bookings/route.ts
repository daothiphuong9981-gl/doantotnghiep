import type { NextRequest } from "next/server";
import { respond } from "@/lib/api";
import { listOwnerBookings } from "@/lib/services/bookings";

/** GET /api/owner/bookings?venue_id=&date=&status=&q=&page= - Lịch đặt các sân của chủ sân. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const result = await listOwnerBookings({
    venueId: params.get("venue_id") ? Number(params.get("venue_id")) : undefined,
    date: params.get("date") ?? undefined,
    status: params.get("status") ?? undefined,
    q: params.get("q") ?? undefined,
    page: params.get("page") ? Number(params.get("page")) : undefined,
  });
  return respond(
    result.ok
      ? { ok: true, data: { summary: result.data.summary, bookings: result.data.bookings, total: result.data.total, page: result.data.page, page_size: result.data.page_size } }
      : result,
  );
}
