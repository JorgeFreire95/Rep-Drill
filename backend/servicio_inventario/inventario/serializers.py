from rest_framework import serializers
from .models import Warehouse, Category, Product, ProductPriceHistory, Inventory, InventoryEvent, ReorderRequest, ReorderStatusHistory, Supplier, ProductCostHistory, AuditLog


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = '__all__'


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    
    class Meta:
        model = Product
        fields = '__all__'


class ProductPriceHistorySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    class Meta:
        model = ProductPriceHistory
        fields = '__all__'


class ProductCostHistorySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = ProductCostHistory
        fields = '__all__'


class InventorySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    
    class Meta:
        model = Inventory
        fields = '__all__'


class InventoryEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryEvent
        fields = '__all__'


class ReorderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ReorderStatusHistory
        fields = '__all__'


class ReorderRequestSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = ReorderRequest
        fields = '__all__'


class SupplierSerializer(serializers.ModelSerializer):
    products_count = serializers.IntegerField(source='products.count', read_only=True)

    class Meta:
        model = Supplier
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = '__all__'
