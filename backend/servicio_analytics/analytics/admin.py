"""
Configuración del admin de Django para analytics.
"""
from django.contrib import admin
from .models import (
    DailySalesMetrics,
    ProductDemandMetrics,
    InventoryTurnoverMetrics,
    CategoryPerformanceMetrics,
    StockReorderRecommendation
)


@admin.register(DailySalesMetrics)
class DailySalesMetricsAdmin(admin.ModelAdmin):
    """Admin para métricas diarias de ventas."""
    list_display = [
        'date', 
        'total_sales', 
        'total_orders', 
        'average_order_value',
        'products_sold',
        'unique_products',
        'calculated_at'
    ]
    list_filter = ['date', 'calculated_at']
    search_fields = ['date']
    ordering = ['-date']
    readonly_fields = ['calculated_at']


@admin.register(ProductDemandMetrics)
class ProductDemandMetricsAdmin(admin.ModelAdmin):
    """Admin para métricas de demanda de productos."""
    list_display = [
        'product_name',
        'product_sku',
        'period_start',
        'period_end',
        'average_daily_demand',
        'total_quantity_sold',
        'total_revenue',
        'trend'
    ]
    list_filter = ['trend', 'period_start', 'period_end']
    search_fields = ['product_name', 'product_sku']
    ordering = ['-average_daily_demand']
    readonly_fields = ['calculated_at']


@admin.register(InventoryTurnoverMetrics)
class InventoryTurnoverMetricsAdmin(admin.ModelAdmin):
    """Admin para métricas de rotación de inventario."""
    list_display = [
        'product_name',
        'warehouse_name',
        'turnover_rate',
        'days_of_inventory',
        'classification',
        'stockout_risk',
        'overstock_risk'
    ]
    list_filter = [
        'classification',
        'stockout_risk',
        'overstock_risk',
        'period_start'
    ]
    search_fields = ['product_name', 'warehouse_name']
    ordering = ['-turnover_rate']
    readonly_fields = ['calculated_at']


@admin.register(CategoryPerformanceMetrics)
class CategoryPerformanceMetricsAdmin(admin.ModelAdmin):
    """Admin para métricas de rendimiento de categorías."""
    list_display = [
        'category_name',
        'period_start',
        'period_end',
        'total_revenue',
        'total_units_sold',
        'revenue_share',
        'growth_rate'
    ]
    list_filter = ['period_start', 'period_end']
    search_fields = ['category_name']
    ordering = ['-total_revenue']
    readonly_fields = ['calculated_at']


@admin.register(StockReorderRecommendation)
class StockReorderRecommendationAdmin(admin.ModelAdmin):
    """Admin para recomendaciones de reorden."""
    list_display = [
        'product_name',
        'warehouse_name',
        'current_stock',
        'recommended_order_quantity',
        'reorder_priority',
        'stockout_date_estimate',
        'status',
        'created_at'
    ]
    list_filter = [
        'reorder_priority',
        'status',
        'created_at',
        'stockout_date_estimate'
    ]
    search_fields = ['product_name', 'product_sku', 'warehouse_name']
    ordering = ['-reorder_priority', 'stockout_date_estimate']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Información del Producto', {
            'fields': (
                'product_id',
                'product_name',
                'product_sku',
                'warehouse_id',
                'warehouse_name'
            )
        }),
        ('Estado Actual', {
            'fields': (
                'current_stock',
                'min_stock_level',
                'average_daily_demand'
            )
        }),
        ('Predicciones', {
            'fields': (
                'predicted_demand_7days',
                'predicted_demand_30days'
            )
        }),
        ('Recomendaciones', {
            'fields': (
                'recommended_order_quantity',
                'reorder_priority',
                'safety_stock',
                'reorder_point'
            )
        }),
        ('Fechas', {
            'fields': (
                'stockout_date_estimate',
                'recommended_order_date'
            )
        }),
        ('Estado y Metadatos', {
            'fields': (
                'status',
                'created_at',
                'updated_at'
            )
        }),
    )
