# ============================================================
#  Coastal.AI - Windows installer
#  Download and run:
#    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/CoastalCrypto/Coastal.AI/master/install.ps1" -OutFile "$env:USERPROFILE\Downloads\coastal-ai-install.ps1"
#    Unblock-File "$env:USERPROFILE\Downloads\coastal-ai-install.ps1"
#    & "$env:USERPROFILE\Downloads\coastal-ai-install.ps1"
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
Write-Host "  COASTAL.AI" -ForegroundColor Cyan
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
$InstallDir = if ($env:CC_INSTALL_DIR) { $env:CC_INSTALL_DIR } else { "$env:USERPROFILE\coastal-ai" }
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
    # Refresh PATH so pnpm is available in this session
    $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH', 'User')
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
Write-Step "3) Fetching Coastal.AI"
$RepoUrl    = "https://github.com/CoastalCrypto/Coastal.AI.git"
$RepoBranch = "master"

if (Test-Path "$InstallDir\.git") {
    Write-Info "Updating existing installation..."
    & git -C $InstallDir fetch origin $RepoBranch 2>$null | Out-Null
    & git -C $InstallDir checkout $RepoBranch 2>$null | Out-Null
    & git -C $InstallDir reset --hard "origin/$RepoBranch" 2>$null | Out-Null
} elseif (Test-Path $InstallDir) {
    Write-Warn "Found $InstallDir but it is not a git repo. Removing and re-cloning..."
    Remove-Item -Recurse -Force $InstallDir
    & git clone --depth=1 --branch $RepoBranch $RepoUrl $InstallDir 2>$null | Out-Null
} else {
    & git clone --depth=1 --branch $RepoBranch $RepoUrl $InstallDir 2>$null | Out-Null
}
Write-Ok "Repository at $InstallDir"

# ── Install dependencies ──────────────────────────────────────
Write-Step "4) Installing dependencies"
Set-Location $InstallDir
pnpm install --no-frozen-lockfile
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

# ── Detect or pull model ─────────────────────────────────────
Write-Step "7) Detecting available Ollama model"
$recommendedModels = @("llama3.2", "qwen2.5-coder:7b", "qwen2.5:14b", "gemma3:27b")
$ollamaList = & ollama list 2>$null | Out-String
$chosenModel = $null

# Prefer any already-installed recommended model
foreach ($m in $recommendedModels) {
    $short = $m.Split(':')[0]
    if ($ollamaList -match [regex]::Escape($short)) {
        $chosenModel = $m
        Write-Ok "$m already installed — using it"
        break
    }
}

# Fall back to whatever model is already on the device
if (-not $chosenModel) {
    $firstLine = ($ollamaList -split "`n" | Select-Object -Skip 1 | Where-Object { $_ -match '\S' } | Select-Object -First 1)
    if ($firstLine) {
        $firstInstalled = ($firstLine -split '\s+')[0]
        if ($firstInstalled) {
            $chosenModel = $firstInstalled
            Write-Ok "Found existing model: $chosenModel — using it"
        }
    }
}

# No models at all — pull primary recommended
if (-not $chosenModel) {
    Write-Info "No local models found — pulling llama3.2..."
    & ollama pull llama3.2
    Write-Ok "llama3.2 ready"
    $chosenModel = "llama3.2"
}

# Update CC_DEFAULT_MODEL in .env.local
$chosenShort = $chosenModel.Split(':')[0]
(Get-Content $CoreEnv) -replace '^CC_DEFAULT_MODEL=.*', "CC_DEFAULT_MODEL=$chosenShort" | Set-Content $CoreEnv -Encoding utf8
Write-Info "CC_DEFAULT_MODEL set to $chosenShort"

# ── MemPalace memory system ──────────────────────────────────
Write-Step "8) Installing MemPalace memory system"

$PalaceDir = "$InstallDir\packages\core\data\palace"
$pipCmd = $null
foreach ($candidate in @("pip3", "pip", "python3 -m pip", "python -m pip")) {
    if (Get-Command ($candidate.Split(' ')[0]) -ErrorAction SilentlyContinue) {
        $pipCmd = $candidate; break
    }
}

