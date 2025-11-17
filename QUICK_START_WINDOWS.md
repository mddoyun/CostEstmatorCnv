# Windows 빠른 시작 가이드 (올인원)

**원클릭으로 GitHub 클론부터 빌드까지 모든 과정을 자동 실행합니다!**

## 🎯 목표

이 배치 파일 하나만 실행하면:
1. ✅ GitHub에서 코드 클론
2. ✅ 가상환경 자동 생성
3. ✅ 의존성 자동 설치
4. ✅ Windows 서버 실행파일 빌드
5. ✅ ZIP 패키지 생성

**소요 시간**: 10-15분 (첫 실행)

---

## 📋 준비물

### 1. Python 설치 (필수)
- Python 3.11 이상
- 다운로드: https://www.python.org/downloads/
- ⚠️ **중요**: 설치 시 "Add Python to PATH" 체크!

### 2. Git 설치 (필수)
- 다운로드: https://git-scm.com/download/win
- 기본 설정으로 설치

### 3. 디스크 공간
- 최소 2GB 여유 공간 (의존성 + 빌드 결과)

---

## 🚀 사용 방법

### 방법 1: GitHub에서 다운로드

1. **이 파일만 다운로드**:
   - https://raw.githubusercontent.com/mddoyun/CostEstmatorCnv/main/setup_and_build_windows.bat
   - 우클릭 → "다른 이름으로 저장"

2. **원하는 폴더에 저장**:
   ```
   C:\MyProjects\
     └── setup_and_build_windows.bat  ← 여기에 저장
   ```

3. **더블클릭 실행**:
   ```
   setup_and_build_windows.bat
   ```

### 방법 2: 직접 생성

1. 메모장 열기
2. 아래 링크의 내용 복사:
   - https://raw.githubusercontent.com/mddoyun/CostEstmatorCnv/main/setup_and_build_windows.bat
3. `setup_and_build_windows.bat`로 저장
4. 더블클릭 실행

---

## 📺 실행 과정

더블클릭 후 다음과 같이 진행됩니다:

```
============================================================
CostEstimator Complete Setup and Build
============================================================

[1/6] Checking Git...
[OK] Git found

[2/6] Checking Python...
Python 3.11.9
[OK] Python found

[3/6] Cloning from GitHub...
Cloning into 'CostEstmatorCnv'...
[OK] Repository cloned

[4/6] Setting up virtual environment...
[OK] Virtual environment ready

[5/6] Installing dependencies...
[INFO] Installing requirements (5-10 minutes)...
[OK] Dependencies installed

[6/6] Building Windows server executable...
[INFO] This will take 5-10 minutes on first run...

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
Building CostEstimator...
[OK] Build completed successfully

[5/6] Copying to Blender addon folder...
[OK] Copied to CostEstimator_BlenderAddon_453\server_win\

[6/6] Creating ZIP package...
[OK] ZIP created: CostEstimator_BlenderAddon_Windows.zip

============================================================
[SUCCESS] Complete Setup and Build Finished!
============================================================

Build results are in:
  C:\MyProjects\CostEstmatorCnv\CostEstimator_BlenderAddon_453\server_win\

ZIP package:
  C:\MyProjects\CostEstmatorCnv\CostEstimator_BlenderAddon_Windows.zip
```

---

## 📁 결과 확인

실행이 완료되면 다음 폴더가 생성됩니다:

```
C:\MyProjects\
  ├── setup_and_build_windows.bat  ← 실행한 파일
  └── CostEstmatorCnv/              ← 새로 생성됨
      ├── CostEstimator_BlenderAddon_453/
      │   └── server_win/
      │       └── CostEstimator/
      │           ├── CostEstimator.exe  ← 서버 실행파일
      │           └── _internal/
      └── CostEstimator_BlenderAddon_Windows.zip  ← 배포용 ZIP
```

---

## 🎮 Blender에서 사용하기

1. **Blender 실행**

2. **애드온 설치**:
   - Edit → Preferences → Add-ons
   - Install 버튼 클릭
   - `CostEstimator_BlenderAddon_Windows.zip` 선택
   - 체크박스 활성화

