# PROMPTS — Giai đoạn 5: Triển khai (Tuần 11)
> Cách dùng: mỗi tiểu mục = một phiên chat riêng. Đính kèm PROJECT.md, ROADMAP.md, STATE.md, AGENTS.md, EVIDENCE.md + mã nguồn.
> Điều kiện tiên quyết: Gate 4 đã ĐẠT (test pass, đủ điều kiện xuất xưởng).

⚠️ LƯU Ý QUAN TRỌNG VỀ BẢO MẬT: KHÔNG dán mật khẩu, khóa API, token hay thông tin đăng nhập PythonAnywhere/MySQL vào chat với AI. AI sẽ HƯỚNG DẪN bạn thao tác, còn bạn tự nhập thông tin nhạy cảm trực tiếp trên máy/trang quản trị.

---

## PROMPT MỞ ĐẦU (dán trước MỌI phiên trong giai đoạn 5)
```
Bạn đóng vai EXECUTOR (triển khai) theo AGENTS.md. Đọc PROJECT.md, ROADMAP.md, STATE.md trước.
Nguyên tắc bắt buộc:
- Hướng dẫn tôi từng bước; TÔI tự nhập mọi thông tin nhạy cảm (mật khẩu, DB, SECRET_KEY). Bạn KHÔNG được yêu cầu tôi dán các thông tin đó vào chat.
- Bám đúng tech stack: PythonAnywhere + MySQL (production) theo PROJECT.md.
- Trước khi làm, tóm tắt các bước + rủi ro + tiêu chí hoàn thành để tôi xác nhận.
```

---

## Task 5.1 — Deploy lên PythonAnywhere
```
TASK 5.1 — Triển khai production.
Hướng dẫn tôi TỪNG BƯỚC (tôi tự thao tác, tự nhập thông tin nhạy cảm):
1. Chuẩn bị code cho production: tách settings dev/prod, DEBUG=False, ALLOWED_HOSTS, SECRET_KEY đọc từ biến môi trường (KHÔNG hardcode).
2. Đưa code lên GitHub, kéo về PythonAnywhere.
3. Tạo virtualenv trên PythonAnywhere, cài requirements.
4. Cấu hình MySQL: tạo DB, cập nhật settings đọc thông tin từ biến môi trường, chạy migrate.
5. Cấu hình web app: WSGI, static files (collectstatic), media files.
6. Checklist bảo mật trước khi public: DEBUG tắt, SECRET_KEY an toàn, không lộ thông tin DB.
Giải thích mỗi bước để tôi bảo vệ được phần triển khai trước hội đồng.
Tiêu chí hoàn thành: website chạy được qua link công khai PythonAnywhere.
```

## Task 5.2 — Nhập dữ liệu thật
```
TASK 5.2 — Nạp dữ liệu sân thật.
1. Từ bảng khảo sát ở task 1.1, hướng dẫn nhập ≥10 sân Đà Nẵng thật vào production (qua admin hoặc script/fixture).
2. Tạo vài tài khoản mẫu: 2–3 chủ sân, vài người chơi để demo.
3. Tạo sẵn vài booking mẫu ở các trạng thái khác nhau (pending/confirmed) để demo sinh động.
4. Kiểm tra dữ liệu hiển thị đúng trên bản đồ (tọa độ thật đúng vị trí).
Tiêu chí hoàn thành: ≥10 sân thật trên production, hiện đúng vị trí bản đồ, có dữ liệu demo.
```

## Task 5.3 — Kiểm thử người dùng thật (mini UAT)
```
TASK 5.3 — User Acceptance Test nhỏ.
1. Soạn KỊCH BẢN dùng thử cho 3–5 người (mỗi người làm trọn luồng: tìm sân → đặt → xem lại), kèm phiếu ghi nhận.
2. Soạn bảng thu thập phản hồi: dễ dùng không, lỗi gặp phải, đề xuất — thang điểm + ý kiến mở.
3. Hướng dẫn tôi tổng hợp phản hồi thành bảng, phân loại: lỗi cần sửa gấp / cải thiện / ghi nhận cho hướng phát triển.
Tiêu chí hoàn thành: có phản hồi thật từ ≥3 người, tổng hợp thành bảng để đưa vào báo cáo.
```

## Task 5.4 — Viết phần Triển khai báo cáo
```
TASK 5.4 — Draft phần Triển khai của Chương 4 (đóng thêm vai DOCUMENTER).
Dựa trên đầu ra 5.1–5.3, viết:
- Môi trường triển khai (PythonAnywhere, MySQL) và cấu hình.
- Quy trình deploy tóm tắt.
- Kết quả: link website, ảnh chụp hệ thống chạy thật, số liệu dữ liệu (số sân, số tài khoản).
- Kết quả mini UAT: bảng phản hồi + nhận xét.
Chỉ dùng dữ liệu thật. Thiếu thì đánh [CẦN BỔ SUNG]. Website chạy thật là điểm cộng lớn — trình bày nổi bật.
Tiêu chí hoàn thành: phần Triển khai hoàn chỉnh với link thật + minh chứng.
```

---

## PROMPT ĐÓNG PHIÊN
```
Kết thúc phiên:
1. Cập nhật STATE.md: task, đầu ra, tồn đọng, task kế tiếp.
2. Tick ROADMAP.md khi đủ tiêu chí.
3. Lưu ảnh website chạy production + link + phản hồi UAT vào EVIDENCE.md (Giai đoạn 5).
Xuất lại STATE.md.
```

---

## GATE 5 (đổi sang vai SUPERVISOR)
```
Bạn là SUPERVISOR. Chấm Gate 5:
- Link công khai truy cập được?
- Luồng đặt sân end-to-end chạy trên production (không chỉ trên máy local)?
- Có ≥10 sân dữ liệu thật, hiện đúng vị trí?
- Bảo mật: DEBUG=False, không lộ SECRET_KEY/thông tin DB?
Mỗi mục Đạt/Chưa + bằng chứng. Kết luận ĐẠT/CHƯA ĐẠT Gate 5.
```
