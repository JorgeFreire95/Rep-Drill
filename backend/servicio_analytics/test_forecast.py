import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from analytics.forecasting import BatchDemandForecast

fc = BatchDemandForecast()
result = fc.forecast_top_products(top_n=10, periods=30)

print(f"\n{'='*60}")
print(f"RESULTADO DEL FORECASTING")
print(f"{'='*60}")
print(f"\nTotal productos con forecast: {len(result)}")

for i, r in enumerate(result, 1):
    status = "✓" if r['status'] == 'success' else "✗"
    print(f"\n{i}. {status} {r['product_name']}")
    print(f"   - ID: {r['product_id']}")
    print(f"   - SKU: {r['product_code']}")
    print(f"   - Status: {r['status']}")
    if r['status'] == 'success':
        print(f"   - Predicciones: {len(r['forecast'])} días")
    else:
        print(f"   - Mensaje: {r.get('message', 'N/A')}")

print(f"\n{'='*60}\n")
