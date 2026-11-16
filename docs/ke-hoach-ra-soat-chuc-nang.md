# Kế hoạch bổ sung chức năng cơ bản — Cầu Lông Đà Nẵng

Ngày lập: 16/11/2026 · Trạng thái: **ĐÃ DUYỆT, ĐÃ VIẾT MÃ cả 4 giai đoạn (16/11/2026)**

> Quyết định khi duyệt: làm cả A–D; trang Liên hệ dùng Gmail hệ thống (đổi bằng biến `CONTACT_EMAIL`, `CONTACT_PHONE`);
> D2 làm cả "đặt hộ khách vãng lai" và "khóa khung giờ"; mật khẩu giữ quy tắc 8–72 ký tự.
> L14 (e2e Playwright) chưa làm: thay bằng bộ PGlite `owner-admin-tools.test.mjs` (62 kiểm thử) và `tests/auth.test.mjs`.

## 0. Kết quả rà soát của hội đồng

Bốn tác nhân rà từng nhóm chức năng bằng cách đọc mã nguồn: Tài khoản & xác thực, Người chơi, Chủ sân, Quản trị & toàn hệ thống. Các phát hiện ở mục A và B đã được đối chiếu lại với mã.

Tình trạng kiểm thử hiện tại: `typecheck`, `lint`, `test:db` (11 bộ), `tests/vietqr` 13/13, `tests/email` 14/14 đều đạt; `npm audit` 0 lỗ hổng.

### 0.1 Thiếu chức năng cơ bản

| # | Nhóm | Chức năng thiếu | Ghi chú |
|---|---|---|---|
| T1 | Tài khoản | Quên mật khẩu / đặt lại mật khẩu qua email | Quên mật khẩu là mất tài khoản vĩnh viễn |
| T2 | Tài khoản | Nút ẩn/hiện mật khẩu | Ở đăng nhập, đăng ký, đổi mật khẩu, xoá tài khoản |
| T3 | Tài khoản | Ô "Nhập lại mật khẩu" | Ở đăng ký và đổi mật khẩu |
| T4 | Tài khoản | Xác nhận email khi đăng ký chưa hoàn chỉnh | Link trong thư không có trang đón, không gửi lại được |
| T5 | Toàn hệ thống | Trang báo lỗi chung (`error.tsx`, `global-error.tsx`) | Lỗi hiện màn hình mặc định tiếng Anh |
| T6 | Toàn hệ thống | Footer, trang Liên hệ, Điều khoản | `/privacy` chỉ có link trong form đăng ký |
| T7 | Toàn hệ thống | README trống (1 byte) | Không có hướng dẫn cài đặt, tạo admin đầu tiên |
| T8 | Chủ sân | Tab "Đã huỷ / Hết hạn" trong lịch đặt | Số đã tính nhưng không hiển thị |
| T9 | Chủ sân | Tìm lượt đặt theo mã / tên / SĐT khách, phân trang | |
| T10 | Chủ sân | Quản lý từng sân con (đổi tên, ngừng một sân cụ thể) | Hiện chỉ nhập số lượng |
| T11 | Chủ sân | Đặt hộ khách vãng lai / khoá khung giờ bảo trì | Không có thì khách gọi điện gây trùng lịch |
| T12 | Chủ sân | Xoá sân (sân chưa có lượt đặt) | |
| T13 | Người chơi | SĐT sân và chỉ đường ở trang chi tiết lượt đặt | Trang bảo "liên hệ trực tiếp sân" nhưng không có số |
| T14 | Người chơi | Sắp xếp theo điểm đánh giá | Điểm đã hiện trên thẻ sân |
| T15 | Người chơi | Tiêu đề riêng cho từng trang sân, sitemap | Mọi trang sân dùng chung tiêu đề |
| T16 | Quản trị | Khoá tài khoản: hỏi xác nhận, lý do, báo người bị khoá | Hiện một cú bấm là khoá |
| T17 | Quản trị | Nhật ký thao tác quản trị | Không lưu ai làm, lúc nào |
| T18 | Quản trị | Xem chi tiết người dùng (lượt đặt, sân của họ) | |

### 0.2 Lỗi trong chức năng đã có

