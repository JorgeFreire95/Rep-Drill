#!/bin/bash
# ============================================================================
# Script de Verificación de Seguridad - Rep Drill
# ============================================================================
# Verifica configuraciones de seguridad críticas antes de deployment
# ============================================================================

set -e

echo "🔍 Rep Drill - Verificación de Seguridad"
echo "=========================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# ============================================================================
# 1. Verificar que existe .env
# ============================================================================
echo ""
echo "1️⃣  Verificando archivo .env..."
if [ ! -f .env ]; then
    echo -e "${RED}❌ ERROR: No se encuentra el archivo .env${NC}"
    echo "   Copia .env.example a .env y configura las variables"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Archivo .env encontrado${NC}"
fi

# ============================================================================
# 2. Verificar que .env está en .gitignore
# ============================================================================
echo ""
echo "2️⃣  Verificando .gitignore..."
if grep -q "^\.env$" .gitignore 2>/dev/null; then
    echo -e "${GREEN}✅ .env está en .gitignore${NC}"
else
    echo -e "${RED}❌ ERROR: .env NO está en .gitignore${NC}"
    echo "   Agrega '.env' al archivo .gitignore"
    ERRORS=$((ERRORS + 1))
fi

# ============================================================================
# 3. Verificar secretos hardcoded en código
# ============================================================================
echo ""
echo "3️⃣  Buscando secretos hardcoded..."

# Patrones peligrosos
DANGEROUS_PATTERNS=(
    "SECRET_KEY.*=.*['\"].*dev.*['\"]"
    "password.*=.*['\"]contraseña['\"]"
    "password.*=.*['\"]password['\"]"
    "PASSWORD.*=.*['\"]postgres['\"]"
    "API_KEY.*=.*['\"][a-zA-Z0-9]{20,}['\"]"
)

SECRETS_FOUND=0
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if grep -r -E "$pattern" backend/ --include="*.py" --include="*.yml" 2>/dev/null | grep -v ".pyc" | grep -v "__pycache__"; then
        SECRETS_FOUND=$((SECRETS_FOUND + 1))
    fi
done

if [ $SECRETS_FOUND -gt 0 ]; then
    echo -e "${RED}❌ ERROR: Se encontraron $SECRETS_FOUND secretos hardcoded${NC}"
    echo "   Mueve todos los secretos a variables de entorno (.env)"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No se encontraron secretos hardcoded obvios${NC}"
fi

# ============================================================================
# 4. Verificar configuración de DEBUG en producción
# ============================================================================
if [ -f .env ]; then
    echo ""
    echo "4️⃣  Verificando DEBUG mode..."
    
    ENVIRONMENT=$(grep "^ENVIRONMENT=" .env | cut -d '=' -f2)
    DEBUG=$(grep "^DEBUG=" .env | cut -d '=' -f2)
    
    if [ "$ENVIRONMENT" == "production" ] && [ "$DEBUG" == "True" ]; then
        echo -e "${RED}❌ ERROR: DEBUG=True en producción${NC}"
        echo "   Cambia DEBUG=False en .env"
        ERRORS=$((ERRORS + 1))
    elif [ "$ENVIRONMENT" == "production" ]; then
        echo -e "${GREEN}✅ DEBUG está desactivado en producción${NC}"
    else
        echo -e "${YELLOW}⚠️  WARNING: ENVIRONMENT no es 'production' (actual: $ENVIRONMENT)${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

# ============================================================================
# 5. Verificar ALLOWED_HOSTS
# ============================================================================
if [ -f .env ]; then
    echo ""
    echo "5️⃣  Verificando ALLOWED_HOSTS..."
    
    ALLOWED_HOSTS=$(grep "^ALLOWED_HOSTS=" .env | cut -d '=' -f2)
    
    if [[ "$ALLOWED_HOSTS" == "*" ]]; then
        echo -e "${RED}❌ ERROR: ALLOWED_HOSTS=* es inseguro${NC}"
        echo "   Especifica los dominios permitidos explícitamente"
        ERRORS=$((ERRORS + 1))
    elif [ -z "$ALLOWED_HOSTS" ]; then
        echo -e "${RED}❌ ERROR: ALLOWED_HOSTS no está configurado${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ ALLOWED_HOSTS configurado correctamente${NC}"
    fi
fi

