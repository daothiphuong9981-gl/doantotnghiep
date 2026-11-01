/**
 * Trợ lý AI tìm sân - phần xử lý thuần (không phụ thuộc Next.js, Supabase):
 * dựng yêu cầu gửi Gemini, kiểm tra hợp lệ bộ lọc mô hình trả về, quyết định bước tiếp theo.
 * Tách riêng để kiểm thử được bằng Node (tests/ai).
 */

export interface AiWard {
  id: number;
  name: string;
}

/** Bộ lọc đã được máy chủ kiểm tra hợp lệ. Trường không có điều kiện thì là null. */
export interface AiFilter {
  ward_id: number | null;
  ward_name: string | null;
  keyword: string | null;
  date: string | null; // YYYY-MM-DD
  time_from: string | null; // HH:00
  time_to: string | null; // HH:00, không bao gồm
  min_price: number | null;
  max_price: number | null;
  near_me: boolean;
  radius_km: number | null;
  /** Số sân con cần trống cùng một lúc (ví dụ "cần 8 sân để tổ chức giải"); null nếu không nêu */
  min_courts: number | null;
  /** Số giờ liên tục cần dùng trên cùng các sân con (ví dụ "từ 7h đến 9h" = 2, "chơi 3 tiếng" = 3); null nếu không nêu */
  consecutive_hours: number | null;
}

export const EMPTY_FILTER: AiFilter = {
  ward_id: null,
  ward_name: null,
  keyword: null,
  date: null,
  time_from: null,
  time_to: null,
  min_price: null,
  max_price: null,
  near_me: false,
  radius_km: null,
  min_courts: null,
  consecutive_hours: null,
};

/** Kết quả thô mô hình trả về (chưa tin được). */
export interface RawExtraction {
  in_scope?: unknown;
  ward_name?: unknown;
  keyword?: unknown;
  date?: unknown;
  time_from?: unknown;
  time_to?: unknown;
  min_price?: unknown;
  max_price?: unknown;
  near_me?: unknown;
  radius_km?: unknown;
  min_courts?: unknown;
  consecutive_hours?: unknown;
  cheaper?: unknown;
}

const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

export const unaccent = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();

/** Lược đồ đầu ra có cấu trúc (định dạng responseSchema của Gemini API). */
export const EXTRACTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    in_scope: { type: "BOOLEAN", description: "true nếu câu hỏi liên quan tới tìm hoặc đặt sân cầu lông ở Đà Nẵng" },
    ward_name: { type: "STRING", nullable: true, description: "Tên phường/xã, chép đúng một tên trong danh sách được cung cấp" },
    keyword: { type: "STRING", nullable: true, description: "Tên sân hoặc tên đường người dùng nhắc tới" },
    date: { type: "STRING", nullable: true, description: "Ngày chơi dạng YYYY-MM-DD" },
    time_from: { type: "STRING", nullable: true, description: "Giờ bắt đầu dạng HH:00" },
    time_to: { type: "STRING", nullable: true, description: "Giờ kết thúc dạng HH:00" },
    min_price: { type: "INTEGER", nullable: true, description: "Giá thấp nhất mỗi giờ, đơn vị đồng" },
    max_price: { type: "INTEGER", nullable: true, description: "Giá cao nhất mỗi giờ, đơn vị đồng" },
    near_me: { type: "BOOLEAN", description: "true nếu người dùng muốn sân gần vị trí của họ" },
    radius_km: { type: "NUMBER", nullable: true, description: "Bán kính tìm kiếm tính bằng km nếu người dùng nêu" },
    min_courts: { type: "INTEGER", nullable: true, description: "Số sân con người dùng cần trống cùng lúc, chỉ khi có con số (ví dụ 'cần 8 sân', 'thuê 4 sân')" },
    consecutive_hours: {
      type: "INTEGER",
      nullable: true,
      description: "Số giờ liên tục cần chơi: bằng độ dài khung khi người dùng nêu rõ giờ bắt đầu và kết thúc ('từ 7h đến 9h' = 2), hoặc thời lượng nêu ra ('chơi 2 tiếng' = 2)",
    },
    cheaper: { type: "BOOLEAN", description: "true nếu người dùng muốn rẻ hơn kết quả trước mà không nêu con số" },
  },
  required: ["in_scope", "near_me", "cheaper"],
} as const;

