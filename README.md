# Cầu Lông Đà Nẵng

Website cho thuê sân cầu lông tại Đà Nẵng (đồ án tốt nghiệp). Mã nguồn đã xong cả ba sprint:
tài khoản ba vai trò, quản lý sân, bản đồ, tìm kiếm và lọc, đặt nhiều sân con trong một lượt, giữ chỗ có thời hạn,
thanh toán chuyển khoản do chủ sân xác nhận thủ công, trang quản trị, thống kê, trợ lý AI tìm sân (Gemini), xóa tài khoản.

Công nghệ: Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Supabase (PostgreSQL + PostGIS, Auth, Storage),
Leaflet + OpenStreetMap, Gemini API, triển khai trên Vercel.

> **Trạng thái kiểm thử:** toàn bộ chức năng đã được kiểm thử trong môi trường giả lập trên máy (mục 5).
> Chưa chạy trên Supabase, Vercel và Gemini thật; việc đó làm một lần ở bước triển khai (mục 3).

## 1. Phạm vi

| Sprint | Mục backlog | Nội dung chính | Nơi hiện thực |
|---|---|---|---|
| 1 | PB-01..PB-11 | Khung dự án, cơ sở dữ liệu + RLS, đăng ký/đăng nhập, phân quyền, chủ sân quản lý sân, bảng giá, ảnh, bản đồ, sân gần tôi, chi tiết sân | `0001_init.sql`, `src/app/(auth)`, `src/app/owner/venues`, `src/components/map` |
| 2 | PB-12..PB-18 | Tìm kiếm và lọc, đặt nhiều sân con, giữ chỗ, thanh toán, chủ sân xác nhận, lịch sử | `0002_bookings.sql`, `0004_venue_rules.sql`, `src/app/bookings`, `src/app/owner/bookings`, `src/components/booking` |
| 3 | PB-19, PB-20 | Quản trị viên duyệt, từ chối, ẩn sân; tìm, khóa, mở khóa tài khoản | `0005_admin_stats_ai.sql`, `src/app/admin`, `src/lib/services/admin.ts` |
| 3 | PB-21, PB-22 | Thống kê của chủ sân và của hệ thống | `src/app/owner/stats`, `src/app/admin/stats`, hàm `owner_stats`, `admin_stats` |
| 3 | PB-23..PB-26 | Trợ lý AI: hiểu câu hỏi, trả lời theo dữ liệu thật, hội thoại nhiều lượt, giới hạn lượt, dự phòng khi lỗi | `src/lib/ai`, `src/lib/services/assistant.ts`, `src/app/assistant` |
| 3 | PB-27 | Xóa tài khoản, đồng ý xử lý dữ liệu cá nhân | hàm `delete_my_account`, `src/app/account` |
| 3 | PB-28 | Dữ liệu sân thật và triển khai chính thức | **chưa làm**: xem mục 3 và file `DuLieuSan_DaNang_v1.0.xlsx` ở thư mục đồ án |

### Vòng đời một lượt đặt (giống đặt vé tàu trực tuyến)

```
Đang giữ chỗ ──(báo đã chuyển khoản, còn hạn)──> Chờ chủ sân xác nhận ──(Đã nhận tiền)──> Đã xác nhận
     │                                                   │                                    │
     ├─(hết thời gian giữ chỗ)──> Hết hạn giữ chỗ        └─(Chưa nhận được + lý do)──┐        │
     └─(người chơi hủy)──────────────────────────────────────────────────────────────┴──> Đã hủy <─(hủy trước giờ chơi)
```

- Khung giờ của lượt "Hết hạn giữ chỗ" hoặc "Đã hủy" coi như chưa ai đặt, người khác đặt được ngay; không phụ thuộc tác vụ định kỳ.
- Hai người giữ cùng một ô cùng lúc: chỉ mục duy nhất trong cơ sở dữ liệu chỉ cho một người thành công, người còn lại nhận lỗi 409.
- Không kết nối cổng thanh toán. Người chơi chuyển khoản theo thông tin của chủ sân, nội dung là mã đặt chỗ (ví dụ `DS1042`).

### Quy định đặt sân do từng chủ sân tự thiết lập

Chủ sân chỉnh ở form đăng ký/sửa sân, mục "Quy định đặt sân của sân này". Giá trị lưu ở bảng `venues`.

