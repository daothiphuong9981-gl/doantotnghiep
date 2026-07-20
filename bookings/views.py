from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db import transaction, IntegrityError
from django.db.models import Sum
from django.http import JsonResponse
from django.utils.dateparse import parse_date
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import datetime, timedelta

from accounts.decorators import player_required, owner_required
from courts.models import Court, TimeSlot
from .models import Booking

@login_required
@player_required
def booking_create(request):
    """
    Luồng đặt sân cầu lông:
    1. Chọn sân (court)
    2. Chọn ngày chơi (date) -> AJAX hiển thị danh sách slot trống
    3. Chọn khung giờ trống (time_slot)
    4. Xác nhận đặt sân -> tạo booking trạng thái PENDING.
    Tích hợp atomic transaction, select_for_update và IntegrityError để chống double-booking.
    """
    court_id = request.GET.get('court') or request.POST.get('court')
    court = get_object_or_404(Court, id=court_id)

    date_str = request.GET.get('date') or request.POST.get('date')
    date_val = None
    if date_str:
        date_val = parse_date(date_str)

    slot_id = request.GET.get('slot') or request.POST.get('slot')
    slot = None
    if slot_id:
        slot = get_object_or_404(TimeSlot, id=slot_id, court=court)

    # Lấy các slot trống nếu có ngày chơi được chọn
    available_slots = []
    booked_slot_ids = []
    if date_val:
        # Danh sách slot đã được đặt
        booked_slot_ids = Booking.objects.filter(
            court=court,
            date=date_val,
            status__in=['PENDING', 'CONFIRMED']
        ).values_list('time_slot_id', flat=True)
        # Khung giờ trống
        available_slots = court.slots.exclude(id__in=booked_slot_ids)

    # Xử lý POST request: Xác nhận đặt sân
    if request.method == 'POST':
        if not date_val:
            messages.error(request, "Vui lòng chọn ngày đặt sân.")
            return redirect(f"/bookings/create/?court={court.id}")
        if not slot_id:
            messages.error(request, "Vui lòng chọn khung giờ chơi.")
            return redirect(f"/bookings/create/?court={court.id}&date={date_str}")

        # Bọc logic trong transaction.atomic để đảm bảo tính cô lập và nhất quán
        try:
            with transaction.atomic():
                # select_for_update() để lock dòng bản ghi khung giờ chơi, chặn các transaction song song khác
                locked_slot = TimeSlot.objects.select_for_update().get(id=slot_id, court=court)
                
                # Kiểm tra lại một lần nữa ở tầng CSDL
                booking_exists = Booking.objects.filter(
                    court=court,
                    time_slot=locked_slot,
                    date=date_val,
                    status__in=['PENDING', 'CONFIRMED']
                ).exists()

                if booking_exists:
                    raise ValidationError("Khung giờ này đã được người khác đặt lịch trước đó.")

                # Tạo mới Booking ở trạng thái PENDING
                booking = Booking.objects.create(
                    player=request.user,
                    court=court,
                    time_slot=locked_slot,
                    date=date_val,
                    total_price=locked_slot.price,
                    status='PENDING'
                )
                
            messages.success(request, f"Đặt sân thành công! Mã đặt sân của bạn: #{booking.id}. Vui lòng thanh toán cọc để hoàn tất.")
            return redirect('bookings:my_bookings')

        except ValidationError as e:
            messages.error(request, str(e))
            return redirect(f"/bookings/create/?court={court.id}&date={date_str}")
        except IntegrityError:
            # Bắt lỗi UniqueConstraint được định nghĩa ở tầng DB
            messages.error(request, "Lỗi trùng lịch! Khung giờ này vừa được người chơi khác đặt trước đó tích tắc!")
            return redirect(f"/bookings/create/?court={court.id}&date={date_str}")

    # Xử lý GET request: Hiển thị form đặt sân từng bước
    return render(request, 'bookings/booking_form.html', {
        'court': court,
        'date_val': date_val,
        'date_str': date_str,
        'slot': slot,
        'available_slots': available_slots,
        'booked_slot_ids': list(booked_slot_ids)
    })


def get_available_slots(request):
    """
    API JSON trả về danh sách khung giờ trống của cụm sân theo ngày cụ thể.
    """
    court_id = request.GET.get('court_id')
    date_str = request.GET.get('date')
    
    if not court_id or not date_str:
        return JsonResponse({'error': 'Thiếu tham số court_id hoặc date'}, status=400)
        
    date_val = parse_date(date_str)
    if not date_val:
        return JsonResponse({'error': 'Định dạng ngày không hợp lệ (YYYY-MM-DD)'}, status=400)
        
    court = get_object_or_404(Court, id=court_id)
    
    # Lấy các slot đã bị đặt
    booked_slot_ids = Booking.objects.filter(
        court=court,
        date=date_val,
        status__in=['PENDING', 'CONFIRMED']
    ).values_list('time_slot_id', flat=True)
    
    # Lấy các slot trống
    available_slots = court.slots.exclude(id__in=booked_slot_ids).order_by('start_time')
    
    data = []
    for s in available_slots:
        data.append({
            'id': s.id,
            'start_time': s.start_time.strftime('%H:%M'),
            'end_time': s.end_time.strftime('%H:%M'),
            'price': float(s.price)
        })
        
    return JsonResponse(data, safe=False)