/**
 * Lời nhắc hệ thống cho bước 1 (hiểu câu hỏi). Chỉ chứa ngày hiện tại, danh mục phường/xã và bộ lọc của lượt trước;
 * không có họ tên, email, số điện thoại của người dùng.
 */
export function buildExtractionPrompt(params: { today: string; currentHour: number; wards: AiWard[]; previous: AiFilter | null; history: string[] }): string {
  const { today, currentHour, wards, previous, history } = params;
  const calendar = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i);
    return `${d} = ${weekdayOf(d)}${i === 0 ? " (hôm nay)" : i === 1 ? " (ngày mai)" : ""}`;
  }).join("\n");
  return [
    "Bạn là bộ phân tích câu hỏi cho website đặt sân cầu lông tại thành phố Đà Nẵng.",
    "Nhiệm vụ: đọc câu hỏi tiếng Việt của người chơi và trả về MỘT đối tượng JSON mô tả bộ lọc tìm sân. Không trả lời người dùng, không thêm chữ nào ngoài JSON.",
    "",
    `Hôm nay là ${weekdayOf(today)}, ${today}; bây giờ khoảng ${currentHour} giờ (giờ Việt Nam).`,
    "Lịch 14 ngày tới (dùng để đổi 'thứ bảy này', 'cuối tuần', 'ngày mai' thành ngày cụ thể):",
    calendar,
    "",
    "Danh mục phường/xã hợp lệ (ward_name phải chép đúng một tên dưới đây, nếu người dùng nhắc khu vực không có trong danh sách thì để null):",
    wards.map((w) => w.name).join("; "),
    "",
    "Quy ước:",
    "- in_scope = false nếu câu hỏi không liên quan tới tìm hoặc đặt sân cầu lông (ví dụ nhờ viết văn, hỏi thời tiết, lập trình). Khi đó các trường khác để null.",
    "- Buổi sáng = 05:00 đến 11:00; buổi trưa = 11:00 đến 13:00; buổi chiều = 13:00 đến 18:00; buổi tối = 18:00 đến 22:00. 'Lúc 7 giờ tối' = 19:00 đến 20:00.",
    "- Giá: '80 nghìn', '80k', '80 ngàn' = 80000 đồng mỗi giờ. 'dưới X' đặt max_price = X; 'trên X' đặt min_price = X; 'tầm X' đặt max_price = X.",
    "- 'gần tôi', 'gần đây', 'gần chỗ tôi' đặt near_me = true. 'gần Hải Châu' là khu vực: đặt ward_name, không đặt near_me.",
    "- 'cuối tuần' không nói rõ ngày thì chọn thứ bảy gần nhất.",
    "- Số sân: 'còn trống 8 sân', 'cần 4 sân', 'thuê 6 sân để tổ chức giải' đặt min_courts = con số đó. Chỉ đặt khi có con số; 'sân nào còn trống' (không có số) thì để null.",
    "- Giờ liên tục: người dùng nêu rõ giờ bắt đầu và kết thúc ('từ 7h đến 9h', '17h-19h') thì consecutive_hours = số giờ của khung đó (ở đây là 2);",
    "  nêu thời lượng ('chơi 2 tiếng tối mai', 'đánh liên tục 3 giờ') thì consecutive_hours = thời lượng và time_from/time_to là cả buổi. Chỉ nói buổi chung chung hoặc một giờ ('lúc 7 giờ tối') thì để null.",
    "- Chỉ điền điều kiện người dùng thật sự nêu. Không tự suy đoán ngày, giờ, giá.",
    "",
    "Hội thoại nhiều lượt: bộ lọc của lượt trước được cho bên dưới. Hãy trả về bộ lọc ĐẦY ĐỦ sau khi áp dụng câu hỏi mới:",
    "giữ nguyên mọi điều kiện cũ mà người dùng không nhắc tới, chỉ thay phần được nhắc ('đổi sang chủ nhật' chỉ đổi date).",
    "Nếu người dùng nói 'rẻ hơn', 'rẻ hơn nữa' mà không nêu con số: giữ nguyên các điều kiện và đặt cheaper = true.",
    "Nếu câu hỏi mới rõ ràng là một lượt tìm khác hẳn thì bỏ điều kiện cũ.",
    "",
    `Bộ lọc lượt trước: ${previous ? JSON.stringify(toModelFilter(previous)) : "chưa có"}`,
    history.length ? `Các câu hỏi trước trong phiên: ${history.map((h) => JSON.stringify(h)).join(", ")}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Dạng bộ lọc đưa cho mô hình (không kèm mã nội bộ). */
function toModelFilter(f: AiFilter) {
  return {
    ward_name: f.ward_name,
    keyword: f.keyword,
    date: f.date,
    time_from: f.time_from,
    time_to: f.time_to,
    min_price: f.min_price,
    max_price: f.max_price,
    near_me: f.near_me,
    radius_km: f.radius_km,
    min_courts: f.min_courts,
    consecutive_hours: f.consecutive_hours,
  };
}

const str = (value: unknown): string | null => (typeof value === "string" && value.trim() && value.trim().toLowerCase() !== "null" ? value.trim() : null);
const int = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
};
/** "18:00", "18h", "18" -> 18; không hợp lệ -> null */
const hour = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 24) return value;
  const s = str(value);
  if (!s) return null;
  const m = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*h?$/i.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h <= 24 ? h : null;
};
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Tìm phường/xã theo tên, không phân biệt dấu, có hoặc không có chữ "Phường", "Xã". */
export function matchWard(name: string, wards: AiWard[]): AiWard | null {
  const strip = (s: string) => unaccent(s).replace(/^(phuong|xa|dac khu|quan|huyen)\s+/, "");
  const target = strip(name);
  if (!target) return null;
  return wards.find((w) => unaccent(w.name) === unaccent(name)) ?? wards.find((w) => strip(w.name) === target) ?? null;
}

export const MAX_ADVANCE_DAYS = 30;

/**
 * Kiểm tra hợp lệ bộ lọc mô hình trả về. Giá trị sai (phường không tồn tại, ngày đã qua, giờ vô lý, giá âm...)
 * bị bỏ và ghi vào `dropped` để trợ lý hỏi lại, không làm phát sinh lỗi.
 */
export function sanitizeFilter(
  raw: RawExtraction,
  ctx: { today: string; currentHour: number; wards: AiWard[]; hasLocation: boolean },
): { filter: AiFilter; dropped: string[]; cheaper: boolean; inScope: boolean } {
  const dropped: string[] = [];
  const filter: AiFilter = { ...EMPTY_FILTER };
  const inScope = raw.in_scope !== false;

  const wardName = str(raw.ward_name);
  if (wardName) {
    const ward = matchWard(wardName, ctx.wards);
    if (ward) {
      filter.ward_id = ward.id;
      filter.ward_name = ward.name;
    } else dropped.push("ward");
  }

  const keyword = str(raw.keyword);
  if (keyword) filter.keyword = keyword.slice(0, 60);

  const date = str(raw.date);
  if (date) {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
    if (valid && date >= ctx.today && date <= addDays(ctx.today, MAX_ADVANCE_DAYS)) filter.date = date;
    else dropped.push("date");
  }

  let from = hour(raw.time_from);
  let to = hour(raw.time_to);
  if (from !== null || to !== null) {
    if (from === null && to !== null) from = to - 1;
    if (to === null && from !== null) to = from + 1;
    // Chỉ xét trong khung giờ sân có thể mở cửa
    from = Math.max(from as number, 5);
    to = Math.min(to as number, 23);
    if (filter.date === ctx.today) from = Math.max(from, ctx.currentHour + 1);
    if (from < to) {
      filter.time_from = hh(from);
      filter.time_to = hh(to);
    } else dropped.push("time");
  }

  const min = int(raw.min_price);
  const max = int(raw.max_price);
  if (min !== null) {
    if (min > 0 && min <= 10_000_000) filter.min_price = min;
    else if (min !== 0) dropped.push("price");
  }
  if (max !== null) {
    if (max > 0 && max <= 10_000_000) filter.max_price = max;
    else dropped.push("price");
  }
  if (filter.min_price !== null && filter.max_price !== null && filter.min_price > filter.max_price) {
    filter.min_price = null;
    filter.max_price = null;
    dropped.push("price");
  }

  if (raw.near_me === true) {
    if (ctx.hasLocation) filter.near_me = true;
    else dropped.push("location");
  }
  const radius = typeof raw.radius_km === "number" ? raw.radius_km : null;
  if (radius !== null && filter.near_me) filter.radius_km = Math.min(Math.max(radius, 1), 50);

  const courts = int(raw.min_courts);
  if (courts !== null) {
    // 1 sân là điều kiện mặc định của mọi lượt tìm nên không cần lưu; tối đa 50 (giới hạn số ô mỗi lượt đặt)
    if (courts >= 2 && courts <= 50) filter.min_courts = courts;
    else if (courts !== 1) dropped.push("courts");
  }

  const run = int(raw.consecutive_hours);
  if (run !== null && run >= 2) {
    if (run > 6) dropped.push("duration");
    else if (filter.time_from && filter.time_to) {
      const span = Number(filter.time_to.slice(0, 2)) - Number(filter.time_from.slice(0, 2));
      // Khung giờ hôm nay có thể đã bị cắt bớt giờ đã qua: khung còn lại ngắn hơn thời lượng thì không xếp được
      if (run <= span) filter.consecutive_hours = run;
      else dropped.push("duration");
    } else filter.consecutive_hours = run;
  }

  return { filter, dropped: [...new Set(dropped)], cheaper: raw.cheaper === true, inScope };
}

export type Decision = { kind: "reject" } | { kind: "ask"; missing: string[] } | { kind: "search" };

/** Quyết định bước tiếp theo sau khi có bộ lọc hợp lệ. */
export function decide(filter: AiFilter, dropped: string[], inScope: boolean): Decision {
  if (!inScope) return { kind: "reject" };
  const hasPlace = filter.ward_id !== null || filter.keyword !== null || filter.near_me;
  const hasAny =
    hasPlace || filter.date !== null || filter.time_from !== null || filter.min_price !== null || filter.max_price !== null || filter.min_courts !== null;
  const missing: string[] = [];
  // Giá trị mô hình đưa ra nhưng không hợp lệ: hỏi lại đúng phần đó
  if (dropped.includes("date")) missing.push("date");
  if (dropped.includes("ward")) missing.push("ward");
  if (dropped.includes("location")) missing.push("location");
  if (dropped.includes("time")) missing.push("time");
  if (dropped.includes("courts")) missing.push("courts");
  if (dropped.includes("duration")) missing.push("duration");
  if (!hasAny) {
    if (!missing.includes("date")) missing.push("date");
    if (!missing.includes("ward") && !missing.includes("location")) missing.push("ward");
    return { kind: "ask", missing };
  }
  // Có khung giờ mà chưa có ngày: không biết kiểm tra sân trống ngày nào
  if (filter.time_from !== null && filter.date === null && !missing.includes("date")) missing.push("date");
  // Cần giờ liên tục thì phải biết ngày và khung giờ để kiểm tra từng sân con
  if (filter.consecutive_hours !== null) {
    if (filter.date === null && !missing.includes("date")) missing.push("date");
    if (filter.time_from === null && !missing.includes("time")) missing.push("time");
  }
  return missing.length > 0 ? { kind: "ask", missing } : { kind: "search" };
}

const ASK_TEXT: Record<string, string> = {
  date: "bạn muốn chơi ngày nào (ví dụ: tối nay, thứ bảy này)",
  ward: "bạn muốn tìm ở khu vực nào (ví dụ: phường Hải Châu, Sơn Trà)",
  location: "bạn hãy bấm “Dùng vị trí của tôi” để mình tìm sân gần bạn, hoặc cho mình biết phường/xã",
  time: "bạn muốn chơi khoảng mấy giờ",
  courts: "bạn cần bao nhiêu sân cùng lúc (từ 2 đến 50 sân)",
  duration: "bạn cần chơi liên tục mấy giờ (tối đa 6 giờ, không dài hơn khung giờ bạn chọn)",
};

/** Câu hỏi lại của trợ lý (văn bản cố định, không do mô hình tạo). */
export function askText(missing: string[], dropped: string[]): string {
  const parts = missing.map((m) => ASK_TEXT[m]).filter(Boolean);
  const note: string[] = [];
  if (dropped.includes("date")) note.push("ngày bạn nêu đã qua hoặc quá xa");
  if (dropped.includes("ward")) note.push("mình chưa nhận ra khu vực bạn nêu trong danh mục phường, xã của Đà Nẵng");
  if (dropped.includes("time")) note.push("khung giờ bạn nêu không còn hoặc không hợp lệ");
  if (dropped.includes("courts")) note.push("số sân bạn nêu không hợp lệ");
  if (dropped.includes("duration")) note.push("thời lượng bạn nêu dài hơn khung giờ còn lại hoặc quá 6 giờ");
  const prefix = note.length ? `Mình chưa dùng được một phần thông tin: ${note.join("; ")}. ` : "";
  return `${prefix}Để tìm sân phù hợp, cho mình biết thêm: ${parts.join("; ")}.`;
}

export const REJECT_TEXT =
  "Mình là trợ lý tìm sân cầu lông ở Đà Nẵng nên chỉ hỗ trợ được việc tìm và đặt sân. Bạn thử hỏi kiểu: “Tìm sân ở Hải Châu tối thứ bảy dưới 80 nghìn một giờ” nhé.";

/** Áp dụng "rẻ hơn": có giá tối đa thì giảm 20%; chưa có thì lấy nửa rẻ hơn của kết quả hiện tại. */
export function cheaperMaxPrice(current: number | null, resultMinPrices: number[]): number | null {
  if (current !== null) return Math.max(10_000, Math.floor((current * 0.8) / 5_000) * 5_000);
  const prices = resultMinPrices.filter((p) => p > 0).sort((a, b) => a - b);
  if (prices.length <= 1) return null;
  return prices[Math.floor((prices.length - 1) / 2)];
}

/** Các giờ bắt đầu trong khung [time_from, time_to), tối đa 6 giờ để giới hạn số truy vấn. */
export function hoursOf(filter: AiFilter): string[] {
  if (!filter.time_from || !filter.time_to) return [];
  const from = Number(filter.time_from.slice(0, 2));
  const to = Number(filter.time_to.slice(0, 2));
  return Array.from({ length: Math.min(to - from, 6) }, (_, i) => hh(from + i));
}

/**
 * Gộp kết quả tìm theo từng giờ thành danh sách cơ sở kèm các giờ còn đủ sân trống.
 * Một giờ chỉ được tính khi số sân con trống ở giờ đó đạt min_courts (mặc định 1); cơ sở có tổng số sân con
 * ít hơn min_courts bị bỏ. free_courts là số sân trống ít nhất trong các giờ được giữ, để câu trả lời không phóng đại.
 * Giữ thứ tự xuất hiện đầu tiên (khoảng cách hoặc tên).
 */
export function mergeFreeHours<T extends { id: number; court_count: number; free_courts?: number | null }>(
  hours: string[],
  perHour: (T[] | null)[],
  minCourts: number | null,
): (T & { free_hours: string[]; free_courts: number | null })[] {
  const need = minCourts ?? 1;
  const merged = new Map<number, T & { free_hours: string[]; free_courts: number | null }>();
  perHour.forEach((venues, i) => {
    for (const venue of venues ?? []) {
      const free = venue.free_courts ?? venue.court_count;
      if (venue.court_count < need || free < need) continue;
      const current = merged.get(venue.id) ?? { ...venue, free_hours: [], free_courts: free };
      current.free_hours.push(hours[i]);
      current.free_courts = Math.min(current.free_courts ?? free, free);
      merged.set(venue.id, current);
    }
  });
  return [...merged.values()];
}

/** Trạng thái các khung giờ của một sân con (lấy từ getAvailability). */
export interface CourtSlots {
  name: string;
  slots: { start_time: string; state: string }[];
}

/** Khung giờ liên tục tìm được: các sân con trống suốt từ start tới end. */
export interface RunWindow {
  start: string;
  end: string;
  courts: string[];
}

/**
 * Tìm các khung `length` giờ liên tục trong `hours` (các giờ bắt đầu người chơi hỏi, liền nhau) mà có ít nhất `need` sân con
 * trống SUỐT cả khung. Bảo đảm người chơi giữ được cùng các sân con, không phải đổi sân giữa chừng.
 */
export function findRunWindows(courts: CourtSlots[], hours: string[], need: number, length: number): RunWindow[] {
  const windows: RunWindow[] = [];
  for (let i = 0; i + length <= hours.length; i += 1) {
    const span = hours.slice(i, i + length);
    const free = courts.filter((court) => span.every((h) => court.slots.find((s) => s.start_time === h)?.state === "available"));
    if (free.length >= need) windows.push({ start: span[0], end: hh(Number(span[length - 1].slice(0, 2)) + 1), courts: free.map((c) => c.name) });
  }
  return windows;
}

/** Điều kiện cần (theo số đếm từng giờ): có `length` giờ liền nhau đều nằm trong danh sách giờ còn đủ sân. */
export function hasConsecutive(freeHours: string[], hours: string[], length: number): boolean {
  let streak = 0;
  for (const h of hours) {
    streak = freeHours.includes(h) ? streak + 1 : 0;
    if (streak >= length) return true;
  }
  return false;
}

/** Cảnh báo khi số ô cần đặt (số sân × số giờ) vượt giới hạn một lượt đặt của cơ sở (max_slots_per_booking). */
export function slotLimitNote(venues: { name: string; max_slots: number | null }[], courts: number, hours: number): string {
  const cells = courts * hours;
  const over = venues.filter((v) => v.max_slots !== null && cells > v.max_slots);
  if (over.length === 0) return "";
  const parts = over.map((v) => `${v.name} cho đặt tối đa ${v.max_slots} ô mỗi lượt`);
  const turns = Math.ceil(cells / Math.min(...over.map((v) => v.max_slots as number)));
  return ` Lưu ý: ${courts} sân × ${hours} giờ = ${cells} ô; ${parts.join(", ")} nên bạn cần chia thành ${turns} lượt đặt.`;
}

/** Mô tả bộ lọc bằng lời, dùng trong câu trả lời khi không có kết quả. */
export function describeFilter(f: AiFilter): string {
  const parts: string[] = [];
  if (f.keyword) parts.push(`tên hoặc địa chỉ có “${f.keyword}”`);
  if (f.ward_name) parts.push(`ở ${f.ward_name}`);
  if (f.near_me) parts.push(`gần bạn${f.radius_km ? ` trong ${f.radius_km} km` : ""}`);
  if (f.date) parts.push(`ngày ${f.date.slice(8)}/${f.date.slice(5, 7)}`);
  if (f.time_from && f.time_to) parts.push(`từ ${f.time_from} đến ${f.time_to}`);
  if (f.min_courts) parts.push(`còn ít nhất ${f.min_courts} sân trống cùng lúc`);
  if (f.consecutive_hours) parts.push(`liên tục ${f.consecutive_hours} giờ trên cùng sân`);
  if (f.min_price) parts.push(`giá từ ${f.min_price.toLocaleString("vi-VN")} đ`);
  if (f.max_price) parts.push(`giá đến ${f.max_price.toLocaleString("vi-VN")} đ`);
  return parts.join(", ");
}

export interface ReplyVenue {
  name: string;
  address: string;
  ward: string;
  min_price: number | null;
  court_count: number;
  distance_km: number | null;
  free_hours: string[];
  /** Số sân con trống ít nhất trong các giờ còn trống (chỉ có khi lọc theo ngày, giờ) */
  free_courts: number | null;
}

/** Lời nhắc cho bước 2 (diễn đạt kết quả). Mô hình chỉ được dùng dữ liệu trong danh sách. */
export function buildReplyPrompt(filter: AiFilter, venues: ReplyVenue[]): { system: string; user: string } {
  return {
    system: [
      "Bạn là trợ lý tìm sân cầu lông ở Đà Nẵng. Viết câu trả lời ngắn gọn bằng tiếng Việt, thân thiện, xưng 'mình', gọi người dùng là 'bạn'.",
      "CHỈ được dùng thông tin trong DỮ LIỆU SÂN bên dưới. Không được thêm tên sân, địa chỉ, giá, khung giờ, tiện ích, đánh giá nào không có trong dữ liệu.",
      "Nêu số sân tìm được, rồi giới thiệu từng sân trong một câu: tên, khu vực, giá từ bao nhiêu mỗi giờ, giờ còn trống (nếu có), khoảng cách (nếu có).",
      "court_count là tổng số sân con của cơ sở; free_courts là số sân con còn trống trong các giờ đã nêu. Nếu điều kiện tìm có số sân cần cùng lúc thì nói rõ cơ sở còn trống bao nhiêu sân (free_courts).",
      "free_hours có thể là khung liên tục dạng '07:00–09:00': nghĩa là có free_courts sân con trống suốt cả khung đó.",
      "Kết thúc bằng một câu gợi ý người dùng có thể hỏi tiếp để điều chỉnh (đổi ngày, rẻ hơn, khu vực khác). Tối đa 120 từ. Không dùng markdown.",
    ].join("\n"),
    user: `ĐIỀU KIỆN TÌM: ${describeFilter(filter) || "không có điều kiện cụ thể"}\nDỮ LIỆU SÂN (JSON): ${JSON.stringify(venues)}`,
  };
}

/** Câu trả lời dự phòng khi bước 2 lỗi: liệt kê trực tiếp từ dữ liệu. */
export function templateReply(venues: ReplyVenue[]): string {
  const lines = venues.map((v) => {
    const bits = [`${v.name} (${v.ward})`];
    if (v.min_price !== null) bits.push(`giá từ ${v.min_price.toLocaleString("vi-VN")} đ/giờ`);
    if (v.free_hours.length) bits.push(`còn trống lúc ${v.free_hours.join(", ")}`);
    if (v.free_courts !== null) bits.push(`còn ${v.free_courts}/${v.court_count} sân trống`);
    if (v.distance_km !== null) bits.push(`cách bạn ${v.distance_km.toLocaleString("vi-VN")} km`);
    return bits.join(", ");
  });
  return `Mình tìm được ${venues.length} sân phù hợp: ${lines.join("; ")}. Bạn có thể hỏi tiếp để đổi ngày, khu vực hoặc tìm giá rẻ hơn.`;
}

export function noResultReply(filter: AiFilter): string {
  const hints: string[] = [];
  if (filter.time_from) hints.push("đổi khung giờ");
  if (filter.date) hints.push("chọn ngày khác");
  if (filter.max_price) hints.push("nâng mức giá");
  if (filter.ward_id) hints.push("mở rộng sang phường, xã lân cận");
  if (filter.near_me) hints.push("tăng bán kính tìm kiếm");
  if (filter.keyword) hints.push("bỏ từ khóa tên sân");
  if (filter.min_courts) hints.push("giảm số sân cần cùng lúc hoặc chia ra nhiều cơ sở");
  if (filter.consecutive_hours) hints.push("rút ngắn thời lượng hoặc mở rộng khung giờ");
  const condition = describeFilter(filter);
  return `Hiện không có sân nào phù hợp${condition ? ` với điều kiện ${condition}` : ""}. Bạn thử ${hints.length ? hints.join(", hoặc ") : "nới bớt điều kiện"} nhé.`;
}
