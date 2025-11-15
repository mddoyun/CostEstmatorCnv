# CostEstimator 사용자 가이드

Django + Ollama AI 통합 서버 실행 가이드입니다.

---

## 빠른 시작 (macOS)

### 1단계: Ollama 설치 (선택사항)
```bash
# Homebrew로 Ollama 설치
brew install ollama

# Llama 모델 다운로드 (약 2GB)
ollama pull llama3.2:3b
```

### 2단계: CostEstimator 실행
```bash
# 실행파일에 실행 권한 부여 (최초 1회)
chmod +x CostEstimator

# 실행
./CostEstimator
```

### 3단계: 웹 브라우저 접속
```
http://127.0.0.1:8000
```

---

## 빠른 시작 (Windows)

### 1단계: Ollama 설치 (선택사항)
1. https://ollama.ai 에서 Windows용 설치 파일 다운로드
2. 설치 후 명령 프롬프트에서:
```cmd
ollama pull llama3.2:3b
```

### 2단계: CostEstimator 실행
- `CostEstimator.exe` 파일을 더블클릭
- 또는 명령 프롬프트에서 `CostEstimator.exe` 실행

### 3단계: 웹 브라우저 접속
```
http://127.0.0.1:8000
```

---

## 실행 화면 설명

실행하면 다음과 같은 메시지가 표시됩니다:

```
==========================================
CostEstimator Integrated Server Launcher
Django + Ollama AI
==========================================
Platform: Darwin 26.1
Python: 3.11.9
==========================================
[OK] Ollama found: /opt/homebrew/bin/ollama

[INFO] Installed Ollama models:
NAME                       ID              SIZE
llama3.2:3b                a80c4f17acd5    2.0 GB

[OK] Llama model detected
[INFO] Starting Ollama server from: /opt/homebrew/bin/ollama
[INFO] Waiting for Ollama server to start...
[OK] Ollama server started successfully
[OK] Data folder checked: /Users/사용자명/CostEstimator_Data

--- Starting database migration ---
Operations to perform:
  Apply all migrations: ...
Running migrations:
  No migrations to apply.
--- Database migration complete ---

============================================================
[INFO] Django server starting at http://127.0.0.1:8000
[INFO] Ollama API available at http://127.0.0.1:11434
[INFO] Press Ctrl+C to stop all servers
============================================================
```

---

## 주요 기능

### 1. Django 웹 서버
- **주소**: http://127.0.0.1:8000
- **기능**: BIM 데이터 관리, 물량 산출, 비용 견적, 3D 뷰어
- **데이터 저장**: `~/CostEstimator_Data/db.sqlite3`

### 2. Ollama AI 서버
- **주소**: http://127.0.0.1:11434
- **기능**: AI 기반 객체 선택, 분류, 예측
- **모델**: llama3.2:3b (3.2B 파라미터)

### 3. 통합 관리
- 하나의 실행파일로 두 서버 동시 관리
- Ctrl+C 한 번으로 모든 서버 종료
- 자동 재시작 및 에러 복구

---

## 고급 사용법

### 백그라운드 실행 (macOS/Linux)

```bash
# 백그라운드로 실행
nohup ./CostEstimator > server.log 2>&1 &

# 로그 확인
tail -f server.log

# 프로세스 확인
ps aux | grep CostEstimator

# 종료
pkill -f CostEstimator
```

### 서비스 등록 (macOS - launchd)

`~/Library/LaunchAgents/com.costestimator.plist` 파일 생성:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.costestimator</string>
    <key>ProgramArguments</key>
    <array>
        <string>/경로/to/CostEstimator</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/costestimator.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/costestimator.error.log</string>
</dict>
</plist>
```

등록 및 실행:
```bash
launchctl load ~/Library/LaunchAgents/com.costestimator.plist
launchctl start com.costestimator
```

### 서비스 등록 (Windows - Task Scheduler)

1. 작업 스케줄러 열기
2. "기본 작업 만들기" 선택
3. 트리거: "컴퓨터를 시작할 때"
4. 작업: "프로그램 시작"
5. 프로그램: `C:\경로\to\CostEstimator.exe`

---

## 데이터 관리

### 데이터 위치

**macOS/Linux**:
```
~/CostEstimator_Data/
├── db.sqlite3          # 데이터베이스
├── db.sqlite3-journal  # 트랜잭션 저널
└── (기타 업로드 파일)
```

**Windows**:
```
C:\Users\사용자명\CostEstimator_Data\
├── db.sqlite3
├── db.sqlite3-journal
└── (기타 업로드 파일)
```

### 백업

```bash
# macOS/Linux
cp -r ~/CostEstimator_Data ~/CostEstimator_Data_Backup_$(date +%Y%m%d)

# Windows (PowerShell)
Copy-Item -Path "$env:USERPROFILE\CostEstimator_Data" -Destination "$env:USERPROFILE\CostEstimator_Data_Backup_$(Get-Date -Format 'yyyyMMdd')" -Recurse
```

### 복원

```bash
# macOS/Linux
rm -rf ~/CostEstimator_Data
cp -r ~/CostEstimator_Data_Backup_20251115 ~/CostEstimator_Data

