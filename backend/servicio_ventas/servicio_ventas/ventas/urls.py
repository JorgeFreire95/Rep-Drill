from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrderViewSet,
    OrderDetailsViewSet,
    ShipmentViewSet,
    PaymentViewSet,
    dashboard_stats,
    check_product_availability,
    process_order_payment_manually,
    order_payment_status
)

router = DefaultRouter()
router.register(r'orders', OrderViewSet)
router.register(r'order-details', OrderDetailsViewSet)
router.register(r'shipments', ShipmentViewSet)
router.register(r'payments', PaymentViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/stats/', dashboard_stats, name='dashboard-stats'),
    path('check-availability/', check_product_availability, name='check-availability'),
    path('orders/<int:order_id>/process-payment/', process_order_payment_manually, name='process-payment'),
    path('orders/<int:order_id>/payment-status/', order_payment_status, name='payment-status'),
]

