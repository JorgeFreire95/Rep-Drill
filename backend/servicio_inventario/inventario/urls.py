from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WarehouseViewSet,
    CategoryViewSet,
    ProductViewSet,
    ProductPriceHistoryViewSet,
    ProductCostHistoryViewSet,
    InventoryViewSet,
    InventoryEventViewSet,
    ReorderRequestViewSet,
    SupplierViewSet,
    ReportsViewSet,
    AuditLogViewSet,
)

router = DefaultRouter()
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'price-history', ProductPriceHistoryViewSet, basename='price-history')
router.register(r'cost-history', ProductCostHistoryViewSet, basename='cost-history')
router.register(r'inventory', InventoryViewSet, basename='inventory')
router.register(r'events', InventoryEventViewSet, basename='event')
router.register(r'reorders', ReorderRequestViewSet, basename='reorder')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'reports', ReportsViewSet, basename='reports')
router.register(r'audit', AuditLogViewSet, basename='audit')

urlpatterns = [
    path('', include(router.urls)),
]
