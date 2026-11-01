import {
  askText,
  buildExtractionPrompt,
  buildReplyPrompt,
  cheaperMaxPrice,
  decide,
  EXTRACTION_SCHEMA,
  findRunWindows,
  hasConsecutive,
  hoursOf,
  mergeFreeHours,
  noResultReply,
  REJECT_TEXT,
  sanitizeFilter,
  slotLimitNote,
  templateReply,
  type AiFilter,
  type RawExtraction,
  type ReplyVenue,
} from "@/lib/ai/filter";
import { callGemini, parseJsonObject } from "@/lib/ai/gemini";
import { dbFail } from "@/lib/db-errors";
import { currentHourInVietnam, todayInVietnam } from "@/lib/format";
import { getAvailability, getVenueDetail, listVenues, listWards } from "@/lib/services/venues";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { fail, ok, type Result, type VenueCard } from "@/lib/types";

export const AI_DAILY_LIMIT = Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 20);
const MAX_VENUES = 5;
/** Số cơ sở tối đa được kiểm tra chi tiết từng sân con khi cần giờ liên tục (giới hạn số truy vấn mỗi câu hỏi) */
const VERIFY_LIMIT = 12;

export interface AssistantVenue extends VenueCard {
  /** Các giờ còn đủ sân trống (ít nhất min_courts sân, mặc định 1), hoặc các khung liên tục dạng "07:00–09:00" */
  free_hours: string[];
  /** Giới hạn số ô mỗi lượt đặt của cơ sở (chỉ có khi đã kiểm tra chi tiết) */
  max_slots?: number | null;
}

export interface AssistantReply {
  reply: string;
  /** Bộ lọc AI đã hiểu (đã được máy chủ kiểm tra); null khi không tìm kiếm */
  filter: AiFilter | null;
  venues: AssistantVenue[];
  /** Số lượt hỏi còn lại trong ngày */
  remaining: number;
  /** true khi Gemini lỗi: giao diện hướng người chơi sang bộ lọc thường */
  fallback: boolean;
}

const FALLBACK_TEXT = "Trợ lý AI đang tạm thời không phản hồi được. Bạn dùng bộ lọc tìm sân thông thường ở trang chủ giúp mình nhé.";

/**
 * Tìm sân theo bộ lọc của trợ lý. Có ngày và khung giờ thì kiểm tra từng giờ và gộp các giờ còn trống.
 * Có số sân cần cùng lúc (min_courts) thì chỉ tính một giờ là còn trống khi số sân con trống ở giờ đó đủ min_courts,
 * và bỏ cơ sở có tổng số sân con ít hơn min_courts.
 */
async function search(filter: AiFilter, point: { lat: number; lng: number } | null): Promise<Result<AssistantVenue[]>> {
  const need = filter.min_courts ?? 1;
  const base = {
    q: filter.keyword ?? undefined,
    wardId: filter.ward_id ?? undefined,
    minPrice: filter.min_price ?? undefined,
    maxPrice: filter.max_price ?? undefined,
    ...(filter.near_me && point ? { lat: point.lat, lng: point.lng, radiusKm: filter.radius_km ?? 10 } : {}),
  };
  const hours = filter.date ? hoursOf(filter) : [];
  if (hours.length === 0) {
    const result = await listVenues(base);
    return result.ok ? ok(result.data.filter((v) => v.court_count >= need).map((v) => ({ ...v, free_hours: [] }))) : result;
  }
  const results = await Promise.all(hours.map((h) => listVenues({ ...base, date: filter.date as string, startTime: h })));
  if (results.every((r) => !r.ok)) return fail(500, "Không tải được danh sách sân");
  const merged: AssistantVenue[] = mergeFreeHours(hours, results.map((r) => (r.ok ? r.data : null)), filter.min_courts);
  const length = filter.consecutive_hours;
  if (!length) return ok(merged);

  // Cần giờ liên tục: lọc nhanh theo số đếm từng giờ, rồi kiểm tra từng sân con để chắc có đủ `need` sân trống SUỐT khung
  // (số đếm từng giờ chưa đủ: 8 sân trống lúc 7 giờ và 8 sân trống lúc 8 giờ có thể không phải cùng 8 sân).
  const candidates = merged.filter((v) => hasConsecutive(v.free_hours, hours, length)).slice(0, VERIFY_LIMIT);
  const checked = await Promise.all(
    candidates.map(async (venue): Promise<AssistantVenue | null> => {
      const [slots, detail] = await Promise.all([getAvailability(venue.id, filter.date as string), getVenueDetail(venue.id)]);
      if (!slots.ok) return null;
      const windows = findRunWindows(slots.data.courts, hours, need, length);
      if (windows.length === 0) return null;
      return {
        ...venue,
        free_hours: windows.map((w) => `${w.start}–${w.end}`),
        free_courts: Math.max(...windows.map((w) => w.courts.length)),
        max_slots: detail.ok ? detail.data.venue.max_slots_per_booking : null,
      };
    }),
  );
  return ok(checked.filter((v): v is AssistantVenue => v !== null));
}

const toReplyVenue = (v: AssistantVenue): ReplyVenue => ({
  name: v.name,
  address: v.address,
  ward: v.ward_name,
  min_price: v.min_price,
  court_count: v.court_count,
  distance_km: v.distance_km ?? null,
  free_hours: v.free_hours,
  free_courts: v.free_hours.length ? (v.free_courts ?? null) : null,
});

/**
 * PB23..PB26 - Trợ lý AI tìm sân.
 * Bước 1: Gemini chuyển câu hỏi thành bộ lọc có cấu trúc; máy chủ kiểm tra hợp lệ.
 * Bước 2: truy vấn sân bằng search_venues; Gemini chỉ diễn đạt lại kết quả truy vấn.
 * Không gửi họ tên, email, số điện thoại của người dùng tới Gemini.
 */
