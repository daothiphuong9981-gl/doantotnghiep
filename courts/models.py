from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator

class Court(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='courts',
        verbose_name="Chủ sân"
    )
    name = models.CharField(max_length=255, verbose_name="Tên cụm sân")
    address = models.CharField(max_length=255, verbose_name="Địa chỉ")
    district = models.CharField(max_length=50, verbose_name="Quận/Huyện")
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        verbose_name="Vĩ độ (Latitude)"
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        verbose_name="Kinh độ (Longitude)"
    )
    description = models.TextField(blank=True, verbose_name="Mô tả sân")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày tạo")

    class Meta:
        verbose_name = "Sân cầu lông"
        verbose_name_plural = "Danh sách Sân cầu lông"

    def __str__(self):
        return f"{self.name} ({self.district})"


class CourtImage(models.Model):
    court = models.ForeignKey(
        Court,
        on_delete=models.CASCADE,
        related_name='images',
        verbose_name="Sân cầu lông"
    )
    image = models.ImageField(upload_to='court_images/', verbose_name="Ảnh sân")

    class Meta:
        verbose_name = "Hình ảnh sân"
        verbose_name_plural = "Hình ảnh sân"

    def __str__(self):
        return f"Ảnh của {self.court.name}"


class TimeSlot(models.Model):
    court = models.ForeignKey(
        Court,
        on_delete=models.CASCADE,
        related_name='slots',
        verbose_name="Sân cầu lông"
    )
    start_time = models.TimeField(verbose_name="Giờ bắt đầu")
    end_time = models.TimeField(verbose_name="Giờ kết thúc")
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Giá thuê (VND/giờ)"
    )

    class Meta:
        verbose_name = "Khung giờ mẫu"
        verbose_name_plural = "Khung giờ mẫu"
        ordering = ['start_time']

    def __str__(self):
        return f"{self.court.name}: {self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')} ({int(self.price)}đ)"


class Review(models.Model):
    player = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews',
        verbose_name="Người chơi"
    )
    court = models.ForeignKey(
        Court,
        on_delete=models.CASCADE,
        related_name='reviews',
        verbose_name="Sân cầu lông"
    )
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        verbose_name="Đánh giá (sao)"
    )
    comment = models.TextField(blank=True, verbose_name="Nhận xét")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày đánh giá")

    class Meta:
        verbose_name = "Đánh giá"
        verbose_name_plural = "Danh sách Đánh giá"
        ordering = ['-created_at']

    def __str__(self):
        return f"Đánh giá {self.rating} sao cho {self.court.name} bởi {self.player.username}"
