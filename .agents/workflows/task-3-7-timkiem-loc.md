---
description: Task 3.7 - Tìm kiếm & lọc
---

# Workflow: Task 3.7 — Tìm kiếm & lọc
### 1. Chuẩn bị
- Chạy `/mo-phien` trước (nạp ngữ cảnh, xác định vai, chờ tôi duyệt).
- Đóng vai EXECUTOR.

### 2. Thực hiện
- Lọc theo quận, khoảng giá, ngày + khung giờ trống.
- Lọc "khung giờ trống" truy vấn Booking để loại slot đã đặt — giải thích truy vấn.
- Kết quả phản ánh đồng thời trên danh sách VÀ bản đồ.
- Tối ưu select_related/prefetch_related tránh N+1.
- Bám đúng FR tìm kiếm.
### Kết thúc
- Chạy `/dong-phien` (cập nhật STATE, tick ROADMAP, ghi EVIDENCE, nhắc commit).

## Tiêu chí hoàn thành
Lọc theo quận/giá/khung giờ trống cho kết quả đúng trên cả danh sách và bản đồ.