@login_required
@player_required
def my_bookings(request):
    """
    Trang danh sách lịch sử đặt sân của riêng người chơi hiện tại.
    Gắn kèm cờ can_cancel động dựa trên quy tắc 24h đối với booking đã cọc (CONFIRMED).
    """
    bookings = Booking.objects.filter(player=request.user).select_related('court', 'time_slot').order_by('-created_at')
    
    now = timezone.now()
    for b in bookings:
        b.can_cancel = False
        if b.status == 'PENDING':
            b.can_cancel = True
        elif b.status == 'CONFIRMED':
            # Chuyển đổi ngày và giờ chơi thành datetime cụ thể để so sánh
            booking_start = datetime.combine(b.date, b.time_slot.start_time)
            booking_start = timezone.make_aware(booking_start)
            # Được phép hủy nếu thời điểm hiện tại cách giờ chơi ít nhất 24 tiếng
            if booking_start - now >= timedelta(hours=24):
                b.can_cancel = True

    return render(request, 'bookings/my_bookings.html', {'bookings': bookings})


@login_required
@player_required
def booking_cancel_player(request, pk):
    """
    Xử lý hủy đặt lịch từ phía Người chơi (chuyển sang CANCELLED).
    Kiểm tra IDOR (chỉ cho hủy booking của chính mình) và quy tắc 24h.
    """
    booking = get_object_or_404(Booking, pk=pk)
    
    # Chốt chặn bảo mật 1: Chống IDOR
    if booking.player != request.user:
        messages.error(request, "Bạn không có quyền thực hiện hành động này.")
        return redirect('/')

    # Chốt chặn bảo mật 2: Quy tắc thời gian hủy
    can_cancel = False
    if booking.status == 'PENDING':
        can_cancel = True
    elif booking.status == 'CONFIRMED':
        booking_start = datetime.combine(booking.date, booking.time_slot.start_time)
        booking_start = timezone.make_aware(booking_start)
        if booking_start - timezone.now() >= timedelta(hours=24):
            can_cancel = True

    if not can_cancel:
        messages.error(request, "Không thể hủy lịch đặt sân do đã sát giờ chơi (dưới 24 giờ) hoặc lịch đã kết thúc.")
        return redirect('bookings:my_bookings')

    booking.status = 'CANCELLED'
    booking.save()
    messages.success(request, f"Đã hủy đặt sân #{booking.id} thành công.")
    return redirect('bookings:my_bookings')


@login_required
@owner_required
def owner_bookings(request):
    """
    Dashboard Chủ sân: xem tất cả booking thuộc các cụm sân của mình quản lý.
    Hỗ trợ bộ lọc theo ngày và trạng thái. Tối ưu prefetch tránh N+1.
    """
    # Lấy toàn bộ bookings thuộc sân của chủ sân hiện tại
    booking_qs = Booking.objects.filter(court__owner=request.user).select_related('court', 'player', 'time_slot').order_by('-created_at')

    # Xử lý bộ lọc
    filter_date = request.GET.get('date')
    filter_status = request.GET.get('status')

    if filter_date:
        booking_qs = booking_qs.filter(date=parse_date(filter_date))
    if filter_status:
        booking_qs = booking_qs.filter(status=filter_status)

    # Thống kê cơ bản cho chủ sân (CONFIRMED)
    confirmed_bookings = Booking.objects.filter(court__owner=request.user, status='CONFIRMED')
    total_bookings = confirmed_bookings.count()
    total_revenue = confirmed_bookings.aggregate(total=Sum('total_price'))['total'] or 0

    return render(request, 'bookings/owner_bookings.html', {
        'bookings': booking_qs,
        'filter_date': filter_date,
        'filter_status': filter_status,
        'total_bookings': total_bookings,
        'total_revenue': total_revenue
    })


@login_required
@owner_required
def booking_approve(request, pk):
    """
    Dashboard Chủ sân: Duyệt đặt sân (chuyển PENDING -> CONFIRMED).
    Kiểm tra IDOR (chỉ được duyệt sân thuộc quyền quản lý của mình).
    """
    booking = get_object_or_404(Booking, pk=pk)
    
    # Chốt chặn bảo mật IDOR
    if booking.court.owner != request.user:
        messages.error(request, "Bạn không có quyền thực hiện hành động này.")
        return redirect('/')

    if booking.status != 'PENDING':
        messages.warning(request, "Lịch đặt sân này không ở trạng thái chờ duyệt.")
        return redirect('bookings:owner_bookings')

    booking.status = 'CONFIRMED'
    booking.save()
    messages.success(request, f"Đã duyệt đặt sân #{booking.id} thành công.")
    return redirect('bookings:owner_bookings')


@login_required
@owner_required
def booking_cancel_owner(request, pk):
    """
    Dashboard Chủ sân: Hủy đặt sân (chuyển -> CANCELLED).
    Kiểm tra IDOR.
    """
    booking = get_object_or_404(Booking, pk=pk)
    
    # Chốt chặn bảo mật IDOR
    if booking.court.owner != request.user:
        messages.error(request, "Bạn không có quyền thực hiện hành động này.")
        return redirect('/')

    if booking.status == 'CANCELLED':
        messages.warning(request, "Lịch đặt sân này đã được hủy trước đó.")
        return redirect('bookings:owner_bookings')

    booking.status = 'CANCELLED'
    booking.save()
    messages.success(request, f"Đã hủy lịch đặt sân #{booking.id} thành công.")
    return redirect('bookings:owner_bookings')
