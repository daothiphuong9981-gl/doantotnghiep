# PROMPTS — Giai đoạn 6: Báo cáo & Bảo vệ (Tuần 12–13)
> Cách dùng: mỗi tiểu mục = một phiên chat riêng. Đính kèm PROJECT.md, ROADMAP.md, STATE.md, AGENTS.md, EVIDENCE.md + toàn bộ nháp chương đã viết ở các giai đoạn trước.
> Điều kiện tiên quyết: Gate 5 đã ĐẠT (website chạy thật). Vì đã viết báo cáo song song từ đầu, giai đoạn này chủ yếu là GHÉP, PHẢN BIỆN và LUYỆN BẢO VỆ.

---

## PROMPT MỞ ĐẦU (dán trước MỌI phiên trong giai đoạn 6)
```
Bạn đóng vai DOCUMENTER theo AGENTS.md. Đọc PROJECT.md, ROADMAP.md, STATE.md, EVIDENCE.md và các nháp chương trước.
Nguyên tắc bắt buộc:
- Chỉ viết dựa trên đầu ra THẬT của dự án (EVIDENCE.md và các chương đã nháp). KHÔNG bịa tính năng, KHÔNG thêm lý thuyết không liên quan.
- Nội dung báo cáo phải KHỚP 100% sản phẩm demo — đây là chỗ hội đồng bắt lỗi nhiều nhất.
- Chỗ thiếu minh chứng đánh [CẦN BỔ SUNG: ...], không viết đại.
- Trước khi làm, tóm tắt phạm vi + tiêu chí để tôi xác nhận.
```

---

## Task 6.1 — Ghép & hoàn thiện báo cáo
```
TASK 6.1 — Tổng hợp báo cáo hoàn chỉnh.
1. Ghép các chương đã nháp (1→4) thành báo cáo thống nhất; rà mạch lạc, chuyển tiếp giữa các chương.
2. Viết CHƯƠNG 5 — KẾT LUẬN & HƯỚNG PHÁT TRIỂN:
   - Kết quả đạt được (đối chiếu với mục tiêu ở Chương 1 và FR).
   - Hạn chế còn tồn tại (trung thực — hội đồng đánh giá cao sự thẳng thắn).
   - Hướng phát triển (các mục OUT OF SCOPE có thể làm tương lai: thanh toán, mobile, chat...).
3. Bổ sung phần đầu/cuối: trang bìa, lời cảm ơn, mục lục, danh mục hình/bảng, tài liệu tham khảo.
4. Rà toàn bộ: mọi hình/bảng có đánh số + được nhắc trong lời văn; thuật ngữ nhất quán; còn [CẦN BỔ SUNG] nào không.
Định dạng theo mẫu của khoa (tôi sẽ cung cấp yêu cầu format cụ thể).
Tiêu chí hoàn thành: báo cáo đủ 5 chương + phần bổ trợ, không còn [CẦN BỔ SUNG].
```

## Task 6.2 — Phản biện báo cáo (đổi sang vai REVIEWER)
```
TASK 6.2 — Tự phản biện báo cáo như hội đồng.
Bạn đổi sang vai REVIEWER/HỘI ĐỒNG. Đọc toàn bộ báo cáo (tôi dán) và phản biện như một thành viên hội đồng khó tính:
1. Nội dung: có chương nào lý thuyết suông không gắn sản phẩm? Có phần nào báo cáo nói có nhưng demo không có (hoặc ngược lại)?
2. Logic: mục tiêu ở Chương 1 có được giải quyết và chứng minh ở các chương sau không?
3. Kỹ thuật: chỗ nào giải thích hời hợt dễ bị hỏi sâu (đặc biệt chống trùng lịch, WebGIS, phân quyền)?
4. Hình thức: trích dẫn, đánh số, thuật ngữ, lỗi trình bày.
Xuất bảng: Vấn đề | Vị trí | Mức độ | Đề xuất sửa. Kết luận báo cáo đã sẵn sàng nộp chưa.
(Gợi ý: chạy 2 phiên độc lập rồi so.)
Tiêu chí hoàn thành: danh sách vấn đề + đã sửa xong các mục Nghiêm trọng/Cao.
```

