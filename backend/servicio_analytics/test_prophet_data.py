import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_analytics.settings')
django.setup()

from analytics.forecasting import DemandForecast

print("Testing Prophet data preparation...")
f = DemandForecast()
df = f.prepare_data(days_history=365)

print(f"Data shape: {df.shape}")
if not df.empty:
    print(f"Date range: {df['ds'].min()} to {df['ds'].max()}")
    print(f"Value stats: min={df['y'].min()}, max={df['y'].max()}, mean={df['y'].mean()}")
    print(f"\nFirst 5 rows:")
    print(df.head())
    print(f"\nLast 5 rows:")
    print(df.tail())
    
    # Test forecast
    print("\nAttempting forecast...")
    forecast_df = f.forecast_demand(periods=30, use_cache=False)
    if forecast_df is not None:
        print(f"Forecast shape: {forecast_df.shape}")
        print(f"Forecast columns: {forecast_df.columns.tolist()}")
        print(f"\nForecast sample:")
        print(forecast_df[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail())
    else:
        print("Forecast returned None!")
else:
    print("No data available!")
