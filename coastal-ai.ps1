#Requires -Version 5.1
<#
  Coastal.AI Service Launcher for Windows

  Usage:
    .\coastal-ai.ps1 start       # Start services
    .\coastal-ai.ps1 stop        # Stop services
    .\coastal-ai.ps1 status      # Show status
    .\coastal-ai.ps1 restart     # Restart services
    .\coastal-ai.ps1 logs        # Show recent logs
#>

param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'status', 'restart', 'logs')]
    [string]$Command = 'start'
)

$ErrorActionPreference = 'Stop'
$InstallDir = if ($env:CC_INSTALL_DIR) { $env:CC_INSTALL_DIR } else { "$env:USERPROFILE\coastal-ai" }
$DataDir = "$InstallDir\packages\core\data"
$LogDir = "$env:TEMP\coastal-ai"

# Colors
function Write-Success { param($msg) Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Info    { param($msg) Write-Host "→ $msg" -ForegroundColor Cyan }
function Write-Warn    { param($msg) Write-Host "! $msg" -ForegroundColor Yellow }
function Write-Error   { param($msg) Write-Host "✗ $msg" -ForegroundColor Red }

if (-not (Test-Path $InstallDir)) {
    Write-Error "Coastal.AI not found at $InstallDir"
    Write-Host "Run the installer first:" -ForegroundColor Yellow
    Write-Host "  iex (irm https://raw.githubusercontent.com/CoastalCrypto/Coastal.AI/master/install-windows.ps1)" -ForegroundColor Gray
    exit 1
}

# ──────────────────────────────────────────────────────
function Start-Services {
    Write-Host ""
    Write-Host "Starting Coastal.AI..." -ForegroundColor Cyan

    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

    # Start Core API
    Write-Info "Starting Core API on :4747"
    $corePid = (Start-Process -FilePath "node" `
        -ArgumentList "packages/core/dist/main.js" `
        -WorkingDirectory $InstallDir `
        -RedirectStandardOutput "$LogDir\core.log" `
        -RedirectStandardError "$LogDir\core-err.log" `
        -PassThru -WindowStyle Minimized).Id

    $corePid | Set-Content "$env:TEMP\coastal-ai-core.pid"
    Write-Success "Core API started (PID: $corePid)"

    # Wait for Core to be ready
    Write-Info "Waiting for Core API to be ready..."
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:4747/api/version" `
                -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {}
    }

    if ($ready) {
        Write-Success "Core API ready"
    } else {
        Write-Warn "Core API not responding yet (check logs)"
    }

    # Start Web Portal
    Start-Sleep -Seconds 1
    Write-Info "Starting Web UI on :5173"
    $webPid = (Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "cd `"$InstallDir\packages\web`" && pnpm preview --port 5173 --host 127.0.0.1" `
        -RedirectStandardOutput "$LogDir\web.log" `
        -RedirectStandardError "$LogDir\web-err.log" `
        -PassThru -WindowStyle Minimized).Id

    $webPid | Set-Content "$env:TEMP\coastal-ai-web.pid"
    Write-Success "Web UI started (PID: $webPid)"

    # Open browser
    Start-Sleep -Seconds 2
    Start-Process "http://127.0.0.1:5173"

    Write-Host ""
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
    Write-Success "COASTAL.AI IS RUNNING"
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Info "Web UI:       http://127.0.0.1:5173"
    Write-Info "Core API:     http://127.0.0.1:4747"
    Write-Info "Default user: admin / admin"
    Write-Host ""
    Write-Host "Logs:"
    Write-Host "  $LogDir\core.log" -ForegroundColor Gray
    Write-Host "  $LogDir\web.log" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To stop services, run:" -ForegroundColor Gray
    Write-Host "  .\coastal-ai.ps1 stop" -ForegroundColor Gray
    Write-Host ""
}

# ──────────────────────────────────────────────────────
function Stop-Services {
    Write-Host ""
    Write-Host "Stopping Coastal.AI..." -ForegroundColor Yellow

    Get-Process node -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*coastal*" -or $_.CommandLine -like "*packages/core*" } |
        Stop-Process -Force -ErrorAction SilentlyContinue

    Get-Process cmd -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*pnpm preview*" } |
        Stop-Process -Force -ErrorAction SilentlyContinue

    Start-Sleep -Seconds 1
    Write-Success "Services stopped"
    Write-Host ""
}

# ──────────────────────────────────────────────────────
function Show-Status {
    Write-Host ""
    Write-Host "Coastal.AI Status:" -ForegroundColor Cyan

    $coreRunning = Get-Process node -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*packages/core*" }
    $webRunning = Get-Process node -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*pnpm*" }

    if ($coreRunning) {
        Write-Success "Core API running (PID: $($coreRunning.Id))"
    } else {
        Write-Warn "Core API stopped"
    }

    if ($webRunning) {
        Write-Success "Web UI running (PID: $($webRunning.Id))"
    } else {
        Write-Warn "Web UI stopped"
    }

    Write-Host ""
}

# ──────────────────────────────────────────────────────
function Show-Logs {
    Write-Host ""
    Write-Host "Core API Logs (last 20 lines):" -ForegroundColor Cyan
    if (Test-Path "$LogDir\core.log") {
        Get-Content "$LogDir\core.log" -Tail 20 | Write-Host -ForegroundColor Gray
    } else {
        Write-Warn "No core logs found"
    }
    Write-Host ""
}

# ──────────────────────────────────────────────────────
# Main execution
switch ($Command) {
    'start'   { Start-Services }
    'stop'    { Stop-Services }
    'status'  { Show-Status }
    'restart' { Stop-Services; Start-Sleep -Seconds 1; Start-Services }
    'logs'    { Show-Logs }
}
