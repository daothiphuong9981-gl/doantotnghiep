# Kế hoạch phát triển — Cầu Lông Đà Nẵng (bản chờ duyệt)

Ngày lập: 30/10/2026 · Trạng thái: **GĐ1 + GĐ5 ĐÃ TRIỂN KHAI 30/10/2026** (đã chạy 0008, 0009 trên Supabase; commit 979fff0 deploy Ready). GĐ2 (QR) ĐÃ TRIỂN KHAI 30/10/2026 (0010 đã chạy trên Supabase, commit 0c9b472 deploy Ready; còn cần quét thử bằng app ngân hàng). Tiếp theo: GĐ3 (email), cần chốt cách gửi trước

### Tiến độ GĐ2 (30/10/2026)
- Mã VietQR tự tạo trên máy chủ (`src/lib/vietqr.ts`), không gọi dịch vụ ngoài. Payload khớp từng ký tự với mã do img.vietqr.io tạo; ảnh PNG khoảng 5 KB, giải mã ngược khớp payload.
- Danh mục 48 ngân hàng hỗ trợ chuyển khoản (`src/lib/banks.ts`, lấy từ api.vietqr.io). Form chủ sân chọn ngân hàng thay vì gõ tên; số tài khoản phải có 6–19 chữ số.
- Migration `0010_payment_qr.sql`:
  - Thêm cột `bank_bin` (không cho đọc công khai) và bỏ khoảng trắng trong số tài khoản.
  - Tự gán BIN cho các tên ngân hàng thật thường gặp. 50 sân demo không được gán, để không tạo QR chuyển tới tài khoản thật không liên quan.
- QR chỉ hiện khi lượt đặt đang giữ chỗ, kèm nút "Tải ảnh QR". Số tiền và nội dung lấy từ DB.
- Kiểm thử: `test:db` 280/280 (thêm `payment-qr.test.mjs`), `tests/vietqr.test.mjs` 13/13, `tsc`, lint, build.

### Kết quả đo sau deploy (30/10/2026, hàm chạy ở sin1)
Đo tuần tự, đã khởi động sẵn, thời gian tải xong:

| Trang | Trước (iad1) | Sau (sin1) |
|---|---|---|
| `/venues/41` | ~4,0 s | ~0,30–0,36 s |
| `/` | ~1,8 s | ~0,24–0,34 s |
| `/bookings` | ~2,1 s | ~0,23–0,31 s |
| `/api/wards` | ~1,4 s | ~0,21 s |

Khoảng 0,2 s trong số đó là độ trễ mạng từ trình duyệt tới edge của Vercel.
- Chưa kiểm tra trên production: luồng `next/image` (chưa sân nào có ảnh); khung thanh toán của người chơi và trang sửa sân của chủ sân (cần tài khoản player/owner, cần tạo dữ liệu thật). DB đã xác nhận có quyền và các RPC mới.

### Tiến độ GĐ1 + GĐ5 (30/10/2026)
- Đã làm:
  - `vercel.json` đặt region `sin1`.
  - `next/image` cho ảnh sân. Navbar bọc `Suspense`.
  - Truy vấn song song ở trang sân và `getBooking`. Chi tiết sân gộp thành 1 truy vấn.
  - Cache danh mục phường. Trợ lý AI chạy song song. Chuông thông báo hỏi mỗi 45 s.
  - Migration `0008_performance.sql` (index và RLS dạng initPlan) và `0009_security.sql` (ẩn cột ngân hàng, chặn tài khoản bị khoá, giữ lịch sử khi sân bị ẩn, thu hẹp quyền xem SĐT khách).
  - Nâng Next 16.4.0 lên 16.4.3 (vá lỗ hổng critical RCE ở Image Optimization), zod lên 4.6.7.
- Kiểm thử:
  - `test:db` đạt 264/264 kiểm tra, gồm 43 kiểm tra mới trong `security-perf.test.mjs`.
  - `tsc`, lint và build sạch.
  - Đo local: trang sân render xong ~0,25 s.
