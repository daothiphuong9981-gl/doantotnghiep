import type { NextRequest } from "next/server";
import { PUBLIC_CACHE, respond } from "@/lib/api";
import { listVenues } from "@/lib/services/venues";

/**
 * GET /api/venues - Tìm kiếm và lọc sân đã duyệt.
 * Tham số (đều tùy chọn): q, ward_id, min_price, max_price, date + start_time, lat + lng, radius_km.
 * Công khai, không đọc cookie (client ẩn danh). CDN chỉ giữ khi KHÔNG lọc theo giờ trống (đổi theo phút) và KHÔNG có
 * tọa độ (vị trí người dùng, không để CDN lưu theo URL).
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
  const personal = ["date", "start_time", "lat", "lng", "radius_km"].some((key) => params.has(key));
  return respond(
    result.ok ? { ok: true, data: { total: result.data.length, venues: result.data } } : result,
    200,
    personal ? PUBLIC_CACHE.none : PUBLIC_CACHE.short,
  );
}