# ============================================================================
# 6. Verificar que SECRET_KEY no es el valor de ejemplo
# ============================================================================
if [ -f .env ]; then
    echo ""
    echo "6️⃣  Verificando SECRET_KEY..."
    
    SECRET_KEY=$(grep "^DJANGO_SECRET_KEY=" .env | cut -d '=' -f2)
    
    if [[ "$SECRET_KEY" == *"CAMBIAR"* ]] || [[ "$SECRET_KEY" == *"dev-secret-key"* ]]; then
        echo -e "${RED}❌ ERROR: SECRET_KEY usa valor de ejemplo${NC}"
        echo "   Genera una SECRET_KEY única con:"
        echo "   python -c \"from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())\""
        ERRORS=$((ERRORS + 1))
    elif [ ${#SECRET_KEY} -lt 50 ]; then
        echo -e "${YELLOW}⚠️  WARNING: SECRET_KEY parece muy corta (menos de 50 caracteres)${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✅ SECRET_KEY configurada${NC}"
    fi
fi

# ============================================================================
# 7. Verificar passwords de base de datos
# ============================================================================
if [ -f .env ]; then
    echo ""
    echo "7️⃣  Verificando passwords de base de datos..."
    
    DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d '=' -f2)
    
    if [[ "$DB_PASSWORD" == *"CAMBIAR"* ]] || [[ "$DB_PASSWORD" == "contraseña" ]] || [[ "$DB_PASSWORD" == "password" ]]; then
        echo -e "${RED}❌ ERROR: DB_PASSWORD usa valor de ejemplo inseguro${NC}"
        ERRORS=$((ERRORS + 1))
    elif [ ${#DB_PASSWORD} -lt 12 ]; then
        echo -e "${YELLOW}⚠️  WARNING: DB_PASSWORD es muy corta (menos de 12 caracteres)${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✅ DB_PASSWORD configurada${NC}"
    fi
fi

# ============================================================================
# 8. Verificar Redis password
# ============================================================================
if [ -f .env ]; then
    echo ""
    echo "8️⃣  Verificando Redis password..."
    
    REDIS_PASSWORD=$(grep "^REDIS_PASSWORD=" .env | cut -d '=' -f2)
    
    if [[ "$REDIS_PASSWORD" == *"CAMBIAR"* ]] || [ -z "$REDIS_PASSWORD" ]; then
        echo -e "${RED}❌ ERROR: REDIS_PASSWORD no está configurada correctamente${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ REDIS_PASSWORD configurada${NC}"
    fi
fi

# ============================================================================
# 9. Verificar dependencias vulnerables (si pip-audit está instalado)
# ============================================================================
echo ""
echo "9️⃣  Verificando dependencias vulnerables..."

if command -v pip-audit &> /dev/null; then
    echo "Ejecutando pip-audit..."
    
    for service in auth personas inventario ventas analytics; do
        if [ -f "backend/servicio_$service/requirements.txt" ]; then
            echo "  Verificando servicio_$service..."
            if ! pip-audit -r "backend/servicio_$service/requirements.txt" --disable-pip; then
                echo -e "${YELLOW}⚠️  WARNING: Vulnerabilidades encontradas en servicio_$service${NC}"
                WARNINGS=$((WARNINGS + 1))
            fi
        fi
    done
else
    echo -e "${YELLOW}⚠️  pip-audit no está instalado (instalar con: pip install pip-audit)${NC}"
fi

# ============================================================================
# 10. Verificar archivos sensibles expuestos
# ============================================================================
echo ""
echo "🔟  Verificando archivos sensibles..."

SENSITIVE_FILES=(
    ".env"
    "*.pem"
    "*.key"
    "*.p12"
    "*.pfx"
    "*.secret"
    "*_secret.txt"
)

echo "Archivos sensibles que NO deberían estar en git:"
for pattern in "${SENSITIVE_FILES[@]}"; do
    if git ls-files --error-unmatch "$pattern" 2>/dev/null; then
        echo -e "${RED}❌ CRÍTICO: Archivo sensible en git: $pattern${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

# ============================================================================
# RESUMEN
# ============================================================================
echo ""
echo "=========================================="
echo "📊 RESUMEN DE VERIFICACIÓN"
echo "=========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ ¡Perfecto! No se encontraron problemas de seguridad${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS advertencias encontradas${NC}"
    echo "   El sistema puede desplegarse, pero revisa las advertencias"
    exit 0
else
    echo -e "${RED}❌ $ERRORS errores críticos encontrados${NC}"
    echo -e "${YELLOW}⚠️  $WARNINGS advertencias${NC}"
    echo ""
    echo "🛑 NO DESPLEGAR hasta resolver los errores críticos"
    exit 1
fi
