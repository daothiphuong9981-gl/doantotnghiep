---
description: Task 4.1 - Sinh bộ test case từ đặc tả
---

# Workflow: Task 4.1 — Sinh test case
### 1. Chuẩn bị
- Chạy `/mo-phien` trước (nạp ngữ cảnh, xác định vai, chờ tôi duyệt).
- Đóng vai TESTER. Sinh test CHỈ từ use-case/FR, KHÔNG nhìn code.

### 2. Bảng ≥20 test case
- Cột: Mã TC | UC/FR | Mô tả | Tiền điều kiện | Bước | Input | Expected.
- Bao phủ: luồng chính; ngoại lệ (slot đã đặt, chưa đăng nhập, sai định dạng, ảnh quá lớn); biên (slot đầu/cuối ngày, đặt sát giờ, giá 0, tọa độ ngoài ĐN); phân quyền; pháp lý (thông báo dữ liệu cá nhân, xóa tài khoản, attribution OSM).
### Kết thúc
- Chạy `/dong-phien` (cập nhật STATE, tick ROADMAP, ghi EVIDENCE, nhắc commit).

## Tiêu chí hoàn thành
≥20 test case có Expected rõ ràng, bao phủ đủ 5 nhóm.
