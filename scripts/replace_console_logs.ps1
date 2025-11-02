# Script para reemplazar todos los console.log por logger en el frontend
# Uso: .\scripts\replace_console_logs.ps1

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  REP DRILL - REEMPLAZANDO CONSOLE.LOG POR LOGGER" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

$frontendPath = "frontend\src\components"
$replacements = 0
$filesModified = 0

# Buscar todos los archivos .tsx en components
$files = Get-ChildItem -Path $frontendPath -Recurse -Filter "*.tsx"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    $modified = $false
    
    # Verificar si ya tiene el import de logger
    $hasLoggerImport = $content -match "import.*logger.*from.*utils/logger"
    
    # Verificar si tiene console.log/error/warn
    $hasConsole = $content -match "console\.(log|error|warn|info|debug)"
    
    if ($hasConsole) {
        Write-Host "📝 Procesando: $($file.Name)" -ForegroundColor Yellow
        
        # Agregar import de logger si no existe
        if (-not $hasLoggerImport) {
            # Buscar el último import y agregar después
            if ($content -match "(import.*from.*['\"];?\s*\n)") {
                $lastImport = $matches[0]
                $content = $content -replace [regex]::Escape($lastImport), "$lastImport`nimport { logger } from '../../utils/logger';`n"
                $modified = $true
                Write-Host "  ✅ Agregado import de logger" -ForegroundColor Green
            }
        }
        
        # Reemplazar console.log por logger.info
        $count = ([regex]::Matches($content, "console\.log\(")).Count
        if ($count -gt 0) {
            $content = $content -replace "console\.log\(", "logger.info("
            $replacements += $count
            Write-Host "  ✅ Reemplazados $count console.log" -ForegroundColor Green
            $modified = $true
        }
        
        # Reemplazar console.error por logger.error
        $count = ([regex]::Matches($content, "console\.error\(")).Count
        if ($count -gt 0) {
            $content = $content -replace "console\.error\(", "logger.error("
            $replacements += $count
            Write-Host "  ✅ Reemplazados $count console.error" -ForegroundColor Green
            $modified = $true
        }
        
        # Reemplazar console.warn por logger.warn
        $count = ([regex]::Matches($content, "console\.warn\(")).Count
        if ($count -gt 0) {
            $content = $content -replace "console\.warn\(", "logger.warn("
            $replacements += $count
            Write-Host "  ✅ Reemplazados $count console.warn" -ForegroundColor Green
            $modified = $true
        }
        
        # Reemplazar console.info por logger.info
        $count = ([regex]::Matches($content, "console\.info\(")).Count
        if ($count -gt 0) {
            $content = $content -replace "console\.info\(", "logger.info("
            $replacements += $count
            Write-Host "  ✅ Reemplazados $count console.info" -ForegroundColor Green
            $modified = $true
        }
        
        # Reemplazar console.debug por logger.debug
        $count = ([regex]::Matches($content, "console\.debug\(")).Count
        if ($count -gt 0) {
            $content = $content -replace "console\.debug\(", "logger.debug("
            $replacements += $count
            Write-Host "  ✅ Reemplazados $count console.debug" -ForegroundColor Green
            $modified = $true
        }
        
        if ($modified) {
            Set-Content -Path $file.FullName -Value $content -NoNewline
            $filesModified++
        }
    }
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  RESUMEN" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "Archivos modificados: $filesModified" -ForegroundColor Green
Write-Host "Total de reemplazos: $replacements" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 ¡Proceso completado!" -ForegroundColor Green
Write-Host "💡 TIP: Ejecuta 'npm run lint' para verificar que no hay errores" -ForegroundColor Cyan
