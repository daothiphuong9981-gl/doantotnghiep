-- =====================================================================
-- Nhập 51 sân khảo sát thực địa (PB-28) từ KhaoSatSan_Nhanh_v1.0.xlsx
-- Sinh tự động; muốn sửa dữ liệu thì sửa file Excel rồi sinh lại.
--
-- Cách chạy: Supabase > SQL Editor > dán toàn bộ file > Run. Chạy sau migration 0001, 0002, 0004, 0005 và seed.sql.
-- Chạy lại nhiều lần không sinh trùng: sân đã có (cùng tên và địa chỉ) thì bỏ qua.
--
-- Mỗi sân: trạng thái "approved" (đã duyệt), các sân con "Sân 1..n" theo số sân khảo sát, 3 khung giá:
--   ngày thường 05:00–17:00 (giá ngày thường), ngày thường 17:00–22:00 (giá buổi tối),
--   cuối tuần 05:00–22:00 (giá cuối tuần).
-- Giờ mở/đóng cửa và quy định đặt sân là giá trị MẶC ĐỊNH (sheet Mặc định), chưa khảo sát từng sân:
--   giữ chỗ 15 phút, đặt trước 7 ngày, tối đa 20 khung giờ/lượt, 2 lượt giữ cùng lúc.
-- Ảnh sân chưa nhập: chủ sân hoặc nhóm tải ảnh tự chụp lên sau trong trang quản lý sân.
--
-- CHỦ SÂN: mặc định các sân KHÔNG có chủ (owner_id rỗng). Sân vẫn hiện trên bản đồ, nhưng người chơi
-- giữ chỗ thì không ai xác nhận được thanh toán, và tài khoản ngân hàng hiện "Chưa cập nhật".
-- Muốn chạy thử trọn luồng đặt sân: điền email một tài khoản vai trò Chủ sân vào dòng v_owner_email bên dưới;
-- tất cả sân sẽ thuộc tài khoản đó (chỉ nên dùng khi demo).
-- =====================================================================

drop table if exists _import_venues;
create temp table _import_venues (
  code text, name text, address text, ward_name text, latitude numeric(9, 6), longitude numeric(9, 6),
  court_count int, price_day int, price_evening int, price_weekend int, contact_phone text, description text
);