- **Thứ tự triển khai bắt buộc:** chạy 0008 rồi 0009 trên Supabase TRƯỚC, sau đó mới deploy code. Code mới gọi RPC `booking_payment_info` và `venue_bank_info` do 0009 tạo ra.
- Bỏ qua có chủ đích: không bỏ `expire_holds()` theo request, vì lệnh này đã chạy song song với truy vấn nên không làm chậm trang.
- Lưu ý cho GĐ3: "SMTP cá nhân mỗi sân" nghĩa là phải lưu mật khẩu ứng dụng Gmail của từng chủ sân. Đề xuất thay thế: 1 hộp Gmail hệ thống gửi, From hiển thị tên sân, Reply-To là email chủ sân. Cần chốt trước khi làm GĐ3.

### Quyết định của chủ dự án (30/10/2026)
1. Supabase region = **Southeast Asia (Singapore)** (đã kiểm tra dashboard); khoá JWT ES256 → chuyển Vercel sang `sin1`.
2. Email: **SMTP cá nhân đơn giản** (nodemailer), mỗi sân gắn 1 email cá nhân của chủ sân.
3. Chỉ gửi email khi **chủ sân xác nhận đặt sân thành công**.
4. QR: tự tạo trên server (đồng ý đề xuất).
5. Đánh giá: **1 đánh giá / 1 lần đặt sân**, sửa được, **chỉ trong 24h sau giờ chơi**, người đánh giá **tuỳ chọn ẩn/hiện tên**.
6. GĐ5 (bảo mật): làm ngay, cùng GĐ1.

## 0. Kết quả phân tích của hội đồng

Hội đồng gồm 4 tác nhân phân tích mã nguồn (Hiệu năng, Đặt sân & Thanh toán, Dữ liệu & Bảo mật, Kiến trúc & Chất lượng) và 1 phần đo đạc trực tiếp trên bản deploy Vercel.

### 0.1 Đo thực tế trên https://caulongdanang.vercel.app (30/10/2026)

| Trang / API | Thời gian phản hồi server | Nơi chạy hàm |
|---|---|---|
| `/` | ~1,8 s | iad1 (Washington, Mỹ) |
| `/venues/41` | **~4,0 s** | iad1 |
| `/bookings` | ~2,1 s | iad1 |
| `/admin` | ~2,1 s | iad1 |
| `/api/wards` (chỉ 1 truy vấn) | ~1,4 s | iad1 |
| `/api/me` | ~1,5 s | iad1 |

- Vercel project `doantotnghiep`, gói Hobby, Fluid Compute bật, **Function Region = iad1 (Mỹ)**.
- Trong repo không có `vercel.json` và không cấu hình region.
- Region của Supabase chưa xác nhận được vì trình duyệt chưa đăng nhập Supabase. Ngay cả API chỉ có 1 truy vấn cũng mất 1,4 s, nên nhiều khả năng Supabase ở châu Á, xa hàm ở Mỹ. Mỗi truy vấn khi đó mất khoảng 200–250 ms đi về.

### 0.2 Nguyên nhân chậm (xếp theo mức ảnh hưởng)
1. **Lệch region giữa Vercel (iad1) và Supabase.** Mỗi trang có 2–4 truy vấn chạy nối tiếp, nên mất thêm khoảng 1 s.
2. **Root layout chờ `getSession()`** (`navbar.tsx:26`, `auth.ts:48`) trước khi gửi bất kỳ byte nào. `loading.tsx` vì vậy không có tác dụng.
3. **Truy vấn nối tiếp (waterfall).**
   - `venues/[id]/page.tsx` mất 3 vòng gọi DB.
   - `getBooking` mất 3–4 vòng (`bookings.ts:118`).
4. **Thiếu index.**
   - `booking_items(booking_id)`, `venue_images(venue_id)`, `bookings(status, hold_expires_at)`.
   - Các policy RLS gọi `auth.uid()` và `my_role()` lặp lại trên từng dòng.
   - `expire_holds()` (một lệnh UPDATE) chạy ở mỗi lần xem trang booking.
5. **Ảnh gốc từ Storage dùng `<img>` thường**, không resize, có thể nặng vài MB.
6. Chuông thông báo gọi server mỗi 20 s, kèm `router.refresh()`. Danh sách phường (`wards`) không được cache. AI chat chạy nối tiếp từng bước.

