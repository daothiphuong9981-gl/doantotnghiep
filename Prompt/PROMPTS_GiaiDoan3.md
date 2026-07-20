# PROMPTS — Giai đoạn 3: Xây dựng lõi (Tuần 5–8)
> Cách dùng: mỗi tiểu mục = một phiên chat riêng. Đính kèm PROJECT.md, ROADMAP.md, STATE.md, AGENTS.md, EVIDENCE.md + toàn bộ thiết kế đã duyệt ở Giai đoạn 2 (ERD, use-case, bảng URL–View–Template, sequence diagram).
> Điều kiện tiên quyết: Gate 2 đã ĐẠT (0 lỗi nghiêm trọng, thiết kế được duyệt). Chưa đạt thì KHÔNG bắt đầu code.

---

## PROMPT MỞ ĐẦU (dán trước MỌI phiên trong giai đoạn 3)
```
Bạn đóng vai EXECUTOR theo AGENTS.md. Đọc PROJECT.md, ROADMAP.md, STATE.md và thiết kế đã duyệt ở Giai đoạn 2 trước.
Nguyên tắc bắt buộc:
- Thực thi ĐÚNG MỘT task tôi giao, theo đúng thiết kế đã duyệt. KHÔNG tự đổi schema, KHÔNG thêm tính năng ngoài FR, KHÔNG refactor ngoài phạm vi.
- Nếu thiết kế có vấn đề khi hiện thực, DỪNG lại báo cáo + ghi "Đề xuất chờ duyệt" (STATE.md), không tự ý sửa thiết kế.
- Code phải kèm giải thích ngắn từng phần để tôi HIỂU và tự bảo vệ được trước hội đồng — tôi là người phải trả lời, không phải bạn.
- Tuân thủ quy ước Django 5.2 / Python 3.13. Code sạch, có comment tiếng Việt ở chỗ quan trọng.
- Trước khi code, tóm tắt task + tiêu chí hoàn thành + các file sẽ tạo/sửa để tôi xác nhận.
```

---

## TUẦN 5 — Nền tảng

## Task 3.1 — Khởi tạo project Django & cấu trúc
```
TASK 3.1 — Khởi tạo dự án.
Hướng dẫn tôi TỪNG BƯỚC (tôi tự gõ lệnh, bạn giải thích):
1. Tạo môi trường ảo (venv), cài Django 5.2 + Pillow, tạo requirements.txt.
2. Khởi tạo project + 3 app: accounts, courts, bookings (đúng PROJECT.md).
3. Cấu hình settings: INSTALLED_APPS, ngôn ngữ vi, múi giờ Asia/Ho_Chi_Minh, cấu hình static & media.
4. Khởi tạo Git, viết .gitignore chuẩn Python/Django, commit đầu tiên.
5. Cấu trúc thư mục templates & static dùng chung.
Giải thích mỗi lệnh làm gì. Cuối cùng cho tôi checklist tự kiểm tra "chạy được server trống".
Tiêu chí hoàn thành: `python manage.py runserver` chạy, 3 app đăng ký, Git có commit đầu.
```

## Task 3.2 — Models & migrations theo ERD
```
TASK 3.2 — Viết models theo ĐÚNG ERD đã duyệt.
1. Viết models cho 3 app khớp 100% ERD ở task 2.2. KHÔNG tự thêm/bớt trường; nếu thấy ERD thiếu, báo cáo trước.
2. Model Booking PHẢI có ràng buộc unique (court, date, time_slot) qua Meta.constraints (UniqueConstraint) — đây là lớp chống trùng lịch ở tầng DB.
3. Tọa độ sân: 2 DecimalField (latitude, longitude) đúng PROJECT.md.
4. Đăng ký toàn bộ model vào admin, tùy biến list_display cơ bản.
5. Tạo & chạy migrations, hướng dẫn tôi kiểm tra bằng `manage.py check` và xem bảng trong DB.
Kèm giải thích: vì sao dùng UniqueConstraint thay vì unique_together, related_name đặt thế nào.
Tiêu chí hoàn thành: `manage.py check` sạch, migrate thành công, admin hiện đủ model, ràng buộc unique tồn tại trong DB.
```

## Task 3.3 — Xác thực & phân quyền 3 vai
```
TASK 3.3 — Auth & phân quyền (player / owner / admin).
1. Thiết kế cách phân biệt 3 vai: dùng custom User (mở rộng AbstractUser) HOẶC Profile + field role — chọn 1, giải thích ưu nhược, theo thiết kế đã duyệt.
2. Chức năng đăng ký (có chọn vai player/owner), đăng nhập, đăng xuất — dùng Django auth sẵn có, template Bootstrap.
3. Phân quyền truy cập: decorator/mixin chặn player vào dashboard owner, chặn chưa đăng nhập đặt sân (khớp bảng quyền ở task 2.3).
4. Khi đăng ký: hiển thị thông báo mục đích thu thập dữ liệu cá nhân (NĐ 13/2023) — chuẩn bị sẵn cho Gate 4.
Kèm giải thích cơ chế session/login của Django để tôi bảo vệ được.
Tiêu chí hoàn thành: đăng ký/đăng nhập 3 vai chạy, phân quyền chặn đúng, có thông báo dữ liệu cá nhân.
```

