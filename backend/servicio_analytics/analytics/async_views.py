"""
Async Views para Analytics
Mejora la concurrencia usando async/await con Django 4.2+
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from asgiref.sync import sync_to_async
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.core.cache import cache

from .models import ProductDemandMetrics, StockReorderRecommendation
from .forecasting import InventoryRestockAnalyzer

logger = logging.getLogger(__name__)


async def fetch_inventory_async(warehouse_id: Optional[int] = None) -> Dict[int, int]:
    """
    Obtener inventario actual de forma asíncrona.
    
    Args:
        warehouse_id: ID del warehouse (opcional)
        
    Returns:
        Diccionario {product_id: stock_quantity}
    """
    import aiohttp
    import asyncio
    
    inv_url = 'http://inventario:8000/api/inventory/'
    params = {}
    if warehouse_id:
        params['warehouse_id'] = warehouse_id
    
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(inv_url, params=params) as response:
                if response.status == 200:
                    inventory_data = await response.json()
                    
                    # Mapear product_id -> stock
                    stock_map = {}
                    for inv in inventory_data:
                        product_id = inv.get('product_id') or inv.get('product')
                        quantity = inv.get('quantity', 0)
                        if product_id:
                            stock_map[product_id] = stock_map.get(product_id, 0) + quantity
                    
                    logger.info(f"Fetched inventory: {len(stock_map)} products")
                    return stock_map
                else:
                    logger.warning(f"Inventory service returned {response.status}")
                    return {}
    except asyncio.TimeoutError:
        logger.error("Timeout fetching inventory")
        return {}
    except Exception as e:
        logger.error(f"Error fetching inventory: {str(e)}")
        return {}


async def analyze_product_async(
    product: ProductDemandMetrics,
    current_stock: int,
    warehouse_id: Optional[int],
    lead_time_days: int
) -> Dict[str, Any]:
    """
    Analizar un producto de forma asíncrona.
    
    Args:
        product: Objeto ProductDemandMetrics
        current_stock: Stock actual
        warehouse_id: ID del warehouse
        lead_time_days: Días de lead time
        
    Returns:
        Diccionario con resultado del análisis
    """
    try:
        # InventoryRestockAnalyzer es sync, ejecutarlo en thread pool
        def sync_analyze():
            analyzer = InventoryRestockAnalyzer(
                product_id=product.product_id,
                warehouse_id=warehouse_id
            )
            
            result = analyzer.analyze_stockout_risk(
                current_stock=current_stock,
                lead_time_days=lead_time_days
            )
            
            if result['status'] == 'success':
                result['product_name'] = product.product_name
                result['product_sku'] = product.product_sku
            
            return result
        
        # Ejecutar en thread pool para no bloquear event loop
        result = await sync_to_async(sync_analyze)()
        return result
        
    except Exception as e:
        logger.error(f"Error analyzing product {product.product_id}: {str(e)}")
        return {'status': 'error', 'message': str(e)}


@api_view(['POST'])
async def generate_recommendations_async(request):
    """
    POST /api/restock/generate-recommendations-async/
    
    Versión asíncrona de generate_recommendations.
    Procesa múltiples productos en paralelo usando asyncio.
    
    Body:
    {
        "warehouse_id": 1,
        "min_priority": "medium",
        "lead_time_days": 7,
        "max_products": 50
    }
    
    Response:
    {
        "status": "success",
        "recommendations": [...],
        "total": 12,
        "priority_counts": {...},
        "processing_time_ms": 1234
    }
    """
    import time
    start_time = time.time()
    
    try:
        warehouse_id = request.data.get('warehouse_id')
        lead_time_days = int(request.data.get('lead_time_days', 7))
        max_products = int(request.data.get('max_products', 50))
        min_priority = request.data.get('min_priority', 'medium')
        
        # Obtener productos con demanda (sync query)
        @sync_to_async
        def get_products():
            return list(
                ProductDemandMetrics.objects
                .order_by('-period_end', '-average_daily_demand')[:max_products]
            )
        
        recent_products = await get_products()
        
        if not recent_products:
            return Response({
                'status': 'success',
                'recommendations': [],
                'total': 0,
                'message': 'No product demand data available'
            })
        
        # Obtener inventario de forma asíncrona
        stock_map = await fetch_inventory_async(warehouse_id)
        
        # Analizar productos en paralelo
        tasks = []
        for product in recent_products:
            current_stock = stock_map.get(product.product_id, 0)
            task = analyze_product_async(
                product, 
                current_stock, 
                warehouse_id, 
                lead_time_days
            )
            tasks.append(task)
        
        # Ejecutar todas las tareas en paralelo
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Procesar resultados
        recommendations = []
        priority_counts = {'critical': 0, 'urgent': 0, 'high': 0, 'medium': 0, 'low': 0}
        
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Task failed with exception: {result}")
                continue
                
            if result.get('status') == 'success':
                priority = result['priority']
                priority_counts[priority] = priority_counts.get(priority, 0) + 1
                
                # Filtrar por prioridad mínima
                priority_order = ['low', 'medium', 'high', 'urgent', 'critical']
                if priority_order.index(priority) >= priority_order.index(min_priority):
                    recommendations.append({
                        'product_id': result['product_id'],
                        'product_name': result.get('product_name'),
                        'product_sku': result.get('product_sku'),
                        **result
                    })
        
        # Ordenar por prioridad
        def priority_sort_key(rec):
            priority_scores = {'critical': 5, 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1}
            return (
                -priority_scores.get(rec['priority'], 0),
                rec['days_until_stockout'] if rec['days_until_stockout'] else 999
            )
        
        recommendations.sort(key=priority_sort_key)
        
        processing_time = (time.time() - start_time) * 1000  # ms
        
        return Response({
            'status': 'success',
            'recommendations': recommendations,
            'total': len(recommendations),
            'priority_counts': priority_counts,
            'processing_time_ms': round(processing_time, 2),
            'async_enabled': True,
        })
        
    except Exception as e:
        logger.error(f"Error in async generate_recommendations: {str(e)}", exc_info=True)
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
async def forecast_sales_async(request):
    """
    GET /api/forecast/sales-async/?periods=30
    
    Versión asíncrona de sales forecast.
    Mejora la respuesta cuando hay múltiples requests concurrentes.
    """
    import time
    start_time = time.time()
    
    try:
        periods = int(request.GET.get('periods', 30))
        
        # Importar DemandForecast y ejecutar en thread pool
        from .forecasting import DemandForecast
        
        @sync_to_async
        def get_forecast():
            forecaster = DemandForecast()
            forecast_df = forecaster.forecast_demand(periods=periods, use_cache=True)
            
            if forecast_df is None or forecast_df.empty:
                return None
            
            # Convertir a formato JSON serializable
            forecast_data = []
            for _, row in forecast_df.iterrows():
                forecast_data.append({
                    'ds': row['ds'].strftime('%Y-%m-%d'),
                    'yhat': float(row['yhat']),
                    'yhat_lower': float(row['yhat_lower']),
                    'yhat_upper': float(row['yhat_upper']),
                })
            
            return forecast_data
        
        forecast_data = await get_forecast()
        
        if forecast_data is None:
            return Response({
                'status': 'error',
                'message': 'Insufficient data for forecasting'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        processing_time = (time.time() - start_time) * 1000
        
        return Response({
            'status': 'success',
            'forecast': forecast_data,
            'periods': periods,
            'processing_time_ms': round(processing_time, 2),
            'async_enabled': True,
        })
        
    except Exception as e:
        logger.error(f"Error in async forecast: {str(e)}", exc_info=True)
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Función helper para medir performance
async def benchmark_async_vs_sync():
    """
    Comparar performance de versión async vs sync.
    
    Returns:
        Dict con resultados del benchmark
    """
    import time
    
    # Simular 10 productos
    products_count = 10
    
    # Versión async
    start_async = time.time()
    tasks = [asyncio.sleep(0.2) for _ in range(products_count)]  # Simular 200ms por producto
    await asyncio.gather(*tasks)
    time_async = time.time() - start_async
    
    # Versión sync
    start_sync = time.time()
    for _ in range(products_count):
        await asyncio.sleep(0.2)
    time_sync = time.time() - start_sync
    
    speedup = time_sync / time_async if time_async > 0 else 0
    
    return {
        'products_count': products_count,
        'time_async_seconds': round(time_async, 3),
        'time_sync_seconds': round(time_sync, 3),
        'speedup': round(speedup, 2),
        'improvement_percentage': round((1 - time_async/time_sync) * 100, 1)
    }
