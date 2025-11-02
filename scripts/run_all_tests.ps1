# Script para ejecutar todos los tests con coverage
# Uso: .\scripts\run_all_tests.ps1

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  REP DRILL - EJECUTANDO SUITE COMPLETA DE TESTS" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

$services = @("servicio_auth", "servicio_personas", "servicio_inventario", "servicio_ventas")
$totalTests = 0
$passedServices = 0
$failedServices = 0

foreach ($service in $services) {
    Write-Host ""
    Write-Host "📦 Servicio: $service" -ForegroundColor Yellow
    Write-Host "-" * 70
    
    $path = "backend\$service"
    
    if (Test-Path $path) {
        Push-Location $path
        
        # Ejecutar pytest
        $output = pytest --cov --cov-report=term-missing --cov-report=html 2>&1
        $exitCode = $LASTEXITCODE
        
        Write-Host $output
        
        if ($exitCode -eq 0) {
            Write-Host "✅ Tests de $service: PASSED" -ForegroundColor Green
            $passedServices++
        } else {
            Write-Host "❌ Tests de $service: FAILED" -ForegroundColor Red
            $failedServices++
        }
        
        # Contar tests
        $testCount = ($output | Select-String "passed").Matches.Count
        if ($testCount -gt 0) {
            $totalTests += $testCount
        }
        
        Pop-Location
    } else {
        Write-Host "⚠️  Directorio no encontrado: $path" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  RESUMEN DE TESTS" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "Total de servicios: $($services.Count)" -ForegroundColor White
Write-Host "Servicios exitosos: $passedServices" -ForegroundColor Green
Write-Host "Servicios fallidos: $failedServices" -ForegroundColor Red
Write-Host "Total de tests: ~$totalTests" -ForegroundColor White
Write-Host ""

if ($failedServices -eq 0) {
    Write-Host "🎉 ¡Todos los tests pasaron exitosamente!" -ForegroundColor Green
    Write-Host "📊 Reportes de coverage en: backend\<servicio>\htmlcov\index.html" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "⚠️  Algunos tests fallaron. Revisa los logs arriba." -ForegroundColor Yellow
    exit 1
}
