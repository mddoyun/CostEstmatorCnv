# 101_2025-11-17_Windows_Build_Script_Automation.md

**날짜**: 2025-11-17
**작업자**: Claude + User
**관련 파일**:
- `build_windows.bat`
- `BUILD_INSTRUCTIONS_WINDOWS.md`
- `.gitignore`

---

## 📋 작업 개요

Windows에서 Blender 애드온용 서버 실행파일을 **원클릭으로 빌드**할 수 있는 자동화 시스템을 구축했습니다.

**목표**:
- ✅ Windows 사용자가 Claude 에이전트 없이 빌드 가능
- ✅ 더블클릭 한 번으로 전체 프로세스 자동화
- ✅ macOS와 동일한 --onedir 모드 사용
- ✅ 빌드 결과 자동으로 애드온 폴더에 복사
- ✅ ZIP 패키징 자동화

---

## 🎯 문제 정의

### 기존 상황

macOS에서는 `build_macos.sh`로 빌드 가능했지만, Windows 사용자는:
1. ❌ 수동으로 PyInstaller 명령 실행 필요
2. ❌ 빌드 결과를 수동으로 애드온 폴더에 복사
3. ❌ ZIP 압축 수동 작업
4. ❌ Claude 에이전트 의존

### 요구사항

Windows 컴퓨터에서:
```cmd
git clone https://github.com/mddoyun/CostEstmatorCnv.git
cd CostEstmatorCnv
build_windows.bat  ← 더블클릭 한 번!
```

이후 자동으로:
1. PyInstaller 빌드 실행
2. `CostEstimator_BlenderAddon_453/server_win/` 폴더에 복사
3. ZIP 파일 생성

---

## 🔧 구현 내용

### 1. build_windows.bat 생성

**6단계 자동화 스크립트**:

```batch
@echo off
REM ============================================================
REM CostEstimator Windows Server Builder for Blender Addon
REM ============================================================

echo [1/6] Activating virtual environment...
call .mddoyun\Scripts\activate.bat

echo [2/6] Checking PyInstaller...
python -c "import PyInstaller" 2>nul || pip install pyinstaller

echo [3/6] Cleaning previous build...
rmdir /s /q "dist\CostEstimator"
rmdir /s /q "CostEstimator_BlenderAddon_453\server_win"

echo [4/6] Building Windows executable (--onedir mode)...
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

echo [5/6] Copying to Blender addon folder...
xcopy /E /I /Y /Q "dist\CostEstimator" "CostEstimator_BlenderAddon_453\server_win\CostEstimator"

echo [6/6] Creating ZIP package...
powershell -Command "Compress-Archive -Path 'CostEstimator_BlenderAddon_453', 'README_BLENDER_ADDON.md' -DestinationPath 'CostEstimator_BlenderAddon_Windows.zip' -Force"

echo [SUCCESS] Build Complete!
```

**주요 특징**:
- **에러 처리**: 각 단계마다 실패 시 명확한 에러 메시지
- **PyInstaller 자동 설치**: 없으면 자동으로 설치
- **진행 상황 표시**: [1/6], [2/6] ... 현재 단계 표시
- **조용한 실행**: `/Q` 플래그로 불필요한 출력 제거
- **PowerShell 통합**: ZIP 압축에 PowerShell 사용

### 2. BUILD_INSTRUCTIONS_WINDOWS.md 작성

**포함 내용**:

1. **준비 사항**
   - Python 3.11+ 설치 방법
   - Git 설치 (선택사항)

2. **빌드 절차**
   - GitHub 클론 방법
   - 가상환경 설정
   - 빌드 실행

3. **빌드 결과**
   ```
   CostEstimator_BlenderAddon_453/
     └── server_win/
         └── CostEstimator/
             ├── CostEstimator.exe
             └── _internal/
   ```

4. **범용 ZIP 만들기**
   - macOS + Windows 모두 포함하는 방법
   - 양쪽에서 각각 빌드 후 합치기

5. **문제 해결**
   - Virtual environment not found
   - PyInstaller 설치 실패
   - Build failed
   - 빌드가 너무 느림

6. **테스트 방법**
   - Blender에서 애드온 설치
   - 서버 시작 버튼 테스트
   - 진행률 확인

### 3. .gitignore 업데이트

빌드 결과물 제외 설정:

```gitignore
# Blender Addon Server Build Results (too large for git)
CostEstimator_BlenderAddon_453/server_mac/
CostEstimator_BlenderAddon_453/server_win/
CostEstimator_BlenderAddon_*.zip
*.spec
```

**이유**:
- 빌드 결과물은 수백 MB ~ GB 단위
- Git에 커밋하면 저장소 크기 폭증
- 각 OS에서 로컬 빌드하는 것이 효율적

---

## 🌐 크로스 플랫폼 지원

### OS 감지 로직 (이미 구현됨)

애드온 코드는 이미 OS를 자동 감지합니다:

