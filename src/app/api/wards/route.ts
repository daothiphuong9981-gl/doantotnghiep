import { PUBLIC_CACHE, respond } from "@/lib/api";
import { listWards } from "@/lib/services/venues";

/** GET /api/wards - Danh mục phường, xã. Công khai, không đọc cookie: CDN giữ 1 ngày. */
export async function GET() {
  const result = await listWards();
  return respond(result.ok ? { ok: true, data: { wards: result.data } } : result, 200, PUBLIC_CACHE.day);
}