### 0.3 Hiện trạng liên quan tới tính năng mới
- **Đặt sân:** đi theo luồng `holding → awaiting_confirmation → confirmed` (hoặc `cancelled`/`expired`). Chủ sân xác nhận qua RPC `confirm_payment`. Trigger `notify_booking_change` (0006) đã tạo thông báo trong app.
- **Thanh toán:**
  - Bảng `venues` có `bank_name` (nhập tự do), `bank_account_number`, `bank_account_name`.
  - **Không có mã BIN ngân hàng**, nên chưa tạo được VietQR.
  - Nội dung chuyển khoản là mã booking (`DS1023`). Số tiền tính ở server, như vậy là đúng.
- **Email:** địa chỉ email chỉ nằm trong `auth.users`. Chưa có thư viện gửi mail, service-role key hay `vercel.json`/cron.
- **Đánh giá:** chưa có gì. Không có trạng thái `completed`. "Đã chơi" nghĩa là `confirmed` và giờ chơi đã qua (`booking_details.is_past`).
- **Chất lượng:** `tsc` sạch, lint 0 lỗi, `test:db` gồm 6 bộ test PGlite.
- **Vấn đề bảo mật phát hiện thêm:**
  - Số tài khoản ngân hàng của sân đọc được công khai bằng anon key.
  - User bị khoá vẫn gọi được `report_payment`/`cancel_booking`.
  - Booking "biến mất" với người chơi khi sân bị ẩn.

---

## Giai đoạn 1 — Cải thiện hiệu năng (ưu tiên cao nhất)

**Mục tiêu:** TTFB các trang chính < 600 ms, `/venues/[id]` < 1 s, đo lại bằng cùng phương pháp như mục 0.1.

| # | Việc | File | Kết quả kỳ vọng |
|---|---|---|---|
| 1.1 | Đặt region Vercel trùng Supabase: thêm `vercel.json` `{"regions":["sin1"]}` (hoặc region tương ứng). Cần bạn xác nhận region Supabase trước. | `vercel.json` | Giảm 60–80 % thời gian mỗi truy vấn |
| 1.2 | Migration `0008_performance.sql`: thêm index `booking_items(booking_id)`, `bookings(player_id, created_at desc)`, partial index `bookings(hold_expires_at) where status='holding'`, `venue_images(venue_id, sort_order)`. Viết lại policy RLS dùng `(select auth.uid())` và `(select my_role())`. | `supabase/migrations/` | Truy vấn view/RLS nhanh hơn khi dữ liệu tăng |
| 1.3 | Bọc phần user trên Navbar trong `<Suspense>` để layout stream ngay | `layout.tsx`, `navbar.tsx` | Trang hiện khung ngay |
| 1.4 | Chạy song song các truy vấn ở trang sân và trang booking | `venues/[id]/page.tsx`, `services/venues.ts`, `services/bookings.ts` | `/venues/[id]` từ 3 vòng DB còn 1 |
| 1.5 | Bỏ gọi `expire_holds()` mỗi request. Dùng pg_cron (0003) hoặc Vercel cron. View đã tự ẩn hold hết hạn. | `services/bookings.ts` | Bớt 1 lệnh UPDATE mỗi trang |
| 1.6 | Ảnh dùng Supabase image transform (`?width=…&quality=70`) hoặc `next/image` với `remotePatterns`. Ảnh đầu tiên ưu tiên tải, các ảnh sau lazy. | `env.ts`, `home-explorer.tsx`, `venues/[id]/page.tsx`, `next.config.ts` | Giảm dung lượng ảnh 80–90 % |
| 1.7 | Cache danh sách phường (`'use cache'`/`unstable_cache`). Chuông thông báo poll 60 s và khi tab được focus. AI chat chạy song song các bước và đưa `ai_finish` vào `after()`. | `services/venues.ts`, `bell.tsx`, `services/assistant.ts` | Giảm tải nền |
| 1.8 | Thêm `public/vendor/**` vào ignore của ESLint (hiện có 1082 cảnh báo rác) | `eslint.config.mjs` | Lint sạch |

