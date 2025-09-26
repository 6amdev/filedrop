@echo off
chcp 65001 >nul
echo.
echo ███████╗██╗██╗     ███████╗██████╗ ██████╗  ██████╗ ██████╗ 
echo ██╔════╝██║██║     ██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗
echo █████╗  ██║██║     █████╗  ██║  ██║██████╔╝██║   ██║██████╔╝
echo ██╔══╝  ██║██║     ██╔══╝  ██║  ██║██╔══██╗██║   ██║██╔═══╝ 
echo ██║     ██║███████╗███████╗██████╔╝██║  ██║╚██████╔╝██║     
echo ╚═╝     ╚═╝╚══════╝╚══════╝╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝     
echo.
echo                 🚀 FileDrop Installer v1.0                   
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Running with administrator privileges
) else (
    echo ⚠️  Not running as administrator - some features may not work
)

echo.
echo 🔍 Checking prerequisites...

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Recommended version: v16 or higher
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%a in ('node --version') do set NODE_VERSION=%%a
echo ✅ Node.js found: %NODE_VERSION%

REM Check npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm not found!
    echo Please reinstall Node.js
    pause
    exit /b 1
)

for /f "tokens=*" %%a in ('npm --version') do set NPM_VERSION=%%a
echo ✅ npm found: %NPM_VERSION%

REM Check Redis (optional for now)
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Redis not found - you'll need to install it separately
    echo Download from: https://github.com/microsoftarchive/redis/releases
    echo Or use: choco install redis-64
) else (
    echo ✅ Redis is running
)

echo.
echo 📦 Installing FileDrop dependencies...

REM Install server dependencies
echo.
echo [1/2] Installing server dependencies...
cd server
call npm install --silent
if errorlevel 1 (
    echo ❌ Server installation