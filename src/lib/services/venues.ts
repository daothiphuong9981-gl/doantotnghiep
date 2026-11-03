import { unstable_cache } from "next/cache";
import { cache } from "react";
import { CACHE_TAG } from "@/lib/cache-tags";
import { addDays, currentHourInVietnam, hhmm, isValidDate, isWeekend, todayInVietnam } from "@/lib/format";
import { ratingSummaries } from "@/lib/services/reviews";
import { publicClient } from "@/lib/supabase/public";
import { BOOKING_RULES } from "@/lib/constants";
import {
  fail,
  ok,
  type Court,
  type PriceSlot,
  type RatingSummary,
  type Result,
  type SlotState,
  type Venue,
  type VenueCard,
  type VenueImage,
  type Ward,
} from "@/lib/types";

/*
 * Mọi hàm trong tệp này chỉ đọc dữ liệu CÔNG KHAI bằng client ẩn danh (publicClient: không đọc cookie, không ghi
 * Set-Cookie), nên dùng được trong unstable_cache và trong route GET có header CDN. Không thêm vào đây hàm nào đọc
 * dữ liệu theo người dùng.
 */

const toCard = (row: Record<string, unknown>): VenueCard => ({
  id: Number(row.id),
  name: String(row.name),
  address: String(row.address),
  ward_id: Number(row.ward_id),
  ward_name: String(row.ward_name),
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  min_price: row.min_price === null || row.min_price === undefined ? null : Number(row.min_price),
  court_count: Number(row.court_count ?? 0),
  thumbnail: (row.thumbnail as string | null) ?? null,
  distance_km: row.distance_km === null || row.distance_km === undefined ? null : Number(row.distance_km),
  free_courts: row.free_courts === null || row.free_courts === undefined ? null : Number(row.free_courts),
});

/**
 * Danh mục phường, xã gần như không đổi: lưu đệm 1 ngày trên máy chủ thay vì hỏi Supabase ở mỗi lần mở trang chủ
 * và mỗi câu hỏi trợ lý AI. Bảng wards cho khách đọc nên dùng client ẩn danh, không đọc cookie trong vùng cache.
 * Lỗi thì ném ra để không lưu đệm kết quả lỗi.
 */
const cachedWards = unstable_cache(
  async (): Promise<Ward[]> => {
    const { data, error } = await publicClient().from("wards").select("id, name, type").order("id");
    if (error) throw new Error(error.message);
    return (data ?? []) as Ward[];
  },
  ["wards-v1"],
  { revalidate: 86_400, tags: ["wards"] },
);

/** Danh mục phường, xã. */
export async function listWards(): Promise<Result<Ward[]>> {
  try {
    return ok(await cachedWards());
  } catch {
    return fail(500, "Không tải được danh mục phường, xã");
  }
}

