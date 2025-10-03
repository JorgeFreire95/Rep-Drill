from django.urls import path
from .views import InventoryListView


urlpatterns = [    
    path('inventories/', InventoryListView.as_view(), name='inventory-list'),
]