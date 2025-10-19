# 🚀 Demo de Swagger - Rep Drill
# Script interactivo para explorar la documentación API

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "    🚀 DEMO DE SWAGGER - REP DRILL 🚀" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# URLs de los servicios
$urls = @{
    "Auth" = "http://localhost:8003/api/docs/"
    "Personas" = "http://localhost:8000/api/docs/"
    "Inventario" = "http://localhost:8001/api/docs/"
    "Ventas" = "http://localhost:8002/api/docs/"
}

# Función para mostrar el menú
function Show-Menu {
    Write-Host ""
    Write-Host "📚 SERVICIOS DISPONIBLES:" -ForegroundColor Yellow
    Write-Host "  1) 🔐 Servicio de Autenticación (Puerto 8003)" -ForegroundColor Green
    Write-Host "  2) 👥 Servicio de Personas (Puerto 8000)" -ForegroundColor Green
    Write-Host "  3) 📦 Servicio de Inventario (Puerto 8001)" -ForegroundColor Green
    Write-Host "  4) 💰 Servicio de Ventas (Puerto 8002)" -ForegroundColor Green
    Write-Host "  5) 🌐 Abrir TODOS los servicios" -ForegroundColor Magenta
    Write-Host "  6) 🧪 DEMO: Obtener Token JWT" -ForegroundColor Cyan
    Write-Host "  7) 📊 Ver estado de servicios" -ForegroundColor White
    Write-Host "  0) ❌ Salir" -ForegroundColor Red
    Write-Host ""
}

# Función para verificar el estado de un servicio
function Test-Service {
    param([string]$Url, [string]$Name)
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 3 -ErrorAction Stop
        Write-Host "✅ $Name - OK (Status: $($response.StatusCode))" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ $Name - ERROR" -ForegroundColor Red
        return $false
    }
}

# Función para obtener token JWT
function Get-JWTToken {
    Write-Host ""
    Write-Host "🔐 OBTENIENDO TOKEN JWT..." -ForegroundColor Cyan
    Write-Host ""
    
    # Credenciales de ejemplo
    Write-Host "📧 Email: admin@example.com" -ForegroundColor Gray
    Write-Host "🔑 Password: admin123" -ForegroundColor Gray
    Write-Host ""
    
    $body = @{
        email = "admin@example.com"
        password = "admin123"
    } | ConvertTo-Json
    
    try {
        Write-Host "⏳ Enviando petición..." -ForegroundColor Yellow
        
        $response = Invoke-RestMethod -Uri "http://localhost:8003/api/v1/auth/token/" `
                                       -Method POST `
                                       -Body $body `
                                       -ContentType "application/json" `
                                       -ErrorAction Stop
        
        Write-Host ""
        Write-Host "✅ TOKEN OBTENIDO EXITOSAMENTE!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 INFORMACIÓN DEL TOKEN:" -ForegroundColor Cyan
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
        
        # Mostrar información del usuario
        if ($response.user) {
            Write-Host "👤 Usuario ID: $($response.user.id)" -ForegroundColor White
            Write-Host "📧 Email: $($response.user.email)" -ForegroundColor White
            Write-Host "🎭 Rol: $($response.user.role)" -ForegroundColor White
            
            if ($response.user.permissions) {
                $permCount = $response.user.permissions.Count
                Write-Host "🔑 Permisos: $permCount permisos configurados" -ForegroundColor White
                
                Write-Host ""
                Write-Host "📝 PRIMEROS 10 PERMISOS:" -ForegroundColor Yellow
                $response.user.permissions | Select-Object -First 10 | ForEach-Object {
                    Write-Host "   • $_" -ForegroundColor Gray
                }
                
                if ($permCount -gt 10) {
                    Write-Host "   ... y $($permCount - 10) permisos más" -ForegroundColor DarkGray
                }
            }
        }
        
        Write-Host ""
        Write-Host "🔑 ACCESS TOKEN (para usar en Swagger):" -ForegroundColor Cyan
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
        
        # Mostrar el token truncado
        $token = $response.access
        $tokenPreview = $token.Substring(0, [Math]::Min(50, $token.Length))
        Write-Host "$tokenPreview..." -ForegroundColor Yellow
        Write-Host ""
        
        # Copiar al portapapeles
        Write-Host "📋 ¿Deseas copiar el token completo al portapapeles? (S/N)" -ForegroundColor Cyan
        $copy = Read-Host
        
        if ($copy -eq "S" -or $copy -eq "s") {
            Set-Clipboard -Value $token
            Write-Host "✅ Token copiado al portapapeles!" -ForegroundColor Green
            Write-Host ""
            Write-Host "🎯 PASOS SIGUIENTES:" -ForegroundColor Yellow
            Write-Host "1. Ve a cualquier Swagger UI" -ForegroundColor White
            Write-Host "2. Haz clic en el botón 'Authorize' 🔓 (arriba a la derecha)" -ForegroundColor White
            Write-Host "3. Pega el token (sin 'Bearer', solo el token)" -ForegroundColor White
            Write-Host "4. Haz clic en 'Authorize' y luego 'Close'" -ForegroundColor White
            Write-Host "5. ¡Ahora puedes probar cualquier endpoint! 🚀" -ForegroundColor White
        }
        
        Write-Host ""
        
        # Guardar token en variable de entorno de la sesión
        $env:REP_DRILL_TOKEN = $token
        Write-Host "💾 Token guardado en: `$env:REP_DRILL_TOKEN" -ForegroundColor Gray
        
        Write-Host ""
        return $token
    }
    catch {
        Write-Host ""
        Write-Host "❌ ERROR AL OBTENER TOKEN" -ForegroundColor Red
        Write-Host "Detalles: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "⚠️ POSIBLES CAUSAS:" -ForegroundColor Yellow
        Write-Host "• El servicio de autenticación no está corriendo" -ForegroundColor White
        Write-Host "• Las credenciales son incorrectas" -ForegroundColor White
        Write-Host "• No existe el usuario en la base de datos" -ForegroundColor White
        Write-Host ""
        return $null
    }
}

