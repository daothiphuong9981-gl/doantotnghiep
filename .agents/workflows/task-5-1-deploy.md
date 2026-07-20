---
description: Task 5.1 - Deploy lên PythonAnywhere
---

# Workflow: Task 5.1 — Deploy production
### 1. Chuẩn bị
- Chạy `/mo-phien` trước (nạp ngữ cảnh, xác định vai, chờ tôi duyệt).
- Đóng vai EXECUTOR (triển khai). LƯU Ý: KHÔNG yêu cầu tôi dán mật khẩu/SECRET_KEY/thông tin DB vào chat.

### 2. Hướng dẫn từng bước (tôi tự nhập thông tin nhạy cảm)
- Tách settings dev/prod, DEBUG=False, ALLOWED_HOSTS, SECRET_KEY từ biến môi trường.
- Đưa code lên GitHub → kéo về PythonAnywhere.
- venv trên PythonAnywhere, cài requirements.
- MySQL: tạo DB, settings đọc từ biến môi trường, migrate.
- Web app: WSGI, collectstatic, media.
- Checklist bảo mật trước public.
### Kết thúc
- Chạy `/dong-phien` (cập nhật STATE, tick ROADMAP, ghi EVIDENCE, nhắc commit).

## Tiêu chí hoàn thành
Website chạy được qua link công khai PythonAnywhere.
