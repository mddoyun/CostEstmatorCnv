# CostEstimator 블렌더 애드온 사용 가이드

Blender에서 IFC 데이터를 웹 기반 CostEstimator 시스템으로 전송하고 실시간 동기화하는 애드온입니다.

---

## 📦 다운로드

- **macOS**: `CostEstimator_BlenderAddon_macOS.zip` (413MB)
- **Windows**: `CostEstimator_BlenderAddon_Windows.zip` (빌드 예정)

---

## ✅ 시스템 요구사항

### Blender
- **버전**: 4.2.0 이상
- **필수 애드온**: BlenderBIM

### 컴퓨터
- **메모리**: 최소 4GB, 권장 8GB 이상
- **디스크**: 최소 500MB (애드온 + 데이터)
- **CPU**: 듀얼 코어 이상 권장

### Ollama (선택사항 - AI 기능용)
- **macOS**: `brew install ollama && ollama pull llama3.2:3b`
- **Windows**: https://ollama.ai 에서 다운로드 후 `ollama pull llama3.2:3b`

---

## 📥 설치 방법

### 1단계: ZIP 파일 다운로드

- macOS 사용자: `CostEstimator_BlenderAddon_macOS.zip`
- Windows 사용자: `CostEstimator_BlenderAddon_Windows.zip`

### 2단계: Blender에 애드온 설치

1. **Blender 실행**
2. **Edit** → **Preferences** (또는 `Cmd + ,` / `Ctrl + ,`)
3. **Add-ons** 탭 선택
4. 우측 상단 **Install...** 버튼 클릭
5. 다운로드한 ZIP 파일 선택
6. **Install Add-on** 클릭

### 3단계: 애드온 활성화

1. 검색창에 `Cost Estimator` 입력
2. **Cost Estimator Connector** 체크박스 활성화
3. Preferences 창 닫기

### 4단계: 확인

1. 3D 뷰포트에서 `N` 키 누르기
2. 사이드바에 **Cost Estimator** 탭이 보이면 성공!

---

## 🚀 사용 방법

### 1. IFC 파일 열기

1. BlenderBIM 애드온으로 IFC 파일 열기
2. IFC 프로젝트가 로드되면 준비 완료

### 2. 서버 시작

#### 포트 선택 (선택사항)
- **기본 포트**: 8000
- **다른 포트 사용**: 포트 충돌 시 8080, 9000 등 선택
- **범위**: 1024 ~ 65535

#### 서버 시작
1. 3D 뷰포트에서 `N` 키 → **Cost Estimator** 탭
2. **포트** 입력 (기본값 유지 또는 변경)
3. **서버 시작** 버튼 클릭
4. 서버 상태 확인: "시작 중..." → "실행 중"

**예상 시간**: 10~30초 (컴퓨터 성능에 따라 다름)

### 3. WebSocket 연결 및 브라우저 열기

1. 서버 상태가 "실행 중"이 되면
2. **연결 및 브라우저 열기** 버튼 클릭
3. 자동으로 진행되는 작업:
   - 웹 브라우저 자동 실행 (`http://127.0.0.1:[포트]`)
   - WebSocket 자동 연결 (`ws://127.0.0.1:[포트]/ws/blender-connector/`)

### 4. 데이터 작업

#### 블렌더 → 웹 동기화
1. Blender에서 IFC 객체 선택
2. 웹 페이지에서 자동으로 동일 객체 선택됨

#### 웹 → 블렌더 동기화
1. 웹 페이지에서 객체 선택
2. Blender에서 자동으로 해당 객체 선택 및 뷰 이동

#### IFC 데이터 전송
웹 페이지에서 "데이터 가져오기" 버튼 클릭 시:
- 모든 IFC 객체 데이터 자동 전송
- 진행 상황 실시간 표시
- 완료 후 웹에서 데이터 확인 가능

### 5. 작업 종료

**연결 끊기 & 서버 종료** 버튼 클릭
- WebSocket 연결 종료
- Django 서버 종료
- Ollama 서버 종료 (실행 중이었다면)

---

## 🎯 주요 기능

### 실시간 동기화
- Blender ↔ 웹 양방향 객체 선택 동기화
- 선택 객체 자동 뷰 이동

### IFC 데이터 추출
- 모든 IFC 속성 자동 추출
  - Attributes (이름, 타입, 분류 등)
  - PropertySets (Pset_*)
  - QuantitySets (Qto_*)
  - TypeParameters
  - Spatial Container
  - Material 정보
- 3D 지오메트리 데이터 포함

### 포트 선택
- 여러 프로젝트 동시 작업 가능 (서로 다른 포트 사용)
- 포트 충돌 방지

### AI 기능 (Ollama 설치 시)
- 자연어 기반 객체 선택
- 스마트 분류 및 태깅

---

## ⚙️ 고급 설정

### 다중 인스턴스 실행

여러 프로젝트를 동시에 작업하려면:

1. **프로젝트 A**: 포트 8000
2. **프로젝트 B**: 포트 9000
3. **프로젝트 C**: 포트 10000

각 Blender 인스턴스에서 서로 다른 포트 선택 후 서버 시작

### Ollama 설정 (선택사항)

AI 기능을 사용하려면:

**macOS**:
```bash
# Ollama 설치
brew install ollama

# Llama 모델 다운로드 (약 2GB)
ollama pull llama3.2:3b

# Ollama 서버 실행 (애드온이 자동으로 실행하지만 수동 실행도 가능)
ollama serve
```

