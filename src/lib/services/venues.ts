import { createClient as createAnonClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { addDays, currentHourInVietnam, hhmm, isValidDate, isWeekend, todayInVietnam } from "@/lib/format";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { ratingSummaries } from "@/lib/services/reviews";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_RULES } from "@/lib/constants";
import { fail, ok, type Court, type PriceSlot, type Result, type SlotState, type Venue, type VenueCard, type VenueImage, type Ward } from "@/lib/types";

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
    const supabase = createAnonClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await supabase.from("wards").select("id, name, type").order("id");
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

/**
 * PB09, PB10, PB12, PB13 - Danh sách sân đã duyệt, có thể lọc theo từ khóa (không phân biệt dấu),
 * phường/xã, khoảng giá và khung giờ còn trống. Có tọa độ thì sắp xếp theo khoảng cách (PostGIS).
 * Trợ lý AI ở Sprint 3 dùng lại đúng hàm này.
 */
export async function listVenues(filter: VenueFilter): Promise<Result<VenueCard[]>> {
  const { q, wardId, minPrice, maxPrice, date, startTime, lat, lng, radiusKm } = filter;
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

  const supabase = await createClient();
  // Điểm đánh giá của mọi sân đã duyệt (khoảng 50 dòng) lấy song song với truy vấn tìm sân
  const [{ data, error }, ratings] = await Promise.all([
    supabase.rpc("search_venues", {
    p_q: q?.trim().slice(0, 100) || null,
    p_ward_id: wardId ?? null,
    p_min_price: minPrice ?? null,
    p_max_price: maxPrice ?? null,
    p_date: date ?? null,
    p_start_time: startTime ?? null,
    p_lat: lat ?? null,
    p_lng: lng ?? null,
    p_radius_km: hasPoint ? Math.min(Math.max(radiusKm ?? 30, 1), 100) : null,
    }),
    ratingSummaries(),
  ]);
  if (error) return fail(500, "Không tải được danh sách sân");
  return ok(
    (data ?? []).map((row: Record<string, unknown>) => {
      const card = toCard(row);
      const rating = ratings.get(card.id);
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

/**
 * PB11 - Chi tiết một sân đã duyệt. Không trả về thông tin tài khoản nhận tiền.
 * React cache: trang chi tiết và getAvailability trong cùng request chỉ đọc cơ sở dữ liệu một lần.
 */
export const getVenueDetail = cache(async (id: number): Promise<Result<VenueDetail>> => {
  if (!Number.isInteger(id) || id <= 0) return fail(404, "Không tìm thấy sân");
  const supabase = await createClient();
  // Một truy vấn duy nhất: PostgREST nhúng bảng giá, ảnh và sân con theo khóa ngoại (RLS vẫn áp dụng cho từng bảng)
  const { data: venue } = await supabase
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
  if (!venue) return fail(404, "Không tìm thấy sân");

  const { wards, price_slots: prices, venue_images: images, courts, ...rest } = venue;
  const wardRow = wards as unknown as { name: string } | { name: string }[] | null;
  const wardName = Array.isArray(wardRow) ? wardRow[0]?.name : wardRow?.name;
  return ok({
    venue: {
      ...rest,
      latitude: Number(rest.latitude),
      longitude: Number(rest.longitude),
      open_time: hhmm(rest.open_time),
      close_time: hhmm(rest.close_time),
      ward_name: wardName ?? "",
    },
    prices: ((prices ?? []) as PriceSlot[]).map((p) => ({ ...p, start_time: hhmm(p.start_time), end_time: hhmm(p.end_time) })),
    images: (images ?? []) as VenueImage[],
    courts: (courts ?? []) as Court[],
  });
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

/** PB11 - Trạng thái từng khung giờ 60 phút của từng sân con trong một ngày. */
export async function getAvailability(venueId: number, date: string): Promise<Result<Availability>> {
  if (!isValidDate(date)) return fail(400, "Ngày không hợp lệ");
  const today = todayInVietnam();
  if (date < today) return fail(400, "Không xem được ngày đã qua");

  // Thông tin sân và các khung giờ đã có người đặt không phụ thuộc nhau: lấy song song
  const supabase = await createClient();
  const [detail, { data: taken, error }] = await Promise.all([
    getVenueDetail(venueId),
    supabase.rpc("venue_taken_slots", { p_venue_id: venueId, p_date: date }),
  ]);
  if (!detail.ok) return detail;
  const { venue, prices, courts } = detail.data;
  if (error) return fail(500, "Không tải được khung giờ");
  const takenMap = new Map<string, "held" | "booked">();
  for (const row of taken ?? []) takenMap.set(`${row.court_id}|${hhmm(row.start_time)}`, row.state);

  const openHour = Number(venue.open_time.slice(0, 2));
  const closeHour = Number(venue.close_time.slice(0, 2));
  const hours: string[] = [];
  for (let h = openHour; h < closeHour; h += 1) hours.push(`${String(h).padStart(2, "0")}:00`);
  const nowHour = currentHourInVietnam();

  return ok({
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
  });
}
