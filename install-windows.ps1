#Requires -Version 5.1
<#
  ============================================================
   Coastal.AI - Windows One-Line Installer

   iex (irm https://raw.githubusercontent.com/CoastalCrypto/Coastal.AI/master/install-windows.ps1)

   Or via cmd.exe:
   @powershell -NoProfile -ExecutionPolicy Bypass -Command "iex (irm https://raw.githubusercontent.com/CoastalCrypto/Coastal.AI/master/install-windows.ps1)"
  ============================================================
#>

# ── Colors ────────────────────────────────────────────────
function Write-Title  { param($msg) Write-Host "`n$msg" -ForegroundColor Cyan -BackgroundColor Black }
function Write-Step   { param($msg) Write-Host "`n► $msg" -ForegroundColor White }
function Write-Ok     { param($msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Info   { param($msg) Write-Host "  → $msg" -ForegroundColor Cyan }
function Write-Warn   { param($msg) Write-Host "  ! $msg" -ForegroundColor Yellow }
function Write-Err    { param($msg) Write-Host "  ✗ $msg" -ForegroundColor Red }

Write-Title "COASTAL.AI INSTALLER"
Write-Host "Your private AI executive team — running locally on Windows." -ForegroundColor DarkCyan

# ── Install directory ────────────────────────────────────
$InstallDir = if ($env:CC_INSTALL_DIR) { $env:CC_INSTALL_DIR } else { "$env:USERPROFILE\coastal-ai" }
Write-Step "Installation directory"
Write-Info $InstallDir

# ── Helper: test if command exists ──────────────────────
function Has-Command { param($name) return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

# ── Prerequisites ──────────────────────────────────────
Write-Step "Checking prerequisites"

# Git
if (-not (Has-Command git)) {
    Write-Err "Git not found. Install from https://git-scm.com then re-run."
    exit 1
}
Write-Ok "Git $(git --version | ForEach-Object { $_ -replace 'git version ' })"

# Node.js 22+
$needNode = $true
if (Has-Command node) {
    $nodeMajor = [int]((node --version) -replace 'v(\d+).*','$1')
    if ($nodeMajor -ge 22) {
        Write-Ok "Node.js $(node --version)"
        $needNode = $false
    }
}
if ($needNode) {
    Write-Err "Node.js 22+ required. Install from https://nodejs.org then re-run."
    exit 1
}

# pnpm
if (-not (Has-Command pnpm)) {
    Write-Info "Installing pnpm..."
    npm install -g pnpm@latest
    # Update PATH for the current session
    $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH', 'User')
}

# If pnpm still not found by command name, try to find it in the AppData/Roaming/npm folder
if (-not (Has-Command pnpm)) {
    $pnpmPath = "$env:APPDATA\npm\pnpm.ps1"
    if (Test-Path $pnpmPath) {
        function pnpm { & $pnpmPath @args }
    } else {
        Write-Err "pnpm installed but not found in PATH. Please restart PowerShell and re-run."
        exit 1
    }
}
Write-Ok "pnpm $(pnpm --version)"

# Ollama
if (-not (Has-Command ollama)) {
    Write-Err "Ollama not found. Install from https://ollama.com then re-run."
    exit 1
}
Write-Ok "Ollama installed"

# ── Clone or update repository ────────────────────────
Write-Step "Fetching Coastal.AI"
$RepoUrl = "https://github.com/CoastalCrypto/Coastal.AI.git"
$Branch = "master"

if (Test-Path "$InstallDir\.git") {
    Write-Info "Updating existing installation..."
    & git -C $InstallDir fetch origin $Branch
    & git -C $InstallDir checkout $Branch
    & git -C $InstallDir reset --hard "origin/$Branch"
} else {
    Write-Info "Cloning repository..."
    if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
    & git clone --depth=1 --branch $Branch $RepoUrl $InstallDir
}

if (-not (Test-Path $InstallDir)) {
    Write-Err "Repository directory not found at $InstallDir. Check git clone output for errors."
    exit 1
}

Write-Ok "Repository ready"

# ── Install dependencies ───────────────────────────────
Write-Step "Installing dependencies (this may take a minute)"
Set-Location $InstallDir
& pnpm install --frozen-lockfile
Write-Ok "Dependencies installed"

# ── Build ──────────────────────────────────────────────
Write-Step "Building packages"
& pnpm build
Write-Ok "Build complete"

# ── Configuration ──────────────────────────────────────
Write-Step "Creating configuration"

if (-not (Test-Path "$InstallDir\packages\core\data")) {
    New-Item -ItemType Directory -Path "$InstallDir\packages\core\data" -Force | Out-Null
}

$CoreEnv = "$InstallDir\packages\core\.env.local"
if (-not (Test-Path $CoreEnv)) {
    @"
CC_PORT=4747
CC_HOST=127.0.0.1
CC_DATA_DIR=./data
CC_OLLAMA_URL=http://127.0.0.1:11434
CC_DEFAULT_MODEL=llama3.2
"@ | Set-Content $CoreEnv
    Write-Ok "Core configuration created"
} else {
    Write-Info "Core configuration already exists"
}

# ── Pull default model ────────────────────────────────
Write-Step "Verifying default model (llama3.2)"
$hasModel = (ollama list) -match "llama3\.2"
if ($hasModel) {
    Write-Ok "llama3.2 already available"
} else {
    Write-Info "Pulling llama3.2 (~2 GB, this may take a few minutes)..."
    & ollama pull llama3.2
    Write-Ok "llama3.2 ready"
}

# ── Create launcher shortcut ───────────────────────────
Write-Step "Creating launcher"
$LauncherDir = "$env:USERPROFILE\AppData\Local\coastal-ai"
New-Item -ItemType Directory -Path $LauncherDir -Force | Out-Null

# Copy scripts to launcher directory
Copy-Item "$InstallDir\coastal-ai.ps1" "$LauncherDir\coastal-ai.ps1" -Force
Copy-Item "$InstallDir\coastal-ai.cmd" "$LauncherDir\coastal-ai.cmd" -Force

Write-Ok "Launcher scripts created in $LauncherDir"

# ── Save installation info ──────────────────────────────
$InfoFile = "$LauncherDir\install.json"
@{
    installDir = $InstallDir
    installedAt = (Get-Date -Format 'u')
    version = "1.0.0"
} | ConvertTo-Json | Set-Content $InfoFile

# ── Show completion info ────────────────────────────────
$Line = "=" * 60
Write-Host ""
Write-Host $Line -ForegroundColor Cyan
Write-Host "✓ COASTAL.AI INSTALLED SUCCESSFULLY" -ForegroundColor Green
Write-Host $Line -ForegroundColor Cyan

Write-Host "`nNext steps:" -ForegroundColor White
Write-Host "  1. Start services:" -ForegroundColor White
Write-Host "     powershell -NoProfile -ExecutionPolicy Bypass -File `"$LauncherDir\coastal-ai.ps1`"" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Open in browser:" -ForegroundColor White
Write-Host "     http://127.0.0.1:5173" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Login with default credentials:" -ForegroundColor White
Write-Host "     Username: admin" -ForegroundColor Gray
Write-Host "     Password: admin" -ForegroundColor Gray
Write-Host ""
Write-Host "Installation location: $InstallDir" -ForegroundColor Gray
Write-Host ""
