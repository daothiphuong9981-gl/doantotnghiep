import type { NextRequest } from "next/server";
import { respond } from "@/lib/api";
import { listVenues } from "@/lib/services/venues";

/**
 * GET /api/venues - Tìm kiếm và lọc sân đã duyệt.
 * Tham số (đều tùy chọn): q, ward_id, min_price, max_price, date + start_time, lat + lng, radius_km.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const text = (key: string) => params.get(key)?.trim() || undefined;
  const num = (key: string) => (text(key) === undefined ? undefined : Number(text(key)));
  const result = await listVenues({
    q: text("q"),
    wardId: num("ward_id"),
    minPrice: num("min_price"),
    maxPrice: num("max_price"),
    date: text("date"),
    startTime: text("start_time"),
    lat: num("lat"),
    lng: num("lng"),
    radiusKm: num("radius_km"),
  });
  return respond(result.ok ? { ok: true, data: { total: result.data.length, venues: result.data } } : result);
}
