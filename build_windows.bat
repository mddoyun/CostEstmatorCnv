@echo off
REM Windows용 CostEstimator 실행파일 빌드 스크립트

echo ==========================================
echo CostEstimator Windows Build Script
echo ==========================================

REM 1. 가상환경 확인
if not exist ".mddoyun" (
    echo [ERROR] Virtual environment not found (.mddoyun^)
    echo [INFO] Please create virtual environment first
    pause
    exit /b 1
)

echo [INFO] Activating virtual environment...
call .mddoyun\Scripts\activate.bat

REM 2. PyInstaller 설치 확인
echo [INFO] Checking PyInstaller...
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo [INFO] Installing PyInstaller...
    pip install pyinstaller
)

REM 3. 이전 빌드 정리
echo [INFO] Cleaning previous build...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist *.spec del /q *.spec

REM 4. 빌드 실행
echo [INFO] Building CostEstimator executable...
echo.

pyinstaller --name "CostEstimator" ^
  --onefile ^
  --add-data "db.sqlite3;." ^
  --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" ^
  --add-data "connections;connections" ^
  run_integrated_server.py

REM 5. 빌드 결과 확인
if exist "dist\CostEstimator.exe" (
    echo.
    echo ==========================================
    echo [SUCCESS] Build completed!
    echo ==========================================
    echo Executable location: dist\CostEstimator.exe
    dir dist\CostEstimator.exe
    echo.
    echo To run: dist\CostEstimator.exe
    echo.
    echo [NOTE] Ollama must be installed separately:
    echo   Download from https://ollama.ai
    echo   ollama pull llama3.2:3b
    echo ==========================================
) else (
    echo.
    echo ==========================================
    echo [ERROR] Build failed!
    echo ==========================================
    pause
    exit /b 1
)

pause
