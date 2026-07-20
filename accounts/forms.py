from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import CustomUser

class CustomUserCreationForm(UserCreationForm):
    email = forms.EmailField(required=True, label="Địa chỉ email")
    phone_number = forms.CharField(max_length=15, required=True, label="Số điện thoại")
    role = forms.ChoiceField(
        choices=(
            ('PLAYER', 'Người chơi (Tìm & đặt sân)'),
            ('OWNER', 'Chủ sân (Đăng & quản lý sân)'),
        ),
        required=True,
        label="Vai trò tài khoản"
    )
    data_privacy_consent = forms.BooleanField(
        required=True,
        error_messages={'required': 'Bạn phải đồng ý với Điều khoản thu thập và bảo vệ dữ liệu cá nhân.'},
        label="Đồng ý điều khoản NĐ 13/2023"
    )

    class Meta(UserCreationForm.Meta):
        model = CustomUser
        fields = UserCreationForm.Meta.fields + ('email', 'phone_number', 'role')

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data['email']
        user.phone_number = self.cleaned_data['phone_number']
        user.role = self.cleaned_data['role']
        if commit:
            user.save()
        return user
