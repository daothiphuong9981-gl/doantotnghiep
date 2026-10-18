import { readJson, respond } from "@/lib/api";
import { markNotificationsRead } from "@/lib/services/notifications";

/** PUT /api/notifications/read - Đánh dấu đã đọc. Thân { ids?: number[] }; bỏ trống ids = tất cả. */
export async function PUT(request: Request) {
  return respond(await markNotificationsRead(await readJson(request)));
}
