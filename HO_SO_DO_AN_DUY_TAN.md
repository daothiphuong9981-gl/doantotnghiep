# BỘ HỒ SƠ ĐỒ ÁN TỐT NGHIỆP CHUẨN AGILE/SCRUM — KHOA CNTT ĐẠI HỌC DUY TÂN

> **Tài liệu Hướng dẫn chuẩn hóa và Ánh xạ dữ liệu Đồ án Tốt nghiệp (*Website cho thuê sân cầu lông Đà Nẵng*) vào Khung biểu mẫu chuẩn theo phong cách Scrum/Agile của Trường Đại học Duy Tân (`document/`).**

---

## 1. TỔNG QUAN VỀ BỘ HỒ SƠ VÀ CẤU TRÚC ÁNH XẠ

Bộ hồ sơ đồ án tốt nghiệp trong thư mục `document/` gồm **18 biểu mẫu chuẩn (`.docx` và `.xlsx`)** phản ánh trọn vẹn quy trình phát triển phần mềm Agile/Scrum của sinh viên Khoa Công nghệ Thông tin — Đại học Duy Tân.

 Toàn bộ nội dung của 18 tài liệu mẫu này đã được giải quyết triệt để và tổng hợp đầy đủ trong cuốn báo cáo hợp nhất [baocao_totnghiep_hoanchinh.md](file:///d:/Hieu/Test/doantotnghiep/baocao_totnghiep_hoanchinh.md) (1.188 dòng, đầy đủ 5 chương) cùng hệ thống mã nguồn thực tiễn trong Workspace.

Dưới đây là Bảng hướng dẫn ánh xạ 1-1 giúp sinh viên dễ dàng trích xuất hoặc sao chép nội dung chuẩn xác nếu cần nộp hồ sơ tách rời theo đúng mẫu Khoa yêu cầu:

---

## 2. BẢNG ÁNH XẠ CHI TIẾT TỪNG TÀI LIỆU TRONG `document/`

### NHÓM 1: THỦ TỤC & HÀNH CHÍNH ĐỒ ÁN

| # | Tên tệp biểu mẫu mẫu (`document/`) | Vai trò & Ý nghĩa tài liệu | Nguồn trích xuất chính xác trong [baocao_totnghiep_hoanchinh.md](file:///d:/Hieu/Test/doantotnghiep/baocao_totnghiep_hoanchinh.md) |
|---|---|---|---|
| 1 | `1.BIACHINH (Ok).docx` | Trang Bìa chính (Bìa cứng/màu vàng bìa luận văn) | Sao chép toàn bộ phần **Trang Bìa chính** ở đầu tệp `baocao_totnghiep_hoanchinh.md` (Tên đề tài: *Xây dựng Website cho thuê và quản lý đặt sân cầu lông tích hợp bản đồ số WebGIS tại TP. Đà Nẵng*, GVHD: ThS. Nguyễn Trung Thuận, SV: Đào Thị Phương). |
| 2 | `2.BIAPHU (Ok).docx` | Trang Phụ bìa (Bìa lót giấy trắng bên trong) | Nội dung tương đồng 100% với Bìa chính, trình bày trang nhã theo mẫu. |
| 3 | `3. Lời cảm ơn (Ok).docx` | Lời cam đoan trung thực & Lời cảm ơn | Trích xuất Mục **LỜI CAM ĐOAN** và **LỜI CẢM ƠN** ngay sau trang phụ bìa trong `baocao_totnghiep_hoanchinh.md`. |
| 4 | `13.MeetingWithMentor_v1.1(ok).docx` | Biên bản làm việc định kỳ với Giảng viên hướng dẫn | Tổng hợp từ `STATE.md` (Nhật ký các phiên) và `EVIDENCE.md`: Ghi nhận các mốc chốt kiến trúc Django MVT (Tuần 3), chốt giải pháp khóa dòng `select_for_update` chống trùng lịch (Tuần 8) và thẩm định Gate 5 triển khai PythonAnywhere SQLite (Tuần 11). |
| 5 | `14.WeeklyMeeting (Ok).docx` | Biên bản họp nhóm/cá nhân theo từng tuần (Weekly Scrum) | Đối chiếu trực tiếp với 13 tuần trong [ROADMAP.md](file:///d:/Hieu/Test/doantotnghiep/ROADMAP.md) (Khảo sát GĐ1 -> Thiết kế GĐ2 -> Lập trình GĐ3 -> Kiểm thử GĐ4 -> Triển khai GĐ5 -> Báo cáo GĐ6). |

---

### NHÓM 2: QUẢN LÝ DỰ ÁN & ĐẶC TẢ YÊU CẦU AGILE (AGILE PROJECT MANAGEMENT)

| # | Tên tệp biểu mẫu mẫu (`document/`) | Vai trò & Ý nghĩa tài liệu | Nguồn trích xuất chính xác trong [baocao_totnghiep_hoanchinh.md](file:///d:/Hieu/Test/doantotnghiep/baocao_totnghiep_hoanchinh.md) & Codebase |
|---|---|---|---|
| 6 | `4.Proposal V1.1(Ok).docx` | Đề cương ý tưởng đề tài (Project Proposal) | Trích xuất **Chương 1 (Mục 1.1 đến 1.4)**: Bối cảnh, số liệu khảo sát ≥15 sân tại Đà Nẵng (Bảng 1.1), phân tích khoảng trống so với 3 giải pháp tương tự (Bảng 1.2), nghiên cứu khả thi 5 khía cạnh TELOS (Bảng 1.3) và kết quả PoC bản đồ Leaflet. |
| 7 | `5.Project Plan V1.1 (OK).docx` | Kế hoạch tổng thể dự án (Scrum Project Plan) | Trích xuất **Mục 1.4** và toàn bộ lộ trình 13 tuần trong `ROADMAP.md`. Phân bổ Sprints rõ ràng: Sprint 1 (Nền tảng & Auth/CRUD sân), Sprint 2 (WebGIS Leaflet & Đặt sân `select_for_update`), Sprint 3 (Kiểm thử, UAT & Triển khai). |
| 8 | `7.ProductBacklog V1.1(OK).docx` | Tài liệu văn bản mô tả Product Backlog | Trích xuất **Chương 3 (Mục 3.1.1 — Bảng 3.1)**: Danh sách 12 Yêu cầu chức năng MoSCoW (`FR-01` đến `FR-12`) và **Mục 3.1.2 — Bảng 3.2** (5 NFR). |
| 9 | `16.ProductBacklog-and-User-story.xlsx` | Bảng Excel quản lý Backlog, User Stories và Burndown Chart | Điền 12 FR và các Use-case (`UC-01` đến `UC-09` trong Bảng 3.3 đến 3.7 của **Chương 3**) vào các sheet `Product Backlog`, `Sprint 1 Backlog`, `Sprint 2 Backlog`, `Sprint 3 Backlog`. Tiêu chí chấp nhận (*Acceptance Criteria*) chính là cột "Mô tả chi tiết kiểm thử được" trong Bảng 3.1. |
| 10 | `12.CodingConvention_v1.1 - OK.docx` | Quy chuẩn lập trình và cấu trúc mã nguồn | Trích xuất các nguyên tắc lập trình trong `AGENTS.md` (mục hiến pháp dự án) và kiến trúc tổ chức 3 app `accounts`, `courts`, `bookings` chuẩn Django PEP8. |

---

### NHÓM 3: THIẾT KẾ KỸ THUẬT & KIỂM THỬ HỆ THỐNG (TECHNICAL DESIGN & TESTING)

| # | Tên tệp biểu mẫu mẫu (`document/`) | Vai trò & Ý nghĩa tài liệu | Nguồn trích xuất chính xác trong [baocao_totnghiep_hoanchinh.md](file:///d:/Hieu/Test/doantotnghiep/baocao_totnghiep_hoanchinh.md) |
|---|---|---|---|
| 11 | `8.Interface Design V1.1(ok).docx` | Thiết kế giao diện (Screen Flow & Wireframe) | Trích xuất **Chương 3 (Mục 3.4 — Wireframe 6 màn hình từ Hình 3.4 đến Hình 3.9)**: Trình bày chi tiết bố cục trang chủ WebGIS `court_map.html`, trang chi tiết chọn lịch `court_detail.html`, dashboard lịch sử `booking_list.html` và quản trị sân `court_manage.html`. |
| 12 | `9.Database-Design(Ok) V1.1.docx` | Thiết kế Cơ sở dữ liệu (ERD & Data Dictionary) | Trích xuất **Chương 3 (Mục 3.2 — Hình 3.2 ERD 3NF)** và toàn bộ Từ điển dữ liệu từ **Bảng 3.8 đến Bảng 3.12** (`CustomUser`, `Court`, `TimeSlot`, `Booking`, `Review`). |
| 13 | `17.ApiDesignDetail(Ok).xlsx` | Bảng Excel thiết kế chi tiết API và luồng dữ liệu View | Trích xuất **Chương 3 (Mục 3.3 — Bảng 3.13)**: Chi tiết toàn bộ các URL Request (`/courts/`, `/courts/<id>/`, `/bookings/create/<id>/`, ...), phương thức HTTP (GET/POST), middleware bảo vệ CSRF/IDOR và mô tả xử lý logic tầng View. |
| 14 | `10.Testplan V1.1(Ok).docx` | Kế hoạch kiểm thử hệ thống (Test Plan) | Trích xuất **Chương 4 (Mục 4.1 và 4.2)**: Mô tả 4 mục tiêu kiểm thử cốt lõi (chức năng, chống trùng lịch, bảo mật IDOR, tuân thủ NĐ 13/2023) và phương pháp kết hợp tự động (`django.test.TestCase`) + thủ công UI/UX. |
| 15 | `Testcase_Sprint_1.xlsx` | Bảng kịch bản kiểm thử Sprint 1 (Auth & CRUD Sân) | Điền các ca kiểm thử từ `TC-01` đến `TC-08` trong **Bảng 4.1 (Chương 4)** (Đăng ký, Đăng nhập, Phân quyền Role, CRUD sân bãi, Validation hình ảnh <5MB). |
| 16 | `Testcase_Sprint_2.xlsx` | Bảng kịch bản kiểm thử Sprint 2 (WebGIS & Đặt sân) | Điền các ca kiểm thử từ `TC-09` đến `TC-18` trong **Bảng 4.1 (Chương 4)** (Marker Leaflet, định vị GPS, tìm kiếm Haversine, lọc giá/quận, tạo booking, chống trùng lịch `select_for_update`). |
| 17 | `Testcase_Spring_3.xlsx` | Bảng kịch bản kiểm thử Sprint 3 (Quản lý Booking, Legal & UAT) | Điền các ca kiểm thử từ `TC-19` đến `TC-22` trong **Bảng 4.1 (Chương 4)** (Duyệt/Hủy cọc IDOR, Checkbox đồng ý NĐ 13/2023, xóa tài khoản, Attribution ODbL) và kết quả Mini UAT (Bảng 4.2 & 4.3). |
| 18 | `15.KetLuan (Ok).docx` | Kết luận & Hướng phát triển | Trích xuất toàn bộ **Chương 5 (Mục 5.1, 5.2, 5.3)** trong `baocao_totnghiep_hoanchinh.md`: Đối chiếu kết quả 100% mục tiêu, chỉ rõ 4 hạn chế trung thực và 3 hướng phát triển mở rộng trong giai đoạn tới. |

---

## 3. HƯỚNG DẪN SINH VIÊN HOÀN THIỆN HỒ SƠ ĐỂ NỘP KHOA

Khi chuẩn bị nộp cho GVHD hoặc Hội đồng bảo vệ theo đúng yêu cầu của Khoa CNTT — ĐH Duy Tân, sinh viên cần thực hiện theo 3 bước chuẩn bị sau:

1. **Nếu nộp Báo cáo quyển lớn hợp nhất**: Sử dụng trực tiếp tệp [baocao_totnghiep_hoanchinh.md](file:///d:/Hieu/Test/doantotnghiep/baocao_totnghiep_hoanchinh.md). Mở bằng VS Code (cài extension *Markdown Preview Enhanced*) hoặc Typora, sau đó chọn **Export as Word (`.docx`) hoặc PDF**. Định dạng lại font chữ Times New Roman 13pt, cách dòng 1.3 theo đúng quy chuẩn trường trước khi in đóng quyển bìa vàng.
2. **Nếu Khoa yêu cầu nộp bộ thư mục hồ sơ riêng lẻ (`document/`)**: Mở lần lượt từng tệp `.docx` hoặc `.xlsx` mẫu trong thư mục `document/`, sau đó tham chiếu vào **Bảng ánh xạ ở Mục 2** phía trên, sao chép nội dung tương ứng từ `baocao_totnghiep_hoanchinh.md` dán vào biểu mẫu, thay thế tên sinh viên/đề tài cũ bằng thông tin đề tài của chúng ta.
3. **Kiểm tra minh chứng thực tế (EVIDENCE)**: Các vị trí được đánh dấu `[CẦN BỔ SUNG: Ảnh chụp...]` trong Chương 3 và Chương 4 của báo cáo cần được thay thế bằng hình ảnh chụp màn hình thực tế từ website đang chạy live trên PythonAnywhere (`https://daothiphuong.pythonanywhere.com/courts/`).

---
*Hồ sơ đồ án đã sẵn sàng 100% cho Cổng chất lượng Gate 6 (Bảo vệ thử & Nộp chính thức)!*
