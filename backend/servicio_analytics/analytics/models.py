"""
Modelos para el servicio de analytics.
Almacena métricas agregadas y calculadas para análisis y predicciones.
"""
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.contrib.postgres.fields import JSONField as PostgresJSONField  # type: ignore


class DailySalesMetrics(models.Model):
    """
    Métricas diarias de ventas agregadas.
    Calculadas una vez al día para evitar consultas costosas.
    """
    date = models.DateField(db_index=True)
    
    # Métricas de ventas
    total_sales = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=Decimal('0.00'),
        help_text="Total de ventas del día"
    )
    total_orders = models.IntegerField(
        default=0,
        help_text="Número total de órdenes completadas"
    )
    average_order_value = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=Decimal('0.00'),
        help_text="Valor promedio de cada orden"
    )
    
    # Métricas de productos
    products_sold = models.IntegerField(
        default=0,
        help_text="Cantidad total de productos vendidos"
    )
    unique_products = models.IntegerField(
        default=0,
        help_text="Número de productos únicos vendidos"
    )
    
    # Métricas de clientes
    unique_customers = models.IntegerField(
        default=0,
        help_text="Número de clientes únicos que compraron"
    )
    
    # Metadatos
    calculated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        if not self.date:
            # Usar la fecha del sistema local (America/Santiago)
            self.date = timezone.localdate()
        super().save(*args, **kwargs)
    
    class Meta:
        db_table = 'analytics_daily_sales_metrics'
        verbose_name = 'Métrica Diaria de Ventas'
        verbose_name_plural = 'Métricas Diarias de Ventas'
        ordering = ['-date']
        unique_together = ['date']
        indexes = [
            models.Index(fields=['-date']),
            models.Index(fields=['calculated_at']),
        ]
    
    def __str__(self):
        return f"Ventas {self.date}: ${self.total_sales}"


class ProductDemandMetrics(models.Model):
    """
    Métricas de demanda por producto.
    Usado para predicciones de reabastecimiento y análisis de popularidad.
    """
    product_id = models.IntegerField(db_index=True)
    product_name = models.CharField(max_length=200)
    product_sku = models.CharField(max_length=100, blank=True, null=True)
    
    # Período de análisis
    period_start = models.DateField()
    period_end = models.DateField()
    period_days = models.IntegerField(default=30)
    
    # Métricas de demanda
    total_quantity_sold = models.IntegerField(
        default=0,
        help_text="Cantidad total vendida en el período"
    )
    total_orders = models.IntegerField(
        default=0,
        help_text="Número de órdenes que incluyeron este producto"
    )
    average_daily_demand = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Promedio de unidades vendidas por día"
    )
    max_daily_demand = models.IntegerField(
        default=0,
        help_text="Máximo de unidades vendidas en un día"
    )
    min_daily_demand = models.IntegerField(
        default=0,
        help_text="Mínimo de unidades vendidas en un día"
    )
    
    # Métricas financieras
    total_revenue = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Ingresos totales del producto"
    )
    average_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Precio promedio de venta"
    )
    
    # Tendencia
    trend = models.CharField(
        max_length=20,
        choices=[
            ('increasing', 'Aumentando'),
            ('stable', 'Estable'),
            ('decreasing', 'Disminuyendo'),
        ],
        default='stable'
    )
    trend_percentage = models.DecimalField(
        max_digits=6, 
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Cambio porcentual en la demanda (+ o -)"
    )
    
    # Metadatos
    calculated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        if not self.period_start:
            # Usar la fecha del sistema local (America/Santiago)
            self.period_start = timezone.localdate()
        if not self.period_end:
            self.period_end = timezone.localdate()
        super().save(*args, **kwargs)
    
    class Meta:
        db_table = 'analytics_product_demand_metrics'
        verbose_name = 'Métrica de Demanda de Producto'
        verbose_name_plural = 'Métricas de Demanda de Productos'
        ordering = ['-average_daily_demand']
        unique_together = ['product_id', 'period_start', 'period_end']
        indexes = [
            # Índices compuestos optimizados para queries comunes
            models.Index(fields=['product_id', '-period_end'], name='idx_product_period'),
            models.Index(fields=['-average_daily_demand', 'product_id'], name='idx_demand_product'),
            models.Index(fields=['period_start', 'period_end'], name='idx_period_range'),
            models.Index(fields=['trend', '-calculated_at'], name='idx_trend_calc'),
            models.Index(fields=['-calculated_at'], name='idx_calc_time'),
        ]
    
    def __str__(self):
        return f"{self.product_name} ({self.period_start} - {self.period_end})"


