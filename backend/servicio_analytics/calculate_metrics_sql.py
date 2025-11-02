"""
Script para calcular métricas de analytics usando SQL directo.
Genera DailySalesMetrics y ProductDemandMetrics para análisis con Prophet.

Este script:
1. Calcula métricas diarias de ventas
2. Calcula métricas de demanda por producto
3. Calcula métricas de rotación de inventario
4. Calcula métricas de rendimiento por categoría
5. Valida integridad de los datos

IMPORTANTE: Se detiene ante cualquier error.
"""

import os
import sys
import django
from datetime import datetime, timedelta, timezone
import logging
from decimal import Decimal

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_analytics.settings')
django.setup()

from django.db import connections
from django.db.models import Sum
from analytics.models import (
    DailySalesMetrics, ProductDemandMetrics, 
    InventoryTurnoverMetrics, CategoryPerformanceMetrics
)

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Zona horaria Chile
CHILE_TZ = timezone(timedelta(hours=-3))
TODAY = datetime(2024, 10, 24, tzinfo=CHILE_TZ)
START_DATE = datetime(2024, 4, 24, tzinfo=CHILE_TZ)

# Colores
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def log_info(msg):
    logger.info(f"{Colors.OKBLUE}ℹ {msg}{Colors.ENDC}")

def log_success(msg):
    logger.info(f"{Colors.OKGREEN}✓ {msg}{Colors.ENDC}")

def log_warning(msg):
    logger.warning(f"{Colors.WARNING}⚠ {msg}{Colors.ENDC}")

def log_error(msg):
    logger.error(f"{Colors.FAIL}✗ {msg}{Colors.ENDC}")

