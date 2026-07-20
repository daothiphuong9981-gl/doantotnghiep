# PROMPTS — Giai đoạn 2: Phân tích & Thiết kế
> Cách dùng: mỗi tiểu mục = một phiên chat riêng. Đính kèm PROJECT.md, ROADMAP.md, STATE.md, AGENTS.md, EVIDENCE.md + đầu ra đã duyệt của Giai đoạn 1 (đặc biệt bảng FR/NFR ở task 1.5). Dán khối prompt tương ứng.
> Điều kiện tiên quyết: Gate 1 đã ĐẠT. Nếu chưa, quay lại hoàn thành Giai đoạn 1 trước.

---

## PROMPT MỞ ĐẦU (dán trước MỌI phiên trong giai đoạn 2)
```
Bạn đóng vai ARCHITECT theo AGENTS.md. Đọc PROJECT.md, ROADMAP.md, STATE.md và bảng FR/NFR (task 1.5) trước.
Nguyên tắc bắt buộc:
- Thiết kế theo ĐÚNG tech stack đã chốt ở PROJECT.md mục 5. KHÔNG đề xuất đổi công nghệ.
- Mọi thành phần thiết kế phải TRUY VẾT được về một FR cụ thể (ghi rõ "phục vụ FR-xx"). Không thiết kế thứ không phục vụ FR nào.
- Ưu tiên đơn giản nhất có thể chạy được (KISS) — đây là đồ án 13 tuần cho 1 người, không phải hệ thống triệu user.
- Trước khi làm, tóm tắt task + tiêu chí hoàn thành để tôi xác nhận, rồi mới thực hiện.
- Nếu phát hiện FR ở Giai đoạn 1 mâu thuẫn/thiếu, ghi vào "Đề xuất chờ duyệt" (STATE.md), không tự sửa.
```

---

## Task 2.1 — Use-case diagram & đặc tả use-case
```
TASK 2.1 — Use-case tổng thể + đặc tả 5 use-case chính.
1. Lập danh sách actor (Player, Court Owner, Admin) và toàn bộ use-case của họ, ánh xạ mỗi use-case về FR tương ứng.
2. Vẽ use-case diagram bằng cú pháp PlantUML hoặc Mermaid (để tôi render ra hình đưa vào báo cáo).
3. Đặc tả chi tiết 5 use-case quan trọng nhất: Đặt sân, Quản lý sân (CRUD), Xác nhận/hủy booking, Tìm kiếm sân, Quản trị hệ thống. Mỗi đặc tả gồm: mã UC, actor, tiền điều kiện, luồng sự kiện chính, các luồng ngoại lệ, hậu điều kiện.
Lưu ý luồng ngoại lệ của "Đặt sân" PHẢI có: slot đã bị người khác đặt, mất kết nối giữa chừng, người dùng chưa đăng nhập.
Tiêu chí hoàn thành: diagram render được + 5 đặc tả có đủ luồng chính và ngoại lệ.
```

## Task 2.2 — Thiết kế cơ sở dữ liệu (ERD)
```
TASK 2.2 — ERD hoàn chỉnh.
Thiết kế mô hình dữ liệu phục vụ toàn bộ FR:
1. Liệt kê các thực thể: User (mở rộng cho 3 vai), Court, CourtImage, PriceRule/TimeSlot, Booking, và Review (chỉ nếu FR có, đúng phạm vi).
2. Với mỗi thực thể: thuộc tính, kiểu dữ liệu (khớp Django field), khóa chính, khóa ngoại, ràng buộc.
3. Thể hiện RÕ ràng buộc unique chống trùng lịch: (court, ngày, khung giờ) — giải thích nó chặn double-booking ở tầng DB thế nào.
4. Nêu quan hệ (1-n, n-n) và cách hiện thực trong Django (ForeignKey, ManyToMany, related_name).
5. Vẽ ERD bằng Mermaid erDiagram để render vào báo cáo.
6. Lưu ý lưu tọa độ bằng 2 DecimalField (lat, lng) theo PROJECT.md — KHÔNG dùng GeoDjango.
Tiêu chí hoàn thành: ERD render được, có ràng buộc unique chống trùng, mọi thực thể truy vết về FR.
```

## Task 2.3 — Thiết kế kiến trúc MVT
```
TASK 2.3 — Kiến trúc MVT & phân rã 3 app.
1. Sơ đồ tổng thể kiến trúc MVT của Django cho dự án (Model – View – Template + luồng request/response), vẽ bằng Mermaid.
2. Phân chia trách nhiệm 3 app: accounts, courts, bookings — mỗi app quản model nào, chịu trách nhiệm gì.
3. Lập bảng định tuyến: URL – View (tên) – Template – Quyền truy cập (player/owner/admin/công khai) cho các chức năng chính.
4. Chỉ rõ tầng nào kiểm tra chống trùng lịch (nhắc lại: kiểm ở MODEL + transaction, không chỉ ở form).
5. Nêu cách xử lý dữ liệu bản đồ: endpoint trả JSON danh sách sân cho Leaflet gọi.
Tiêu chí hoàn thành: bảng URL–View–Template–Quyền đầy đủ cho FR mức Must.
```

