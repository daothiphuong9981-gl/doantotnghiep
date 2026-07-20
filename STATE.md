# STATE.md — Trạng thái dự án (cập nhật cuối MỖI phiên làm việc)
> Đây là file AI đọc ĐẦU TIÊN mỗi phiên để biết nối tiếp từ đâu.

## Trạng thái hiện tại
- Giai đoạn: 5 — Triển khai (Đang thực hiện Tuần 11)
- Task đang làm: Hoàn thành 5.2 Nhập dữ liệu thật ≥ 10 sân Đà Nẵng từ khảo sát 1.1 và chuẩn hóa tọa độ WebGIS l10n
- Task kế tiếp: 5.3 Nhờ 3–5 bạn dùng thử theo kịch bản, ghi nhận phản hồi (mini UAT)

## Nhật ký phiên gần nhất
- Ngày: 20/07/2026 (Phiên 3)
- Đã làm: Hoàn thành Task 5.2 (Nhập dữ liệu thực tế 16 sân cầu lông Đà Nẵng & Chuẩn hóa định dạng tọa độ WebGIS):
  1. Xây dựng lệnh tự động hóa `courts/management/commands/seed_danang_courts.py` với cơ chế an toàn Idempotent và bọc mã hóa UTF-8 cho Console. Nạp thành công 8 tài khoản mẫu (4 Chủ sân, 4 Người chơi), 16 cụm sân thực tế tại 6 quận Đà Nẵng (Hải Châu, Sơn Trà, Thanh Khê, Cẩm Lệ, Liên Chiểu, Ngũ Hành Sơn) theo kết quả khảo sát Task 1.1 trong `EVIDENCE.md` kèm 80 khung giờ, đơn đặt sân mẫu ở đủ trạng thái (PENDING, CONFIRMED) và bình luận đánh giá sao.
  2. Phân tích và khắc phục triệt để lỗi hiển thị tất cả các sân bị trùng khít về 1 vị trí (`[16.0000, 108.0000]`) trên bản đồ Leaflet. Nguyên nhân do `USE_L10N = True` khiến Django định dạng số thập phân thành dấu phẩy `,` (`16,064512`), làm hàm `parseFloat` của JavaScript cắt bỏ đuôi thập phân. Đã bổ sung `{% load l10n %}` và `|unlocalize` vào toàn bộ template (`court_detail.html`, `court_map.html`, `court_form.html`), đảm bảo tọa độ luôn xuất ra dấu chấm chuẩn quốc tế (`.`).
  3. Đẩy code lên kho chứa GitHub chính thức (`0c44c52`, `2c1be00`), hướng dẫn sinh viên pull code và nghiệm thu thành công trên máy chủ Production PythonAnywhere.
- Kết quả/đầu ra: `courts/management/commands/seed_danang_courts.py`, `templates/courts/court_detail.html`, `templates/courts/court_map.html`, `templates/courts/court_form.html`, `ROADMAP.md`, `STATE.md`, `EVIDENCE.md`.

- Ngày: 20/07/2026 (Phiên 2)
- Đã làm: Hoàn thành Task 5.1 (Deploy lên PythonAnywhere sử dụng CSDL SQLite):
  1. Phân tích chính sách mới từ 01/2026 của PythonAnywhere (cắt bỏ MySQL khỏi tài khoản miễn phí Beginner). Đề xuất và được sinh viên phê duyệt Phương án A (sử dụng `db.sqlite3` làm CSDL production trên PythonAnywhere, tiết kiệm chi phí $0/tháng). Ghi chốt quyết định vào `STATE.md` và `DEPLOY_PYTHONANYWHERE.md`.
  2. Cập nhật cấu hình `config/settings.py` (tự động đọc `.env`, logic chuyển đổi DB linh hoạt) và `requirements.txt` (định dạng UTF-8, bổ sung `python-dotenv`, `mysqlclient`, `PyMySQL`).
  3. Hướng dẫn sinh viên đẩy code lên kho chứa GitHub chuẩn `main` (`https://github.com/daothiphuong9981-gl/doantotnghiep.git`), gộp lịch sử commit khởi tạo và xử lý thành công lỗi WSGI (`ModuleNotFoundError: No module named 'config'`).
  4. Khắc phục lỗi hiển thị ô gạch bản đồ bị chặn (`403 Access Blocked - osm.wiki/Blocked`) bằng cách thêm `<meta name="referrer" content="strict-origin-when-cross-origin">` vào `base.html`, cập nhật `referrerPolicy` trong Leaflet (`court_map.html`, `court_detail.html`, `poc_map.html`), đồng thời tích hợp cơ chế tự động dự phòng sang máy chủ OpenStreetMap Germany (`tile.openstreetmap.de`).
  5. Website vận hành thành công thực tế trên PythonAnywhere tại đường dẫn công khai `https://daothiphuong.pythonanywhere.com/courts/`. Tick hoàn thành Task 5.1 trong `ROADMAP.md`.
