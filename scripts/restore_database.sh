#!/bin/bash
# Script para restaurar backup de PostgreSQL
# Uso: bash scripts/restore_database.sh backups/database/rep_drill_backup_YYYYMMDD_HHMMSS.sql.dump.gz

set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Error: Debes proporcionar el archivo de backup"
    echo "Uso: bash scripts/restore_database.sh <backup_file.dump.gz>"
    echo ""
    echo "Backups disponibles:"
    ls -lh backups/database/*.dump.gz 2>/dev/null || echo "No hay backups disponibles"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: El archivo $BACKUP_FILE no existe"
    exit 1
fi

# Cargar variables de entorno
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

DB_NAME="${DB_NAME:-rep_drill}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
TEMP_DIR=$(mktemp -d)
EXTRACTED_FILE="$TEMP_DIR/backup.dump"

echo "=========================================="
echo "  RESTAURACIÓN DE BASE DE DATOS"
echo "=========================================="
echo "Base de datos: $DB_NAME"
echo "Backup: $BACKUP_FILE"
echo ""
echo "⚠️  ADVERTENCIA: Esto SOBRESCRIBIRÁ la base de datos actual"
read -p "¿Continuar? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restauración cancelada"
    exit 0
fi

# 1. Verificar checksum si existe
if [ -f "$BACKUP_FILE.sha256" ]; then
    echo "🔐 Verificando integridad del backup..."
    sha256sum -c "$BACKUP_FILE.sha256" || {
        echo "❌ Error: El checksum no coincide. El archivo puede estar corrupto."
        exit 1
    }
    echo "✅ Checksum verificado"
fi

# 2. Descomprimir backup
echo "📦 Descomprimiendo backup..."
gunzip -c "$BACKUP_FILE" > "$EXTRACTED_FILE"

# 3. Crear backup de la base de datos actual
echo "💾 Creando backup de seguridad de la base de datos actual..."
SAFETY_BACKUP="backups/database/pre_restore_$(date +%Y%m%d_%H%M%S).sql.dump"
mkdir -p backups/database
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=custom \
    --file="$SAFETY_BACKUP" || echo "⚠️  No se pudo crear backup de seguridad"

# 4. Detener aplicaciones
echo "⏸️  Deteniendo servicios de aplicación..."
docker-compose stop auth personas inventario ventas analytics analytics_worker analytics_beat || true

# 5. Eliminar conexiones activas
echo "🔌 Cerrando conexiones activas a la base de datos..."
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" || true

# 6. Eliminar y recrear base de datos
echo "🗑️  Eliminando base de datos existente..."
PGPASSWORD="$DB_PASSWORD" dropdb \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    --if-exists \
    "$DB_NAME"

echo "📝 Creando base de datos nueva..."
PGPASSWORD="$DB_PASSWORD" createdb \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    "$DB_NAME"

# 7. Restaurar backup
echo "♻️  Restaurando backup..."
PGPASSWORD="$DB_PASSWORD" pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --verbose \
    --no-owner \
    --no-acl \
    "$EXTRACTED_FILE"

# 8. Ejecutar migraciones (opcional)
echo "🔄 Ejecutando migraciones..."
docker-compose run --rm auth python manage.py migrate || true
docker-compose run --rm personas python manage.py migrate || true
docker-compose run --rm inventario python manage.py migrate || true
docker-compose run --rm ventas python manage.py migrate || true
docker-compose run --rm analytics python manage.py migrate || true

# 9. Reiniciar servicios
echo "🚀 Reiniciando servicios..."
docker-compose start auth personas inventario ventas analytics analytics_worker analytics_beat

# 10. Limpiar archivos temporales
echo "🧹 Limpiando archivos temporales..."
rm -rf "$TEMP_DIR"

echo ""
echo "=========================================="
echo "  ✅ RESTAURACIÓN COMPLETADA"
echo "=========================================="
echo "📁 Backup restaurado: $BACKUP_FILE"
echo "💾 Backup de seguridad: $SAFETY_BACKUP"
echo ""
echo "⚠️  Verifica que la aplicación funciona correctamente"
echo "Si hay problemas, puedes restaurar el backup de seguridad:"
echo "  bash scripts/restore_database.sh $SAFETY_BACKUP"
echo ""
