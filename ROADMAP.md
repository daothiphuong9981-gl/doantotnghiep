# ROADMAP.md — Lộ trình 13 tuần (Ý tưởng → Sản phẩm + Báo cáo)
> Quy tắc: mỗi phiên làm việc với AI chỉ giao MỘT task. Task xong khi đạt "Tiêu chí hoàn thành". Cuối mỗi giai đoạn có CỔNG (GATE) — chưa qua cổng thì không sang giai đoạn sau.

---
## GIAI ĐOẠN 1 — Ý TƯỞNG & KHẢO SÁT KHẢ THI (Tuần 1–2)
Vai AI chính: Analyst. Đầu ra báo cáo: Chương 1.

- [x] 1.1 Khảo sát hiện trạng: liệt kê ≥ 15 sân cầu lông ở Đà Nẵng (tên, địa chỉ, cách nhận đặt sân hiện tại, giá tham khảo)
  - Tiêu chí: bảng khảo sát có nguồn (thực địa/điện thoại/fanpage), ghi ngày khảo sát
- [x] 1.2 Phân tích 3 giải pháp tương tự (VD: các app đặt sân thể thao hiện có) — điểm mạnh, điểm yếu, khoảng trống
  - Tiêu chí: bảng so sánh ≥ 5 tiêu chí, chỉ ra khoảng trống mà đề tài nhắm tới
- [x] 1.3 Nghiên cứu khả thi theo khung TELOS (Technical / Economic / Legal / Operational / Schedule)
  - Tiêu chí: mỗi chữ cái có kết luận Đạt/Không kèm bằng chứng
- [x] 1.4 PoC rủi ro cao nhất: 1 trang HTML hiển thị bản đồ Leaflet + 5 marker sân + popup thông tin
  - Tiêu chí: chạy được trên trình duyệt, chụp màn hình lưu EVIDENCE.md
- [x] 1.5 Chốt danh sách yêu cầu chức năng (FR) và phi chức năng (NFR), đánh mã FR-01, NFR-01...
  - Tiêu chí: mỗi FR có mô tả + độ ưu tiên (Must/Should/Could — MoSCoW)
- [x] 1.6 Viết nháp Chương 1 báo cáo (Đặt vấn đề, khảo sát, mục tiêu, phạm vi)

**GATE 1 — Thẩm định ý tưởng:** dùng AI vai Reviewer chấm theo checklist G1 (file AGENTS.md) + gửi giảng viên hướng dẫn duyệt phạm vi. ✅ Qua cổng khi: GVHD đồng ý phạm vi, PoC bản đồ chạy được.

---
## GIAI ĐOẠN 2 — PHÂN TÍCH & THIẾT KẾ (Tuần 3–4)
Vai AI chính: Architect + Reviewer. Đầu ra báo cáo: Chương 2 + 3.

- [x] 2.1 Use-case diagram tổng thể + đặc tả 5 use-case chính (đặt sân, quản lý sân, xác nhận booking, tìm kiếm, quản trị)
  - Tiêu chí: mỗi use-case có luồng chính + luồng ngoại lệ
- [x] 2.2 ERD hoàn chỉnh: User, CourtOwner, Court, TimeSlot/PriceRule, Booking, Review(nếu có)
  - Tiêu chí: có khóa chính/ngoại, ràng buộc unique chống trùng lịch thể hiện rõ
- [x] 2.3 Thiết kế MVT: sơ đồ 3 app, danh sách URL – View – Template chính
- [x] 2.4 Wireframe 6 màn hình chính (trang chủ+bản đồ, danh sách sân, chi tiết sân, form đặt, dashboard chủ sân, admin)
- [x] 2.5 Thiết kế luồng đặt sân chi tiết (sequence diagram) — xử lý trường hợp 2 người đặt cùng slot
- [x] 2.6 Viết Chương 2 (Cơ sở lý thuyết: Django MVT, WebGIS, Leaflet/OSM) + Chương 3 (Phân tích thiết kế)

- [x] **GATE 2 — Hội đồng thiết kế:** 2 phiên AI Reviewer độc lập chấm ERD + use-case theo checklist G2, tổng hợp lỗi, sửa xong mới code. ✅ Qua cổng khi: 0 lỗi nghiêm trọng, GVHD duyệt thiết kế.

---
## GIAI ĐOẠN 3 — XÂY DỰNG LÕI (Tuần 5–8)
Vai AI chính: Executor (+ Supervisor đối chiếu mỗi tuần). Đầu ra báo cáo: Chương 4 phần Cài đặt.

