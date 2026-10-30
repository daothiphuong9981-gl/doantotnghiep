// Kiểm thử mẫu email xác nhận đặt sân (src/lib/email/booking-confirmed.ts). Cần Node 22.18 trở lên (chạy trực tiếp tệp .ts).
import { renderBookingConfirmed, slotRange, vnDate, vnd } from '../src/lib/email/booking-confirmed.ts';

let passed = 0;
const ok = (label, cond, extra = '') => { console.log(cond ? 'ok  ' : 'FAIL', label, cond ? '' : extra); if (cond) passed += 1; else process.exitCode = 1; };

const payload = {
  booking_id: 42,
  code: 'DS1042',
  player_name: 'Nguyễn Văn An',
  venue_name: 'Sân Cầu Lông Hòa Xuân',
  venue_address: '12 Trần Đăng Ninh',
  venue_phone: '0905123456',
  total_amount: 240000,
  confirmed_at: '2026-11-13T12:05:00Z',
  items: [
    { court_name: 'Sân 2', booking_date: '2026-11-14', start_time: '18:00', price: 120000 },
    { court_name: 'Sân 1', booking_date: '2026-11-14', start_time: '19:00', price: 120000 },
  ],
};
const mail = renderBookingConfirmed(payload, 'https://caulongdanang.vercel.app/');

ok('định dạng tiền', vnd(240000) === '240.000 đ');
ok('định dạng ngày có thứ', vnDate('2026-11-14') === 'Thứ bảy, 14/11/2026', vnDate('2026-11-14'));
ok('khung giờ 60 phút', slotRange('18:00') === '18:00 - 19:00' && slotRange('23:00') === '23:00 - 00:00');
ok('tiêu đề có mã lượt và tên sân', mail.subject === 'Xác nhận đặt sân DS1042 - Sân Cầu Lông Hòa Xuân', mail.subject);
ok('thư có lời chào theo tên, địa chỉ, SĐT sân, tổng tiền', mail.html.includes('Chào Nguyễn Văn An') && mail.html.includes('12 Trần Đăng Ninh') && mail.html.includes('0905123456') && mail.html.includes('240.000 đ'));
ok('thư có từng khung giờ', mail.html.includes('18:00 - 19:00') && mail.html.includes('19:00 - 20:00') && mail.html.includes('Sân 2'));
ok('giờ xác nhận theo giờ Việt Nam', mail.text.includes('Xác nhận lúc: 19:05 ngày 13/11/2026'), mail.text);
ok('link tới trang lượt đặt (bỏ dấu / thừa)', mail.html.includes('href="https://caulongdanang.vercel.app/bookings/42"') && mail.text.includes('https://caulongdanang.vercel.app/bookings/42'));
ok('có bản chữ thuần cho ứng dụng thư không hiện HTML', mail.text.includes('- Thứ bảy, 14/11/2026, 18:00 - 19:00, Sân 2: 120.000 đ') && mail.text.includes('Tổng tiền đã thanh toán: 240.000 đ'));

// Dữ liệu do chủ sân nhập (tên sân, địa chỉ) không được chèn HTML hay xuống dòng vào tiêu đề
const evil = renderBookingConfirmed({ ...payload, venue_name: 'Sân <script>alert(1)</script>\r\nBcc: x@evil.com', venue_address: '"><img src=x onerror=alert(1)>' }, 'https://a.b');
ok('tên sân có thẻ HTML được escape', !evil.html.includes('<script>') && evil.html.includes('&lt;script&gt;'));
ok('địa chỉ có thẻ HTML được escape', !evil.html.includes('<img src=x') && evil.html.includes('&lt;img'));
ok('tiêu đề không chứa xuống dòng (chống chèn header)', !/[\r\n]/.test(evil.subject), JSON.stringify(evil.subject));

const noPhone = renderBookingConfirmed({ ...payload, venue_phone: null, player_name: '' }, 'https://a.b');
ok('không có SĐT sân thì bỏ dòng đó; không có tên thì chào chung', !noPhone.html.includes('Điện thoại sân') && noPhone.html.includes('Chào bạn,'));

console.log(process.exitCode ? '\nCÓ KIỂM TRA LỖI' : `\nTẤT CẢ ĐẠT (${passed} kiểm tra)`);
