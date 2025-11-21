"""
Servicio para construir contexto de forecasting para el chatbot.
"""
import requests
from typing import Dict, List, Any, Optional
from django.core.cache import cache
from django.conf import settings
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class ForecastContextBuilder:
    """
    Construye contexto agregado para el chatbot desde analytics service.
    
    Obtiene:
    - Forecast de ventas totales
    - Componentes de tendencia (trend, weekly, yearly)
    - Métricas de precisión (MAPE, RMSE, MAE)
    - Recomendaciones de restock
    - Top productos por demanda
    """
    
    def __init__(self, analytics_url: str = None):
        self.analytics_url = analytics_url or settings.ANALYTICS_SERVICE_URL
        self.cache_timeout = settings.CHATBOT_CONTEXT_CACHE_TIMEOUT
    
    def get_full_context(
        self, 
        periods: int = 30, 
        product_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """
        Obtiene contexto completo para el chatbot.
        
        Args:
            periods: Días de forecast a obtener
            product_ids: IDs de productos específicos (opcional)
        
        Returns:
            {
                'timestamp': str,
                'periods': int,
                'sales_forecast': {...},
                'components': {...},
                'accuracy_metrics': {...},
                'restock_recommendations': [...],
                'top_products': [...],
                'summary': {...}
            }
        """
        cache_key = f"chat_context_{periods}_{product_ids or 'all'}"
        cached = cache.get(cache_key)
        
        if cached:
            logger.info(f"Cache hit para contexto: {cache_key}")
            return cached
        
        context = {
            'timestamp': datetime.now().isoformat(),
            'periods': periods,
        }
        
        try:
            # 1. Forecast de ventas totales
            context['sales_forecast'] = self._get_sales_forecast(periods)
            
            # 2. Componentes de tendencia
            context['components'] = self._get_forecast_components()
            
            # 3. Métricas de precisión (mock por ahora, implementar endpoint real)
            context['accuracy_metrics'] = self._get_accuracy_metrics()
            
            # 4. Recomendaciones de restock
            context['restock_recommendations'] = self._get_restock_recommendations()
            
            # 5. Top productos
            context['top_products'] = self._get_top_products_forecast(periods)
            
            # 6. Resumen ejecutivo
            context['summary'] = self._build_summary(context)
            
            # Cachear el contexto
            cache.set(cache_key, context, self.cache_timeout)
            logger.info(f"Contexto construido y cacheado: {cache_key}")
            return context
        
        except Exception as e:
            logger.error(f"Error construyendo contexto: {e}", exc_info=True)
            return {
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def _get_sales_forecast(self, periods: int) -> Dict:
        """GET /api/prophet/sales-forecast/?periods=30"""
        try:
            response = requests.get(
                f"{self.analytics_url}/api/prophet/sales-forecast/",
                params={'periods': periods},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            # Calcular crecimiento promedio
            forecast_values = [f['yhat'] for f in data.get('forecast', [])]
            if len(forecast_values) >= 2:
                growth = ((forecast_values[-1] - forecast_values[0]) / forecast_values[0]) * 100
                data['growth_percent'] = round(growth, 2)
            
            return data
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Error obteniendo sales forecast: {e}")
            return {'error': str(e)}
    
    def _get_forecast_components(self) -> Dict:
        """GET /api/prophet/forecast-components/"""
        try:
            response = requests.get(
                f"{self.analytics_url}/api/prophet/forecast-components/",
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Error obteniendo componentes: {e}")
            return {'error': str(e)}
    
    def _get_accuracy_metrics(self) -> Dict:
        """
        Obtiene últimas métricas de precisión.
        TODO: Implementar endpoint real en analytics service
        """
        # Por ahora retornamos valores mock
        # En producción, crear endpoint: GET /api/prophet/accuracy/
        return {
            'mape': 8.5,
            'rmse': 1250.0,
            'mae': 980.0,
            'last_update': datetime.now().isoformat(),
            'confidence': 'alta'  # alta si MAPE < 10%, media < 20%, baja >= 20%
        }
    
    def _get_restock_recommendations(self) -> List[Dict]:
        """
        Obtiene recomendaciones de reorden desde analytics.

        Endpoints válidos en analytics:
        - GET /api/reorder-recommendations/  (DRF ModelViewSet list)
          Soporta filtros: reorder_priority, status, etc.
        """
        try:
            response = requests.get(
                f"{self.analytics_url}/api/reorder-recommendations/",
                params={'reorder_priority': 'urgent,high', 'status': 'pending'},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            # DRF puede devolver lista simple o dict con 'results' si hay paginación
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                if 'results' in data and isinstance(data['results'], list):
                    return data['results']
                if 'recommendations' in data and isinstance(data['recommendations'], list):
                    return data['recommendations']
            return []
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Error obteniendo recomendaciones: {e}")
            return []
    
    def _get_top_products_forecast(self, periods: int) -> List[Dict]:
        """GET /api/prophet/top-products-forecast/?top_n=10&periods=30"""
        try:
            response = requests.get(
                f"{self.analytics_url}/api/prophet/top-products-forecast/",
                params={'top_n': 10, 'periods': periods},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            # El servicio expone 'forecasts' como lista de productos con su forecast
            if isinstance(data, dict) and isinstance(data.get('forecasts'), list):
                return data['forecasts']
            return []
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Error obteniendo top productos: {e}")
            return []
    
    def _build_summary(self, context: Dict) -> Dict:
        """Construye resumen ejecutivo con números clave."""
        summary = {}
        
        # Resumen de forecast
        sales_forecast = context.get('sales_forecast', {})
        if 'forecast' in sales_forecast and sales_forecast['forecast']:
            forecast_data = sales_forecast['forecast']
            summary['forecast_next_7_days'] = sum(f['yhat'] for f in forecast_data[:7])
            summary['forecast_next_30_days'] = sum(f['yhat'] for f in forecast_data[:30])
            summary['growth_percent'] = sales_forecast.get('growth_percent', 0)
        
        # Resumen de restock
        restock = context.get('restock_recommendations', [])
        # En el modelo las prioridades válidas son: urgent, high, medium, low
        summary['critical_restock_count'] = len([r for r in restock if r.get('reorder_priority') == 'urgent'])
        summary['high_restock_count'] = len([r for r in restock if r.get('reorder_priority') == 'high'])
        
        # Precisión del modelo
        accuracy = context.get('accuracy_metrics', {})
        summary['forecast_accuracy_mape'] = accuracy.get('mape', 0)
        summary['confidence_level'] = accuracy.get('confidence', 'desconocida')
        
        # Top 3 productos
        top_products = context.get('top_products', [])
        if top_products:
            summary['top_3_products'] = [
                {
                    'name': p.get('product_name', 'N/A'),
                    'forecast_30d': sum(f['yhat'] for f in p.get('forecast', [])[:30])
                }
                for p in top_products[:3]
            ]
        
        return summary
