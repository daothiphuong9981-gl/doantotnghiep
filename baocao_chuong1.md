# CHƯƠNG 1: ĐẶT VẤN ĐỀ VÀ NGHIÊN CỨU KHẢ THI

## 1.1 Đặt vấn đề
Trong những năm gần đây, phong trào tập luyện thể dục thể thao nói chung và bộ môn cầu lông nói riêng tại thành phố Đà Nẵng đang phát triển vô cùng mạnh mẽ. Số lượng người chơi cầu lông tăng nhanh dẫn đến nhu cầu thuê sân bãi tăng cao, đặc biệt là vào các khung giờ vàng từ 17h00 đến 20h00 hàng ngày. Tuy nhiên, việc kết nối giữa người chơi cầu lông và các chủ sân đang gặp nhiều khó khăn và bất cập lớn.

Để có số liệu thực tế chứng minh cho bài toán này, nhóm đề tài đã thực hiện khảo sát hiện trạng thực địa và các kênh thông tin công khai đối với 16 sân cầu lông lớn nhỏ trên địa bàn thành phố Đà Nẵng (chi tiết tại bảng dữ liệu khảo sát). Kết quả thu được cho thấy:
- **100% các sân cầu lông** được khảo sát hiện nay vẫn quản lý và nhận lịch đặt sân một cách thủ công thông qua điện thoại trực tiếp, tin nhắn Zalo hoặc Fanpage Facebook.
- **Chưa có bất kỳ sân nào** triển khai hệ thống đặt lịch tự động theo thời gian thực trên giao diện web giúp người chơi vãng lai chủ động theo dõi lịch trống.
- **Hạn chế lớn nhất**: Việc đặt lịch thủ công qua nhiều kênh liên lạc rời rạc khiến chủ sân dễ bị trùng lịch (double-booking), nhầm lẫn thông tin, hoặc bỏ sót yêu cầu của khách hàng. Trong khi đó, người chơi vãng lai mất nhiều thời gian gọi điện hỏi từng sân để tìm kiếm một khung giờ trống phù hợp.

Từ thực trạng trên, việc xây dựng một hệ thống website tập trung giúp tìm kiếm sân trực quan trên bản đồ WebGIS và thực hiện đặt lịch trực tuyến, tự động chống trùng lịch là vô cùng cần thiết. Đề tài *"Website cho thuê sân cầu lông Đà Nẵng"* được thực hiện nhằm giải quyết triệt để các khoảng trống này.

---

## 1.2 Khảo sát hiện trạng và các giải pháp tương tự
Hiện nay trên thị trường đã có một số ứng dụng và giải pháp hỗ trợ đặt chỗ hoặc quản lý sân thể thao. Nhóm đề tài đã tiến hành phân tích và so sánh 3 giải pháp tiêu biểu là **Sporta**, **Reclub** và **Pengo** dựa trên 6 tiêu chí kỹ thuật và vận hành. Kết quả so sánh được tổng hợp chi tiết tại Bảng 1.1.

**Bảng 1.1: So sánh tính năng của các giải pháp đặt sân hiện nay**

