import { PAGE_SIZE } from "@/lib/constants";
import { dbFail } from "@/lib/db-errors";
import { hhmm } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { fail, ok, type PriceSlot, type Result, type Role, type VenueStatus } from "@/lib/types";

async function requireAdmin(): Promise<Result<string>> {
  // Dùng chung phiên đã đọc trong request (navbar, layout); null nếu chưa đăng nhập hoặc bị khóa
  const session = await getSession();
  if (!session) return fail(401, "Bạn cần đăng nhập");
  if (session.profile.role !== "admin") return fail(403, "Chức năng chỉ dành cho quản trị viên");
  return ok(session.userId);
}

export interface AdminVenue {
  id: number;
  name: string;
  address: string;
  ward_name: string;
  description: string | null;
  contact_phone: string | null;
  latitude: number;
  longitude: number;
  open_time: string;
  close_time: string;
  hold_minutes: number;
  status: VenueStatus;
  reject_reason: string | null;
  created_at: string;
  approved_at: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  court_count: number;
  prices: PriceSlot[];
  images: string[];
}
export interface AdminVenueList {
  counts: Record<VenueStatus, number>;
  venues: AdminVenue[];
  total: number;
  page: number;
  page_size: number;
}
export const ADMIN_VENUES_PAGE_SIZE = 20;

const VENUE_STATUSES: VenueStatus[] = ["pending", "approved", "rejected", "suspended", "hidden"];
const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);

/**
 * PB19, PB20 - Danh sách sân theo trạng thái, kèm thông tin chủ sân để quản trị viên xem xét.
 * Đếm, lọc, tìm (không dấu) và phân trang trong SQL (admin_venue_page, 0015); chỉ đọc chi tiết các sân của trang hiện tại.
 */
export async function listAdminVenues(params: { status?: string; q?: string; page?: number }): Promise<Result<AdminVenueList>> {
  const supabase = await createClient();
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (params.status && !VENUE_STATUSES.includes(params.status as VenueStatus)) return fail(400, "Trạng thái không hợp lệ");
  const page = Number.isInteger(params.page) && (params.page as number) > 0 ? (params.page as number) : 1;

  const { data: pageData, error: pageError } = await supabase.rpc("admin_venue_page", {
    p_status: params.status || null,
    p_q: params.q?.trim().slice(0, 100) || null,
    p_limit: ADMIN_VENUES_PAGE_SIZE,
    p_offset: (page - 1) * ADMIN_VENUES_PAGE_SIZE,
  });
  if (pageError) return dbFail(pageError, "Không tải được danh sách sân");
  const { counts, total, ids } = pageData as { counts: Record<VenueStatus, number>; total: number; ids: number[] };
  if (ids.length === 0) return ok({ counts, venues: [], total: Number(total), page, page_size: ADMIN_VENUES_PAGE_SIZE });

  const { data, error } = await supabase
    .from("venues")
    .select(
      "id, name, address, description, contact_phone, latitude, longitude, open_time, close_time, hold_minutes, status, reject_reason, created_at, approved_at, wards(name), owner:profiles(full_name, phone), courts(id, is_active), price_slots(day_type, start_time, end_time, price), venue_images(storage_path, sort_order)",
    )
    .in("id", ids)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) return fail(500, "Không tải được danh sách sân");

  const venues = (data ?? [])
    .map((v): AdminVenue => {
      const owner = one(v.owner as { full_name: string; phone: string } | { full_name: string; phone: string }[] | null);
      const ward = one(v.wards as { name: string } | { name: string }[] | null);
      const prices = (v.price_slots ?? []) as PriceSlot[];
      const images = (v.venue_images ?? []) as { storage_path: string; sort_order: number }[];
      return {
        id: v.id,
        name: v.name,
        address: v.address,
        ward_name: ward?.name ?? "",
        description: v.description,
        contact_phone: v.contact_phone,
        latitude: Number(v.latitude),
        longitude: Number(v.longitude),
        open_time: hhmm(v.open_time),
        close_time: hhmm(v.close_time),
        hold_minutes: v.hold_minutes,
        status: v.status,
        reject_reason: v.reject_reason,
        created_at: v.created_at,
        approved_at: v.approved_at,
        owner_name: owner?.full_name ?? null,
        owner_phone: owner?.phone ?? null,
        court_count: ((v.courts ?? []) as { is_active: boolean }[]).filter((c) => c.is_active).length,
        prices: prices
          .map((p) => ({ ...p, start_time: hhmm(p.start_time), end_time: hhmm(p.end_time) }))
          .sort((a, b) => a.day_type.localeCompare(b.day_type) || a.start_time.localeCompare(b.start_time)),
        images: [...images].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.storage_path),
      };
    });
  return ok({ counts, venues, total: Number(total), page, page_size: ADMIN_VENUES_PAGE_SIZE });
}

export interface ReviewedVenue {
  id: number;
  name: string;
  status: VenueStatus;
  reject_reason: string | null;
  approved_at: string | null;
}

/** PB19, PB20 - Duyệt, từ chối, ẩn hoặc hiện lại một sân. Từ chối và ẩn bắt buộc có lý do. */
export async function reviewVenue(id: number, input: unknown): Promise<Result<{ venue: ReviewedVenue }>> {
  const body = (input ?? {}) as { action?: unknown; reason?: unknown };
  const action = typeof body.action === "string" ? body.action : "";
  if (!["approve", "reject", "hide", "unhide"].includes(action)) return fail(400, "Thao tác không hợp lệ");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if ((action === "reject" || action === "hide") && !reason) return fail(400, action === "reject" ? "Hãy nhập lý do từ chối" : "Hãy nhập lý do ẩn sân");
  if (!Number.isInteger(id) || id <= 0) return fail(404, "Không tìm thấy sân");

  const supabase = await createClient();
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const { data, error } = await supabase.rpc("admin_review_venue", { p_venue_id: id, p_action: action, p_reason: reason || null });
  if (error) return dbFail(error, "Không cập nhật được sân");
  return ok({ venue: data as ReviewedVenue });
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: Role;
  is_locked: boolean;
  created_at: string;
}

