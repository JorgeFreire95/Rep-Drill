from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework import filters
from .models import Warehouse, Category, Product, ProductPriceHistory, Inventory, InventoryEvent
from .serializers import (
    WarehouseSerializer,
    CategorySerializer,
    ProductSerializer,
    ProductPriceHistorySerializer,
    InventorySerializer,
    InventoryEventSerializer
)


class WarehouseViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar bodegas/almacenes
    """
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'location']
    ordering_fields = ['name']
    ordering = ['name']


class CategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar categorías de productos
    """
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name']
    ordering = ['name']


class ProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar productos
    """
    queryset = Product.objects.all().select_related('category')
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name']
    ordering = ['name']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        category_id = self.request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        return queryset


class ProductPriceHistoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar historial de precios
    """
    queryset = ProductPriceHistory.objects.all().select_related('product')
    serializer_class = ProductPriceHistorySerializer
    permission_classes = [AllowAny]
    ordering = ['-start_date']


class InventoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar inventario (stock)
    """
    queryset = Inventory.objects.all().select_related('product', 'warehouse')
    serializer_class = InventorySerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product__name', 'warehouse__name']
    ordering = ['-entry_date']


class InventoryEventViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar eventos de inventario
    """
    queryset = InventoryEvent.objects.all().select_related('inventory')
    serializer_class = InventoryEventSerializer
    permission_classes = [AllowAny]
    ordering = ['-event_date']
