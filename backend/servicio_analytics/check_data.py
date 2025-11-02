from django.db import connection

cursor = connection.cursor()

# Check DailySalesMetrics
cursor.execute("SELECT COUNT(*) FROM analytics_daily_sales_metrics;")
daily_count = cursor.fetchone()[0]
print(f"DailySalesMetrics records: {daily_count}")

# Check ProductDemandMetrics  
cursor.execute("SELECT COUNT(*) FROM analytics_product_demand_metrics;")
product_count = cursor.fetchone()[0]
print(f"ProductDemandMetrics records: {product_count}")

# Check a sample record
if daily_count > 0:
    cursor.execute("SELECT date, total_sales, total_orders FROM analytics_daily_sales_metrics LIMIT 1;")
    sample = cursor.fetchone()
    print(f"Sample DailySalesMetrics: {sample}")
