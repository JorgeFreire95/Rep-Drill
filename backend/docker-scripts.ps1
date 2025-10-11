# Scripts de Docker para Rep Drill Microservices
# PowerShell Script para manejar fácilmente los contenedores

param(
    [Parameter(Position=0)]
    [ValidateSet("dev-up", "dev-down", "dev-logs", "dev-build", "prod-up", "prod-down", "prod-logs", "clean", "status", "help")]
    [string]$Command = "help"
)

function Show-Help {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "🐳 Rep Drill Docker Management" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Comandos disponibles:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  dev-up      " -ForegroundColor Green -NoNewline
    Write-Host "Levantar entorno de desarrollo"
    Write-Host "  dev-down    " -ForegroundColor Red -NoNewline
    Write-Host "Detener entorno de desarrollo"
    Write-Host "  dev-logs    " -ForegroundColor Blue -NoNewline
    Write-Host "Ver logs del entorno de desarrollo"
    Write-Host "  dev-build   " -ForegroundColor Magenta -NoNewline
    Write-Host "Reconstruir imágenes de desarrollo"
    Write-Host ""
    Write-Host "  prod-up     " -ForegroundColor Green -NoNewline
    Write-Host "Levantar entorno de producción (con Nginx)"
    Write-Host "  prod-down   " -ForegroundColor Red -NoNewline
    Write-Host "Detener entorno de producción"
    Write-Host "  prod-logs   " -ForegroundColor Blue -NoNewline
    Write-Host "Ver logs del entorno de producción"
    Write-Host ""
    Write-Host "  status      " -ForegroundColor White -NoNewline
    Write-Host "Ver estado de los contenedores"
    Write-Host "  clean       " -ForegroundColor Yellow -NoNewline
    Write-Host "Limpiar contenedores, volúmenes e imágenes"
    Write-Host "  help        " -ForegroundColor Cyan -NoNewline
    Write-Host "Mostrar esta ayuda"
    Write-Host ""
    Write-Host "Ejemplos:" -ForegroundColor Yellow
    Write-Host "  .\docker-scripts.ps1 dev-up" -ForegroundColor White
    Write-Host "  .\docker-scripts.ps1 dev-logs" -ForegroundColor White
    Write-Host "  .\docker-scripts.ps1 clean" -ForegroundColor White
    Write-Host ""
}

function Start-Development {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "🚀 INICIANDO ENTORNO DE DESARROLLO" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "📦 Construyendo y levantando servicios..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml up -d --build
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Entorno de desarrollo iniciado exitosamente!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🌐 URLs disponibles:" -ForegroundColor Cyan
        Write-Host "  Auth Service:      http://localhost:8003" -ForegroundColor White
        Write-Host "  Personas Service:  http://localhost:8000" -ForegroundColor White
        Write-Host "  Inventario Service:http://localhost:8001" -ForegroundColor White
        Write-Host "  Ventas Service:    http://localhost:8002" -ForegroundColor White
        Write-Host "  Database:          localhost:5432" -ForegroundColor White
        Write-Host ""
        Write-Host "🧪 Interfaz de pruebas:" -ForegroundColor Magenta
        Write-Host "  http://localhost:8003/auth/interface/" -ForegroundColor White
        Write-Host ""
        Write-Host "📊 Ver logs: .\docker-scripts.ps1 dev-logs" -ForegroundColor Blue
    } else {
        Write-Host "❌ Error al iniciar el entorno" -ForegroundColor Red
    }
}

function Stop-Development {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "🛑 DETENIENDO ENTORNO DE DESARROLLO" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    
    docker-compose -f docker-compose.dev.yml down
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Entorno de desarrollo detenido" -ForegroundColor Green
    } else {
        Write-Host "❌ Error al detener el entorno" -ForegroundColor Red
    }
}

function Show-DevelopmentLogs {
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host "📄 LOGS DEL ENTORNO DE DESARROLLO" -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Presiona Ctrl+C para salir de los logs" -ForegroundColor Yellow
    Write-Host ""
    
    docker-compose -f docker-compose.dev.yml logs -f
}

function Build-Development {
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "🔨 RECONSTRUYENDO IMÁGENES DE DESARROLLO" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host ""
    
    docker-compose -f docker-compose.dev.yml build --no-cache
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Imágenes reconstruidas exitosamente" -ForegroundColor Green
        Write-Host "💡 Ejecuta 'dev-up' para reiniciar los servicios" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Error al reconstruir las imágenes" -ForegroundColor Red
    }
}

