@echo off
REM ============================================================
REM CostEstimator Windows Server Builder for Blender Addon
REM PyInstaller를 사용하여 Windows 서버 실행파일 생성
REM ============================================================

echo ============================================================
echo CostEstimator Windows Server Build Script
echo For Blender Addon Distribution
echo ============================================================
echo.

REM 1. 가상환경 확인 및 활성화
if not exist ".mddoyun" (
    echo [ERROR] Virtual environment not found (.mddoyun)
    echo [INFO] Please create virtual environment first:
    echo        python -m venv .mddoyun
    echo        .mddoyun\Scripts\activate
    echo        pip install -r requirements.txt
    pause
    exit /b 1
)

echo [1/6] Activating virtual environment...
call .mddoyun\Scripts\activate.bat
echo [OK] Virtual environment activated
echo.

REM 2. PyInstaller 설치 확인
echo [2/6] Checking PyInstaller...
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo [INFO] Installing PyInstaller...
    pip install pyinstaller
)
echo [OK] PyInstaller ready
echo.

REM 3. 이전 빌드 정리
echo [3/6] Cleaning previous build...
if exist "build" rmdir /s /q "build"
if exist "dist\CostEstimator" rmdir /s /q "dist\CostEstimator"
if exist "CostEstimator_BlenderAddon_453\server_win" rmdir /s /q "CostEstimator_BlenderAddon_453\server_win"
echo [OK] Cleaned
echo.

REM 4. PyInstaller 빌드 실행 (--onedir 모드)
echo [4/6] Building Windows executable with PyInstaller...
echo [INFO] This may take 5-10 minutes on first run...
echo [INFO] Using --onedir mode (no extraction delay)
echo.

pyinstaller --name "CostEstimator" ^
  --onedir ^
  --add-data "db.sqlite3;." ^
  --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" ^
  --add-data "connections;connections" ^
  --hidden-import "django" ^
  --hidden-import "channels" ^
  --hidden-import "daphne" ^
  --collect-all django ^
  --collect-all channels ^
  --collect-all daphne ^
  --noconfirm ^
  run_integrated_server.py

if not exist "dist\CostEstimator\CostEstimator.exe" (
    echo.
    echo [ERROR] Build failed! dist\CostEstimator\CostEstimator.exe not found
    pause
    exit /b 1
)
echo [OK] Build completed successfully
echo.

REM 5. 애드온 폴더에 복사
echo [5/6] Copying to Blender addon folder...
if not exist "CostEstimator_BlenderAddon_453" (
    echo [ERROR] Addon folder not found: CostEstimator_BlenderAddon_453
    pause
    exit /b 1
)

mkdir "CostEstimator_BlenderAddon_453\server_win" 2>nul
xcopy /E /I /Y /Q "dist\CostEstimator" "CostEstimator_BlenderAddon_453\server_win\CostEstimator" >nul

if exist "CostEstimator_BlenderAddon_453\server_win\CostEstimator\CostEstimator.exe" (
    echo [OK] Copied to CostEstimator_BlenderAddon_453\server_win\
) else (
    echo [ERROR] Copy failed!
    pause
    exit /b 1
)
echo.

REM 6. ZIP 압축 (PowerShell 사용)
echo [6/6] Creating ZIP package...
if exist "CostEstimator_BlenderAddon_Windows.zip" del "CostEstimator_BlenderAddon_Windows.zip"

powershell -Command "Compress-Archive -Path 'CostEstimator_BlenderAddon_453', 'README_BLENDER_ADDON.md' -DestinationPath 'CostEstimator_BlenderAddon_Windows.zip' -Force"

if exist "CostEstimator_BlenderAddon_Windows.zip" (
    echo [OK] ZIP created: CostEstimator_BlenderAddon_Windows.zip
) else (
    echo [WARNING] ZIP creation failed (optional step)
)
echo.

REM 빌드 결과 확인
echo ============================================================
echo [SUCCESS] Build Complete!
echo ============================================================
echo.
echo Server executable:
echo   CostEstimator_BlenderAddon_453\server_win\CostEstimator\CostEstimator.exe
echo.
if exist "CostEstimator_BlenderAddon_Windows.zip" (
    echo ZIP package:
    echo   CostEstimator_BlenderAddon_Windows.zip
    echo.
)
echo You can now:
echo   1. Test the addon in Blender (Windows)
echo   2. Distribute CostEstimator_BlenderAddon_Windows.zip
echo.
echo [NOTE] If you need both macOS and Windows in one ZIP:
echo   - Keep server_mac folder from macOS build
echo   - Add server_win folder from this build
echo   - Create universal ZIP with both folders
echo ============================================================
pause
