import { dbFail } from "@/lib/db-errors";
import { isValidDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/types";

export interface OwnerStats {
  from: string;
  to: string;
  /** Số lượt đặt đã được chủ sân xác nhận thanh toán, có ngày chơi trong khoảng */
  confirmed_count: number;
  slot_count: number;
  revenue: number;
  awaiting_count: number;
  cancelled_count: number;
  expired_count: number;
  by_day: { date: string; count: number; slots: number; revenue: number }[];
  top_slots: { start_time: string; count: number }[];
}

/** PB21 - Thống kê của chủ sân theo ngày chơi. Không chọn sân thì gộp mọi sân của chủ sân. */
export async function getOwnerStats(params: { venueId?: number; from?: string; to?: string }): Promise<Result<OwnerStats>> {
  const { venueId, from, to } = params;
  if (!from || !to || !isValidDate(from) || !isValidDate(to)) return fail(400, "Hãy chọn khoảng ngày hợp lệ (from, to dạng YYYY-MM-DD)");
  if (to < from) return fail(400, "Ngày kết thúc phải sau ngày bắt đầu");
  if (venueId !== undefined && (!Number.isInteger(venueId) || venueId <= 0)) return fail(400, "Mã sân không hợp lệ");

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return fail(401, "Bạn cần đăng nhập");
  const { data, error } = await supabase.rpc("owner_stats", { p_venue_id: venueId ?? null, p_from: from, p_to: to });
  if (error) return dbFail(error, "Không tải được thống kê");
  const stats = data as OwnerStats;
  return ok({ ...stats, revenue: Number(stats.revenue), by_day: stats.by_day.map((d) => ({ ...d, revenue: Number(d.revenue) })) });
}