| Quy định | Cột | Mặc định | Khoảng cho phép |
|---|---|---|---|
| Thời gian giữ chỗ chờ thanh toán | `hold_minutes` | 15 phút | 5 đến 60 |
| Số khung giờ tối đa trong một lượt đặt | `max_slots_per_booking` | 20 | 1 đến 50 |
| Số ngày được đặt trước | `advance_days` | 7 | 1 đến 30 |
| Số lượt đang giữ chỗ cùng lúc của một người chơi tại sân | `max_active_holds` | 2 | 1 đến 10 |

Khoảng cho phép khai báo ở hai nơi phải khớp nhau: ràng buộc CHECK trong `0004_venue_rules.sql` và `src/lib/constants.ts`.

### Trợ lý AI hoạt động thế nào

1. Máy chủ ghi nhận câu hỏi và kiểm tra giới hạn (mặc định 20 câu mỗi người mỗi ngày, hàm `ai_begin`).
2. Gemini chuyển câu hỏi thành bộ lọc có cấu trúc (phường/xã, ngày, khung giờ, giá, gần tôi). Lời nhắc chỉ chứa ngày hiện tại,
   danh mục phường/xã và bộ lọc của lượt trước; **không có họ tên, email, số điện thoại**.
3. Máy chủ kiểm tra hợp lệ bộ lọc (`src/lib/ai/filter.ts`): giá trị sai bị bỏ và trợ lý hỏi lại; câu hỏi ngoài phạm vi bị từ chối.
4. Máy chủ truy vấn sân bằng hàm `search_venues` (dùng chung với bộ lọc thường). Thẻ sân trên giao diện luôn lấy từ kết quả truy vấn.
5. Gemini chỉ diễn đạt lại kết quả. Không có kết quả, cần hỏi lại, từ chối: dùng câu trả lời cố định, không gọi Gemini lần hai.
6. Gemini lỗi, quá 15 giây, hết hạn mức hoặc trả về sai định dạng: phản hồi `fallback = true`, giao diện đưa người chơi về bộ lọc thường.

## 2. Cài đặt trên máy

Cần Node.js 20.9 trở lên (22.18 trở lên nếu muốn chạy `npm run test:unit`, `npm run test:ai`) và một dự án Supabase.

### 2.1. Cơ sở dữ liệu

Trong **SQL Editor** của Supabase, chạy lần lượt:

| Thứ tự | Tệp | Nội dung |
|---|---|---|
| 1 | `supabase/migrations/0001_init.sql` | 9 bảng, RLS, hàm cơ bản, kho ảnh |
| 2 | `supabase/migrations/0002_bookings.sql` | Đặt sân, giữ chỗ, thanh toán, tìm kiếm |
| 3 | `supabase/migrations/0004_venue_rules.sql` | Quy định đặt sân riêng của từng sân |
| 4 | `supabase/migrations/0005_admin_stats_ai.sql` | Quản trị, thống kê, nhật ký AI, xóa tài khoản |
| 5 | `supabase/migrations/0006_notifications.sql` | Thông báo trong ứng dụng khi có biến động đặt sân, duyệt sân |
| 6 | `supabase/migrations/0007_overdue_awaiting.sql` | Chủ sân xử lý được lượt chờ xác nhận đã qua giờ chơi |
| 7 | `supabase/seed.sql` | 94 phường, xã, đặc khu theo Nghị quyết 1659/NQ-UBTVQH15 |
| tùy chọn | `supabase/migrations/0003_cron_optional.sql` | Bật `pg_cron` trước (Database > Extensions). Cập nhật nhãn "Hết hạn giữ chỗ" đúng từng phút; không bật vẫn đúng nghiệp vụ |

Trong lúc phát triển, vào **Authentication > Sign In / Providers > Email** và tắt **Confirm email** để đăng ký xong đăng nhập được ngay.

### 2.2. Biến môi trường

Sao chép `.env.example` thành `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ma-du-an>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<khoa-anon-hoac-publishable>
GEMINI_API_KEY=<khoa lay o Google AI Studio>      # thiếu thì trợ lý AI tự chuyển sang dự phòng
# GEMINI_MODEL=gemini-3.5-flash-lite              # mặc định; đổi nếu tài khoản dùng mô hình khác
# AI_DAILY_LIMIT=20                               # số câu hỏi mỗi người mỗi ngày
# AI_DEBUG=1                                      # in nội dung gửi Gemini ra nhật ký máy chủ (để kiểm tra PB-26)
# CRON_SECRET=<chuoi-ngau-nhien>                  # chỉ cần khi dùng Vercel Cron thay cho pg_cron
```

Không đưa `.env.local` lên Git. `GEMINI_API_KEY` chỉ dùng ở máy chủ, không có tiền tố `NEXT_PUBLIC_`.

