import { readJson, respond } from "@/lib/api";
import { createVenue, listMyVenues } from "@/lib/services/owner";

/** GET /api/owner/venues - Các sân của chủ sân đang đăng nhập. */
export async function GET() {
  const result = await listMyVenues();
  return respond(result.ok ? { ok: true, data: { venues: result.data } } : result);
}

/** POST /api/owner/venues - Đăng ký sân mới (chờ duyệt). */
export async function POST(request: Request) {
  const result = await createVenue(await readJson(request));
  return respond(result.ok ? { ok: true, data: { venue: result.data } } : result, 201);
}
