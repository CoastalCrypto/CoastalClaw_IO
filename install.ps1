# ============================================================
#  Coastal Claw - Windows installer
#  Download and run:
#    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/CoastalCrypto/CoastalClaw_IO/master/install.ps1" -OutFile "$env:USERPROFILE\Downloads\coastalclaw-install.ps1"
#    Unblock-File "$env:USERPROFILE\Downloads\coastalclaw-install.ps1"
#    & "$env:USERPROFILE\Downloads\coastalclaw-install.ps1"
# ============================================================
#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step  { param($msg) Write-Host "`n$msg" -ForegroundColor White }
function Write-Ok    { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Info  { param($msg) Write-Host "  --> $msg" -ForegroundColor Cyan }
function Write-Warn  { param($msg) Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "  [X] $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  COASTAL CLAW" -ForegroundColor Cyan
Write-Host "  Your private AI executive team - running on your hardware." -ForegroundColor DarkCyan
Write-Host ""

# ── Check running as Administrator ────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warn "Not running as Administrator. Some installs may require elevation."
    Write-Warn "Re-run PowerShell as Administrator if you hit permission errors."
}

# ── Install location ──────────────────────────────────────────
Write-Step "1) Choosing install location"
$InstallDir = if ($env:CC_INSTALL_DIR) { $env:CC_INSTALL_DIR } else { "$env:USERPROFILE\coastal-claw" }
Write-Info "Installing to: $InstallDir"

# ── Helper: test if a command exists ─────────────────────────
function Has-Command { param($name) return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

# ── Check / install winget ────────────────────────────────────
Write-Step "2) Checking prerequisites"

if (-not (Has-Command winget)) {
    Write-Fail "winget not found. Install 'App Installer' from the Microsoft Store, then re-run."
}
Write-Ok "winget available"

# ── Git ───────────────────────────────────────────────────────
if (-not (Has-Command git)) {
    Write-Info "Installing Git..."
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
    $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH', 'User')
}
Write-Ok (git --version)

# ── Node.js 22 ────────────────────────────────────────────────
$needNode = $true
if (Has-Command node) {
    $nodeMajor = [int]((node --version) -replace 'v(\d+).*','$1')
    if ($nodeMajor -ge 22) {
        Write-Ok "Node.js $(node --version)"
        $needNode = $false
    } else {
        Write-Warn "Node.js $(node --version) found but v22+ is required. Upgrading..."
    }
}
if ($needNode) {
    Write-Info "Installing Node.js 22 LTS..."
    winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
    $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH', 'User')
    Write-Ok "Node.js $(node --version)"
}

# ── pnpm ──────────────────────────────────────────────────────
if (-not (Has-Command pnpm)) {
    Write-Info "Installing pnpm..."
    npm install -g pnpm@latest
}
Write-Ok "pnpm $(pnpm --version)"

# ── Ollama ────────────────────────────────────────────────────
if (-not (Has-Command ollama)) {
    Write-Info "Installing Ollama..."
    winget install --id Ollama.Ollama -e --source winget --accept-package-agreements --accept-source-agreements
    $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH', 'User')
}
Write-Ok "Ollama $(ollama --version 2>$null | Select-Object -First 1)"

# ── Clone or update repo ──────────────────────────────────────
Write-Step "3) Fetching Coastal Claw"
$RepoUrl    = "https://github.com/CoastalCrypto/CoastalClaw_IO.git"
$RepoBranch = "master"

if (Test-Path "$InstallDir\.git") {
    Write-Info "Updating existing installation..."
    git -C $InstallDir fetch origin $RepoBranch
    git -C $InstallDir checkout $RepoBranch
    git -C $InstallDir reset --hard "origin/$RepoBranch"
} elseif (Test-Path $InstallDir) {
    Write-Warn "Found $InstallDir but it is not a git repo. Removing and re-cloning..."
    Remove-Item -Recurse -Force $InstallDir
    git clone --depth=1 --branch $RepoBranch $RepoUrl $InstallDir
} else {
    git clone --depth=1 --branch $RepoBranch $RepoUrl $InstallDir
}
Write-Ok "Repository at $InstallDir"

# ── Install dependencies ──────────────────────────────────────
Write-Step "4) Installing dependencies"
Set-Location $InstallDir
pnpm install
Write-Ok "Dependencies installed"

# ── Build ─────────────────────────────────────────────────────
Write-Step "5) Building"
pnpm build
Write-Ok "Build complete"

# ── Create .env.local files ───────────────────────────────────
Write-Step "6) Creating configuration"
$CoreEnv = "$InstallDir\packages\core\.env.local"
$WebEnv  = "$InstallDir\packages\web\.env.local"

if (-not (Test-Path $CoreEnv)) {
    Set-Content $CoreEnv "CC_PORT=4747`nCC_HOST=127.0.0.1`nCC_DATA_DIR=./data`nCC_OLLAMA_URL=http://127.0.0.1:11434`nCC_DEFAULT_MODEL=llama3.2"
    Write-Ok "Created $CoreEnv"
} else {
    Write-Info "Core config already exists - skipping."
}

if (-not (Test-Path $WebEnv)) {
    Set-Content $WebEnv "VITE_CORE_PORT=4747"
    Write-Ok "Created $WebEnv"
}

# ── Pull default model ────────────────────────────────────────
Write-Step "7) Pulling default model (llama3.2)"
$ollamaList = ollama list 2>$null
if ($ollamaList -match "llama3\.2") {
    Write-Ok "llama3.2 already pulled"
} else {
    Write-Info "Pulling llama3.2 (~2 GB)..."
    ollama pull llama3.2
    Write-Ok "llama3.2 ready"
}

# ── Launch ────────────────────────────────────────────────────
Write-Step "8) Launching Coastal Claw"
Set-Location $InstallDir

Write-Info "Starting core service on :4747..."
$coreJob = Start-Process -FilePath "node" `
    -ArgumentList "packages\core\dist\main.js" `
    -WorkingDirectory $InstallDir `
    -RedirectStandardOutput "$env:TEMP\coastal-claw-core.log" `
    -RedirectStandardError  "$env:TEMP\coastal-claw-core-err.log" `
    -PassThru -WindowStyle Minimized
$coreJob.Id | Set-Content "$env:TEMP\coastal-claw-core.pid"
Write-Ok "Core service started (PID $($coreJob.Id))"

Write-Info "Waiting for core API to be ready..."
$ready = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep 1
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:4747/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
}
if ($ready) {
    Write-Ok "Core API ready"
} else {
    Write-Warn "Core API did not respond in 15s - check $env:TEMP\coastal-claw-core-err.log"
}

Write-Info "Starting web portal on :5173..."
$webJob = Start-Process -FilePath "pnpm" `
    -ArgumentList "preview", "--port", "5173", "--host", "127.0.0.1" `
    -WorkingDirectory "$InstallDir\packages\web" `
    -RedirectStandardOutput "$env:TEMP\coastal-claw-web.log" `
    -RedirectStandardError  "$env:TEMP\coastal-claw-web-err.log" `
    -PassThru -WindowStyle Minimized
$webJob.Id | Set-Content "$env:TEMP\coastal-claw-web.pid"
Write-Ok "Web portal started (PID $($webJob.Id))"
Start-Sleep 2

Start-Process "http://127.0.0.1:5173"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Coastal Claw is running!" -ForegroundColor White
Write-Host ""
Write-Host "  Web portal:  http://127.0.0.1:5173"
Write-Host "  Core API:    http://127.0.0.1:4747"
Write-Host ""
Write-Host "  Default login:  admin / admin"
Write-Host "  (you will be prompted to set a new password)"
Write-Host ""
Write-Host "  Logs:  $env:TEMP\coastal-claw-core.log"
Write-Host "         $env:TEMP\coastal-claw-web.log"
Write-Host ""
Write-Host "  To stop the servers, run:" -ForegroundColor DarkGray
Write-Host "  Stop-Process -Id (Get-Content $env:TEMP\coastal-claw-core.pid)" -ForegroundColor DarkGray
Write-Host "=================================================" -ForegroundColor Cyan
