import { after } from "next/server";
import { dbFail, type DbError } from "@/lib/db-errors";
import { describeDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { isEmailConfigured, processEmailOutbox } from "@/lib/services/emails";
import { fail, ok, type Booking, type BookingItem, type BookingStatus, type PaymentInfo, type Result } from "@/lib/types";
import { bookingSchema } from "@/lib/validation";
import { canMakeVietQr, vietQrPayload } from "@/lib/vietqr";

type Supabase = Awaited<ReturnType<typeof createClient>>;
const COLUMNS =
  "id, code, venue_id, venue_name, venue_address, player_id, total_amount, status, hold_expires_at, paid_reported_at, transfer_note, confirmed_at, cancel_reason, cancelled_by, created_at, is_past, can_cancel, items";

export type BookingResult<T> = Result<T> & { conflicts?: Pick<BookingItem, "court_id" | "court_name" | "booking_date" | "start_time">[] };

/** Đổi lỗi của hàm cơ sở dữ liệu thành kết quả kèm mã HTTP và thông báo tiếng Việt. */
function fromDbError(error: DbError, fallback: string): BookingResult<never> {
  if (error.message === "SLOT_TAKEN") {
    let conflicts: NonNullable<BookingResult<never>["conflicts"]> = [];
    try {
      conflicts = JSON.parse(error.details ?? "[]");
    } catch {
      conflicts = [];
    }
    const list = conflicts.map((c) => `${c.court_name} lúc ${c.start_time} ngày ${describeDate(c.booking_date).short}`).join("; ");
    const message = list
      ? `Khung giờ vừa có người khác giữ hoặc đặt: ${list}. Hãy chọn khung giờ khác.`
      : "Có khung giờ vừa được người khác giữ. Hãy chọn lại.";
    return { ...fail(409, message), conflicts };
  }
  return dbFail(error, fallback);
}

function toBooking(row: Record<string, unknown>): Booking {
  const cancelledBy = row.cancelled_by as string | null;
  return {
    id: Number(row.id),
    code: String(row.code),
    venue_id: Number(row.venue_id),
    venue_name: String(row.venue_name),
    venue_address: String(row.venue_address),
    total_amount: Number(row.total_amount),
    status: row.status as BookingStatus,
    hold_expires_at: String(row.hold_expires_at),
    paid_reported_at: (row.paid_reported_at as string | null) ?? null,
    transfer_note: (row.transfer_note as string | null) ?? null,
    confirmed_at: (row.confirmed_at as string | null) ?? null,
    cancel_reason: (row.cancel_reason as string | null) ?? null,
    cancelled_by_owner: row.status === "cancelled" ? cancelledBy !== null && cancelledBy !== row.player_id : null,
    created_at: String(row.created_at),
    is_past: Boolean(row.is_past),
    can_cancel: Boolean(row.can_cancel),
    items: (row.items as BookingItem[]) ?? [],
  };
}

async function currentUser() {
  const session = await getSession();
  if (!session) return null;
  return { id: session.userId, role: session.profile.role };
}

/** Đọc một lượt đặt mà người gọi được phép xem (RLS lọc sẵn). Lượt quá hạn giữ chỗ được chuyển sang expired trước. */
async function readBooking(supabase: Supabase, id: number): Promise<Record<string, unknown> | null> {
  const select = () => supabase.from("booking_details").select(COLUMNS).eq("id", id).maybeSingle();
  let { data } = await select();
  if (data && data.status === "holding" && new Date(data.hold_expires_at).getTime() <= Date.now()) {
    await supabase.rpc("expire_holds");
    ({ data } = await select());
  }
  return data;
}

/** Không đọc được lượt đặt: 403 nếu là lượt của người khác, 404 nếu không tồn tại. */
async function missing(supabase: Supabase, id: number): Promise<Result<never>> {
  const { data } = await supabase.rpc("booking_exists", { p_booking_id: id });
  return data === true ? fail(403, "Đây không phải lượt đặt của bạn") : fail(404, "Không tìm thấy lượt đặt");
}

export interface BookingView {
  booking: Booking;
  /** Thông tin chuyển khoản, chỉ có khi lượt đặt còn giữ chỗ hoặc đang chờ xác nhận. */
  payment: PaymentInfo | null;
  /** Giờ máy chủ, để trình duyệt đếm ngược không phụ thuộc đồng hồ máy người dùng. */
  server_time: string;
}

/** Thông tin chuyển khoản qua hàm booking_payment_info: cột tài khoản ngân hàng không đọc trực tiếp được (0009). */
async function paymentOf(supabase: Supabase, booking: Booking): Promise<PaymentInfo | null> {
  if (booking.status !== "holding" && booking.status !== "awaiting_confirmation") return null;
  const { data } = await supabase.rpc("booking_payment_info", { p_booking_id: booking.id }).maybeSingle<Omit<PaymentInfo, "qr">>();
  if (!data) return null;
  const amount = Number(data.amount);
  return { ...data, amount, qr: booking.status === "holding" ? await paymentQr(data.bank_bin, data.account_number, amount, data.content) : null };
}

/**
 * Ảnh QR (PNG dạng data URL) để hiển thị và tải về: ứng dụng ngân hàng mở ảnh từ thư viện là điền sẵn người nhận,
 * số tiền, nội dung. Số tiền và nội dung lấy từ cơ sở dữ liệu. Thiếu BIN hoặc số tài khoản không hợp lệ thì bỏ qua.
 */
async function paymentQr(bin: string | null, accountNumber: string, amount: number, content: string): Promise<PaymentInfo["qr"]> {
  const input = { bin: bin ?? undefined, accountNumber, amount, content };
  if (!canMakeVietQr(input)) return null;
  const payload = vietQrPayload(input);
  try {
    // Nạp thư viện QR khi cần (chỉ lượt đang giữ chỗ), không nằm trong phần khởi động của các route đặt sân
    const { default: QRCode } = await import("qrcode");
    const image = await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, width: 480 });
    return { payload, image };
  } catch {
    return null;
  }
}

