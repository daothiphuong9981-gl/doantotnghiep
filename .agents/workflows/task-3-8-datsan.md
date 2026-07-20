---
description: Task 3.8 - Luồng đặt sân + chống trùng lịch (QUAN TRỌNG NHẤT)
---

# Workflow: Task 3.8 — Đặt sân & chống double-booking
### 1. Chuẩn bị
- Chạy `/mo-phien` trước (nạp ngữ cảnh, xác định vai, chờ tôi duyệt).
- Đóng vai EXECUTOR. Đọc sequence diagram (2.5) và model Booking (3.2).

### 2. Hiện thực luồng đặt sân
- Chọn sân → ngày → hiện slot trống (loại slot đã có Booking) → chọn slot → xác nhận → Booking pending.

### 3. Chống trùng lịch (trọng tâm)
- Bọc tạo Booking trong transaction.atomic(); dựa UniqueConstraint DB; bắt IntegrityError báo "slot vừa được người khác đặt"; dùng select_for_update khi cần.

### 4. Test đồng thời
- Test mô phỏng 2 request đặt cùng slot gần đồng thời, chứng minh chỉ 1 thành công.

### 5. Giải thích để bảo vệ
- Vì sao kiểm tầng DB + transaction an toàn hơn kiểm ở form (race condition).
### Kết thúc
- Chạy `/dong-phien` (cập nhật STATE, tick ROADMAP, ghi EVIDENCE, nhắc commit).

## Tiêu chí hoàn thành
Đặt sân đúng luồng; test đồng thời chứng minh không tạo được 2 booking trùng.
