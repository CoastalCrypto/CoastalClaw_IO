@echo off
REM Coastal.AI Service Launcher for Windows
REM Simple batch wrapper to manage Coastal.AI services

setlocal enabledelayedexpansion
set "INSTALL_DIR=%USERPROFILE%\coastal-ai"
set "SCRIPT_DIR=%USERPROFILE%\AppData\Local\coastal-ai"

if not exist "%INSTALL_DIR%" (
    echo Coastal.AI not installed. Run the installer first:
    echo   iex (irm https://raw.githubusercontent.com/CoastalCrypto/Coastal.AI/master/install-windows.ps1)
    exit /b 1
)

REM Determine command
if "%1"=="" goto :start
if /i "%1"=="start" goto :start
if /i "%1"=="stop" goto :stop
if /i "%1"=="status" goto :status
if /i "%1"=="restart" goto :restart
goto :usage

:start
echo Starting Coastal.AI...
echo   Core API:  http://127.0.0.1:4747
echo   Web UI:    http://127.0.0.1:5173
cd /d "%INSTALL_DIR%"
start "Coastal.AI Core" /min node packages\core\dist\main.js
timeout /t 2 /nobreak
start "Coastal.AI Web" /min cmd /c "cd packages\web && pnpm preview --port 5173 --host 127.0.0.1"
timeout /t 1 /nobreak
start http://127.0.0.1:5173
exit /b 0

:stop
echo Stopping Coastal.AI...
taskkill /FI "WINDOWTITLE eq Coastal.AI*" /T /F >nul 2>&1
echo Stopped.
exit /b 0

:status
echo Coastal.AI Status:
tasklist | find /i "node.exe" >nul
if errorlevel 1 (
    echo   Status: STOPPED
) else (
    echo   Status: RUNNING
)
exit /b 0

:restart
call :stop
timeout /t 1 /nobreak
call :start
exit /b 0

:usage
echo.
echo Coastal.AI Service Launcher
echo.
echo Usage: coastal-ai [COMMAND]
echo.
echo Commands:
echo   start       Start Core API and Web UI
echo   stop        Stop all services
echo   status      Show service status
echo   restart     Restart services
echo.
exit /b 1
