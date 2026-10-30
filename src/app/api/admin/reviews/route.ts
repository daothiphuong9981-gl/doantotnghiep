import { respond } from "@/lib/api";
import { listAdminReviews } from "@/lib/services/reviews";

/** GET /api/admin/reviews?status=visible|hidden - Mọi đánh giá (quản trị viên). */
export async function GET(request: Request) {
  return respond(await listAdminReviews(new URL(request.url).searchParams.get("status") ?? undefined));
}