insert into _import_venues values
  ('KS-001', 'Sân cầu lông Bưu Điện', '50B Nguyễn Du', 'Phường Hải Châu', 16.078636, 108.220031, 6, 60000, 80000, 80000, '0905 185 548', 'Sân cầu lông có 6 sân con, tại 50B Nguyễn Du, Phường Hải Châu. Sân thảm PVC 6 sân tiêu chuẩn, đèn LED sáng rõ, bãi đỗ xe rộng rãi. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-002', 'Sân cầu lông số 4 Lê Duẩn', '04 Lê Duẩn', 'Phường Hải Châu', 16.071499, 108.221948, 4, 70000, 90000, 90000, '0905 401 655', 'Sân cầu lông có 4 sân con, tại 04 Lê Duẩn, Phường Hải Châu. Cụm 4 sân thảm chuyên dụng trong nhà, có cho thuê vợt và bán phụ kiện. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-003', 'Sân cầu lông Đa Phước', 'Đường Ông Ích Khiêm, Khu đô thị Đa Phước', 'Phường Hải Châu', 16.082520, 108.212040, 4, 70000, 90000, 90000, '0915 571 077', 'Sân cầu lông có 4 sân con, tại Đường Ông Ích Khiêm, Khu đô thị Đa Phước, Phường Hải Châu. Cụm 4 sân thảm chống trượt, đèn LED chống chói, bãi xe ô tô rộng. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-004', 'Trung tâm TDTT quận Hải Châu (Sân cầu lông Hải Châu)', '49 Tân An 3', 'Phường Hòa Cường', 16.037110, 108.211195, 7, 80000, 110000, 110000, '0905 806 626', 'Sân cầu lông có 7 sân con, tại 49 Tân An 3, Phường Hòa Cường. Nhà thi đấu 7 sân thảm PVC tiêu chuẩn, khán đài, quạt mát, bãi xe lớn. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-005', 'CLB Thể Thao Phan Chu Trinh', '407 Phan Châu Trinh', 'Phường Hòa Cường', 16.062874, 108.213043, 3, 60000, 80000, 80000, '0236 3826 122', 'Sân cầu lông có 3 sân con, tại 407 Phan Châu Trinh, Phường Hòa Cường. Cụm 3 sân thảm trong nhà thoáng mát, vị trí trung tâm thuận tiện. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-006', 'Sân cầu lông BetaEra', '273-275 Nguyễn Tri Phương', 'Phường Hòa Cường', 16.048210, 108.204560, 12, 80000, 120000, 120000, '093 566 59 76', 'Sân cầu lông có 12 sân con, tại 273-275 Nguyễn Tri Phương, Phường Hòa Cường. Tổ hợp thể thao 12 sân thảm cao cấp, trần cao thoáng mát, phòng thay đồ hiện đại. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-007', 'Sân cầu lông Cung Văn hóa Thiếu nhi Đà Nẵng', '2A Phan Đăng Lưu', 'Phường Hòa Cường', 16.036924, 108.217727, 6, 70000, 90000, 90000, '0905 230 131', 'Sân cầu lông có 6 sân con, tại 2A Phan Đăng Lưu, Phường Hòa Cường. Nhà thi đấu 6 sân thảm xanh tiêu chuẩn, khuôn viên Cung Thiếu nhi rộng rãi, bãi đỗ xe lớn. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-008', 'Sân cầu lông Quân khu 5', '07 Duy Tân', 'Phường Hòa Cường', 16.054320, 108.209840, 6, 60000, 80000, 80000, '0905 258 387', 'Sân cầu lông có 6 sân con, tại 07 Duy Tân, Phường Hòa Cường. Nhà tập luyện 6 sân thảm PVC trong khu liên hợp thể thao Quân khu 5, bãi xe an ninh cao. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-009', 'Sân cầu lông Nguyễn Tri Phương (458 Nguyễn Tri Phương)', '458 Nguyễn Tri Phương', 'Phường Hòa Cường', 16.041250, 108.205420, 4, 60000, 90000, 90000, '0905 335 533', 'Sân cầu lông có 4 sân con, tại 458 Nguyễn Tri Phương, Phường Hòa Cường. Cụm 4 sân thảm đạt chuẩn BWF, đèn LED hiện đại, có quầy nước giải khát. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-010', 'Sân cầu lông Kỳ Đồng', '121 Kỳ Đồng', 'Phường Thanh Khê', 16.070019, 108.188220, 4, 60000, 75000, 75000, '0914 288 338', 'Sân cầu lông có 4 sân con, tại 121 Kỳ Đồng, Phường Thanh Khê. Sân sàn gỗ chuyên dụng 4 sân, wifi tốc độ cao, chỗ giữ xe máy rộng rãi. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-011', 'Sân cầu lông Trọng Nghĩa', '194 Bế Văn Đàn', 'Phường Thanh Khê', 16.064924, 108.195834, 4, 60000, 80000, 80000, '070 236 5369', 'Sân cầu lông có 4 sân con, tại 194 Bế Văn Đàn, Phường Thanh Khê. Cụm 4 sân thảm mới, có dịch vụ căng vợt và huấn luyện viên. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-012', 'Sân Kha Badminton', '34 Đỗ Ngọc Du', 'Phường Thanh Khê', 16.068940, 108.192310, 4, 60000, 80000, 80000, '0766 666 995', 'Sân cầu lông có 4 sân con, tại 34 Đỗ Ngọc Du, Phường Thanh Khê. Nhà thi đấu 4 sân thảm chuyên nghiệp, đào tạo cầu lông bài bản, căng vợt điện tử. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-013', 'Sân cầu lông Trường Đại học Thể dục Thể thao', '44 Dũng Sĩ Thanh Khê', 'Phường Thanh Khê', 16.066420, 108.181250, 5, 60000, 80000, 80000, '0236 3707 188', 'Sân cầu lông có 5 sân con, tại 44 Dũng Sĩ Thanh Khê, Phường Thanh Khê. Nhà thi đấu tầng 2 gồm 5 sân thảm thi đấu chuẩn quốc gia, trần cao, ánh sáng tiêu chuẩn. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-014', 'Tin Sport Badminton', '107 Trường Chinh', 'Phường Thanh Khê', 16.061820, 108.182350, 6, 60000, 80000, 80000, '0935 333 748', 'Sân cầu lông có 6 sân con, tại 107 Trường Chinh, Phường Thanh Khê. Cụm 6 sân thảm mới 100%, phòng tắm nóng lạnh, wifi, quầy giải khát đầy đủ. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-015', 'CLB Thể thao Thanh Khê', '257 Dũng Sĩ Thanh Khê', 'Phường Thanh Khê', 16.064510, 108.176420, 4, 55000, 75000, 75000, '0903 414 112', 'Sân cầu lông có 4 sân con, tại 257 Dũng Sĩ Thanh Khê, Phường Thanh Khê. Nhà tập luyện 4 sân thảm sau trường THPT Thanh Khê, thoáng mát, chỗ đỗ xe thuận tiện. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-016', 'Sân K47', '86 Đặng Huy Trứ', 'Phường Thanh Khê', 16.062140, 108.177580, 4, 50000, 70000, 70000, '0905 123 447', 'Sân cầu lông có 4 sân con, tại 86 Đặng Huy Trứ, Phường Thanh Khê. Cụm 4 sân thảm trong nhà, đối diện chùa Chiêu Ứng, quạt làm mát, bãi xe máy an toàn. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-017', 'Sân cầu lông Cao Đẳng Thương Mại', '45 Dũng Sĩ Thanh Khê', 'Phường Thanh Khê', 16.065890, 108.180450, 4, 60000, 80000, 80000, '0989 436 638', 'Sân cầu lông có 4 sân con, tại 45 Dũng Sĩ Thanh Khê, Phường Thanh Khê. Nhà thi đấu 4 sân thảm trong khuôn viên trường Cao đẳng Thương mại, căn tin, wifi, bãi xe lớn. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-018', 'Sân cầu lông Trì Sport', '21 Hồ Tương', 'Phường An Khê', 16.060120, 108.189540, 5, 60000, 80000, 80000, '0762 636 662', 'Sân cầu lông có 5 sân con, tại 21 Hồ Tương, Phường An Khê. Hệ thống 5 sân thảm đạt chuẩn thi đấu, ánh sáng tốt, có lớp đào tạo cầu lông chuyên nghiệp. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-019', 'Arena 2 (Arena 02)', '25 Hồ Hán Thương', 'Phường An Hải', 16.089450, 108.232140, 5, 70000, 90000, 90000, '0788 81 85 85', 'Sân cầu lông có 5 sân con, tại 25 Hồ Hán Thương, Phường An Hải. Cơ sở mới hệ thống Arena, 5 sân thảm chất lượng cao, quầy nước, bãi đỗ xe ô tô. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-020', 'Sân cầu lông Trường Cao đẳng Lương thực Thực phẩm', '101B Lê Hữu Trác', 'Phường An Hải', 16.058740, 108.241250, 6, 60000, 75000, 75000, '0905 225 295', 'Sân cầu lông có 6 sân con, tại 101B Lê Hữu Trác, Phường An Hải. Khu thể thao 6 sân thảm chuyên dụng trong nhà trường, trần cao, bãi đỗ xe máy rộng. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-021', 'Sân cầu lông TT Văn hóa Thể thao quận Sơn Trà', '35 Trần Quang Diệu', 'Phường An Hải', 16.059810, 108.234120, 6, 60000, 80000, 80000, '0905 125 478', 'Sân cầu lông có 6 sân con, tại 35 Trần Quang Diệu, Phường An Hải. Nhà thi đấu 6 sân thảm, đèn LED chiếu sáng tốt, khu vực căn tin phục vụ giải khát. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-022', 'Wings Badminton', '132 Tô Hiến Thành', 'Phường An Hải', 16.058230, 108.243560, 5, 70000, 90000, 90000, '0935 489 132', 'Sân cầu lông có 5 sân con, tại 132 Tô Hiến Thành, Phường An Hải. Cụm 5 sân thảm mới độ bám cao, đèn LED chống chói chuyên nghiệp, quầy nước, bãi đỗ xe an toàn. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-023', 'Sân Cầu Lông An Đồn 5.5', 'Đường số 5 KCN An Đồn', 'Phường An Hải', 16.077540, 108.238410, 4, 60000, 80000, 80000, '0708 721 111', 'Sân cầu lông có 4 sân con, tại Đường số 5 KCN An Đồn, Phường An Hải. Tổ hợp 4 sân cầu lông trong nhà KCN An Đồn, quạt công nghiệp, bãi đỗ xe ô tô cực rộng. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-024', 'Sân cầu lông Aurora Sport', 'Đường số 6 Khu công nghiệp An Đồn', 'Phường An Hải', 16.076829, 108.237577, 8, 70000, 90000, 90000, '0905 690 989', 'Sân cầu lông có 8 sân con, tại Đường số 6 Khu công nghiệp An Đồn, Phường An Hải. Hệ thống 8 sân thảm cao cấp tại KCN An Đồn, không gian rộng, trần cao, bãi đỗ xe ô tô thuận tiện. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-025', 'Trung tâm thể dục thể thao Sơn Trà', '34 Hồ Nghinh', 'Phường An Hải', 16.072150, 108.241580, 6, 60000, 75000, 75000, '0935 478 567', 'Sân cầu lông có 6 sân con, tại 34 Hồ Nghinh, Phường An Hải. Cụm 6 sân thảm chuyên dụng thoáng mát, trần cao, hệ thống chiếu sáng tốt, bãi đỗ xe an toàn. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-026', 'Sân Cầu Lông Nguyễn Chí Thanh Sơn Trà', '36 Trần Duy Chiến', 'Phường Sơn Trà', 16.091240, 108.242150, 3, 55000, 75000, 75000, '0917 745 314', 'Sân cầu lông có 3 sân con, tại 36 Trần Duy Chiến, Phường Sơn Trà. Cụm 3 sân thảm tiêu chuẩn trong nhà tại Mân Thái, hệ thống chiếu sáng rõ, có chỗ để xe máy. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-027', 'Sân cầu lông Index Sport 2', '81C Lê Văn Hiến', 'Phường Ngũ Hành Sơn', 16.031540, 108.243120, 6, 60000, 80000, 80000, '0981 086 979', 'Sân cầu lông có 6 sân con, tại 81C Lê Văn Hiến, Phường Ngũ Hành Sơn. Hệ thống 6 sân thảm tiêu chuẩn khu vực quân đội, thoáng mát, căng vợt và quầy nước đầy đủ. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-028', 'Trung Tâm Văn Hóa, Thông Tin Và Thể Thao Quận Ngũ Hành Sơn', '01B Trần Văn Đán', 'Phường Ngũ Hành Sơn', 16.027840, 108.242560, 4, 60000, 80000, 80000, '0905 663 007', 'Sân cầu lông có 4 sân con, tại 01B Trần Văn Đán, Phường Ngũ Hành Sơn. Nhà thi đấu 4 sân thảm chuyên dụng, không gian thoáng đãng, bãi xe máy và ô tô thuận tiện. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-029', 'Ngũ Hành Badminton', 'Đường Phạm Hữu Nhật giao Bùi Thế Mỹ', 'Phường Ngũ Hành Sơn', 16.013830, 108.251295, 4, 60000, 80000, 80000, '0937 132 656', 'Sân cầu lông có 4 sân con, tại Đường Phạm Hữu Nhật giao Bùi Thế Mỹ, Phường Ngũ Hành Sơn. Cụm 4 sân thảm mới gần Làng Đại học, đèn LED chống chói, dịch vụ giao lưu phong trào sôi nổi. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-030', 'Sân cầu lông Mỹ An', '382 Ngũ Hành Sơn', 'Phường Ngũ Hành Sơn', 16.045620, 108.240180, 3, 70000, 85000, 85000, '0947 553 069', 'Sân cầu lông có 3 sân con, tại 382 Ngũ Hành Sơn, Phường Ngũ Hành Sơn. Cụm 3 sân thảm trong nhà đạt chuẩn, thông gió mát mẻ, có quầy nước giải khát. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-031', 'Sân cầu lông Thiên Vũ', 'Nhà văn hóa Mân Quang, Hòa Quý', 'Phường Ngũ Hành Sơn', 16.008450, 108.239850, 2, 50000, 70000, 70000, '0905 589 123', 'Sân cầu lông có 2 sân con, tại Nhà văn hóa Mân Quang, Hòa Quý, Phường Ngũ Hành Sơn. Nhà văn hóa Mân Quang gồm 2 sân thảm trong nhà, không gian yên tĩnh, bãi giữ xe thuận tiện. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-032', 'Nhà Thi Đấu Hòa Xuân', '01A Dương Loan', 'Phường Hòa Xuân', 16.018940, 108.213560, 3, 70000, 95000, 95000, '0236 3624 452', 'Sân cầu lông có 3 sân con, tại 01A Dương Loan, Phường Hòa Xuân. Trung tâm Huấn luyện ĐTVĐV thể thao 3 sân thảm tiêu chuẩn, trần cao, bãi đỗ xe lớn. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-033', 'Sân cầu lông Dương Gia HX', '207 Quách Thị Trang', 'Phường Hòa Xuân', 16.012450, 108.215840, 6, 75000, 95000, 95000, '0396 665 599', 'Sân cầu lông có 6 sân con, tại 207 Quách Thị Trang, Phường Hòa Xuân. Cụm 6 sân thảm đạt chuẩn BWF, đèn LED chiếu sáng hiện đại, quạt phun sương mát mẻ. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-034', 'Sân cầu lông Hiếu Con', '172-182 Đỗ Quỳ', 'Phường Hòa Xuân', 16.015295, 108.219493, 5, 60000, 80000, 80000, '0905 403 222', 'Sân cầu lông có 5 sân con, tại 172-182 Đỗ Quỳ, Phường Hòa Xuân. Tổ hợp 5 sân thảm mới, có máy bắn cầu tự động, quán cà phê và cửa hàng dụng cụ. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-035', 'Sân cầu lông KingSport', '85 Tôn Thất Dương Kỵ', 'Phường Hòa Xuân', 16.014120, 108.217820, 3, 60000, 80000, 80000, '0702 872 227', 'Sân cầu lông có 3 sân con, tại 85 Tôn Thất Dương Kỵ, Phường Hòa Xuân. Cụm 3 sân bán hầm mát mẻ, tông xám hiện đại, có khu ngồi cà phê nghỉ ngơi. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-036', 'Sân cầu lông Phúc Đăng', '39 Thanh Lương 19', 'Phường Hòa Xuân', 16.013004, 108.221680, 4, 55000, 75000, 75000, '0905 277 225', 'Sân cầu lông có 4 sân con, tại 39 Thanh Lương 19, Phường Hòa Xuân. Hệ thống 4 sân thảm trần cao, thông thoáng, dịch vụ nước uống và bãi xe thuận tiện. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-037', 'Sân cầu lông Index Sport', '448 Mẹ Thứ', 'Phường Hòa Xuân', 16.002340, 108.214580, 4, 60000, 80000, 80000, '0981 086 979', 'Sân cầu lông có 4 sân con, tại 448 Mẹ Thứ, Phường Hòa Xuân. Hệ thống 4 sân thảm đạt chuẩn Index Sport cơ sở 1, căng vợt, hỗ trợ đặt sân app. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-038', 'T&T Badminton Đà Nẵng', '534 Phạm Hùng', 'Phường Hòa Xuân', 15.985786, 108.207771, 4, 50000, 70000, 70000, '0384 941 109', 'Sân cầu lông có 4 sân con, tại 534 Phạm Hùng, Phường Hòa Xuân. Cụm 4 sân thảm mới, đặt sân trực tuyến tiện lợi, không gian tập luyện năng động. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-039', 'Sân Arena (Arena Hoàng Văn Thái)', '40 Hoàng Văn Thái', 'Phường Hòa Khánh', 16.058450, 108.161240, 6, 70000, 90000, 90000, '0788 81 85 85', 'Sân cầu lông có 6 sân con, tại 40 Hoàng Văn Thái, Phường Hòa Khánh. Cụm 6 sân thảm Arena 01 tiêu chuẩn, hệ thống đèn chiếu sáng cao cấp, bãi xe ô tô rộng. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-040', 'Sân cầu lông Win Win (Win Win Badminton – Cơ sở 1)', '642 Tôn Đức Thắng', 'Phường Hòa Khánh', 16.064842, 108.156431, 6, 60000, 80000, 80000, '0927 990 909', 'Sân cầu lông có 6 sân con, tại 642 Tôn Đức Thắng, Phường Hòa Khánh. Hệ thống 6 sân thảm chuyên nghiệp Win Win CS1, lớp đào tạo, cho thuê vợt và phụ kiện. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-041', 'ACE Badminton', '2A Hòa Nam 6', 'Phường Hòa Khánh', 16.050056, 108.170895, 6, 60000, 80000, 80000, '0943 209 797', 'Sân cầu lông có 6 sân con, tại 2A Hòa Nam 6, Phường Hòa Khánh. Cụm 6 sân thảm mới chất lượng cao, trần cao, bãi đỗ xe rộng rãi, phục vụ đồ uống. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-042', 'Câu lạc bộ cầu lông Hunter', '459 Tôn Đức Thắng', 'Phường Hòa Khánh', 16.061658, 108.159128, 4, 50000, 70000, 70000, '0905 125 459', 'Sân cầu lông có 4 sân con, tại 459 Tôn Đức Thắng, Phường Hòa Khánh. Nhà thi đấu 4 sân thảm cao su tiêu chuẩn ĐH Sư Phạm (CLB Hunter), thoáng mát, bãi xe lớn. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-043', 'Sân Cầu Lông Làng Hoà Mỹ', 'K120 Nguyễn Huy Tưởng', 'Phường Hòa Khánh', 16.050902, 108.168764, 5, 100000, 150000, 150000, '0789 666 666', 'Sân cầu lông có 5 sân con, tại K120 Nguyễn Huy Tưởng, Phường Hòa Khánh. Cụm 5 sân thảm chất lượng cao Làng Hòa Mỹ (Shop Của Trí), dịch vụ đặt sân trực tuyến và bán đồ thể thao. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-044', 'Sân cầu lông Min Tom', '108 Hoàng Minh Thảo', 'Phường Hòa Khánh', 16.054120, 108.158420, 4, 60000, 75000, 75000, '0935 246 108', 'Sân cầu lông có 4 sân con, tại 108 Hoàng Minh Thảo, Phường Hòa Khánh. Cụm 4 sân thảm trong nhà tại Hoàng Minh Thảo, phục vụ sinh viên và cư dân Liên Chiểu. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-045', 'Sân cầu lông trường THCS Lương Thế Vinh', 'Đường Bùi Tấn Diên', 'Phường Hòa Khánh', 16.055840, 108.163580, 3, 60000, 80000, 80000, '0383 938 504', 'Sân cầu lông có 3 sân con, tại Đường Bùi Tấn Diên, Phường Hòa Khánh. Nhà thi đấu đa năng trường THCS Lương Thế Vinh gồm 3 sân thảm chuyên dụng, trần cao, bãi đỗ xe lớn. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-046', 'Sân cầu lông & pickleball TVC', 'Thôn Lệ Sơn, Hòa Tiến', 'Xã Hòa Tiến', 15.968450, 108.192140, 3, 50000, 70000, 70000, '0934 227 059', 'Sân cầu lông có 3 sân con, tại Thôn Lệ Sơn, Hòa Tiến, Xã Hòa Tiến. Tổ hợp thể thao 3 sân cầu lông thảm chống trượt và 2 sân pickleball, đèn LED chống chói. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-047', 'Win Win Liên Chiểu (cơ sở 2)', '208 Nguyễn Lương Bằng', 'Phường Hòa Khánh', 16.078450, 108.148720, 5, 60000, 80000, 80000, '0927 990 909', 'Sân cầu lông có 5 sân con, tại 208 Nguyễn Lương Bằng, Phường Hòa Khánh. Hệ thống Win Win CS2 gồm 5 sân thảm tiêu chuẩn, đèn LED sáng rõ, quầy nước và bãi giữ xe rộng. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-048', 'CLB Bóng bàn & Cầu lông Phường An Khê', '178 Nguyễn Đình Tựu', 'Phường An Khê', 16.062450, 108.185620, 3, 50000, 70000, 70000, '0931 336 897', 'Sân cầu lông có 3 sân con, tại 178 Nguyễn Đình Tựu, Phường An Khê. Nhà thi đấu phong trào 3 sân cầu lông và bàn bóng bàn, thoáng đãng, bãi xe máy tiện lợi. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-049', 'Icon Badminton (Sân Icon)', '122 Tôn Đản', 'Phường An Khê', 16.049820, 108.181450, 8, 60000, 80000, 80000, '0905 591 379', 'Sân cầu lông có 8 sân con, tại 122 Tôn Đản, Phường An Khê. Tổ hợp 8 sân thảm thi đấu chuẩn BWF, hệ thống chiếu sáng và thông gió hiện đại, căng vợt tại chỗ. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-050', 'Sân cầu lông Hòa Liên', 'Đường Tân Ninh, Hòa Liên', 'Phường Liên Chiểu', 16.085420, 108.132450, 2, 40000, 60000, 60000, '0905 789 456', 'Sân cầu lông có 2 sân con, tại Đường Tân Ninh, Hòa Liên, Phường Liên Chiểu. Cụm 2 sân cầu lông có mái che tại thôn Tân Ninh, phục vụ thể thao phong trào ngoại thành. Liên hệ sân để biết thêm về tiện ích.'),
  ('KS-051', 'Sân cầu lông Phát Thịnh', 'Đường Nguyễn Tất Thành nối dài, Hòa Liên', 'Phường Liên Chiểu', 16.091450, 108.139820, 2, 50000, 70000, 70000, '0905 096 208', 'Sân cầu lông có 2 sân con, tại Đường Nguyễn Tất Thành nối dài, Hòa Liên, Phường Liên Chiểu. Nhà thi đấu 2 sân thảm tiêu chuẩn, trần cao, đèn chống chói, bãi đỗ xe thuận tiện. Liên hệ sân để biết thêm về tiện ích.');

