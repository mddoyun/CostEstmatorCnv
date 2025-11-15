#!/bin/bash
# macOS용 CostEstimator 실행파일 빌드 스크립트

echo "=========================================="
echo "CostEstimator macOS Build Script"
echo "=========================================="

# 1. 가상환경 확인
if [ ! -d ".mddoyun" ]; then
    echo "[ERROR] Virtual environment not found (.mddoyun)"
    echo "[INFO] Please create virtual environment first"
    exit 1
fi

echo "[INFO] Activating virtual environment..."
source .mddoyun/bin/activate

# 2. PyInstaller 설치 확인
echo "[INFO] Checking PyInstaller..."
if ! python -c "import PyInstaller" 2>/dev/null; then
    echo "[INFO] Installing PyInstaller..."
    pip install pyinstaller
fi

# 3. 이전 빌드 정리
echo "[INFO] Cleaning previous build..."
rm -rf build dist *.spec

# 4. 빌드 실행
echo "[INFO] Building CostEstimator executable..."
echo ""

pyinstaller --name "CostEstimator" \
  --onefile \
  --add-data "db.sqlite3:." \
  --add-data "aibim_quantity_takeoff_web:aibim_quantity_takeoff_web" \
  --add-data "connections:connections" \
  run_integrated_server.py

# 5. 빌드 결과 확인
if [ -f "dist/CostEstimator" ]; then
    echo ""
    echo "=========================================="
    echo "[SUCCESS] Build completed!"
    echo "=========================================="
    echo "Executable location: dist/CostEstimator"
    ls -lh dist/CostEstimator
    echo ""
    echo "To run: ./dist/CostEstimator"
    echo ""
    echo "[NOTE] Ollama must be installed separately:"
    echo "  brew install ollama"
    echo "  ollama pull llama3.2:3b"
    echo "=========================================="
else
    echo ""
    echo "=========================================="
    echo "[ERROR] Build failed!"
    echo "=========================================="
    exit 1
fi