/** PB14, PB15 - Giữ chỗ: tạo một lượt đặt gồm nhiều sân con, nhiều khung giờ. */
export async function createBooking(input: unknown): Promise<BookingResult<BookingView>> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const user = await currentUser();
  if (!user) return fail(401, "Bạn cần đăng nhập để đặt sân");
  if (user.role !== "player") return fail(403, "Chỉ tài khoản người chơi mới đặt được sân");

  const { data, error } = await supabase.rpc("create_booking", { p_venue_id: parsed.data.venue_id, p_items: parsed.data.items });
  if (error) return fromDbError(error, "Không giữ được chỗ. Vui lòng thử lại.");
  return getBooking(Number((data as { id: number }).id));
}

/** PB18 - Chi tiết một lượt đặt của người chơi đang đăng nhập, kèm thông tin chuyển khoản. */
export async function getBooking(id: number): Promise<Result<BookingView>> {
  if (!Number.isInteger(id) || id <= 0) return fail(404, "Không tìm thấy lượt đặt");
  const supabase = await createClient();
  // Hồ sơ người dùng và lượt đặt không phụ thuộc nhau: đọc song song (RLS vẫn chỉ trả lượt người gọi được xem)
  const [user, row] = await Promise.all([currentUser(), readBooking(supabase, id)]);
  if (!user) return fail(401, "Bạn cần đăng nhập");
  if (!row) return missing(supabase, id);
  if (row.player_id !== user.id) return fail(403, "Đây không phải lượt đặt của bạn");
  const booking = toBooking(row);
  return ok({ booking, payment: await paymentOf(supabase, booking), server_time: new Date().toISOString() });
}

export type BookingScope = "upcoming" | "past" | "closed";

