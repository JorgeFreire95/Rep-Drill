"""
Serializers para el servicio de analytics.
"""
from rest_framework import serializers
from .models import (
    DailySalesMetrics,
    ProductDemandMetrics,
    InventoryTurnoverMetrics,
    CategoryPerformanceMetrics,
    StockReorderRecommendation,
    ForecastAccuracyHistory,
    ForecastProductAccuracy,
    ForecastCategoryAccuracy,
    TaskRun
)


class DailySalesMetricsSerializer(serializers.ModelSerializer):
    """Serializer para métricas diarias de ventas."""
    
    class Meta:
        model = DailySalesMetrics
        fields = '__all__'
        read_only_fields = ['calculated_at']


class ProductDemandMetricsSerializer(serializers.ModelSerializer):
    """Serializer para métricas de demanda de productos."""
    
    class Meta:
        model = ProductDemandMetrics
        fields = '__all__'
        read_only_fields = ['calculated_at']


class InventoryTurnoverMetricsSerializer(serializers.ModelSerializer):
    """Serializer para métricas de rotación de inventario."""
    
    class Meta:
        model = InventoryTurnoverMetrics
        fields = '__all__'
        read_only_fields = ['calculated_at']


class CategoryPerformanceMetricsSerializer(serializers.ModelSerializer):
    """Serializer para métricas de rendimiento de categorías."""
    
    class Meta:
        model = CategoryPerformanceMetrics
        fields = '__all__'
        read_only_fields = ['calculated_at']


class StockReorderRecommendationSerializer(serializers.ModelSerializer):
    """Serializer para recomendaciones de reorden de stock."""
    
    days_until_stockout = serializers.SerializerMethodField()
    
    class Meta:
        model = StockReorderRecommendation
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
    
    def get_days_until_stockout(self, obj):
        """Calcula días hasta agotamiento."""
        if obj.stockout_date_estimate:
            from datetime import date
            delta = obj.stockout_date_estimate - date.today()
            return max(0, delta.days)
        return None


class ForecastAccuracyHistorySerializer(serializers.ModelSerializer):
    """Serializer para historial de precisión de forecasts."""
    
    class Meta:
        model = ForecastAccuracyHistory
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'absolute_error', 'percentage_error', 'within_confidence']


class ForecastProductAccuracySerializer(serializers.ModelSerializer):
    class Meta:
        model = ForecastProductAccuracy
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class ForecastCategoryAccuracySerializer(serializers.ModelSerializer):
    class Meta:
        model = ForecastCategoryAccuracy
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class SalesTrendSerializer(serializers.Serializer):
    """Serializer para tendencias de ventas agregadas."""
    period = serializers.CharField()
    total_sales = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_orders = serializers.IntegerField()
    average_order_value = serializers.DecimalField(max_digits=12, decimal_places=2)
    products_sold = serializers.IntegerField()
    growth_rate = serializers.DecimalField(max_digits=6, decimal_places=2, required=False)


class InventoryHealthSerializer(serializers.Serializer):
    """Serializer para salud general del inventario."""
    total_products = serializers.IntegerField()
    low_stock_products = serializers.IntegerField()
    out_of_stock_products = serializers.IntegerField()
    overstock_products = serializers.IntegerField()
    average_turnover_rate = serializers.DecimalField(max_digits=6, decimal_places=2)
    urgent_reorders = serializers.IntegerField()
    total_inventory_value = serializers.DecimalField(max_digits=12, decimal_places=2)


class TopProductSerializer(serializers.Serializer):
    """Serializer para productos top."""
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    product_sku = serializers.CharField(allow_blank=True, allow_null=True)
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_quantity_sold = serializers.IntegerField()
    total_orders = serializers.IntegerField()
    average_daily_demand = serializers.DecimalField(max_digits=10, decimal_places=2)


class TaskRunSerializer(serializers.ModelSerializer):
    """Serializer para ejecuciones de tareas Celery."""
    
    class Meta:
        model = TaskRun
        fields = ['id', 'run_id', 'task_name', 'status', 'started_at', 'finished_at', 'duration_ms', 'details', 'error']
        read_only_fields = ['id', 'run_id', 'started_at', 'finished_at', 'duration_ms']