do $$
declare
  v_owner_email text := null;   -- ví dụ: 'chusan.demo@example.com'
  v_owner uuid;
  v_missing text;
  v_row record;
  v_venue_id bigint;
  v_added int := 0;
  v_skipped int := 0;
begin
  -- Kiểm tra phường, xã: tên phải khớp bảng wards
  select string_agg(distinct i.ward_name, ', ') into v_missing
  from _import_venues i left join public.wards w on w.name = i.ward_name
  where w.id is null;
  if v_missing is not null then
    raise exception 'Không tìm thấy phường, xã: %. Hãy chạy seed.sql trước.', v_missing;
  end if;

  if v_owner_email is not null then
    select p.id into v_owner
    from auth.users u join public.profiles p on p.id = u.id
    where lower(u.email) = lower(v_owner_email) and p.role = 'owner';
    if v_owner is null then
      raise exception 'Không có tài khoản Chủ sân với email %', v_owner_email;
    end if;
  end if;

  for v_row in select * from _import_venues order by code loop
    if exists (select 1 from public.venues v where v.name = v_row.name and v.address = v_row.address) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.venues (owner_id, ward_id, name, address, description, contact_phone, latitude, longitude,
                               open_time, close_time, hold_minutes, max_slots_per_booking, advance_days, max_active_holds,
                               bank_name, bank_account_number, bank_account_name, status, approved_at)
    select v_owner, w.id, v_row.name, v_row.address, v_row.description, v_row.contact_phone, v_row.latitude, v_row.longitude,
           '05:00', '22:00', 15, 20, 7, 2,
           'Chưa cập nhật', 'Chưa cập nhật', 'Chưa cập nhật', 'approved', now()
    from public.wards w where w.name = v_row.ward_name
    returning id into v_venue_id;

    insert into public.courts (venue_id, name)
    select v_venue_id, 'Sân ' || n from generate_series(1, v_row.court_count) n;

    insert into public.price_slots (venue_id, day_type, start_time, end_time, price) values
      (v_venue_id, 'weekday', '05:00', '17:00', v_row.price_day),
      (v_venue_id, 'weekday', '17:00', '22:00', v_row.price_evening),
      (v_venue_id, 'weekend', '05:00', '22:00', v_row.price_weekend);

    v_added := v_added + 1;
  end loop;

  raise notice 'Đã thêm % sân, bỏ qua % sân đã có.', v_added, v_skipped;
end;
$$;

drop table _import_venues;

-- Kiểm tra nhanh sau khi chạy
select count(*) as so_san_da_duyet,
       (select count(*) from public.courts c join public.venues v on v.id = c.venue_id where v.status = 'approved') as so_san_con,
       (select count(*) from public.price_slots p join public.venues v on v.id = p.venue_id where v.status = 'approved') as so_khung_gia
from public.venues where status = 'approved';