## Task 6.3 — Slide & kịch bản demo
```
TASK 6.3 — Slide bảo vệ + kịch bản demo.
1. Soạn dàn ý slide 12–15 trang: Giới thiệu đề tài → Bài toán & mục tiêu → Khảo sát/khả thi → Thiết kế (ERD, kiến trúc) → Chức năng chính (có ảnh) → Điểm nhấn kỹ thuật (chống trùng lịch, WebGIS) → Kiểm thử → Triển khai (link thật) → Kết luận & hướng phát triển. Mỗi slide: tiêu đề + ý chính + gợi ý hình.
2. Soạn KỊCH BẢN DEMO 7–10 phút: thứ tự thao tác trên website (tìm sân trên bản đồ → chi tiết → đặt → chủ sân xác nhận → xem lịch sử), lời thuyết minh từng bước, ước lượng thời gian.
3. PHƯƠNG ÁN DỰ PHÒNG: quay sẵn video demo phòng khi mạng lỗi; chuẩn bị dữ liệu demo sạch.
Tiêu chí hoàn thành: dàn ý slide + kịch bản demo có thời lượng + phương án dự phòng.
```

## Task 6.4 — Luyện vấn đáp phản biện
```
TASK 6.4 — Bộ câu hỏi phản biện + tập trả lời.
1. Soạn 15 câu hỏi hội đồng nhiều khả năng hỏi, phân nhóm:
   - Kỹ thuật: vì sao chọn Django/Leaflet? Chống trùng lịch hoạt động thế nào? Xử lý đồng thời ra sao? Nếu quy mô lớn (10.000 sân) thì sao?
   - Thiết kế: vì sao ERD như vậy? Vì sao không dùng GeoDjango?
   - Nghiệp vụ/pháp lý: xử lý dữ liệu cá nhân theo NĐ 13/2023 thế nào? Dữ liệu sân lấy có hợp pháp không?
   - Hạn chế: điểm yếu lớn nhất của hệ thống? Nếu làm lại sẽ khác gì?
2. Với mỗi câu: gợi ý câu trả lời ngắn gọn, tự tin, trung thực (không giấu hạn chế).
3. Sau đó bạn ĐÓNG VAI HỘI ĐỒNG hỏi tôi từng câu, tôi trả lời, bạn nhận xét câu trả lời của tôi và gợi ý cải thiện.
Tiêu chí hoàn thành: 15 câu + đáp án; đã tập vấn đáp ít nhất 1 lượt.
```

## Task 6.5 — Rà soát nộp cuối cùng
```
TASK 6.5 — Checklist nộp bài (đổi sang vai SUPERVISOR).
Bạn là SUPERVISOR. Lập checklist nộp cuối cùng và đối chiếu:
- Báo cáo bản cuối (định dạng đúng mẫu khoa, đủ chương, đã sửa hết lỗi Gate 6).
- Source code trên GitHub (README hướng dẫn chạy, code sạch, có commit history thể hiện quá trình).
- Link website production còn sống.
- Slide bảo vệ + video demo dự phòng.
- Đối chiếu Tiêu chí nghiệm thu tổng thể ở PROJECT.md mục 8 — từng mục Đạt/Chưa.
Kết luận: đã đủ điều kiện nộp và bảo vệ chưa; còn thiếu gì.
Tiêu chí hoàn thành: mọi mục checklist Đạt; PROJECT.md mục 8 thỏa mãn toàn bộ.
```

---

## PROMPT ĐÓNG PHIÊN
```
Kết thúc phiên:
1. Cập nhật STATE.md: task, đầu ra, tồn đọng, task kế tiếp.
2. Tick ROADMAP.md khi đủ tiêu chí.
3. Lưu bản báo cáo/slide/video vào nơi quản lý minh chứng.
Xuất lại STATE.md.
```

---

## GATE 6 — Bảo vệ thử (đổi sang vai REVIEWER/HỘI ĐỒNG)
```
Bạn đổi sang vai REVIEWER/HỘI ĐỒNG. Chấm Gate 6 theo Checklist G6 trong AGENTS.md:
- Báo cáo: mọi hình/bảng đánh số + được nhắc; hết [CẦN BỔ SUNG]?
- Nội dung báo cáo KHỚP 100% sản phẩm demo?
- Demo chạy trơn ≥2 lần, có video dự phòng?
- Trả lời được 15 câu phản biện, đặc biệt: chọn công nghệ, chống trùng lịch, dữ liệu cá nhân?
Mỗi mục Đạt/Chưa + bằng chứng. Kết luận: SẴN SÀNG BẢO VỆ hay CHƯA. Chưa thì liệt kê việc phải hoàn tất trước ngày bảo vệ chính thức.
```

---

## 🎓 KẾT THÚC LỘ TRÌNH
Qua đủ 6 Gate = dự án đã đi trọn vẹn từ ý tưởng đến sản phẩm chạy thật + báo cáo sát nội dung + sẵn sàng bảo vệ. Chúc bạn bảo vệ thành công!
