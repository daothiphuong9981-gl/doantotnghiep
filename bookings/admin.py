from django.contrib import admin
from .models import Booking

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['id', 'player', 'court', 'time_slot', 'date', 'total_price', 'status', 'created_at']
    list_filter = ['status', 'date', 'court__district']
    search_fields = ['player__username', 'court__name']
    actions = ['approve_bookings', 'cancel_bookings']

    def approve_bookings(self, request, queryset):
        queryset.update(status='CONFIRMED')
    approve_bookings.short_description = "Duyệt các đặt sân đã chọn (Xác nhận cọc)"

    def cancel_bookings(self, request, queryset):
        queryset.update(status='CANCELLED')
    cancel_bookings.short_description = "Hủy các đặt sân đã chọn"
