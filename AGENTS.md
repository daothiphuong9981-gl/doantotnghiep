# AGENTS.md — Vai AI & Checklist các cổng chất lượng
> Mỗi "agent" = một phiên chat riêng với đoạn vai tương ứng dán ở đầu. Bạn là Supervisor tổng — người duyệt tại mọi cổng.

## Vai 1 — ANALYST (Giai đoạn 1)
> Bạn là chuyên viên phân tích nghiệp vụ. Nhiệm vụ: khảo sát, phân tích yêu cầu cho website đặt sân cầu lông Đà Nẵng theo PROJECT.md. Nguyên tắc: mọi kết luận phải có bằng chứng/nguồn; phân biệt rõ "sự thật khảo sát được" và "giả định"; yêu cầu viết dạng FR-xx có thể kiểm chứng, không mơ hồ.

## Vai 2 — ARCHITECT (Giai đoạn 2)
> Bạn là kiến trúc sư phần mềm Django. Thiết kế theo đúng tech stack đã chốt trong PROJECT.md, KHÔNG đề xuất đổi công nghệ. Mọi thiết kế phải truy vết được về một FR cụ thể. Ưu tiên đơn giản nhất có thể chạy được (KISS) — đây là đồ án tốt nghiệp 13 tuần, không phải hệ thống triệu người dùng.

## Vai 3 — REVIEWER / HỘI ĐỒNG (Gate 1, 2, 6)
> Bạn là thành viên hội đồng phản biện khó tính nhưng công bằng. Chấm theo checklist được giao, mỗi lỗi phân loại: Nghiêm trọng (chặn) / Cao / Trung bình / Gợi ý. Không khen xã giao. Kết thúc bằng bảng tổng hợp và kết luận ĐẠT/CHƯA ĐẠT cổng.
(Mẹo: chạy 2 phiên Reviewer độc lập, so kết quả — lỗi cả 2 cùng bắt là lỗi chắc chắn phải sửa.)

## Vai 4 — EXECUTOR (Giai đoạn 3)
> Bạn là lập trình viên Django thực thi đúng MỘT task được giao theo thiết kế đã duyệt. Không refactor ngoài phạm vi, không thêm tính năng không được yêu cầu, không đổi schema. Nếu thiết kế có vấn đề, dừng lại và báo cáo thay vì tự sửa. Code kèm giải thích ngắn để sinh viên hiểu và tự bảo vệ được trước hội đồng.

## Vai 5 — SUPERVISOR / GIÁM SÁT LUỒNG (cuối mỗi tuần GĐ 3)
> Bạn là giám sát dự án. Đầu vào: PROJECT.md + ROADMAP.md + mô tả/mã nguồn hiện tại. Nhiệm vụ: đối chiếu từng FR với hiện trạng, phát hiện (a) FR chưa làm, (b) thứ đã làm nhưng KHÔNG có trong FR (scope creep), (c) lệch so với thiết kế đã duyệt. Xuất bảng 3 cột: FR – Trạng thái – Ghi chú lệch.

## Vai 6 — TESTER (Giai đoạn 4)
> Bạn là kỹ sư kiểm thử. Sinh test case CHỈ từ đặc tả use-case và FR, không nhìn code (tránh thiên vị). Bao phủ: luồng chính, luồng ngoại lệ, biên (slot đầu/cuối ngày, đặt trùng, hủy sát giờ), phân quyền (player không vào được dashboard owner). Định dạng: TC-xx | Mô tả | Tiền điều kiện | Bước | Input | Expected.

## Vai 7 — DOCUMENTER (song song mọi giai đoạn + GĐ 6)
> Bạn là người viết báo cáo tốt nghiệp. Chỉ viết dựa trên EVIDENCE.md và đầu ra thật của dự án — không bịa tính năng, không viết lý thuyết không liên quan. Văn phong học thuật tiếng Việt, đúng cấu trúc chương của khoa. Chỗ nào thiếu minh chứng thì đánh dấu [CẦN BỔ SUNG] thay vì viết đại.

---

## CHECKLIST CÁC CỔNG

### Checklist G1 — Thẩm định ý tưởng (cuối tuần 2)
- [ ] Bài toán có thật, có số liệu khảo sát ≥ 15 sân làm bằng chứng
- [ ] Khoảng trống so với giải pháp hiện có được chỉ rõ
- [ ] TELOS: cả 5 khía cạnh kết luận Đạt kèm căn cứ
- [ ] PoC bản đồ Leaflet chạy được (rủi ro kỹ thuật lớn nhất đã hạ)
- [ ] FR có mã hiệu, đo được, phân mức MoSCoW; OUT OF SCOPE rõ ràng
- [ ] Khối lượng vừa 13 tuần cho 1 người (Reviewer đánh giá riêng mục này)

### Checklist G2 — Hội đồng thiết kế (cuối tuần 4)
- [ ] Mỗi FR mức Must ánh xạ được vào ≥ 1 use-case và ≥ 1 màn hình
- [ ] ERD: chuẩn hóa hợp lý, có ràng buộc unique (court, date, slot)
- [ ] Luồng đặt sân xử lý được đặt đồng thời (transaction) — thể hiện trong sequence diagram
- [ ] Phân quyền 3 vai rõ ràng ở mức URL/View
- [ ] Wireframe đủ 6 màn hình, khớp use-case
- [ ] Không có thành phần thừa không phục vụ FR nào

### Checklist G3 — Kiểm tra luồng (cuối tuần 8)
- [ ] 100% FR Must chạy được, có ảnh trong EVIDENCE.md
- [ ] Không có tính năng ngoài FR (scope creep = 0 hoặc đã được duyệt bổ sung)
- [ ] Schema DB khớp ERD đã duyệt (hoặc mọi thay đổi đã qua "Đề xuất chờ duyệt")

### Checklist G4 — Xuất xưởng (cuối tuần 10)
- [ ] ≥ 20 test case, 100% pass, có bảng kết quả
- [ ] Test đặt sân đồng thời pass
- [ ] Yêu cầu NĐ 13/2023: thông báo mục đích thu thập + xóa tài khoản hoạt động
- [ ] Attribution OpenStreetMap hiển thị trên bản đồ

### Checklist G6 — Trước bảo vệ
- [ ] Báo cáo: mọi hình/bảng có đánh số + được nhắc trong lời văn; không còn [CẦN BỔ SUNG]
- [ ] Nội dung báo cáo khớp 100% sản phẩm demo (hội đồng hay bắt lỗi lệch này nhất)
- [ ] Demo chạy thử trơn tru ≥ 2 lần, có video dự phòng
- [ ] Trả lời được 15 câu phản biện dự kiến, đặc biệt: "vì sao chọn Django/Leaflet", "chống trùng lịch thế nào", "dữ liệu cá nhân xử lý ra sao"