### 2.3. Chạy

```bash
npm install
npm run dev        # http://localhost:3000
```

### 2.4. Tạo quản trị viên đầu tiên

Đăng ký một tài khoản bình thường trên website, rồi chạy trong SQL Editor (chỉ cần làm một lần; các việc khác đã có trang quản trị):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'email-cua-ban@example.com');
```

## 3. Triển khai thực tế (làm một lần, chưa thực hiện)

1. Tạo dự án Supabase chính thức, chạy các tệp ở mục 2.1, bật lại **Confirm email**.
2. Đưa mã nguồn lên GitHub; trên Vercel chọn **Add New > Project**, khai báo các biến môi trường ở mục 2.2, **Deploy**.
3. Trong Supabase **Authentication > URL Configuration**, đặt Site URL là địa chỉ Vercel.
4. Tạo quản trị viên (mục 2.4).
5. Lấy khóa Gemini ở Google AI Studio, kiểm tra hạn mức miễn phí của mô hình đang dùng (xem trong AI Studio, mục Rate limit),
   chạy `npm run test:ai` để chấm bộ 20 câu hỏi mẫu (PB-23 yêu cầu ít nhất 16/20).
6. Nhập dữ liệu sân thật (PB-28): xác minh các sân trong `DuLieuSan_DaNang_v1.0.xlsx`, sau đó chủ sân (hoặc nhóm, với sự đồng ý của chủ sân)
   đăng ký từng sân qua form "Thêm sân" để có tọa độ, bảng giá, ảnh; quản trị viên duyệt.
7. Chạy lại `Testcase_Sprint_1`, `_2`, `_3` trên bản chính thức, ghi kết quả vào các file kiểm thử; thử trên điện thoại.
8. Sao lưu cơ sở dữ liệu trước buổi bảo vệ.

Những điểm chỉ kiểm tra được ở bước này: email xác nhận của Supabase Auth, giới hạn tệp và CORS của Storage, ô bản đồ OpenStreetMap,
hai người đặt cùng một ô thật sự đồng thời, chất lượng hiểu câu hỏi của Gemini, quyền `delete from auth.users` của hàm `delete_my_account`.

## 4. Cấu trúc thư mục và API

```
src/app/                 Trang và API (App Router)
  (auth)/, account/      Đăng nhập, đăng ký, tài khoản, xóa tài khoản
  venues/[id]/           Chi tiết sân, chọn khung giờ
  bookings/              Lịch sử đặt sân, trang thanh toán
  assistant/             Trợ lý AI
  owner/                 Khu vực chủ sân: sân, lịch đặt, thống kê
  admin/                 Khu vực quản trị: duyệt sân, người dùng, thống kê
  api/                   Route Handler theo tài liệu 17.ApiDesignDetail
src/components/          Thành phần giao diện (map, owner, booking, admin, assistant, ui)
src/lib/
  services/              Nghiệp vụ, dùng chung cho trang và API
  ai/                    Lời nhắc, kiểm tra bộ lọc, gọi Gemini (không phụ thuộc Next.js)
  constants.ts           Khoảng giá trị của các quy định đặt sân
  db-errors.ts           Đổi mã lỗi của hàm cơ sở dữ liệu thành mã HTTP
supabase/migrations/     Bảng, RLS, hàm
supabase/tests/          Kiểm thử cơ sở dữ liệu
tests/ai/                Kiểm thử bộ lọc AI, bộ 20 câu hỏi mẫu
tests/e2e/               Kiểm thử đầu-cuối
```

Mọi phản hồi API có dạng `{ "statusCode", "message", "data" }`.

| Nhóm | Đường dẫn |
|---|---|
| Tài khoản | `POST /api/auth/register\|login\|logout`, `PUT /api/auth/password`, `GET\|PUT\|DELETE /api/me` |
| Tìm sân | `GET /api/wards`, `GET /api/venues?q=&ward_id=&min_price=&max_price=&date=&start_time=&lat=&lng=`, `GET /api/venues/{id}`, `GET /api/venues/{id}/availability?date=` |
| Đặt sân | `POST\|GET /api/bookings`, `GET /api/bookings/{id}`, `PUT /api/bookings/{id}/payment-report`, `PUT /api/bookings/{id}/cancel` |
| Chủ sân | `GET\|POST /api/owner/venues`, `GET\|PUT /api/owner/venues/{id}`, `PUT /api/owner/venues/{id}/prices`, `GET /api/owner/bookings`, `PUT /api/owner/bookings/{id}/status`, `GET /api/owner/stats?venue_id=&from=&to=` |
| Quản trị | `GET /api/admin/venues?status=&q=`, `PUT /api/admin/venues/{id}/review`, `GET /api/admin/users?q=&role=&page=`, `PUT /api/admin/users/{id}/lock`, `GET /api/admin/stats` |
| Trợ lý AI | `POST /api/ai/chat` với `{ session_id, message, lat?, lng? }`; 429 khi hết lượt trong ngày |
| Hệ thống | `GET\|POST /api/cron/expire-holds` (cần `Authorization: Bearer $CRON_SECRET`) |

Các hàm trong cơ sở dữ liệu báo lỗi bằng mã: `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `INVALID_INPUT` 400,
`INVALID_STATE` 409, `SLOT_TAKEN` 409, `RATE_LIMITED` 429.

