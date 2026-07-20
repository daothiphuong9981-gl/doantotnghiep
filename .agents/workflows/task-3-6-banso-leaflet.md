---
description: Task 3.6 - Tích hợp bản đồ Leaflet
---

# Workflow: Task 3.6 — Bản đồ Leaflet (dữ liệu thật)
### 1. Chuẩn bị
- Chạy `/mo-phien` trước (nạp ngữ cảnh, xác định vai, chờ tôi duyệt).
- Đóng vai EXECUTOR.

### 2. Nâng PoC (1.4) thành tính năng thật
- Endpoint JSON danh sách sân (id, tên, lat, lng, giá, url chi tiết) — theo 2.3.
- Trang chủ: Leaflet + OSM hiện TẤT CẢ sân từ endpoint, popup có link chi tiết.
- Nút "Sân gần tôi": vị trí trình duyệt + Haversine, hiển thị sân gần nhất.
- Attribution OSM đúng ODbL.
- Giải thích luồng JS gọi endpoint → nhận JSON → vẽ marker.
### Kết thúc
- Chạy `/dong-phien` (cập nhật STATE, tick ROADMAP, ghi EVIDENCE, nhắc commit).

## Tiêu chí hoàn thành
Bản đồ hiện đúng sân trong DB, popup dẫn chi tiết, 'sân gần tôi' hoạt động, có attribution.