```python
# CostEstimator_BlenderAddon_453/__init__.py Line 885-891

if platform.system() == "Windows":
    executable_path = os.path.join(addon_dir, "server_win", "CostEstimator", "CostEstimator.exe")
elif platform.system() == "Darwin":
    executable_path = os.path.join(addon_dir, "server_mac", "CostEstimator", "CostEstimator")
else:
    self.report({'ERROR'}, f"지원하지 않는 운영체제: {platform.system()}")
    return {'CANCELLED'}
```

### 빌드 프로세스

| 플랫폼 | 빌드 스크립트 | 출력 위치 | 실행 파일 |
|--------|---------------|-----------|-----------|
| macOS | `build_macos.sh` | `server_mac/CostEstimator/` | `CostEstimator` |
| Windows | `build_windows.bat` | `server_win/CostEstimator/` | `CostEstimator.exe` |

### 범용 ZIP 구조

```
CostEstimator_BlenderAddon_Universal.zip
  └── CostEstimator_BlenderAddon_453/
      ├── __init__.py
      ├── lib/
      ├── server_mac/          ← macOS 빌드 결과
      │   └── CostEstimator/
      │       ├── CostEstimator
      │       └── _internal/
      └── server_win/          ← Windows 빌드 결과
          └── CostEstimator/
              ├── CostEstimator.exe
              └── _internal/
```

**사용자 경험**:
- Windows 사용자: 서버 시작 → `server_win/CostEstimator.exe` 실행 ✅
- macOS 사용자: 서버 시작 → `server_mac/CostEstimator` 실행 ✅
- 하나의 ZIP으로 모든 OS 지원! 🎉

---

## 🧪 빌드 테스트 시나리오

### macOS에서 Windows 빌드 준비

1. macOS에서 작업 완료:
   ```bash
   ./build_macos.sh
   git add .
   git commit -m "macOS 빌드 완료"
   git push
   ```

2. GitHub에 푸시된 상태

### Windows에서 빌드 실행

1. **환경 준비** (최초 1회):
   ```cmd
   git clone https://github.com/mddoyun/CostEstmatorCnv.git
   cd CostEstmatorCnv
   python -m venv .mddoyun
   .mddoyun\Scripts\activate
   pip install -r requirements.txt
   ```

2. **빌드 실행**:
   ```cmd
   build_windows.bat
   ```

3. **예상 출력**:
   ```
   ============================================================
   CostEstimator Windows Server Build Script
   ============================================================

   [1/6] Activating virtual environment...
   [OK] Virtual environment activated

   [2/6] Checking PyInstaller...
   [OK] PyInstaller ready

   [3/6] Cleaning previous build...
   [OK] Cleaned

   [4/6] Building Windows executable with PyInstaller...
   [INFO] This may take 5-10 minutes on first run...
   Building CostEstimator...
   [OK] Build completed successfully

   [5/6] Copying to Blender addon folder...
   [OK] Copied to CostEstimator_BlenderAddon_453\server_win\

   [6/6] Creating ZIP package...
   [OK] ZIP created: CostEstimator_BlenderAddon_Windows.zip

   ============================================================
   [SUCCESS] Build Complete!
   ============================================================

   Server executable:
     CostEstimator_BlenderAddon_453\server_win\CostEstimator\CostEstimator.exe

   ZIP package:
     CostEstimator_BlenderAddon_Windows.zip

   You can now:
     1. Test the addon in Blender (Windows)
     2. Distribute CostEstimator_BlenderAddon_Windows.zip
   ============================================================
   ```

4. **빌드 시간**:
   - 첫 빌드: 5-10분 (TensorFlow 등 큰 라이브러리)
   - 두 번째 빌드: 1-2분 (캐시 사용)

### 범용 ZIP 생성

Windows 빌드 완료 후:

```cmd
REM macOS 빌드가 이미 server_mac에 있다면
powershell -Command "Compress-Archive -Path 'CostEstimator_BlenderAddon_453', 'README_BLENDER_ADDON.md' -DestinationPath 'CostEstimator_BlenderAddon_Universal.zip' -Force"
```

이제 `CostEstimator_BlenderAddon_Universal.zip`은 macOS와 Windows를 모두 지원합니다!

---

## 📊 비교: Before vs After

### Before (개선 전)

**Windows 빌드 과정**:
```
1. Claude 에이전트 실행
2. "PyInstaller로 빌드해줘" 요청
3. 명령어 복사 → 수동 실행
4. 빌드 결과 확인
5. 수동으로 애드온 폴더에 복사
6. 수동으로 ZIP 압축
```

**소요 시간**: 30분 + 사람 개입 필요 ❌

### After (개선 후)

**Windows 빌드 과정**:
```
1. build_windows.bat 더블클릭
2. (자동으로 모든 작업 완료)
```

**소요 시간**: 5-10분 (첫 빌드), 사람 개입 불필요 ✅

---

## 🔄 통합 워크플로우

### 개발 → 배포 전체 과정

#### macOS 개발자 측

