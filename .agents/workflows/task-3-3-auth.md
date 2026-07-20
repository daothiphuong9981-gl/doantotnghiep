---
description: Task 3.3 - Xác thực & phân quyền 3 vai
---

# Workflow: Task 3.3 — Auth & phân quyền
### 1. Chuẩn bị
- Chạy `/mo-phien` trước (nạp ngữ cảnh, xác định vai, chờ tôi duyệt).
- Đóng vai EXECUTOR.

### 2. Thực hiện
- Phân biệt 3 vai: custom User (AbstractUser) HOẶC Profile+role — chọn 1, giải thích, theo thiết kế đã duyệt.
- Đăng ký (chọn vai player/owner), đăng nhập, đăng xuất — Django auth + Bootstrap.
- Phân quyền: chặn player vào dashboard owner, chặn chưa đăng nhập đặt sân (khớp bảng quyền 2.3).
- Khi đăng ký: hiển thị thông báo mục đích thu thập dữ liệu cá nhân (NĐ 13/2023).
- Giải thích cơ chế session/login của Django.
### Kết thúc
- Chạy `/dong-phien` (cập nhật STATE, tick ROADMAP, ghi EVIDENCE, nhắc commit).

## Tiêu chí hoàn thành
Đăng ký/đăng nhập 3 vai chạy, phân quyền chặn đúng, có thông báo dữ liệu cá nhân.
