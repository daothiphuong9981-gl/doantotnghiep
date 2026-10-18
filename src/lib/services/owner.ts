import { hhmm } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { fail, ok, type Court, type PriceSlot, type Result, type Venue, type VenueImage, type VenueStatus } from "@/lib/types";
import { fieldErrors, findPriceOverlap, priceListSchema, venueSchema } from "@/lib/validation";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireOwner(): Promise<Result<string>> {
  // Dùng chung phiên đã đọc trong request (navbar, layout); null nếu chưa đăng nhập hoặc bị khóa
  const session = await getSession();
  if (!session) return fail(401, "Bạn cần đăng nhập");
  if (session.profile.role !== "owner") return fail(403, "Chức năng chỉ dành cho chủ sân");
  return ok(session.userId);
}

export interface OwnerVenueRow {
  id: number;
  name: string;
  address: string;
  ward_name: string;
  status: VenueStatus;
  reject_reason: string | null;
  court_count: number;
  hold_minutes: number;
}

/** Danh sách sân của chủ sân đang đăng nhập. */
export async function listMyVenues(): Promise<Result<OwnerVenueRow[]>> {
  const supabase = await createClient();
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, address, status, reject_reason, hold_minutes, wards(name), courts(count)")
    .eq("owner_id", owner.data)
    .order("created_at", { ascending: false });
  if (error) return fail(500, "Không tải được danh sách sân");
  return ok(
    (data ?? []).map((v) => {
      const wards = v.wards as { name: string } | { name: string }[] | null;
      const courts = v.courts as { count: number }[] | null;
      return {
        id: v.id,
        name: v.name,
        address: v.address,
        status: v.status,
        reject_reason: v.reject_reason,
        hold_minutes: v.hold_minutes,
        ward_name: (Array.isArray(wards) ? wards[0]?.name : wards?.name) ?? "",
        court_count: courts?.[0]?.count ?? 0,
      };
    }),
  );
}

export interface OwnerVenueDetail {
  venue: Venue;
  courts: Court[];
  prices: PriceSlot[];
  images: VenueImage[];
}

/** Toàn bộ thông tin một sân của chủ sân (để sửa). */
export async function getMyVenue(id: number): Promise<Result<OwnerVenueDetail>> {
  const supabase = await createClient();
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  const { data: venue } = await supabase.from("venues").select("*").eq("id", id).eq("owner_id", owner.data).maybeSingle();
  if (!venue) return fail(404, "Không tìm thấy sân");
  const [courts, prices, images] = await Promise.all([
    supabase.from("courts").select("id, name, is_active").eq("venue_id", id).order("id"),
    supabase.from("price_slots").select("id, day_type, start_time, end_time, price").eq("venue_id", id).order("day_type").order("start_time"),
    supabase.from("venue_images").select("id, storage_path, sort_order").eq("venue_id", id).order("sort_order").order("id"),
  ]);
  return ok({
    venue: {
      ...venue,
      latitude: Number(venue.latitude),
      longitude: Number(venue.longitude),
      open_time: hhmm(venue.open_time),
      close_time: hhmm(venue.close_time),
    } as Venue,
    courts: courts.data ?? [],
    prices: (prices.data ?? []).map((p) => ({ ...p, start_time: hhmm(p.start_time), end_time: hhmm(p.end_time) })),
    images: images.data ?? [],
  });
}

export type VenueFormResult = Result<{ id: number; status: VenueStatus }> & { errors?: Record<string, string> };

/** Điều chỉnh số sân con: thêm sân mới hoặc ngừng/mở lại các sân cuối danh sách. */
async function syncCourts(supabase: Supabase, venueId: number, target: number): Promise<string | null> {
  const { data: courts, error } = await supabase.from("courts").select("id, name, is_active").eq("venue_id", venueId).order("id");
  if (error) return "Không cập nhật được sân con";
  const existing = courts ?? [];
  for (let i = 0; i < existing.length; i += 1) {
    const shouldBeActive = i < target;
    if (existing[i].is_active !== shouldBeActive) {
      const res = await supabase.from("courts").update({ is_active: shouldBeActive }).eq("id", existing[i].id);
      if (res.error) return "Không cập nhật được sân con";
    }
  }
  if (target > existing.length) {
    const rows = [];
    for (let n = existing.length + 1; n <= target; n += 1) rows.push({ venue_id: venueId, name: `Sân ${n}` });
    const res = await supabase.from("courts").insert(rows);
    if (res.error) return "Không tạo được sân con";
  }
  return null;
}

