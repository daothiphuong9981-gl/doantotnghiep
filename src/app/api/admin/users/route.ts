import type { NextRequest } from "next/server";
import { respond } from "@/lib/api";
import { listUsers } from "@/lib/services/admin";

/** GET /api/admin/users?q=&role=&page= - Danh sách người dùng (quản trị viên). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return respond(
    await listUsers({ q: params.get("q") ?? undefined, role: params.get("role") ?? undefined, page: params.get("page") ? Number(params.get("page")) : undefined }),
  );
}
