# 블렌더 애드온 배포 가이드

CostEstimator 블렌더 애드온을 배포하기 위한 가이드입니다.

---

## 📦 배포 파일 구조

```
CostEstimator_BlenderAddon_453/
├── __init__.py                 # 애드온 메인 파일
├── lib/                         # 외부 라이브러리
│   └── websockets/             # WebSocket 클라이언트
├── server_mac/                  # macOS 서버 실행파일
│   └── CostEstimator           # 통합 서버 (417MB)
└── server_win/                  # Windows 서버 실행파일
    └── CostEstimator.exe       # 통합 서버 (예상 100-150MB)
```

---

## 🚀 빠른 배포 (macOS)

### 1단계: 실행파일 복사

```bash
# 프로젝트 루트에서 실행
cd /Users/mddoyun/Developments/CostEstimatorCnv

# server_mac 폴더 생성 (없으면)
mkdir -p CostEstimator_BlenderAddon_453/server_mac

# 빌드된 실행파일 복사
cp dist/CostEstimator CostEstimator_BlenderAddon_453/server_mac/

# 실행 권한 부여
chmod +x CostEstimator_BlenderAddon_453/server_mac/CostEstimator

# 확인
ls -lh CostEstimator_BlenderAddon_453/server_mac/
```

### 2단계: 애드온 압축

```bash
# 블렌더 애드온 폴더로 이동
cd CostEstimator_BlenderAddon_453

# ZIP으로 압축 (폴더 자체를 포함하도록)
cd ..
zip -r CostEstimator_BlenderAddon_macOS.zip CostEstimator_BlenderAddon_453

# 결과 확인
ls -lh CostEstimator_BlenderAddon_macOS.zip
```

### 3단계: 블렌더에 설치

1. 블렌더 실행
2. `Edit` → `Preferences` → `Add-ons`
3. `Install...` 버튼 클릭
4. `CostEstimator_BlenderAddon_macOS.zip` 선택
5. `Cost Estimator Connector` 체크박스 활성화

---

## 🚀 빠른 배포 (Windows)

### 1단계: 실행파일 복사 (Windows PC에서)

```cmd
REM 프로젝트 루트에서 실행
cd C:\...\CostEstimatorCnv

REM server_win 폴더 생성 (없으면)
mkdir CostEstimator_BlenderAddon_453\server_win

REM 빌드된 실행파일 복사
copy dist\CostEstimator.exe CostEstimator_BlenderAddon_453\server_win\

REM 확인
dir CostEstimator_BlenderAddon_453\server_win\
```

### 2단계: 애드온 압축

```cmd
REM PowerShell 사용
powershell Compress-Archive -Path CostEstimator_BlenderAddon_453 -DestinationPath CostEstimator_BlenderAddon_Windows.zip

REM 결과 확인
dir CostEstimator_BlenderAddon_Windows.zip
```

### 3단계: 블렌더에 설치

macOS와 동일한 과정

---

## 📱 사용 방법

### 1. 블렌더 애드온 패널 열기

1. 블렌더에서 IFC 파일 열기 (BlenderBIM 사용)
2. 3D 뷰포트에서 `N` 키 → `Cost Estimator` 탭

### 2. 서버 시작

1. **포트 선택**: 기본 8000, 원하는 포트로 변경 가능
2. **서버 시작** 버튼 클릭
3. 서버 상태 확인: "시작 중..." → "실행 중"

### 3. WebSocket 연결

1. 서버가 "실행 중" 상태일 때
2. **연결 및 브라우저 열기** 버튼 클릭
3. 자동으로 웹 브라우저 열림 (`http://127.0.0.1:[포트]`)
4. WebSocket 연결 상태 확인

### 4. 작업

- 블렌더에서 IFC 객체 선택 → 웹에서 동기화
- 웹에서 객체 선택 → 블렌더에서 자동 선택 및 뷰 이동
- IFC 데이터 자동 전송 및 처리

### 5. 종료

**연결 끊기 & 서버 종료** 버튼 클릭

---

## ⚙️ 고급 설정

### 포트 변경

포트 충돌이 발생하면 다른 포트 사용:

- 8000 (기본)
- 8080 (대체)
- 8888 (대체)
- 9000 (대체)
- 또는 1024-65535 범위 내 임의의 포트

### 다중 인스턴스 실행

서로 다른 포트를 사용하면 여러 서버 동시 실행 가능:

- 프로젝트 A: 포트 8000
- 프로젝트 B: 포트 9000
- 프로젝트 C: 포트 10000

---

## 🔧 문제 해결

### 서버 시작 실패: "실행 파일을 찾을 수 없습니다"