| # | Nhóm | Lỗi | Vị trí |
|---|---|---|---|
| L1 | Bảo mật | `next=/\evil.com` qua được kiểm tra chuyển hướng sau đăng nhập | `src/app/(auth)/actions.ts:19` |
| L2 | Chủ sân | Lịch đặt lấy 300 dòng mới nhất rồi mới lọc theo ngày/trạng thái: sân đông sẽ sai số đếm, sót lượt chờ xác nhận | `src/lib/services/bookings.ts:236` |
| L3 | Chủ sân | Thông báo "người chơi huỷ" dẫn tới tab không tồn tại, rơi về tab khác | `src/app/owner/bookings/page.tsx:10` |
| L4 | Chủ sân | Sân bị ẩn hiện câu "sửa và lưu để gửi duyệt lần nữa", nhưng việc đó không làm được | `src/app/owner/venues/[id]/page.tsx:35` |
| L5 | Chủ sân | Giảm số sân con làm ngừng cả sân đang có lượt đặt đã thanh toán, không cảnh báo | `src/lib/services/owner.ts:108` |
| L6 | Chủ sân | Danh sách sân đếm cả sân con đã ngừng | `src/lib/services/owner.ts:35` |
| L7 | Chủ sân | Tạm ngừng/mở lại sân: không hỏi xác nhận, lỗi bị nuốt | `src/app/owner/actions.ts:34` |
| L8 | Chủ sân | Bảng giá không cảnh báo giờ mở cửa chưa có giá; cho nhập giờ lẻ (05:30) | `price-editor.tsx`, `validation.ts` |
| L9 | Tài khoản | Bị giới hạn tần suất đăng nhập thì báo "sai email hoặc mật khẩu" | `src/lib/services/auth.ts:41` |
| L10 | Người chơi | Tải danh sách sân lỗi vẫn hiện thêm "Chưa có sân nào được duyệt" | `home-explorer.tsx:426` |
| L11 | Người chơi | Khách chọn khung giờ rồi đăng nhập thì mất lựa chọn | `slot-picker.tsx:134` |
| L12 | Người chơi | Hết giờ giữ chỗ, thẻ ở danh sách vẫn ghi "Đang giữ chỗ" | `src/app/bookings/page.tsx:61` |
| L13 | Quản trị | Danh sách sân lấy tối đa 500 dòng rồi đếm | `src/lib/services/admin.ts:60` |
| L14 | Kiểm thử | Bộ e2e không chạy được (thiếu `playwright`), chỉ phủ sprint 1–3 | `tests/e2e/` |

### 0.3 Không đưa vào kế hoạch

- **Hạn đánh giá tính từ lúc xác nhận** (tác nhân người chơi nêu là lỗi logic): đây là quyết định của bạn ngày 31/10, giữ nguyên.
- Đổi email, "ghi nhớ đăng nhập", đổi vai trò, quản lý phường/xã, xuất thống kê, sắp xếp lại ảnh, nút sao chép số tài khoản, trang thông báo đầy đủ: mức "có thì tốt", để sau.

---

## Giai đoạn A — Tài khoản (T1–T4, L1, L9)

| # | Việc | File |
|---|---|---|
| A1 | Component `PasswordInput` có nút ẩn/hiện (`aria-pressed`, nhãn "Hiện/Ẩn mật khẩu"); dùng ở đăng nhập, đăng ký, đổi mật khẩu, xoá tài khoản, đặt lại mật khẩu | `src/components/ui/password-input.tsx`, các form |
| A2 | Ô "Nhập lại mật khẩu" ở đăng ký và đổi mật khẩu; mật khẩu 8–72 ký tự | `validation.ts`, các form |
| A3 | Trang **Quên mật khẩu**: nhập email, luôn trả "Nếu email tồn tại, chúng tôi đã gửi liên kết…" (không lộ email nào đã đăng ký); link "Quên mật khẩu?" ở form đăng nhập | `src/app/(auth)/forgot-password/`, `actions.ts`, `services/auth.ts` |
| A4 | Route `/auth/confirm` nhận `token_hash` từ thư (dùng được cả khi mở thư trên máy khác), cũng đón link xác nhận đăng ký | `src/app/auth/confirm/route.ts` |
| A5 | Trang **Đặt lại mật khẩu**: nhập mật khẩu mới 2 lần; link hết hạn thì báo rõ; đặt xong đăng xuất các phiên khác | `src/app/(auth)/reset-password/` |
| A6 | Sửa `safeNext` chặn `\` và ký tự điều khiển; báo đúng khi bị giới hạn tần suất | `actions.ts`, `services/auth.ts` |
| A7 | Test: `safeNext`, schema mật khẩu | `tests/auth.test.mjs` |

**Bạn cần tự làm trên Supabase** (tôi sẽ viết hướng dẫn từng bước):
- Authentication → URL Configuration: Site URL = `https://caulongdanang.vercel.app`, thêm Redirect URL.
- Authentication → Email Templates: sửa link của "Reset Password" và "Confirm signup" trỏ về `/auth/confirm?token_hash=…`.
- Authentication → SMTP: nhập Gmail hệ thống (đang dùng cho thư xác nhận đặt sân). Bộ gửi mặc định của Supabase chỉ gửi vài thư mỗi giờ.

## Giai đoạn B — Nền tảng chung (T5–T7, T15)