/** PB20 - Tìm người dùng theo tên, email, số điện thoại, vai trò. */
export async function listUsers(params: { q?: string; role?: string; page?: number }): Promise<Result<{ total: number; page: number; page_size: number; users: AdminUser[] }>> {
  const supabase = await createClient();
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (params.role && !["player", "owner", "admin"].includes(params.role)) return fail(400, "Vai trò không hợp lệ");
  const page = Number.isInteger(params.page) && (params.page as number) > 0 ? (params.page as number) : 1;

  const { data, error } = await supabase.rpc("admin_list_users", {
    p_q: params.q?.trim().slice(0, 100) || null,
    p_role: params.role || null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) return dbFail(error, "Không tải được danh sách người dùng");
  const rows = (data ?? []) as (AdminUser & { total: number })[];
  return ok({
    total: Number(rows[0]?.total ?? 0),
    page,
    page_size: PAGE_SIZE,
    users: rows.map(({ id, full_name, email, phone, role, is_locked, created_at }) => ({ id, full_name, email, phone, role, is_locked, created_at })),
  });
}

/** PB20 - Khóa (bắt buộc lý do) hoặc mở khóa một tài khoản (không áp dụng cho quản trị viên). */
export async function setUserLock(id: string, input: unknown): Promise<Result<{ user: Pick<AdminUser, "id" | "full_name" | "role" | "is_locked"> }>> {
  const locked = (input as { is_locked?: unknown })?.is_locked;
  const rawReason = (input as { reason?: unknown })?.reason;
  const reason = typeof rawReason === "string" ? rawReason.trim().slice(0, 300) : "";
  if (typeof locked !== "boolean") return fail(400, "Thiếu trường is_locked");
  if (locked && !reason) return fail(400, "Hãy nhập lý do khóa tài khoản");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "Không tìm thấy người dùng");
  const supabase = await createClient();
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const { data, error } = await supabase.rpc("admin_set_user_lock", { p_user_id: id, p_locked: locked, p_reason: reason || null });
  if (error) return dbFail(error, "Không cập nhật được tài khoản");
  return ok({ user: data as Pick<AdminUser, "id" | "full_name" | "role" | "is_locked"> });
}

export interface AdminStats {
  users: Partial<Record<Role, number>>;
  locked_users: number;
  venues: Partial<Record<VenueStatus, number>>;
  bookings: Record<string, number>;
  bookings_by_month: { month: string; count: number; confirmed: number }[];
  ai_questions_today: number;
}

/** PB22 - Thống kê toàn hệ thống. */
export async function getAdminStats(): Promise<Result<AdminStats>> {
  const supabase = await createClient();
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const { data, error } = await supabase.rpc("admin_stats");
  if (error) return dbFail(error, "Không tải được thống kê");
  return ok(data as AdminStats);
}

export interface AdminLog {
  id: number;
  action: string;
  target_type: "venue" | "user" | "review";
  target_id: string;
  target_label: string | null;
  detail: string | null;
  created_at: string;
  admin_name: string | null;
}

/** Nhật ký thao tác của quản trị viên (0016), mới nhất trước, lọc theo loại đối tượng. */
export async function listAdminLogs(params: { type?: string; page?: number }): Promise<Result<{ logs: AdminLog[]; total: number; page: number; page_size: number }>> {
  const supabase = await createClient();
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (params.type && !["venue", "user", "review"].includes(params.type)) return fail(400, "Loại không hợp lệ");
  const page = Number.isInteger(params.page) && (params.page as number) > 0 ? (params.page as number) : 1;
  const size = 30;
  let query = supabase
    .from("admin_logs")
    .select("id, action, target_type, target_id, target_label, detail, created_at, admin:profiles(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  if (params.type) query = query.eq("target_type", params.type);
  const { data, error, count } = await query;
  if (error) return fail(500, "Không tải được nhật ký");
  return ok({
    total: count ?? 0,
    page,
    page_size: size,
    logs: (data ?? []).map((row) => {
      const a = one(row.admin as { full_name: string } | { full_name: string }[] | null);
      return { ...(row as unknown as Omit<AdminLog, "admin_name">), admin_name: a?.full_name ?? null };
    }),
  });
}

export interface AdminUserDetail {
  id: string;
  full_name: string;
  phone: string;
  role: Role;
  email: string | null;
  is_locked: boolean;
  lock_reason: string | null;
  locked_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  booking_counts: Record<string, number>;
  recent_bookings: { id: number; code: string; status: string; total_amount: number; created_at: string; venue_name: string; first_date: string | null }[];
  venues: { id: number; name: string; status: VenueStatus; bookings: number }[];
  reviews: number;
  logs: { action: string; detail: string | null; created_at: string; admin_name: string | null }[];
}

/** Chi tiết một người dùng: hồ sơ, lượt đặt gần đây, sân sở hữu, lịch sử khóa (admin_user_detail, 0016). */
export async function getAdminUser(id: string): Promise<Result<AdminUserDetail>> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "Không tìm thấy người dùng");
  const supabase = await createClient();
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const { data, error } = await supabase.rpc("admin_user_detail", { p_user_id: id });
  if (error) return dbFail(error, "Không tải được người dùng");
  return ok(data as AdminUserDetail);
}