Tuần 5:
- [x] 3.1 Khởi tạo dự án Django: venv, requirements.txt, startproject, startapp (3 app), môi trường ảo
- [x] 3.2 Models + migrations theo đúng ERD đã duyệt (KHÔNG tự thêm trường)
  - Tiêu chí: `python manage.py check` sạch, admin đăng ký đủ model
- [x] 3.3 Auth: đăng ký/đăng nhập/phân quyền 3 vai (player, owner, admin)

Tuần 6:
- [x] 3.4 CRUD sân cho chủ sân (kèm upload ảnh, nhập tọa độ)
- [x] 3.5 Trang danh sách sân + trang chi tiết sân

Tuần 7:
- [x] 3.6 Tích hợp Leaflet: bản đồ trang chủ hiển thị toàn bộ sân, marker + popup, nút "sân gần tôi" (Haversine)
  - Tiêu chí: đúng như PoC nhưng dữ liệu lấy từ DB qua endpoint JSON
- [x] 3.7 Tìm kiếm & lọc (quận, giá, ngày + khung giờ trống)

Tuần 8:
- [x] 3.8 Luồng đặt sân: chọn ngày → hiện slot trống → đặt → trạng thái pending
  - Tiêu chí: unique constraint + transaction; viết test mô phỏng đặt đồng thời
- [x] 3.9 Dashboard chủ sân: xác nhận/hủy booking; người chơi xem lịch sử
- [x] 3.10 Cập nhật EVIDENCE.md: mỗi tính năng 1 ảnh màn hình + 3 dòng mô tả

**GATE 3 — Kiểm tra luồng:** AI Supervisor đối chiếu từng FR trong PROJECT.md với code thực tế, liệt kê FR thiếu/lệch. ✅ Qua cổng khi: 100% FR mức Must đã chạy.

---
## GIAI ĐOẠN 4 — HOÀN THIỆN & KIỂM THỬ (Tuần 9–10)
Vai AI chính: Tester (sinh test từ ĐẶC TẢ, không từ code). Đầu ra báo cáo: Chương 4 phần Kiểm thử.

- [x] 4.1 Sinh ≥ 20 test case từ use-case (bảng: mã TC – mô tả – input – expected)
- [x] 4.2 Thực thi test thủ công + unit test Django cho model Booking, ghi cột "actual + pass/fail"
- [x] 4.3 Sửa toàn bộ lỗi mức nghiêm trọng/cao; test hồi quy
- [x] 4.4 Kiểm tra pháp lý: thông báo thu thập dữ liệu cá nhân (NĐ 13/2023), attribution OSM, chức năng xóa tài khoản
- [x] 4.5 Hoàn thiện UI (Bootstrap, responsive cơ bản), viết phần Kiểm thử vào Chương 4

**GATE 4 — Cổng xuất xưởng:** toàn bộ test case pass, 0 lỗi nghiêm trọng còn mở.

---
## GIAI ĐOẠN 5 — TRIỂN KHAI (Tuần 11)
- [ ] 5.1 Deploy PythonAnywhere: MySQL, static/media, ALLOWED_HOSTS, DEBUG=False
- [ ] 5.2 Nhập dữ liệu thật ≥ 10 sân Đà Nẵng (từ khảo sát 1.1)
- [ ] 5.3 Nhờ 3–5 bạn dùng thử theo kịch bản, ghi nhận phản hồi (mini UAT)
- [ ] 5.4 Viết phần Triển khai vào Chương 4, chụp minh chứng website chạy thật

**GATE 5:** link công khai truy cập được, luồng đặt sân end-to-end chạy trên production.

---
## GIAI ĐOẠN 6 — BÁO CÁO & BẢO VỆ (Tuần 12–13)
Vai AI chính: Documenter + Reviewer.

- [ ] 6.1 Ghép chương, viết Kết luận + hướng phát triển, rà trích dẫn, format theo mẫu khoa
- [ ] 6.2 AI Reviewer đọc phản biện toàn bộ báo cáo như một thành viên hội đồng khó tính → sửa
- [ ] 6.3 Slide bảo vệ 12–15 trang + kịch bản demo 7–10 phút (có phương án dự phòng: video demo nếu mạng lỗi)
- [ ] 6.4 Soạn 15 câu hỏi phản biện dự kiến + đáp án (AI đóng vai hội đồng để tập vấn đáp)
- [ ] 6.5 Nộp: báo cáo, source code (GitHub), link website, slide

**GATE 6 — Bảo vệ thử:** demo trọn vẹn trước GVHD/bạn bè ít nhất 1 lần trước ngày bảo vệ chính thức.