## Task 2.4 — Wireframe giao diện
```
TASK 2.4 — Wireframe 6 màn hình chính.
Thiết kế wireframe (bố cục khung, không cần màu mè) cho: (1) Trang chủ + bản đồ, (2) Danh sách sân + bộ lọc, (3) Chi tiết sân, (4) Form đặt sân, (5) Dashboard chủ sân, (6) Trang quản trị.
Với mỗi màn hình:
- Mô tả bố cục bằng sơ đồ khối (ASCII art hoặc mô tả vùng: header, sidebar, nội dung chính...).
- Liệt kê các thành phần UI và hành động, ánh xạ về use-case/FR.
- Ghi rõ dữ liệu hiển thị lấy từ đâu (model nào).
Nếu có thể, xuất kèm mã HTML wireframe đơn giản (Bootstrap, chưa cần logic) để tôi hình dung.
Tiêu chí hoàn thành: 6 wireframe khớp use-case, mỗi thành phần truy vết về FR.
```

## Task 2.5 — Thiết kế luồng đặt sân (sequence diagram)
```
TASK 2.5 — Sequence diagram luồng đặt sân + xử lý đồng thời.
Đây là phần lõi kỹ thuật hội đồng hay soi nhất.
1. Vẽ sequence diagram (Mermaid) luồng đặt sân: Player → chọn sân/ngày → hệ thống hiện slot trống → chọn slot → xác nhận → tạo Booking (pending) → thông báo chủ sân.
2. Vẽ kịch bản ĐỒNG THỜI: 2 người cùng đặt 1 slot trong cùng thời điểm — thể hiện transaction + unique constraint chặn người thứ 2 thế nào, thông báo lỗi ra sao.
3. Giải thích cơ chế: select_for_update / atomic transaction / IntegrityError được bắt và xử lý.
4. Nêu vòng đời trạng thái Booking: pending → confirmed → cancelled/completed (state diagram).
Tiêu chí hoàn thành: 2 sequence diagram (bình thường + đồng thời) + giải thích cơ chế chống trùng.
```

## Task 2.6 — Viết Chương 2 & Chương 3 báo cáo
```
TASK 2.6 — Draft Chương 2 và Chương 3 (đóng thêm vai DOCUMENTER).
Dựa DUY NHẤT trên đầu ra thật của 2.1–2.5 (tôi sẽ dán vào), viết:
CHƯƠNG 2 — CƠ SỞ LÝ THUYẾT:
2.1 Kiến trúc MVT của Django
2.2 WebGIS và bản đồ số (Leaflet, OpenStreetMap, hệ tọa độ, giấy phép ODbL)
2.3 Công thức Haversine tính khoảng cách
2.4 Cơ chế giao dịch (transaction) và toàn vẹn dữ liệu trong CSDL
CHƯƠNG 3 — PHÂN TÍCH & THIẾT KẾ HỆ THỐNG:
3.1 Phân tích yêu cầu (tóm tắt FR/NFR)
3.2 Biểu đồ use-case và đặc tả
3.3 Thiết kế cơ sở dữ liệu (ERD)
3.4 Thiết kế kiến trúc (MVT, 3 app, định tuyến)
3.5 Thiết kế giao diện (wireframe)
3.6 Thiết kế luồng đặt sân
Văn phong học thuật tiếng Việt. Mọi hình/bảng đánh số và được nhắc trong lời văn. Chỗ thiếu dữ liệu đánh [CẦN BỔ SUNG: ...], KHÔNG bịa.
Tiêu chí hoàn thành: nháp Chương 2 + 3 hoàn chỉnh, bám sát thiết kế thật.
```

---

## PROMPT ĐÓNG PHIÊN (dán sau mỗi task)
```
Kết thúc phiên:
1. Cập nhật STATE.md: task nào, đầu ra, tồn đọng, task kế tiếp.
2. Tick mục tương ứng trong ROADMAP.md CHỈ KHI đạt đủ tiêu chí; chưa đủ thì ghi rõ còn thiếu.
3. Lưu diagram/ERD/wireframe vào EVIDENCE.md mục Giai đoạn 2 (kèm ghi chú phiên bản).
4. Phát sinh cần đổi PROJECT.md → ghi "Đề xuất chờ duyệt", không tự sửa.
Xuất lại STATE.md sau khi cập nhật.
```

---

## GATE 2 — Hội đồng thiết kế (chạy sau khi xong 2.1–2.6, đổi sang vai REVIEWER)
```
Bạn đổi sang vai REVIEWER/HỘI ĐỒNG theo AGENTS.md. Chấm toàn bộ thiết kế Giai đoạn 2 (tôi dán bên dưới) theo Checklist G2 trong AGENTS.md.
Soi kỹ:
- Mỗi FR mức Must có ánh xạ được vào ≥1 use-case và ≥1 màn hình không? (chỉ ra FR bị "mồ côi")
- ERD có ràng buộc unique (court, ngày, slot) chống trùng lịch không?
- Luồng đặt sân có xử lý được đặt đồng thời không (transaction thể hiện trong sequence diagram)?
- Có thành phần thiết kế THỪA không phục vụ FR nào không?
Mỗi mục kết luận Đạt/Chưa đạt + lý do. Phân loại lỗi Nghiêm trọng/Cao/Trung bình/Gợi ý.
Kết thúc: bảng tổng hợp + kết luận ĐẠT/CHƯA ĐẠT Gate 2. Chưa đạt thì liệt kê việc phải sửa trước khi code (Giai đoạn 3).
(Gợi ý: chạy 2 phiên Reviewer độc lập rồi so — lỗi cả 2 cùng bắt là chắc chắn phải sửa.)
```