# Windows (PowerShell)
Remove-Item -Path "$env:USERPROFILE\CostEstimator_Data" -Recurse
Copy-Item -Path "$env:USERPROFILE\CostEstimator_Data_Backup_20251115" -Destination "$env:USERPROFILE\CostEstimator_Data" -Recurse
```

---

## 문제 해결

### "Ollama not found" 경고

**증상**: 실행 시 Ollama를 찾을 수 없다는 메시지

**원인**: Ollama가 설치되지 않음

**해결**:
- macOS: `brew install ollama`
- Windows: https://ollama.ai 에서 설치

**참고**: Ollama 없이도 Django 서버는 정상 작동하지만 AI 기능은 사용 불가

---

### "No Llama model found" 경고

**증상**: Ollama는 설치되었지만 모델이 없음

**원인**: AI 모델이 다운로드되지 않음

**해결**:
```bash
ollama pull llama3.2:3b
```

**참고**: 약 2GB 다운로드 필요

---

### "Port 8000 already in use" 오류

**증상**: 서버 시작 실패

**원인**: 다른 프로그램이 8000 포트 사용 중

**해결 (macOS/Linux)**:
```bash
# 8000 포트 사용 프로세스 확인
lsof -i :8000

# 프로세스 종료
kill -9 <PID>
```

**해결 (Windows)**:
```cmd
# 8000 포트 사용 프로세스 확인
netstat -ano | findstr :8000

# 프로세스 종료
taskkill /PID <PID> /F
```

---

### "Database is locked" 오류

**증상**: 데이터베이스 작업 시 오류

**원인**: 다른 프로세스가 데이터베이스 사용 중

**해결**:
1. 모든 CostEstimator 인스턴스 종료
2. 저널 파일 삭제:
   - macOS/Linux: `rm ~/CostEstimator_Data/db.sqlite3-journal`
   - Windows: `del %USERPROFILE%\CostEstimator_Data\db.sqlite3-journal`
3. 재시작

---

### macOS 보안 경고 ("개발자를 확인할 수 없음")

**증상**: 실행 시 보안 경고

**해결**:
1. Finder에서 CostEstimator 파일 찾기
2. 우클릭 → "열기" 선택
3. "열기" 버튼 클릭
4. 이후부터는 정상 실행 가능

또는 터미널에서:
```bash
xattr -d com.apple.quarantine CostEstimator
```

---

### Windows Defender 경고

**증상**: Windows Defender가 실행 차단

**해결**:
1. Windows 보안 열기
2. "바이러스 및 위협 방지" → "설정 관리"
3. "제외 항목" → "제외 항목 추가"
4. CostEstimator.exe 파일 추가

---

## 성능 최적화

### 메모리 사용량
- **Django**: ~100-200 MB
- **Ollama**: ~2-4 GB (모델 로딩 시)
- **총 권장 메모리**: 8GB 이상

### 디스크 공간
- **실행파일**: ~400-500 MB
- **데이터**: 프로젝트 크기에 따라 다름 (평균 100MB~1GB)
- **Ollama 모델**: ~2 GB (llama3.2:3b)
- **총 권장 공간**: 10GB 이상

### CPU
- **최소**: 듀얼 코어 2GHz
- **권장**: 쿼드 코어 2.5GHz 이상
- **AI 추론**: 더 많은 코어가 유리

---

## 업데이트

### 새 버전으로 업데이트

1. **데이터 백업** (위의 "백업" 섹션 참조)
2. 기존 실행파일 삭제
3. 새 실행파일로 교체
4. 실행

**중요**: `~/CostEstimator_Data/` 폴더는 삭제하지 마세요!

---

## 제거 (언인스톨)

### 완전 제거

**macOS/Linux**:
```bash
# 실행파일 삭제
rm CostEstimator

# 데이터 삭제 (주의!)
rm -rf ~/CostEstimator_Data

# Ollama 제거 (선택사항)
brew uninstall ollama
rm -rf ~/.ollama
```

**Windows**:
```cmd
REM 실행파일 삭제
del CostEstimator.exe

REM 데이터 삭제 (주의!)
rmdir /s /q %USERPROFILE%\CostEstimator_Data

REM Ollama 제거 (선택사항)
REM 제어판 → 프로그램 제거에서 Ollama 제거
```

---

## FAQ

### Q: Ollama 없이 사용할 수 있나요?
**A**: 네, Django 서버는 정상 작동합니다. 단, AI 기반 객체 선택 및 분류 기능은 사용할 수 없습니다.

### Q: 다른 컴퓨터에서도 사용할 수 있나요?
**A**: 네, 실행파일만 복사하면 됩니다. 단, 같은 운영체제여야 합니다 (macOS → macOS, Windows → Windows).

### Q: 여러 프로젝트를 관리할 수 있나요?
**A**: 네, 웹 인터페이스에서 여러 프로젝트를 생성하고 관리할 수 있습니다.

### Q: 다른 포트로 실행할 수 있나요?
**A**: 현재 버전은 8000 포트 고정입니다. 추후 업데이트에서 설정 기능 추가 예정입니다.

### Q: 데이터를 다른 컴퓨터로 옮길 수 있나요?
**A**: 네, `~/CostEstimator_Data/` 폴더를 다른 컴퓨터의 같은 위치로 복사하면 됩니다.

---

## 라이선스

이 소프트웨어는 [라이선스 정보] 하에 배포됩니다.

---

## 지원

문제가 발생하거나 기능 제안이 있으면:
- GitHub Issues: [저장소 주소]
- 이메일: [이메일 주소]

---

## 버전 정보

- **현재 버전**: 1.0.0
- **빌드 날짜**: 2025-11-15
- **Python**: 3.11.9
- **Django**: 5.2+
- **Ollama**: 0.12.11
- **권장 모델**: llama3.2:3b
