from django import forms
from django.core.exceptions import ValidationError
from .models import Court, CourtImage, TimeSlot

class CourtForm(forms.ModelForm):
    class Meta:
        model = Court
        fields = ['name', 'address', 'district', 'latitude', 'longitude', 'description']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 4, 'placeholder': 'Nhập mô tả cụm sân, tiện ích...'}),
            'latitude': forms.NumberInput(attrs={'step': 'any', 'placeholder': 'Ví dụ: 16.0595'}),
            'longitude': forms.NumberInput(attrs={'step': 'any', 'placeholder': 'Ví dụ: 108.212'}),
        }

    def clean_latitude(self):
        lat = self.cleaned_data.get('latitude')
        if lat is not None and (lat < -90 or lat > 90):
            raise ValidationError("Vĩ độ (Latitude) phải nằm trong khoảng từ -90 đến 90.")
        return lat

    def clean_longitude(self):
        lng = self.cleaned_data.get('longitude')
        if lng is not None and (lng < -180 or lng > 180):
            raise ValidationError("Kinh độ (Longitude) phải nằm trong khoảng từ -180 đến 180.")
        return lng


class CourtImageForm(forms.ModelForm):
    class Meta:
        model = CourtImage
        fields = ['image']

    def clean_image(self):
        image = self.cleaned_data.get('image')
        if image:
            # Giới hạn kích thước ảnh tối đa 5MB (5 * 1024 * 1024 bytes)
            if image.size > 5 * 1024 * 1024:
                raise ValidationError("Dung lượng ảnh vượt quá giới hạn cho phép (Tối đa 5MB).")
        return image


class TimeSlotForm(forms.ModelForm):
    class Meta:
        model = TimeSlot
        fields = ['start_time', 'end_time', 'price']
        widgets = {
            'start_time': forms.TimeInput(format='%H:%M', attrs={'type': 'time', 'class': 'form-control'}),
            'end_time': forms.TimeInput(format='%H:%M', attrs={'type': 'time', 'class': 'form-control'}),
            'price': forms.NumberInput(attrs={'min': '1000', 'step': '1000', 'class': 'form-control'}),
        }

    def clean_price(self):
        price = self.cleaned_data.get('price')
        if price is not None and price <= 0:
            raise ValidationError("Giá thuê phải lớn hơn 0 VND.")
        return price

    def clean(self):
        cleaned_data = super().clean()
        start = cleaned_data.get('start_time')
        end = cleaned_data.get('end_time')
        if start and end and start >= end:
            raise ValidationError("Giờ bắt đầu phải nhỏ hơn giờ kết thúc.")
        return cleaned_data
