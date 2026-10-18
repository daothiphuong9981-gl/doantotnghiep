import { respond } from "@/lib/api";
import { expireHolds } from "@/lib/services/bookings";
import { fail } from "@/lib/types";

/**
 * /api/cron/expire-holds - Giải phóng lượt giữ chỗ quá hạn.
 * Yêu cầu header Authorization: Bearer ${CRON_SECRET}. Vercel Cron gọi bằng GET, công cụ khác có thể dùng POST.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return respond(fail(401, "Không được phép"));
  return respond(await expireHolds());
}

export const GET = handle;
export const POST = handle;