---

## TUẦN 6 — Quản lý sân

## Task 3.4 — CRUD sân cho chủ sân
```
TASK 3.4 — CRUD Court (dành cho vai owner).
1. Form thêm/sửa sân: tên, địa chỉ, quận, tọa độ (lat/lng), giá theo khung giờ, mô tả, upload nhiều ảnh (Pillow).
2. Chủ sân chỉ xem/sửa/xóa sân CỦA MÌNH (kiểm quyền sở hữu, không chỉ ẩn nút).
3. Xóa: cân nhắc soft-delete (đánh dấu inactive) thay vì xóa cứng nếu sân đã có booking — giải thích lựa chọn.
4. Validate: tọa độ trong khoảng hợp lệ, giá > 0, ảnh giới hạn dung lượng.
Nhắc: chỉ làm đúng FR CRUD sân, không thêm tính năng ngoài phạm vi.
Tiêu chí hoàn thành: owner tạo/sửa/xóa được sân của mình, không đụng sân người khác, validate hoạt động.
```

## Task 3.5 — Danh sách & chi tiết sân
```
TASK 3.5 — Trang danh sách sân + trang chi tiết.
1. Trang danh sách: hiển thị các sân (ảnh, tên, quận, giá từ), phân trang.
2. Trang chi tiết: thông tin đầy đủ, gallery ảnh, vị trí (nhúng bản đồ mini Leaflet 1 marker), nút "Đặt sân".
3. Dữ liệu lấy từ model theo thiết kế MVT ở task 2.3, template kế thừa base.html.
Chưa cần bộ lọc (task 3.7) và chưa cần logic đặt (task 3.8) — chỉ hiển thị + nút dẫn hướng.
Tiêu chí hoàn thành: xem được danh sách & chi tiết sân với dữ liệu thật từ DB.
```

---

## TUẦN 7 — Bản đồ & tìm kiếm

## Task 3.6 — Tích hợp bản đồ Leaflet (nâng từ PoC)
```
TASK 3.6 — Bản đồ Leaflet lấy dữ liệu thật từ DB.
Nâng cấp PoC ở task 1.4 thành tính năng thật:
1. Endpoint trả JSON danh sách sân (id, tên, lat, lng, giá, url chi tiết) — theo thiết kế ở task 2.3.
2. Trang chủ: bản đồ Leaflet + OSM hiển thị TẤT CẢ sân từ endpoint, marker + popup có link tới trang chi tiết.
3. Nút "Sân gần tôi": lấy vị trí trình duyệt, tính Haversine (ở Python qua endpoint HOẶC ở JS — chọn theo thiết kế), sắp xếp/hiển thị sân gần nhất.
4. Attribution OpenStreetMap đúng giấy phép ODbL.
Giải thích luồng: JS gọi endpoint → nhận JSON → vẽ marker. Đây là phần WebGIS lõi, chuẩn bị giải thích kỹ cho hội đồng.
Tiêu chí hoàn thành: bản đồ hiện đúng sân trong DB, popup dẫn tới chi tiết, "sân gần tôi" hoạt động, có attribution.
```

## Task 3.7 — Tìm kiếm & lọc
```
TASK 3.7 — Tìm kiếm và bộ lọc.
1. Lọc theo: quận, khoảng giá, ngày + khung giờ còn trống.
2. Lọc "khung giờ trống" phải truy vấn Booking để loại slot đã đặt — giải thích truy vấn.
3. Kết quả lọc phản ánh đồng thời trên danh sách VÀ trên bản đồ (marker cập nhật theo bộ lọc).
4. Tối ưu truy vấn cơ bản (select_related/prefetch_related) tránh N+1, giải thích ngắn.
Bám đúng FR tìm kiếm, không thêm tiêu chí lọc ngoài phạm vi.
Tiêu chí hoàn thành: lọc theo quận/giá/khung giờ trống cho kết quả đúng trên cả danh sách và bản đồ.
```

---

## TUẦN 8 — Lõi đặt sân