export interface VenueFilter {
  q?: string;
  wardId?: number;
  minPrice?: number;
  maxPrice?: number;
  date?: string;
  startTime?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

/** Tham số gửi cho hàm search_venues (dùng chung cho nhánh có và không lưu đệm). */
function searchArgs(filter: VenueFilter) {
  const { q, wardId, minPrice, maxPrice, date, startTime, lat, lng, radiusKm } = filter;
  const hasPoint = lat !== undefined || lng !== undefined;
  return {
    p_q: q?.trim().slice(0, 100) || null,
    p_ward_id: wardId ?? null,
    p_min_price: minPrice ?? null,
    p_max_price: maxPrice ?? null,
    p_date: date ?? null,
    p_start_time: startTime ?? null,
    p_lat: lat ?? null,
    p_lng: lng ?? null,
    p_radius_km: hasPoint ? Math.min(Math.max(radiusKm ?? 30, 1), 100) : null,
  };
}

type SearchRow = Record<string, unknown>;

/**
 * Danh sách sân KHÔNG lọc theo ngày giờ và KHÔNG theo tọa độ (trang chủ mặc định, lọc từ khóa/phường/giá): giống nhau
 * với mọi người nên lưu đệm 60 giây, tag "venues" (chủ sân sửa sân, quản trị duyệt/ẩn sân thì xóa ngay).
 * Lọc theo giờ trống (đổi theo phút) và theo vị trí người dùng thì không lưu đệm.
 */
const cachedSearch = unstable_cache(
  async (args: ReturnType<typeof searchArgs>): Promise<SearchRow[]> => {
    const { data, error } = await publicClient().rpc("search_venues", args);
    if (error) throw new Error(error.message);
    return (data ?? []) as SearchRow[];
  },
  ["venues-list-v1"],
  { revalidate: 60, tags: [CACHE_TAG.venues] },
);

/**
 * PB09, PB10, PB12, PB13 - Danh sách sân đã duyệt, có thể lọc theo từ khóa (không phân biệt dấu),
 * phường/xã, khoảng giá và khung giờ còn trống. Có tọa độ thì sắp xếp theo khoảng cách (PostGIS).
 * Trợ lý AI dùng lại đúng hàm này; truyền sẵn `ratings` để nhiều lần tìm trong một câu hỏi chỉ đọc điểm một lần.
 */
export async function listVenues(filter: VenueFilter, ratings?: Promise<Map<number, RatingSummary>>): Promise<Result<VenueCard[]>> {
  const { wardId, minPrice, maxPrice, date, startTime, lat, lng } = filter;
  const hasPoint = lat !== undefined || lng !== undefined;
  if (hasPoint && (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat!) > 90 || Math.abs(lng!) > 180)) {
    return fail(400, "Tọa độ không hợp lệ");
  }
  if (wardId !== undefined && (!Number.isInteger(wardId) || wardId <= 0)) return fail(400, "Phường, xã không hợp lệ");
  for (const price of [minPrice, maxPrice]) {
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) return fail(400, "Khoảng giá không hợp lệ");
  }
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) return fail(400, "Giá thấp nhất phải nhỏ hơn giá cao nhất");
  if ((date === undefined) !== (startTime === undefined)) return fail(400, "Hãy chọn cả ngày và giờ để lọc sân trống");
  if (date !== undefined && startTime !== undefined) {
    const today = todayInVietnam();
    if (!isValidDate(date) || !/^([01]\d|2[0-3]):00$/.test(startTime)) return fail(400, "Ngày hoặc giờ không hợp lệ");
    if (date < today || (date === today && Number(startTime.slice(0, 2)) <= currentHourInVietnam())) {
      return fail(400, "Không tìm được sân trống cho thời điểm đã qua");
    }
    const maxDays = BOOKING_RULES.advance_days.max;
    if (date > addDays(today, maxDays)) return fail(400, `Chỉ xem được trong ${maxDays} ngày tới`);
  }

  const args = searchArgs(filter);
  const cacheable = date === undefined && !hasPoint;
  const search = async (): Promise<SearchRow[] | null> => {
    try {
      if (cacheable) return await cachedSearch(args);
      const { data, error } = await publicClient().rpc("search_venues", args);
      return error ? null : ((data ?? []) as SearchRow[]);
    } catch {
      return null;
    }
  };
  // Điểm đánh giá của mọi sân đã duyệt (khoảng 50 dòng) lấy song song với truy vấn tìm sân
  const [rows, ratingMap] = await Promise.all([search(), ratings ?? ratingSummaries()]);
  if (!rows) return fail(500, "Không tải được danh sách sân");
  return ok(
    rows.map((row) => {
      const card = toCard(row);
      const rating = ratingMap.get(card.id);
      return { ...card, rating_avg: rating?.avg ?? null, rating_count: rating?.count ?? 0 };
    }),
  );
}

export interface VenueDetail {
  venue: Omit<Venue, "bank_name" | "bank_bin" | "bank_account_number" | "bank_account_name" | "owner_id" | "reject_reason"> & { ward_name: string };
  prices: PriceSlot[];
  images: VenueImage[];
  courts: Court[];
}

/** Đọc chi tiết sân từ cơ sở dữ liệu (client ẩn danh). Không có sân đã duyệt hoặc lỗi thì ném ra để không lưu đệm. */
async function loadVenueDetail(id: number): Promise<VenueDetail> {
  // Một truy vấn duy nhất: PostgREST nhúng bảng giá, ảnh và sân con theo khóa ngoại (RLS vẫn áp dụng cho từng bảng).
  // Chỉ chọn cột công khai: KHÔNG có owner_id, reject_reason, cột ngân hàng.
  const { data: venue, error } = await publicClient()
    .from("venues")
    .select(
      "id, ward_id, name, address, description, contact_phone, latitude, longitude, open_time, close_time, hold_minutes, max_slots_per_booking, advance_days, max_active_holds, status, wards(name), price_slots(id, day_type, start_time, end_time, price), venue_images(id, storage_path, sort_order), courts(id, name, is_active)",
    )
    .eq("id", id)
    .eq("status", "approved")
    .eq("courts.is_active", true)
    .order("day_type", { referencedTable: "price_slots" })
    .order("start_time", { referencedTable: "price_slots" })
    .order("sort_order", { referencedTable: "venue_images" })
    .order("id", { referencedTable: "venue_images" })
    .order("id", { referencedTable: "courts" })
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!venue) throw new Error("NOT_FOUND");

  const { wards, price_slots: prices, venue_images: images, courts, ...rest } = venue;
  const wardRow = wards as unknown as { name: string } | { name: string }[] | null;
  const wardName = Array.isArray(wardRow) ? wardRow[0]?.name : wardRow?.name;
  return {
    venue: {
      ...rest,
      latitude: Number(rest.latitude),
      longitude: Number(rest.longitude),
      open_time: hhmm(rest.open_time),
      close_time: hhmm(rest.close_time),
      ward_name: wardName ?? "",
    } as VenueDetail["venue"],
    prices: ((prices ?? []) as PriceSlot[]).map((p) => ({ ...p, start_time: hhmm(p.start_time), end_time: hhmm(p.end_time) })),
    images: (images ?? []) as VenueImage[],
    courts: (courts ?? []) as Court[],
  };
}

