#Requires -Version 5.1
<#
  .SYNOPSIS
  Wrapper for sandbox-cli.js on Windows PowerShell

  .EXAMPLE
  .\scripts\test-sandbox.ps1 start
  .\scripts\test-sandbox.ps1 stop
  .\scripts\test-sandbox.ps1 logs
#>

param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'clean', 'logs', 'status')]
    [string]$Command = 'start'
)

$ErrorActionPreference = 'Stop'

# Check if Node.js is available
try {
    $null = node --version
} catch {
    Write-Host "❌ Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check if Docker is available
try {
    $null = docker --version
} catch {
    Write-Host "❌ Docker not found. Install Docker Desktop from https://docker.com" -ForegroundColor Red
    exit 1
}

Write-Host "Running: node scripts/sandbox-cli.js $Command" -ForegroundColor Cyan
& node scripts/sandbox-cli.js $Command