**Windows**:
```cmd
REM 1. https://ollama.ai 에서 다운로드 및 설치

REM 2. Llama 모델 다운로드
ollama pull llama3.2:3b
```

---

## 🔧 문제 해결

### 1. "실행 파일을 찾을 수 없습니다"

**원인**: 애드온 ZIP 파일이 실행파일 없이 설치됨

**해결**:
1. 올바른 ZIP 파일 다운로드 (macOS: *_macOS.zip, Windows: *_Windows.zip)
2. 애드온 제거 후 재설치

### 2. macOS 보안 경고: "개발자를 확인할 수 없습니다"

**증상**: 서버 시작 시 보안 경고

**해결 방법 1 (Finder 사용)**:
1. Finder 열기
2. 애플리케이션 → Blender → 우클릭 → "패키지 내용 보기"
3. `Contents/Resources/[버전]/scripts/addons/CostEstimator_BlenderAddon_453/server_mac/` 이동
4. `CostEstimator` 파일 우클릭 → "열기"
5. "열기" 버튼 클릭
6. Blender로 돌아와서 서버 시작 재시도

**해결 방법 2 (터미널 사용)**:
```bash
# Blender 애드온 폴더 찾기
cd ~/Library/Application\ Support/Blender/[버전]/scripts/addons/CostEstimator_BlenderAddon_453/server_mac/

# 보안 속성 제거
xattr -d com.apple.quarantine CostEstimator

# 실행 권한 확인
chmod +x CostEstimator
```

### 3. Windows Defender 경고

**증상**: Windows Defender가 실행파일 차단

**해결**:
1. Windows 보안 열기
2. 바이러스 및 위협 방지 → 설정 관리
3. 제외 항목 → 제외 항목 추가
4. CostEstimator.exe 파일 추가

### 4. "오류: 시간 초과"

**원인**: 서버 시작에 30초 이상 소요

**해결**:
1. 메모리 부족 확인 (최소 4GB 필요)
2. 다른 프로그램 종료
3. 컴퓨터 재시작 후 재시도

### 5. 포트 충돌

**증상**: 서버 시작 실패, "Port already in use" 오류

**해결**:
1. 블렌더 애드온에서 다른 포트 선택 (예: 8080, 9000)
2. 서버 재시작

**또는 기존 프로세스 종료**:

**macOS/Linux**:
```bash
# 포트 사용 프로세스 확인
lsof -i :[포트번호]

# 프로세스 종료
kill -9 [PID]
```

**Windows**:
```cmd
REM 포트 사용 프로세스 확인
netstat -ano | findstr :[포트번호]

REM 프로세스 종료
taskkill /PID [PID] /F
```

### 6. WebSocket 연결 실패

**원인**: 서버가 완전히 시작되기 전에 연결 시도

**해결**:
1. 서버 상태가 "실행 중"이 될 때까지 대기
2. "연결 및 브라우저 열기" 버튼 클릭

### 7. IFC 파일을 찾을 수 없음

**원인**: BlenderBIM으로 IFC 파일이 열리지 않음

**해결**:
1. BlenderBIM 애드온 활성화 확인
2. File → Import → Industry Foundation Classes (.ifc)
3. IFC 파일 열기 후 재시도

---

## 📊 성능 최적화

### 대용량 IFC 파일 처리

**IFC 파일 크기가 큰 경우** (100MB+):
- 데이터 전송에 시간이 걸릴 수 있음 (수 분)
- 진행 상황 표시를 확인하며 대기

**메모리 부족 방지**:
- 다른 프로그램 종료
- 브라우저 탭 최소화

### 서버 성능

**느린 시작 시간 개선**:
- SSD 사용 (HDD보다 빠름)
- 백신 프로그램 예외 설정
- 충분한 RAM 확보 (8GB 이상 권장)

---

## 🆘 지원

### 문제 보고
- GitHub Issues: [저장소 주소]
- 이메일: [지원 이메일]

### 문서
- 상세 빌드 가이드: `BUILD_INSTRUCTIONS.md`
- 서버 사용 가이드: `USER_GUIDE.md`
- 배포 가이드: `BLENDER_ADDON_DEPLOYMENT.md`

---

## 📝 버전 정보

- **애드온 버전**: 1.2.0
- **서버 버전**: 1.0.0
- **Blender 호환**: 4.2.0+
- **마지막 업데이트**: 2025-11-15

---

## 📜 라이선스

[라이선스 정보]

---

## 🎓 튜토리얼 순서 (권장)

1. ✅ 애드온 설치
2. ✅ IFC 파일 열기
3. ✅ 서버 시작 (기본 포트 8000)
4. ✅ WebSocket 연결 및 브라우저 열기
5. ✅ IFC 데이터 전송 테스트
6. ✅ 객체 선택 동기화 테스트
7. ✅ 작업 종료

**고급 사용자**:
- 포트 변경 및 다중 인스턴스 실행
- Ollama 설치 및 AI 기능 활용
- 대용량 IFC 파일 처리

---

## 💡 팁

1. **포트 기억하기**: 자주 사용하는 포트 번호를 메모해두세요 (예: 8000, 9000)
2. **자동 시작**: 컴퓨터 부팅 시 Ollama 자동 실행 설정 가능 (서비스 등록)
3. **백업**: 작업 중 웹에서 데이터 내보내기 기능 활용
4. **성능**: 대용량 파일은 청크 단위로 전송되므로 인터넷 연결 불필요

---

**즐거운 작업 되세요!** 🎉
