# PROMPTS — Giai đoạn 1: Ý tưởng & Khảo sát khả thi
> Cách dùng: mỗi tiểu mục = một phiên chat riêng. Đính kèm PROJECT.md, ROADMAP.md, STATE.md, AGENTS.md, EVIDENCE.md vào Project. Dán nguyên khối prompt tương ứng. Làm xong dùng prompt ĐÓNG PHIÊN ở cuối file.

---

## PROMPT MỞ ĐẦU (dán trước MỌI phiên trong giai đoạn 1)
```
Bạn đóng vai ANALYST theo AGENTS.md. Đọc PROJECT.md, ROADMAP.md, STATE.md trước.
Nguyên tắc bắt buộc:
- Chỉ làm đúng task tôi giao bên dưới, không làm sang task khác.
- Mọi kết luận phải phân biệt rõ: [KHẢO SÁT ĐƯỢC] (có nguồn) và [GIẢ ĐỊNH] (tôi tự suy luận).
- Không bịa số liệu. Chỗ nào cần tôi tự đi khảo sát thực địa/gọi điện, hãy nói rõ và cung cấp công cụ (mẫu bảng, câu hỏi) để tôi tự thu thập.
- Trước khi làm, tóm tắt lại task + tiêu chí hoàn thành để tôi xác nhận, rồi mới thực hiện.
```

---

## Task 1.1 — Khảo sát hiện trạng sân cầu lông Đà Nẵng
```
TASK 1.1 — Khảo sát hiện trạng.
Bối cảnh: tôi cần dữ liệu thật về ≥15 sân cầu lông ở Đà Nẵng làm bằng chứng cho Chương 1.
Vì bạn không truy cập thực địa được, hãy tạo cho tôi CÔNG CỤ KHẢO SÁT gồm:
1. Mẫu bảng khảo sát (cột: STT, tên sân, quận, địa chỉ, tọa độ dự kiến, số điện thoại/fanpage, cách nhận đặt sân hiện tại, giá tham khảo theo khung giờ, số sân con, ngày khảo sát, nguồn).
2. Bộ 8–10 câu hỏi tôi dùng khi gọi điện/nhắn fanpage cho chủ sân.
3. Hướng dẫn cách lấy tọa độ từ Google Maps mà KHÔNG scrape hàng loạt (thao tác thủ công đúng luật).
4. Gợi ý phân bố mẫu khảo sát theo các quận để dữ liệu đại diện cho Đà Nẵng.
Xuất bảng ở định dạng markdown để tôi điền. Đánh dấu rõ [GIẢ ĐỊNH] nếu bạn gợi ý sẵn tên sân — tôi sẽ tự xác minh.
Tiêu chí hoàn thành: tôi có bảng trống chuẩn + bộ câu hỏi để tự đi khảo sát 15 sân.
```

## Task 1.2 — Phân tích giải pháp tương tự
```
TASK 1.2 — Phân tích giải pháp tương tự (related work).
Yêu cầu: giúp tôi phân tích 3 giải pháp đặt sân/đặt dịch vụ thể thao đang tồn tại để tìm KHOẢNG TRỐNG cho đề tài.
1. Đề xuất khung tiêu chí so sánh ≥5 tiêu chí (VD: tìm theo bản đồ, chống trùng lịch, đối tượng chủ sân tự quản lý, phù hợp thị trường Việt/địa phương, chi phí, mức độ phức tạp).
2. Lập bảng so sánh 3 giải pháp × các tiêu chí. Với thông tin bạn không chắc, đánh [CẦN TÔI KIỂM CHỨNG] kèm gợi ý cách kiểm chứng (tải app dùng thử, đọc mô tả).
3. Từ bảng, rút ra 3–4 khoảng trống mà website của tôi nhắm tới, mỗi khoảng trống nối với một FR tương lai.
Nhắc lại: KHÔNG bịa tính năng của sản phẩm bạn không chắc chắn. Thà để tôi kiểm chứng.
Tiêu chí hoàn thành: bảng so sánh + danh sách khoảng trống có căn cứ.
```

## Task 1.3 — Nghiên cứu khả thi theo khung TELOS
```
TASK 1.3 — Nghiên cứu khả thi TELOS.
Phân tích tính khả thi của dự án theo 5 khía cạnh, mỗi khía cạnh kết luận ĐẠT/KHÔNG ĐẠT kèm căn cứ:
- Technical: Django 5.2 + Leaflet + PythonAnywhere có làm được các FR không? Rủi ro kỹ thuật lớn nhất là gì?
- Economic: chi phí (gần như 0 vì dùng free tier) vs lợi ích; phân tích như một đồ án.
- Legal: NĐ 13/2023 về dữ liệu cá nhân, ToS Google Maps, giấy phép OSM/ODbL — nêu nghĩa vụ cụ thể tôi phải tuân thủ.
- Operational: một sinh viên vận hành/bảo trì được không sau khi bàn giao?
- Schedule: 13 tuần cho 1 người có thực tế không? Chỉ ra giai đoạn dễ trễ nhất.
Kết thúc bằng bảng tổng hợp 5 dòng + kết luận chung: đề tài KHẢ THI/CẦN ĐIỀU CHỈNH.
Nếu khía cạnh nào "Không đạt", đề xuất cách thu hẹp phạm vi để thành đạt.
Tiêu chí hoàn thành: mỗi chữ TELOS có kết luận + căn cứ.
```

