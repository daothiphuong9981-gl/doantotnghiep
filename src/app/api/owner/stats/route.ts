import type { NextRequest } from "next/server";
import { respond } from "@/lib/api";
import { getOwnerStats } from "@/lib/services/stats";

/** GET /api/owner/stats?venue_id=&from=YYYY-MM-DD&to=YYYY-MM-DD - Thống kê của chủ sân. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return respond(
    await getOwnerStats({
      venueId: params.get("venue_id") ? Number(params.get("venue_id")) : undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    }),
  );
}