- Kết quả/đầu ra: `config/settings.py`, `requirements.txt`, `DEPLOY_PYTHONANYWHERE.md`, `templates/base.html`, `templates/courts/court_map.html`, `templates/courts/court_detail.html`, `poc_map.html`, `ROADMAP.md`, `STATE.md`.

- Ngày: 06/07/2026
- Đã làm: Viết và chạy thử nghiệm thành công script Python `download_guidelines.py` để tải tài liệu Quy chuẩn dạng PDF từ trang Sau đại học ĐH Duy Tân. Tiếp tục viết và thực thi script `convert_pdf.py` sử dụng thư viện `pypdf` để chuyển đổi tệp PDF này sang định dạng `.txt` (văn bản thô) và `.md` (Markdown được tái cấu trúc phân cấp tiêu đề bằng regex).
- Kết quả/đầu ra: Tệp script `convert_pdf.py`, file văn bản [quy_chuan_trinh_bay.txt](file:///d:/Hieu/Download/quy_chuan_trinh_bay.txt) và file Markdown [quy_chuan_trinh_bay.md](file:///d:/Hieu/Download/quy_chuan_trinh_bay.md) trong thư mục `d:\Hieu\Download`.

- Ngày: 03/07/2026
- Đã làm: Hoàn thành Task 4.3. Khắc phục cảnh báo trùng lặp namespace 'courts' (urls.W005) trong config/urls.py bằng cách map trực tiếp view court_map vào root URL, loại bỏ include trùng lặp. Chạy test hồi quy thành công.
- Kết quả/đầu ra: Tệp config/urls.py được cập nhật sạch sẽ không còn cảnh báo.

## Vấn đề tồn đọng (blocker)
- (trống)

## Đề xuất chờ duyệt (AI ghi vào đây, KHÔNG tự sửa PROJECT.md)
| Ngày | Đề xuất | Lý do | Quyết định của tôi |
|---|---|---|---|
| | | | Chờ duyệt |

## Quyết định đã duyệt trong quá trình làm (bổ sung cho PROJECT.md)
- [20/07/2026] **Quyết định chốt CSDL Production trên PythonAnywhere**: Sử dụng **SQLite (`db.sqlite3`)** thay cho MySQL đối với tài khoản Beginner miễn phí ($0/tháng) trên PythonAnywhere (do chính sách từ 01/2026 của PythonAnywhere cắt bỏ MySQL khỏi gói miễn phí tạo mới). SQLite đáp ứng trọn vẹn yêu cầu kiểm thử đồng thời (`select_for_update` + `UniqueConstraint`) và không phát sinh chi phí duy trì.

---
### Mẫu prompt MỞ ĐẦU mỗi phiên (copy dùng):
> Đọc PROJECT.md, ROADMAP.md, STATE.md đính kèm. Hôm nay chỉ làm task [số hiệu] trong ROADMAP. Không làm gì ngoài phạm vi task này. Nếu phát hiện cần thay đổi thiết kế, ghi vào mục "Đề xuất chờ duyệt" thay vì tự sửa. Trước khi làm, tóm tắt lại task và tiêu chí hoàn thành để tôi xác nhận.

### Mẫu prompt KẾT THÚC mỗi phiên (copy dùng):
> Cập nhật STATE.md: đã làm gì, đầu ra, vấn đề tồn đọng, task kế tiếp. Tick các mục hoàn thành trong ROADMAP.md (chỉ tick khi đạt đủ tiêu chí). Nếu task thuộc giai đoạn có nộp báo cáo, draft phần báo cáo tương ứng dựa trên EVIDENCE.md.
