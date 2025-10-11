from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WarehouseViewSet,
    CategoryViewSet,
    ProductViewSet,
    ProductPriceHistoryViewSet,
    InventoryViewSet,
    InventoryEventViewSet
)

router = DefaultRouter()
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'price-history', ProductPriceHistoryViewSet, basename='price-history')
router.register(r'inventory', InventoryViewSet, basename='inventory')
router.register(r'events', InventoryEventViewSet, basename='event')

urlpatterns = [
    path('', include(router.urls)),
]