| Tiêu chí so sánh | Sporta | Reclub | Pengo |
|---|---|---|---|
| **1. Tìm kiếm theo bản đồ (WebGIS)** | Hỗ trợ hiển thị danh sách và lọc theo khu vực địa lý cơ bản. | Tập trung tìm trận đấu/hoạt động gần vị trí (GPS) thay vì chuyên sâu tìm sân trống trực quan. | Cho phép tìm kiếm sân theo khu vực quận/huyện, giao diện dạng danh sách là chủ yếu. |
| **2. Chống trùng lịch (Double-booking)** | Rất tốt. Đồng bộ lịch thời gian thực cho chủ sân và người đặt trực tuyến. | Yếu. Chỉ lên lịch sự kiện cho câu lạc bộ, không chuyên cho kinh doanh sân thương mại. | Khá tốt. Hỗ trợ đặt qua hệ thống liên kết nhưng phụ thuộc vào cập nhật của chủ sân. |
| **3. Dashboard cho chủ sân** | Đầy đủ, chuyên nghiệp (Sporta QLSTT) với báo cáo doanh thu, kế toán. | Không có. Chỉ quản lý danh sách thành viên và phân quyền admin câu lạc bộ. | Có trang quản lý cơ bản cho đối tác liên kết nhưng ít báo cáo tài chính chuyên sâu. |
| **4. Phù hợp thị trường Việt Nam** | Rất tốt. Hỗ trợ tiếng Việt và tích hợp các ví điện tử, ngân hàng nội địa. | Trung bình. Giao diện tiếng Anh, cộng đồng mang tính quốc tế là chủ yếu. | Tốt. Ứng dụng thuần Việt, thiết kế thân thiện với người dùng Việt Nam. |
| **5. Chi phí sử dụng** | Thu phí bản quyền phần mềm quản lý (thuê bao tháng) hoặc chiết khấu booking. | Miễn phí cơ bản. Thu phí tính năng nâng cao khi tổ chức giải chuyên nghiệp. | Thu hoa hồng chiết khấu trên mỗi giao dịch đặt sân thành công. |
| **6. Độ phức tạp triển khai** | Khá phức tạp. Chủ sân cần thiết lập tài khoản quản lý và cấu hình khung giờ chi tiết. | Đơn giản. Chỉ cần tạo nhóm, thiết lập lịch sự kiện tuần. | Trung bình. Cần quy trình liên kết hệ thống để hiển thị lịch trống. |

Qua bảng so sánh trên, nhóm đề tài rút ra các **khoảng trống giải pháp** lớn mà các hệ thống hiện tại chưa phục vụ tốt, đặc biệt đối với thị trường Đà Nẵng:
1. **Tính địa phương hóa và bản đồ trực quan**: Các ứng dụng lớn có phạm vi phủ sóng toàn quốc nên thiếu tập trung dữ liệu địa phương. Người dùng Đà Nẵng cần một bản đồ WebGIS trực quan hiển thị cụ thể các cụm sân quanh họ. Hệ thống đề tài sẽ giải quyết bằng cách tích hợp bản đồ Leaflet + OpenStreetMap hoàn toàn miễn phí.
2. **Trải nghiệm đặt lịch nhanh không cần cài ứng dụng**: Đa số người chơi vãng lai ngại cài đặt các ứng dụng di động phức tạp (như Reclub hay Pengo) chỉ để đặt một buổi chơi cầu lông. Web App của đề tài chạy trực tiếp trên các trình duyệt di động giúp việc đặt sân tối giản nhất.
3. **Dashboard tinh gọn cho chủ sân nhỏ lẻ**: Các chủ sân quy mô nhỏ không muốn sử dụng phần mềm quản lý vận hành/kế toán cồng kềnh và đắt đỏ như Sporta QLSTT. Họ cần một trang Dashboard cực kỳ đơn giản để duyệt nhanh lịch đặt, duyệt trạng thái cọc, trong khi hệ thống tự động chống trùng lịch ở tầng CSDL bằng transaction.

---

## 1.3 Mục tiêu và phạm vi đề tài

### 1.3.1 Mục tiêu đề tài
Xây dựng một hệ thống website cho thuê sân cầu lông tại Đà Nẵng cho phép:
- Đối với người chơi: Tìm kiếm sân trực quan trên bản đồ WebGIS, xem khung giờ trống và đặt sân trực tuyến nhanh chóng.
- Đối với chủ sân: Đăng ký thông tin sân bãi, theo dõi và quản lý lịch đặt sân dễ dàng thông qua Dashboard tối giản.
- Hệ thống tự động kiểm tra và ngăn chặn tuyệt đối hiện tượng trùng lịch đặt sân (double-booking).

