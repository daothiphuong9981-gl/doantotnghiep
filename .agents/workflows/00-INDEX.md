# INDEX — Toàn bộ Workflow (43 lệnh) cho dự án sân cầu lông

> Gọi bằng slash command trong khung Agent của Antigravity: gõ `/` rồi chọn tên. Mỗi phiên: `/mo-phien` → chạy task → `/dong-phien`.

## Nghi thức phiên (dùng mọi lúc)
| Lệnh | Chức năng |
|---|---|
| `/mo-phien` | Nạp ngữ cảnh, xác định vai, tóm tắt task, chờ duyệt |
| `/dong-phien` | Cập nhật STATE + tick ROADMAP + ghi EVIDENCE + nhắc commit |

## Giai đoạn 1 — Ý tưởng & Khảo sát (vai Analyst)
| Lệnh | Task |
|---|---|
| `/task-1-1-khaosat` | Khảo sát hiện trạng ≥15 sân |
| `/task-1-2-giaiphap-tuongtu` | Phân tích giải pháp tương tự |
| `/task-1-3-khathi-telos` | Nghiên cứu khả thi TELOS |
| `/task-1-4-poc-banso` | PoC bản đồ Leaflet |
| `/task-1-5-dactaFR` | Đặc tả FR & NFR |
| `/task-1-6-chuong1` | Draft Chương 1 |
| `/gate-1-thamdinh-ytuong` | **GATE 1** — Thẩm định ý tưởng |

## Giai đoạn 2 — Phân tích & Thiết kế (vai Architect)
| Lệnh | Task |
|---|---|
| `/task-2-1-usecase` | Use-case diagram & đặc tả |
| `/task-2-2-erd` | Thiết kế CSDL (ERD) |
| `/task-2-3-kientruc-mvt` | Kiến trúc MVT & 3 app |
| `/task-2-4-wireframe` | Wireframe 6 màn hình |
| `/task-2-5-luong-datsan` | Sequence diagram luồng đặt sân |
| `/task-2-6-chuong23` | Draft Chương 2 & 3 |
| `/gate-2-hoidong-thietke` | **GATE 2** — Hội đồng thiết kế |

## Giai đoạn 3 — Xây dựng lõi (vai Executor)
| Lệnh | Task |
|---|---|
| `/task-3-1-khoitao` | Khởi tạo project Django |
| `/task-3-2-models` | Models & migrations |
| `/task-3-3-auth` | Xác thực & phân quyền 3 vai |
| `/task-3-4-crud-san` | CRUD sân cho chủ sân |
| `/task-3-5-danhsach-chitiet` | Danh sách & chi tiết sân |
| `/task-3-6-banso-leaflet` | Tích hợp bản đồ Leaflet |
| `/task-3-7-timkiem-loc` | Tìm kiếm & lọc |
| `/task-3-8-datsan` | **Đặt sân + chống trùng lịch (quan trọng nhất)** |
| `/task-3-9-quanly-booking` | Quản lý booking |
| `/task-3-10-minhchung` | Thu thập minh chứng |
| `/giamsat-luong-tuan` | Giám sát luồng (cuối mỗi tuần) |
| `/gate-3-kiemtra-luong` | **GATE 3** — Kiểm tra luồng |

## Giai đoạn 4 — Hoàn thiện & Kiểm thử (vai Tester)
| Lệnh | Task |
|---|---|
| `/task-4-1-testcase` | Sinh bộ test case từ đặc tả |
| `/task-4-2-chay-test` | Thực thi test & unit test |
| `/task-4-3-sualoi` | Sửa lỗi & test hồi quy |
| `/task-4-4-phaply` | Rà soát tuân thủ pháp lý |
| `/task-4-5-ui-chuong4-kiemthu` | Hoàn thiện UI & Chương 4 (Kiểm thử) |
| `/gate-4-xuatxuong` | **GATE 4** — Cổng xuất xưởng |

## Giai đoạn 5 — Triển khai
| Lệnh | Task |
|---|---|
| `/task-5-1-deploy` | Deploy lên PythonAnywhere |
| `/task-5-2-dulieu-that` | Nhập dữ liệu thật |
| `/task-5-3-uat` | Mini UAT |
| `/task-5-4-chuong4-trienkhai` | Draft phần Triển khai Chương 4 |
| `/gate-5-trienkhai` | **GATE 5** — Triển khai |

## Giai đoạn 6 — Báo cáo & Bảo vệ
| Lệnh | Task |
|---|---|
| `/task-6-1-ghep-baocao` | Ghép & hoàn thiện báo cáo |
| `/task-6-2-phanbien-baocao` | Phản biện báo cáo |
| `/task-6-3-slide-demo` | Slide & kịch bản demo |
| `/task-6-4-luyen-vandap` | Luyện vấn đáp phản biện |
| `/task-6-5-checklist-nop` | Rà soát nộp cuối cùng |
| `/gate-6-baove-thu` | **GATE 6** — Bảo vệ thử |

---
**Nguyên tắc vàng:** chưa qua Gate của giai đoạn hiện tại thì không chạy task của giai đoạn sau.
