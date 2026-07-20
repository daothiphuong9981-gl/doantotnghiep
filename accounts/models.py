from django.db import models
from django.contrib.auth.models import AbstractUser

class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('PLAYER', 'Người chơi'),
        ('OWNER', 'Chủ sân'),
        ('ADMIN', 'Quản trị viên'),
    )
    phone_number = models.CharField(max_length=15, blank=False, null=False, verbose_name="Số điện thoại")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='PLAYER', verbose_name="Vai trò")

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
