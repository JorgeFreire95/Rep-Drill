from django.db import connection

cursor = connection.cursor()
cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%analytics%';")
tables = cursor.fetchall()
print("Analytics tables:")
for table in tables:
    print(f"  - {table[0]}")
if not tables:
    print("  No analytics tables found!")
