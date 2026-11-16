import { dbFail } from "@/lib/db-errors";
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
  /** Sân chưa từng có lượt đặt nào thì xóa hẳn được */
  has_bookings: boolean;
}

/** Danh sách sân của chủ sân đang đăng nhập (số sân con chỉ tính sân đang hoạt động). */
export async function listMyVenues(): Promise<Result<OwnerVenueRow[]>> {
  const supabase = await createClient();
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, address, status, reject_reason, hold_minutes, wards(name), courts(is_active), bookings(count)")
    .eq("owner_id", owner.data)
    .order("created_at", { ascending: false });
  if (error) return fail(500, "Không tải được danh sách sân");
  return ok(
    (data ?? []).map((v) => {
      const wards = v.wards as { name: string } | { name: string }[] | null;
      const courts = (v.courts ?? []) as { is_active: boolean }[];
      const bookings = v.bookings as { count: number }[] | null;
      return {
        id: v.id,
        name: v.name,
        address: v.address,
        status: v.status,
        reject_reason: v.reject_reason,
        hold_minutes: v.hold_minutes,
        ward_name: (Array.isArray(wards) ? wards[0]?.name : wards?.name) ?? "",
        court_count: courts.filter((c) => c.is_active).length,
        has_bookings: (bookings?.[0]?.count ?? 0) > 0,
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
  // Tài khoản nhận tiền không đọc trực tiếp từ bảng được (0009_security.sql): lấy qua hàm venue_bank_info, song song
  const [{ data: venue }, { data: bank }, courts, prices, images] = await Promise.all([
    supabase
      .from("venues")
      .select("id, owner_id, ward_id, name, address, description, contact_phone, latitude, longitude, open_time, close_time, hold_minutes, max_slots_per_booking, advance_days, max_active_holds, status, reject_reason")
      .eq("id", id)
      .eq("owner_id", owner.data)
      .maybeSingle(),
    supabase.rpc("venue_bank_info", { p_venue_id: id }).maybeSingle<Pick<Venue, "bank_name" | "bank_bin" | "bank_account_number" | "bank_account_name">>(),
    supabase.from("courts").select("id, name, is_active").eq("venue_id", id).order("id"),
    supabase.from("price_slots").select("id, day_type, start_time, end_time, price").eq("venue_id", id).order("day_type").order("start_time"),
    supabase.from("venue_images").select("id, storage_path, sort_order").eq("venue_id", id).order("sort_order").order("id"),
  ]);
  if (!venue) return fail(404, "Không tìm thấy sân");
  return ok({
    venue: {
      ...venue,
      bank_name: bank?.bank_name ?? "",
      bank_bin: bank?.bank_bin ?? null,
      bank_account_number: bank?.bank_account_number ?? "",
      bank_account_name: bank?.bank_account_name ?? "",
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

/**
 * Điều chỉnh số sân con ĐANG HOẠT ĐỘNG theo số nhập trong form:
 * - tăng: mở lại sân con đã ngừng (theo thứ tự tạo) rồi mới tạo sân mới, tên "Sân n" không trùng tên đã có;
 * - giảm: ngừng các sân con đang hoạt động ở cuối danh sách. Sân con còn khung giờ đã đặt sắp tới bị trigger
 *   courts_guard_deactivate (0015) chặn, thông báo nêu rõ sân nào, lượt gần nhất lúc nào.
 * Muốn ngừng một sân con cụ thể thì dùng mục "Sân con" (setCourtActive).
 */
async function syncCourts(supabase: Supabase, venueId: number, target: number): Promise<string | null> {
  const { data: courts, error } = await supabase.from("courts").select("id, name, is_active").eq("venue_id", venueId).order("id");
  if (error) return "Không cập nhật được sân con";
  const all = courts ?? [];
  const active = all.filter((c) => c.is_active);
  if (target < active.length) {
    for (const court of active.slice(target).reverse()) {
      const res = await supabase.from("courts").update({ is_active: false }).eq("id", court.id);
      if (res.error) return res.error.message === "INVALID_STATE" && res.error.details ? res.error.details : "Không cập nhật được sân con";
    }
    return null;
  }
  let missing = target - active.length;
  for (const court of all.filter((c) => !c.is_active)) {
    if (missing === 0) break;
    const res = await supabase.from("courts").update({ is_active: true }).eq("id", court.id);
    if (res.error) return "Không cập nhật được sân con";
    missing -= 1;
  }
  if (missing > 0) {
    const names = new Set(all.map((c) => c.name));
    const rows: { venue_id: number; name: string }[] = [];
    for (let n = 1; rows.length < missing; n += 1) {
      if (!names.has(`Sân ${n}`)) rows.push({ venue_id: venueId, name: `Sân ${n}` });
    }
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
  if (courtError) return { ...fail(409, `Đã lưu thông tin sân, nhưng chưa đổi được số sân con: ${courtError}`), errors: { court_count: courtError } };
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
  if (error || !data) return fail(409, suspended ? "Không tạm ngừng được: sân không còn ở trạng thái đang hiển thị." : "Không mở lại được: sân không còn ở trạng thái tạm ngừng.");
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

/** Sân con: đổi tên. Tên không trùng với sân con khác của cùng cơ sở. */
export async function renameCourt(venueId: number, courtId: number, name: string): Promise<Result<null>> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return fail(400, "Hãy nhập tên sân con");
  if (clean.length > 40) return fail(400, "Tên sân con tối đa 40 ký tự");
  const supabase = await createClient();
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  const { data, error } = await supabase.from("courts").update({ name: clean }).eq("id", courtId).eq("venue_id", venueId).select("id").maybeSingle();
  if (error?.code === "23505") return fail(409, `Đã có sân con tên “${clean}”`);
  if (error || !data) return fail(403, "Không đổi được tên sân con");
  return ok(null);
}

/** Sân con: ngừng hoặc mở lại một sân cụ thể (ví dụ đang sửa mặt sân). Còn lượt đặt sắp tới thì không ngừng được. */
export async function setCourtActive(venueId: number, courtId: number, active: boolean): Promise<Result<null>> {
  const supabase = await createClient();
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  if (!active) {
    const { count } = await supabase.from("courts").select("id", { count: "exact", head: true }).eq("venue_id", venueId).eq("is_active", true);
    if ((count ?? 0) <= 1) return fail(409, "Sân cần ít nhất 1 sân con đang hoạt động. Muốn nghỉ cả sân, hãy dùng nút Tạm ngừng.");
  }
  const { data, error } = await supabase.from("courts").update({ is_active: active }).eq("id", courtId).eq("venue_id", venueId).select("id").maybeSingle();
  if (error) return dbFail(error, "Không cập nhật được sân con");
  if (!data) return fail(403, "Không cập nhật được sân con");
  return ok(null);
}

/**
 * Xóa hẳn một sân chưa từng có lượt đặt (đăng nhầm, trùng). Hàm owner_delete_venue (0016) kiểm tra quyền và lượt đặt;
 * ảnh trên Storage xóa sau khi xóa dòng (lỗi xóa ảnh không làm hỏng thao tác).
 */
export async function deleteVenue(venueId: number): Promise<Result<null>> {
  if (!Number.isInteger(venueId) || venueId <= 0) return fail(404, "Không tìm thấy sân");
  const supabase = await createClient();
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  const { data: images } = await supabase.from("venue_images").select("storage_path").eq("venue_id", venueId);
  const { error } = await supabase.rpc("owner_delete_venue", { p_venue_id: venueId });
  if (error) return dbFail(error, "Không xóa được sân");
  const paths = (images ?? []).map((i) => i.storage_path);
  if (paths.length) await supabase.storage.from("venue-images").remove(paths);
  return ok(null);
}
