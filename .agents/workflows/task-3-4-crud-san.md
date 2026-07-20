---
description: Task 3.4 - CRUD sân cho chủ sân
---

# Workflow: Task 3.4 — CRUD Court (owner)
### 1. Chuẩn bị
- Chạy `/mo-phien` trước (nạp ngữ cảnh, xác định vai, chờ tôi duyệt).
- Đóng vai EXECUTOR.

### 2. Thực hiện
- Form thêm/sửa sân: tên, địa chỉ, quận, tọa độ, giá theo khung giờ, mô tả, upload nhiều ảnh (Pillow).
- Owner chỉ xem/sửa/xóa sân CỦA MÌNH (kiểm quyền sở hữu, không chỉ ẩn nút).
- Xóa: cân nhắc soft-delete nếu sân đã có booking — giải thích.
- Validate: tọa độ hợp lệ, giá > 0, ảnh giới hạn dung lượng.
- Chỉ làm đúng FR CRUD sân.
### Kết thúc
- Chạy `/dong-phien` (cập nhật STATE, tick ROADMAP, ghi EVIDENCE, nhắc commit).

## Tiêu chí hoàn thành
Owner tạo/sửa/xóa sân của mình, không đụng sân người khác, validate hoạt động.