/**
 * PB11 - Chi tiết một sân đã duyệt. Không trả về thông tin tài khoản nhận tiền.
 * Lưu đệm 300 giây (tag "venue:<id>", "venues"); sân không tồn tại/chưa duyệt hoặc lỗi thì không lưu đệm.
 * React cache: trang chi tiết và getAvailability trong cùng request chỉ đọc một lần.
 */
export const getVenueDetail = cache(async (id: number): Promise<Result<VenueDetail>> => {
  if (!Number.isInteger(id) || id <= 0) return fail(404, "Không tìm thấy sân");
  try {
    const detail = await unstable_cache(() => loadVenueDetail(id), ["venue-detail-v1", String(id)], {
      revalidate: 300,
      tags: [CACHE_TAG.venues, CACHE_TAG.venue(id)],
    })();
    return ok(detail);
  } catch {
    return fail(404, "Không tìm thấy sân");
  }
});

export interface AvailabilitySlot {
  start_time: string;
  price: number | null;
  state: SlotState;
}
export interface Availability {
  date: string;
  hours: string[];
  courts: { id: number; name: string; slots: AvailabilitySlot[] }[];
}

/** Giá áp dụng cho một khung giờ theo bảng giá (null nếu chủ sân chưa khai giá cho giờ đó). */
export function priceFor(prices: PriceSlot[], date: string, startTime: string): number | null {
  const dayType = isWeekend(date) ? "weekend" : "weekday";
  const match = (type: string) => prices.find((p) => p.day_type === type && p.start_time <= startTime && startTime < p.end_time);
  // Không khai giá cuối tuần thì dùng giá ngày thường
  return (match(dayType) ?? match("weekday"))?.price ?? null;
}

export type TakenSlot = { court_id: number; start_time: string; state: "held" | "booked" };

/**
 * Các khung giờ đã có người giữ chỗ/đặt của một sân trong một ngày. KHÔNG lưu đệm (đổi theo phút, giữ chỗ hết hạn
 * dựa vào now()). Lỗi thì trả null. Trang chi tiết gọi sớm hàm này song song với chi tiết sân rồi truyền vào getAvailability.
 */
export async function takenSlots(venueId: number, date: string): Promise<TakenSlot[] | null> {
  if (!Number.isInteger(venueId) || venueId <= 0 || !isValidDate(date)) return null;
  try {
    const { data, error } = await publicClient().rpc("venue_taken_slots", { p_venue_id: venueId, p_date: date });
    return error ? null : ((data ?? []) as TakenSlot[]);
  } catch {
    return null;
  }
}

/**
 * PB11 - Trạng thái từng khung giờ 60 phút của từng sân con trong một ngày, kèm chi tiết sân đã đọc
 * (trợ lý AI dùng lại max_slots_per_booking, không đọc chi tiết lần nữa).
 * `taken`: kết quả takenSlots(venueId, date) đã khởi động sớm (nếu có).
 */
export async function getAvailabilityDetail(
  venueId: number,
  date: string,
  taken?: Promise<TakenSlot[] | null>,
): Promise<Result<{ availability: Availability; detail: VenueDetail }>> {
  if (!isValidDate(date)) return fail(400, "Ngày không hợp lệ");
  const today = todayInVietnam();
  if (date < today) return fail(400, "Không xem được ngày đã qua");

  // Thông tin sân và các khung giờ đã có người đặt không phụ thuộc nhau: lấy song song
  const [detail, rows] = await Promise.all([getVenueDetail(venueId), taken ?? takenSlots(venueId, date)]);
  if (!detail.ok) return detail;
  const { venue, prices, courts } = detail.data;
  if (!rows) return fail(500, "Không tải được khung giờ");
  const takenMap = new Map<string, "held" | "booked">();
  for (const row of rows) takenMap.set(`${row.court_id}|${hhmm(row.start_time)}`, row.state);

  const openHour = Number(venue.open_time.slice(0, 2));
  const closeHour = Number(venue.close_time.slice(0, 2));
  const hours: string[] = [];
  for (let h = openHour; h < closeHour; h += 1) hours.push(`${String(h).padStart(2, "0")}:00`);
  const nowHour = currentHourInVietnam();

  return ok({
    detail: detail.data,
    availability: {
      date,
      hours,
      courts: courts.map((court) => ({
        id: court.id,
        name: court.name,
        slots: hours.map((start) => {
          const isPast = date === today && Number(start.slice(0, 2)) <= nowHour;
          const state: SlotState = isPast ? "past" : (takenMap.get(`${court.id}|${start}`) ?? "available");
          return { start_time: start, price: priceFor(prices, date, start), state };
        }),
      })),
    },
  });
}

/** PB11 - Trạng thái từng khung giờ 60 phút của từng sân con trong một ngày. */
export async function getAvailability(venueId: number, date: string, taken?: Promise<TakenSlot[] | null>): Promise<Result<Availability>> {
  const result = await getAvailabilityDetail(venueId, date, taken);
  return result.ok ? ok(result.data.availability) : result;
}
