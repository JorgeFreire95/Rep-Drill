# Script para ejecutar tests de integración de Rep Drill
# Requiere que los servicios estén corriendo en Docker

param(
    [string]$TestPath = "tests/",
    [switch]$Coverage,
    [switch]$Verbose,
    [switch]$Html,
    [string]$Markers = ""
)

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  🧪 REP DRILL - INTEGRATION TESTS RUNNER" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que los servicios estén corriendo
Write-Host "🔍 Verificando servicios..." -ForegroundColor Yellow
Write-Host ""

$services = @{
    "Auth (8003)" = 8003
    "Personas (8000)" = 8000
    "Inventario (8001)" = 8001
    "Ventas (8002)" = 8002
}

$allRunning = $true

foreach($serviceName in $services.Keys) {
    $port = $services[$serviceName]
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$port/health/" -Method GET -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ $serviceName - Running" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $serviceName - Unhealthy (Status: $($response.StatusCode))" -ForegroundColor Red
            $allRunning = $false
        }
    }
    catch {
        Write-Host "  ❌ $serviceName - Not running" -ForegroundColor Red
        $allRunning = $false
    }
}

Write-Host ""

if (-not $allRunning) {
    Write-Host "⚠️  Algunos servicios no están corriendo!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📌 Para levantar los servicios:" -ForegroundColor Cyan
    Write-Host "   docker-compose -f docker-compose.dev.yml up -d" -ForegroundColor White
    Write-Host ""
    $continue = Read-Host "¿Deseas continuar de todos modos? (S/N)"
    if ($continue -ne "S" -and $continue -ne "s") {
        Write-Host "❌ Tests cancelados" -ForegroundColor Red
        exit 1
    }
}

# Construir comando pytest
$pytestCmd = "pytest"

# Agregar path de tests
$pytestCmd += " $TestPath"

# Agregar opciones
if ($Verbose) {
    $pytestCmd += " -v"
} else {
    $pytestCmd += " -q"
}

if ($Coverage) {
    $pytestCmd += " --cov=. --cov-report=term-missing"
}

if ($Html) {
    $pytestCmd += " --html=test-report.html --self-contained-html"
}

if ($Markers) {
    $pytestCmd += " -m $Markers"
}

# Mostrar comando
Write-Host "📋 Ejecutando:" -ForegroundColor Cyan
Write-Host "   $pytestCmd" -ForegroundColor White
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# Ejecutar tests
try {
    Invoke-Expression $pytestCmd
    $exitCode = $LASTEXITCODE
    
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    
    if ($exitCode -eq 0) {
        Write-Host "  ✅ TODOS LOS TESTS PASARON" -ForegroundColor Green
    } else {
        Write-Host "  ❌ ALGUNOS TESTS FALLARON" -ForegroundColor Red
    }
    
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""
    
    if ($Html) {
        Write-Host "📊 Reporte HTML generado: test-report.html" -ForegroundColor Cyan
        Write-Host ""
        $openReport = Read-Host "¿Abrir reporte en navegador? (S/N)"
        if ($openReport -eq "S" -or $openReport -eq "s") {
            Start-Process "test-report.html"
        }
    }
    
    exit $exitCode
}
catch {
    Write-Host ""
    Write-Host "❌ Error al ejecutar tests:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    
    Write-Host "💡 Asegúrate de tener pytest instalado:" -ForegroundColor Yellow
    Write-Host "   pip install -r requirements-test.txt" -ForegroundColor White
    Write-Host ""
    
    exit 1
}
