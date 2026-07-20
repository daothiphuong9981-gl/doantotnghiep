# CHƯƠNG 2: CƠ SỞ LÝ THUYẾT VÀ CÔNG NGHỆ SỬ DỤNG

## 2.1 Kiến trúc Django MVT (Model - View - Template)
Hệ thống sử dụng framework Django (phiên bản 5.2 LTS) làm nền tảng phát triển lõi. Django được thiết kế theo kiến trúc MVT (Model - View - Template) – một biến thể của kiến trúc MVC truyền thống nhưng tối ưu hóa cực kỳ tốt cho việc phát triển web nhanh, bảo mật và khả năng bảo trì.

Sự phân bổ vai trò trong kiến trúc MVT của Django được định nghĩa cụ thể:
- **Model (M - Mô hình dữ liệu)**: Định nghĩa cấu trúc dữ liệu và logic nghiệp vụ cốt lõi. Django ORM (Object-Relational Mapping) tự động ánh xạ các class Python thành các bảng CSDL tương ứng (chạy trên SQLite/MySQL), loại bỏ việc viết các câu lệnh SQL thuần.
- **View (V - Bộ xử lý logic)**: Đóng vai trò kiểm soát luồng điều khiển (Controller trong MVC). Nó nhận HTTP Request từ Router (`urls.py`), thực hiện các thao tác logic nghiệp vụ, gọi Model để lấy dữ liệu, và quyết định template nào sẽ được trả về cho người dùng.
- **Template (T - Giao diện hiển thị)**: Là phần giao diện HTML kết hợp ngôn ngữ Django Template Language (DTL). Nó nhận dữ liệu (context) từ View truyền sang và render động ra chuỗi HTML hoàn chỉnh gửi về trình duyệt của khách hàng.

Ưu điểm chính khi sử dụng Django MVT cho đề tài:
- Tích hợp sẵn cơ chế xác thực và phân quyền tài khoản (Django Auth) rất mạnh mẽ.
- Trang quản trị mặc định (Django Admin) được sinh ra tự động giúp tiết kiệm tối đa thời gian phát triển backend quản lý.
- Có các Middleware bảo mật tích hợp sẵn giúp chống lại các cuộc tấn công phổ biến như SQL Injection, Cross-Site Scripting (XSS) và Cross-Site Request Forgery (CSRF).

---

## 2.2 Công nghệ bản đồ WebGIS và thư viện Leaflet.js
WebGIS là sự kết hợp giữa Hệ thống thông tin địa lý (GIS) và mạng Internet. Trong đề tài này, WebGIS đóng vai trò làm giao diện tương tác trực quan chủ đạo cho người chơi tìm kiếm sân cầu lông.

Thư viện **Leaflet.js** (phiên bản 1.9.4) được lựa chọn để xây dựng bản đồ trên trình duyệt web nhờ các đặc tính:
- **Trọng lượng siêu nhẹ**: Với kích thước tệp JS chỉ khoảng 42 KB, Leaflet tải cực nhanh, không gây hiện tượng giật lag trên các thiết bị di động có cấu hình yếu (Đạt chỉ tiêu NFR-01 về hiệu năng và NFR-03 về khả dụng).
- **Hỗ trợ Mobile-First**: Giao diện bản đồ tương thích tự nhiên với các thao tác vuốt, chạm, zoom đa điểm trên màn hình điện thoại cảm ứng.
- **Khả năng mở rộng**: Hỗ trợ tốt các layer bản đồ tự do, marker tùy biến, popup động và dễ dàng tích hợp với API định vị GPS của trình duyệt (HTML5 Geolocation).

---

## 2.3 Bản đồ OpenStreetMap và giấy phép ODbL
Để xây dựng bản đồ WebGIS hoàn toàn tự do và không phát sinh chi phí duy trì, đề tài sử dụng dữ liệu bản đồ từ **OpenStreetMap (OSM)** làm bản đồ nền (base map).