class InventoryTurnoverMetrics(models.Model):
    """
    Métricas de rotación de inventario por producto y bodega.
    Indica qué tan rápido se vende el inventario.
    """
    product_id = models.IntegerField(db_index=True)
    product_name = models.CharField(max_length=200)
    warehouse_id = models.IntegerField(db_index=True, null=True, blank=True)
    warehouse_name = models.CharField(max_length=200, blank=True, null=True)
    
    # Período de análisis
    period_start = models.DateField()
    period_end = models.DateField()
    period_days = models.IntegerField(default=30)
    
    # Inventario
    average_inventory = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Inventario promedio en el período"
    )
    starting_inventory = models.IntegerField(
        default=0,
        help_text="Inventario al inicio del período"
    )
    ending_inventory = models.IntegerField(
        default=0,
        help_text="Inventario al final del período"
    )
    
    # Ventas
    units_sold = models.IntegerField(
        default=0,
        help_text="Unidades vendidas en el período"
    )
    cost_of_goods_sold = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Costo de los productos vendidos"
    )
    
    # Métricas de rotación
    turnover_rate = models.DecimalField(
        max_digits=6, 
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Tasa de rotación (veces que se vendió el inventario)"
    )
    days_of_inventory = models.DecimalField(
        max_digits=6, 
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Días de inventario disponible"
    )
    
    # Clasificación
    classification = models.CharField(
        max_length=20,
        choices=[
            ('fast_moving', 'Rápida Rotación'),
            ('medium_moving', 'Rotación Media'),
            ('slow_moving', 'Rotación Lenta'),
            ('obsolete', 'Obsoleto'),
        ],
        default='medium_moving'
    )
    
    # Alertas
    stockout_risk = models.CharField(
        max_length=20,
        choices=[
            ('high', 'Alto'),
            ('medium', 'Medio'),
            ('low', 'Bajo'),
        ],
        default='low',
        help_text="Riesgo de quedarse sin stock"
    )
    overstock_risk = models.CharField(
        max_length=20,
        choices=[
            ('high', 'Alto'),
            ('medium', 'Medio'),
            ('low', 'Bajo'),
        ],
        default='low',
        help_text="Riesgo de exceso de inventario"
    )
    
    # Metadatos
    calculated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        if not self.period_start:
            # Usar la fecha del sistema local (America/Santiago)
            self.period_start = timezone.localdate()
        if not self.period_end:
            self.period_end = timezone.localdate()
        super().save(*args, **kwargs)
    
    class Meta:
        db_table = 'analytics_inventory_turnover_metrics'
        verbose_name = 'Métrica de Rotación de Inventario'
        verbose_name_plural = 'Métricas de Rotación de Inventario'
        ordering = ['-turnover_rate']
        unique_together = ['product_id', 'warehouse_id', 'period_start', 'period_end']
        indexes = [
            models.Index(fields=['product_id', 'warehouse_id', '-period_end']),
            models.Index(fields=['-turnover_rate']),
            models.Index(fields=['classification']),
            models.Index(fields=['stockout_risk']),
        ]
    
    def __str__(self):
        warehouse = self.warehouse_name or "Sin bodega"
        return f"{self.product_name} - {warehouse} (Rotación: {self.turnover_rate})"


class CategoryPerformanceMetrics(models.Model):
    """
    Métricas de rendimiento por categoría de producto.
    Análisis agregado a nivel de categoría.
    """
    category_id = models.IntegerField(db_index=True)
    category_name = models.CharField(max_length=200)
    
    # Período de análisis
    period_start = models.DateField()
    period_end = models.DateField()
    period_days = models.IntegerField(default=30)
    
    # Métricas de ventas
    total_revenue = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        default=Decimal('0.00')
    )
    total_units_sold = models.IntegerField(default=0)
    total_orders = models.IntegerField(default=0)
    average_order_value = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        default=Decimal('0.00')
    )
    
    # Productos en la categoría
    total_products = models.IntegerField(
        default=0,
        help_text="Total de productos en la categoría"
    )
    active_products = models.IntegerField(
        default=0,
        help_text="Productos que tuvieron ventas"
    )
    
    # Performance
    revenue_share = models.DecimalField(
        max_digits=5, 
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Porcentaje del revenue total"
    )
    growth_rate = models.DecimalField(
        max_digits=6, 
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Tasa de crecimiento vs período anterior"
    )
    
    # Metadatos
    calculated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        if not self.period_start:
            # Usar la fecha del sistema local (America/Santiago)
            self.period_start = timezone.localdate()
        if not self.period_end:
            self.period_end = timezone.localdate()
        super().save(*args, **kwargs)
    
    class Meta:
        db_table = 'analytics_category_performance_metrics'
        verbose_name = 'Métrica de Rendimiento de Categoría'
        verbose_name_plural = 'Métricas de Rendimiento de Categorías'
        ordering = ['-total_revenue']
        unique_together = ['category_id', 'period_start', 'period_end']
        indexes = [
            models.Index(fields=['category_id', '-period_end']),
            models.Index(fields=['-total_revenue']),
        ]
    
    def __str__(self):
        return f"{self.category_name} ({self.period_start} - {self.period_end})"