/** PB17 - Lịch sử đặt sân của người chơi. upcoming: còn hiệu lực và chưa chơi; past: đã chơi; closed: đã hủy, hết hạn. */
export async function listMyBookings(scope?: string): Promise<Result<{ bookings: Booking[]; server_time: string }>> {
  if (scope !== undefined && !["upcoming", "past", "closed"].includes(scope)) return fail(400, "Tham số scope không hợp lệ");
  const supabase = await createClient();
  const user = await currentUser();
  if (!user) return fail(401, "Bạn cần đăng nhập");
  const select = () => {
    let query = supabase.from("booking_details").select(COLUMNS).eq("player_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (scope === "closed") query = query.in("status", ["cancelled", "expired"]);
    if (scope === "upcoming") query = query.in("status", ["holding", "awaiting_confirmation", "confirmed"]).eq("is_past", false);
    if (scope === "past") query = query.in("status", ["awaiting_confirmation", "confirmed"]).eq("is_past", true);
    return query;
  };
  // Giải phóng lượt quá hạn song song với việc đọc (bớt một lượt chờ Supabase). Chỉ đọc lại khi kết quả còn
  // lượt giữ chỗ đã quá hạn, hoặc khi xem tab "đã hủy, hết hạn" (cần thấy lượt vừa chuyển sang hết hạn).
  let [, { data, error }] = await Promise.all([supabase.rpc("expire_holds"), select()]);
  const stale = (data ?? []).some((r) => r.status === "holding" && new Date(r.hold_expires_at as string).getTime() <= Date.now());
  if (!error && (stale || scope === "closed")) ({ data, error } = await select());
  if (error) return fail(500, "Không tải được lịch sử đặt sân");
  return ok({ bookings: (data ?? []).map(toBooking), server_time: new Date().toISOString() });
}

/** PB18 - Người chơi báo đã chuyển khoản. Quá hạn giữ chỗ thì trả lỗi 409 và lượt đặt thành expired. */
export async function reportPayment(id: number, input: unknown): Promise<Result<{ booking: Booking }>> {
  const note = typeof (input as { transfer_note?: unknown })?.transfer_note === "string" ? (input as { transfer_note: string }).transfer_note : null;
  if (note && note.length > 200) return fail(400, "Ghi chú tối đa 200 ký tự");
  const supabase = await createClient();
  const user = await currentUser();
  if (!user) return fail(401, "Bạn cần đăng nhập");
  if (!Number.isInteger(id) || id <= 0) return fail(404, "Không tìm thấy lượt đặt");
  const current = await readBooking(supabase, id);
  if (!current) return missing(supabase, id);
  if (current.player_id !== user.id) return fail(403, "Đây không phải lượt đặt của bạn");

  const { data, error } = await supabase.rpc("report_payment", { p_booking_id: id, p_transfer_note: note });
  if (error) return fromDbError(error, "Không ghi nhận được. Vui lòng thử lại.");
  if (data === "expired") return fail(409, "Đã hết thời gian giữ chỗ. Sân đã được trả lại, vui lòng đặt lại.");
  const row = await readBooking(supabase, id);
  return row ? ok({ booking: toBooking(row) }) : fail(404, "Không tìm thấy lượt đặt");
}

/** PB17, PB18 - Người chơi hủy lượt đặt của mình khi chưa đến giờ chơi. */
export async function cancelMyBooking(id: number): Promise<Result<{ booking: Booking }>> {
  const supabase = await createClient();
  const user = await currentUser();
  if (!user) return fail(401, "Bạn cần đăng nhập");
  if (!Number.isInteger(id) || id <= 0) return fail(404, "Không tìm thấy lượt đặt");
  const current = await readBooking(supabase, id);
  if (!current) return missing(supabase, id);
  if (current.player_id !== user.id) return fail(403, "Đây không phải lượt đặt của bạn");

  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: id, p_reason: null });
  if (error) return fromDbError(error, "Không hủy được. Vui lòng thử lại.");
  const row = await readBooking(supabase, id);
  return row ? ok({ booking: toBooking(row) }) : fail(404, "Không tìm thấy lượt đặt");
}

// ------------------------------------------------------------------ Chủ sân

export interface OwnerBooking extends Booking {
  player_name: string;
  player_phone: string;
}
export interface OwnerBookingList {
  summary: { holding: number; awaiting_confirmation: number; confirmed: number; closed: number };
  bookings: OwnerBooking[];
  venues: { id: number; name: string }[];
}

const STATUSES: BookingStatus[] = ["holding", "awaiting_confirmation", "confirmed", "cancelled", "expired"];

