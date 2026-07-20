from django.urls import path
from .views import (
    booking_create, get_available_slots, my_bookings, 
    booking_cancel_player, owner_bookings, booking_approve, booking_cancel_owner
)

app_name = 'bookings'

urlpatterns = [
    path('create/', booking_create, name='booking_create'),
    path('my-bookings/', my_bookings, name='my_bookings'),
    path('cancel-player/<int:pk>/', booking_cancel_player, name='booking_cancel_player'),
    path('owner/', owner_bookings, name='owner_bookings'),
    path('approve/<int:pk>/', booking_approve, name='booking_approve'),
    path('cancel-owner/<int:pk>/', booking_cancel_owner, name='booking_cancel_owner'),
    path('api/get-available-slots/', get_available_slots, name='get_available_slots'),
]
