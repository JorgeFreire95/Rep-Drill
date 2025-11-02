# PowerShell script para generar secrets seguros sin Python
# Ejecutar: .\scripts\generate_secrets.ps1

Write-Host "=" * 70
Write-Host "  REP DRILL - GENERADOR DE SECRETS SEGUROS (PowerShell)"
Write-Host "=" * 70
Write-Host ""
Write-Host "Copia estos valores en tu archivo .env:" -ForegroundColor Yellow
Write-Host ""

# Función para generar string aleatorio
function Generate-RandomString {
    param(
        [int]$Length = 50,
        [string]$Characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?"
    )
    
    $random = -join ((1..$Length) | ForEach-Object { $Characters[(Get-Random -Maximum $Characters.Length)] })
    return $random
}

# Generar secrets
Write-Host "# Django Secret Key (50 caracteres)" -ForegroundColor Green
$djangoSecret = Generate-RandomString -Length 50
Write-Host "DJANGO_SECRET_KEY=$djangoSecret"
Write-Host ""

Write-Host "# JWT Signing Key (64 caracteres)" -ForegroundColor Green
$jwtKey = Generate-RandomString -Length 64 -Characters "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
Write-Host "JWT_SIGNING_KEY=$jwtKey"
Write-Host ""

Write-Host "# Database Password (32 caracteres)" -ForegroundColor Green
$dbPassword = Generate-RandomString -Length 32
Write-Host "DB_PASSWORD=$dbPassword"
Write-Host ""

Write-Host "# Redis Password (32 caracteres)" -ForegroundColor Green
$redisPassword = Generate-RandomString -Length 32
Write-Host "REDIS_PASSWORD=$redisPassword"
Write-Host ""

Write-Host "=" * 70
Write-Host "⚠️  IMPORTANTE:" -ForegroundColor Red
Write-Host "  1. Guarda estos valores en un lugar seguro (gestor de contraseñas)"
Write-Host "  2. NO los compartas en git ni en comunicaciones inseguras"
Write-Host "  3. Usa valores diferentes en cada entorno (dev, staging, prod)"
Write-Host "=" * 70
Write-Host ""
Write-Host "💡 TIP: Ejecuta este script nuevamente para generar nuevos secrets" -ForegroundColor Cyan
