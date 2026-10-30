import { respond } from "@/lib/api";
import { listOwnerReviews } from "@/lib/services/reviews";

/** GET /api/owner/reviews?venue_id= - Đánh giá các sân của chủ sân đang đăng nhập. */
export async function GET(request: Request) {
  const venueId = new URL(request.url).searchParams.get("venue_id");
  return respond(await listOwnerReviews(venueId ? Number(venueId) : undefined));
}
