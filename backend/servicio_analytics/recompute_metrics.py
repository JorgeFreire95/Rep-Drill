"""
Recompute analytics metrics after sales backfill.
- Calculate product demand metrics for last 180 days
- Calculate daily sales metrics for each day in last 30 days (fast path)
"""
import os
import sys
import django
from datetime import date, timedelta

sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_analytics.settings')
django.setup()

from analytics.services import MetricsCalculator


def main():
    calc = MetricsCalculator()
    print("=== Recalculando métricas de demanda (180 días) ===")
    calc.calculate_product_demand_metrics(period_days=180)

    print("=== Recalculando métricas diarias (últimos 30 días) ===")
    today = date.today()
    for i in range(1, 31):
        target = today - timedelta(days=i)
        calc.calculate_daily_sales_metrics(target_date=target)
    print("✅ Recomputación completada")


if __name__ == '__main__':
    main()