**Kiểm thử:** `npm run test:db`, `tsc`, lint. Deploy preview rồi đo lại bảng 0.1 trước và sau.

---

## Giai đoạn 2 — Ảnh QR thanh toán (VietQR) có sẵn số tiền và nội dung

| # | Việc | File |
|---|---|---|
| 2.1 | Migration `0009_payment_qr.sql`: thêm `venues.bank_bin` (6 số, CHECK), chuẩn hoá số tài khoản (bỏ khoảng trắng). Có thể snapshot thông tin người nhận vào booking để chủ sân đổi tài khoản giữa chừng không làm lệch tiền. | migrations |
| 2.2 | Danh sách ngân hàng (BIN, tên viết tắt). Form chủ sân đổi ô "Tên ngân hàng" thành dropdown chọn ngân hàng. | `src/lib/banks.ts`, `venue-form.tsx`, `validation.ts`, `types.ts` |
| 2.3 | `src/lib/vietqr.ts` tạo payload chuẩn EMVCo/NAPAS 247 (BIN, số TK, số tiền, nội dung = mã booking, CRC16). Render QR bằng thư viện `qrcode` ngay trên server, không phụ thuộc dịch vụ ngoài. | `vietqr.ts`, `package.json` |
| 2.4 | `paymentOf()` trả thêm QR. `PaymentPanel` hiển thị ảnh QR kèm nút "Tải ảnh QR". Chỉ hiện khi booking đang ở trạng thái `holding`. | `services/bookings.ts`, `payment-panel.tsx` |
| 2.5 | Unit test payload so với mẫu VietQR chuẩn. Quét thử bằng app ngân hàng thật. | `tests/` |

**Bảo mật:** số tiền và nội dung lấy từ DB ở server, không nhận từ client. Chủ sân vẫn xác nhận thủ công, vì QR không chứng minh đã thanh toán.

---

## Giai đoạn 3 — Email tự động xác nhận đặt sân

**Thiết kế đề xuất:** dùng outbox, bền vững và gửi lại được khi lỗi.

| # | Việc | File |
|---|---|---|
| 3.1 | Migration `0010_email_outbox.sql`: thêm bảng `email_outbox` (booking_id, kind, to_email, payload, status, attempts, unique(booking_id, kind)). Mở rộng trigger `notify_booking_change` để khi `confirmed` thì ghi thêm 1 dòng outbox, lấy email từ `auth.users` ngay trong DB. Bảng không cấp quyền cho anon/authenticated. | migrations |
| 3.2 | `src/lib/email.ts`: lớp gửi mail có thể thay nhà cung cấp (Resend hoặc Gmail SMTP qua nodemailer). Template HTML tiếng Việt gồm mã booking, tên sân, địa chỉ, SĐT sân, danh sách sân/giờ, tổng tiền, thời điểm xác nhận và link `/bookings/{id}`. | `email.ts`, `emails/` |
| 3.3 | Gửi ngay sau khi chủ sân bấm xác nhận bằng `after()` (không làm chậm thao tác). Thêm route `/api/cron/send-emails` (bảo vệ bằng CRON_SECRET) để gửi lại các mail lỗi. | `services/bookings.ts`, `api/cron/send-emails/route.ts`, `vercel.json` |
| 3.4 | Đọc outbox cần quyền server: thêm `SUPABASE_SERVICE_ROLE_KEY` (chỉ dùng phía server, file `server-only`) hoặc một RPC security-definer có kiểm tra secret. | `lib/supabase/admin.ts` |
| 3.5 | Test PGlite: trigger tạo đúng 1 dòng outbox, không trùng, anon không đọc được. | `supabase/tests/email-outbox.test.mjs` |

