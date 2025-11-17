# Windows 빌드 가이드

Windows에서 Blender 애드온용 서버 실행파일을 빌드하는 방법입니다.

## 📋 준비 사항

### 1. Python 설치
- Python 3.11 이상 필요
- https://www.python.org/downloads/ 에서 다운로드
- 설치 시 "Add Python to PATH" 체크 필수

### 2. Git 설치 (선택사항)
- GitHub에서 코드를 받기 위해 필요
- https://git-scm.com/download/win

## 🚀 빌드 절차

### 방법 1: GitHub에서 클론

```cmd
git clone https://github.com/mddoyun/CostEstmatorCnv.git
cd CostEstmatorCnv
```

### 방법 2: ZIP 다운로드

1. GitHub 페이지에서 "Code" → "Download ZIP"
2. 압축 해제
3. 명령 프롬프트에서 해당 폴더로 이동

## 🔧 가상환경 설정

```cmd
REM 가상환경 생성
python -m venv .mddoyun

REM 가상환경 활성화
.mddoyun\Scripts\activate

REM 의존성 설치
pip install -r requirements.txt
```

## ⚡ 원클릭 빌드

가상환경이 준비되면 **더블클릭 한 번**으로 모든 작업 완료:

```cmd
build_windows.bat
```

이 스크립트는 자동으로:
1. ✅ 가상환경 활성화
2. ✅ PyInstaller 설치 (필요시)
3. ✅ 이전 빌드 정리
4. ✅ Windows용 서버 실행파일 빌드 (5-10분 소요)
5. ✅ `CostEstimator_BlenderAddon_453/server_win/` 폴더에 복사
6. ✅ ZIP 파일 생성 (`CostEstimator_BlenderAddon_Windows.zip`)

## 📁 빌드 결과

빌드 성공 시 다음 파일이 생성됩니다:

```
CostEstimator_BlenderAddon_453/
  ├── __init__.py
  ├── lib/
  ├── server_mac/          ← macOS 빌드 (이미 있으면 유지)
  └── server_win/          ← ✨ 새로 생성됨
      └── CostEstimator/
          ├── CostEstimator.exe
          └── _internal/
```

ZIP 파일:
```
CostEstimator_BlenderAddon_Windows.zip  ← Windows 전용
```

## 🌐 범용 ZIP 만들기 (macOS + Windows)

macOS와 Windows를 모두 지원하는 하나의 ZIP을 만들려면:

1. **macOS에서 먼저 빌드** (`./build_macos.sh`)
2. **Windows에서 빌드** (`build_windows.bat`)
3. 두 폴더 모두 유지:
   ```
   CostEstimator_BlenderAddon_453/
     ├── server_mac/      ← macOS 빌드 결과
     └── server_win/      ← Windows 빌드 결과
   ```
4. 범용 ZIP 생성:
   ```cmd
   powershell -Command "Compress-Archive -Path 'CostEstimator_BlenderAddon_453', 'README_BLENDER_ADDON.md' -DestinationPath 'CostEstimator_BlenderAddon_Universal.zip' -Force"
   ```

## 🧪 테스트

### Blender에서 테스트

1. Blender 실행
2. Edit → Preferences → Add-ons → Install
3. `CostEstimator_BlenderAddon_Windows.zip` 선택
4. 애드온 활성화
5. 3D View 사이드바(N) → Cost Estimator 탭
6. "서버 시작" 버튼 클릭

### 진행률 확인

서버 시작 시 다음과 같은 진행 상황을 볼 수 있습니다:

```
시작 중... ⚙️ 초기화 (15%)
시작 중... 🗄️ DB 마이그레이션 (35%)
시작 중... 🚀 서버 준비 (52%)
시작 중... 🔌 포트 바인딩 (73%)
시작 중... 📚 라이브러리 로딩 (87%)
⠋ 마무리 중... 잠시만 기다려주세요 (93%)
실행 중 ✅
```

첫 실행은 2-3분 소요될 수 있습니다.

## 🐛 문제 해결

### 에러: "Virtual environment not found"

```cmd
python -m venv .mddoyun
.mddoyun\Scripts\activate
pip install -r requirements.txt
```

### 에러: "PyInstaller 설치 실패"

```cmd
.mddoyun\Scripts\activate
python -m pip install --upgrade pip
pip install pyinstaller
```

### 에러: "Build failed"

1. 가상환경이 활성화되어 있는지 확인:
   ```cmd
   .mddoyun\Scripts\activate
   ```

2. 의존성 다시 설치:
   ```cmd
   pip install -r requirements.txt --upgrade
   ```

3. 관리자 권한으로 실행 (필요시)

### 빌드가 너무 느림

- 첫 빌드: 5-10분 정상 (TensorFlow 등 큰 라이브러리)
- 두 번째 빌드부터: 1-2분 (캐시 사용)

## 📊 빌드 옵션

`build_windows.bat`는 `--onedir` 모드를 사용합니다:

- ✅ 실행 시 압축 해제 불필요 (즉시 실행)
- ✅ 서버 시작 시간 30-40초 단축
- ⚠️ 폴더 크기: ~500MB (단일 파일보다 큼)

### 단일 파일로 빌드하려면 (비추천)

`build_windows.bat` 파일에서:
```bat
--onedir   → --onefile
```

단, 매번 실행 시 30-40초 압축 해제 시간이 추가됩니다.

## 📝 참고

- **Ollama 필요**: AI 기능 사용 시 Ollama 별도 설치 필요
  - https://ollama.ai
  - `ollama pull llama3.2:3b`
  - `ollama pull nomic-embed-text`

- **서버 포트**: 기본 8000번 (변경 가능)

- **로그 파일**: `%TEMP%\blender_server.log`

## ✅ 완료

빌드가 완료되면:

1. ✅ `CostEstimator_BlenderAddon_Windows.zip` 생성됨
2. ✅ Windows Blender에서 설치 가능
3. ✅ "서버 시작" 버튼으로 즉시 실행

추가 질문은 GitHub Issues에 등록해주세요!
