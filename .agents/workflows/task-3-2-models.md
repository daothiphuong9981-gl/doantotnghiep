---
description: Task 3.2 - Models & migrations theo ERD
---

# Workflow: Task 3.2 — Models & migrations
### 1. Chuẩn bị
- Chạy `/mo-phien` trước (nạp ngữ cảnh, xác định vai, chờ tôi duyệt).
- Đóng vai EXECUTOR.

### 2. Viết models khớp 100% ERD đã duyệt (2.2)
- KHÔNG tự thêm/bớt trường; ERD thiếu → báo trước.
- Booking: UniqueConstraint (court, date, time_slot) qua Meta.constraints — lớp chống trùng tầng DB.
- Tọa độ: 2 DecimalField.
- Đăng ký admin, tùy biến list_display.
- Tạo & chạy migrations; hướng dẫn kiểm tra `manage.py check`.
- Giải thích: UniqueConstraint vs unique_together, related_name.
### Kết thúc
- Chạy `/dong-phien` (cập nhật STATE, tick ROADMAP, ghi EVIDENCE, nhắc commit).

## Tiêu chí hoàn thành
check sạch, migrate ok, admin đủ model, ràng buộc unique tồn tại trong DB.
