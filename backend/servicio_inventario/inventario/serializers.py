from rest_framework import serializers
from .models import Warehouse, Category, Product, ProductPriceHistory, Inventory, InventoryEvent


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
    
    class Meta:
        model = Product
        fields = '__all__'


class ProductPriceHistorySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    class Meta:
        model = ProductPriceHistory
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