class StockReorderRecommendation(models.Model):
    """
    Recomendaciones de reorden de stock basadas en análisis predictivo.
    Generadas automáticamente por el sistema.
    """
    product_id = models.IntegerField(db_index=True)
    product_name = models.CharField(max_length=200)
    product_sku = models.CharField(max_length=100, blank=True, null=True)
    warehouse_id = models.IntegerField(db_index=True, null=True, blank=True)
    warehouse_name = models.CharField(max_length=200, blank=True, null=True)
    
    # Estado actual
    current_stock = models.IntegerField(default=0)
    min_stock_level = models.IntegerField(default=0)
    
    # Análisis de demanda
    average_daily_demand = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        default=Decimal('0.00')
    )
    predicted_demand_7days = models.IntegerField(
        default=0,
        help_text="Demanda predicha para los próximos 7 días"
    )
    predicted_demand_30days = models.IntegerField(
        default=0,
        help_text="Demanda predicha para los próximos 30 días"
    )
    
    # Recomendaciones
    recommended_order_quantity = models.IntegerField(
        default=0,
        help_text="Cantidad recomendada a ordenar"
    )
    reorder_priority = models.CharField(
        max_length=20,
        choices=[
            ('urgent', 'Urgente'),
            ('high', 'Alta'),
            ('medium', 'Media'),
            ('low', 'Baja'),
        ],
        default='medium'
    )
    safety_stock = models.IntegerField(
        default=0,
        help_text="Stock de seguridad recomendado"
    )
    reorder_point = models.IntegerField(
        default=0,
        help_text="Punto de reorden (cuando ordenar)"
    )
    
    # Fechas
    stockout_date_estimate = models.DateField(
        null=True, 
        blank=True,
        help_text="Fecha estimada de agotamiento"
    )
    recommended_order_date = models.DateField(
        null=True, 
        blank=True,
        help_text="Fecha recomendada para hacer el pedido"
    )
    
    # Estado
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pendiente'),
            ('reviewed', 'Revisada'),
            ('ordered', 'Ordenada'),
            ('dismissed', 'Descartada'),
        ],
        default='pending'
    )
    
    # Metadatos
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'analytics_stock_reorder_recommendation'
        verbose_name = 'Recomendación de Reorden'
        verbose_name_plural = 'Recomendaciones de Reorden'
        ordering = ['-reorder_priority', 'stockout_date_estimate']
        indexes = [
            # Índices compuestos optimizados
            models.Index(fields=['product_id', 'warehouse_id', '-created_at'], name='idx_prod_wh_created'),
            models.Index(fields=['reorder_priority', '-created_at'], name='idx_priority_created'),
            models.Index(fields=['status', '-created_at'], name='idx_status_created'),
            models.Index(fields=['stockout_date_estimate'], name='idx_stockout_date'),
            models.Index(fields=['-created_at'], name='idx_created_at'),
        ]
        constraints = [
            # Evitar recomendaciones duplicadas por día
            models.UniqueConstraint(
                fields=['product_id', 'warehouse_id', 'created_at'],
                name='unique_recommendation_per_day'
            )
        ]
    
    def __str__(self):
        warehouse = self.warehouse_name or "Sin bodega"
        return f"{self.product_name} - {warehouse} ({self.reorder_priority})"


