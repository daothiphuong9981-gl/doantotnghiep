---
description: Task 2.5 - Sequence diagram luồng đặt sân
---

# Workflow: Task 2.5 — Luồng đặt sân
### 1. Chuẩn bị
- Chạy `/mo-phien` trước (nạp ngữ cảnh, xác định vai, chờ tôi duyệt).
- Đóng vai ARCHITECT.

### 2. Thiết kế (phần lõi hội đồng soi kỹ)
- Sequence diagram (Mermaid) luồng đặt sân bình thường.
- Kịch bản ĐỒNG THỜI: 2 người cùng đặt 1 slot — thể hiện transaction + unique constraint chặn người thứ 2.
- Giải thích: select_for_update / atomic / bắt IntegrityError.
- State diagram vòng đời Booking: pending → confirmed → cancelled/completed.
### Kết thúc
- Chạy `/dong-phien` (cập nhật STATE, tick ROADMAP, ghi EVIDENCE, nhắc commit).

## Tiêu chí hoàn thành
2 sequence diagram (thường + đồng thời) + giải thích cơ chế chống trùng.