**원인**: server_mac 또는 server_win 폴더에 실행파일이 없음

**해결**:
1. 빌드된 실행파일 복사 (위의 "빠른 배포" 참조)
2. 애드온 재설치

### 서버 시작 실패: "오류: 시간 초과"

**원인**: 서버 시작에 30초 이상 소요

**해결**:
1. 컴퓨터 성능 확인 (메모리 부족 가능성)
2. 다른 프로세스 종료
3. 재시도

### macOS 보안 경고

**증상**: "CostEstimator를 열 수 없습니다. 개발자를 확인할 수 없습니다."

**해결**:
```bash
# 터미널에서 실행
xattr -d com.apple.quarantine CostEstimator_BlenderAddon_453/server_mac/CostEstimator
```

또는:

1. Finder에서 `server_mac/CostEstimator` 찾기
2. 우클릭 → "열기"
3. "열기" 버튼 클릭
4. 블렌더에서 다시 시도

### Windows Defender 경고

**해결**:
1. Windows 보안 → 바이러스 및 위협 방지
2. 제외 항목 → 제외 항목 추가
3. `CostEstimator.exe` 추가

### 포트 충돌

**증상**: 서버 시작 실패, "Port already in use"

**해결**:
1. 블렌더 애드온에서 다른 포트 선택
2. 또는 기존 프로세스 종료:
   ```bash
   # macOS/Linux
   lsof -i :[포트번호]
   kill -9 [PID]

   # Windows
   netstat -ano | findstr :[포트번호]
   taskkill /PID [PID] /F
   ```

---

## 📊 시스템 요구사항

### 블렌더

- **버전**: 4.2.0 이상
- **필수 애드온**: BlenderBIM

### 서버 (실행파일)

- **메모리**: 최소 4GB, 권장 8GB 이상
- **디스크**: 최소 500MB (실행파일 + 데이터)
- **CPU**: 듀얼 코어 이상 권장

### Ollama (선택사항)

AI 기능 사용 시:

**macOS**:
```bash
brew install ollama
ollama pull llama3.2:3b
```

**Windows**:
1. https://ollama.ai 다운로드
2. `ollama pull llama3.2:3b`

---

## 🔄 업데이트

### 실행파일 업데이트

1. 새 버전 빌드
2. `server_mac/CostEstimator` 또는 `server_win/CostEstimator.exe` 교체
3. 애드온 재압축
4. 블렌더에서 애드온 제거 후 재설치

### 애드온 코드 업데이트

1. `__init__.py` 수정
2. 애드온 재압축
3. 블렌더에서 재설치

---

## 📝 배포 체크리스트

### macOS 배포

- [ ] 실행파일 빌드 완료 (`./build_macos.sh`)
- [ ] `dist/CostEstimator` → `server_mac/` 복사
- [ ] 실행 권한 확인 (`chmod +x`)
- [ ] ZIP 압축 생성
- [ ] 블렌더 설치 테스트
- [ ] 서버 시작 테스트
- [ ] WebSocket 연결 테스트
- [ ] 포트 변경 테스트
- [ ] 사용자 가이드 포함

### Windows 배포

- [ ] 실행파일 빌드 완료 (`build_windows.bat`)
- [ ] `dist\CostEstimator.exe` → `server_win\` 복사
- [ ] ZIP 압축 생성
- [ ] 블렌더 설치 테스트
- [ ] 서버 시작 테스트
- [ ] WebSocket 연결 테스트
- [ ] 포트 변경 테스트
- [ ] Windows Defender 예외 가이드 포함

---

## 📄 배포 패키지에 포함할 파일

### 필수 파일

- `CostEstimator_BlenderAddon_[OS].zip` - 애드온 패키지
- `README_BLENDER.md` - 블렌더 애드온 사용 가이드
- `README_SERVER.md` - 서버 설정 가이드 (선택사항)

### 선택 파일

- 샘플 IFC 파일
- 설정 예시 파일
- 비디오 튜토리얼 링크

---

## 🎓 사용자 교육

### 권장 튜토리얼 순서

1. 블렌더에 애드온 설치
2. IFC 파일 열기
3. 서버 시작 및 포트 설정
4. WebSocket 연결
5. 기본 작업 흐름
6. 문제 해결

---

## 📞 지원

문제 발생 시:
- GitHub Issues: [저장소 주소]
- 이메일: [지원 이메일]
- 문서: USER_GUIDE.md, BUILD_INSTRUCTIONS.md

---

**마지막 업데이트**: 2025-11-15
**애드온 버전**: 1.2.0
**서버 버전**: 1.0.0
