# courts/management/commands/seed_danang_courts.py
import sys
import datetime
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from courts.models import Court, TimeSlot, Review
from bookings.models import Booking

User = get_user_model()

class Command(BaseCommand):
    help = 'Nạp dữ liệu thực tế ≥ 15 cụm sân cầu lông Đà Nẵng từ kết quả khảo sát Task 1.1 và tạo tài khoản, booking mẫu'

    def handle(self, *args, **options):
        if hasattr(sys.stdout, 'reconfigure'):
            try:
                sys.stdout.reconfigure(encoding='utf-8')
            except Exception:
                pass
        self.stdout.write(self.style.WARNING("=== BẮT ĐẦU NẠP DỮ LIỆU THẬT SÂN CẦU LÔNG ĐÀ NẴNG (TASK 5.2) ==="))

        with transaction.atomic():
            # 1. TẠO TÀI KHOẢN CHỦ SÂN VÀ NGƯỜI CHƠI MẪU
            self.stdout.write("1. Khởi tạo tài khoản mẫu (Chủ sân & Người chơi)...")
            owners_data = [
                ('owner_haichau', 'Chủ sân Hải Châu', '0905111222', 'haichau@badminton.vn'),
                ('owner_sontra', 'Chủ sân Sơn Trà', '0935478567', 'sontra@badminton.vn'),
                ('owner_camle', 'Chủ sân Cẩm Lệ', '0981086979', 'camle@badminton.vn'),
                ('owner_lienghieu', 'Chủ sân Liên Chiểu', '0906534532', 'lienchieu@badminton.vn'),
            ]
            owners = {}
            for username, fullname, phone, email in owners_data:
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        'first_name': fullname,
                        'phone_number': phone,
                        'email': email,
                        'role': 'OWNER'
                    }
                )
                if created:
                    user.set_password('password123')
                    user.save()
                owners[username] = user

            players_data = [
                ('player_tuan', 'Nguyễn Anh Tuấn', '0912345678', 'tuan@gmail.com'),
                ('player_linh', 'Trần Thùy Linh', '0987654321', 'linh@gmail.com'),
                ('player_minh', 'Lê Nhật Minh', '0934567890', 'minh@gmail.com'),
                ('player_hoa', 'Phạm Thanh Hoa', '0909888777', 'hoa@gmail.com'),
            ]
            players = []
            for username, fullname, phone, email in players_data:
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        'first_name': fullname,
                        'phone_number': phone,
                        'email': email,
                        'role': 'PLAYER'
                    }
                )
                if created:
                    user.set_password('password123')
                    user.save()
                players.append(user)

            self.stdout.write(self.style.SUCCESS(f"-> Đã chuẩn bị {len(owners)} chủ sân và {len(players)} người chơi mẫu."))

            # 2. DANH SÁCH 16 CỤM SÂN THỰC TẾ TỪ KHẢO SÁT TASK 1.1 (EVIDENCE.md)
            self.stdout.write("2. Nạp dữ liệu 16 cụm sân cầu lông thực tế tại 6 quận Đà Nẵng...")
            courts_survey_data = [
                # Hải Châu
                {
                    'name': 'Sân cầu lông Đào Duy Anh',
                    'address': '18 Đào Duy Anh, Thạc Gián',
                    'district': 'Hải Châu',
                    'latitude': '16.064512',
                    'longitude': '108.203125',
                    'owner': owners['owner_haichau'],
                    'description': 'Sân thảm PVC tiêu chuẩn thi đấu, hệ thống đèn chiếu sáng chống chói, có chỗ để xe rộng rãi. Liên hệ SĐT: 0905 111 222.',
                    'price_base': 60000
                },
                {
                    'name': 'Sân cầu lông Nguyễn Tri Phương',
                    'address': '458 Nguyễn Tri Phương, Hòa Thuận Nam',
                    'district': 'Hải Châu',
                    'latitude': '16.059510',
                    'longitude': '108.210120',
                    'owner': owners['owner_haichau'],
                    'description': 'Cụm sân trung tâm quận Hải Châu, mặt thảm mới, thoáng mát, quầy nước giải khát phục vụ đầy đủ. SĐT: 0905 335 533.',
                    'price_base': 75000
                },
                {
                    'name': 'Sân cầu lông Quân Khu 5',
                    'address': '07 Duy Tân, Hòa Cường Bắc',
                    'district': 'Hải Châu',
                    'latitude': '16.051200',
                    'longitude': '108.216500',
                    'owner': owners['owner_haichau'],
                    'description': 'Nhà thi đấu quy mô lớn, trần cao, gió thông thoáng tự nhiên, phù hợp tổ chức giải đấu và chơi phong trào. SĐT: 0905 258 387.',
                    'price_base': 100000
                },
                {
                    'name': 'Sân cầu lông Số 4 Lê Duẩn',
                    'address': '04 Lê Duẩn, Hải Châu 1',
                    'district': 'Hải Châu',
                    'latitude': '16.071800',
                    'longitude': '108.221000',
                    'owner': owners['owner_haichau'],
                    'description': 'Vị trí đắc địa ngay trung tâm thành phố gần cầu Sông Hàn, sân bãi sạch sẽ. SĐT: 0905 401 655.',
                    'price_base': 65000
                },
                # Sơn Trà
                {
                    'name': 'Sân cầu lông Sơn Trà (Hồ Nghinh)',
                    'address': '34 Hồ Nghinh, Phước Mỹ',
                    'district': 'Sơn Trà',
                    'latitude': '16.073200',
                    'longitude': '108.241000',
                    'owner': owners['owner_sontra'],
                    'description': 'Cụm sân gần biển Mỹ Khê, thảm chất lượng cao, không gian cực kỳ thoáng đãng. SĐT: 0935 478 567.',
                    'price_base': 75000
                },
                {
                    'name': 'Sân Trường CĐ Lương thực Thực phẩm',
                    'address': '101B Lê Hữu Trác, Phước Mỹ',
                    'district': 'Sơn Trà',
                    'latitude': '16.062100',
                    'longitude': '108.239500',
                    'owner': owners['owner_sontra'],
                    'description': 'Sân nằm trong khuôn viên trường Cao đẳng LTTP, giá cả cực kỳ ưu đãi cho sinh viên và người chơi phong trào. SĐT: 0912 345 678.',
                    'price_base': 55000
                },
                # Thanh Khê
                {
                    'name': 'Sân cầu lông Tin Sport Badminton',
                    'address': '107 Trường Chinh, An Khê',
                    'district': 'Thanh Khê',
                    'latitude': '16.061000',
                    'longitude': '108.188500',
                    'owner': owners['owner_haichau'],
                    'description': 'Sân thảm Enlio mới 100%, đèn LED không lóa mắt, phục vụ chuyên nghiệp tận tình. SĐT: 0935 337 438.',
                    'price_base': 75000
                },
                {
                    'name': 'Sân cầu lông Trọng Nghĩa',
                    'address': '194 Bế Văn Đàn, Chính Gián',
                    'district': 'Thanh Khê',
                    'latitude': '16.065800',
                    'longitude': '108.199000',
                    'owner': owners['owner_haichau'],
                    'description': 'Sân quen thuộc của các CLB phong trào khu vực Thanh Khê, chỗ đậu xe ô tô và xe máy thoải mái. SĐT: 0702 365 369.',
                    'price_base': 65000
                },
                # Cẩm Lệ
                {
                    'name': 'Sân cầu lông Hiếu Con',
                    'address': '72-182 Đỗ Quỳ, Hòa Xuân',
                    'district': 'Cẩm Lệ',
                    'latitude': '16.009500',
                    'longitude': '108.225100',
                    'owner': owners['owner_camle'],
                    'description': 'Cụm sân hiện đại khu đô thị sinh thái Hòa Xuân, trang thiết bị đồng bộ, thảm bám giày tốt. SĐT: 0905 403 222.',
                    'price_base': 65000
                },
                {
                    'name': 'Sân cầu lông Index Sport',
                    'address': '448 Mẹ Thứ, Hòa Xuân',
                    'district': 'Cẩm Lệ',
                    'latitude': '16.012300',
                    'longitude': '108.218800',
                    'owner': owners['owner_camle'],
                    'description': 'Hệ thống sân Index Sport uy tín tại Đà Nẵng, dịch vụ tiện ích khép kín. SĐT: 0981 086 979.',
                    'price_base': 75000
                },
                {
                    'name': 'Sân cầu lông Phúc Đăng',
                    'address': '39 Thanh Lương 19, Hòa Xuân',
                    'district': 'Cẩm Lệ',
                    'latitude': '16.015000',
                    'longitude': '108.231000',
                    'owner': owners['owner_camle'],
                    'description': 'Sân mới xây dựng, không khí thân thiện, giá thuê hợp lý cho nhóm bạn và gia đình. SĐT: 0931 717 991.',
                    'price_base': 60000
                },
                # Liên Chiểu
                {
                    'name': 'Sân cầu lông Hunter',
                    'address': '459 Tôn Đức Thắng, Hòa Khánh Nam',
                    'district': 'Liên Chiểu',
                    'latitude': '16.068500',
                    'longitude': '108.165200',
                    'owner': owners['owner_lienghieu'],
                    'description': 'Cụm sân sôi động khu vực các trường Đại học Bách Khoa, Sư Phạm, thảm chuẩn BWF. SĐT: 0906 534 532.',
                    'price_base': 75000
                },
                {
                    'name': 'Sân cầu lông Win Win Badminton',
                    'address': '642 Tôn Đức Thắng, Hòa Khánh Nam',
                    'district': 'Liên Chiểu',
                    'latitude': '16.075100',
                    'longitude': '108.158000',
                    'owner': owners['owner_lienghieu'],
                    'description': 'Sân Win Win rộng rãi, căng vợt và bán phụ kiện cầu lông ngay tại sân cực kỳ tiện lợi. SĐT: 0934 867 853.',
                    'price_base': 65000
                },
                {
                    'name': 'Sân Arena.01 Premium Badminton',
                    'address': '40 Hoàng Văn Thái, Hòa Minh',
                    'district': 'Liên Chiểu',
                    'latitude': '16.062000',
                    'longitude': '108.169000',
                    'owner': owners['owner_lienghieu'],
                    'description': 'Cụm sân cao cấp Arena.01 Premium chuẩn quốc tế, tiện nghi sang trọng bậc nhất khu vực phía Bắc Đà Nẵng. SĐT: 0788 818 585.',
                    'price_base': 100000
                },
                # Ngũ Hành Sơn
                {
                    'name': 'Sân cầu lông Mỹ An',
                    'address': '382 Ngũ Hành Sơn, Mỹ An',
                    'district': 'Ngũ Hành Sơn',
                    'latitude': '16.038500',
                    'longitude': '108.244000',
                    'owner': owners['owner_sontra'],
                    'description': 'Sân khu vực gần Đại học Kinh tế Đà Nẵng, không gian ấm cúng, chủ sân nhiệt tình. SĐT: 0947 553 069.',
                    'price_base': 65000
                },
                {
                    'name': 'Sân cầu lông Index Sport 2',
                    'address': '81C Lê Văn Hiến, Khuê Mỹ',
                    'district': 'Ngũ Hành Sơn',
                    'latitude': '16.031000',
                    'longitude': '108.246500',
                    'owner': owners['owner_camle'],
                    'description': 'Cơ sở 2 của hệ thống Index Sport, tiếp giáp khu danh thắng Ngũ Hành Sơn, thảm và ánh sáng hoàn hảo. SĐT: 0981 086 979.',
                    'price_base': 80000
                }
            ]

            courts_created_count = 0
            slots_created_count = 0
            courts_obj_list = []

            for c_data in courts_survey_data:
                court, created = Court.objects.update_or_create(
                    name=c_data['name'],
                    defaults={
                        'address': c_data['address'],
                        'district': c_data['district'],
                        'latitude': Decimal(c_data['latitude']),
                        'longitude': Decimal(c_data['longitude']),
                        'owner': c_data['owner'],
                        'description': c_data['description']
                    }
                )
                courts_obj_list.append(court)
                if created:
                    courts_created_count += 1

                # 3. SINH KHUNG GIỜ MẪU CHO TỪNG SÂN (Sáng, Chiều, Tối)
                slot_templates = [
                    (datetime.time(5, 0), datetime.time(7, 0), Decimal(c_data['price_base'] * 2)), # Ca sáng sớm (2h)
                    (datetime.time(7, 0), datetime.time(9, 0), Decimal(c_data['price_base'] * 2)), # Ca sáng (2h)
                    (datetime.time(15, 0), datetime.time(17, 0), Decimal((c_data['price_base'] + 10000) * 2)), # Ca chiều (2h)
                    (datetime.time(17, 0), datetime.time(19, 0), Decimal((c_data['price_base'] + 20000) * 2)), # Ca giờ vàng tối 1 (2h)
                    (datetime.time(19, 0), datetime.time(21, 0), Decimal((c_data['price_base'] + 20000) * 2)), # Ca giờ vàng tối 2 (2h)
                ]
                for st, et, price in slot_templates:
                    slot, s_created = TimeSlot.objects.get_or_create(
                        court=court,
                        start_time=st,
                        end_time=et,
                        defaults={'price': price}
                    )
                    if s_created:
                        slots_created_count += 1

            self.stdout.write(self.style.SUCCESS(f"-> Đã đồng bộ {len(courts_obj_list)} cụm sân (Tạo mới {courts_created_count} sân) cùng {slots_created_count} khung giờ trống."))

            # 4. TẠO ĐƠN ĐẶT SÂN (BOOKING) VÀ ĐÁNH GIÁ (REVIEW) MẪU ĐỂ DEMO
            self.stdout.write("4. Tạo đơn đặt sân (Booking) và bình luận đánh giá (Review) mẫu...")
            today = datetime.date.today()
            tomorrow = today + datetime.timedelta(days=1)
            yesterday = today - datetime.timedelta(days=1)

            bookings_created = 0
            reviews_created = 0

            if courts_obj_list and players:
                # Sân Nguyễn Tri Phương (Sân trung tâm Hải Châu)
                court_ntp = Court.objects.filter(name__icontains="Nguyễn Tri Phương").first()
                if court_ntp:
                    slots = list(court_ntp.slots.all())
                    if len(slots) >= 3:
                        # Booking 1: Hôm nay - Ca tối (Chờ duyệt cọc)
                        b1, created1 = Booking.objects.get_or_create(
                            court=court_ntp,
                            date=today,
                            time_slot=slots[3],
                            defaults={
                                'player': players[0],
                                'total_price': slots[3].price,
                                'status': 'PENDING'
                            }
                        )
                        if created1: bookings_created += 1

                        # Booking 2: Ngày mai - Ca tối (Đã cọc thành công)
                        b2, created2 = Booking.objects.get_or_create(
                            court=court_ntp,
                            date=tomorrow,
                            time_slot=slots[4],
                            defaults={
                                'player': players[1],
                                'total_price': slots[4].price,
                                'status': 'CONFIRMED'
                            }
                        )
                        if created2: bookings_created += 1

                        # Booking 3: Hôm qua - Ca sáng (Đã cọc thành công -> Tạo Review)
                        b3, created3 = Booking.objects.get_or_create(
                            court=court_ntp,
                            date=yesterday,
                            time_slot=slots[0],
                            defaults={
                                'player': players[2],
                                'total_price': slots[0].price,
                                'status': 'CONFIRMED'
                            }
                        )
                        if created3: bookings_created += 1

                        rev1, r_created1 = Review.objects.get_or_create(
                            court=court_ntp,
                            player=players[2],
                            defaults={
                                'rating': 5,
                                'comment': 'Sân Nguyễn Tri Phương thảm cực kỳ êm, ánh sáng không bị chói. Chủ sân hỗ trợ nhiệt tình!'
                            }
                        )
                        if r_created1: reviews_created += 1

                # Sân Quân Khu 5
                court_qk5 = Court.objects.filter(name__icontains="Quân Khu 5").first()
                if court_qk5 and court_qk5.slots.exists():
                    slot_qk5 = court_qk5.slots.first()
                    b_qk5, c_qk5 = Booking.objects.get_or_create(
                        court=court_qk5,
                        date=today,
                        time_slot=slot_qk5,
                        defaults={
                            'player': players[3],
                            'total_price': slot_qk5.price,
                            'status': 'CONFIRMED'
                        }
                    )
                    if c_qk5: bookings_created += 1

                    rev2, r_created2 = Review.objects.get_or_create(
                        court=court_qk5,
                        player=players[3],
                        defaults={
                            'rating': 5,
                            'comment': 'Nhà thi đấu Quân Khu 5 rộng rãi, trần cao không bao giờ lo bị vướng cầu. Rất tuyệt vời cho giải đấu!'
                        }
                    )
                    if r_created2: reviews_created += 1

                # Sân Sơn Trà (Hồ Nghinh)
                court_st = Court.objects.filter(name__icontains="Hồ Nghinh").first()
                if court_st and court_st.slots.exists():
                    slot_st = court_st.slots.last()
                    b_st, c_st = Booking.objects.get_or_create(
                        court=court_st,
                        date=tomorrow,
                        time_slot=slot_st,
                        defaults={
                            'player': players[0],
                            'total_price': slot_st.price,
                            'status': 'PENDING'
                        }
                    )
                    if c_st: bookings_created += 1

                    rev3, r_created3 = Review.objects.get_or_create(
                        court=court_st,
                        player=players[1],
                        defaults={
                            'rating': 4,
                            'comment': 'Sân thoáng mát gió biển, chơi buổi tối rất thích.'
                        }
                    )
                    if r_created3: reviews_created += 1

            self.stdout.write(self.style.SUCCESS(f"-> Đã tạo mới {bookings_created} đơn đặt sân và {reviews_created} bình luận đánh giá mẫu."))
            self.stdout.write(self.style.SUCCESS("=== HOÀN TẤT NẠP DỮ LIỆU THẬT SÂN CẦU LÔNG ĐÀ NẴNG THÀNH CÔNG ==="))