### 1.3.2 Phạm vi đề tài (IN SCOPE)
Hệ thống tập trung phát triển các phân hệ chức năng cốt lõi sau:
1. **Quản lý tài khoản**: Đăng ký, đăng nhập và phân quyền 3 vai trò rõ rệt: Người chơi (Player), Chủ sân (Court Owner), và Quản trị viên (Admin).
2. **CRUD Sân cầu lông**: Chủ sân tự cập nhật thông tin sân (tên, địa chỉ, quận, tọa độ, giá thuê, hình ảnh đại diện).
3. **Bản đồ WebGIS**: Tích hợp Leaflet + OpenStreetMap hiển thị các marker sân cầu lông Đà Nẵng.
4. **Tìm kiếm & Lọc**: Bộ lọc tìm sân theo Quận, khoảng giá, và khung giờ trống trong ngày.
5. **Tìm sân gần nhất**: Sử dụng Geolocation định vị người dùng và thuật toán Haversine để tìm và highlight sân gần nhất.
6. **Đặt sân trực tuyến**: Đặt sân theo khung giờ trống, lưu thông tin đặt sân ở trạng thái "Chờ duyệt".
7. **Chống trùng lịch**: Sử dụng ràng buộc unique trên CSDL và transaction của Django để đảm bảo một slot (sân, ngày, giờ) chỉ được đặt bởi 1 người.
8. **Dashboard chủ sân**: Xem danh sách booking, nhấn nút duyệt (đã nhận cọc) hoặc hủy booking.
9. **Django Admin**: Trang quản trị mặc định của Django được tùy biến để Admin duyệt chủ sân mới và quản lý người dùng.

### 1.3.3 Giới hạn đề tài (OUT OF SCOPE)
Để đảm bảo tính khả thi hoàn thành đồ án trong 13 tuần, các tính năng sau nằm ngoài phạm vi nghiên cứu:
- Thanh toán trực tuyến thực tế qua cổng ngân hàng hay ví điện tử (chỉ mô phỏng bằng cách chủ sân duyệt trạng thái "Đã cọc" thủ công khi nhận chuyển khoản).
- Ứng dụng di động native (iOS/Android).
- Chức năng chat realtime giữa người chơi và chủ sân.
- Hệ thống đánh giá/review chi tiết (chỉ làm rating sao đơn giản).
- Đa ngôn ngữ.

---

## 1.4 Nghiên cứu khả thi theo khung TELOS
Để đảm bảo dự án có cơ sở thực thi thực tế vững chắc và kiểm soát tốt các rủi ro, nhóm đề tài tiến hành phân tích tính khả thi dựa trên 5 khía cạnh của khung TELOS:

1. **Technical Feasibility (Khả thi kỹ thuật) - ĐẠT**:
   - Stack công nghệ đã chốt gồm Python 3.13, Django 5.2 LTS và thư viện Leaflet.js + OpenStreetMap hoàn toàn đáp ứng tốt toàn bộ yêu cầu chức năng (MVT, Auth, Admin mặc định, WebGIS).
   - Rủi ro lớn nhất là việc xử lý double-booking khi có nhiều người đặt cùng 1 slot đồng thời. Giải pháp: Áp dụng `transaction.atomic` của Django và thiết lập ràng buộc unique `(court, date, time_slot)` ở tầng CSDL để khóa tài nguyên khi ghi.
   - Rủi ro tìm sân gần nhất: Giải quyết bằng công thức Haversine chạy trên ứng dụng Python (hoàn toàn mượt mà với quy mô dữ liệu < 500 sân).

2. **Economic Feasibility (Khả thi kinh tế) - ĐẠT**:
   - Chi phí bản quyền phần mềm và công nghệ phát triển bằng 0 VNĐ do sử dụng các thư viện mã nguồn mở.
   - Chi phí máy chủ và CSDL vận hành thử nghiệm bằng 0 VNĐ nhờ sử dụng gói Free hosting của PythonAnywhere và CSDL MySQL đi kèm.
   - Dự án mang lại giá trị thực tế cao cho chủ sân và người chơi so với mức đầu tư 0 đồng.