function Start-Production {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "🚀 INICIANDO ENTORNO DE PRODUCCIÓN" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "📦 Construyendo y levantando servicios con Nginx..." -ForegroundColor Yellow
    docker-compose -f docker-compose.yml up -d --build
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Entorno de producción iniciado exitosamente!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🌐 URLs disponibles:" -ForegroundColor Cyan
        Write-Host "  Gateway (Nginx):   http://localhost" -ForegroundColor White
        Write-Host "  Auth Service:      http://localhost/auth/" -ForegroundColor White
        Write-Host "  Personas Service:  http://localhost/personas/" -ForegroundColor White
        Write-Host "  Inventario Service:http://localhost/inventario/" -ForegroundColor White
        Write-Host "  Ventas Service:    http://localhost/ventas/" -ForegroundColor White
        Write-Host "  PgAdmin:           http://localhost:5050" -ForegroundColor White
        Write-Host ""
        Write-Host "🧪 Interfaz de pruebas:" -ForegroundColor Magenta
        Write-Host "  http://localhost/auth/interface/" -ForegroundColor White
    } else {
        Write-Host "❌ Error al iniciar el entorno" -ForegroundColor Red
    }
}

function Stop-Production {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "🛑 DETENIENDO ENTORNO DE PRODUCCIÓN" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    
    docker-compose -f docker-compose.yml down
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Entorno de producción detenido" -ForegroundColor Green
    } else {
        Write-Host "❌ Error al detener el entorno" -ForegroundColor Red
    }
}

function Show-ProductionLogs {
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host "📄 LOGS DEL ENTORNO DE PRODUCCIÓN" -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Presiona Ctrl+C para salir de los logs" -ForegroundColor Yellow
    Write-Host ""
    
    docker-compose -f docker-compose.yml logs -f
}

function Show-Status {
    Write-Host "========================================" -ForegroundColor White
    Write-Host "📊 ESTADO DE CONTENEDORES" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor White
    Write-Host ""
    
    Write-Host "🔍 Contenedores Rep Drill:" -ForegroundColor Yellow
    docker ps -a --filter "name=rep_drill" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    Write-Host ""
    Write-Host "💾 Volúmenes:" -ForegroundColor Yellow
    docker volume ls --filter "name=rep_drill" --format "table {{.Name}}\t{{.Driver}}"
    
    Write-Host ""
    Write-Host "🌐 Redes:" -ForegroundColor Yellow
    docker network ls --filter "name=rep_drill" --format "table {{.Name}}\t{{.Driver}}"
}

function Clean-Environment {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "🧹 LIMPIEZA DE ENTORNO DOCKER" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    
    $confirmation = Read-Host "¿Estás seguro de que quieres limpiar todo? (s/N)"
    if ($confirmation -eq 's' -or $confirmation -eq 'S') {
        Write-Host ""
        Write-Host "🛑 Deteniendo todos los contenedores..." -ForegroundColor Red
        docker-compose -f docker-compose.dev.yml down 2>$null
        docker-compose -f docker-compose.yml down 2>$null
        
        Write-Host "🗑️  Eliminando contenedores Rep Drill..." -ForegroundColor Yellow
        docker ps -a --filter "name=rep_drill" -q | ForEach-Object { docker rm $_ 2>$null }
        
        Write-Host "💾 Eliminando volúmenes Rep Drill..." -ForegroundColor Yellow
        docker volume ls --filter "name=rep_drill" -q | ForEach-Object { docker volume rm $_ 2>$null }
        
        Write-Host "🌐 Eliminando redes Rep Drill..." -ForegroundColor Yellow
        docker network ls --filter "name=rep_drill" -q | ForEach-Object { docker network rm $_ 2>$null }
        
        Write-Host "🖼️  Eliminando imágenes no utilizadas..." -ForegroundColor Yellow
        docker image prune -f
        
        Write-Host ""
        Write-Host "✅ Limpieza completada!" -ForegroundColor Green
    } else {
        Write-Host "❌ Operación cancelada" -ForegroundColor Red
    }
}

# Ejecutar comando según parámetro
switch ($Command) {
    "dev-up" { Start-Development }
    "dev-down" { Stop-Development }
    "dev-logs" { Show-DevelopmentLogs }
    "dev-build" { Build-Development }
    "prod-up" { Start-Production }
    "prod-down" { Stop-Production }
    "prod-logs" { Show-ProductionLogs }
    "status" { Show-Status }
    "clean" { Clean-Environment }
    "help" { Show-Help }
    default { Show-Help }
}