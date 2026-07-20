# PROJECT.md — Website cho thuê sân cầu lông Đà Nẵng
> File BẤT BIẾN. AI không được tự ý thay đổi nội dung file này. Mọi đề xuất thay đổi phải ghi vào STATE.md mục "Đề xuất chờ duyệt".

## 1. Bài toán
Người chơi cầu lông ở Đà Nẵng khó tìm sân trống đúng khung giờ; chủ sân quản lý đặt sân thủ công qua điện thoại/Zalo, dễ trùng lịch, không có kênh quảng bá tập trung.

## 2. Mục tiêu sản phẩm
Xây dựng website cho phép:
- Người chơi: tìm sân theo vị trí trên bản đồ (WebGIS), xem thông tin/giá/khung giờ trống, đặt sân trực tuyến.
- Chủ sân: đăng ký sân, quản lý lịch đặt, xác nhận/hủy booking.
- Quản trị viên: duyệt sân, quản lý người dùng, thống kê.

## 3. Phạm vi (IN SCOPE)
- Đăng ký / đăng nhập (người chơi, chủ sân, admin)
- CRUD thông tin sân (tên, địa chỉ, tọa độ, giá theo khung giờ, ảnh)
- Bản đồ Leaflet + OpenStreetMap: hiển thị sân, tìm sân gần vị trí
- Tìm kiếm & lọc: theo quận, giá, khung giờ trống
- Đặt sân theo khung giờ, chống trùng lịch (double-booking)
- Quản lý booking: xác nhận, hủy, lịch sử
- Trang quản trị (Django Admin tùy biến)
- Thống kê cơ bản cho chủ sân (số lượt đặt, doanh thu ước tính)

## 4. NGOÀI phạm vi (OUT OF SCOPE — AI không được tự thêm)
- Thanh toán trực tuyến thật (chỉ mô phỏng trạng thái "đã cọc/chưa cọc")
- Ứng dụng mobile native
- Chat realtime giữa người chơi và chủ sân
- Hệ thống đánh giá/review phức tạp (chỉ làm rating sao đơn giản nếu dư thời gian)
- Đa ngôn ngữ

## 5. Tech stack ĐÃ CHỐT (không đổi)
| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| Ngôn ngữ | Python 3.13 | Ổn định, tài liệu nhiều |
| Framework | Django 5.2 LTS | MVT, có sẵn auth + admin, hỗ trợ dài hạn |
| CSDL | SQLite (dev) → MySQL (production trên PythonAnywhere) | Đơn giản, đủ quy mô đồ án |
| Bản đồ | Leaflet.js + OpenStreetMap | Miễn phí, không cần API key trả phí |
| Frontend | Django Templates + Bootstrap 5 | Không phát sinh SPA phức tạp |
| Triển khai | PythonAnywhere | Free tier, hỗ trợ Django tốt |
| Quản lý mã | Git + GitHub | Minh chứng quá trình cho hội đồng |

## 6. Kiến trúc & quyết định đã chốt
- Mô hình MVT chuẩn Django, chia 3 app: `accounts`, `courts`, `bookings`.
- Chống trùng lịch bằng ràng buộc unique (court, date, time_slot) + transaction, kiểm tra ở tầng model, KHÔNG chỉ kiểm tra ở form.
- Tọa độ sân lưu 2 trường DecimalField (lat, lng), KHÔNG dùng GeoDjango/PostGIS (quá nặng so với nhu cầu, PythonAnywhere free không hỗ trợ tốt).
- Tìm sân gần: công thức Haversine tính ở Python, chấp nhận với quy mô < 500 sân.
- Ảnh sân: giới hạn dung lượng, lưu MEDIA_ROOT.

## 7. Ràng buộc pháp lý & dữ liệu
- Dữ liệu sân: tự khảo sát thực địa + nguồn công khai (Google Maps chỉ tham khảo tên/địa chỉ, KHÔNG scrape dữ liệu hàng loạt — vi phạm ToS).
- Dữ liệu cá nhân người dùng: tuân thủ Nghị định 13/2023/NĐ-CP — thu thập tối thiểu (tên, SĐT, email), có thông báo mục đích xử lý khi đăng ký, có chức năng xóa tài khoản.
- Bản đồ: ghi attribution OpenStreetMap theo giấy phép ODbL.

## 8. Tiêu chí nghiệm thu tổng thể (Definition of Done cấp dự án)
1. Demo trọn luồng: tìm sân trên bản đồ → xem chi tiết → đặt sân → chủ sân xác nhận → xem lịch sử.
2. Không thể tạo 2 booking trùng (court, date, slot) kể cả khi 2 người đặt đồng thời.
3. Website chạy thật trên PythonAnywhere với ≥ 10 sân dữ liệu thật ở Đà Nẵng.
4. Có ≥ 20 test case tài liệu hóa (bảng input – expected – actual) và toàn bộ pass.
5. Báo cáo đầy đủ 4–5 chương + slide bảo vệ + kịch bản demo 7–10 phút.
