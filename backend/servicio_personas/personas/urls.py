from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CustomerViewSet, 
    EmployeeViewSet,
    SupplierViewSet, 
    RepViewSet,
    PersonaViewSet
)

router = DefaultRouter()
router.register(r'customers', CustomerViewSet)
router.register(r'employees', EmployeeViewSet)
router.register(r'suppliers', SupplierViewSet)
router.register(r'reps', RepViewSet)
router.register(r'personas', PersonaViewSet, basename='persona')

urlpatterns = [
    path('', include(router.urls)),
]
