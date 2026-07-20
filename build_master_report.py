import os

def load_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        return f.read().strip()

# Front Matter
front_matter = """# BỘ GIÁO DỤC VÀ ĐÀO TẠO
# TRƯỜNG ĐẠI HỌC DUY TÂN
# KHOA CÔNG NGHỆ THÔNG TIN

---

# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP CỬ NHÂN CÔNG NGHỆ THÔNG TIN
## CHUYÊN NGÀNH: CÔNG NGHỆ PHẦN MỀM

### ĐỀ TÀI:
**XÂY DỰNG WEBSITE CHO THUÊ VÀ QUẢN LÝ ĐẶT SÂN CẦU LÔNG TÍCH HỢP BẢN ĐỒ SỐ WEBGIS TẠI THÀNH PHỐ ĐÀ NẴNG**

- **Giảng viên hướng dẫn:** ThS. Nguyễn Trung Thuận
- **Sinh viên thực hiện:** Đào Thị Phương (Mã SV: 9981)
- **Năm bảo vệ:** 2026

---

## LỜI CAM ĐOAN

Tôi xin cam đoan đây là công trình nghiên cứu và phát triển hệ thống độc lập của tôi dưới sự hướng dẫn khoa học của ThS. Nguyễn Trung Thuận. Toàn bộ nội dung, phân tích nghiệp vụ, kiến trúc hệ thống, mã nguồn lập trình và kết quả kiểm thử trong báo cáo này là trung thực, tự thực hiện và chưa từng được công bố trong bất kỳ công trình nào khác trước đây.

Các số liệu khảo sát sân cầu lông tại Đà Nẵng, dữ liệu bản đồ OpenStreetMap và các thư viện mã nguồn mở được sử dụng đều tuân thủ giấy phép bản quyền hợp pháp (ODbL, MIT License) và có trích dẫn nguồn gốc đầy đủ, rõ ràng. Nếu phát hiện có bất kỳ sự gian lận hay vi phạm bản quyền nào, tôi xin chịu hoàn toàn trách nhiệm trước Hội đồng bảo vệ đồ án và Trường Đại học Duy Tân.

*Đà Nẵng, tháng 07 năm 2026*  
**Sinh viên thực hiện**  
*(Đã ký)*  
**Đào Thị Phương**

---

## LỜI CẢM ƠN

Để hoàn thành đồ án tốt nghiệp này một cách trọn vẹn và đạt chất lượng tốt nhất, tôi xin gửi lời tri ân sâu sắc đến những Thầy/Cô và cá nhân đã luôn đồng hành, hỗ trợ tôi trong suốt thời gian qua.

Trước hết, tôi xin bày tỏ lòng biết ơn sâu sắc đến **ThS. Nguyễn Trung Thuận** – người giảng viên hướng dẫn đã tận tâm định hướng đề tài, chỉnh sửa từng chi tiết kỹ thuật, đóng góp nhiều ý kiến quý báu từ giai đoạn khảo sát nghiệp vụ, định hình kiến trúc Django MVT cho đến giải quyết các bài toán hóc búa về lập trình WebGIS và cơ chế khóa dòng chống trùng lịch (`select_for_update`).

Tôi xin gửi lời cảm ơn chân thành đến Ban Chủ nhiệm cùng toàn thể Quý Thầy/Cô **Khoa Công nghệ Thông tin, Trường Đại học Duy Tân** đã tận tình giảng dạy, truyền đạt kiến thức nền tảng vững chắc về khoa học máy tính, kỹ thuật phần mềm và quản lý dự án Agile/Scrum trong suốt 4 năm học tập tại trường.

Cuối cùng, tôi xin cảm ơn gia đình, bạn bè và các anh/chị chủ sân cầu lông tại TP. Đà Nẵng đã tích cực hỗ trợ khảo sát thực địa, tham gia kiểm thử người dùng (Mini UAT) và đóng góp nhiều phản hồi thực tiễn quý giá giúp hoàn thiện sản phẩm.

Mặc dù đã có nhiều cố gắng nghiên cứu và hoàn thiện, nhưng do giới hạn về mặt thời gian và trình độ thực tiễn, đồ án chắc chắn không tránh khỏi những thiếu sót nhất định. Tôi rất mong nhận được những nhận xét, góp ý quý báu từ Quý Thầy/Cô trong Hội đồng phản biện để đề tài tiếp tục được hoàn thiện và phát triển xa hơn nữa trong tương lai.

Xin trân trọng cảm ơn!

*Đà Nẵng, tháng 07 năm 2026*  
**Đào Thị Phương**

---

## MỤC LỤC

- [LỜI CAM ĐOAN](#lời-cam-đoan)
- [LỜI CẢM ƠN](#lời-cảm-ơn)
- [DANH MỤC CÁC TỪ VIẾT TẮT](#danh-mục-các-từ-viết-tắt)
- [DANH MỤC HÌNH VẼ](#danh-mục-hình-vẽ)
- [DANH MỤC BẢNG BIỂU](#danh-mục-bảng-biểu)
- [CHƯƠNG 1: ĐẶT VẤN ĐỀ VÀ NGHIÊN CỨU KHẢ THI](#chương-1-đặt-vấn-đề-và-nghiên-cứu-khả-thi)
- [CHƯƠNG 2: CƠ SỞ LÝ THUYẾT VÀ CÔNG NGHỆ SỬ DỤNG](#chương-2-cơ-sở-lý-thuyết-và-công-nghệ-sử-dụng)
- [CHƯƠNG 3: PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG](#chương-3-phân-tích-và-thiết-kế-hệ-thống)
- [CHƯƠNG 4: KIỂM THỬ VÀ TRIỂN KHAI HỆ THỐNG](#chương-4-kiểm-thử-và-triển-khai-hệ-thống)
- [CHƯƠNG 5: KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN](#chương-5-kết-luận-và-hướng-phát-triển)
- [TÀI LIỆU THAM KHẢO](#tài-liệu-tham-khảo)

---

## DANH MỤC CÁC TỪ VIẾT TẮT

| Từ viết tắt | Tên Tiếng Anh | Tên Tiếng Việt |
| :--- | :--- | :--- |
| **ACID** | Atomicity, Consistency, Isolation, Durability | Nguyên tử, Nhất quán, Cô lập, Bền vững (Tính chất giao dịch CSDL) |
| **CRUD** | Create, Read, Update, Delete | Thêm mới, Đọc, Cập nhật, Xóa |
| **ERD** | Entity-Relationship Diagram | Sơ đồ quan hệ thực thể |
| **FR** | Functional Requirement | Yêu cầu chức năng |
| **GIS** | Geographic Information System | Hệ thống thông tin địa lý |
| **IDOR** | Insecure Direct Object Reference | Lỗ hổng tham chiếu đối tượng trực tiếp không an toàn |
| **MoSCoW** | Must - Should - Could - Won't | Khung phân loại ưu tiên yêu cầu nghiệp vụ |
| **MVC** | Model - View - Controller | Mô hình thiết kế Kiến trúc phần mềm MVC |
| **MVT** | Model - View - Template | Mô hình thiết kế Kiến trúc phần mềm Django MVT |
| **NFR** | Non-Functional Requirement | Yêu cầu phi chức năng |
| **ODbL** | Open Database License | Giấy phép cơ sở dữ liệu mở (bản quyền OpenStreetMap) |
| **ORM** | Object-Relational Mapping | Ánh xạ đối tượng - quan hệ trong CSDL |
| **OSM** | OpenStreetMap | Dự án bản đồ số mở toàn cầu |
| **PBKDF2** | Password-Based Key Derivation Function 2 | Hàm dẫn xuất khóa mật khẩu (cơ chế băm mật khẩu Django) |
| **PoC** | Proof of Concept | Bằng chứng nguyên lý (thử nghiệm khả thi công nghệ) |
| **UAT** | User Acceptance Testing | Kiểm thử chấp nhận người dùng |
| **WebGIS** | Web Geographic Information System | Hệ thống thông tin địa lý trên nền web |
| **WSGI** | Web Server Gateway Interface | Giao diện cổng máy chủ Web Python |

---

## DANH MỤC HÌNH VẼ

- **Hình 1.1**: Sơ đồ nguyên lý hoạt động của ứng dụng bằng chứng PoC bản đồ WebGIS Leaflet tích hợp OpenStreetMap.
- **Hình 2.1**: Sơ đồ kiến trúc xử lý luồng dữ liệu Django MVT và sự tương tác với máy chủ bản đồ số OpenStreetMap.
- **Hình 3.1**: Biểu đồ Use-case tổng quát của hệ thống Website cho thuê sân cầu lông Đà Nẵng.
- **Hình 3.2**: Sơ đồ quan hệ thực thể (ERD) chuẩn hóa 3NF của hệ thống.
- **Hình 3.3**: Sơ đồ kiến trúc tổng quan 3 ứng dụng (`accounts`, `courts`, `bookings`) trong project Django MVT.
- **Hình 3.4**: Wireframe màn hình Trang chủ WebGIS hiển thị bản đồ marker cụm sân (`court_map.html`).
- **Hình 3.5**: Wireframe màn hình Chi tiết cụm sân và lựa chọn khung giờ trống (`court_detail.html`).
- **Hình 3.6**: Wireframe màn hình Lịch sử đặt sân cá nhân cho Người chơi (`booking_list.html`).
- **Hình 3.7**: Wireframe màn hình Dashboard Quản lý Booking cho Chủ sân (`booking_manage.html`).
- **Hình 3.8**: Wireframe màn hình Quản lý danh sách sân cho Chủ sân (`court_manage.html`).
- **Hình 3.9**: Wireframe màn hình Thêm mới/Cập nhật thông tin sân và định vị tọa độ (`court_form.html`).
- **Hình 3.10**: Biểu đồ tuần tự (Sequence Diagram) chi tiết luồng xử lý đặt sân trực tuyến và cơ chế chống trùng lịch đồng thời (`select_for_update`).
- **Hình 4.1**: Sơ đồ kiến trúc triển khai hệ thống trên máy chủ thực tế PythonAnywhere (`daothiphuong.pythonanywhere.com`).

---

## DANH MỤC BẢNG BIỂU

- **Bảng 1.1**: Bảng tổng hợp số liệu khảo sát thực trạng quản lý và đặt lịch tại 16 cụm sân cầu lông trên địa bàn TP. Đà Nẵng.
- **Bảng 1.2**: Phân tích so sánh chi tiết giữa hệ thống đề xuất với 3 giải pháp tương tự hiện có trên thị trường.
- **Bảng 1.3**: Bảng đánh giá mức độ khả thi tổng thể của dự án theo khung 5 tiêu chí TELOS.
- **Bảng 3.1**: Danh sách các yêu cầu chức năng (FR) của hệ thống được phân cấp ưu tiên theo khung MoSCoW.
- **Bảng 3.2**: Danh sách các yêu cầu phi chức năng (NFR) của hệ thống.
- **Bảng 3.3**: Đặc tả chi tiết Use-case Đăng ký & Đăng nhập (UC-01).
- **Bảng 3.4**: Đặc tả chi tiết Use-case CRUD Thông tin sân bãi (UC-03).
- **Bảng 3.5**: Đặc tả chi tiết Use-case Xem bản đồ WebGIS, Tìm kiếm & Lọc sân (UC-04/05).
- **Bảng 3.6**: Đặc tả chi tiết Use-case Đặt sân trực tuyến & Chống trùng lịch (UC-07/08).
- **Bảng 3.7**: Đặc tả chi tiết Use-case Quản trị Booking & Duyệt cọc (UC-09).
- **Bảng 3.8**: Từ điển cấu trúc thuộc tính bảng người dùng (`CustomUser`).
- **Bảng 3.9**: Từ điển cấu trúc thuộc tính bảng cụm sân (`Court`).
- **Bảng 3.10**: Từ điển cấu trúc thuộc tính bảng khung giờ (`TimeSlot`).
- **Bảng 3.11**: Từ điển cấu trúc thuộc tính bảng đơn đặt sân (`Booking`).
- **Bảng 3.12**: Từ điển cấu trúc thuộc tính bảng đánh giá sao (`Review`).
- **Bảng 3.13**: Danh sách chi tiết các URL, giao thức HTTP và View xử lý trong kiến trúc MVT của hệ thống.
- **Bảng 4.1**: Thống kê tổng hợp kết quả thực thi bộ ca kiểm thử tự động và thủ công (`TC-01` đến `TC-22`).
- **Bảng 4.2**: Kết quả đánh giá định lượng Mini UAT trên môi trường Production theo thang điểm Likert 5 mức độ.
- **Bảng 4.3**: Phân tích, phân loại và giải trình ý kiến đóng góp định tính từ người dùng thực tế trong Mini UAT.

---
"""

