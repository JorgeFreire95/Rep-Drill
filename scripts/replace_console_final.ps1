# Script para reemplazar console.log/error/warn por logger en TypeScript/TSX
# Uso: .\scripts\replace_console_final.ps1

$ErrorActionPreference = "Continue"

# Archivos a procesar
$filesToProcess = @(
    "frontend\src\components\common\ErrorBoundary.tsx",
    "frontend\src\components\dashboard\ServiceHealthDashboard.tsx",
    "frontend\src\components\inventario\BodegaForm.tsx",
    "frontend\src\components\inventario\CategoriaForm.tsx",
    "frontend\src\components\inventario\ProductoForm.tsx",
    "frontend\src\components\layout\Sidebar.tsx",
    "frontend\src\components\Monitor\CeleryMonitor.tsx",
    "frontend\src\components\Orders\OrderCreationForm.tsx",
    "frontend\src\components\users\UserForm.tsx",
    "frontend\src\components\ventas\OrderForm.tsx",
    "frontend\src\components\ventas\OrderPaymentStatus.tsx",
    "frontend\src\components\ventas\PaymentForm.tsx",
    "frontend\src\components\ventas\ShipmentForm.tsx"
)

$replacements = @{
    "console.error" = "logger.error"
    "console.warn" = "logger.warn"
    "console.log" = "logger.info"
    "console.info" = "logger.info"
}

$filesProcessed = 0
$totalReplacements = 0

foreach ($file in $filesToProcess) {
    $filePath = Join-Path $PSScriptRoot "..\$file"
    
    if (-not (Test-Path $filePath)) {
        Write-Host "⚠ Archivo no encontrado: $file" -ForegroundColor Yellow
        continue
    }
    
    $content = Get-Content $filePath -Raw -Encoding UTF8
    $originalContent = $content
    $fileReplacements = 0
    
    # Verificar si ya tiene el import de logger
    if ($content -notmatch "import.*logger.*from.*utils/logger") {
        # Buscar donde insertar el import (después de los otros imports de React/hooks)
        if ($content -match "import.*from\s+['\`"]react['\`"];?\s*\n") {
            $content = $content -replace "(import.*from\s+['\`"]react['\`"];?\s*\n)", "`$1import { logger } from '../../utils/logger';`n"
            $fileReplacements++
        }
        elseif ($content -match "import.*from\s+['\`"]\.\.") {
            $content = $content -replace "(import.*from\s+['\`"]\.\.[^\n]+\n)", "import { logger } from '../../utils/logger';`n`$1"
            $fileReplacements++
        }
    }
    
    # Reemplazar console.* por logger.*
    foreach ($pattern in $replacements.Keys) {
        $replacement = $replacements[$pattern]
        $matches = [regex]::Matches($content, [regex]::Escape($pattern))
        if ($matches.Count -gt 0) {
            $content = $content -replace [regex]::Escape($pattern), $replacement
            $fileReplacements += $matches.Count
        }
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
        Write-Host "OK Procesado: $file ($fileReplacements reemplazos)" -ForegroundColor Green
        $filesProcessed++
        $totalReplacements += $fileReplacements
    }
    else {
        Write-Host "-- Sin cambios: $file" -ForegroundColor Gray
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "OK Reemplazo completado" -ForegroundColor Green
Write-Host "  Archivos procesados: $filesProcessed" -ForegroundColor Cyan
Write-Host "  Total reemplazos: $totalReplacements" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
