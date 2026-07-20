from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.forms import inlineformset_factory
from django.contrib import messages
from django.db import transaction
from django.utils import timezone
from django.db.models import Min
from django.core.paginator import Paginator
from django.http import JsonResponse

from accounts.decorators import owner_required
from .models import Court, CourtImage, TimeSlot
from .forms import CourtForm, CourtImageForm, TimeSlotForm

# Khởi tạo inline formset
CourtImageFormSet = inlineformset_factory(
    Court, CourtImage, form=CourtImageForm, extra=2, can_delete=True
)
TimeSlotFormSet = inlineformset_factory(
    Court, TimeSlot, form=TimeSlotForm, extra=3, can_delete=True
)

@login_required
@owner_required
def manage_courts(request):
    """
    Dashboard hiển thị danh sách sân cầu lông của riêng chủ sân hiện tại.
    """
    courts = Court.objects.filter(owner=request.user).order_by('-created_at')
    return render(request, 'courts/court_list.html', {'courts': courts})


@login_required
@owner_required
def court_create(request):
    """
    Tạo sân mới kèm upload ảnh và cấu hình các khung giờ mẫu.
    """
    if request.method == 'POST':
        form = CourtForm(request.POST)
        image_formset = CourtImageFormSet(request.POST, request.FILES)
        slot_formset = TimeSlotFormSet(request.POST)

        if form.is_valid() and image_formset.is_valid() and slot_formset.is_valid():
            try:
                with transaction.atomic():
                    # Lưu sân, gán chủ sở hữu là user hiện tại
                    court = form.save(commit=False)
                    court.owner = request.user
                    court.save()

                    # Gán sân vừa tạo cho formset và lưu
                    image_formset.instance = court
                    image_formset.save()

                    slot_formset.instance = court
                    slot_formset.save()

                messages.success(request, "Thêm mới sân cầu lông thành công!")
                return redirect('courts:manage_courts')
            except Exception as e:
                messages.error(request, f"Có lỗi xảy ra khi lưu dữ liệu: {str(e)}")
        else:
            messages.error(request, "Vui lòng kiểm tra lại thông tin nhập liệu.")
    else:
        form = CourtForm()
        image_formset = CourtImageFormSet()
        slot_formset = TimeSlotFormSet()

    return render(request, 'courts/court_form.html', {
        'form': form,
        'image_formset': image_formset,
        'slot_formset': slot_formset,
        'title': 'Thêm sân cầu lông mới'
    })


@login_required
@owner_required
def court_update(request, pk):
    """
    Chỉnh sửa thông tin sân, hình ảnh và khung giờ mẫu. Chặn IDOR ở mức ứng dụng.
    """
    court = get_object_or_404(Court, pk=pk)
    
    # Bảo mật: Chặn chủ sân khác chỉnh sửa sân không thuộc sở hữu
    if court.owner != request.user:
        messages.error(request, "Bạn không có quyền chỉnh sửa sân cầu lông này!")
        return redirect('courts:manage_courts')

    if request.method == 'POST':
        form = CourtForm(request.POST, instance=court)
        image_formset = CourtImageFormSet(request.POST, request.FILES, instance=court)
        slot_formset = TimeSlotFormSet(request.POST, instance=court)

        if form.is_valid() and image_formset.is_valid() and slot_formset.is_valid():
            try:
                with transaction.atomic():
                    form.save()
                    image_formset.save()
                    slot_formset.save()
                messages.success(request, "Cập nhật thông tin sân thành công!")
                return redirect('courts:manage_courts')
            except Exception as e:
                messages.error(request, f"Có lỗi xảy ra khi cập nhật dữ liệu: {str(e)}")
        else:
            messages.error(request, "Vui lòng kiểm tra lại dữ liệu nhập vào.")
    else:
        form = CourtForm(instance=court)
        image_formset = CourtImageFormSet(instance=court)
        slot_formset = TimeSlotFormSet(instance=court)

    return render(request, 'courts/court_form.html', {
        'form': form,
        'image_formset': image_formset,
        'slot_formset': slot_formset,
        'title': 'Chỉnh sửa thông tin sân'
    })