| # | Việc | File |
|---|---|---|
| B1 | Trang báo lỗi tiếng Việt có nút "Thử lại" | `src/app/error.tsx`, `global-error.tsx` |
| B2 | Footer mọi trang: Chính sách dữ liệu, Điều khoản, Liên hệ, bản quyền | `src/components/footer.tsx`, `layout.tsx` |
| B3 | Trang Điều khoản sử dụng và trang Liên hệ | `src/app/terms/`, `src/app/contact/` |
| B4 | Tiêu đề và mô tả riêng cho từng trang sân; `sitemap.ts` | `venues/[id]/page.tsx`, `sitemap.ts` |
| B5 | Viết lại README: cài đặt, thứ tự migration 0001–0014, biến môi trường, tạo admin đầu tiên, chạy test | `README.md` |

## Giai đoạn C — Sửa lỗi chức năng đã có (L2–L8, L10–L13, T8, T9, T13, T14)

| # | Việc | File |
|---|---|---|
| C1 | Lịch đặt chủ sân: lọc ngày/trạng thái/từ khoá ngay trong SQL, phân trang, số đếm đúng; thêm tab "Đã huỷ, hết hạn"; ô tìm theo mã/tên/SĐT | migration `0015`, `services/bookings.ts`, `owner/bookings/page.tsx` |
| C2 | Sân bị ẩn: câu thông báo đúng ("liên hệ quản trị viên") | `owner/venues/[id]/page.tsx` |
| C3 | Giảm số sân con: chặn nếu sân sắp ngừng còn lượt đặt sắp tới, báo rõ lượt nào | `services/owner.ts`, migration `0015` |
| C4 | Đếm đúng số sân con đang hoạt động | `services/owner.ts` |
| C5 | Tạm ngừng/mở lại sân: hỏi xác nhận, hiện kết quả | `owner/venues/page.tsx`, `actions.ts` |
| C6 | Bảng giá: bắt buộc giờ chẵn; cảnh báo khung giờ mở cửa chưa có giá | `validation.ts`, `price-editor.tsx` |
| C7 | Trang chi tiết lượt đặt: SĐT sân bấm gọi được, nút chỉ đường | `bookings/[id]/page.tsx`, `services/bookings.ts` |
| C8 | Sắp xếp sân theo điểm đánh giá | `venue-filter.ts` |
| C9 | Lỗi tải danh sách sân không hiện kèm "chưa có sân"; giữ khung giờ đã chọn qua bước đăng nhập; thẻ giữ chỗ tự cập nhật khi hết giờ | `home-explorer.tsx`, `slot-picker.tsx`, `bookings/page.tsx` |
| C10 | Danh sách sân của admin: đếm và lọc trong SQL | `services/admin.ts` |

## Giai đoạn D — Chức năng mới cho chủ sân và quản trị (T10–T12, T16–T18)

| # | Việc | File |
|---|---|---|
| D1 | Quản lý từng sân con: đổi tên, ngừng/mở một sân cụ thể | `owner/venues/[id]/`, `services/owner.ts` |
| D2 | Chủ sân **đặt hộ khách vãng lai** và **khoá khung giờ bảo trì** (tên khách, SĐT tuỳ chọn; không qua thanh toán) | migration `0016` (RPC `owner_block_slots`), UI lịch đặt |
| D3 | Xoá sân chưa có lượt đặt nào | migration `0016`, `owner/venues/` |
| D4 | Khoá tài khoản: hỏi xác nhận, bắt buộc lý do, người bị khoá thấy lý do khi đăng nhập | migration `0016`, `user-lock-button.tsx` |
| D5 | Nhật ký quản trị: ai duyệt/ẩn sân, khoá tài khoản, ẩn đánh giá, lúc nào; trang xem nhật ký | migration `0016`, `admin/logs/` |
| D6 | Trang chi tiết người dùng cho admin | `admin/users/[id]/` |

## Thứ tự và ước lượng

| GĐ | Nội dung | Ước lượng | Migration | Phụ thuộc |
|---|---|---|---|---|
| A | Tài khoản: quên mật khẩu, ẩn/hiện mật khẩu | 1 ngày | không | Bạn cấu hình Supabase Auth |
| B | Trang lỗi, footer, điều khoản, liên hệ, README | 0,5–1 ngày | không | Thông tin liên hệ |
| C | Sửa lỗi chức năng đã có | 1,5 ngày | `0015` | — |
| D | Chức năng mới chủ sân, quản trị | 2–2,5 ngày | `0016` | — |

Mỗi giai đoạn: viết code và test, chạy `typecheck`/`lint`/`test:db`, gửi bạn duyệt trước khi chạy migration trên Supabase và deploy.

## Câu hỏi cần bạn quyết định

1. Làm cả 4 giai đoạn hay chỉ A + B + C (D là chức năng mới, tốn nhiều công nhất)?
2. Trang Liên hệ ghi thông tin gì (tên, email, SĐT)? Nếu chưa có, tôi để email Gmail hệ thống.
3. D2 (đặt hộ khách vãng lai): có cần không, hay chỉ cần "khoá khung giờ" đơn giản?
4. Mật khẩu: chỉ yêu cầu tối thiểu 8 ký tự như hiện tại, hay thêm quy tắc (có chữ và số)?
