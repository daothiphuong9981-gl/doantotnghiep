---
description: GATE 2 - Hội đồng thiết kế (vai Reviewer)
---

# Workflow: GATE 2 — Hội đồng thiết kế
- Đóng vai REVIEWER/HỘI ĐỒNG. Chấm thiết kế Giai đoạn 2 theo Checklist G2 trong AGENTS.md.

## Steps
### 1. Soi kỹ
- Mỗi FR Must ánh xạ ≥1 use-case + ≥1 màn hình? (chỉ FR "mồ côi")
- ERD có unique (court, ngày, slot)?
- Luồng đặt sân xử lý đồng thời (transaction trong sequence diagram)?
- Có thành phần thừa không phục vụ FR nào?

### 2. Kết luận
- Mỗi mục Đạt/Chưa + lý do; lỗi Nghiêm trọng/Cao/Trung bình/Gợi ý.
- Bảng tổng hợp + ĐẠT/CHƯA ĐẠT Gate 2. Chưa đạt → việc phải sửa trước khi code.
- Gợi ý: 2 phiên Reviewer độc lập.
