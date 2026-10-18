import { addDays } from "@/lib/format";
import type { VenueFilter } from "@/lib/services/venues";
import type { VenueCard } from "@/lib/types";

/** Bộ lọc tìm sân ở trang chủ, giữ nguyên dạng chuỗi như trên ô nhập và trên URL. */
export interface SearchFilter {
  q: string;
  wardId: string;
  price: string;
  date: string;
  startTime: string;
}

export const EMPTY_FILTER: SearchFilter = { q: "", wardId: "", price: "", date: "", startTime: "" };

export const PRICE_RANGES = [
  { value: "", label: "Mọi mức giá" },
  { value: "0-60000", label: "Dưới 60.000 đ/giờ" },
  { value: "0-100000", label: "Dưới 100.000 đ/giờ" },
  { value: "60000-100000", label: "60.000 – 100.000 đ/giờ" },
  { value: "100000-", label: "Trên 100.000 đ/giờ" },
];

const PRICE_VALUES = new Set(PRICE_RANGES.map((r) => r.value));

/** Đọc bộ lọc từ query string (?q=&ward_id=&price=&date=&time=), bỏ qua giá trị lạ. */
export function filterFromParams(params: Record<string, string | string[] | undefined>): SearchFilter {
  const get = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  const wardId = /^\d{1,3}$/.test(get("ward_id")) ? get("ward_id") : "";
  const price = PRICE_VALUES.has(get("price")) ? get("price") : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(get("date")) ? get("date") : "";
  const startTime = /^([01]\d|2[0-3]):00$/.test(get("time")) ? get("time") : "";
  return { q: get("q").slice(0, 100), wardId, price, date: date && startTime ? date : "", startTime: date && startTime ? startTime : "" };
}

/** Bộ lọc -> query string của trang chủ (để chia sẻ, quay lại vẫn giữ kết quả). Không đưa vị trí người dùng lên URL. */
export function filterToSearch(filter: SearchFilter): string {
  const params = new URLSearchParams();
  if (filter.q.trim()) params.set("q", filter.q.trim());
  if (filter.wardId) params.set("ward_id", filter.wardId);
  if (filter.price) params.set("price", filter.price);
  if (filter.date && filter.startTime) {
    params.set("date", filter.date);
    params.set("time", filter.startTime);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Bộ lọc -> tham số cho tầng dịch vụ listVenues. */
export function filterToQuery(filter: SearchFilter, position: [number, number] | null): VenueFilter {
  const [min, max] = filter.price.split("-");
  const hasTime = Boolean(filter.date && filter.startTime);
  return {
    q: filter.q.trim() || undefined,
    wardId: filter.wardId ? Number(filter.wardId) : undefined,
    minPrice: min && min !== "0" ? Number(min) : undefined,
    maxPrice: max ? Number(max) : undefined,
    date: hasTime ? filter.date : undefined,
    startTime: hasTime ? filter.startTime : undefined,
    lat: position?.[0],
    lng: position?.[1],
    radiusKm: position ? 50 : undefined,
  };
}

/** Bộ lọc -> query string cho GET /api/venues. */
export function filterToApiParams(filter: SearchFilter, position: [number, number] | null): URLSearchParams {
  const query = filterToQuery(filter, position);
  const params = new URLSearchParams();
  const pairs: [string, string | number | undefined][] = [
    ["q", query.q],
    ["ward_id", query.wardId],
    ["min_price", query.minPrice],
    ["max_price", query.maxPrice],
    ["date", query.date],
    ["start_time", query.startTime],
    ["lat", query.lat],
    ["lng", query.lng],
    ["radius_km", query.radiusKm],
  ];
  for (const [key, value] of pairs) if (value !== undefined) params.set(key, String(value));
  return params;
}

export const sameFilter = (a: SearchFilter, b: SearchFilter) =>
  a.q.trim() === b.q.trim() && a.wardId === b.wardId && a.price === b.price && a.date === b.date && a.startTime === b.startTime;

/** Khung giờ của chip "Trống tối nay": 19:00 hôm nay, nếu đã qua thì 19:00 ngày mai. */
export function tonightSlot(today: string, currentHour: number) {
  return currentHour < 19 ? { date: today, startTime: "19:00", label: "Trống tối nay 19:00" } : { date: addDays(today, 1), startTime: "19:00", label: "Trống tối mai 19:00" };
}

/** Khung giờ của chip "Trống giờ tới": giờ tròn kế tiếp; sau 22:00 thì 06:00 sáng mai. */
export function nextHourSlot(today: string, currentHour: number) {
  if (currentHour >= 22) return { date: addDays(today, 1), startTime: "06:00", label: "Trống sáng mai 06:00" };
  const hour = `${String(Math.max(currentHour + 1, 5)).padStart(2, "0")}:00`;
  return { date: today, startTime: hour, label: `Trống lúc ${hour}` };
}

export type SortKey = "relevance" | "distance" | "price" | "free";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Phù hợp nhất" },
  { value: "distance", label: "Gần nhất" },
  { value: "price", label: "Giá thấp nhất" },
  { value: "free", label: "Nhiều sân trống nhất" },
];

/** Sắp xếp kết quả ngay trên trình duyệt; "Phù hợp nhất" giữ nguyên thứ tự máy chủ trả về. */
export function sortVenues(venues: VenueCard[], sort: SortKey): VenueCard[] {
  if (sort === "relevance") return venues;
  const last = (n: number | null | undefined, desc = false) => (n === null || n === undefined ? Infinity : desc ? -n : n);
  const key = (v: VenueCard) =>
    sort === "distance" ? last(v.distance_km) : sort === "price" ? last(v.min_price) : last(v.free_courts ?? v.court_count, true);
  return [...venues].sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name, "vi"));
}

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export const inBounds = (v: { latitude: number; longitude: number }, b: Bounds) =>
  v.latitude >= b.south && v.latitude <= b.north && v.longitude >= b.west && v.longitude <= b.east;

/**
 * Thời gian đi xe máy ước tính trong nội thành: đường thực tế dài hơn đường chim bay khoảng 1,3 lần,
 * tốc độ trung bình khoảng 25 km/h. Chỉ để tham khảo, không phải dữ liệu chỉ đường.
 */
export function motorbikeMinutes(distanceKm: number): number {
  return Math.max(1, Math.round(((distanceKm * 1.3) / 25) * 60));
}

/**
 * Liên kết chỉ đường bằng xe máy trên Google Maps (chỉ là liên kết, không lấy dữ liệu của Google).
 * Không gửi vị trí người dùng: Google Maps tự lấy điểm xuất phát là vị trí hiện tại.
 */
export function directionsUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({ api: "1", destination: `${lat},${lng}`, travelmode: "two-wheeler" });
  return `https://www.google.com/maps/dir/?${params}`;
}
