---
description: Quy trình mở đầu một phiên làm việc dành cho Agent AI - Nạp ngữ cảnh, xác định vai trò, xác lập phạm vi và lập kế hoạch chờ duyệt.
---

# Workflow: Mở phiên làm việc (Session Initiation)

> [!IMPORTANT]
> Đây là quy trình bắt buộc Agent AI phải thực hiện NGAY khi bắt đầu một phiên làm việc mới. Không được bỏ qua bất kỳ bước nào dưới đây.

## Các bước thực hiện

### Bước 1: Nạp ngữ cảnh (Context Loading)
Agent phải tự động đọc và phân tích các tài liệu nền tảng sau của dự án:
- [PROJECT.md](file:///d:/Hieu/Test/doantotnghiep/PROJECT.md): Để nắm rõ mục tiêu, phạm vi (In-Scope, Out-of-Scope) và quyết định kiến trúc bất biến.
- [ROADMAP.md](file:///d:/Hieu/Test/doantotnghiep/ROADMAP.md): Để kiểm tra lộ trình 13 tuần và xác định phân bổ công việc.
- [STATE.md](file:///d:/Hieu/Test/doantotnghiep/STATE.md): Để biết trạng thái hiện tại, phiên trước đã làm gì, các blocker (nếu có), và task tiếp theo là gì.
- [AGENTS.md](file:///d:/Hieu/Test/doantotnghiep/AGENTS.md): Để xem phân vai và checklist của các cổng chất lượng (Gates).
- [EVIDENCE.md](file:///d:/Hieu/Test/doantotnghiep/EVIDENCE.md): Để xem các tài liệu minh chứng đã có.

### Bước 2: Xác định vai trò (Role Assumption)
Dựa trên giai đoạn hiện tại của dự án trong [ROADMAP.md](file:///d:/Hieu/Test/doantotnghiep/ROADMAP.md) và nhiệm vụ được giao, Agent xác định vai trò tương ứng theo [AGENTS.md](file:///d:/Hieu/Test/doantotnghiep/AGENTS.md):
- **Giai đoạn 1**: Analyst (Phân tích nghiệp vụ).
- **Giai đoạn 2**: Architect (Kiến trúc sư phần mềm).
- **Giai đoạn 3**: Executor (Lập trình viên thực thi).
- **Giai đoạn 4**: Tester (Kỹ sư kiểm thử).
- **Giai đoạn 5**: Executor/Tester (Triển khai & UAT).
- **Giai đoạn 6**: Documenter (Người viết báo cáo).
- **Mọi giai đoạn**: Reviewer (Đánh giá cổng chất lượng) hoặc Supervisor (Giám sát luồng cuối tuần).

> [!NOTE]
> **Yêu cầu bắt buộc**: Agent phải tuyên bố rõ vai trò của mình ở ngay đầu phản hồi đầu tiên.
> *Ví dụ: "Tôi đang đóng vai **Analyst** để thực hiện task 1.1..."*

### Bước 3: Tóm tắt Task & Xác định tiêu chí nghiệm thu (Scope & DoD)
- Đối chiếu yêu cầu của người dùng với task hiện tại trong [ROADMAP.md](file:///d:/Hieu/Test/doantotnghiep/ROADMAP.md).
- **Nguyên tắc bất biến**: Mỗi phiên làm việc chỉ thực thi **MỘT** task duy nhất. Tuyệt đối không tự ý làm thêm các task khác để tránh gây loãng hoặc lỗi hệ thống.
- Xác định rõ tiêu chí hoàn thành (Definition of Done - DoD) của task đó.
- Đối chiếu xem task này có nằm trong phạm vi được duyệt của [PROJECT.md](file:///d:/Hieu/Test/doantotnghiep/PROJECT.md) hay không. Nếu thuộc mục **OUT OF SCOPE**, phải dừng lại báo cáo.

### Bước 4: Lập kế hoạch triển khai & Chờ duyệt (Planning Mode)
- Trước khi thực hiện bất kỳ thay đổi nào đối với mã nguồn hoặc tạo file mới (trừ các file nháp/kế hoạch):
  - Agent phải khởi tạo hoặc cập nhật file kế hoạch triển khai `implementation_plan.md`.
  - Nêu rõ các file sẽ sửa đổi, các file sẽ tạo mới, và phương án kiểm thử (Verification Plan).
  - Đưa ra các câu hỏi mở (nếu có) để làm rõ thiết kế hoặc yêu cầu.
- **DỪNG LẠI** và chờ người dùng phê duyệt kế hoạch (nhấn nút Proceed hoặc gõ xác nhận trong chat) mới được chuyển sang bước thực thi.

---
## Mẫu phản hồi khởi đầu phiên (Template)

Khi mở phiên, Agent phản hồi theo cấu trúc sau:

```markdown
Tôi đang đóng vai **[Tên vai trò]** cho nhiệm vụ này.

### Tóm tắt task & Tiêu chí hoàn thành (DoD)
* **Tên task**: [Mã task] - [Tên task theo ROADMAP]
* **Mô tả ngắn**: [Làm gì]
* **Tiêu chí hoàn thành (DoD)**:
  - [ ] Tiêu chí 1...
  - [ ] Tiêu chí 2...
* **Tài liệu tạo/sửa đổi dự kiến**:
  - [Tên file 1](file:///đường_dẫn_tuyệt_đối)
  - [Tên file 2](file:///đường_dẫn_tuyệt_đối)

Tôi đã chuẩn bị bản kế hoạch triển khai chi tiết tại [implementation_plan.md](file:///đường_dẫn_tới_plan). Xin vui lòng duyệt kế hoạch này trước khi tôi bắt tay vào thực hiện.
```