## Task 1.4 — PoC bản đồ Leaflet (hạ rủi ro kỹ thuật)
```
TASK 1.4 — Proof of Concept bản đồ.
Đây là rủi ro kỹ thuật lớn nhất nên làm sớm. Viết cho tôi MỘT file HTML độc lập (không cần Django):
- Bản đồ Leaflet + OpenStreetMap, canh giữa Đà Nẵng.
- 5 marker sân mẫu (dùng tọa độ [GIẢ ĐỊNH] ở Đà Nẵng, ghi chú rõ là dữ liệu giả để test).
- Mỗi marker click ra popup: tên sân, địa chỉ, giá, nút "Đặt sân" (chỉ alert demo).
- 1 nút "Sân gần tôi": lấy vị trí trình duyệt, tính khoảng cách Haversine, highlight sân gần nhất.
- Có attribution OpenStreetMap đúng giấy phép.
Kèm hướng dẫn chạy (mở bằng trình duyệt) và giải thích ngắn từng phần để tôi hiểu, tự bảo vệ trước hội đồng.
Tiêu chí hoàn thành: file chạy được, tôi chụp màn hình lưu vào EVIDENCE.md mục [1.4].
```

## Task 1.5 — Chốt yêu cầu chức năng (FR) & phi chức năng (NFR)
```
TASK 1.5 — Đặc tả yêu cầu.
Dựa trên PROJECT.md (mục 3 phạm vi) + kết quả 1.1–1.2, lập:
1. Bảng FR (Functional Requirements): mã FR-01..., mô tả, tác nhân (player/owner/admin), độ ưu tiên theo MoSCoW (Must/Should/Could/Won't).
2. Bảng NFR (Non-Functional): mã NFR-01..., loại (hiệu năng, bảo mật, khả dụng, pháp lý, tương thích), mô tả đo được (VD: "trang danh sách sân tải < 3 giây với 100 sân").
Nguyên tắc: mỗi FR phải KIỂM CHỨNG ĐƯỢC (tránh câu mơ hồ như "hệ thống thân thiện"). Bám sát phạm vi — KHÔNG thêm FR nằm trong mục OUT OF SCOPE của PROJECT.md.
Tiêu chí hoàn thành: bảng FR + NFR có mã hiệu, đo được, phân mức ưu tiên.
```

## Task 1.6 — Viết nháp Chương 1 báo cáo
```
TASK 1.6 — Draft Chương 1 (đóng thêm vai DOCUMENTER).
Dựa DUY NHẤT trên đầu ra thật của 1.1–1.5 (tôi sẽ dán vào), viết nháp Chương 1 báo cáo tốt nghiệp, cấu trúc:
1.1 Đặt vấn đề (lý do chọn đề tài — dùng số liệu khảo sát 1.1)
1.2 Khảo sát hiện trạng & giải pháp tương tự (từ 1.1, 1.2)
1.3 Mục tiêu và phạm vi đề tài (từ PROJECT.md)
1.4 Tính khả thi (tóm tắt 1.3)
1.5 Cấu trúc báo cáo (giới thiệu các chương sau)
Văn phong học thuật tiếng Việt, trang trọng. Chỗ nào tôi chưa cung cấp đủ số liệu, đánh dấu [CẦN BỔ SUNG: ...] thay vì bịa. Mọi bảng/hình đánh số và nhắc trong lời văn.
Tiêu chí hoàn thành: bản nháp Chương 1 hoàn chỉnh, không có nội dung bịa.
```

---

## PROMPT ĐÓNG PHIÊN (dán sau mỗi task)
```
Kết thúc phiên:
1. Cập nhật STATE.md: đã làm task nào, đầu ra là gì, vấn đề tồn đọng, task kế tiếp.
2. Tick mục tương ứng trong ROADMAP.md CHỈ KHI đã đạt đủ tiêu chí hoàn thành; nếu chưa đủ, ghi rõ còn thiếu gì.
3. Nếu phát sinh điều cần đổi so với PROJECT.md, ghi vào mục "Đề xuất chờ duyệt" trong STATE.md — không tự sửa PROJECT.md.
Xuất lại nội dung STATE.md sau khi cập nhật để tôi lưu.
```

---

## GATE 1 — Chạy sau khi xong 1.1–1.6 (đổi sang vai REVIEWER)
```
Bạn đổi sang vai REVIEWER/HỘI ĐỒNG theo AGENTS.md. Chấm toàn bộ đầu ra Giai đoạn 1 (tôi dán bên dưới) theo Checklist G1 trong AGENTS.md.
Với mỗi mục checklist: kết luận Đạt/Chưa đạt + lý do. Phân loại lỗi: Nghiêm trọng/Cao/Trung bình/Gợi ý.
Đặc biệt soi kỹ: khối lượng có vừa 13 tuần cho 1 người không; FR có lọt mục OUT OF SCOPE không.
Kết thúc bằng bảng tổng hợp + kết luận: ĐẠT hay CHƯA ĐẠT Gate 1. Nếu chưa đạt, liệt kê việc cần sửa trước khi sang Giai đoạn 2.
(Gợi ý: chạy prompt này ở 2 phiên độc lập rồi so kết quả.)
```
