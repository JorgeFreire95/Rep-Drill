"""
Servicio para cálculo de métricas de analytics.
Contiene la lógica de negocio para calcular y agregar métricas desde los microservicios.
"""
import requests
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Dict, List, Optional
from django.conf import settings
from django.db.models import Sum, Avg, Count, Q
from .models import (
    DailySalesMetrics,
    ProductDemandMetrics,
    InventoryTurnoverMetrics,
    CategoryPerformanceMetrics,
    StockReorderRecommendation
)


class MicroserviceClient:
    """Cliente para comunicarse con otros microservicios."""
    
    @staticmethod
    def get_ventas_data(endpoint: str, params: Dict = None) -> Optional[Dict]:
        """Obtiene datos del servicio de ventas."""
        try:
            # Los endpoints de ventas están bajo /api/ventas/
            url = f"{settings.VENTAS_SERVICE_URL}/api/ventas/{endpoint}"
            # Reducir payload: permitir límites chicos y timeouts moderados
            response = requests.get(url, params=params, timeout=8)
            response.raise_for_status()
            data = response.json()
            # Normalizar respuesta: si es lista, convertir a dict con 'results'
            if isinstance(data, list):
                return {'results': data, 'count': len(data)}
            return data
        except requests.exceptions.RequestException as e:
            print(f"Error al obtener datos de ventas: {e}")
            return None
    
    @staticmethod
    def get_inventario_data(endpoint: str, params: Dict = None) -> Optional[Dict]:
        """Obtiene datos del servicio de inventario."""
        try:
            # Los endpoints de inventario están directamente bajo /api/
            url = f"{settings.INVENTARIO_SERVICE_URL}/api/{endpoint}"
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            # Normalizar respuesta: si es lista, convertir a dict con 'results'
            if isinstance(data, list):
                return {'results': data, 'count': len(data)}
            return data
        except requests.exceptions.RequestException as e:
            print(f"Error al obtener datos de inventario: {e}")
            return None


