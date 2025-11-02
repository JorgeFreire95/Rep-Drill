#!/bin/bash
# Script de backup automático para PostgreSQL
# Uso: bash scripts/backup_database.sh

set -e

# Cargar variables de entorno
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Configuración
DB_NAME="${DB_NAME:-rep_drill}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="backups/database"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/rep_drill_backup_${TIMESTAMP}.sql"
RETENTION_DAYS=30

echo "=========================================="
echo "  BACKUP DE BASE DE DATOS - REP DRILL"
echo "=========================================="
echo "Base de datos: $DB_NAME"
echo "Timestamp: $TIMESTAMP"
echo ""

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

# 1. Backup completo con pg_dump
echo "📦 Creando backup completo..."
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --verbose \
    --format=custom \
    --file="$BACKUP_FILE.dump"

# 2. Backup en SQL plano (para inspección manual)
echo "📄 Creando backup SQL plano..."
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --verbose \
    --format=plain \
    --file="$BACKUP_FILE"

# 3. Comprimir backups
echo "🗜️  Comprimiendo backups..."
gzip "$BACKUP_FILE.dump"
gzip "$BACKUP_FILE"

# 4. Calcular checksums
echo "🔐 Calculando checksums..."
sha256sum "$BACKUP_FILE.dump.gz" > "$BACKUP_FILE.dump.gz.sha256"
sha256sum "$BACKUP_FILE.gz" > "$BACKUP_FILE.gz.sha256"

# 5. Verificar tamaño del backup
BACKUP_SIZE=$(du -h "$BACKUP_FILE.dump.gz" | cut -f1)
echo "💾 Tamaño del backup: $BACKUP_SIZE"

# 6. Limpiar backups antiguos (mantener últimos 30 días)
echo "🧹 Limpiando backups antiguos (>$RETENTION_DAYS días)..."
find "$BACKUP_DIR" -name "*.gz" -type f -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.sha256" -type f -mtime +$RETENTION_DAYS -delete

# 7. Listar backups disponibles
echo ""
echo "📋 Backups disponibles:"
ls -lh "$BACKUP_DIR" | tail -n 10

echo ""
echo "=========================================="
echo "  ✅ BACKUP COMPLETADO EXITOSAMENTE"
echo "=========================================="
echo "📁 Archivo: $BACKUP_FILE.dump.gz"
echo "💾 Tamaño: $BACKUP_SIZE"
echo "🔐 Checksum: $BACKUP_FILE.dump.gz.sha256"
echo ""
echo "Para restaurar:"
echo "  bash scripts/restore_database.sh $BACKUP_FILE.dump.gz"
echo ""
