from __future__ import annotations

import logging
import requests
from typing import Optional

from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from django.forms.models import model_to_dict
from django.utils import timezone
from django.conf import settings

from .models import (
    Product,
    ProductPriceHistory,
    ProductCostHistory,
    Inventory,
    AuditLog,
)

logger = logging.getLogger(__name__)


# --- Helpers -----------------------------------------------------------------

TRACKED_PRODUCT_FIELDS = (
    'name', 'description', 'sku', 'category_id', 'supplier_id', 'warehouse_id',
    'cost_price', 'price', 'quantity', 'min_stock', 'reorder_quantity',
    'unit_of_measure', 'status'
)

TRACKED_INVENTORY_FIELDS = (
    'product_id', 'warehouse_id', 'quantity', 'entry_date', 'exit_date'
)


def _diff(old: dict, new: dict) -> dict:
    changes = {}
    for k, old_val in old.items():
        if k not in new:
            continue
        if new[k] != old_val:
            changes[k] = {'from': old_val, 'to': new[k]}
    return changes


def _invalidate_forecast_cache(product_id: int) -> None:
    """Call analytics service to invalidate forecast cache for a product."""
    analytics_url = getattr(settings, 'ANALYTICS_SERVICE_URL', 'http://analytics:8000')
    try:
        resp = requests.post(
            f"{analytics_url}/api/prophet/invalidate/",
            json={'product_ids': [product_id]},
            timeout=2
        )
        if resp.status_code in [200, 201]:
            logger.info(f"Invalidated forecast cache for product {product_id}")
        else:
            logger.warning(f"Failed to invalidate forecast cache for product {product_id}: {resp.status_code}")
    except Exception as e:
        logger.error(f"Error invalidating forecast cache for product {product_id}: {e}")


# --- Product change tracking -------------------------------------------------

@receiver(pre_save, sender=Product)
def product_pre_save(sender, instance: Product, **kwargs):
    if not instance.pk:
        instance._old_snapshot = None
        return
    try:
        current = sender.objects.get(pk=instance.pk)
        instance._old_snapshot = model_to_dict(current, fields=TRACKED_PRODUCT_FIELDS)
    except sender.DoesNotExist:
        instance._old_snapshot = None


@receiver(post_save, sender=Product)
def product_post_save(sender, instance: Product, created: bool, **kwargs):
    # Price history rotation
    today = timezone.localdate()
    quantity_changed = False
    
    if not created and hasattr(instance, '_old_snapshot') and instance._old_snapshot:
        old = instance._old_snapshot
        # Sale price changed
        if 'price' in old and str(old['price']) != str(instance.price):
            # Close previous
            ProductPriceHistory.objects.filter(product=instance, end_date__isnull=True).update(end_date=today)
            # Create new
            ProductPriceHistory.objects.create(product=instance, price=instance.price, start_date=today)
        # Cost price changed
        if 'cost_price' in old and str(old['cost_price']) != str(instance.cost_price):
            ProductCostHistory.objects.filter(product=instance, end_date__isnull=True).update(end_date=today)
            ProductCostHistory.objects.create(product=instance, cost_price=instance.cost_price, start_date=today)
        # Check if quantity changed (stock movement)
        if 'quantity' in old and old['quantity'] != instance.quantity:
            quantity_changed = True

    # Audit log
    new_snapshot = model_to_dict(instance, fields=TRACKED_PRODUCT_FIELDS)
    if created:
        AuditLog.objects.create(
            model='Product', object_id=instance.pk, object_repr=instance.name,
            action='create', changes={k: {'from': None, 'to': v} for k, v in new_snapshot.items()}
        )
    else:
        old = getattr(instance, '_old_snapshot', None) or {}
        changes = _diff(old, new_snapshot)
        if changes:
            AuditLog.objects.create(
                model='Product', object_id=instance.pk, object_repr=instance.name,
                action='update', changes=changes
            )
    
    # Invalidate forecast cache if quantity changed
    if quantity_changed:
        _invalidate_forecast_cache(instance.pk)


@receiver(post_delete, sender=Product)
def product_post_delete(sender, instance: Product, **kwargs):
    AuditLog.objects.create(
        model='Product', object_id=instance.pk or 0, object_repr=getattr(instance, 'name', None),
        action='delete', changes=None
    )


# --- Inventory change tracking ----------------------------------------------

@receiver(pre_save, sender=Inventory)
def inventory_pre_save(sender, instance: Inventory, **kwargs):
    if not instance.pk:
        instance._old_snapshot = None
        return
    try:
        current = sender.objects.get(pk=instance.pk)
        instance._old_snapshot = model_to_dict(current, fields=TRACKED_INVENTORY_FIELDS)
    except sender.DoesNotExist:
        instance._old_snapshot = None


@receiver(post_save, sender=Inventory)
def inventory_post_save(sender, instance: Inventory, created: bool, **kwargs):
    new_snapshot = model_to_dict(instance, fields=TRACKED_INVENTORY_FIELDS)
    quantity_changed = False
    
    if created:
        AuditLog.objects.create(
            model='Inventory', object_id=instance.pk, object_repr=str(instance),
            action='create', changes={k: {'from': None, 'to': v} for k, v in new_snapshot.items()}
        )
        quantity_changed = True  # New inventory record is a change
    else:
        old = getattr(instance, '_old_snapshot', None) or {}
        changes = _diff(old, new_snapshot)
        if changes:
            AuditLog.objects.create(
                model='Inventory', object_id=instance.pk, object_repr=str(instance),
                action='update', changes=changes
            )
            # Check if quantity was modified
            if 'quantity' in changes:
                quantity_changed = True
    
    # Invalidate forecast cache if inventory quantity changed
    if quantity_changed and instance.product_id:
        _invalidate_forecast_cache(instance.product_id)


@receiver(post_delete, sender=Inventory)
def inventory_post_delete(sender, instance: Inventory, **kwargs):
    AuditLog.objects.create(
        model='Inventory', object_id=instance.pk or 0, object_repr=str(instance),
        action='delete', changes=None
    )
