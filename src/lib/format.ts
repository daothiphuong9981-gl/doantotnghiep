const TIME_ZONE = "Asia/Ho_Chi_Minh";

/** 50000 -> "50.000 đ" */
export function formatVnd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;
}

/** "05:00:00" -> "05:00" */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function todayInVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

/** Giờ hiện tại theo giờ Việt Nam (0-23). */
export function currentHourInVietnam(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false }).format(now));
}

export function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Cộng số ngày vào một ngày dạng YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Thứ bảy, chủ nhật tính là cuối tuần. */
export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** "2026-10-17" -> { weekday: "T7", short: "17/10", full: "Thứ bảy, 17/10/2026" } */
export function describeDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const fullNames = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  return {
    weekday: WEEKDAY_LABELS[d.getUTCDay()],
    short: `${dd}/${mm}`,
    full: `${fullNames[d.getUTCDay()]}, ${dd}/${mm}/${d.getUTCFullYear()}`,
  };
}

/** Thời điểm (ISO) -> "19:24 15/10/2026" theo giờ Việt Nam. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("day")}/${get("month")}/${get("year")}`;
}

/** "19:00" -> "19:00 – 20:00" (mỗi khung giờ 60 phút). */
export function slotRange(start: string): string {
  const hour = Number(start.slice(0, 2));
  return `${start} – ${String(hour + 1).padStart(2, "0")}:00`;
}

/** Số giây -> "14:59". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Thứ hai và chủ nhật của tuần chứa ngày cho trước. */
export function weekRange(date: string): { from: string; to: string } {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = chủ nhật
  const from = addDays(date, day === 0 ? -6 : 1 - day);
  return { from, to: addDays(from, 6) };
}

/** Ngày đầu và ngày cuối của tháng chứa ngày cho trước. */
export function monthRange(date: string): { from: string; to: string } {
  const [year, month] = date.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${date.slice(0, 8)}01`, to: `${date.slice(0, 8)}${String(last).padStart(2, "0")}` };
}