3. **Legal Feasibility (Khả thi pháp lý) - ĐẠT**:
   - Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân: Chỉ thu thập SĐT, Email và họ tên tối thiểu để liên hệ, có điều khoản bảo mật khi đăng ký và cung cấp tính năng xóa tài khoản vĩnh viễn khỏi CSDL khi người dùng yêu cầu.
   - Bản đồ sử dụng OpenStreetMap tuân thủ giấy phép ODbL, hiển thị đầy đủ attribution ghi công nguồn dữ liệu trên giao diện.
   - Không thực hiện scrape dữ liệu hàng loạt bất hợp pháp từ Google Maps.

4. **Operational Feasibility (Khả thi vận hành) - ĐẠT**:
   - Hệ thống được thiết kế theo hướng Web App chạy trực tiếp trên trình duyệt, tối ưu hóa giao diện mobile-first (Bootstrap 5) giúp người chơi vãng lai dễ tiếp cận. Giao diện Dashboard chủ sân tối giản giúp chủ sân lớn tuổi vẫn có thể dễ dàng duyệt/hủy đặt sân. Django Admin hỗ trợ tối đa việc quản lý của sinh viên vận hành.

5. **Schedule Feasibility (Khả thi lịch trình) - ĐẠT**:
   - Lộ trình 13 tuần được phân chia cụ thể trong ROADMAP.md. Giai đoạn có rủi ro trễ tiến độ cao nhất là Giai đoạn 3 (Xây dựng lõi, đặc biệt là tích hợp Leaflet và logic đặt sân).
   - Biện pháp giảm thiểu: Đã xây dựng PoC bản đồ Leaflet chạy độc lập thành công ngay ở Giai đoạn 1 (Task 1.4) để giải quyết trước rủi ro tích hợp WebGIS. Tuân thủ nghiêm ngặt nguyên tắc chỉ làm 1 task mỗi phiên để tránh phình tiến độ.

---

## 1.5 Cấu trúc báo cáo tốt nghiệp
Báo cáo tốt nghiệp của đề tài được cấu trúc gồm 6 chương chính:
- **Chương 1: Đặt vấn đề và nghiên cứu khả thi**: Nêu lý do chọn đề tài, khảo sát hiện trạng các sân cầu lông tại Đà Nẵng, phân tích các giải pháp tương tự, xác định mục tiêu, phạm vi và nghiên cứu khả thi TELOS.
- **Chương 2: Cơ sở lý thuyết và công nghệ sử dụng**: Giới thiệu về kiến trúc Django MVT, cơ chế hoạt động của WebGIS, thư viện Leaflet.js và bản đồ OpenStreetMap.
- **Chương 3: Phân tích và thiết kế hệ thống**: Trình bày biểu đồ use-case và đặc tả các use-case cốt lõi, thiết kế CSDL (sơ đồ ERD), thiết kế kiến trúc các app Django, wireframe giao diện và biểu đồ sequence diagram chi tiết cho luồng đặt sân.
- **Chương 4: Xây dựng hệ thống và kiểm thử**: Chi tiết quá trình cài đặt mã nguồn Django (models, views, templates), tích hợp bản đồ WebGIS Leaflet, lập trình logic đặt sân chống trùng lịch và bảng kết quả thực thi các test case.
- **Chương 5: Triển khai và đánh giá**: Quá trình deploy website lên hosting PythonAnywhere (MySQL, cấu hình static/media, tắt DEBUG) và ghi nhận phản hồi của người dùng thử nghiệm (UAT).
- **Chương 6: Kết luận và hướng phát triển**: Tổng kết các kết quả đạt được của đề tài, các hạn chế còn tồn tại và đề xuất hướng phát triển tiếp theo.
