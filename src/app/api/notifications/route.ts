import { respond } from "@/lib/api";
import { listNotifications } from "@/lib/services/notifications";

/** GET /api/notifications - 20 thông báo mới nhất và số chưa đọc của người đang đăng nhập. */
export async function GET() {
  return respond(await listNotifications());
}