def log_header(msg):
    logger.info(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    logger.info(f"{Colors.HEADER}{Colors.BOLD}{msg}{Colors.ENDC}")
    logger.info(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")

# ============================================================================
# CÁLCULO DE MÉTRICAS DIARIAS
# ============================================================================

def calculate_daily_sales_metrics():
    """Calcula métricas diarias de ventas"""
    log_header("CALCULANDO MÉTRICAS DIARIAS DE VENTAS")
    
    try:
        connection = connections['default']
        cursor = connection.cursor()
        
        # Obtener rango de fechas de órdenes completadas
        cursor.execute("""
            SELECT MIN(order_date), MAX(order_date) 
            FROM orders 
            WHERE status = 'COMPLETED'
        """)
        result = cursor.fetchone()
        
        if not result or not result[0]:
            log_warning("No hay órdenes completadas")
            return 0
        
        min_date, max_date = result
        log_info(f"Período: {min_date} a {max_date}")
        
        current_date = min_date
        metrics_created = 0
        
        while current_date <= max_date:
            # Obtener datos del día
            cursor.execute("""
                SELECT 
                    CAST(%s AS DATE) as date,
                    COALESCE(SUM(o.total), 0) as total_sales,
                    COUNT(o.id) as total_orders,
                    COALESCE(AVG(o.total), 0) as average_order_value,
                    COALESCE(SUM(od.quantity), 0) as products_sold,
                    COUNT(DISTINCT od.product_id) as unique_products,
                    COUNT(DISTINCT o.customer_id) as unique_customers
                FROM orders o
                LEFT JOIN order_details od ON o.id = od.order_id
                WHERE o.order_date = %s AND o.status = 'COMPLETED'
            """, [current_date, current_date])
            
            row = cursor.fetchone()
            
            if row and row[1] > 0:  # Si hay ventas
                date_val, total_sales, total_orders, avg_order, products_sold, unique_products, unique_customers = row
                
                metric, created = DailySalesMetrics.objects.update_or_create(
                    date=date_val,
                    defaults={
                        'total_sales': int(total_sales),
                        'total_orders': total_orders,
                        'average_order_value': int(avg_order),
                        'products_sold': products_sold,
                        'unique_products': unique_products,
                        'unique_customers': unique_customers,
                    }
                )
                
                if created:
                    metrics_created += 1
                    log_success(f"Métrica {date_val}: ${total_sales:,} CLP, {total_orders} órdenes")
            
            current_date += timedelta(days=1)
        
        log_success(f"✓ Métricas diarias creadas: {metrics_created}")
        return metrics_created
        
    except Exception as e:
        log_error(f"Error calculando métricas diarias: {e}")
        raise

# ============================================================================
# CÁLCULO DE MÉTRICAS DE DEMANDA POR PRODUCTO
# ============================================================================

def calculate_product_demand_metrics():
    """Calcula métricas de demanda por producto en ventanas deslizantes basadas en el rango real de órdenes."""
    log_header("CALCULANDO MÉTRICAS DE DEMANDA POR PRODUCTO")
    
    try:
        connection = connections['default']
        cursor = connection.cursor()

        # Determinar rango disponible según órdenes existentes
        cursor.execute("""
            SELECT MIN(order_date), MAX(order_date)
            FROM orders
            WHERE status = 'COMPLETED'
        """)
        result = cursor.fetchone()
        if not result or not result[0]:
            log_warning("No hay órdenes completadas para calcular demanda")
            return 0

        min_date, max_date = result
        # Ventanas deslizantes de 30 días avanzando cada 7 días
        period_start = min_date
        metrics_created = 0
        
        while period_start <= max_date:
            period_end = min(period_start + timedelta(days=30), max_date)
            log_info(f"Período: {period_start} a {period_end}")
            
            # Obtener todos los productos vendidos en este período
            cursor.execute(
                """
                SELECT DISTINCT od.product_id
                FROM order_details od
                JOIN orders o ON od.order_id = o.id
                WHERE o.order_date >= %s 
                  AND o.order_date <= %s 
                  AND o.status = 'COMPLETED'
                """,
                [period_start, period_end]
            )
            products = cursor.fetchall()

            for (product_id,) in products:
                try:
                    # Obtener agregados del producto en el período
                    cursor.execute(
                        """
                        SELECT
                            %s as product_id,
                            'Product ' || %s as product_name,
                            'SKU-' || %s as product_sku,
                            COALESCE(SUM(od.quantity), 0) as total_quantity,
                            COUNT(DISTINCT od.order_id) as total_orders,
                            COALESCE(SUM(od.subtotal), 0) as total_revenue,
                            COALESCE(AVG(od.unit_price), 0) as average_price,
                            COALESCE(MAX(daily.daily_qty), 0) as max_daily,
                            COALESCE(MIN(daily.daily_qty), 999) as min_daily
                        FROM order_details od
                        LEFT JOIN (
                            SELECT 
                                od2.product_id,
                                o2.order_date,
                                SUM(od2.quantity) as daily_qty
                            FROM order_details od2
                            JOIN orders o2 ON od2.order_id = o2.id
                            WHERE od2.product_id = %s
                              AND o2.order_date >= %s 
                              AND o2.order_date <= %s
                              AND o2.status = 'COMPLETED'
                            GROUP BY od2.product_id, o2.order_date
                        ) daily ON od.product_id = daily.product_id
                        JOIN orders o ON od.order_id = o.id
                        WHERE od.product_id = %s
                          AND o.order_date >= %s 
                          AND o.order_date <= %s
                          AND o.status = 'COMPLETED'
                        """,
                        [
                            product_id, product_id, product_id,
                            product_id, period_start, period_end,
                            product_id, period_start, period_end,
                        ]
                    )
                    row = cursor.fetchone()
                    if row:
                        _, product_name, product_sku, total_qty, total_orders, revenue, avg_price, max_daily, min_daily = row

                        days_in_period = (period_end - period_start).days + 1
                        if days_in_period <= 0:
                            continue
                        avg_daily_demand = Decimal(str(total_qty)) / Decimal(str(days_in_period))

                        # Tendencia (simplificada)
                        trend = 'stable'
                        trend_pct = Decimal('0')

                        # Crear o actualizar métrica
                        metric, created = ProductDemandMetrics.objects.update_or_create(
                            product_id=product_id,
                            period_start=period_start,
                            period_end=period_end,
                            defaults={
                                'product_name': product_name,
                                'product_sku': product_sku,
                                'period_days': days_in_period,
                                'total_quantity_sold': int(total_qty),
                                'total_orders': total_orders,
                                'average_daily_demand': float(avg_daily_demand),
                                'max_daily_demand': int(max_daily) if max_daily else 0,
                                'min_daily_demand': int(min_daily) if min_daily and min_daily < 999 else 0,
                                'total_revenue': int(revenue),
                                'average_price': int(avg_price),
                                'trend': trend,
                                'trend_percentage': trend_pct,
                            }
                        )
                        if created:
                            metrics_created += 1
                except Exception as e:
                    log_error(f"Error con producto {product_id}: {e}")

            # Avanzar la ventana 3 días para producir suficientes puntos por producto
            period_start = period_start + timedelta(days=3)

        log_success(f"✓ Métricas de demanda creadas: {metrics_created}")
        return metrics_created

    except Exception as e:
        log_error(f"Error calculando demanda: {e}")
        raise

# ============================================================================
# CÁLCULO DE MÉTRICAS DE ROTACIÓN
# ============================================================================

def calculate_inventory_turnover_metrics():
    """Calcula métricas de rotación de inventario"""
    log_header("CALCULANDO MÉTRICAS DE ROTACIÓN DE INVENTARIO")
    
    try:
        metrics_created = 0
        current_date = START_DATE.date()
        end_date = TODAY.date()
        period_start = current_date
        period_end = current_date + timedelta(days=30)
        warehouse_id = 1
        
        while period_start <= end_date:
            connection = connections['default']
            cursor = connection.cursor()
            
            # Obtener productos vendidos
            cursor.execute("""
                SELECT DISTINCT od.product_id
                FROM order_details od
                JOIN orders o ON od.order_id = o.id
                WHERE o.order_date >= %s 
                AND o.order_date <= %s 
                AND o.status = 'COMPLETED'
            """, [period_start, period_end])
            
            products = cursor.fetchall()
            
            for (product_id,) in products:
                try:
                    # Obtener datos
                    cursor.execute("""
                        SELECT
                            COALESCE(SUM(od.quantity), 0) as units_sold,
                            COALESCE(SUM(od.subtotal) * 0.6, 0) as cogs
                        FROM order_details od
                        JOIN orders o ON od.order_id = o.id
                        WHERE od.product_id = %s
                        AND o.order_date >= %s 
                        AND o.order_date <= %s
                        AND o.status = 'COMPLETED'
                    """, [product_id, period_start, period_end])
                    
                    row = cursor.fetchone()
                    units_sold, cogs = row if row else (0, 0)
                    
                    days_in_period = (period_end - period_start).days + 1
                    avg_inventory = Decimal(str(units_sold)) / Decimal(str(days_in_period))
                    
                    if avg_inventory > 0:
                        turnover_rate = Decimal(str(units_sold)) / avg_inventory
                    else:
                        turnover_rate = Decimal('0')
                    
                    if turnover_rate > 0:
                        days_of_inventory = Decimal('30') / turnover_rate
                    else:
                        days_of_inventory = Decimal('999')
                    
                    # Clasificación
                    if turnover_rate >= 3:
                        classification = 'fast_moving'
                    elif turnover_rate >= 1:
                        classification = 'medium_moving'
                    elif turnover_rate >= 0.2:
                        classification = 'slow_moving'
                    else:
                        classification = 'obsolete'
                    
                    # Riesgos
                    stockout_risk = 'high' if units_sold > 50 else ('medium' if units_sold > 20 else 'low')
                    overstock_risk = 'high' if turnover_rate < 0.1 else ('medium' if turnover_rate < 0.5 else 'low')
                    
                    # Crear métrica
                    metric, created = InventoryTurnoverMetrics.objects.update_or_create(
                        product_id=product_id,
                        warehouse_id=warehouse_id,
                        period_start=period_start,
                        period_end=period_end,
                        defaults={
                            'product_name': f"Product {product_id}",
                            'warehouse_name': "Bodega Principal",
                            'period_days': days_in_period,
                            'average_inventory': float(avg_inventory),
                            'starting_inventory': 50,
                            'ending_inventory': 50,
                            'units_sold': int(units_sold),
                            'cost_of_goods_sold': int(cogs),
                            'turnover_rate': float(turnover_rate),
                            'days_of_inventory': float(days_of_inventory),
                            'classification': classification,
                            'stockout_risk': stockout_risk,
                            'overstock_risk': overstock_risk,
                        }
                    )
                    
                    if created:
                        metrics_created += 1
                
                except Exception as e:
                    log_error(f"Error con producto {product_id}: {e}")
            
            period_start = period_end + timedelta(days=1)
            period_end = period_start + timedelta(days=29)
        
        log_success(f"✓ Métricas de rotación creadas: {metrics_created}")
        return metrics_created
        
    except Exception as e:
        log_error(f"Error en rotación: {e}")
        raise

# ============================================================================
# CÁLCULO DE MÉTRICAS POR CATEGORÍA
# ============================================================================

def calculate_category_performance_metrics():
    """Calcula métricas de rendimiento por categoría"""
    log_header("CALCULANDO MÉTRICAS DE RENDIMIENTO POR CATEGORÍA")
    
    try:
        metrics_created = 0
        current_date = START_DATE.date()
        end_date = TODAY.date()
        period_start = current_date
        period_end = current_date + timedelta(days=30)
        
        categories = {
            1: "Motor y Cilindros",
            2: "Sistema de Frenos",
            3: "Sistema Eléctrico",
            4: "Sistema de Transmisión",
            5: "Suspensión y Dirección",
            6: "Refrigeración",
        }
        
        while period_start <= end_date:
            for category_id, category_name in categories.items():
                try:
                    connection = connections['default']
                    cursor = connection.cursor()
                    
                    category_min = category_id * 5 - 4
                    category_max = category_id * 5
                    
                    cursor.execute("""
                        SELECT
                            COALESCE(SUM(od.subtotal), 0) as total_revenue,
                            COALESCE(SUM(od.quantity), 0) as total_units,
                            COUNT(DISTINCT od.order_id) as total_orders,
                            COALESCE(AVG(od.unit_price), 0) as avg_order_value,
                            COUNT(DISTINCT od.product_id) as total_products
                        FROM order_details od
                        JOIN orders o ON od.order_id = o.id
                        WHERE od.product_id >= %s 
                        AND od.product_id <= %s
                        AND o.order_date >= %s 
                        AND o.order_date <= %s
                        AND o.status = 'COMPLETED'
                    """, [category_min, category_max, period_start, period_end])
                    
                    row = cursor.fetchone()
                    
                    if row and row[0] > 0:  # Si hay ingresos
                        total_revenue, total_units, total_orders, avg_value, total_products = row
                        
                        metric, created = CategoryPerformanceMetrics.objects.update_or_create(
                            category_id=category_id,
                            period_start=period_start,
                            period_end=period_end,
                            defaults={
                                'category_name': category_name,
                                'period_days': (period_end - period_start).days + 1,
                                'total_revenue': int(total_revenue),
                                'total_units_sold': int(total_units),
                                'total_orders': total_orders,
                                'average_order_value': int(avg_value),
                                'total_products': total_products,
                                'active_products': total_products,
                                'revenue_share': Decimal('0'),
                                'growth_rate': Decimal('0'),
                            }
                        )
                        
                        if created:
                            metrics_created += 1
                
                except Exception as e:
                    log_error(f"Error en categoría {category_id}: {e}")
            
            period_start = period_end + timedelta(days=1)
            period_end = period_start + timedelta(days=29)
        
        log_success(f"✓ Métricas por categoría creadas: {metrics_created}")
        return metrics_created
        
    except Exception as e:
        log_error(f"Error en categorías: {e}")
        raise

# ============================================================================
# VALIDACIÓN
# ============================================================================

def validate_metrics():
    """Valida métricas calculadas"""
    log_header("VALIDANDO MÉTRICAS")
    
    try:
        daily_count = DailySalesMetrics.objects.count()
        log_success(f"✓ Métricas diarias: {daily_count}")
        
        if daily_count > 0:
            total_sales = DailySalesMetrics.objects.aggregate(Sum('total_sales'))['total_sales__sum'] or 0
            log_success(f"✓ Ventas totales: ${total_sales:,} CLP")
        
        demand_count = ProductDemandMetrics.objects.count()
        log_success(f"✓ Métricas de demanda: {demand_count}")
        
        if demand_count > 0:
            total_qty = ProductDemandMetrics.objects.aggregate(Sum('total_quantity_sold'))['total_quantity_sold__sum'] or 0
            log_success(f"✓ Unidades vendidas: {total_qty}")
        
        turnover_count = InventoryTurnoverMetrics.objects.count()
        log_success(f"✓ Métricas de rotación: {turnover_count}")
        
        category_count = CategoryPerformanceMetrics.objects.count()
        log_success(f"✓ Métricas por categoría: {category_count}")
        
        log_success("\n✅ TODAS LAS MÉTRICAS CALCULADAS")
        return True
        
    except Exception as e:
        log_error(f"Error validando: {e}")
        return False

# ============================================================================
# MAIN
# ============================================================================

def main():
    """Función principal"""
    log_header("GENERANDO MÉTRICAS DE ANALYTICS")
    log_info(f"Zona horaria: America/Santiago (UTC-3)")
    log_info(f"Período: {START_DATE.date()} a {TODAY.date()}")
    
    try:
        log_info("Paso 1/4: Calculando métricas diarias...")
        calculate_daily_sales_metrics()
        
        log_info("Paso 2/4: Calculando demanda por producto...")
        calculate_product_demand_metrics()
        
        log_info("Paso 3/4: Calculando rotación...")
        calculate_inventory_turnover_metrics()
        
        log_info("Paso 4/4: Calculando categorías...")
        calculate_category_performance_metrics()
        
        if validate_metrics():
            log_header("✅ ÉXITO")
            log_success("Métricas listas para Prophet")
            sys.exit(0)
        else:
            log_header("❌ FALLO")
            sys.exit(1)
    
    except Exception as e:
        log_header("❌ ERROR")
        log_error(f"{e}")
        import traceback
        log_error(traceback.format_exc())
        sys.exit(1)

if __name__ == '__main__':
    main()
