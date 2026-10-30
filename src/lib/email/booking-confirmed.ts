/**
 * Mẫu email "Xác nhận đặt sân" gửi người chơi khi chủ sân xác nhận đã nhận tiền.
 * Hàm thuần (không đọc biến môi trường, không gửi thư) để kiểm thử được độc lập: tests/email.test.mjs.
 * Dữ liệu lấy từ email_outbox.payload do trigger queue_booking_email (0011) chụp lúc xác nhận.
 */

export interface BookingEmailItem {
  court_name: string;
  booking_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  price: number;
}

export interface BookingEmailPayload {
  booking_id: number;
  code: string;
  player_name: string;
  venue_name: string;
  venue_address: string;
  venue_phone: string | null;
  total_amount: number;
  confirmed_at: string;
  items: BookingEmailItem[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const WEEKDAY = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Bỏ ký tự xuống dòng: tiêu đề thư không được chứa CR/LF (chống chèn header). */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function vnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;
}

/** "2026-11-14" -> "Thứ bảy, 14/11/2026" */
export function vnDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** "19:00" -> "19:00 - 20:00" (mỗi khung giờ 60 phút) */
export function slotRange(start: string): string {
  const hour = Number(start.slice(0, 2));
  return `${start} - ${String((hour + 1) % 24).padStart(2, "0")}:${start.slice(3, 5)}`;
}

function vnDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")} ngày ${get("day")}/${get("month")}/${get("year")}`;
}

export function renderBookingConfirmed(p: BookingEmailPayload, appUrl: string): RenderedEmail {
  const link = `${appUrl.replace(/\/+$/, "")}/bookings/${p.booking_id}`;
  const subject = oneLine(`Xác nhận đặt sân ${p.code} - ${p.venue_name}`);
  const greeting = p.player_name ? `Chào ${p.player_name},` : "Chào bạn,";
  const intro = `Chủ sân ${p.venue_name} đã xác nhận nhận tiền cho lượt đặt ${p.code}. Lịch chơi của bạn đã được giữ chắc chắn.`;

  const rows = p.items
    .map(
      (i) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(vnDate(i.booking_date))}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(slotRange(i.start_time))}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(i.court_name)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${escapeHtml(vnd(i.price))}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="vi"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
      <p style="margin:0 0 4px;color:#15803d;font-weight:bold;font-size:13px">CẦU LÔNG ĐÀ NẴNG</p>
      <h1 style="margin:0 0 16px;font-size:20px">Đặt sân thành công · ${escapeHtml(p.code)}</h1>
      <p style="margin:0 0 8px">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 16px">${escapeHtml(intro)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
        <tr><td style="padding:4px 0;color:#64748b;width:120px">Sân</td><td style="padding:4px 0;font-weight:bold">${escapeHtml(p.venue_name)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Địa chỉ</td><td style="padding:4px 0">${escapeHtml(p.venue_address)}</td></tr>
        ${p.venue_phone ? `<tr><td style="padding:4px 0;color:#64748b">Điện thoại sân</td><td style="padding:4px 0">${escapeHtml(p.venue_phone)}</td></tr>` : ""}
        <tr><td style="padding:4px 0;color:#64748b">Xác nhận lúc</td><td style="padding:4px 0">${escapeHtml(vnDateTime(p.confirmed_at))}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="background:#f8fafc;text-align:left">
          <th style="padding:8px">Ngày</th><th style="padding:8px">Giờ</th><th style="padding:8px">Sân con</th><th style="padding:8px;text-align:right">Giá</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="3" style="padding:8px;font-weight:bold">Tổng tiền đã thanh toán</td>
          <td style="padding:8px;text-align:right;font-weight:bold;color:#15803d">${escapeHtml(vnd(p.total_amount))}</td>
        </tr></tfoot>
      </table>
      <p style="margin:24px 0">
        <a href="${escapeHtml(link)}" style="background:#15803d;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold">Xem lượt đặt</a>
      </p>
      <p style="margin:0;color:#64748b;font-size:13px">Cần đổi lịch hoặc hỏi thêm? Trả lời thư này để liên hệ trực tiếp chủ sân.</p>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:12px">Thư tự động từ hệ thống Cầu Lông Đà Nẵng.</p>
  </div>
</body></html>`;

  const text = [
    greeting,
    "",
    intro,
    "",
    `Sân: ${p.venue_name}`,
    `Địa chỉ: ${p.venue_address}`,
    ...(p.venue_phone ? [`Điện thoại sân: ${p.venue_phone}`] : []),
    `Xác nhận lúc: ${vnDateTime(p.confirmed_at)}`,
    "",
    ...p.items.map((i) => `- ${vnDate(i.booking_date)}, ${slotRange(i.start_time)}, ${i.court_name}: ${vnd(i.price)}`),
    `Tổng tiền đã thanh toán: ${vnd(p.total_amount)}`,
    "",
    `Xem lượt đặt: ${link}`,
    "Trả lời thư này để liên hệ trực tiếp chủ sân.",
  ].join("\n");

  return { subject, html, text };
}
