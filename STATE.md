# STATE.md — Trạng thái dự án (cập nhật cuối MỖI phiên làm việc)
> Đây là file AI đọc ĐẦU TIÊN mỗi phiên để biết nối tiếp từ đâu.

## Trạng thái hiện tại
- Giai đoạn: 4 — Kiểm thử & Hoàn thiện (ĐÃ HOÀN THÀNH - ĐẠT GATE 4) -> Chuẩn bị chuyển sang Giai đoạn 5 (Triển khai)
- Task đang làm: Hoàn thành 4.5 Hoàn thiện UI & viết Chương 4 Kiểm thử
- Task kế tiếp: 5.1 Deploy lên PythonAnywhere (MySQL, static/media, ALLOWED_HOSTS, DEBUG=False)

## Nhật ký phiên gần nhất
- Ngày: 20/07/2026
- Đã làm: Hoàn thành Task 4.5 (Hoàn thiện UI và Viết Chương 4 Kiểm thử):
  1. Hoàn thiện đồng bộ UI Bootstrap 5: cấu hình ánh xạ thông báo lỗi `MESSAGE_TAGS` trong `config/settings.py` khớp với class `alert-danger` của Bootstrap; kiểm tra cấu trúc responsive trên `base.html`, `court_map.html` và các trang booking.
  2. Rà soát, dọn dẹp lỗi dữ liệu trong `EVIDENCE.md` và cập nhật kết quả thực thi thực tế **ĐẠT (Pass/Unit Test)** cho toàn bộ 22/22 ca kiểm thử (100% pass, 0 lỗi nghiêm trọng).
  3. Soạn thảo toàn văn bản thảo học thuật cho **Chương 4: Kiểm thử và Đánh giá hệ thống** trong `EVIDENCE.md` (bao gồm: Mục tiêu & phương pháp kiểm thử, Kịch bản & kết quả thực thi 4 nhóm nghiệp vụ trọng yếu, Thống kê 100% pass rate, và Nhận xét đánh giá độ tin cậy của hệ thống).
  4. Hoàn tất toàn bộ tiêu chí của **GATE 4 (Cổng xuất xưởng)**. Tick hoàn thành Task 4.5 trong `ROADMAP.md`.
- Kết quả/đầu ra: `config/settings.py`, `EVIDENCE.md`, `ROADMAP.md`, `STATE.md`.

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