Khác với tài liệu thiết kế API: ảnh sân được tải thẳng từ trình duyệt lên Supabase Storage (chính sách Storage kiểm tra quyền chủ sân),
nên không có `/api/owner/venues/{id}/images`. Khi chủ sân xóa tài khoản hoặc xóa sân, tệp ảnh trong Storage chưa được dọn tự động.

## 5. Kiểm thử

```bash
npm run lint        # ESLint
npm run typecheck   # kiểm tra kiểu TypeScript
npm run build       # dựng bản chạy thật
npm run test:db     # 34 + 78 + 66 kiểm tra RLS, trigger, hàm trên PostgreSQL + PostGIS chạy trong bộ nhớ (PGlite)
npm run test:unit   # 32 kiểm tra phần xử lý bộ lọc của trợ lý AI (không gọi Gemini)
npm run test:ai     # 20 câu hỏi mẫu với Gemini thật, cần GEMINI_API_KEY (chưa chạy)
```

Kiểm thử đầu-cuối (`tests/e2e`) chạy website thật bằng trình duyệt Playwright:

| Tệp | Bám theo | Số bước |
|---|---|---|
| `e2e.mjs` | `Testcase_Sprint_1` | 40 |
| `e2e-sprint2.mjs` | `Testcase_Sprint_2` và quy định riêng của từng sân | 86 |
| `e2e-sprint3.mjs` | `Testcase_Sprint_3` (trừ PB-28) | 86 |

Phía sau là PostgREST thật nối vào PGlite; Auth, Storage và Gemini được giả lập trong `fake-supabase.mjs`.
Mỗi tệp cần một môi trường giả lập mới khởi động (dữ liệu trống). Cần tải tệp chạy PostgREST và cài thêm
`playwright`, `jsonwebtoken`, `@electric-sql/pglite-socket`:

```bash
POSTGREST_BIN=/duong/dan/postgrest node tests/e2e/fake-supabase.mjs   # in ra ANON_KEY
# .env.local: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321, NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>,
#             CRON_SECRET=test-secret, GEMINI_API_KEY=test-key, GEMINI_API_BASE=http://127.0.0.1:54321/gemini
npm run build && npm run start
cd tests/e2e && node e2e-sprint3.mjs
```

Giới hạn của môi trường giả lập:

- Auth và Storage giả lập: xác nhận email, giới hạn tệp, CORS của Supabase thật chưa được kiểm tra.
- Gemini giả lập trả lời theo kịch bản của bài kiểm thử. Các bước PB-23, PB-24 chứng minh máy chủ xử lý đúng bộ lọc,
  ngữ cảnh, giới hạn và dự phòng; **không** chứng minh Gemini thật hiểu đúng câu hỏi. Việc đó do `npm run test:ai` đo.
- Cơ sở dữ liệu giả lập chỉ có một kết nối, nên hai yêu cầu "cùng lúc" được xử lý lần lượt.
- Hết hạn giữ chỗ và "lượt đặt đã qua" được mô phỏng bằng cách sửa thời gian trong cơ sở dữ liệu.

## 6. Ghi chú về dữ liệu

- Dữ liệu cá nhân: chỉ lưu họ tên, email, số điện thoại; thời điểm đồng ý xử lý dữ liệu nằm ở `profiles.consent_at`
  (Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15). Người dùng tự xóa được tài khoản; lượt đặt cũ được giữ ở dạng ẩn danh.
- Bản đồ: OpenStreetMap, có ghi nguồn theo giấy phép ODbL. Máy chủ ô bản đồ công cộng chỉ phù hợp lưu lượng nhỏ.
- Dữ liệu sân: nhóm tự khảo sát và xin phép chủ sân; không thu thập hàng loạt từ nền tảng khác.