export async function chat(input: unknown): Promise<Result<AssistantReply>> {
  const body = (input ?? {}) as { session_id?: unknown; message?: unknown; lat?: unknown; lng?: unknown };
  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) return fail(400, "Thiếu mã phiên hội thoại");
  if (!message) return fail(400, "Hãy nhập câu hỏi");
  if (message.length > 300) return fail(400, "Câu hỏi tối đa 300 ký tự");
  const lat = typeof body.lat === "number" ? body.lat : null;
  const lng = typeof body.lng === "number" ? body.lng : null;
  const point = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return fail(401, "Bạn cần đăng nhập để dùng trợ lý AI");

  // Ghi nhận lượt hỏi trước khi gọi Gemini; vượt giới hạn thì dừng (429). Danh mục phường tải song song.
  const [begun, wards] = await Promise.all([
    supabase.rpc("ai_begin", { p_session_id: sessionId, p_question: message, p_daily_limit: AI_DAILY_LIMIT }),
    listWards(),
  ]);
  if (begun.error) {
    if (begun.error.message === "RATE_LIMITED") {
      return fail(429, `Bạn đã dùng hết ${AI_DAILY_LIMIT} lượt hỏi trợ lý AI trong hôm nay. Bạn vẫn tìm sân được bằng bộ lọc thông thường ở trang chủ.`);
    }
    return dbFail(begun.error, "Không gửi được câu hỏi");
  }
  const turn = begun.data as { id: number; used: number; last_filter: AiFilter | null; history: string[] };
  const remaining = Math.max(0, AI_DAILY_LIMIT - turn.used);
  const finish = (filter: AiFilter | null, count: number | null, status: "ok" | "fallback" | "rejected" | "error") =>
    supabase.rpc("ai_finish", { p_id: turn.id, p_filter: filter, p_result_count: count, p_status: status });
  const fallback = async (): Promise<Result<AssistantReply>> => {
    await finish(null, null, "fallback");
    return ok({ reply: FALLBACK_TEXT, filter: null, venues: [], remaining, fallback: true });
  };

  if (!wards.ok) return fallback();
  const today = todayInVietnam();
  const currentHour = currentHourInVietnam();

  // Bước 1: hiểu câu hỏi
  const extraction = await callGemini({
    system: buildExtractionPrompt({ today, currentHour, wards: wards.data, previous: turn.last_filter, history: turn.history }),
    user: message,
    schema: EXTRACTION_SCHEMA,
  });
  if (!extraction.ok) return fallback();
  const raw = parseJsonObject(extraction.text) as RawExtraction | null;
  if (!raw) return fallback();

  const { filter, dropped, cheaper, inScope } = sanitizeFilter(raw, { today, currentHour, wards: wards.data, hasLocation: point !== null });
  const decision = decide(filter, dropped, inScope);
  if (decision.kind === "reject") {
    await finish(null, null, "rejected");
    return ok({ reply: REJECT_TEXT, filter: null, venues: [], remaining, fallback: false });
  }
  if (decision.kind === "ask") {
    // Giữ phần bộ lọc đã hiểu để lượt sau người chơi chỉ cần bổ sung
    await finish(filter, null, "ok");
    return ok({ reply: askText(decision.missing, dropped), filter, venues: [], remaining, fallback: false });
  }

  // Bước 2: truy vấn dữ liệu thật
  let found = await search(filter, point);
  if (!found.ok) return fallback();
  let note = "";
  if (cheaper) {
    const cheaperMax = cheaperMaxPrice(filter.max_price, found.data.map((v) => v.min_price ?? 0));
    if (cheaperMax === null) note = " Đây đã là mức giá thấp nhất mình tìm được với các điều kiện này.";
    else {
      filter.max_price = cheaperMax;
      if (filter.min_price !== null && filter.min_price > cheaperMax) filter.min_price = null;
      found = await search(filter, point);
      if (!found.ok) return fallback();
    }
  }
  const total = found.data.length;
  const venues = found.data.slice(0, MAX_VENUES);
  if (total === 0) {
    await finish(filter, total, "ok");
    return ok({ reply: noResultReply(filter), filter, venues: [], remaining, fallback: false });
  }

  // Gemini chỉ diễn đạt lại kết quả; lỗi thì dùng câu mẫu dựng từ dữ liệu. Ghi nhật ký lượt hỏi song song.
  const replyVenues = venues.map(toReplyVenue);
  const prompt = buildReplyPrompt(filter, replyVenues);
  const [, phrased] = await Promise.all([
    finish(filter, total, "ok"),
    callGemini({ system: prompt.system, user: prompt.user, timeoutMs: 12_000, maxOutputTokens: 400 }),
  ]);
  const more = total > venues.length ? ` (Hiển thị ${venues.length} trong ${total} sân phù hợp.)` : "";
  // Số ô cần đặt vượt giới hạn một lượt của cơ sở: nhắc người chơi chia lượt (máy chủ tự tính, không do mô hình viết)
  if (filter.consecutive_hours && filter.min_courts) {
    note += slotLimitNote(
      venues.map((v) => ({ name: v.name, max_slots: v.max_slots ?? null })),
      filter.min_courts,
      filter.consecutive_hours,
    );
  }
  return ok({ reply: `${phrased.ok ? phrased.text : templateReply(replyVenues)}${note}${more}`, filter, venues, remaining, fallback: false });
}

/** Số lượt hỏi còn lại trong ngày của người đang đăng nhập (đọc qua ai_begin sẽ tốn lượt, nên chỉ ước lượng ở giao diện). */
export const assistantInfo = { dailyLimit: AI_DAILY_LIMIT, configured: () => Boolean(process.env.GEMINI_API_KEY) };
