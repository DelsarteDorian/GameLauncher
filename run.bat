@echo off
setlocal enabledelayedexpansion

:: Check if debug mode is requested
if /i "%1"=="debug" (
    goto :debug_mode
) else (
    goto :normal_mode
)

:normal_mode
:: Normal mode - Run silently without showing CMD window
title Multi Game Launcher
cd /d "%~dp0"

:: Check if npm and node are available
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: npm not found. Please install Node.js first.
    pause
    exit /b 1
)

:: Start the application silently
start /min "" cmd /c "npm start"
exit

:debug_mode
:: Debug mode - Show CMD window with logs
title Multi Game Launcher - Debug Mode
echo ================================
echo  Multi Game Launcher - DEBUG
echo ================================
echo.
echo Starting application in debug mode...
echo Debug logs will be displayed below:
echo.

cd /d "%~dp0"

:: Check if npm and node are available
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: npm not found. Please install Node.js first.
    pause
    exit /b 1
)

:: Start with debug logging
npm run dev

echo.
echo Application closed.
pause
exit