class MetricsCalculator:
    """Calculador de métricas de analytics."""
    
    def __init__(self):
        self.client = MicroserviceClient()
    
    def calculate_daily_sales_metrics(self, target_date: date = None) -> Optional[DailySalesMetrics]:
        """
        Calcula métricas de ventas para un día específico.
        
        Args:
            target_date: Fecha objetivo (por defecto ayer)
        
        Returns:
            DailySalesMetrics creado o actualizado
        """
        if target_date is None:
            target_date = date.today() - timedelta(days=1)
        
        # Obtener órdenes completadas del día, pidiendo poco volumen
        target_date_str = target_date.isoformat()
        params = {
            'status': 'COMPLETED',
            'date_from': target_date_str,
            'date_to': target_date_str,
            'limit': 500,
            'ordering': 'order_date'
        }
        ventas_data = self.client.get_ventas_data('orders', params)
        if not ventas_data:
            print(f"No se pudieron obtener datos de ventas para {target_date}")
            return None
        orders = ventas_data.get('results', [])
        
        total_sales = Decimal('0.00')
        total_orders = len(orders)
        products_sold = 0
        unique_products = set()
        unique_customers = set()
        
        for order in orders:
            # Total de ventas (campo 'total' en la respuesta)
            total_sales += Decimal(str(order.get('total', 0)))
            
            # Cliente único (campo 'customer_id' en la respuesta)
            if order.get('customer_id'):
                unique_customers.add(order['customer_id'])
            
            # Items de la orden (campo 'details_read' en la respuesta)
            items = order.get('details_read', [])
            for item in items:
                products_sold += item.get('quantity', 0)
                if item.get('product_id'):
                    unique_products.add(item['product_id'])
        
        # Calcular promedio
        average_order_value = total_sales / total_orders if total_orders > 0 else Decimal('0.00')
        
        # Crear o actualizar métrica
        metrics, created = DailySalesMetrics.objects.update_or_create(
            date=target_date,
            defaults={
                'total_sales': total_sales,
                'total_orders': total_orders,
                'average_order_value': average_order_value,
                'products_sold': products_sold,
                'unique_products': len(unique_products),
                'unique_customers': len(unique_customers),
            }
        )
        
        action = "creada" if created else "actualizada"
        print(f"Métrica diaria {action} para {target_date}: ${total_sales} en {total_orders} órdenes")
        
        return metrics
    
    def calculate_product_demand_metrics(self, period_days: int = 30) -> List[ProductDemandMetrics]:
        """
        Calcula métricas de demanda para todos los productos.
        
        Args:
            period_days: Número de días a analizar
        
        Returns:
            Lista de métricas creadas
        """
        period_end = date.today()
        period_start = period_end - timedelta(days=period_days)
        
        # Obtener órdenes completadas del período en ventanas pequeñas (7 días)
        orders = []
        chunk = 7
        start = period_start
        while start <= period_end:
            end = min(start + timedelta(days=chunk-1), period_end)
            params = {
                'status': 'COMPLETED',
                'date_from': start.isoformat(),
                'date_to': end.isoformat(),
                'limit': 800,
                'ordering': 'order_date'
            }
            ventas_data = self.client.get_ventas_data('orders', params)
            if ventas_data and ventas_data.get('results'):
                orders.extend(ventas_data['results'])
            start = end + timedelta(days=1)
        
        # Agregar datos por producto
        product_data = {}
        daily_demand = {}  # {product_id: {date: quantity}}
        
        for order in orders:
            order_date = order.get('order_date', '')[:10]  # YYYY-MM-DD
            
            for item in order.get('details_read', []):
                product_id = item.get('product_id')
                if not product_id:
                    continue
                
                quantity = item.get('quantity', 0)
                price = Decimal(str(item.get('unit_price', 0)))
                revenue = quantity * price
                
                # Inicializar datos del producto
                if product_id not in product_data:
                    product_data[product_id] = {
                        'product_name': f'Producto {product_id}',  # Se obtiene del servicio de inventario después
                        'product_sku': '',
                        'total_quantity_sold': 0,
                        'total_orders': set(),
                        'total_revenue': Decimal('0.00'),
                        'prices': [],
                    }
                    daily_demand[product_id] = {}
                
                # Acumular datos
                product_data[product_id]['total_quantity_sold'] += quantity
                product_data[product_id]['total_orders'].add(order.get('id'))
                product_data[product_id]['total_revenue'] += revenue
                product_data[product_id]['prices'].append(price)
                
                # Demanda diaria
                if order_date not in daily_demand[product_id]:
                    daily_demand[product_id][order_date] = 0
                daily_demand[product_id][order_date] += quantity
        
        # Obtener información adicional de productos desde inventario
        inventario_data = self.client.get_inventario_data('products')
        if inventario_data:
            productos_map = {}
            for producto in inventario_data.get('results', []):
                productos_map[producto['id']] = {
                    'name': producto.get('name', ''),
                    'sku': producto.get('sku', ''),
                }
            
            # Actualizar nombres y SKUs
            for product_id in product_data.keys():
                if product_id in productos_map:
                    product_data[product_id]['product_name'] = productos_map[product_id]['name']
                    product_data[product_id]['product_sku'] = productos_map[product_id]['sku']
        
        # Crear métricas para cada producto
        metrics_list = []
        
        for product_id, data in product_data.items():
            # Calcular estadísticas de demanda diaria
            daily_quantities = list(daily_demand[product_id].values())
            max_daily = max(daily_quantities) if daily_quantities else 0
            min_daily = min(daily_quantities) if daily_quantities else 0
            average_daily = Decimal(str(data['total_quantity_sold'])) / period_days
            
            # Calcular precio promedio
            prices = data['prices']
            average_price = sum(prices) / len(prices) if prices else Decimal('0.00')
            
            # Calcular tendencia (comparar primera vs segunda mitad del período)
            mid_point = period_days // 2
            mid_date = period_start + timedelta(days=mid_point)
            mid_date_str = mid_date.isoformat()
            
            first_half_qty = sum(
                qty for date_str, qty in daily_demand[product_id].items()
                if date_str < mid_date_str
            )
            second_half_qty = sum(
                qty for date_str, qty in daily_demand[product_id].items()
                if date_str >= mid_date_str
            )
            
            if first_half_qty > 0:
                trend_pct = ((second_half_qty - first_half_qty) / first_half_qty) * 100
                if trend_pct > 10:
                    trend = 'increasing'
                elif trend_pct < -10:
                    trend = 'decreasing'
                else:
                    trend = 'stable'
            else:
                trend = 'stable'
                trend_pct = 0
            
            # Crear o actualizar métrica
            metrics, created = ProductDemandMetrics.objects.update_or_create(
                product_id=product_id,
                period_start=period_start,
                period_end=period_end,
                defaults={
                    'product_name': data['product_name'],
                    'product_sku': data['product_sku'],
                    'period_days': period_days,
                    'total_quantity_sold': data['total_quantity_sold'],
                    'total_orders': len(data['total_orders']),
                    'average_daily_demand': average_daily,
                    'max_daily_demand': max_daily,
                    'min_daily_demand': min_daily,
                    'total_revenue': data['total_revenue'],
                    'average_price': average_price,
                    'trend': trend,
                    'trend_percentage': Decimal(str(trend_pct)),
                }
            )
            
            metrics_list.append(metrics)
        
        print(f"Calculadas métricas de demanda para {len(metrics_list)} productos")
        return metrics_list
    
    def calculate_inventory_turnover_metrics(self, period_days: int = 30) -> List[InventoryTurnoverMetrics]:
        """
        Calcula métricas de rotación de inventario.
        
        Args:
            period_days: Número de días a analizar
        
        Returns:
            Lista de métricas creadas
        """
        period_end = date.today()
        period_start = period_end - timedelta(days=period_days)
        
        # Obtener datos de inventario actual
        inventario_data = self.client.get_inventario_data('products')
        if not inventario_data:
            print("No se pudieron obtener datos de inventario")
            return []
        
        productos = inventario_data.get('results', [])
        
        # Obtener datos de demanda del período
        demand_metrics = ProductDemandMetrics.objects.filter(
            period_start=period_start,
            period_end=period_end
        )
        
        demand_map = {dm.product_id: dm for dm in demand_metrics}
        
        metrics_list = []
        
        for producto in productos:
            product_id = producto.get('id')
            demand = demand_map.get(product_id)
            
            if not demand:
                continue  # No hay datos de demanda para este producto
            
            # Datos de inventario
            current_stock = producto.get('quantity', 0)
            # Asumir inventario inicial = inventario actual + unidades vendidas
            starting_inventory = current_stock + demand.total_quantity_sold
            average_inventory = (starting_inventory + current_stock) / 2 if (starting_inventory + current_stock) > 0 else 0
            
            # Calcular tasa de rotación
            if average_inventory > 0:
                turnover_rate = Decimal(str(demand.total_quantity_sold)) / Decimal(str(average_inventory))
                days_of_inventory = Decimal(str(period_days)) / turnover_rate if turnover_rate > 0 else Decimal('999.99')
            else:
                turnover_rate = Decimal('0.00')
                days_of_inventory = Decimal('999.99')
            
            # Clasificar producto
            if turnover_rate >= 4:
                classification = 'fast_moving'
            elif turnover_rate >= 2:
                classification = 'medium_moving'
            elif turnover_rate >= 0.5:
                classification = 'slow_moving'
            else:
                classification = 'obsolete'
            
            # Evaluar riesgos
            min_stock = producto.get('min_stock', 0)
            
            # Riesgo de agotamiento
            if demand.average_daily_demand > 0:
                days_remaining = current_stock / float(demand.average_daily_demand)
                if days_remaining < 7:
                    stockout_risk = 'high'
                elif days_remaining < 14:
                    stockout_risk = 'medium'
                else:
                    stockout_risk = 'low'
            else:
                stockout_risk = 'low'
            
            # Riesgo de sobrestockeo
            if days_of_inventory > 90:
                overstock_risk = 'high'
            elif days_of_inventory > 60:
                overstock_risk = 'medium'
            else:
                overstock_risk = 'low'
            
            # Crear o actualizar métrica
            metrics, created = InventoryTurnoverMetrics.objects.update_or_create(
                product_id=product_id,
                warehouse_id=producto.get('warehouse'),
                period_start=period_start,
                period_end=period_end,
                defaults={
                    'product_name': producto.get('name', f'Producto {product_id}'),
                    'warehouse_name': producto.get('warehouse_name', ''),
                    'period_days': period_days,
                    'average_inventory': Decimal(str(average_inventory)),
                    'starting_inventory': starting_inventory,
                    'ending_inventory': current_stock,
                    'units_sold': demand.total_quantity_sold,
                    'cost_of_goods_sold': demand.total_revenue,  # Simplificación
                    'turnover_rate': turnover_rate,
                    'days_of_inventory': days_of_inventory,
                    'classification': classification,
                    'stockout_risk': stockout_risk,
                    'overstock_risk': overstock_risk,
                }
            )
            
            metrics_list.append(metrics)
        
        print(f"Calculadas métricas de rotación para {len(metrics_list)} productos")
        return metrics_list
    
    def generate_reorder_recommendations(self) -> List[StockReorderRecommendation]:
        """
        Genera recomendaciones de reorden basadas en métricas actuales.
        
        Returns:
            Lista de recomendaciones creadas
        """
        # Obtener métricas de rotación recientes
        thirty_days_ago = date.today() - timedelta(days=30)
        
        turnover_metrics = InventoryTurnoverMetrics.objects.filter(
            period_end__gte=thirty_days_ago,
            stockout_risk__in=['high', 'medium']
        ).order_by('-calculated_at')
        
        # Obtener métricas de demanda recientes
        demand_metrics = ProductDemandMetrics.objects.filter(
            period_end__gte=thirty_days_ago
        ).order_by('-calculated_at')
        
        demand_map = {dm.product_id: dm for dm in demand_metrics}
        
        recommendations = []
        
        for turnover in turnover_metrics:
            demand = demand_map.get(turnover.product_id)
            if not demand:
                continue
            
            # Calcular demandas predichas (simple)
            daily_demand = float(demand.average_daily_demand)
            predicted_7days = int(daily_demand * 7)
            predicted_30days = int(daily_demand * 30)
            
            # Calcular stock de seguridad (2 semanas de demanda)
            safety_stock = int(daily_demand * 14)
            
            # Punto de reorden (demanda durante lead time + safety stock)
            # Asumir lead time de 7 días
            lead_time_demand = int(daily_demand * 7)
            reorder_point = lead_time_demand + safety_stock
            
            # Cantidad recomendada (1 mes de demanda + safety stock - stock actual)
            current_stock = turnover.ending_inventory
            recommended_quantity = max(0, predicted_30days + safety_stock - current_stock)
            
            # Prioridad
            if turnover.stockout_risk == 'high':
                if current_stock < reorder_point:
                    priority = 'urgent'
                else:
                    priority = 'high'
            else:
                if current_stock < reorder_point:
                    priority = 'high'
                else:
                    priority = 'medium'
            
            # Fecha estimada de agotamiento
            if daily_demand > 0 and current_stock > 0:
                days_until_stockout = int(current_stock / daily_demand)
                stockout_date = date.today() + timedelta(days=days_until_stockout)
            else:
                stockout_date = None
            
            # Fecha recomendada para ordenar
            if stockout_date:
                # Ordenar con 7 días de antelación (lead time)
                recommended_order_date = stockout_date - timedelta(days=7)
            else:
                recommended_order_date = None
            
            # Solo crear recomendación si hay cantidad a ordenar
            if recommended_quantity > 0:
                # Obtener min_stock desde inventario si está disponible
                min_stock_level = 0
                inventario_data = self.client.get_inventario_data(f'products/{turnover.product_id}')
                if inventario_data and not isinstance(inventario_data.get('results'), list):
                    min_stock_level = inventario_data.get('min_stock', 0)
                
                recommendation, created = StockReorderRecommendation.objects.update_or_create(
                    product_id=turnover.product_id,
                    warehouse_id=turnover.warehouse_id,
                    defaults={
                        'product_name': turnover.product_name,
                        'product_sku': demand.product_sku,
                        'warehouse_name': turnover.warehouse_name,
                        'current_stock': current_stock,
                        'min_stock_level': min_stock_level,
                        'average_daily_demand': demand.average_daily_demand,
                        'predicted_demand_7days': predicted_7days,
                        'predicted_demand_30days': predicted_30days,
                        'recommended_order_quantity': recommended_quantity,
                        'reorder_priority': priority,
                        'safety_stock': safety_stock,
                        'reorder_point': reorder_point,
                        'stockout_date_estimate': stockout_date,
                        'recommended_order_date': recommended_order_date,
                        'status': 'pending',
                    }
                )
                
                recommendations.append(recommendation)
        
        print(f"Generadas {len(recommendations)} recomendaciones de reorden")
        return recommendations