**Biến môi trường mới:** `RESEND_API_KEY` hoặc `SMTP_USER`/`SMTP_PASS`, `EMAIL_FROM`, `APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.

---

## Giai đoạn 4 — Bình luận, đánh giá sân (chỉ người đã thuê)

| # | Việc | File |
|---|---|---|
| 4.1 | Migration `0011_venue_reviews.sql`. Bảng `venue_reviews` gồm `rating` 1–5, `comment` ≤ 1000 ký tự, `owner_reply`, `status` visible/hidden, unique(venue_id, player_id). | migrations |
| 4.2 | Điều kiện được đánh giá được kiểm tra **trong DB** (RPC `submit_review`): người chơi có booking `confirmed` ở sân đó và giờ chơi đã qua. Bảng chỉ có policy SELECT; mọi thao tác ghi đi qua RPC. | migrations |
| 4.3 | RPC `list_venue_reviews` trả tên người đánh giá đã che bớt (ví dụ "Nguyễn V. A."). Điểm trung bình tính trực tiếp. `search_venues` có thêm `rating_avg`/`rating_count` và tuỳ chọn sắp xếp theo đánh giá (trung bình Bayes). | migrations, `services/venues.ts` |
| 4.4 | Chủ sân trả lời đánh giá. Admin ẩn/hiện đánh giá vi phạm. Thông báo `review_new`, `review_replied`, `review_hidden`. | RPC, trigger 0006 |
| 4.5 | API: `GET/POST /api/venues/[id]/reviews`, `DELETE /api/me/reviews/[id]`, `PUT /api/owner/reviews/[id]/reply`, `GET/PUT /api/admin/reviews…` | `src/app/api/` |
| 4.6 | UI: sao và số đánh giá trên thẻ sân và trang sân, danh sách đánh giá, form đánh giá. Nút "Đánh giá sân" trên `/bookings/[id]` sau khi chơi. Thêm trang `/owner/reviews` và `/admin/reviews`. | `components/reviews/*` |
| 4.7 | Test PGlite (`reviews.test.mjs`) cho các trường hợp được/không được đánh giá, sửa đánh giá, ẩn đánh giá, xoá tài khoản. | `supabase/tests/` |

---

## Giai đoạn 5 (tuỳ chọn) — Vá bảo mật phát hiện thêm
- Ẩn cột tài khoản ngân hàng khỏi anon: dùng column grant hoặc view. Chỉ trả thông tin này qua `paymentOf`.
- Chặn user bị khoá trong `report_payment` và `cancel_booking`.
- Người chơi vẫn thấy booking của mình khi sân bị ẩn.
- Thu hẹp quyền chủ sân xem SĐT khách (chỉ thấy khách có booking hợp lệ).

---

## Thứ tự và ước lượng
| GĐ | Nội dung | Ước lượng | Phụ thuộc |
|---|---|---|---|
| 1 | Hiệu năng | 1–1,5 ngày | Region Supabase |
| 2 | QR VietQR | 1 ngày | — |
| 3 | Email | 1–1,5 ngày | Tài khoản Resend/Gmail |
| 4 | Đánh giá | 2 ngày | — |
| 5 | Bảo mật | 0,5 ngày | — |

Mỗi giai đoạn gồm: viết code và migration, chạy test (`test:db`, `tsc`, lint), deploy preview để bạn kiểm tra, rồi commit riêng. Migration cần chạy trên Supabase thật sẽ được gửi bạn duyệt trước.

## Câu hỏi cần bạn quyết định
1. **Region Supabase** của bạn là gì (Settings → General)? Tôi đề xuất chuyển Vercel sang `sin1` nếu Supabase ở Singapore.
2. **Nhà cung cấp email:** Resend (cần tên miền riêng để gửi tới mọi người) hay Gmail SMTP (không cần tên miền, giới hạn khoảng 500 mail/ngày)?
3. **Thời điểm gửi email:** chỉ khi chủ sân xác nhận đã nhận tiền, hay thêm 1 email khi vừa đặt sân (kèm QR thanh toán)?
4. **QR:** tự tạo QR trên server (đề xuất) hay dùng ảnh từ `img.vietqr.io` (nhanh hơn nhưng phụ thuộc dịch vụ ngoài)?
5. **Đánh giá:**
   - Mỗi người 1 đánh giá cho mỗi sân, sửa được (đề xuất), hay 1 đánh giá cho mỗi lần đặt?
   - Có giới hạn thời gian đánh giá (ví dụ trong 30 ngày sau khi chơi) không?
   - Hiển thị tên đầy đủ hay che bớt?
6. Có làm **Giai đoạn 5 (bảo mật)** không?
