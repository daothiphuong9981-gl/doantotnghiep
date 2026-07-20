---
description: Hiến pháp dự án - luôn áp dụng cho mọi phiên làm việc
activation: always
---

# RULE 00 — Hiến pháp dự án Website cho thuê sân cầu lông

## Tài liệu nền (đọc trước mọi tác vụ)
Trước khi làm bất cứ việc gì, agent PHẢI đọc và tuân theo các file sau trong workspace:
- @doantotnghiep/PROJECT.md — mục tiêu, phạm vi, tech stack, quyết định kiến trúc, ràng buộc pháp lý (BẤT BIẾN).
- @doantotnghiep/ROADMAP.md — lộ trình 13 tuần, task và các Cổng chất lượng (Gate).
- @doantotnghiep/STATE.md — trạng thái phiên hiện tại, đọc để biết nối tiếp từ đâu.
- @doantotnghiep/AGENTS.md — định nghĩa các vai (Analyst/Architect/Executor/Supervisor/Tester/Reviewer/Documenter) và checklist các Gate.
- @doantotnghiep/EVIDENCE.md — sổ minh chứng để viết báo cáo.

## Nguyên tắc BẤT BIẾN (không được vi phạm)
1. KHÔNG đổi tech stack đã chốt trong PROJECT.md mục 5 (Python 3.13, Django 5.2, Leaflet/OSM, PythonAnywhere).
2. KHÔNG tự thêm tính năng nằm trong mục OUT OF SCOPE của PROJECT.md.
3. KHÔNG tự đổi schema/thiết kế đã duyệt. Nếu thấy cần đổi, GHI vào mục "Đề xuất chờ duyệt" trong STATE.md và DỪNG chờ tôi duyệt — không tự sửa.
4. Mọi thành phần code/thiết kế phải TRUY VẾT được về một FR cụ thể (ghi rõ "phục vụ FR-xx").
5. Mỗi phiên chỉ thực thi MỘT task trong ROADMAP. Không "tiện tay" làm task khác.
6. Mọi kết luận khảo sát phân biệt rõ [KHẢO SÁT ĐƯỢC] (có nguồn) và [GIẢ ĐỊNH]. KHÔNG bịa số liệu.
7. Báo cáo chỉ viết dựa trên đầu ra THẬT (EVIDENCE.md). Chỗ thiếu đánh [CẦN BỔ SUNG], không viết đại.
8. Code phải kèm giải thích ngắn tiếng Việt để tôi HIỂU và tự bảo vệ trước hội đồng.

## Quy trình bắt buộc mỗi tác vụ
1. Xác định đang đóng VAI nào (theo AGENTS.md) — nêu rõ ở đầu phản hồi.
2. Tóm tắt task + tiêu chí hoàn thành, chờ tôi xác nhận rồi mới làm (dùng Planning mode).
3. Làm xong: cập nhật STATE.md và tick ROADMAP.md (chỉ tick khi đủ tiêu chí).
4. Không qua Gate tiếp theo khi Gate hiện tại chưa ĐẠT.

## An toàn
- KHÔNG yêu cầu tôi dán mật khẩu, SECRET_KEY, thông tin DB, token vào chat. Hướng dẫn tôi tự nhập.
- Tuân thủ Nghị định 13/2023 về dữ liệu cá nhân và giấy phép ODbL của OpenStreetMap.
