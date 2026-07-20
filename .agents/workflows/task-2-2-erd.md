---
description: Task 2.2 - Thiết kế CSDL (ERD)
---

# Workflow: Task 2.2 — ERD
### 1. Chuẩn bị
- Chạy `/mo-phien` trước (nạp ngữ cảnh, xác định vai, chờ tôi duyệt).
- Đóng vai ARCHITECT.

### 2. Thiết kế
- Thực thể: User (3 vai), Court, CourtImage, PriceRule/TimeSlot, Booking, Review (nếu đúng phạm vi).
- Mỗi thực thể: thuộc tính, kiểu (khớp Django field), khóa chính/ngoại, ràng buộc.
- Thể hiện RÕ ràng buộc unique (court, ngày, khung giờ) chống double-booking ở tầng DB.
- Quan hệ (1-n, n-n) + cách hiện thực Django (FK, M2M, related_name).
- Tọa độ: 2 DecimalField (lat, lng) — KHÔNG GeoDjango.
- Vẽ ERD bằng Mermaid erDiagram.
### Kết thúc
- Chạy `/dong-phien` (cập nhật STATE, tick ROADMAP, ghi EVIDENCE, nhắc commit).

## Tiêu chí hoàn thành
ERD render được, có ràng buộc unique chống trùng, mọi thực thể truy vết về FR.
