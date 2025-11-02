"""
Prophet Forecasting Module
Integrates Facebook Prophet for demand forecasting with caching and data quality validation
"""
from prophet import Prophet
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
import logging
import hashlib
import pickle
import sys
import os

from .models import DailySalesMetrics, ProductDemandMetrics
from .data_quality import DataQualityValidator
from django.core.cache import cache
from django.conf import settings

# Importar distributed_cache si está disponible
try:
    sys.path.insert(0, os.path.join(settings.BASE_DIR, '..'))
    from distributed_cache import distributed_cache, cache_forecast
    USE_DISTRIBUTED_CACHE = True
except ImportError:
    USE_DISTRIBUTED_CACHE = False
    distributed_cache = None
    cache_forecast = None

logger = logging.getLogger(__name__)

# Configuración de caché
CACHE_TIMEOUT = getattr(settings, 'PROPHET_CACHE_TIMEOUT', 3600)  # 1 hora por defecto


class DemandForecast:
    """Wrapper for Prophet forecasting functionality with caching and data quality validation."""
    
    def __init__(self, product_id: Optional[int] = None):
        """
        Initialize forecaster.
        
        Args:
            product_id: If provided, forecast for specific product. 
                       If None, forecast total sales.
        """
        self.product_id = product_id
        self.model: Optional[Prophet] = None
        self.forecast: Optional[pd.DataFrame] = None
        self.df: Optional[pd.DataFrame] = None
    
    def _get_cache_key(self, suffix: str = 'model') -> str:
        """
        Generate cache key for model or forecast.
        
        Args:
            suffix: 'model' or 'forecast' or 'data'
            
        Returns:
            Cache key string
        """
        product_part = f'product_{self.product_id}' if self.product_id else 'total_sales'
        return f'prophet_{suffix}_{product_part}'
    
    def _get_data_hash(self, df: pd.DataFrame) -> str:
        """
        Generate hash of dataframe for cache invalidation.
        
        Args:
            df: DataFrame to hash
            
        Returns:
            Hash string
        """
        # Simple hash based on shape and last values
        data_str = f"{len(df)}_{df['y'].sum()}_{df['y'].tail(5).tolist()}"
        return hashlib.md5(data_str.encode()).hexdigest()
    
    def _load_cached_model(self, data_hash: str) -> Optional[Prophet]:
        """
        Load cached Prophet model if available and valid.
        
        Args:
            data_hash: Hash of current data for validation
            
        Returns:
            Prophet model or None
        """
        cache_key = self._get_cache_key('model')
        cached = cache.get(cache_key)
        
        if cached and isinstance(cached, dict):
            if cached.get('data_hash') == data_hash:
                try:
                    model = pickle.loads(cached['model_bytes'])
                    logger.info(f"Loaded cached Prophet model for {cache_key}")
                    return model
                except Exception as e:
                    logger.warning(f"Failed to deserialize cached model: {e}")
        
        return None
    
    def _save_model_to_cache(self, model: Prophet, data_hash: str) -> None:
        """
        Save Prophet model to cache.
        
        Args:
            model: Trained Prophet model
            data_hash: Hash of training data
        """
        try:
            cache_key = self._get_cache_key('model')
            model_bytes = pickle.dumps(model)
            
            cache_data = {
                'model_bytes': model_bytes,
                'data_hash': data_hash,
                'cached_at': datetime.now().isoformat()
            }
            
            cache.set(cache_key, cache_data, CACHE_TIMEOUT)
            logger.info(f"Cached Prophet model: {cache_key}")
        except Exception as e:
            logger.warning(f"Failed to cache model: {e}")
    
    def _validate_and_clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Validate data quality and apply auto-cleaning.
        
        Args:
            df: Raw dataframe
            
        Returns:
            Cleaned dataframe
        """
        if df.empty or len(df) < 2:
            return df
        
        try:
            # Validate with DataQualityValidator (solo requiere df)
            report = DataQualityValidator.validate_daily_metrics(df)
            
            if not report.is_valid:
                logger.warning(f"Data quality issues detected: {len(report.issues)} issues")
                
                # Auto-clean based on issues
                for issue in report.issues:
                    if issue.issue_type == 'outliers' and issue.severity == 'high':
                        # Winsorize outliers (cap at 95th percentile)
                        upper_bound = df['y'].quantile(0.95)
                        lower_bound = df['y'].quantile(0.05)
                        df['y'] = df['y'].clip(lower=lower_bound, upper=upper_bound)
                        logger.info(f"Applied winsorization: [{lower_bound:.2f}, {upper_bound:.2f}]")
                    
                    elif issue.issue_type == 'missing_dates':
                        # Fill missing dates with interpolation
                        df = df.set_index('ds').resample('D').interpolate(method='linear').reset_index()
                        logger.info(f"Filled {issue.count} missing dates with interpolation")
                    
                    elif issue.issue_type == 'negative_values':
                        # Replace negatives with 0
                        df.loc[df['y'] < 0, 'y'] = 0
                        logger.info(f"Replaced {issue.count} negative values with 0")
            
            return df
            
        except Exception as e:
            logger.warning(f"Data quality validation failed: {e}")
            return df
    
    def prepare_data(self, days_history: int = 365) -> pd.DataFrame:
        """
        Prepare historical data from database.
        
        Args:
            days_history: Number of days of history to use
            
        Returns:
            DataFrame in Prophet format (ds, y columns)
        """
        try:
            if self.product_id:
                # Product-level forecasting
                metrics = ProductDemandMetrics.objects.filter(
                    product_id=self.product_id
                ).order_by('period_end')
                
                if not metrics.exists():
                    logger.warning(f"No metrics found for product {self.product_id}")
                    return pd.DataFrame({'ds': [], 'y': []})
                
                data = []
                # Django doesn't support negative indexing, so we use order and slice differently
                total_count = metrics.count()
                start_index = max(0, total_count - days_history)
                metrics_slice = metrics[start_index:]
                for m in metrics_slice:
                    data.append({
                        'ds': pd.Timestamp(m.period_end),
                        'y': float(m.average_daily_demand or 0),
                    })
            else:
                # Sales-level forecasting (total company sales)
                metrics = DailySalesMetrics.objects.order_by('date')
                
                if not metrics.exists():
                    logger.warning("No daily sales metrics found")
                    return pd.DataFrame({'ds': [], 'y': []})
                
                data = []
                # Django doesn't support negative indexing, so we use order and slice differently
                total_count = metrics.count()
                start_index = max(0, total_count - days_history)
                metrics_slice = metrics[start_index:]
                for m in metrics_slice:
                    data.append({
                        'ds': pd.Timestamp(m.date),
                        'y': float(m.total_sales or 0),
                    })
            
            df = pd.DataFrame(data)

            if df.empty:
                logger.warning("Prepared dataframe is empty")
                return df

            # Ensure datetime format and basic ordering
            df['ds'] = pd.to_datetime(df['ds'], errors='coerce')
            # Force numeric and handle bad values
            df['y'] = pd.to_numeric(df['y'], errors='coerce')

            # Drop rows with invalid dates or values
            before_len = len(df)
            df = df.dropna(subset=['ds', 'y'])

            # Remove infinities and non-finite
            df = df[np.isfinite(df['y'])]

            # Clip negatives to zero for demand series (avoid pathological fits)
            df['y'] = df['y'].clip(lower=0)

            # Aggregate duplicate dates by summing values
            if df['ds'].duplicated().any():
                df = df.groupby('ds', as_index=False)['y'].sum()

            # Sort by date
            df = df.sort_values('ds').reset_index(drop=True)

            # If the series is constant (all the same value), add tiny jitter to help optimizer
            if len(df) > 1 and (df['y'].std() == 0 or np.isclose(df['y'].std(), 0)):
                df['y'] = df['y'] + np.random.default_rng(42).normal(0, 1e-6, size=len(df))

            after_len = len(df)
            if after_len < before_len:
                logger.info(f"Cleaned input data: dropped {before_len - after_len} invalid rows; kept {after_len}")

            logger.info(f"Prepared {len(df)} clean data points for forecasting")
            self.df = df
            return df
        
        except Exception as e:
            logger.error(f"Error preparing data: {str(e)}", exc_info=True)
            return pd.DataFrame({'ds': [], 'y': []})
    
    def forecast_demand(self, periods: int = 30, use_cache: bool = True) -> Optional[pd.DataFrame]:
        """
        Forecast demand using Prophet with caching.
        
        Args:
            periods: Number of periods to forecast (days)
            use_cache: Whether to use cached model (default True)
            
        Returns:
            DataFrame with forecast and confidence intervals
        """
        try:
            # Prepare data
            df = self.prepare_data()
            
            if df.empty or len(df) < 1:
                logger.error("Not enough data for forecasting (need at least 1 point)")
                return None
            
            # Validate and clean data
            df = self._validate_and_clean_data(df)
            data_hash = self._get_data_hash(df)
            
            # Try to load cached model
            if use_cache:
                cached_model = self._load_cached_model(data_hash)
                if cached_model:
                    self.model = cached_model
                    logger.info("Using cached Prophet model")
                else:
                    logger.info("No valid cached model found, training new model")
            
            # Configure seasonality based on data availability
            enable_weekly = len(df) >= 14
            enable_yearly = len(df) >= 90

            # Initialize Prophet model if not cached
            if self.model is None:
                self.model = Prophet(
                    yearly_seasonality=enable_yearly,   # Enable only when enough history
                    weekly_seasonality=enable_weekly,   # Enable only when > 2 weeks
                    daily_seasonality=False,            # Not intraday
                    interval_width=0.95,                # 95% confidence interval
                    changepoint_prior_scale=0.05,       # Reasonable flexibility
                    seasonality_mode='additive',        # Demand typically additive
                    # Fast MAP estimation (avoid full MCMC)
                    mcmc_samples=0,
                    uncertainty_samples=200,
                )

                # Fit model with robust error handling and fallback
                try:
                    logger.info(f"Fitting Prophet model for {len(df)} data points (weekly={enable_weekly}, yearly={enable_yearly})...")
                    self.model.fit(df)
                    
                    # Cache the trained model
                    if use_cache:
                        self._save_model_to_cache(self.model, data_hash)
                
                except Exception as model_err:
                    logger.error(f"Prophet fit failed: {model_err}")
                    # Fallback will be handled below
                    self.model = None
            
            # Generate forecast
            try:
                if self.model:
                    # Create future dataframe and predict
                    future = self.model.make_future_dataframe(periods=periods)
                    logger.info(f"Generating {periods}-day forecast...")
                    self.forecast = self.model.predict(future)
                else:
                    raise Exception("Model training failed")
            except Exception as model_err:
                logger.error(f"Prophet fit failed, falling back to simple moving-average forecast: {model_err}")
                # Fallback: naive moving average forecast using last 7 points (or all if fewer)
                window = min(7, len(df))
                recent_mean = float(df['y'].tail(window).mean()) if window > 0 else 0.0
                base_date = df['ds'].max()
                dates = pd.date_range(start=base_date + pd.Timedelta(days=1), periods=periods, freq='D')
                fallback = pd.DataFrame({
                    'ds': dates,
                    'yhat': recent_mean,
                    'yhat_lower': max(0.0, recent_mean * 0.8),
                    'yhat_upper': recent_mean * 1.2,
                })
                self.forecast = pd.concat([
                    df.rename(columns={'y': 'yhat'}).assign(yhat_lower=np.nan, yhat_upper=np.nan)[['ds', 'yhat', 'yhat_lower', 'yhat_upper']],
                    fallback
                ], ignore_index=True)

            # Extract relevant columns and return only future predictions
            forecast_result = self.forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(periods).copy()

            # Convert to string date format for downstream consumers
            forecast_result['ds'] = pd.to_datetime(forecast_result['ds']).dt.strftime('%Y-%m-%d')

            logger.info(f"Successfully generated forecast with {len(forecast_result)} periods")
            return forecast_result
        
        except Exception as e:
            logger.error(f"Error during forecasting: {str(e)}", exc_info=True)
            return None
    
    def get_forecast_dict(self, periods: int = 30) -> Dict:
        """
        Get forecast as dictionary for API response.
        
        Args:
            periods: Number of periods to forecast
            
        Returns:
            Dictionary with forecast data and metadata
        """
        forecast_df = self.forecast_demand(periods)
        
        if forecast_df is None or forecast_df.empty:
            return {
                'status': 'error',
                'message': 'Unable to generate forecast',
                'forecast': [],
                'periods': periods,
                'model': 'Prophet'
            }
        
        # Convert to dict records
        records = forecast_df.to_dict('records')
        
        return {
            'status': 'success',
            'forecast': records,
            'periods': periods,
            'model': 'Prophet',
            'generated_at': datetime.now().isoformat(),
        }
    
    def get_components(self) -> Optional[Dict]:
        """
        Get forecast components (trend, seasonality, etc).
        
        Returns:
            Dictionary with component analysis
        """
        try:
            if not self.model or self.forecast is None:
                return None
            
            # Avoid heavy matplotlib plotting on server-side; normalize to {ds, value}
            def _norm(col: str) -> List[Dict]:
                if col not in self.forecast.columns:
                    return []
                tmp = self.forecast[['ds', col]].copy()
                tmp.rename(columns={col: 'value'}, inplace=True)
                tmp['ds'] = pd.to_datetime(tmp['ds'], errors='coerce').dt.strftime('%Y-%m-%d')
                tmp['value'] = pd.to_numeric(tmp['value'], errors='coerce').fillna(0.0)
                return tmp.to_dict('records')

            return {
                'trend': _norm('trend'),
                'yearly': _norm('yearly'),
                'weekly': _norm('weekly'),
            }
        except Exception as e:
            logger.error(f"Error getting components: {str(e)}")
            return None

    def cached_forecast(self, periods: int = 30, ttl_seconds: int = 6 * 3600) -> Optional[List[Dict]]:
        """
        Return cached forecast result records for faster API responses.
        Cache key includes scope (total vs product) and periods.
        """
        try:
            key = f"forecast:{self.product_id or 'total'}:{int(periods)}"
            cached = cache.get(key)
            if cached:
                return cached

            df = self.forecast_demand(periods)
            if df is None or df.empty:
                return None

            out = (
                df[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]
                .tail(periods)
                .assign(ds=lambda r: pd.to_datetime(r['ds'], errors='coerce').dt.strftime('%Y-%m-%d'))
                .to_dict('records')
            )
            cache.set(key, out, ttl_seconds)
            return out
        except Exception as e:
            logger.error(f"Error using cached forecast: {str(e)}")
            return None
    
    def get_accuracy_metrics(self) -> Optional[Dict]:
        """
        Calculate forecast accuracy metrics against historical data.
        
        Returns:
            Dictionary with MAPE, RMSE, etc.
        """
        try:
            if self.forecast is None or self.df is None or len(self.df) < 1:
                return None
            
            # Get last part of forecast that overlaps with training data
            historical_forecast = self.forecast[self.forecast['ds'].isin(self.df['ds'])].copy()
            
            if len(historical_forecast) == 0:
                return None
            
            # Merge with actual values
            actual_vs_predicted = self.df.merge(
                historical_forecast[['ds', 'yhat']],
                on='ds'
            )
            
            if len(actual_vs_predicted) == 0:
                return None
            
            # Calculate metrics
            actual = actual_vs_predicted['y']
            predicted = actual_vs_predicted['yhat']
            
            # MAPE (Mean Absolute Percentage Error)
            mape = ((actual - predicted).abs() / actual).mean() * 100
            
            # RMSE (Root Mean Squared Error)
            rmse = ((actual - predicted) ** 2).mean() ** 0.5
            
            # MAE (Mean Absolute Error)
            mae = (actual - predicted).abs().mean()
            
            return {
                'mape': round(float(mape), 2),  # MAPE in percentage
                'rmse': round(float(rmse), 2),
                'mae': round(float(mae), 2),
                'sample_size': len(actual_vs_predicted),
            }
        
        except Exception as e:
            logger.error(f"Error calculating metrics: {str(e)}")
            return None


class BatchDemandForecast:
    """Generate forecasts for multiple products efficiently."""
    
    def __init__(self):
        self.forecasts: Dict[int, DemandForecast] = {}
    
    def forecast_top_products(self, top_n: int = 10, periods: int = 30) -> List[Dict]:
        """
        Generate forecasts for top N products by revenue.
        
        Args:
            top_n: Number of top products to forecast
            periods: Forecast periods
            
        Returns:
            List of forecasts with product info
        """
        try:
            # Get top products by revenue
            top_products = ProductDemandMetrics.objects.order_by(
                '-total_revenue'
            )[:top_n]
            
            results = []
            
            for product_metric in top_products:
                logger.info(f"Forecasting product {product_metric.product_id}...")
                
                forecast = DemandForecast(product_id=product_metric.product_id)
                forecast_data = forecast.forecast_demand(periods)
                
                if forecast_data is not None:
                    results.append({
                        'product_id': product_metric.product_id,
                        'product_name': product_metric.product_name,
                        'forecast': forecast_data.to_dict('records'),
                        'periods': periods,
                        'status': 'success'
                    })
                else:
                    results.append({
                        'product_id': product_metric.product_id,
                        'product_name': product_metric.product_name,
                        'forecast': [],
                        'periods': periods,
                        'status': 'error',
                        'message': 'Insufficient data for forecasting'
                    })
            
            logger.info(f"Generated forecasts for {len(results)} products")
            return results
        
        except Exception as e:
            logger.error(f"Error in batch forecasting: {str(e)}", exc_info=True)
            return []
    
    def forecast_by_category(self, category_id: int, periods: int = 30) -> Optional[Dict]:
        """
        Forecast aggregate demand for entire category.
        
        Args:
            category_id: Category ID
            periods: Forecast periods
            
        Returns:
            Dict with category forecast
        """
        try:
            from .models import ProductDemandMetrics, CategoryPerformanceMetrics
            
            # Get category name
            category_metric = CategoryPerformanceMetrics.objects.filter(
                category_id=category_id
            ).order_by('-period_end').first()
            
            category_name = category_metric.category_name if category_metric else f"Category {category_id}"
            
            # Get all products in category
            products = ProductDemandMetrics.objects.filter(
                product_id__in=self._get_products_by_category(category_id)
            ).order_by('-period_end')
            
            if not products.exists():
                return {
                    'status': 'error',
                    'message': 'No products found in category'
                }
            
            # Aggregate historical data across all products in category
            from collections import defaultdict
            daily_totals = defaultdict(float)
            
            for product in products:
                # Get product forecast
                forecast = DemandForecast(product_id=product.product_id)
                hist_df = forecast.prepare_data(days_history=365)
                
                for _, row in hist_df.iterrows():
                    date_key = row['ds'].strftime('%Y-%m-%d')
                    daily_totals[date_key] += row['y']
            
            # Create aggregated dataframe
            import pandas as pd
            agg_data = [
                {'ds': pd.Timestamp(date), 'y': value}
                for date, value in sorted(daily_totals.items())
            ]
            
            if len(agg_data) < 7:
                return {
                    'status': 'error',
                    'message': 'Insufficient aggregated data'
                }
            
            df = pd.DataFrame(agg_data)
            
            # Forecast aggregate
            from prophet import Prophet
            model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False,
                interval_width=0.95
            )
            
            model.fit(df)
            future = model.make_future_dataframe(periods=periods)
            forecast = model.predict(future)
            
            # Return forecast for future periods
            forecast_result = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(periods).copy()
            forecast_result['ds'] = forecast_result['ds'].dt.strftime('%Y-%m-%d')
            
            return {
                'status': 'success',
                'category_id': category_id,
                'category_name': category_name,
                'forecast': forecast_result.to_dict('records'),
                'periods': periods,
                'products_count': products.count(),
            }
        
        except Exception as e:
            logger.error(f"Error forecasting category: {str(e)}", exc_info=True)
            return {
                'status': 'error',
                'message': str(e)
            }
    
    def forecast_by_warehouse(self, warehouse_id: int, periods: int = 30) -> Optional[Dict]:
        """
        Forecast aggregate demand for entire warehouse.
        
        Args:
            warehouse_id: Warehouse ID
            periods: Forecast periods
            
        Returns:
            Dict with warehouse forecast
        """
        try:
            from .models import InventoryTurnoverMetrics
            import requests
            
            # Get warehouse name
            try:
                wh_response = requests.get(
                    f'http://inventario:8000/api/warehouses/{warehouse_id}/',
                    timeout=5
                )
                warehouse_name = wh_response.json().get('name', f'Warehouse {warehouse_id}') if wh_response.status_code == 200 else f'Warehouse {warehouse_id}'
            except:
                warehouse_name = f'Warehouse {warehouse_id}'
            
            # Get products in this warehouse
            warehouse_products = InventoryTurnoverMetrics.objects.filter(
                warehouse_id=warehouse_id
            ).values_list('product_id', flat=True).distinct()
            
            if not warehouse_products:
                return {
                    'status': 'error',
                    'message': 'No products found in warehouse'
                }
            
            # Aggregate forecasts
            from collections import defaultdict
            daily_totals = defaultdict(float)
            
            for product_id in warehouse_products:
                forecast = DemandForecast(product_id=product_id)
                hist_df = forecast.prepare_data(days_history=365)
                
                for _, row in hist_df.iterrows():
                    date_key = row['ds'].strftime('%Y-%m-%d')
                    daily_totals[date_key] += row['y']
            
            # Create aggregated dataframe
            import pandas as pd
            agg_data = [
                {'ds': pd.Timestamp(date), 'y': value}
                for date, value in sorted(daily_totals.items())
            ]
            
            if len(agg_data) < 7:
                return {
                    'status': 'error',
                    'message': 'Insufficient data for warehouse'
                }
            
            df = pd.DataFrame(agg_data)
            
            # Forecast
            from prophet import Prophet
            model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False,
                interval_width=0.95
            )
            
            model.fit(df)
            future = model.make_future_dataframe(periods=periods)
            forecast = model.predict(future)
            
            forecast_result = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(periods).copy()
            forecast_result['ds'] = forecast_result['ds'].dt.strftime('%Y-%m-%d')
            
            return {
                'status': 'success',
                'warehouse_id': warehouse_id,
                'warehouse_name': warehouse_name,
                'forecast': forecast_result.to_dict('records'),
                'periods': periods,
                'products_count': len(warehouse_products),
            }
        
        except Exception as e:
            logger.error(f"Error forecasting warehouse: {str(e)}", exc_info=True)
            return {
                'status': 'error',
                'message': str(e)
            }
    
    def _get_products_by_category(self, category_id: int) -> List[int]:
        """Get list of product IDs in a category from inventory service."""
        try:
            import requests
            response = requests.get(
                f'http://inventario:8000/api/products/',
                params={'category_id': category_id},
                timeout=5
            )
            if response.status_code == 200:
                products = response.json()
                return [p['id'] for p in products if 'id' in p]
            return []
        except Exception as e:
            logger.error(f"Error fetching products by category: {str(e)}")
            return []


class InventoryRestockAnalyzer:
    """
    Analiza necesidades de reinventario combinando forecast con inventario actual.
    Calcula puntos de reorden óptimos y genera alertas.
    """
    
    def __init__(self, product_id: int, warehouse_id: Optional[int] = None):
        self.product_id = product_id
        self.warehouse_id = warehouse_id
        self.forecaster = DemandForecast(product_id=product_id)
    
    def calculate_reorder_point(
        self,
        lead_time_days: int = 7,
        service_level: float = 0.95,
        periods: int = 30
    ) -> Dict:
        """
        Calcula el punto de reorden óptimo usando forecast.
        
        Punto de Reorden = (Demanda promedio diaria × Lead Time) + Stock de seguridad
        Stock de Seguridad = Z-score(service_level) × Std Dev de demanda × sqrt(Lead Time)
        
        Args:
            lead_time_days: Días que tarda en llegar el pedido
            service_level: Nivel de servicio deseado (0.95 = 95%)
            periods: Días de forecast para análisis
            
        Returns:
            Dict con punto de reorden, stock de seguridad, y métricas
        """
        try:
            import numpy as np
            from scipy import stats
            
            # Obtener forecast
            forecast_df = self.forecaster.forecast_demand(periods)
            if forecast_df is None or forecast_df.empty:
                return {
                    'status': 'error',
                    'message': 'Unable to generate forecast'
                }
            
            # Preparar datos históricos
            hist_df = self.forecaster.prepare_data(days_history=90)
            # Allow sparse history; use safe defaults if too short
            if hist_df.empty or len(hist_df) < 2:
                # If no history, still provide a conservative recommendation using forecast averages
                daily_demand_mean = 0.0
                daily_demand_std = 0.0
            else:
                daily_demand_mean = float(hist_df['y'].mean())
                # Use population std (ddof=0) to avoid NaN when len==1 and be conservative
                daily_demand_std = float(np.nan_to_num(hist_df['y'].std(ddof=0), nan=0.0))
            
            # daily_demand_mean and std already computed above
            
            # Z-score para nivel de servicio deseado
            z_score = stats.norm.ppf(service_level)
            
            # Stock de seguridad
            safety_stock = int(z_score * daily_demand_std * np.sqrt(lead_time_days))
            
            # Demanda durante lead time
            lead_time_demand = int(daily_demand_mean * lead_time_days)
            
            # Punto de reorden
            reorder_point = lead_time_demand + safety_stock
            
            # Cantidad económica de pedido (EOQ simplificada)
            # EOQ = sqrt(2 × demanda_anual × costo_pedido / costo_mantenimiento)
            # Simplificación: ordenar para ~30 días
            annual_demand = daily_demand_mean * 365
            economic_order_quantity = int(daily_demand_mean * 30)
            
            # Calcular días hasta stockout basado en forecast
            cumulative_demand = 0
            days_to_stockout = None
            
            # Necesitaríamos current_stock desde inventario
            # Por ahora calculamos solo la demanda acumulada
            forecast_7d = forecast_df.head(7)['yhat'].sum()
            forecast_30d = forecast_df['yhat'].sum()
            
            return {
                'status': 'success',
                'product_id': self.product_id,
                'reorder_point': reorder_point,
                'safety_stock': safety_stock,
                'lead_time_demand': lead_time_demand,
                'economic_order_quantity': economic_order_quantity,
                'daily_demand_mean': round(daily_demand_mean, 2),
                'daily_demand_std': round(daily_demand_std, 2),
                'forecast_7_days': round(float(forecast_7d), 2),
                'forecast_30_days': round(float(forecast_30d), 2),
                'service_level': service_level,
                'lead_time_days': lead_time_days,
            }
        
        except Exception as e:
            logger.error(f"Error calculating reorder point: {str(e)}", exc_info=True)
            return {
                'status': 'error',
                'message': str(e)
            }
    
    def analyze_stockout_risk(
        self,
        current_stock: int,
        lead_time_days: int = 7,
        periods: int = 30
    ) -> Dict:
        """
        Analiza el riesgo de stockout basado en inventario actual y forecast.
        
        Args:
            current_stock: Inventario actual
            lead_time_days: Lead time del proveedor
            periods: Días de forecast
            
        Returns:
            Dict con análisis de riesgo, días hasta stockout, prioridad
        """
        try:
            from datetime import date, timedelta
            
            # Obtener forecast
            forecast_df = self.forecaster.forecast_demand(periods)
            if forecast_df is None or forecast_df.empty:
                return {
                    'status': 'error',
                    'message': 'Unable to generate forecast'
                }
            
            # Calcular punto de reorden
            reorder_info = self.calculate_reorder_point(
                lead_time_days=lead_time_days,
                periods=periods
            )
            
            if reorder_info['status'] == 'error':
                return reorder_info
            
            # Simular consumo día a día
            stock_remaining = current_stock
            days_until_stockout = None
            stockout_date = None
            
            for offset, (_, row) in enumerate(forecast_df.iterrows()):
                predicted_demand = float(row['yhat'])
                stock_remaining -= predicted_demand

                if stock_remaining <= 0 and days_until_stockout is None:
                    days_until_stockout = offset
                    try:
                        stockout_date = (date.today() + timedelta(days=offset)).isoformat()
                    except Exception:
                        stockout_date = row.get('ds')
                    break
            
            # Determinar prioridad de reorden
            reorder_point = reorder_info['reorder_point']
            
            if current_stock <= 0:
                priority = 'critical'
                priority_score = 100
            elif current_stock <= reorder_point * 0.5:
                priority = 'urgent'
                priority_score = 80
            elif current_stock <= reorder_point:
                priority = 'high'
                priority_score = 60
            elif days_until_stockout and days_until_stockout < lead_time_days:
                priority = 'urgent'
                priority_score = 75
            elif days_until_stockout and days_until_stockout < lead_time_days * 2:
                priority = 'high'
                priority_score = 55
            elif days_until_stockout and days_until_stockout < 30:
                priority = 'medium'
                priority_score = 40
            else:
                priority = 'low'
                priority_score = 20
            
            # Cantidad recomendada a ordenar
            if current_stock < reorder_point:
                recommended_order = max(
                    reorder_info['economic_order_quantity'],
                    reorder_point - current_stock + reorder_info['safety_stock']
                )
            else:
                recommended_order = 0
            
            return {
                'status': 'success',
                'product_id': self.product_id,
                'current_stock': current_stock,
                'reorder_point': reorder_point,
                'safety_stock': reorder_info['safety_stock'],
                'priority': priority,
                'priority_score': priority_score,
                'days_until_stockout': days_until_stockout,
                'stockout_date': stockout_date,
                'recommended_order_quantity': recommended_order,
                'should_reorder': current_stock <= reorder_point,
                'forecast_7_days': reorder_info['forecast_7_days'],
                'forecast_30_days': reorder_info['forecast_30_days'],
            }
        
        except Exception as e:
            logger.error(f"Error analyzing stockout risk: {str(e)}", exc_info=True)
            return {
                'status': 'error',
                'message': str(e)
            }
    
    def generate_reorder_recommendation(
        self,
        current_stock: int,
        min_stock_level: int = 0,
        lead_time_days: int = 7
    ) -> Dict:
        """
        Genera una recomendación completa de reorden lista para guardar.
        
        Args:
            current_stock: Stock actual
            min_stock_level: Nivel mínimo configurado (legacy)
            lead_time_days: Lead time del proveedor
            
        Returns:
            Dict con todos los campos para crear StockReorderRecommendation
        """
        try:
            from datetime import date, timedelta
            
            # Análisis de riesgo
            risk_analysis = self.analyze_stockout_risk(
                current_stock=current_stock,
                lead_time_days=lead_time_days
            )
            
            if risk_analysis['status'] == 'error':
                return risk_analysis
            
            # Obtener info del producto (desde ProductDemandMetrics)
            from .models import ProductDemandMetrics
            
            try:
                product_metric = ProductDemandMetrics.objects.filter(
                    product_id=self.product_id
                ).order_by('-period_end').first()
                
                product_name = product_metric.product_name if product_metric else f"Product {self.product_id}"
                product_sku = product_metric.product_sku if product_metric else None
                avg_daily_demand = float(product_metric.average_daily_demand) if product_metric else 0
            except:
                product_name = f"Product {self.product_id}"
                product_sku = None
                avg_daily_demand = 0
            
            # Fecha recomendada de pedido
            if risk_analysis['days_until_stockout']:
                days_until_order = max(0, risk_analysis['days_until_stockout'] - lead_time_days)
                recommended_order_date = date.today() + timedelta(days=days_until_order)
            else:
                recommended_order_date = None
            
            return {
                'status': 'success',
                'recommendation': {
                    'product_id': self.product_id,
                    'product_name': product_name,
                    'product_sku': product_sku,
                    'warehouse_id': self.warehouse_id,
                    'current_stock': current_stock,
                    'min_stock_level': min_stock_level,
                    'average_daily_demand': Decimal(str(avg_daily_demand)),
                    'predicted_demand_7days': int(risk_analysis['forecast_7_days']),
                    'predicted_demand_30days': int(risk_analysis['forecast_30_days']),
                    'recommended_order_quantity': risk_analysis['recommended_order_quantity'],
                    'reorder_priority': risk_analysis['priority'],
                    'safety_stock': risk_analysis['safety_stock'],
                    'reorder_point': risk_analysis['reorder_point'],
                    'stockout_date_estimate': risk_analysis['stockout_date'],
                    'recommended_order_date': recommended_order_date,
                    'status': 'pending',
                }
            }
        
        except Exception as e:
            logger.error(f"Error generating recommendation: {str(e)}", exc_info=True)
            return {
                'status': 'error',
                'message': str(e)
            }
