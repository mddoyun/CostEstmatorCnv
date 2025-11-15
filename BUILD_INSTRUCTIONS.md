# CostEstimator 실행파일 빌드 가이드

Django + Ollama AI 통합 서버를 하나의 실행파일로 빌드하는 방법입니다.

## 중요: 크로스 플랫폼 빌드 제한

**PyInstaller는 크로스 컴파일을 지원하지 않습니다:**
- macOS에서는 **macOS용 실행파일만** 빌드 가능
- Windows에서는 **Windows용 실행파일만** 빌드 가능
- Linux에서는 **Linux용 실행파일만** 빌드 가능

따라서 각 플랫폼용 실행파일은 해당 플랫폼에서 빌드해야 합니다.

---

## 1. macOS 빌드 방법

### 사전 준비
```bash
# Ollama 설치 (선택사항, 실행 시 필요)
brew install ollama

# Llama 모델 다운로드 (선택사항)
ollama pull llama3.2:3b
```

### 빌드 실행
```bash
# 방법 1: 빌드 스크립트 사용 (권장)
./build_macos.sh

# 방법 2: 수동 빌드
source .mddoyun/bin/activate
pyinstaller --name "CostEstimator" \
  --onefile \
  --add-data "db.sqlite3:." \
  --add-data "aibim_quantity_takeoff_web:aibim_quantity_takeoff_web" \
  --add-data "connections:connections" \
  run_integrated_server.py
```

### 빌드 결과
- **실행파일 위치**: `dist/CostEstimator`
- **실행 방법**: `./dist/CostEstimator`
- **데이터 폴더**: `~/CostEstimator_Data/` (자동 생성)

### 배포
```bash
# 실행파일만 복사해서 다른 macOS에 배포 가능
cp dist/CostEstimator ~/Desktop/

# 또는 압축
zip -r CostEstimator_macOS.zip dist/CostEstimator
```

---

## 2. Windows 빌드 방법

### 사전 준비
```cmd
REM Ollama 설치 (선택사항, 실행 시 필요)
REM https://ollama.ai 에서 다운로드 및 설치

REM Llama 모델 다운로드 (선택사항)
ollama pull llama3.2:3b
```

### 빌드 실행
```cmd
REM 방법 1: 빌드 스크립트 사용 (권장)
build_windows.bat

REM 방법 2: 수동 빌드
call .mddoyun\Scripts\activate.bat
pyinstaller --name "CostEstimator" ^
  --onefile ^
  --add-data "db.sqlite3;." ^
  --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" ^
  --add-data "connections;connections" ^
  run_integrated_server.py
```

### 빌드 결과
- **실행파일 위치**: `dist\CostEstimator.exe`
- **실행 방법**: 더블클릭 또는 `dist\CostEstimator.exe`
- **데이터 폴더**: `C:\Users\<사용자>\CostEstimator_Data\` (자동 생성)

### 배포
```cmd
REM 실행파일만 복사해서 다른 Windows에 배포 가능
copy dist\CostEstimator.exe C:\Users\Public\Desktop\

REM 또는 압축
powershell Compress-Archive -Path dist\CostEstimator.exe -DestinationPath CostEstimator_Windows.zip
```

---

## 3. 실행파일 기능

통합 실행파일(`CostEstimator` / `CostEstimator.exe`)은 다음을 자동으로 수행합니다:

1. **Ollama 자동 감지 및 실행**
   - 시스템에 Ollama가 설치되어 있으면 자동으로 찾아서 실행
   - 이미 실행 중이면 기존 인스턴스 사용
   - 설치되어 있지 않으면 경고 후 Django만 실행

2. **Django 서버 자동 실행**
   - 데이터베이스 자동 설정 (`~/CostEstimator_Data/db.sqlite3`)
   - 마이그레이션 자동 실행
   - 서버 시작: `http://127.0.0.1:8000`

3. **종료 시 자동 정리**
   - Ctrl+C 입력 시 Django와 Ollama 모두 정상 종료

---

## 4. 사용자 실행 방법

### macOS
```bash
# 실행
./CostEstimator

# 백그라운드 실행
./CostEstimator &

# 로그 파일로 저장
./CostEstimator > server.log 2>&1 &
```

### Windows
```cmd
REM 더블클릭 또는 명령 프롬프트에서
CostEstimator.exe

REM 로그 파일로 저장
CostEstimator.exe > server.log 2>&1
```

### 접속
- **Django 웹 UI**: http://127.0.0.1:8000
- **Ollama API**: http://127.0.0.1:11434

---

## 5. 문제 해결

### "Ollama not found"
**원인**: Ollama가 설치되어 있지 않음

**해결**:
- macOS: `brew install ollama`
- Windows: https://ollama.ai 에서 다운로드

### "No Llama model found"
**원인**: Ollama는 설치되었지만 모델이 없음

**해결**:
```bash
ollama pull llama3.2:3b
```

### "Port 8000 already in use"
**원인**: 다른 서버가 이미 8000 포트 사용 중

**해결**:
```bash
# macOS/Linux
lsof -ti:8000 | xargs kill

# Windows
netstat -ano | findstr :8000
taskkill /PID <프로세스ID> /F
```

### "Database is locked"
**원인**: 다른 프로세스가 데이터베이스 파일 사용 중

**해결**:
- 모든 CostEstimator 인스턴스 종료 후 재시작
- `~/CostEstimator_Data/db.sqlite3-journal` 파일 삭제

---

## 6. 빌드 파일 크기 및 성능

### 예상 파일 크기
- **macOS**: ~150-200 MB
- **Windows**: ~100-150 MB

### 시작 시간
- **초기 실행**: 10-30초 (압축 해제 + 데이터베이스 설정)
- **이후 실행**: 5-10초 (Ollama 시작 포함)

### 포함된 내용
- Python 인터프리터
- Django 및 모든 의존성 라이브러리
- 데이터베이스 초기 파일
- 모든 정적 파일 및 템플릿

### 포함되지 않는 내용 (별도 설치 필요)
- Ollama 실행파일
- Ollama AI 모델 (llama3.2:3b 등)

---

## 7. 개발자용 참고사항

### 통합 런처 코드
- **파일**: `run_integrated_server.py`
- **기능**:
  - 플랫폼 자동 감지 (Windows/macOS/Linux)
  - Ollama 자동 탐지 및 시작
  - Django 환경 설정 및 실행
  - 종료 시 프로세스 정리

### 빌드 스크립트
- **macOS**: `build_macos.sh`
- **Windows**: `build_windows.bat`

### 디버그 모드로 실행
```bash
# 개발 환경에서 직접 실행 (빌드 없이)
python run_integrated_server.py
```

---

## 8. 라이선스 및 배포

### 배포 시 포함할 파일
- 실행파일 (`CostEstimator` 또는 `CostEstimator.exe`)
- README 또는 사용자 가이드
- Ollama 설치 안내

### 배포 시 주의사항
- 사용자에게 Ollama 별도 설치 필요함을 안내
- 방화벽에서 8000, 11434 포트 허용 필요
- 백신 소프트웨어가 실행 차단할 수 있음 (예외 추가 필요)

---

## 9. 업데이트 방법

새 버전 배포 시:
1. 코드 수정
2. 해당 플랫폼에서 재빌드
3. 새 실행파일 배포
4. 사용자의 `~/CostEstimator_Data/` 폴더는 그대로 유지됨

---

## 문의

문제가 발생하면 GitHub Issues에 보고해주세요.
