import { getAuthUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type AppNotification, type Result } from "@/lib/types";

const LIMIT = 20;

/** Thông báo mới nhất của người đang đăng nhập kèm số chưa đọc (bảng notifications, migration 0006). */
export async function listNotifications(): Promise<Result<{ items: AppNotification[]; unread: number }>> {
  const user = await getAuthUser();
  if (!user) return fail(401, "Bạn cần đăng nhập");
  const supabase = await createClient();
  const [items, unread] = await Promise.all([
    supabase.from("notifications").select("id, kind, title, body, link, read_at, created_at").order("id", { ascending: false }).limit(LIMIT),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  if (items.error || unread.error) return fail(500, "Không tải được thông báo");
  return ok({ items: (items.data ?? []) as AppNotification[], unread: unread.count ?? 0 });
}

/** Đánh dấu đã đọc: truyền danh sách id, hoặc bỏ trống để đánh dấu tất cả. */
export async function markNotificationsRead(input: unknown): Promise<Result<{ marked: number }>> {
  const user = await getAuthUser();
  if (!user) return fail(401, "Bạn cần đăng nhập");
  const raw = (input as { ids?: unknown })?.ids;
  let ids: number[] | null = null;
  if (raw !== undefined) {
    if (!Array.isArray(raw) || raw.length > 100 || !raw.every((x) => Number.isInteger(x) && x > 0)) return fail(400, "Danh sách thông báo không hợp lệ");
    ids = raw as number[];
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_notifications_read", { p_ids: ids });
  if (error) return fail(500, "Không cập nhật được thông báo");
  return ok({ marked: Number(data ?? 0) });
}
