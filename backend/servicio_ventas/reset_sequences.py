#!/usr/bin/env python
"""
Script para resetear las secuencias de IDs en PostgreSQL
Esto soluciona el error: "llave duplicada viola restricción de unicidad"
"""

import os
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_ventas.settings')
django.setup()

from django.db import connection

def reset_sequences():
    """Resetea todas las secuencias de autoincremento en las tablas"""
    
    with connection.cursor() as cursor:
        # Obtener todas las tablas de la aplicación
        tables = [
            'orders',
            'order_details',
            'shipments',
            'payments'
        ]
        
        print("🔧 Reseteando secuencias de IDs...\n")
        
        for table in tables:
            try:
                # PostgreSQL: Resetear la secuencia al máximo ID + 1
                cursor.execute(f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table}', 'id'),
                        COALESCE((SELECT MAX(id) FROM {table}), 0) + 1,
                        false
                    );
                """)
                
                result = cursor.fetchone()
                print(f"✅ {table}: Secuencia reseteada a {result[0] if result else 'N/A'}")
                
            except Exception as e:
                print(f"❌ Error en {table}: {e}")
        
        print("\n✅ Proceso completado!")
        print("\nAhora puedes intentar crear órdenes nuevamente.")

if __name__ == '__main__':
    reset_sequences()
