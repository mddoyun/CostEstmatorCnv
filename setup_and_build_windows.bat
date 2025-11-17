@echo off
REM ============================================================
REM CostEstimator - Complete Setup and Build Script for Windows
REM GitHub 클론 → 가상환경 설정 → 빌드를 한 번에 수행
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

REM 현재 디렉토리 저장
set "ORIGINAL_DIR=%CD%"

REM Git 확인
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

REM Python 확인
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

REM GitHub 클론
echo [3/6] Cloning from GitHub...
if exist "CostEstmatorCnv" (
    echo [INFO] CostEstmatorCnv folder already exists
    choice /C YN /M "Do you want to delete and re-clone? (Y/N)"
    if errorlevel 2 (
        echo [INFO] Using existing folder
    ) else (
        echo [INFO] Deleting existing folder...
        rmdir /s /q "CostEstmatorCnv"
        git clone https://github.com/mddoyun/CostEstmatorCnv.git
    )
) else (
    git clone https://github.com/mddoyun/CostEstmatorCnv.git
)

if not exist "CostEstmatorCnv" (
    echo [ERROR] Clone failed!
    pause
    exit /b 1
)
echo [OK] Repository cloned
echo.

REM 클론된 폴더로 이동
cd CostEstmatorCnv

REM 가상환경 설정
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

REM 가상환경 활성화 및 의존성 설치
echo [5/6] Installing dependencies...
call .mddoyun\Scripts\activate.bat

echo [INFO] Upgrading pip...
python -m pip install --upgrade pip --quiet

echo [INFO] Installing requirements (this may take 5-10 minutes)...
pip install -r requirements.txt --quiet

if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    cd "%ORIGINAL_DIR%"
    pause
    exit /b 1
)
echo [OK] Dependencies installed
echo.

REM 빌드 실행
echo [6/6] Building Windows server executable...
echo [INFO] This will take 5-10 minutes on first run...
echo.
call build_windows.bat

REM 원래 디렉토리로 복귀
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