c1 = load_file('baocao_chuong1.md')
c2 = load_file('baocao_chuong2.md')
c3 = load_file('baocao_chuong3.md')
c4 = load_file('baocao_chuong4.md')

# Chapter 5 and References
c5_and_refs = """# CHƯƠNG 5: KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

## 5.1. Kết quả đạt được của đề tài

Sau quá trình 13 tuần nghiêm túc khảo sát, phân tích, thiết kế, lập trình và kiểm thử toàn diện trên môi trường thực tế, đề tài *“Xây dựng Website cho thuê và quản lý đặt sân cầu lông tích hợp bản đồ số WebGIS tại TP. Đà Nẵng”* đã hoàn thành xuất sắc 100% các mục tiêu đề ra ban đầu, đáp ứng đầy đủ các tiêu chí khắt khe của một đồ án tốt nghiệp kỹ thuật phần mềm mang tính ứng dụng cao.

Cụ thể, hệ thống đã đạt được những kết quả nổi bật trên 3 phương diện chính:

### 5.1.1. Về mặt Nghiên cứu & Phân tích nghiệp vụ
- Thực hiện khảo sát thực địa sâu rộng đối với **16 cụm sân cầu lông lớn nhỏ tại 6 quận** của TP. Đà Nẵng, chỉ ra điểm nghẽn nghiêm trọng của phương thức đặt lịch thủ công qua điện thoại/Zalo (dễ gây trùng lịch, thiếu minh bạch khung giờ).
- Xây dựng mô hình phân tích khả thi toàn diện theo **khung TELOS** và đặc tả chi tiết **12 Yêu cầu chức năng (FR)** theo phân cấp ưu tiên **MoSCoW** cùng **5 Yêu cầu phi chức năng (NFR)**.
- Chuẩn hóa cấu trúc dữ liệu theo **Sơ đồ ERD đạt chuẩn 3NF**, bảo đảm tính toàn vẹn và tối ưu hóa quan hệ khóa ngoại giữa các bảng `CustomUser`, `Court`, `TimeSlot`, `Booking` và `Review`.

### 5.1.2. Về mặt Kỹ thuật & Công nghệ lõi
- Xây dựng thành công ứng dụng **WebGIS tương tác mượt mà** trên nền tảng **Leaflet.js và OpenStreetMap (OSM)**, cho phép định vị trực quan 16 marker cụm sân, tự động định vị người chơi (`Geolocation`) và tìm kiếm sân gần nhất bằng công thức khoảng cách Haversine.
- **Giải quyết triệt để bài toán Trùng lịch đặt sân (Double-booking / Race Condition)**: Sử dụng kiến trúc giao dịch nguyên tử `transaction.atomic()` kết hợp khóa độc quyền tầng CSDL (`select_for_update`) và ràng buộc toàn vẹn `UniqueConstraint(fields=['court', 'date', 'time_slot'])`. Qua bộ kiểm thử chịu tải đồng thời `BookingConcurrencyTestCase`, hệ thống bảo vệ 100% không cho phép hai người chơi đặt trùng một khung giờ bãi bọc.
- Thiết lập cơ chế bảo mật vững chắc, ngăn chặn hoàn toàn **lỗ hổng tham chiếu đối tượng trực tiếp (IDOR)** thông qua decorator `@owner_required` và kiểm tra quyền sở hữu đối tượng tại từng view (`player=request.user`, `court__owner=request.user`).
- Tuân thủ chuẩn mực **Khung pháp lý Việt Nam (Nghị định 13/2023/NĐ-CP)** về bảo vệ dữ liệu cá nhân (tích hợp Checkbox Explicit Consent và tính năng Xóa vĩnh viễn tài khoản Right to be Forgotten).

### 5.1.3. Về mặt Triển khai & Đánh giá thực tiễn
- Triển khai thành công website công khai 24/7 trên nền tảng điện toán đám mây **PythonAnywhere** tại đường dẫn chính thức: `https://daothiphuong.pythonanywhere.com/courts/`.
- Phân tích và đưa ra quyết định kiến trúc sắc bén: Chuyển sang sử dụng **CSDL SQLite (`db.sqlite3`)** cho môi trường Production trên tài khoản miễn phí ($0/tháng) nhằm thích ứng với chính sách mới từ tháng 01/2026 của nền tảng, đảm bảo hệ thống vận hành bền vững, chi phí cực thấp nhưng vẫn giữ nguyên 100% khả năng khóa giao dịch đồng thời.
- Khắc phục xuất sắc các rào cản kỹ thuật thực tế như: Lỗi chặn truy cập bản đồ `403 Referrer Blocked` (bằng thẻ meta `strict-origin-when-cross-origin` và máy chủ gương `tile.openstreetmap.de`) cùng lỗi định dạng số vùng miền `|unlocalize` (`USE_L10N = True`).
- Tổ chức kiểm thử người dùng thực tế (Mini UAT) với 5 đại diện (Người chơi phong trào, Chủ sân, Kỹ sư kiểm thử), thu được kết quả **điểm hài lòng chung đạt 4.64/5.0 (92.8%)**, không phát hiện bất kỳ lỗi nghiêm trọng nào.

---

## 5.2. Hạn chế của đề tài

Bên cạnh những kết quả tích cực đã đạt được, với tư cách là một công trình đồ án tốt nghiệp thực hiện trong khuôn khổ 13 tuần của một sinh viên, hệ thống vẫn còn một số giới hạn và điểm hạn chế nhất định (đều nằm trong phạm vi OUT OF SCOPE đã được khai báo minh bạch tại `PROJECT.md`):

1. **Chưa tích hợp cổng thanh toán trực tuyến (Payment Gateway Integration)**: Hiện tại, hệ thống mới thực hiện tự động tính toán tổng tiền thanh toán (`Price * Hours`) và chốt đơn đặt cọc ở trạng thái `PENDING` (Chờ duyệt). Người chơi vẫn cần thanh toán tiền mặt trực tiếp tại sân hoặc chuyển khoản qua tài khoản ngân hàng của chủ sân bên ngoài hệ thống. Việc chưa tích hợp trực tiếp các cổng thanh toán tự động như MoMo, VNPay hay ZaloPay khiến quá trình xác nhận cọc vẫn phụ thuộc vào thao tác bấm nút "Duyệt" thủ công của chủ sân.
2. **Chưa hỗ trợ gửi thông báo theo thời gian thực (Real-time SMS/Email/Zalo Notifications)**: Khi có một đơn đặt sân mới tạo ra hoặc được chủ sân xác nhận thành công, người dùng hiện tại phải chủ động tải lại trang hoặc truy cập vào lịch sử đơn hàng để kiểm tra trạng thái. Hệ thống chưa tích hợp các webhook hoặc dịch vụ gửi tin nhắn tự động qua Zalo OA, SMS hay Push Notification để nhắc lịch trước thời gian thi đấu.
3. **Phạm vi dữ liệu địa lý mới tập trung tại khu vực nội thành Đà Nẵng**: Cơ sở dữ liệu hiện tại tập trung quản lý chi tiết 16 cụm sân cầu lông tiêu biểu tại 6 quận nội thành và ven đô của TP. Đà Nẵng, chưa mở rộng ra các huyện ngoại thành như Hòa Vang, Hoàng Sa hay các tỉnh thành phố lân cận trong khu vực miền Trung.
4. **Chưa tích hợp các thuật toán trí tuệ nhân tạo (AI/ML Recommendation)**: Hệ thống hiện đang tìm kiếm sân dựa trên khoảng cách địa lý (Haversine) và bộ lọc thuộc tính tĩnh (quận, mức giá). Chưa có mô hình học máy phân tích lịch sử chơi và thói quen của người dùng để tự động gợi ý sân bãi phù hợp hoặc dự báo khung giờ cao điểm cho chủ sân.

---

## 5.3. Hướng phát triển trong tương lai

Từ những hạn chế thực tiễn nêu trên và các ý kiến đóng góp quý báu từ người dùng trong buổi khảo sát Mini UAT, lộ trình phát triển và hoàn thiện giải pháp trong giai đoạn 2 sau khi bảo vệ tốt nghiệp được định hướng theo các mũi nhọn sau:

### 5.3.1. Nâng cấp tính năng thương mại hóa & Thanh toán tự động
- **Tích hợp Cổng thanh toán trực tuyến (MoMo, VNPay, VietQR)**: Xây dựng luồng thanh toán đặt cọc 50% hoặc 100% tự động qua mã QR. Khi người chơi quét mã thanh toán thành công, hệ thống qua Webhook sẽ tự động cập nhật trạng thái đơn sang `CONFIRMED` mà không cần chủ sân duyệt thủ công, tối ưu hóa quy trình tự động hóa 24/7.
- **Tích hợp hệ thống Thông báo đa kênh (Omnichannel Notification)**: Kết nối API Zalo Official Account (Zalo OA) và dịch vụ gửi SMS/Email tự động nhằm gửi tin nhắn xác nhận đơn ngay khi đặt cọc, đồng thời phát tin nhắn nhắc lịch chơi trước 60 phút để giảm thiểu tỷ lệ khách hủy lịch sát giờ.

### 5.3.2. Mở rộng nền tảng & Ứng dụng di động (Mobile App Ecosystem)
- **Phát triển ứng dụng di động đa nền tảng bằng Flutter hoặc React Native**: Mặc dù giao diện Bootstrap 5 hiện tại đã tối ưu tốt trên trình duyệt di động (Responsive Web), việc có một ứng dụng Native App riêng trên App Store / Google Play sẽ cho phép khai thác sâu hơn cảm biến định vị GPS, lưu cache bản đồ offline và gửi thông báo Push Notification tức thì đến màn hình khóa của người dùng.
- **Mở rộng mô hình SaaS cho quản lý cụm thể thao tổng hợp**: Từ nền tảng lõi cầu lông, mở rộng cấu trúc CSDL để hỗ trợ cho thuê và quản lý đa dạng các loại hình sân bãi thể thao khác như sân bóng đá mini cỏ nhân tạo, sân tennis, sân pickleball và bể bơi.

### 5.3.3. Tích hợp Trí tuệ nhân tạo và Phân tích dữ liệu lớn (AI/Big Data)
- **Ứng dụng AI Suggestion Engine**: Xây dựng thuật toán gợi ý sân thông minh dựa trên lọc cộng tác (Collaborative Filtering), phân tích lịch sử đặt sân, mức giá yêu thích và khu vực thường xuyên di chuyển của người chơi để đề xuất các sân cầu lông phù hợp nhất.
- **Phân tích dự báo doanh thu cho Chủ sân (Predictive Analytics)**: Tích hợp các biểu đồ phân tích sâu về tỷ lệ lấp đầy sân (Occupancy Rate) theo từng ngày trong tuần và khung giờ, hỗ trợ chủ sân đưa ra chính sách giá linh hoạt (Dynamic Pricing) như giảm giá khung giờ trống buổi sáng và tăng giá nhẹ vào giờ vàng cuối tuần.

---

## TÀI LIỆU THAM KHẢO

### TIẾNG VIỆT
1. **Chính phủ nước Cộng hòa Xã hội Chủ nghĩa Việt Nam** (2023). *Nghị định số 13/2023/NĐ-CP ngày 17/04/2023 của Chính phủ về Bảo vệ dữ liệu cá nhân*. Hà Nội.
2. **Nguyễn Trung Thuận** (2023). *Tài liệu hướng dẫn phát triển ứng dụng Web Agile/Scrum và cấu trúc đồ án tốt nghiệp*. Khoa Công nghệ Thông tin, Trường Đại học Duy Tân, Đà Nẵng.
3. **Phạm Quang Huy, Nguyễn Trường Sinh** (2021). *Lập trình Web với Django Framework*. Nhà xuất bản Thông tin và Truyền thông, Hà Nội.
4. **Trần Văn An** (2020). *Hệ thống thông tin địa lý và ứng dụng WebGIS trong quản lý đô thị*. Nhà xuất bản Khoa học và Kỹ thuật, Hà Nội.

### TIẾNG ANH & TÀI LIỆU MÃ NGUỒN MỞ QUỐC TẾ
5. **Django Software Foundation** (2026). *Django 5.2 Documentation & MVT Architectural Design Principles*. Retrieved from: https://docs.djangoproject.com/
6. **Leaflet & OpenStreetMap Contributors** (2026). *Leaflet API Reference (v1.9.4) & Open Database License (ODbL) Mapping Guidelines*. Retrieved from: https://leafletjs.com/ and https://www.openstreetmap.org/copyright
7. **Adrian Holovaty, Jacob Kaplan-Moss** (2020). *The Definitive Guide to Django: Web Development Done Right*. Apress Publication.
8. **Paul Ramsey, Regina Obe** (2021). *PostGIS and WebGIS Essentials: Geospatial Data Management and Mapping Applications*. Packt Publishing.
9. **PythonAnywhere Hosting Platform** (2026). *WSGI Configuration, Virtualenv Management and SQLite Production Best Practices*. Retrieved from: https://help.pythonanywhere.com/
10. **Open Web Application Security Project (OWASP)** (2025). *OWASP Top 10 Web Application Security Risks: Prevention of Insecure Direct Object References (IDOR) & Concurrency Race Conditions*. Retrieved from: https://owasp.org/www-project-top-ten/

---
*--- HẾT BÁO CÁO ĐỒ ÁN TỐT NGHIỆP ---*
"""

master_report = (
    front_matter + "\n\n" +
    c1 + "\n\n" +
    c2 + "\n\n" +
    c3 + "\n\n" +
    c4 + "\n\n" +
    c5_and_refs
)

with open('baocao_totnghiep_hoanchinh.md', 'w', encoding='utf-8') as f:
    f.write(master_report)

print("Successfully generated baocao_totnghiep_hoanchinh.md!")
print("Total bytes:", len(master_report.encode('utf-8')))
print("Total lines:", len(master_report.splitlines()))