@login_required
@owner_required
def court_delete(request, pk):
    """
    Xóa sân. Chặn xóa nếu đang có các booking hoạt động. Chặn IDOR.
    """
    court = get_object_or_404(Court, pk=pk)

    # Bảo mật: Chặn xóa sân của người khác
    if court.owner != request.user:
        messages.error(request, "Bạn không có quyền xóa sân cầu lông này!")
        return redirect('courts:manage_courts')

    # Kiểm tra ràng buộc kinh doanh: Chặn xóa nếu có lịch đặt tương lai hoạt động
    # Tránh import vòng lặp bằng cách import Booking cục bộ trong view
    from bookings.models import Booking
    has_active_bookings = Booking.objects.filter(
        court=court,
        status__in=['PENDING', 'CONFIRMED'],
        date__gte=timezone.localdate()
    ).exists()

    if has_active_bookings:
        messages.error(
            request, 
            "Không thể xóa sân này vì hiện tại đang có lịch đặt sân chưa hoàn thành. "
            "Vui lòng xử lý/hủy các booking trước khi thực hiện xóa!"
        )
        return redirect('courts:manage_courts')

    if request.method == 'POST':
        court.delete()
        messages.success(request, "Đã xóa sân cầu lông thành công!")
        return redirect('courts:manage_courts')

    return render(request, 'courts/court_confirm_delete.html', {'court': court})


def court_list(request):
    """
    Trang chủ công khai hiển thị lưới danh sách sân cầu lông, có phân trang và tính giá tối thiểu động.
    """
    court_qs = Court.objects.annotate(min_price=Min('slots__price')).order_by('-created_at')
    
    # Phân trang: 6 sân mỗi trang
    paginator = Paginator(court_qs, 6)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    return render(request, 'courts/court_public_list.html', {'page_obj': page_obj})


def court_detail(request, pk):
    """
    Trang chi tiết cụm sân hiển thị gallery, bảng giá khung giờ và nhúng bản đồ Leaflet.
    """
    court = get_object_or_404(Court, pk=pk)
    slots = court.slots.all()
    images = court.images.all()
    return render(request, 'courts/court_detail.html', {
        'court': court,
        'slots': slots,
        'images': images
    })


def filter_courts_queryset(request):
    """
    Hàm helper lọc danh sách sân dựa trên tham số GET query: district, max_price, date.
    Tối ưu hóa select_related/prefetch_related và distinct để tránh N+1 và bản ghi trùng lặp.
    """
    court_qs = Court.objects.annotate(min_price=Min('slots__price')).select_related('owner').prefetch_related('slots', 'images')
    
    district = request.GET.get('district')
    max_price = request.GET.get('max_price')
    date_str = request.GET.get('date')

    # 1. Lọc theo quận/huyện
    if district:
        court_qs = court_qs.filter(district=district)

    # 2. Lọc theo khoảng giá tối đa
    if max_price:
        try:
            max_price_val = float(max_price)
            court_qs = court_qs.filter(slots__price__lte=max_price_val)
        except ValueError:
            pass

    # 3. Lọc theo ngày chơi trống (loại bỏ các slot đã bị trùng lịch đặt)
    if date_str:
        try:
            # Parse date để đảm bảo đúng định dạng YYYY-MM-DD
            from datetime import datetime
            parsed_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            
            # Import Booking cục bộ để tránh vòng lặp import
            from bookings.models import Booking
            
            # Lấy các slot đã có Booking ở trạng thái PENDING hoặc CONFIRMED vào ngày đó
            booked_slots = Booking.objects.filter(
                date=parsed_date,
                status__in=['PENDING', 'CONFIRMED']
            ).values_list('time_slot_id', flat=True)
            
            # Chỉ lấy các sân có ít nhất một slot trống (không nằm trong danh sách đã đặt)
            court_qs = court_qs.filter(slots__id__in=TimeSlot.objects.exclude(id__in=booked_slots))
        except (ValueError, TypeError):
            pass

    return court_qs.distinct().order_by('-created_at')


def court_map(request):
    """
    Trang chủ Bản đồ WebGIS hiển thị toàn bộ sân cầu lông trên nền OpenStreetMap.
    Đồng thời hiển thị sidebar danh sách sân kết quả đã được lọc.
    """
    courts = filter_courts_queryset(request)
    
    # Lấy danh sách các Quận duy nhất hiện có trong DB để phục vụ đổ dropdown bộ lọc
    districts = Court.objects.values_list('district', flat=True).distinct().order_by('district')
    
    return render(request, 'courts/court_map.html', {
        'courts': courts,
        'districts': districts
    })


def court_json_list(request):
    """
    API JSON danh sách sân cầu lông phục vụ tải dữ liệu lên bản đồ Leaflet (đã lọc).
    """
    court_qs = filter_courts_queryset(request)
    data = []
    for court in court_qs:
        data.append({
            'id': court.id,
            'name': court.name,
            'address': court.address,
            'district': court.district,
            'latitude': float(court.latitude),
            'longitude': float(court.longitude),
            'min_price': float(court.min_price) if court.min_price else None,
            'detail_url': f"/courts/{court.id}/"
        })
    return JsonResponse(data, safe=False)