3. **서버 시작**:
   - 3D View 사이드바(N 키) → Cost Estimator 탭
   - "서버 시작" 버튼 클릭
   - 진행률이 표시되며 서버 시작 (2-3분 소요)

4. **사용**:
   - IFC 파일 불러오기
   - 물량 산출, 견적 작성 등

---

## 🔄 재빌드하기

이미 한 번 실행한 후 코드 업데이트가 있을 때:

```cmd
cd CostEstmatorCnv
git pull
build_windows.bat
```

또는 `setup_and_build_windows.bat`을 다시 실행하면:
- 기존 폴더 삭제 여부 물어봄
- Y 선택 시 새로 클론 + 빌드
- N 선택 시 기존 폴더 사용 + 빌드만

---

## 🐛 문제 해결

### 에러: "Git not found"

**원인**: Git이 설치되지 않았거나 PATH에 없음

**해결**:
1. Git 설치: https://git-scm.com/download/win
2. 명령 프롬프트 새로 열기
3. `git --version` 확인

### 에러: "Python not found"

**원인**: Python이 설치되지 않았거나 PATH에 없음

**해결**:
1. Python 제거
2. https://www.python.org/downloads/ 에서 재설치
3. ⚠️ **"Add Python to PATH" 체크 필수!**
4. 명령 프롬프트 새로 열기
5. `python --version` 확인

### 에러: "Clone failed"

**원인**: 네트워크 문제 또는 GitHub 접속 불가

**해결**:
1. 인터넷 연결 확인
2. GitHub 접속 확인: https://github.com/mddoyun/CostEstmatorCnv
3. 방화벽/VPN 확인

### 에러: "Failed to create virtual environment"

**원인**: 디스크 공간 부족 또는 권한 문제

**해결**:
1. 디스크 공간 확인 (최소 2GB)
2. 관리자 권한으로 실행
3. 다른 폴더에서 시도

### 에러: "Failed to install dependencies"

**원인**: pip 오류 또는 네트워크 문제

**해결**:
```cmd
cd CostEstmatorCnv
.mddoyun\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 빌드가 너무 오래 걸림

**정상입니다!**
- 첫 빌드: 10-15분 (TensorFlow, Django 등 큰 라이브러리)
- 두 번째 빌드: 1-2분 (캐시 사용)

---

## 💡 고급 사용법

### 다른 위치에서 실행

배치 파일은 **어디에 두고 실행해도** 됩니다:

```
D:\Downloads\setup_and_build_windows.bat  ← 여기서 실행
  ↓
D:\Downloads\CostEstmatorCnv\  ← 여기에 클론됨
```

### 여러 버전 관리

날짜별로 폴더를 다르게:

```cmd
REM 배치 파일 수정 (메모장으로 열기)
REM 이 줄을 찾아서:
git clone https://github.com/mddoyun/CostEstmatorCnv.git

REM 이렇게 변경:
git clone https://github.com/mddoyun/CostEstmatorCnv.git CostEstmatorCnv_2025-11-17
```

### 빌드만 다시 하기

이미 클론되어 있다면:

```cmd
cd CostEstmatorCnv
.mddoyun\Scripts\activate
build_windows.bat
```

---

## 📞 지원

- **GitHub Issues**: https://github.com/mddoyun/CostEstmatorCnv/issues
- **문서**: BUILD_INSTRUCTIONS_WINDOWS.md (상세 가이드)

---

## ✅ 체크리스트

설치 전:
- [ ] Python 3.11+ 설치 완료
- [ ] "Add Python to PATH" 체크됨
- [ ] Git 설치 완료
- [ ] 2GB 이상 디스크 공간 확보

실행 후:
- [ ] `CostEstmatorCnv` 폴더 생성됨
- [ ] `CostEstimator_BlenderAddon_Windows.zip` 생성됨
- [ ] Blender 애드온 설치 완료
- [ ] 서버 시작 성공

---

## 🎉 완료!

이제 Blender에서 Cost Estimator를 사용할 수 있습니다!

**다음 단계**:
1. Blender에서 애드온 활성화
2. "서버 시작" 버튼 클릭
3. IFC 파일 불러오기
4. 물량 산출 시작!
