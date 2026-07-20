from django.contrib import admin
from .models import Court, CourtImage, TimeSlot, Review

class CourtImageInline(admin.TabularInline):
    model = CourtImage
    extra = 1

class TimeSlotInline(admin.TabularInline):
    model = TimeSlot
    extra = 4

@admin.register(Court)
class CourtAdmin(admin.ModelAdmin):
    list_display = ['name', 'owner', 'district', 'address', 'latitude', 'longitude', 'created_at']
    list_filter = ['district', 'created_at']
    search_fields = ['name', 'address']
    inlines = [CourtImageInline, TimeSlotInline]

@admin.register(TimeSlot)
class TimeSlotAdmin(admin.ModelAdmin):
    list_display = ['court', 'start_time', 'end_time', 'price']
    list_filter = ['court__district', 'start_time']
    search_fields = ['court__name']

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ['player', 'court', 'rating', 'created_at']
    list_filter = ['rating', 'created_at']
    search_fields = ['court__name', 'player__username']