if (-not $pipCmd) {
    Write-Warn "Python/pip not found — MemPalace skipped. Install Python 3.8+ and re-run to enable structured memory."
} else {
    Write-Info "Installing MemPalace via pip..."
    Invoke-Expression "$pipCmd install --quiet --upgrade mempalace" 2>$null
    $mpCmd = Get-Command "mempalace" -ErrorAction SilentlyContinue
    if ($mpCmd) {
        $env:MEMPALACE_PALACE_PATH = $PalaceDir
        & mempalace init $PalaceDir 2>$null
        Write-Ok "MemPalace palace initialised at $PalaceDir"
    } else {
        Write-Warn "mempalace not in PATH after install. Run manually: mempalace init $PalaceDir"
    }
}

# ── Launch ────────────────────────────────────────────────────
Write-Step "9) Launching Coastal.AI"
Set-Location $InstallDir

# Stop any existing Coastal.AI processes before starting fresh
Write-Info "Stopping any previous Coastal.AI processes..."
$pidFile = "$env:TEMP\coastal-ai-core.pid"
if (Test-Path $pidFile) {
    $oldPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($oldPid) {
        Stop-Process -Id ([int]$oldPid) -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }
}
# Free port 4747 if still bound
$netEntry = netstat -ano 2>$null | Select-String ":4747\s"
if ($netEntry) {
    $stalePid = ($netEntry.ToString().Trim() -split '\s+')[-1]
    if ($stalePid -match '^\d+$') { Stop-Process -Id ([int]$stalePid) -ErrorAction SilentlyContinue }
}
Start-Sleep -Milliseconds 500

Write-Info "Starting core service on :4747..."
$coreJob = Start-Process -FilePath "node" `
    -ArgumentList "packages\core\dist\main.js" `
    -WorkingDirectory $InstallDir `
    -RedirectStandardOutput "$env:TEMP\coastal-ai-core.log" `
    -RedirectStandardError  "$env:TEMP\coastal-ai-core-err.log" `
    -PassThru -WindowStyle Minimized
$coreJob.Id | Set-Content "$env:TEMP\coastal-ai-core.pid"
Write-Ok "Core service started (PID $($coreJob.Id))"

Write-Info "Waiting for core API to be ready..."
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep 1
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:4747/api/version" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
}
if ($ready) {
    Write-Ok "Core API ready"
} else {
    Write-Warn "Core API did not respond in 15s - check $env:TEMP\coastal-ai-core-err.log"
}

Write-Info "Starting web portal on :5173..."
# pnpm is a .cmd batch file on Windows — must be launched via cmd.exe
$webJob = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "pnpm", "preview", "--port", "5173", "--host", "127.0.0.1" `
    -WorkingDirectory "$InstallDir\packages\web" `
    -RedirectStandardOutput "$env:TEMP\coastal-ai-web.log" `
    -RedirectStandardError  "$env:TEMP\coastal-ai-web-err.log" `
    -PassThru -WindowStyle Minimized
$webJob.Id | Set-Content "$env:TEMP\coastal-ai-web.pid"
Write-Ok "Web portal started (PID $($webJob.Id))"
Start-Sleep 2

Start-Process "http://127.0.0.1:5173"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Coastal.AI is running!" -ForegroundColor White
Write-Host ""
Write-Host "  Web portal:  http://127.0.0.1:5173"
Write-Host "  Core API:    http://127.0.0.1:4747"
Write-Host ""
Write-Host "  Default login:  admin / admin"
Write-Host "  (you will be prompted to set a new password)"
Write-Host ""
Write-Host "  Logs:  $env:TEMP\coastal-ai-core.log"
Write-Host "         $env:TEMP\coastal-ai-web.log"
Write-Host ""
Write-Host "  To stop the servers, run:" -ForegroundColor DarkGray
Write-Host "  Stop-Process -Id (Get-Content $env:TEMP\coastal-ai-core.pid)" -ForegroundColor DarkGray
Write-Host "=================================================" -ForegroundColor Cyan
