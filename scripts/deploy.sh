#!/bin/bash
# ============================================================================
# Script de Deployment - Rep Drill
# ============================================================================
# Ejecuta verificaciones, tests y deployment del sistema
# Uso: ./scripts/deploy.sh [environment]
# Ejemplos:
#   ./scripts/deploy.sh development
#   ./scripts/deploy.sh production
# ============================================================================

set -e

ENVIRONMENT=${1:-development}
COMPOSE_FILE="docker-compose.yml"

if [ "$ENVIRONMENT" == "production" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
fi

echo "🚀 Rep Drill - Deployment Script"
echo "=================================="
echo "Environment: $ENVIRONMENT"
echo "Compose file: $COMPOSE_FILE"
echo ""

# ============================================================================
# 1. Verificar seguridad
# ============================================================================
echo "🔒 Paso 1: Verificación de seguridad..."
if [ -f "scripts/security_check.sh" ]; then
    bash scripts/security_check.sh
    if [ $? -ne 0 ]; then
        echo "❌ Verificación de seguridad falló"
        exit 1
    fi
else
    echo "⚠️  WARNING: scripts/security_check.sh no encontrado, saltando verificación"
fi
echo ""

# ============================================================================
# 2. Verificar que .env existe
# ============================================================================
echo "📝 Paso 2: Verificando configuración..."
if [ ! -f .env ]; then
    echo "❌ ERROR: Archivo .env no encontrado"
    echo "   Copia .env.example a .env y configura las variables"
    exit 1
fi
echo "✅ Configuración encontrada"
echo ""

# ============================================================================
# 3. Ejecutar tests (solo si no es producción directa)
# ============================================================================
if [ "$ENVIRONMENT" != "production" ]; then
    echo "🧪 Paso 3: Ejecutando tests..."
    
    # Tests del servicio de analytics (el único con tests por ahora)
    echo "  Testing servicio_analytics..."
    docker-compose run --rm analytics python manage.py test --parallel || {
        echo "❌ Tests fallaron"
        exit 1
    }
    
    echo "✅ Tests completados exitosamente"
    echo ""
else
    echo "⏭️  Paso 3: Tests saltados en deployment de producción"
    echo ""
fi

# ============================================================================
# 4. Build de imágenes Docker
# ============================================================================
echo "🐳 Paso 4: Building Docker images..."
docker-compose -f $COMPOSE_FILE build --parallel
echo "✅ Imágenes construidas"
echo ""

# ============================================================================
# 5. Detener contenedores anteriores (si existen)
# ============================================================================
echo "🛑 Paso 5: Deteniendo contenedores anteriores..."
docker-compose -f $COMPOSE_FILE down || true
echo ""

# ============================================================================
# 6. Iniciar servicios de infraestructura primero
# ============================================================================
echo "🗄️  Paso 6: Iniciando servicios de infraestructura..."
docker-compose -f $COMPOSE_FILE up -d db redis
echo "Esperando a que la base de datos esté lista..."
sleep 10
echo "✅ Infraestructura lista"
echo ""

# ============================================================================
# 7. Ejecutar migraciones
# ============================================================================
echo "📊 Paso 7: Ejecutando migraciones de base de datos..."

SERVICES=("auth" "personas" "inventario" "ventas" "analytics")

for service in "${SERVICES[@]}"; do
    echo "  Migrando servicio_$service..."
    docker-compose -f $COMPOSE_FILE run --rm $service python manage.py migrate --noinput || {
        echo "❌ Migraciones fallaron para $service"
        exit 1
    }
done

echo "✅ Migraciones completadas"
echo ""

# ============================================================================
# 8. Recolectar archivos estáticos
# ============================================================================
echo "📦 Paso 8: Recolectando archivos estáticos..."

for service in "${SERVICES[@]}"; do
    echo "  Collectstatic para servicio_$service..."
    docker-compose -f $COMPOSE_FILE run --rm $service python manage.py collectstatic --noinput || {
        echo "⚠️  WARNING: collectstatic falló para $service (puede ser normal si no tiene archivos estáticos)"
    }
done

echo "✅ Archivos estáticos recolectados"
echo ""

# ============================================================================
# 9. Iniciar todos los servicios
# ============================================================================
echo "🎉 Paso 9: Iniciando todos los servicios..."
docker-compose -f $COMPOSE_FILE up -d

echo "Esperando a que los servicios estén listos..."
sleep 15
echo ""

# ============================================================================
# 10. Verificar health checks
# ============================================================================
echo "💚 Paso 10: Verificando health de servicios..."

check_health() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=0
    
    echo "  Verificando $service en puerto $port..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s "http://localhost:$port/health/" > /dev/null 2>&1; then
            echo "  ✅ $service está saludable"
            return 0
        fi
        
        attempt=$((attempt + 1))
        sleep 2
    done
    
    echo "  ⚠️  WARNING: $service no responde health check"
    return 1
}

# Verificar servicios
check_health "auth" "8001" || true
check_health "personas" "8004" || true
check_health "inventario" "8003" || true
check_health "ventas" "8002" || true
check_health "analytics" "8005" || true

echo ""

# ============================================================================
# 11. Mostrar logs de servicios
# ============================================================================
echo "📋 Paso 11: Logs de servicios (últimas 20 líneas)..."
docker-compose -f $COMPOSE_FILE logs --tail=20
echo ""

# ============================================================================
# 12. Mostrar estado de contenedores
# ============================================================================
echo "🔍 Paso 12: Estado de contenedores..."
docker-compose -f $COMPOSE_FILE ps
echo ""

# ============================================================================
# RESUMEN
# ============================================================================
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETADO"
echo "=========================================="
echo ""
echo "📍 URLs de servicios:"
echo "  - Auth:       http://localhost:8001"
echo "  - Personas:   http://localhost:8004"
echo "  - Inventario: http://localhost:8003"
echo "  - Ventas:     http://localhost:8002"
echo "  - Analytics:  http://localhost:8005"
echo "  - Gateway:    http://localhost"
echo ""
echo "📝 Comandos útiles:"
echo "  - Ver logs:     docker-compose -f $COMPOSE_FILE logs -f"
echo "  - Detener:      docker-compose -f $COMPOSE_FILE down"
echo "  - Reiniciar:    docker-compose -f $COMPOSE_FILE restart"
echo "  - Shell:        docker-compose -f $COMPOSE_FILE exec <service> bash"
echo ""
echo "🎉 Sistema desplegado exitosamente en modo: $ENVIRONMENT"
