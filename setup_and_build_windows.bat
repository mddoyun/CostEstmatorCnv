@echo off
REM ============================================================
REM CostEstimator - Complete Setup and Build Script for Windows
REM GitHub clone - virtual environment - dependencies - build
REM ============================================================

echo ============================================================
echo CostEstimator Complete Setup and Build
echo This will:
echo   1. Clone from GitHub
echo   2. Setup virtual environment
echo   3. Install dependencies
echo   4. Build Windows server executable
echo ============================================================
echo.

REM Save current directory
set "ORIGINAL_DIR=%CD%"

REM Check Git installation
echo [1/6] Checking Git...
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git not found!
    echo Please install Git from: https://git-scm.com/download/win
    pause
    exit /b 1
)
echo [OK] Git found
echo.

REM Check Python installation
echo [2/6] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found!
    echo Please install Python 3.11+ from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)
python --version
echo [OK] Python found
echo.

REM Clone from GitHub
echo [3/6] Cloning from GitHub...
if exist "CostEstmatorCnv" (
    echo [INFO] CostEstmatorCnv folder already exists
    echo [INFO] Pulling latest changes...
    cd CostEstmatorCnv
    git pull
    cd ..
    echo [OK] Updated to latest version
) else (
    git clone https://github.com/mddoyun/CostEstmatorCnv.git
    if not exist "CostEstmatorCnv" (
        echo [ERROR] Clone failed!
        pause
        exit /b 1
    )
    echo [OK] Repository cloned
)
echo.

REM Move to cloned folder
cd CostEstmatorCnv

REM Setup virtual environment
echo [4/6] Setting up virtual environment...
if exist ".mddoyun" (
    echo [INFO] Virtual environment already exists
) else (
    python -m venv .mddoyun
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment
        cd "%ORIGINAL_DIR%"
        pause
        exit /b 1
    )
)
echo [OK] Virtual environment ready
echo.

REM Activate virtual environment and install dependencies
echo [5/6] Installing dependencies...
call .mddoyun\Scripts\activate.bat

echo [INFO] Upgrading pip...
python -m pip install --upgrade pip

echo.
echo [INFO] Installing requirements (this may take 5-10 minutes)...
echo [INFO] Progress will be displayed below. Please wait...
echo.
pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to install dependencies
    cd "%ORIGINAL_DIR%"
    pause
    exit /b 1
)
echo.
echo [OK] Dependencies installed
echo.

REM Execute build (inline, virtual environment already activated)
echo [6/6] Building Windows server executable...
echo [INFO] This will take 5-10 minutes on first run...
echo.

REM Check PyInstaller
echo [INFO] Checking PyInstaller...
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo [INFO] Installing PyInstaller...
    pip install pyinstaller
)
echo [OK] PyInstaller ready
echo.

REM Create initial database if not exists
echo [INFO] Preparing database...
if not exist "db.sqlite3" (
    echo [INFO] Creating initial database...
    python manage.py migrate --noinput
    echo [OK] Database created
) else (
    echo [OK] Database found
)
echo.

REM Clean previous build
echo [INFO] Cleaning previous build...
if exist "build" rmdir /s /q "build"
if exist "dist\CostEstimator" rmdir /s /q "dist\CostEstimator"
if exist "CostEstimator_BlenderAddon_453\server_win" rmdir /s /q "CostEstimator_BlenderAddon_453\server_win"
echo [OK] Cleaned
echo.

REM Build with PyInstaller
echo [INFO] Building with PyInstaller (this may take 5-10 minutes)...
echo.
pyinstaller --name "CostEstimator" --onedir --add-data "db.sqlite3;." --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" --add-data "connections;connections" --hidden-import "django" --hidden-import "channels" --hidden-import "daphne" --collect-all django --collect-all channels --collect-all daphne --noconfirm run_integrated_server.py

if not exist "dist\CostEstimator\CostEstimator.exe" (
    echo.
    echo [ERROR] Build failed! CostEstimator.exe not found
    cd "%ORIGINAL_DIR%"
    pause
    exit /b 1
)
echo [OK] Build completed
echo.

REM Copy to addon folder
echo [INFO] Copying to Blender addon folder...
if not exist "CostEstimator_BlenderAddon_453" (
    echo [ERROR] Addon folder not found
    cd "%ORIGINAL_DIR%"
    pause
    exit /b 1
)

mkdir "CostEstimator_BlenderAddon_453\server_win" 2>nul
xcopy /E /I /Y /Q "dist\CostEstimator" "CostEstimator_BlenderAddon_453\server_win\CostEstimator"

if exist "CostEstimator_BlenderAddon_453\server_win\CostEstimator\CostEstimator.exe" (
    echo [OK] Copied to addon folder
) else (
    echo [ERROR] Copy failed
    cd "%ORIGINAL_DIR%"
    pause
    exit /b 1
)
echo.

REM Create ZIP package
echo [INFO] Creating ZIP package...
if exist "CostEstimator_BlenderAddon_Windows.zip" del "CostEstimator_BlenderAddon_Windows.zip"
powershell -Command "Compress-Archive -Path 'CostEstimator_BlenderAddon_453', 'README_BLENDER_ADDON.md' -DestinationPath 'CostEstimator_BlenderAddon_Windows.zip' -Force"

if exist "CostEstimator_BlenderAddon_Windows.zip" (
    echo [OK] ZIP created: CostEstimator_BlenderAddon_Windows.zip
) else (
    echo [WARNING] ZIP creation failed, but you can manually compress the addon folder
)
echo.

REM Return to original directory
cd "%ORIGINAL_DIR%"

echo.
echo ============================================================
echo [SUCCESS] Complete Setup and Build Finished!
echo ============================================================
echo.
echo Build results are in:
echo   %CD%\CostEstmatorCnv\CostEstimator_BlenderAddon_453\server_win\
echo.
echo ZIP package:
echo   %CD%\CostEstmatorCnv\CostEstimator_BlenderAddon_Windows.zip
echo.
echo To rebuild in the future:
echo   cd CostEstmatorCnv
echo   build_windows.bat
echo ============================================================
pause
