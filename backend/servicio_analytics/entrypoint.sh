#!/bin/bash
# Script de inicialización para el servicio de analytics

set -e

echo "=== Iniciando servicio de Analytics ==="

# Esperar a que PostgreSQL esté listo
echo "Esperando a PostgreSQL..."
for i in {1..30}; do
    if pg_isready -h ${DB_HOST:-postgres} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} > /dev/null 2>&1; then
        echo "PostgreSQL está listo!"
        break
    fi
    echo "PostgreSQL no está listo - esperando... intento $i/30"
    sleep 2
done

# Esperar a que Redis esté listo
echo "Esperando a Redis..."
for i in {1..10}; do
    if redis-cli -h ${REDIS_HOST:-redis} ping > /dev/null 2>&1; then
        echo "Redis está listo!"
        break
    fi
    echo "Redis no está listo - intento $i/10..."
    sleep 2
done

echo "Redis check complete - continuando..."

# Ejecutar migraciones
echo "Ejecutando migraciones..."
python manage.py makemigrations || true
python manage.py migrate --noinput || true

# Recolectar archivos estáticos
echo "Recolectando archivos estáticos..."
python manage.py collectstatic --noinput || true

echo "=== Servicio de Analytics inicializado ==="

# Iniciar el servidor
exec "$@"
