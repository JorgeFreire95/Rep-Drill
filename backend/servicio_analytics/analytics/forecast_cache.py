"""Centralized forecast cache key helpers and invalidation utilities."""
from typing import Iterable, List, Optional
from django.core.cache import cache

MODEL_PREFIX = "prophet_model_"
FORECAST_PREFIX = "prophet_forecast_"
DATA_PREFIX = "prophet_data_"

def _product_part(product_id: Optional[int]) -> str:
    return f"product_{product_id}" if product_id is not None else "total_sales"

def model_key(product_id: Optional[int]) -> str:
    return MODEL_PREFIX + _product_part(product_id)

def forecast_key(product_id: Optional[int]) -> str:
    return FORECAST_PREFIX + _product_part(product_id)

def data_key(product_id: Optional[int]) -> str:
    return DATA_PREFIX + _product_part(product_id)

def all_keys_for_product(product_id: Optional[int]) -> List[str]:
    return [model_key(product_id), forecast_key(product_id), data_key(product_id)]

def invalidate_products(product_ids: Iterable[int]) -> int:
    """Invalidate (delete) forecast-related keys for given products.
    Returns count of keys deleted."""
    deleted = 0
    for pid in product_ids:
        for k in all_keys_for_product(pid):
            if cache.delete(k):
                deleted += 1
    return deleted

def invalidate_total_sales() -> int:
    deleted = 0
    for k in all_keys_for_product(None):
        if cache.delete(k):
            deleted += 1
    return deleted

def invalidate_all_matching(pattern_prefixes: Optional[List[str]] = None) -> int:
    """Best-effort bulk invalidation by prefixes (backend dependent)."""
    backend = getattr(cache, 'backend', '')
    # For Redis backend we can attempt a scan if available; else fall back to explicit keys known.
    if pattern_prefixes is None:
        pattern_prefixes = [MODEL_PREFIX, FORECAST_PREFIX, DATA_PREFIX]
    # Fallback: delete known total key set first
    deleted = invalidate_total_sales()
    # Without direct key iteration support we stop here.
    return deleted