```bash
# 1. 개발 완료
git add .
git commit -m "기능 추가"
git push

# 2. macOS 빌드
./build_macos.sh

# 3. macOS ZIP 생성 (선택사항)
zip -r CostEstimator_BlenderAddon_macOS.zip CostEstimator_BlenderAddon_453/ README_BLENDER_ADDON.md
```

#### Windows 빌드 담당자 측

```cmd
REM 1. 최신 코드 받기
git pull

REM 2. Windows 빌드 (자동)
build_windows.bat

REM 3. 범용 ZIP 생성 (macOS 빌드 포함된 상태)
powershell -Command "Compress-Archive -Path 'CostEstimator_BlenderAddon_453', 'README_BLENDER_ADDON.md' -DestinationPath 'CostEstimator_BlenderAddon_Universal.zip' -Force"
```

#### 최종 배포

```
배포 파일:
1. CostEstimator_BlenderAddon_macOS.zip      (macOS 전용)
2. CostEstimator_BlenderAddon_Windows.zip    (Windows 전용)
3. CostEstimator_BlenderAddon_Universal.zip  (macOS + Windows)
```

---

## 🛠️ 기술적 세부사항

### PyInstaller 옵션

```batch
pyinstaller --name "CostEstimator" ^
  --onedir ^                      # 폴더 형태 (압축 해제 불필요)
  --add-data "db.sqlite3;." ^     # 데이터베이스 포함
  --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" ^
  --add-data "connections;connections" ^
  --hidden-import "django" ^      # 숨겨진 import 명시
  --hidden-import "channels" ^
  --hidden-import "daphne" ^
  --collect-all django ^          # Django 전체 수집
  --collect-all channels ^
  --collect-all daphne ^
  --noconfirm ^                   # 덮어쓰기 확인 없이
  run_integrated_server.py
```

### Windows 배치 파일 특징

**에러 처리**:
```batch
if not exist "dist\CostEstimator\CostEstimator.exe" (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
```

**조건부 PyInstaller 설치**:
```batch
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo [INFO] Installing PyInstaller...
    pip install pyinstaller
)
```

**PowerShell 통합**:
```batch
powershell -Command "Compress-Archive -Path 'CostEstimator_BlenderAddon_453', 'README_BLENDER_ADDON.md' -DestinationPath 'CostEstimator_BlenderAddon_Windows.zip' -Force"
```

### 파일 크기 최적화

**--onedir 모드 장점**:
- ✅ 실행 시 압축 해제 불필요 (30-40초 단축)
- ✅ 라이브러리 캐싱 가능
- ⚠️ 폴더 크기: ~500MB

**--onefile과 비교**:
| 항목 | --onefile | --onedir |
|------|-----------|----------|
| 배포 크기 | ~300MB (단일 파일) | ~500MB (폴더) |
| 압축 해제 | 매번 30-40초 | 불필요 |
| 서버 시작 | 느림 | 빠름 |
| 사용자 경험 | ❌ 매번 대기 | ✅ 즉시 실행 |

---

## 📝 문서화

### BUILD_INSTRUCTIONS_WINDOWS.md 구조

1. **준비 사항**
   - Python 설치
   - Git 설치 (선택)

2. **빌드 절차**
   - 코드 다운로드
   - 가상환경 설정
   - 빌드 실행

3. **빌드 결과**
   - 폴더 구조
   - 파일 위치

4. **범용 ZIP**
   - macOS + Windows 통합
   - 생성 방법

5. **테스트**
   - Blender 설치
   - 서버 시작 확인

6. **문제 해결**
   - 자주 발생하는 에러
   - 해결 방법

---

## ✅ 완료 체크리스트

- [x] build_windows.bat 스크립트 작성
- [x] --onedir 모드 사용
- [x] 애드온 폴더 자동 복사
- [x] ZIP 패키징 자동화
- [x] BUILD_INSTRUCTIONS_WINDOWS.md 작성
- [x] .gitignore 업데이트
- [x] Git commit & push
- [x] workings 문서화

---

## 🔮 향후 개선 가능 사항

1. **CI/CD 통합**
   - GitHub Actions로 자동 빌드
   - Windows와 macOS 빌드 동시 실행
   - Release 자동 생성

2. **코드 서명**
   - macOS: Apple Developer 인증서
   - Windows: Authenticode 서명
   - 보안 경고 제거

3. **빌드 최적화**
   - 불필요한 라이브러리 제거
   - 압축 레벨 조정
   - 파일 크기 최소화

4. **자동 업데이트**
   - 애드온에서 새 버전 감지
   - 원클릭 업데이트 기능

---

## 🎉 결론

이제 Windows 사용자도 **Claude 에이전트 없이** `build_windows.bat` 더블클릭 한 번으로 Blender 애드온용 서버 실행파일을 빌드할 수 있습니다!

**사용자 경험**:
- macOS: `./build_macos.sh` 실행
- Windows: `build_windows.bat` 더블클릭
- 결과: 동일한 품질의 애드온 패키지

**배포 시나리오**:
1. macOS 전용 ZIP
2. Windows 전용 ZIP
3. 범용 ZIP (macOS + Windows)

모든 시나리오를 자동화로 지원합니다! 🚀
