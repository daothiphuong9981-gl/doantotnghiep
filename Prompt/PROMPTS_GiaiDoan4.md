# PROMPTS — Giai đoạn 4: Hoàn thiện & Kiểm thử (Tuần 9–10)
> Cách dùng: mỗi tiểu mục = một phiên chat riêng. Đính kèm PROJECT.md, ROADMAP.md, STATE.md, AGENTS.md, EVIDENCE.md + use-case/FR (Giai đoạn 1–2) + mã nguồn hiện tại.
> Điều kiện tiên quyết: Gate 3 đã ĐẠT (100% FR Must chạy được).
> Nguyên tắc cốt lõi giai đoạn này: TESTER sinh test từ ĐẶC TẢ, KHÔNG nhìn code — tránh "tự chấm bài mình".

---

## PROMPT MỞ ĐẦU (dán trước MỌI phiên trong giai đoạn 4)
```
Bạn đóng vai TESTER theo AGENTS.md. Đọc PROJECT.md, ROADMAP.md, STATE.md và các use-case/FR đã duyệt trước.
Nguyên tắc bắt buộc:
- Sinh test case CHỈ dựa trên đặc tả use-case và FR, KHÔNG dựa vào mã nguồn (để test khách quan, không thiên vị theo cách code đã viết).
- Bao phủ đủ: luồng chính, luồng ngoại lệ, giá trị biên, phân quyền.
- Mỗi test phải có Expected rõ ràng, kiểm chứng được (không mơ hồ).
- Trước khi làm, tóm tắt phạm vi test + tiêu chí hoàn thành để tôi xác nhận.
```

---

## Task 4.1 — Sinh bộ test case từ đặc tả
```
TASK 4.1 — Thiết kế ≥20 test case từ use-case/FR.
Dựa trên các use-case ở task 2.1 và bảng FR, sinh bảng test case, mỗi dòng gồm:
Mã TC | Use-case/FR liên quan | Mô tả | Tiền điều kiện | Các bước | Dữ liệu vào | Kết quả mong đợi (Expected)
Bắt buộc bao phủ các nhóm:
- Luồng chính: đăng ký/đăng nhập, tạo sân, tìm kiếm, đặt sân, xác nhận, hủy.
- Luồng ngoại lệ: đặt slot đã có người đặt; chưa đăng nhập mà đặt; nhập sai định dạng; upload ảnh quá lớn.
- Giá trị biên: slot đầu/cuối ngày; đặt sát giờ; giá = 0; tọa độ ngoài Đà Nẵng.
- Phân quyền: player mở dashboard owner; owner sửa sân của owner khác; truy cập admin không quyền.
- Pháp lý (NFR): có thông báo thu thập dữ liệu cá nhân; xóa tài khoản; attribution OSM hiển thị.
Đánh số TC-01 trở đi, nhóm theo chức năng. Đây là bảng tôi sẽ đưa nguyên vào Chương 4.
Tiêu chí hoàn thành: ≥20 test case có Expected rõ ràng, bao phủ đủ 5 nhóm trên.
```

## Task 4.2 — Thực thi test & unit test Django
```
TASK 4.2 — Chạy test và ghi kết quả.
1. Hướng dẫn tôi thực thi thủ công bảng TC ở 4.1, bổ sung 2 cột: Kết quả thực tế (Actual) + Pass/Fail.
2. Viết UNIT TEST Django (TestCase) cho phần lõi:
   - Model Booking: ràng buộc unique chống trùng (tạo 2 booking trùng phải lỗi).
   - Test mô phỏng đặt đồng thời (nối tiếp task 3.8).
   - Test phân quyền: client đăng nhập vai player không vào được view owner.
3. Hướng dẫn chạy `python manage.py test` và đọc kết quả.
Giải thích ngắn cách Django TestCase tạo DB tạm, để tôi bảo vệ được.
Tiêu chí hoàn thành: bảng TC có cột Actual + Pass/Fail; unit test lõi chạy và pass.
```

