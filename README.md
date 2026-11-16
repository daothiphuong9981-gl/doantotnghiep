# Cầu Lông Đà Nẵng

Website tìm và đặt sân cầu lông tại Đà Nẵng — đồ án tốt nghiệp.

- Bản chạy thật: https://caulongdanang.vercel.app
- Công nghệ: Next.js 16 (App Router) · Supabase (PostgreSQL, Auth, Storage, Row Level Security) · Tailwind CSS 4 · MapLibre/Leaflet · Vercel

## Chức năng chính

| Vai trò | Chức năng |
|---|---|
| Khách | Xem sân trên bản đồ, lọc theo phường/xã, giá, khung giờ trống; xem chi tiết sân, đánh giá; trợ lý AI tìm sân |
| Người chơi | Đăng ký, đăng nhập, quên mật khẩu; giữ chỗ nhiều khung giờ; chuyển khoản bằng mã VietQR có sẵn số tiền và nội dung; theo dõi lượt đặt; đánh giá sân trong 24 giờ sau khi chủ sân xác nhận |
| Chủ sân | Đăng ký sân, bảng giá theo giờ, ảnh, quản lý từng sân con; xác nhận thanh toán; đặt hộ khách vãng lai, khóa khung giờ; trả lời đánh giá; thống kê |
| Quản trị viên | Duyệt/ẩn sân, khóa tài khoản (kèm lý do), kiểm duyệt đánh giá, xem chi tiết người dùng, nhật ký quản trị, thống kê toàn hệ thống |

## Chạy trên máy

Cần Node.js 22.18 trở lên (bản 22.14 chạy được nhưng test đơn vị cần thêm cờ, xem mục Kiểm thử).

```bash
npm install
cp .env.example .env.local   # rồi điền giá trị, xem mục Biến môi trường
npm run dev                  # http://localhost:3000
```

## Cài đặt cơ sở dữ liệu (Supabase)

1. Tạo project trên https://supabase.com (nên chọn vùng Singapore cho gần Việt Nam).
2. Vào **SQL Editor**, chạy lần lượt các tệp trong `supabase/migrations/` theo đúng thứ tự số:

   | Tệp | Nội dung |
   |---|---|
   | `0001_init.sql` | Bảng, RLS, hàm cơ bản, bucket ảnh |
   | `0002_bookings.sql` | Giữ chỗ, đặt sân, thanh toán, hủy |
   | `0003_cron_optional.sql` | (Tùy chọn) pg_cron tự trả chỗ hết hạn mỗi phút — bật extension `pg_cron` trước |
   | `0004` – `0007` | Quy định đặt sân, quản trị, thống kê, trợ lý AI, thông báo |
   | `0008` – `0009` | Hiệu năng, bảo mật |
   | `0010` | Mã QR thanh toán (VietQR) |
   | `0011` | Hàng đợi email xác nhận |
   | `0012` – `0013` | Đánh giá sân, nhắc đánh giá |
   | `0014` | Hiệu năng (bảng tóm tắt điểm) |
   | `0015` | Lịch đặt chủ sân lọc trong SQL, chặn ngừng sân con còn lượt đặt, danh sách sân của admin |
   | `0016` | Đặt hộ / khóa giờ, xóa sân, khóa tài khoản có lý do, nhật ký quản trị, chi tiết người dùng |

3. Dữ liệu mẫu (tùy chọn): `supabase/seed.sql` (phường/xã), `supabase/import_san_khao_sat.sql` (sân khảo sát), `supabase/demo_data.sql` (lượt đặt demo).
4. **Tạo quản trị viên đầu tiên**: đăng ký một tài khoản bình thường trên web, rồi chạy trong SQL Editor:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'email-cua-ban@gmail.com');
   ```

### Cấu hình Supabase Auth (bắt buộc cho quên mật khẩu, xác nhận email)

Trong Supabase Dashboard của project:

1. **Authentication → URL Configuration**
   - *Site URL*: `https://caulongdanang.vercel.app` (địa chỉ web thật của bạn)
   - *Redirect URLs*: thêm `https://caulongdanang.vercel.app/**` và `http://localhost:3000/**`
2. **Authentication → Emails → Templates** — sửa liên kết trong hai mẫu thư để mở được trên mọi thiết bị:
   - *Reset Password*: thay `{{ .ConfirmationURL }}` bằng
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
   - *Confirm signup*: thay `{{ .ConfirmationURL }}` bằng
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
   - Nên đổi tiêu đề, nội dung sang tiếng Việt, ví dụ: “Đặt lại mật khẩu Cầu Lông Đà Nẵng”.
3. **Authentication → Emails → SMTP Settings** — bật *Custom SMTP* và dùng Gmail hệ thống (giống biến `SMTP_USER`/`SMTP_PASS`):
   host `smtp.gmail.com`, port `465`, username = địa chỉ Gmail, password = Mật khẩu ứng dụng 16 ký tự, sender name `Cầu Lông Đà Nẵng`.
   Bộ gửi mặc định của Supabase chỉ gửi được vài thư mỗi giờ, không đủ dùng thật.

Không sửa mẫu thư thì liên kết vẫn chạy, nhưng chỉ khi mở trên đúng trình duyệt đã yêu cầu đặt lại mật khẩu.

## Biến môi trường

Xem `.env.example`. Trên Vercel: Project → Settings → Environment Variables. **Không** đưa giá trị bí mật lên Git hay gửi qua chat.

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Có | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Để gửi email | Chỉ dùng ở máy chủ, không thêm tiền tố `NEXT_PUBLIC_` |
| `SMTP_USER`, `SMTP_PASS` | Để gửi email | Gmail hệ thống + Mật khẩu ứng dụng |
| `CRON_SECRET` | Trên Vercel | Bảo vệ `/api/cron/*` |
| `GEMINI_API_KEY` | Không | Trợ lý AI; thiếu thì dùng bộ lọc thường |
| `APP_URL` | Không | Địa chỉ web trong liên kết thư, sitemap; trên Vercel tự lấy tên miền production |
| `CONTACT_EMAIL`, `CONTACT_PHONE` | Không | Hiện ở trang Liên hệ; bỏ trống thì hiện `SMTP_USER` |

## Kiểm thử

```bash
npm run typecheck
npm run lint
npm run test:db     # PGlite: RLS, đặt sân, đánh giá, email, 0015/0016... (không cần Supabase thật)
npm run test:unit   # VietQR, email, safeNext, bộ lọc AI
```

Với Node 22.14: `NODE_OPTIONS="--experimental-strip-types --no-warnings" npm run test:unit`.

## Triển khai

Đẩy lên nhánh `main` → Vercel tự build (vùng `sin1`, gần Supabase Singapore). Luôn chạy migration mới trên Supabase **trước** khi đẩy mã dùng tới nó.

## Tài liệu

- `docs/ke-hoach-phat-trien.md` — kế hoạch 5 giai đoạn (hiệu năng, QR, email, đánh giá, bảo mật)
- `docs/ke-hoach-ra-soat-chuc-nang.md` — rà soát chức năng cơ bản và kế hoạch bổ sung
- `docs/Huong-dan-cau-hinh-he-thong.docx` — hướng dẫn cấu hình cho người mới
