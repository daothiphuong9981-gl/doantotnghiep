---
description: Task 3.9 - Quản lý booking (owner & player)
---

# Workflow: Task 3.9 — Quản lý booking
### 1. Chuẩn bị
- Chạy `/mo-phien` trước (nạp ngữ cảnh, xác định vai, chờ tôi duyệt).
- Đóng vai EXECUTOR.

### 2. Thực hiện
- Owner: xem booking sân mình, xác nhận (pending→confirmed) / hủy (→cancelled), lọc theo ngày/trạng thái.
- Player: xem lịch sử, hủy booking nếu còn trong hạn (nêu quy tắc).
- Vòng đời trạng thái đúng state diagram (2.5).
- Kiểm quyền: owner chỉ booking sân mình; player chỉ booking của mình.
### Kết thúc
- Chạy `/dong-phien` (cập nhật STATE, tick ROADMAP, ghi EVIDENCE, nhắc commit).

## Tiêu chí hoàn thành
Owner xác nhận/hủy được; player xem lịch sử & hủy được; chuyển trạng thái đúng quy tắc.
