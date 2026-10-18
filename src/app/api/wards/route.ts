import { respond } from "@/lib/api";
import { listWards } from "@/lib/services/venues";

/** GET /api/wards - Danh mục phường, xã. */
export async function GET() {
  const result = await listWards();
  return respond(result.ok ? { ok: true, data: { wards: result.data } } : result);
}