/** PB06 - Đăng ký sân mới: luôn ở trạng thái chờ duyệt, tự tạo các sân con. */
export async function createVenue(input: unknown): Promise<VenueFormResult> {
  const parsed = venueSchema.safeParse(input);
  if (!parsed.success) return { ...fail(400, "Vui lòng kiểm tra lại thông tin"), errors: fieldErrors(parsed.error) };
  const { court_count, ...fields } = parsed.data;

  const supabase = await createClient();
  const owner = await requireOwner();
  if (!owner.ok) return owner;

  const { data, error } = await supabase
    .from("venues")
    .insert({ ...fields, contact_phone: fields.contact_phone || null, description: fields.description || null, owner_id: owner.data })
    .select("id, status")
    .single();
  if (error || !data) return fail(400, "Không lưu được sân. Vui lòng thử lại.");

  const courtError = await syncCourts(supabase, data.id, court_count);
  if (courtError) return fail(500, courtError);
  return ok({ id: data.id, status: data.status });
}

/** PB07 - Cập nhật thông tin sân, thời gian giữ chỗ, tài khoản nhận tiền. */
export async function updateVenue(id: number, input: unknown): Promise<VenueFormResult> {
  const parsed = venueSchema.safeParse(input);
  if (!parsed.success) return { ...fail(400, "Vui lòng kiểm tra lại thông tin"), errors: fieldErrors(parsed.error) };
  const { court_count, ...fields } = parsed.data;

  const supabase = await createClient();
  const owner = await requireOwner();
  if (!owner.ok) return owner;

  const { data: current } = await supabase.from("venues").select("status").eq("id", id).eq("owner_id", owner.data).maybeSingle();
  if (!current) return fail(403, "Bạn không có quyền sửa sân này");

  const { data, error } = await supabase
    .from("venues")
    .update({
      ...fields,
      contact_phone: fields.contact_phone || null,
      description: fields.description || null,
      // Sân bị từ chối được gửi duyệt lại sau khi sửa
      ...(current.status === "rejected" ? { status: "pending" } : {}),
    })
    .eq("id", id)
    .select("id, status")
    .maybeSingle();
  if (error || !data) return fail(400, "Không lưu được sân. Vui lòng thử lại.");

  const courtError = await syncCourts(supabase, id, court_count);
  if (courtError) return fail(500, courtError);
  return ok({ id: data.id, status: data.status });
}

/** PB07 - Tạm ngừng hoặc mở lại sân đã duyệt. */
export async function setVenueSuspended(id: number, suspended: boolean): Promise<Result<{ status: VenueStatus }>> {
  const supabase = await createClient();
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  const { data, error } = await supabase
    .from("venues")
    .update({ status: suspended ? "suspended" : "approved" })
    .eq("id", id)
    .eq("owner_id", owner.data)
    .eq("status", suspended ? "approved" : "suspended")
    .select("status")
    .maybeSingle();
  if (error || !data) return fail(409, "Không đổi được trạng thái sân");
  return ok({ status: data.status });
}

/** PB08 - Thay toàn bộ bảng giá của sân. Từ chối nếu có khung giờ trùng nhau. */
export async function replacePrices(venueId: number, input: unknown): Promise<Result<PriceSlot[]>> {
  const parsed = priceListSchema.safeParse(input);
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Bảng giá không hợp lệ");
  const overlap = findPriceOverlap(parsed.data);
  if (overlap) return fail(400, overlap);

  const supabase = await createClient();
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  const { data: venue } = await supabase.from("venues").select("id").eq("id", venueId).eq("owner_id", owner.data).maybeSingle();
  if (!venue) return fail(403, "Bạn không có quyền sửa sân này");

  // Xóa và ghi lại trong một transaction (hàm replace_price_slots)
  const { data, error } = await supabase.rpc("replace_price_slots", { p_venue_id: venueId, p_prices: parsed.data });
  if (error) return fail(500, "Không lưu được bảng giá");
  return ok(
    ((data ?? []) as PriceSlot[]).map((p) => ({ id: p.id, day_type: p.day_type, price: p.price, start_time: hhmm(p.start_time), end_time: hhmm(p.end_time) })),
  );
}
