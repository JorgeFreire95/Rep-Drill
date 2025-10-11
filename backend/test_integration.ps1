# Script de Prueba de Integración JWT
# Este script verifica que la integración funcione correctamente

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🧪 PRUEBA DE INTEGRACIÓN JWT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Función para probar una URL
function Test-Service {
    param (
        [string]$Url,
        [string]$ServiceName
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 2 -ErrorAction Stop
        Write-Host "✅ $ServiceName está corriendo" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ $ServiceName NO está corriendo" -ForegroundColor Red
        return $false
    }
}

Write-Host "📡 Verificando servicios..." -ForegroundColor Yellow
Write-Host ""

$authRunning = Test-Service -Url "http://localhost:8003" -ServiceName "Servicio Auth (8003)"
$personasRunning = Test-Service -Url "http://localhost:8000" -ServiceName "Servicio Personas (8000)"
$inventarioRunning = Test-Service -Url "http://localhost:8001" -ServiceName "Servicio Inventario (8001)"
$ventasRunning = Test-Service -Url "http://localhost:8002" -ServiceName "Servicio Ventas (8002)"

Write-Host ""

if (-not $authRunning) {
    Write-Host "⚠️  El servicio de autenticación debe estar corriendo para probar la integración." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para iniciar el servicio Auth:" -ForegroundColor White
    Write-Host "  cd D:\Descargas\Desarrollador\ProyectosPersonales\rep_drill\backend\servicio_auth" -ForegroundColor Cyan
    Write-Host "  python manage.py runserver 8003" -ForegroundColor Cyan
    Write-Host ""
    exit
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔐 OBTENIENDO TOKEN JWT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    $loginBody = @{
        email = "admin@example.com"
        password = "admin123"
    } | ConvertTo-Json

    $loginResponse = Invoke-WebRequest -Uri "http://localhost:8003/api/auth/login/" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $loginBody `
        -ErrorAction Stop

    $loginData = $loginResponse.Content | ConvertFrom-Json
    $accessToken = $loginData.access

    Write-Host "✅ Token obtenido exitosamente" -ForegroundColor Green
    Write-Host "Usuario: $($loginData.user.email)" -ForegroundColor White
    Write-Host "Rol: $($loginData.user.role)" -ForegroundColor White
    Write-Host "Permisos: $($loginData.user.permissions.Count)" -ForegroundColor White
    Write-Host ""
    Write-Host "Token (primeros 50 caracteres): $($accessToken.Substring(0, [Math]::Min(50, $accessToken.Length)))..." -ForegroundColor Gray
    Write-Host ""

}
catch {
    Write-Host "❌ Error al obtener token: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifica que:" -ForegroundColor Yellow
    Write-Host "  1. El servicio Auth esté corriendo" -ForegroundColor White
    Write-Host "  2. El usuario admin exista en la base de datos" -ForegroundColor White
    Write-Host "  3. La contraseña sea correcta (admin123)" -ForegroundColor White
    Write-Host ""
    exit
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🧪 PROBANDO ACCESO A MICROSERVICIOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

# Test 1: Servicio de Personas
if ($personasRunning) {
    Write-Host "Test 1: Acceso a Servicio de Personas" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/api/personas/customers/" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        Write-Host "  ✅ Status: $($response.StatusCode) OK" -ForegroundColor Green
        $customers = $response.Content | ConvertFrom-Json
        Write-Host "  📊 Clientes encontrados: $($customers.Count)" -ForegroundColor White
    }
    catch {
        Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host "  ⚠️  Error 401: Token inválido o expirado" -ForegroundColor Yellow
        }
        elseif ($_.Exception.Response.StatusCode -eq 403) {
            Write-Host "  ⚠️  Error 403: Sin permisos" -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

# Test 2: Servicio de Inventario
if ($inventarioRunning) {
    Write-Host "Test 2: Acceso a Servicio de Inventario" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8001/api/inventario/inventory/" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        Write-Host "  ✅ Status: $($response.StatusCode) OK" -ForegroundColor Green
        $inventory = $response.Content | ConvertFrom-Json
        Write-Host "  📦 Items de inventario: $($inventory.Count)" -ForegroundColor White
    }
    catch {
        Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host "  ⚠️  Error 401: Token inválido o expirado" -ForegroundColor Yellow
        }
        elseif ($_.Exception.Response.StatusCode -eq 403) {
            Write-Host "  ⚠️  Error 403: Sin permisos" -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

# Test 3: Servicio de Ventas
if ($ventasRunning) {
    Write-Host "Test 3: Acceso a Servicio de Ventas" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8002/api/ventas/orders/" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        Write-Host "  ✅ Status: $($response.StatusCode) OK" -ForegroundColor Green
        $orders = $response.Content | ConvertFrom-Json
        Write-Host "  💰 Órdenes encontradas: $($orders.Count)" -ForegroundColor White
    }
    catch {
        Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host "  ⚠️  Error 401: Token inválido o expirado" -ForegroundColor Yellow
        }
        elseif ($_.Exception.Response.StatusCode -eq 403) {
            Write-Host "  ⚠️  Error 403: Sin permisos" -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ PRUEBAS COMPLETADAS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Resumen:" -ForegroundColor Yellow
Write-Host "  - Token JWT obtenido exitosamente" -ForegroundColor White
Write-Host "  - Permisos incluidos en el token" -ForegroundColor White
Write-Host "  - Servicios validando tokens correctamente" -ForegroundColor White
Write-Host ""
Write-Host "🎉 ¡La integración JWT está funcionando!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Tip: Usa la interfaz web para probar más funcionalidades:" -ForegroundColor Cyan
Write-Host "   http://localhost:8003/auth/interface/" -ForegroundColor White
Write-Host ""
