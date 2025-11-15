# CostEstimator 통합 서버 (Django + Ollama)

하나의 실행파일로 Django 웹 서버와 Ollama AI 서버를 동시에 실행하는 통합 솔루션입니다.

---

## 📦 배포 파일

### macOS
- **파일명**: `CostEstimator`
- **크기**: ~417 MB
- **위치**: `dist/CostEstimator`
- **실행**: `./CostEstimator`

### Windows
- **파일명**: `CostEstimator.exe`
- **크기**: ~100-150 MB (예상)
- **위치**: `dist\CostEstimator.exe`
- **실행**: 더블클릭 또는 `CostEstimator.exe`

---

## ⚡ 빠른 시작

### 1. Ollama 설치 (선택사항)

**macOS**:
```bash
brew install ollama
ollama pull llama3.2:3b
```

**Windows**:
1. https://ollama.ai 에서 다운로드
2. 설치 후 `ollama pull llama3.2:3b`

### 2. 실행

**macOS**:
```bash
chmod +x CostEstimator  # 최초 1회
./CostEstimator
```

**Windows**:
```
CostEstimator.exe (더블클릭)
```

### 3. 접속

- **웹 UI**: http://127.0.0.1:8000
- **Ollama API**: http://127.0.0.1:11434

---

## ✨ 주요 기능

### 자동 통합 관리
- ✅ Ollama 자동 감지 및 실행
- ✅ Django 서버 자동 설정 및 실행
- ✅ 데이터베이스 자동 마이그레이션
- ✅ Ctrl+C 한 번으로 모든 서버 종료

### 플랫폼 지원
- ✅ macOS (Apple Silicon & Intel)
- ✅ Windows 10/11
- ✅ Linux (빌드 가능)

### 데이터 보존
- ✅ 사용자 데이터: `~/CostEstimator_Data/`
- ✅ 업그레이드 시 데이터 유지
- ✅ 백업 및 복원 용이

---

## 🛠️ 개발자용 빌드 방법

### macOS 빌드
```bash
./build_macos.sh
```

### Windows 빌드
```cmd
build_windows.bat
```

### 수동 빌드
```bash
# macOS
pyinstaller --name "CostEstimator" \
  --onefile \
  --add-data "db.sqlite3:." \
  --add-data "aibim_quantity_takeoff_web:aibim_quantity_takeoff_web" \
  --add-data "connections:connections" \
  run_integrated_server.py

# Windows
pyinstaller --name "CostEstimator" ^
  --onefile ^
  --add-data "db.sqlite3;." ^
  --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" ^
  --add-data "connections;connections" ^
  run_integrated_server.py
```

---

## 📚 문서

- **사용자 가이드**: [USER_GUIDE.md](USER_GUIDE.md)
- **빌드 가이드**: [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)
- **프로젝트 문서**: [CLAUDE.md](CLAUDE.md)

---

## ⚠️ 중요 사항

### 크로스 플랫폼 빌드 불가
PyInstaller는 크로스 컴파일을 지원하지 않습니다:
- macOS에서 Windows용 빌드 ❌
- Windows에서 macOS용 빌드 ❌
- 각 플랫폼에서 해당 플랫폼용만 빌드 가능 ✅

### Ollama 별도 설치 필요
- 실행파일에 Ollama는 포함되지 않음
- 사용자가 별도로 설치 필요
- 없어도 Django 서버는 작동 (AI 기능만 비활성화)

### 시스템 요구사항
- **메모리**: 8GB 이상 권장
- **디스크**: 10GB 이상 권장
- **CPU**: 쿼드 코어 2.5GHz 이상 권장

---

## 🔧 문제 해결

### Ollama 관련
```bash
# 설치 확인
ollama --version

# 모델 확인
ollama list

# 모델 다운로드
ollama pull llama3.2:3b
```

### 포트 충돌
```bash
# macOS/Linux
lsof -i :8000
kill -9 <PID>

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### 데이터베이스 잠금
```bash
# macOS/Linux
rm ~/CostEstimator_Data/db.sqlite3-journal

# Windows
del %USERPROFILE%\CostEstimator_Data\db.sqlite3-journal
```

---

## 📊 빌드 결과

### macOS (Apple Silicon)
```
파일명: CostEstimator
크기: 417 MB
포함 내용:
  - Python 3.11.9
  - Django 5.2+
  - TensorFlow 2.20.0
  - PyTorch
  - sentence-transformers
  - 기타 모든 의존성
```

### Windows (예상)
```
파일명: CostEstimator.exe
크기: ~100-150 MB
포함 내용: (macOS와 동일)
```

---

## 🚀 배포 체크리스트

### 사용자에게 제공할 파일
- [ ] 실행파일 (`CostEstimator` 또는 `CostEstimator.exe`)
- [ ] 사용자 가이드 (`USER_GUIDE.md` 또는 PDF)
- [ ] Ollama 설치 안내

### 안내사항
- [ ] Ollama 별도 설치 필요
- [ ] 방화벽 설정 (8000, 11434 포트)
- [ ] 백신 예외 설정 (필요시)
- [ ] 최소 시스템 요구사항

---

## 📝 변경 이력

### v1.0.0 (2025-11-15)
- ✅ Django + Ollama 통합 실행
- ✅ macOS 빌드 완료
- ✅ Windows 빌드 스크립트 추가
- ✅ 자동 Ollama 감지 및 실행
- ✅ 데이터베이스 자동 설정
- ✅ 완전한 문서화

---

## 👨‍💻 개발자 정보

- **개발**: CostEstimator Development Team
- **Python**: 3.11.9
- **Django**: 5.2+
- **PyInstaller**: 6.16.0
- **Ollama**: 0.12.11

---

## 📄 라이선스

[라이선스 정보]

---

## 🤝 기여

버그 리포트 및 기능 제안:
- GitHub Issues: [저장소 주소]
- 이메일: [이메일 주소]

---

## 🎯 다음 단계

1. **Windows 환경에서 빌드**: Windows PC에서 `build_windows.bat` 실행
2. **테스트**: 여러 환경에서 실행 테스트
3. **배포**: 사용자에게 실행파일 + 가이드 제공
4. **피드백 수집**: 사용자 경험 개선

---

**참고**: 자세한 내용은 [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) 및 [USER_GUIDE.md](USER_GUIDE.md)를 참조하세요.
