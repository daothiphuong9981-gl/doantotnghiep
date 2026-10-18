import { respond } from "@/lib/api";
import { getAdminStats } from "@/lib/services/admin";

/** GET /api/admin/stats - Thống kê toàn hệ thống. */
export async function GET() {
  return respond(await getAdminStats());
}