/** PB16 - Lịch đặt các sân của chủ sân đang đăng nhập, kèm tên và số điện thoại người đặt. */
export async function listOwnerBookings(params: { venueId?: number; date?: string; status?: string }): Promise<Result<OwnerBookingList>> {
  const supabase = await createClient();
  const user = await currentUser();
  if (!user) return fail(401, "Bạn cần đăng nhập");
  if (user.role !== "owner") return fail(403, "Chức năng chỉ dành cho chủ sân");
  if (params.status && !STATUSES.includes(params.status as BookingStatus)) return fail(400, "Trạng thái không hợp lệ");
  if (params.date && !/^\d{4}-\d{2}-\d{2}$/.test(params.date)) return fail(400, "Ngày không hợp lệ");

  // Hai việc độc lập: chạy song song
  const [, { data: venues }] = await Promise.all([
    supabase.rpc("expire_holds"),
    supabase.from("venues").select("id, name").eq("owner_id", user.id).order("name"),
  ]);
  const venueIds = (venues ?? []).map((v) => v.id);
  if (params.venueId !== undefined && !venueIds.includes(params.venueId)) return fail(403, "Đây không phải sân của bạn");
  const scope = params.venueId !== undefined ? [params.venueId] : venueIds;
  const empty = { holding: 0, awaiting_confirmation: 0, confirmed: 0, closed: 0 };
  if (scope.length === 0) return ok({ summary: empty, bookings: [], venues: venues ?? [] });

  const { data, error } = await supabase.from("booking_details").select(COLUMNS).in("venue_id", scope).order("created_at", { ascending: false }).limit(300);
  if (error) return fail(500, "Không tải được lịch đặt");
  let rows = data ?? [];
  if (params.date) rows = rows.filter((r) => (r.items as BookingItem[]).some((i) => i.booking_date === params.date));

  const summary = { ...empty };
  for (const r of rows) {
    if (r.status === "cancelled" || r.status === "expired") summary.closed += 1;
    else summary[r.status as "holding" | "awaiting_confirmation" | "confirmed"] += 1;
  }
  if (params.status) rows = rows.filter((r) => r.status === params.status);

  const playerIds = [...new Set(rows.map((r) => r.player_id).filter(Boolean))] as string[];
  const { data: players } = playerIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", playerIds)
    : { data: [] as { id: string; full_name: string; phone: string }[] };
  const byId = new Map((players ?? []).map((p) => [p.id, p]));

  return ok({
    summary,
    venues: venues ?? [],
    bookings: rows.map((r) => ({
      ...toBooking(r),
      // Lượt giữ chỗ đã hết hạn không kèm thông tin khách (0009_security.sql); không tìm thấy hồ sơ ở lượt khác là tài khoản đã xóa
      player_name: byId.get(r.player_id as string)?.full_name ?? (r.status === "expired" && r.player_id ? "Khách (giữ chỗ hết hạn)" : "Tài khoản đã xóa"),
      player_phone: byId.get(r.player_id as string)?.phone ?? "",
    })),
  });
}

/** PB16 - Chủ sân xác nhận đã nhận tiền, hoặc hủy lượt đặt kèm lý do. */
export async function ownerSetBookingStatus(id: number, input: unknown): Promise<Result<{ booking: Booking }>> {
  const body = (input ?? {}) as { action?: unknown; reason?: unknown };
  if (body.action !== "confirm_payment" && body.action !== "cancel") return fail(400, "Thao tác không hợp lệ");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (body.action === "cancel" && !reason) return fail(400, "Hãy nhập lý do hủy");
  if (reason.length > 300) return fail(400, "Lý do tối đa 300 ký tự");
  if (!Number.isInteger(id) || id <= 0) return fail(404, "Không tìm thấy lượt đặt");

  const supabase = await createClient();
  const user = await currentUser();
  if (!user) return fail(401, "Bạn cần đăng nhập");
  if (user.role !== "owner") return fail(403, "Chức năng chỉ dành cho chủ sân");

  const { error } =
    body.action === "confirm_payment"
      ? await supabase.rpc("confirm_payment", { p_booking_id: id })
      : await supabase.rpc("cancel_booking", { p_booking_id: id, p_reason: reason });
  if (error) {
    // Lượt đặt của sân khác: hàm trả FORBIDDEN (403), không để lộ có tồn tại hay không
    return fromDbError(error, "Không cập nhật được lượt đặt");
  }
  // Trigger 0011 đã ghi thư xác nhận vào hàng đợi; gửi sau khi trả kết quả để chủ sân không phải chờ SMTP.
  // Gửi lỗi thì thư vẫn nằm trong hàng đợi, /api/cron/send-emails gửi lại.
  if (body.action === "confirm_payment" && isEmailConfigured()) after(() => processEmailOutbox(5));
  const row = await readBooking(supabase, id);
  return row ? ok({ booking: toBooking(row) }) : fail(404, "Không tìm thấy lượt đặt");
}

/** Giải phóng các lượt giữ chỗ quá hạn (tác vụ định kỳ). */
export async function expireHolds(): Promise<Result<{ expired: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("expire_holds");
  if (error) return fail(500, "Không chạy được tác vụ");
  return ok({ expired: Number(data ?? 0) });
}
