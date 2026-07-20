---
description: Task 4.3 - Sửa lỗi & test hồi quy
---

# Workflow: Task 4.3 — Sửa lỗi & hồi quy
### 1. Chuẩn bị
- Chạy `/mo-phien` trước (nạp ngữ cảnh, xác định vai, chờ tôi duyệt).
- Đóng vai EXECUTOR (khi sửa).

### 2. Thực hiện
- Bảng lỗi từ TC Fail: mã, mô tả, mức độ, nguyên nhân, cách sửa.
- Sửa theo ưu tiên (Nghiêm trọng trước), không sửa lan sang phần khác.
- Test hồi quy sau mỗi sửa.
- Sửa đòi đổi schema → ghi "Đề xuất chờ duyệt" trước.
### Kết thúc
- Chạy `/dong-phien` (cập nhật STATE, tick ROADMAP, ghi EVIDENCE, nhắc commit).

## Tiêu chí hoàn thành
0 lỗi Nghiêm trọng/Cao còn mở; test hồi quy pass.