# Función para verificar todos los servicios
function Show-ServicesStatus {
    Write-Host ""
    Write-Host "📊 VERIFICANDO ESTADO DE SERVICIOS..." -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host ""
    
    $authOk = Test-Service "http://localhost:8003/api/schema/" "Autenticación"
    $personasOk = Test-Service "http://localhost:8000/api/schema/" "Personas"
    $inventarioOk = Test-Service "http://localhost:8001/api/schema/" "Inventario"
    $ventasOk = Test-Service "http://localhost:8002/api/schema/" "Ventas"
    
    Write-Host ""
    
    if ($authOk -and $personasOk -and $inventarioOk -and $ventasOk) {
        Write-Host "🎉 TODOS LOS SERVICIOS ESTÁN FUNCIONANDO!" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️ Algunos servicios no están respondiendo" -ForegroundColor Yellow
        Write-Host "   Ejecuta: docker-compose -f docker-compose.dev.yml ps" -ForegroundColor Gray
    }
    
    Write-Host ""
}

# Loop principal
$continue = $true
while ($continue) {
    Show-Menu
    $option = Read-Host "Selecciona una opción"
    
    switch ($option) {
        "1" {
            Write-Host ""
            Write-Host "🔐 Abriendo Swagger del Servicio de AUTENTICACIÓN..." -ForegroundColor Cyan
            Start-Process $urls["Auth"]
            Write-Host "✅ Swagger abierto en tu navegador!" -ForegroundColor Green
            Write-Host ""
            Write-Host "💡 TIPS:" -ForegroundColor Yellow
            Write-Host "• Busca el endpoint POST /api/v1/auth/token/" -ForegroundColor White
            Write-Host "• Haz clic en 'Try it out'" -ForegroundColor White
            Write-Host "• Ingresa credenciales y haz clic en 'Execute'" -ForegroundColor White
        }
        "2" {
            Write-Host ""
            Write-Host "👥 Abriendo Swagger del Servicio de PERSONAS..." -ForegroundColor Cyan
            Start-Process $urls["Personas"]
            Write-Host "✅ Swagger abierto en tu navegador!" -ForegroundColor Green
        }
        "3" {
            Write-Host ""
            Write-Host "📦 Abriendo Swagger del Servicio de INVENTARIO..." -ForegroundColor Cyan
            Start-Process $urls["Inventario"]
            Write-Host "✅ Swagger abierto en tu navegador!" -ForegroundColor Green
        }
        "4" {
            Write-Host ""
            Write-Host "💰 Abriendo Swagger del Servicio de VENTAS..." -ForegroundColor Cyan
            Start-Process $urls["Ventas"]
            Write-Host "✅ Swagger abierto en tu navegador!" -ForegroundColor Green
        }
        "5" {
            Write-Host ""
            Write-Host "🌐 Abriendo TODOS los servicios..." -ForegroundColor Cyan
            Write-Host ""
            
            foreach ($service in $urls.Keys) {
                Write-Host "   • Abriendo $service..." -ForegroundColor Gray
                Start-Process $urls[$service]
                Start-Sleep -Milliseconds 500
            }
            
            Write-Host ""
            Write-Host "✅ Todos los servicios abiertos en tu navegador!" -ForegroundColor Green
        }
        "6" {
            Get-JWTToken
        }
        "7" {
            Show-ServicesStatus
        }
        "0" {
            Write-Host ""
            Write-Host "👋 ¡Hasta luego!" -ForegroundColor Cyan
            Write-Host ""
            $continue = $false
        }
        default {
            Write-Host ""
            Write-Host "❌ Opción inválida. Por favor, selecciona una opción del menú." -ForegroundColor Red
        }
    }
    
    if ($continue) {
        Write-Host ""
        Write-Host "Presiona Enter para continuar..." -ForegroundColor DarkGray
        Read-Host
        Clear-Host
    }
}

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Gracias por usar Rep Drill Demo Swagger 🚀" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
