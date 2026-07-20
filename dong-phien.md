---
description: Quy trình kết thúc một phiên làm việc dành cho Agent AI - Kiểm thử, cập nhật ROADMAP, ghi nhận STATE, lưu minh chứng EVIDENCE, quản lý đề xuất và nhắc commit Git.
---

# Workflow: Đóng phiên làm việc (Session Termination)

> [!IMPORTANT]
> Đây là quy trình bắt buộc Agent AI phải thực hiện vào CUỐI mỗi phiên làm việc để đảm bảo toàn bộ tiến độ, minh chứng và mã nguồn được lưu trữ đồng bộ, sẵn sàng cho phiên kế tiếp.

## Các bước thực hiện

### Bước 1: Kiểm thử & Xác minh (Verification)
- Agent phải chạy các bài kiểm thử liên quan (unit test, tích hợp) hoặc xác minh thủ công để chắc chắn thay đổi không làm hỏng các tính năng hiện có.
- Chỉ khi các thay đổi đáp ứng đầy đủ tiêu chí nghiệm thu (DoD) của task mới chuyển sang các bước cập nhật trạng thái tiếp theo.
- Tạo hoặc cập nhật file [walkthrough.md](file:///đường_dẫn_tới_walkthrough) để tóm tắt các thay đổi và kết quả kiểm thử.

### Bước 2: Cập nhật STATE.md
Cập nhật thông tin phiên làm việc vào [STATE.md](file:///d:/Hieu/Test/doantotnghiep/STATE.md):
- **Trạng thái hiện tại**: Cập nhật Giai đoạn và Task hiện tại/Task kế tiếp.
- **Nhật ký phiên gần nhất**: Điền ngày hiện tại, các đầu việc đã làm, và kết quả/đầu ra cụ thể (danh sách file tạo/sửa).
- **Vấn đề tồn đọng (blocker)**: Ghi rõ các vấn đề chưa giải quyết được để phiên sau tiếp tục xử lý.

### Bước 3: Cập nhật ROADMAP.md
- Đánh dấu hoàn thành `[x]` cho task tương ứng trong [ROADMAP.md](file:///d:/Hieu/Test/doantotnghiep/ROADMAP.md) **CHỈ KHI** đã đạt đủ tiêu chí hoàn thành.
- Nếu công việc của task chưa hoàn thành trọn vẹn, tuyệt đối không tick `[x]`, đồng thời ghi chú rõ trong [STATE.md](file:///d:/Hieu/Test/doantotnghiep/STATE.md) phần còn thiếu.

### Bước 4: Lưu minh chứng vào EVIDENCE.md
- Nếu task tạo ra kết quả nhìn thấy được (giao diện, bảng biểu, log kiểm thử thành công, sơ đồ thiết kế):
  - Lưu ảnh chụp màn hình vào thư mục `evidence/` với tên file theo mã task (ví dụ: `evidence/anh_1.1.png`).
  - Thêm một mục vào [EVIDENCE.md](file:///d:/Hieu/Test/doantotnghiep/EVIDENCE.md) theo đúng mẫu (Mã task, mô tả 3 dòng kết quả, đường dẫn ảnh, chương báo cáo áp dụng).
- Nếu task thuộc giai đoạn cần nộp báo cáo, dự thảo (draft) một đoạn nội dung ngắn cho chương tương ứng để chuẩn bị nguyên liệu viết báo cáo.

### Bước 5: Ghi nhận Đề xuất chờ duyệt
- Nếu trong quá trình thực hiện có những thay đổi hoặc đề xuất phát sinh nằm ngoài thiết kế ban đầu hoặc ảnh hưởng đến [PROJECT.md](file:///d:/Hieu/Test/doantotnghiep/PROJECT.md):
  - Ghi đề xuất vào bảng **Đề xuất chờ duyệt** trong [STATE.md](file:///d:/Hieu/Test/doantotnghiep/STATE.md) với cột Quyết định đặt là `Chờ duyệt`.
  - Tuyệt đối **KHÔNG** tự ý sửa đổi file [PROJECT.md](file:///d:/Hieu/Test/doantotnghiep/PROJECT.md).

### Bước 6: Nhắc nhở Commit Git & Xuất trạng thái
- Nhắc nhở người dùng thực hiện commit Git với thông điệp rõ ràng theo mã task (ví dụ: `git commit -m "docs: update session workflows for task 1.1"`).
- Xuất lại phần nội dung nhật ký vừa ghi trong [STATE.md](file:///d:/Hieu/Test/doantotnghiep/STATE.md) ra khung chat để người dùng xác nhận và nắm bắt nhanh.

---
## Mẫu phản hồi kết thúc phiên (Template)

Khi đóng phiên, Agent phản hồi theo cấu trúc sau:

```markdown
Tôi đã hoàn thành công việc của phiên này. Dưới đây là tóm tắt kết quả:

### 1. Kết quả thực hiện
- Đã tạo/sửa đổi các file: [Tên file](đường_dẫn)
- Kết quả test: [Đạt/Không đạt]

### 2. Cập nhật tài liệu dự án
- [x] Cập nhật nhật ký và trạng thái trong [STATE.md](file:///d:/Hieu/Test/doantotnghiep/STATE.md)
- [ ] Cập nhật tiến độ trong [ROADMAP.md](file:///d:/Hieu/Test/doantotnghiep/ROADMAP.md) (đã tick/chưa tick vì lý do...)
- [x] Ghi minh chứng vào [EVIDENCE.md](file:///d:/Hieu/Test/doantotnghiep/EVIDENCE.md)
- [x] Tạo tài liệu tổng kết [walkthrough.md](file:///đường_dẫn_tới_walkthrough)

### 3. Đề xuất chờ duyệt (nếu có)
* [Mô tả đề xuất] -> [Lý do]

> [!TIP]
> Bạn hãy thực hiện commit các thay đổi này bằng lệnh Git:
> `git add .`
> `git commit -m "feat: [Mã task] cập nhật workflows mở và đóng phiên"`
```