class ForecastAccuracyHistory(models.Model):
    """
    Historial de precisión de predicciones para evaluar y mejorar modelos.
    Compara predicciones vs valores reales.
    """
    forecast_type = models.CharField(
        max_length=50,
        choices=[
            ('sales', 'Ventas Totales'),
            ('product_demand', 'Demanda de Producto'),
            ('category_sales', 'Ventas por Categoría'),
            ('warehouse_inventory', 'Inventario por Bodega'),
        ],
        db_index=True
    )
    
    # Identificadores opcionales (dependen del tipo)
    product_id = models.IntegerField(null=True, blank=True, db_index=True)
    category_id = models.IntegerField(null=True, blank=True)
    warehouse_id = models.IntegerField(null=True, blank=True)
    
    # Período de la predicción
    forecast_date = models.DateField(
        help_text="Fecha en que se hizo la predicción"
    )
    predicted_date = models.DateField(
        help_text="Fecha para la cual se predijo"
    )
    forecast_horizon_days = models.IntegerField(
        help_text="Días de anticipación (predicted_date - forecast_date)"
    )
    
    # Valores
    predicted_value = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        help_text="Valor predicho"
    )
    actual_value = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Valor real (llenado después)"
    )
    
    # Intervalos de confianza
    confidence_lower = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Límite inferior del intervalo de confianza"
    )
    confidence_upper = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Límite superior del intervalo de confianza"
    )
    
    # Métricas de error (calculadas después)
    absolute_error = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        null=True,
        blank=True,
        help_text="|predicted - actual|"
    )
    percentage_error = models.DecimalField(
        max_digits=8, 
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Error porcentual"
    )
    within_confidence = models.BooleanField(
        null=True,
        blank=True,
        help_text="Si el valor real cayó dentro del intervalo de confianza"
    )
    
    # Metadata del modelo
    model_name = models.CharField(max_length=50, default='Prophet')
    model_version = models.CharField(max_length=50, blank=True, null=True)
    model_params = models.JSONField(
        default=dict,
        blank=True,
        help_text="Parámetros usados en el modelo"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'analytics_forecast_accuracy_history'
        verbose_name = 'Historial de Precisión de Forecast'
        verbose_name_plural = 'Historiales de Precisión de Forecast'
        ordering = ['-forecast_date', '-predicted_date']
        indexes = [
            models.Index(fields=['forecast_type', '-forecast_date']),
            models.Index(fields=['product_id', '-predicted_date']),
            models.Index(fields=['forecast_horizon_days']),
            models.Index(fields=['-created_at']),
        ]
    
    def calculate_error_metrics(self):
        """Calcula métricas de error cuando actual_value está disponible."""
        if self.actual_value is not None and self.predicted_value is not None:
            self.absolute_error = abs(self.predicted_value - self.actual_value)
            
            if self.actual_value != 0:
                self.percentage_error = (
                    (self.predicted_value - self.actual_value) / self.actual_value * 100
                )
            
            if self.confidence_lower is not None and self.confidence_upper is not None:
                self.within_confidence = (
                    self.confidence_lower <= self.actual_value <= self.confidence_upper
                )
    
    def save(self, *args, **kwargs):
        # Auto-calcular horizon si no está set
        if not self.forecast_horizon_days and self.forecast_date and self.predicted_date:
            self.forecast_horizon_days = (self.predicted_date - self.forecast_date).days
        
        # Calcular métricas si hay valor actual
        if self.actual_value is not None:
            self.calculate_error_metrics()
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        status = "✓" if self.actual_value is not None else "⏳"
        return f"{status} {self.forecast_type} - {self.predicted_date} (h={self.forecast_horizon_days}d)"


class TaskRun(models.Model):
    """
    Registro de ejecuciones de tareas Celery para monitoreo.
    """
    run_id = models.CharField(max_length=100, db_index=True)
    task_name = models.CharField(max_length=200, db_index=True)
    status = models.CharField(max_length=20, default='running', db_index=True)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.IntegerField(default=0)
    details = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'analytics_task_run'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['task_name', '-started_at']),
            models.Index(fields=['status', '-started_at']),
        ]

    def mark_finished(self, status: str = 'success', details: dict | None = None, error: str | None = None):
        from django.utils import timezone as _tz
        self.status = status
        self.finished_at = _tz.now()
        if self.started_at and self.finished_at:
            self.duration_ms = int((self.finished_at - self.started_at).total_seconds() * 1000)
        if details:
            try:
                self.details.update(details)
            except Exception:
                self.details = details or {}
        if error:
            self.error = error
        self.save()
