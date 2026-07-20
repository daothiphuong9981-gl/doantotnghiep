from django.db import models
from django.conf import settings
from courts.models import Court, TimeSlot

class Booking(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Chờ duyệt cọc'),
        ('CONFIRMED', 'Đã cọc (Thành công)'),
        ('CANCELLED', 'Đã hủy'),
    )

    player = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bookings',
        verbose_name="Người chơi"
    )
    court = models.ForeignKey(
        Court,
        on_delete=models.CASCADE,
        related_name='bookings',
        verbose_name="Sân cầu lông"
    )
    time_slot = models.ForeignKey(
        TimeSlot,
        on_delete=models.CASCADE,
        related_name='bookings',
        verbose_name="Khung giờ đặt"
    )
    date = models.DateField(verbose_name="Ngày đặt chơi")
    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Tổng tiền"
    )
    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default='PENDING',
        verbose_name="Trạng thái"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày tạo đặt sân")

    class Meta:
        verbose_name = "Đặt sân"
        verbose_name_plural = "Danh sách Đặt sân"
        ordering = ['-date', 'time_slot__start_time']
        constraints = [
            models.UniqueConstraint(
                fields=['court', 'date', 'time_slot'],
                name='unique_court_booking_slot'
            )
        ]

    def __str__(self):
        return f"{self.player.username} đặt {self.court.name} ngày {self.date} [{self.get_status_display()}]"
