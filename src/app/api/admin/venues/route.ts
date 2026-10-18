import type { NextRequest } from "next/server";
import { respond } from "@/lib/api";
import { listAdminVenues } from "@/lib/services/admin";

/** GET /api/admin/venues?status=&q= - Danh sách sân theo trạng thái (quản trị viên). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return respond(await listAdminVenues({ status: params.get("status") ?? undefined, q: params.get("q") ?? undefined }));
}
