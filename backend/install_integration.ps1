# Script de Instalación de Integración JWT para Microservicios
# PowerShell Script

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "🔧 Instalando Integración JWT" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Definir la SECRET_KEY compartida (debe ser la misma para todos)
$SECRET_KEY = "django-insecure-54)3sn^7k9btm5@h=ukrvve+#g&tnad=8@r6sxvk3r)zno59!b"

# Crear archivo .env compartido en la raíz si no existe
$ENV_FILE = "D:\Descargas\Desarrollador\ProyectosPersonales\rep_drill\backend\.env"
if (-Not (Test-Path $ENV_FILE)) {
    Write-Host "📝 Creando archivo .env compartido..." -ForegroundColor Yellow
    @"
# Shared Secret Key for JWT - IMPORTANTE: Cambiar en producción
SECRET_KEY=$SECRET_KEY

# Database Configuration
DATABASE_DB=rep_drill
DATABASE_USER=postgres
DATABASE_PASSWORD=root
DATABASE_SERVER=localhost
DATABASE_PORT=5432

# Debug Mode
DEBUG=True

# Services URLs
AUTH_SERVICE_URL=http://localhost:8003
PERSONAS_SERVICE_URL=http://localhost:8000
INVENTARIO_SERVICE_URL=http://localhost:8001
VENTAS_SERVICE_URL=http://localhost:8002
"@ | Out-File -FilePath $ENV_FILE -Encoding UTF8
    Write-Host "✅ Archivo .env creado" -ForegroundColor Green
} else {
    Write-Host "✅ Archivo .env ya existe" -ForegroundColor Green
}

Write-Host ""

# Función para instalar dependencias en un servicio
function Install-ServiceDependencies {
    param (
        [string]$ServicePath,
        [string]$ServiceName
    )
    
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host "📦 $ServiceName" -ForegroundColor Cyan
    Write-Host "=====================================" -ForegroundColor Cyan
    
    if (Test-Path "$ServicePath\venv") {
        Write-Host "Activando entorno virtual..." -ForegroundColor Yellow
        & "$ServicePath\venv\Scripts\pip.exe" install -r "$ServicePath\requirements.txt"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Dependencias instaladas correctamente" -ForegroundColor Green
        } else {
            Write-Host "❌ Error instalando dependencias" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️  No se encontró entorno virtual en $ServicePath" -ForegroundColor Yellow
        Write-Host "   Instala manualmente con: pip install -r requirements.txt" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

# Instalar dependencias en cada microservicio
$BACKEND_PATH = "D:\Descargas\Desarrollador\ProyectosPersonales\rep_drill\backend"

Install-ServiceDependencies -ServicePath "$BACKEND_PATH\servicio_auth" -ServiceName "Servicio de Autenticación"
Install-ServiceDependencies -ServicePath "$BACKEND_PATH\servicio_personas" -ServiceName "Servicio de Personas"
Install-ServiceDependencies -ServicePath "$BACKEND_PATH\servicio_inventario" -ServiceName "Servicio de Inventario"
Install-ServiceDependencies -ServicePath "$BACKEND_PATH\servicio_ventas" -ServiceName "Servicio de Ventas"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "✅ INTEGRACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Yellow
Write-Host "1. Asegúrate que todos los servicios usen la misma SECRET_KEY" -ForegroundColor White
Write-Host "2. Reinicia todos los microservicios" -ForegroundColor White
Write-Host "3. Prueba los permisos con tokens JWT" -ForegroundColor White
Write-Host ""
Write-Host "📖 Lee INTEGRACION_MICROSERVICIOS.md para más detalles" -ForegroundColor Cyan
Write-Host ""
