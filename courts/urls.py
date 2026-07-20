from django.urls import path
from .views import (
    manage_courts, court_create, court_update, court_delete, 
    court_list, court_detail, court_map, court_json_list
)

app_name = 'courts'

urlpatterns = [
    path('', court_map, name='court_map'),
    path('list/', court_list, name='court_list'),
    path('api/', court_json_list, name='court_json_list'),
    path('<int:pk>/', court_detail, name='court_detail'),
    path('manage/', manage_courts, name='manage_courts'),
    path('create/', court_create, name='court_create'),
    path('<int:pk>/update/', court_update, name='court_update'),
    path('<int:pk>/delete/', court_delete, name='court_delete'),
]