## Task 3.8 — Luồng đặt sân + chống trùng lịch (QUAN TRỌNG NHẤT)
```
TASK 3.8 — Đặt sân với chống double-booking.
Đây là chức năng lõi và là phần hội đồng soi kỹ nhất. Hiện thực đúng sequence diagram ở task 2.5:
1. Người chơi chọn sân → chọn ngày → hệ thống hiển thị slot trống (loại slot đã có Booking).
2. Chọn slot → xác nhận → tạo Booking trạng thái pending.
3. CHỐNG TRÙNG: bọc việc tạo Booking trong transaction.atomic(); dựa vào UniqueConstraint ở DB; bắt IntegrityError khi có xung đột và báo "slot vừa được người khác đặt".
4. (Tùy thiết kế) dùng select_for_update để khóa hàng khi cần.
5. VIẾT TEST mô phỏng 2 request đặt cùng slot gần đồng thời, chứng minh chỉ 1 thành công.
Giải thích rõ: vì sao kiểm ở tầng DB + transaction an toàn hơn chỉ kiểm ở form (race condition). Đây là câu tôi chắc chắn bị hỏi.
Tiêu chí hoàn thành: đặt sân chạy đúng luồng; test đặt đồng thời chứng minh không tạo được 2 booking trùng.
```

## Task 3.9 — Quản lý booking (owner & player)
```
TASK 3.9 — Dashboard chủ sân + lịch sử người chơi.
1. Owner: xem danh sách booking sân mình, xác nhận (pending→confirmed) hoặc hủy (→cancelled), lọc theo ngày/trạng thái.
2. Player: xem lịch sử booking của mình, hủy booking (nếu còn trong hạn cho phép — nêu quy tắc).
3. Vòng đời trạng thái đúng state diagram ở task 2.5: pending → confirmed → completed/cancelled.
4. Kiểm quyền: owner chỉ thao tác booking của sân mình; player chỉ booking của mình.
Tiêu chí hoàn thành: owner xác nhận/hủy được; player xem lịch sử & hủy được; chuyển trạng thái đúng quy tắc.
```

## Task 3.10 — Thu thập minh chứng
```
TASK 3.10 — Cập nhật EVIDENCE.md (đóng thêm vai DOCUMENTER).
Hệ thống hóa minh chứng Giai đoạn 3 để chuẩn bị viết Chương 4:
1. Với mỗi tính năng đã làm (3.2 → 3.9), hướng dẫn tôi chụp màn hình gì, đặt tên file ra sao.
2. Soạn sẵn khung mô tả 3 dòng cho mỗi tính năng trong EVIDENCE.md (làm gì – kết quả – điểm đáng chú ý).
3. Liệt kê các đoạn code "đắt giá" nên đưa vào báo cáo (models Booking + đoạn transaction chống trùng, endpoint bản đồ) kèm gợi ý giải thích.
Tiêu chí hoàn thành: EVIDENCE.md có mục cho mọi tính năng Must, sẵn nguyên liệu cho Chương 4.
```

---

## PROMPT ĐÓNG PHIÊN (dán sau mỗi task)
```
Kết thúc phiên:
1. Cập nhật STATE.md: task nào, đầu ra (file tạo/sửa), tồn đọng, task kế tiếp.
2. Tick ROADMAP.md CHỈ KHI đạt đủ tiêu chí; chưa đủ ghi rõ còn thiếu gì.
3. Ghi tính năng vừa xong vào EVIDENCE.md (ảnh + mô tả 3 dòng).
4. Nhắc tôi commit Git với message rõ ràng cho task này.
5. Phát sinh cần đổi thiết kế/PROJECT.md → ghi "Đề xuất chờ duyệt", không tự sửa.
Xuất lại STATE.md sau khi cập nhật.
```

---

## GIÁM SÁT LUỒNG — chạy CUỐI MỖI TUẦN (đổi sang vai SUPERVISOR)
```
Bạn đổi sang vai SUPERVISOR theo AGENTS.md. Đầu vào: PROJECT.md (bảng FR) + ROADMAP.md + mô tả/mã nguồn hiện tại (tôi dán).
Nhiệm vụ: đối chiếu từng FR với hiện trạng, xuất bảng 3 cột: FR – Trạng thái (Xong/Đang làm/Chưa) – Ghi chú lệch.
Chỉ ra rõ:
(a) FR mức Must chưa làm mà lẽ ra tuần này phải xong.
(b) Thứ đã code nhưng KHÔNG thuộc FR nào (scope creep) — cảnh báo.
(c) Chỗ code lệch so với thiết kế đã duyệt ở Giai đoạn 2.
Kết luận: dự án có ĐÚNG LUỒNG không, cần chấn chỉnh gì trước khi sang tuần sau.
```

---

## GATE 3 — Kiểm tra luồng (cuối tuần 8, vai SUPERVISOR)
```
Bạn là SUPERVISOR. Chấm Gate 3 theo Checklist G3 trong AGENTS.md:
- 100% FR mức Must đã chạy được và có ảnh trong EVIDENCE.md?
- Scope creep = 0 (hoặc phần thêm đã được duyệt qua "Đề xuất chờ duyệt")?
- Schema DB khớp ERD đã duyệt?
Với mỗi mục: Đạt/Chưa đạt + bằng chứng. Kết luận ĐẠT/CHƯA ĐẠT Gate 3.
Chưa đạt thì liệt kê chính xác việc phải hoàn tất trước khi sang Giai đoạn 4 (Kiểm thử).
```