Về mặt pháp lý:
- OpenStreetMap hoạt động theo giấy phép **ODbL (Open Database License)**. Giấy phép này cho phép sao chép, phân phối, truyền tải và điều chỉnh dữ liệu bản đồ hoàn toàn miễn phí, với điều kiện duy nhất là phải ghi công (attribution) OpenStreetMap và các cộng tác viên của họ.
- Trên giao diện bản đồ nền Leaflet, hệ thống thiết lập attribution hiển thị góc dưới cùng bên phải: `&copy; OpenStreetMap contributors`. Việc này đảm bảo đề tài tuân thủ đầy đủ tính pháp lý quốc tế (Đạt chỉ tiêu NFR-04).
- OpenStreetMap được sử dụng thay thế cho Google Maps để tránh các vấn đề liên quan đến giới hạn lượt gọi API miễn phí và chi phí thẻ tín dụng đắt đỏ.

---

## 2.4 Thuật toán Haversine tính toán khoảng cách địa lý
Để giải quyết yêu cầu chức năng tìm sân cầu lông gần nhất (FR-06), hệ thống áp dụng công thức toán học **Haversine** trực tiếp trên mã nguồn backend Python hoặc mã frontend Javascript.

Do Trái Đất là một hình cầu (không phải mặt phẳng phẳng), khoảng cách giữa hai tọa độ địa lý $(Lat_1, Lng_1)$ và $(Lat_2, Lng_2)$ không thể tính bằng công thức Pythagoras thông thường mà phải tính theo đường tròn lớn (Great-Circle Distance).

Công thức Haversine được định nghĩa như sau:

$$d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$

Trong đó:
- $\phi_1, \phi_2$ là vĩ độ của điểm 1 và điểm 2 (đổi sang đơn vị Radian).
- $\Delta \phi = \phi_2 - \phi_1$ (Radian).
- $\Delta \lambda = Lng_2 - Lng_1$ (Radian).
- $R$ là bán kính trung bình của Trái Đất ($R \approx 6.371$ km).
- $d$ là khoảng cách tính bằng kilômét giữa hai vị trí.

Thuật toán này chạy cực kỳ nhanh và chính xác cao đối với phạm vi nhỏ cấp thành phố như Đà Nẵng, giúp tìm ra sân cầu lông gần vị trí định vị của người chơi nhất để tự động highlight trên bản đồ WebGIS.

---

## 2.5 Giao dịch cơ sở dữ liệu (Database Transaction)
Khi xây dựng hệ thống đặt lịch tự động theo thời gian thực, thách thức lớn nhất là vấn đề tranh chấp tài nguyên (Concurrency Double-booking) – kịch bản khi hai khách hàng cùng bấm nút đặt một slot giờ duy nhất của cùng một sân tại cùng một mili-giây.

Để giải quyết triệt để bài toán này, hệ thống áp dụng cơ chế **Database Transaction** và bảo đảm tính chất **ACID**:
- **Atomicity (Tính nguyên tử)**: Đảm bảo giao dịch đặt sân được thực hiện trọn vẹn "tất cả hoặc không". Nếu bước kiểm tra trùng lịch đạt yêu cầu nhưng bước ghi vào DB bị lỗi IntegrityError, toàn bộ các thao tác trước đó sẽ được rollback trở về trạng thái cũ.
- **Consistency (Tính nhất quán)**: Hệ thống luôn chuyển từ trạng thái hợp lệ này sang trạng thái hợp lệ khác. Ràng buộc UniqueConstraint ở tầng DB đảm bảo không bao giờ tồn tại trạng thái hai booking chứa trùng sân, ngày và giờ.
- **Isolation (Tính cô lập)**: Sử dụng lệnh khóa độc quyền `select_for_update()` của Django. Khi Giao dịch A đang đọc và kiểm tra slot giờ, CSDL khóa dòng dữ liệu đó lại. Giao dịch B cố tình đọc cùng dòng dữ liệu sẽ bị buộc phải xếp hàng chờ cho đến khi Giao dịch A COMMIT hoặc ROLLBACK xong.
- **Durability (Tính bền vững)**: Khi giao dịch thành công và COMMIT, thông tin đặt lịch sẽ được ghi vĩnh viễn vào ổ đĩa CSDL, không bị mất ngay cả khi hệ thống gặp sự cố mất điện đột ngột.