## Task 4.3 — Sửa lỗi & test hồi quy
```
TASK 4.3 — Xử lý lỗi phát hiện (đóng thêm vai EXECUTOR khi sửa).
1. Lập bảng lỗi từ các TC Fail: mã lỗi, mô tả, mức độ (Nghiêm trọng/Cao/Trung bình/Thấp), nguyên nhân, cách sửa.
2. Sửa lần lượt theo mức độ ưu tiên (Nghiêm trọng trước). Với mỗi sửa: giải thích thay đổi, KHÔNG sửa lan sang phần khác.
3. Sau khi sửa, chạy lại các TC liên quan (test hồi quy) để chắc không phát sinh lỗi mới.
Nhắc: nếu sửa lỗi đòi thay đổi schema/thiết kế, ghi "Đề xuất chờ duyệt" trước.
Tiêu chí hoàn thành: 0 lỗi Nghiêm trọng/Cao còn mở; test hồi quy pass.
```

## Task 4.4 — Rà soát tuân thủ pháp lý
```
TASK 4.4 — Kiểm tra tuân thủ (đối chiếu PROJECT.md mục 7).
Rà soát và hoàn thiện:
1. NĐ 13/2023: thông báo mục đích thu thập dữ liệu cá nhân khi đăng ký; thu thập tối thiểu (chỉ tên, SĐT, email); chức năng người dùng XÓA tài khoản hoạt động thật.
2. Attribution OpenStreetMap/ODbL hiển thị đúng trên mọi bản đồ.
3. Không có dữ liệu cá nhân lộ trên URL/log.
Lập checklist đối chiếu, mỗi mục Đạt/Chưa + cách khắc phục nếu chưa. Soạn đoạn text thông báo dữ liệu cá nhân đúng tinh thần NĐ 13/2023 để tôi dùng.
Tiêu chí hoàn thành: mọi mục pháp lý trong PROJECT.md mục 7 đều Đạt.
```

## Task 4.5 — Hoàn thiện UI & viết phần Kiểm thử báo cáo
```
TASK 4.5 — Hoàn thiện giao diện + draft Chương 4 phần Kiểm thử (đóng thêm vai DOCUMENTER).
1. Rà UI: responsive cơ bản (Bootstrap), thông báo lỗi/thành công rõ ràng, không còn nút chết, tiếng Việt nhất quán.
2. Draft phần Kiểm thử của Chương 4 dựa trên đầu ra 4.1–4.4:
   - Mục tiêu & phương pháp kiểm thử (thủ công + unit test).
   - Bảng test case và kết quả.
   - Thống kê: tổng TC, số pass/fail, tỷ lệ.
   - Nhận xét về độ tin cậy hệ thống.
Chỉ dùng số liệu THẬT từ việc chạy test, không bịa. Thiếu thì đánh [CẦN BỔ SUNG].
Tiêu chí hoàn thành: UI hoàn thiện; phần Kiểm thử của Chương 4 hoàn chỉnh với số liệu thật.
```

---

## PROMPT ĐÓNG PHIÊN
```
Kết thúc phiên:
1. Cập nhật STATE.md: task, đầu ra, tồn đọng, task kế tiếp.
2. Tick ROADMAP.md khi đủ tiêu chí.
3. Lưu bảng test case + ảnh kết quả chạy test vào EVIDENCE.md (Giai đoạn 4).
4. Nhắc commit Git.
Xuất lại STATE.md.
```

---

## GATE 4 — Cổng xuất xưởng (đổi sang vai REVIEWER)
```
Bạn đổi sang vai REVIEWER/HỘI ĐỒNG theo AGENTS.md. Chấm Gate 4 theo Checklist G4:
- ≥20 test case, 100% pass, có bảng kết quả thật?
- Test đặt sân đồng thời pass?
- NĐ 13/2023: thông báo mục đích + xóa tài khoản hoạt động?
- Attribution OSM hiển thị?
Mỗi mục Đạt/Chưa đạt + bằng chứng. Kết luận ĐẠT/CHƯA ĐẠT Gate 4 (được phép "xuất xưởng" đi triển khai chưa). Chưa đạt thì liệt kê việc phải hoàn tất.
```
