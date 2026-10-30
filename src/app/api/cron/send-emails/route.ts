import { respond } from "@/lib/api";
import { processEmailOutbox } from "@/lib/services/emails";
import { fail } from "@/lib/types";

/**
 * /api/cron/send-emails - Gửi các email xác nhận đặt sân còn trong hàng đợi (gửi lại thư lỗi).
 * Yêu cầu header Authorization: Bearer ${CRON_SECRET}. Vercel Cron gọi bằng GET (lịch trong vercel.json).
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return respond(fail(401, "Không được phép"));
  return respond(await processEmailOutbox(20));
}

export const GET = handle;
export const POST = handle;
