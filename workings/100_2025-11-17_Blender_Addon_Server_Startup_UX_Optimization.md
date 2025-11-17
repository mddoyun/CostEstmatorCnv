# 100_2025-11-17_Blender_Addon_Server_Startup_UX_Optimization.md

**날짜**: 2025-11-17
**작업자**: Claude + User
**관련 파일**:
- `CostEstimator_BlenderAddon_453/__init__.py`
- `build_macos.sh`
- `run_integrated_server.py`

---

## 📋 작업 개요

Blender 애드온에서 Django 서버 시작 시 사용자 경험(UX)을 대폭 개선했습니다.

**주요 목표**:
1. ✅ PyInstaller 압축 해제 지연 제거 (30-40초 → 0초)
2. ✅ 진행률 표시를 부드럽게 개선 (0.1초 간격 실시간 업데이트)
3. ✅ 완료 단계에서 스피너 애니메이션 추가

---

## 🎯 해결한 문제들

### 1. PyInstaller 압축 해제 지연 (30-40초)

**문제**:
- `--onefile` 모드 사용 시 실행할 때마다 임시 폴더에 압축 해제
- 매번 30-40초 "압축 해제 중..." 메시지 표시

**해결**:
```bash
# build_macos.sh 변경
--onefile  # ❌ 단일 파일 (매번 압축 해제 필요)
--onedir   # ✅ 폴더 형태 (압축 해제 불필요)
```

**결과**:
- 압축 해제 단계 완전 제거
- 서버 시작 즉시 실행 가능

---

### 2. 진행률 표시 최적화

#### 문제 1: 진행률이 DB 마이그레이션 중 40%에서 멈춤

**원인**:
- 로그 파일에서 "Starting database migration" 감지 시 40% 고정
- 시간 기반 추정이 실행되지 않음

**해결**: **로그 + 시간 하이브리드 방식**

```python
# 로그는 "단계 확인"만, 진행률은 "시간 기반"으로 계산
log_stage = detect_stage_from_log()  # "db_migration" 등

# 로그 단계를 최소 경과 시간으로 매핑
if log_stage == "db_migration":
    if elapsed < 15:
        elapsed = 15  # 최소 15초로 보정

# 시간 기반 진행률 계산 (항상 실행)
if elapsed < 50:
    progress = 15 + ((elapsed - 15) / 35) * 25  # 15% → 40%
```

**결과**:
- DB 마이그레이션 중에도 15% → 16% → 17% ... 계속 증가
- 로그 단계와 시간이 정확히 동기화

#### 문제 2: 진행률 세분화 부족

**기존**: 3단계 (0-15초, 15-45초, 45-90초)
**개선**: 5단계로 세분화

```
0-15초:   0% → 15%   (⚙️ 초기화)
15-50초:  15% → 40%  (🗄️ DB 마이그레이션)
50-100초: 40% → 65%  (🚀 서버 준비)
100-150초: 65% → 85% (🔌 포트 바인딩)
150-180초: 85% → 95% (📚 라이브러리 로딩)
```

**결과**:
- 전체 180초 구간 커버
- 끊김 없이 부드럽게 증가

---

### 3. 완료 애니메이션 개선

#### 문제: 서버 응답 후 진행률이 즉시 100%로 점프

**기존**:
```
40% (DB 마이그레이션)
  ↓
... 120초 대기
  ↓
✅ HTTP 응답
  ↓
100% (즉시 점프) ← 멈춘 것처럼 보임
```

**개선**: 2초 완료 애니메이션 + 스피너

```python
# 스피너 프레임
spinner_frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

# 완료 애니메이션 (2초)
if completion_elapsed < 2.0:
    progress = completion_elapsed / 2.0
    server_progress_percent = int(start_percent + (100 - start_percent) * progress)

    # 스피너 회전 (0.1초마다 변경)
    spinner_index = int(completion_elapsed * 10) % len(spinner_frames)
    spinner = spinner_frames[spinner_index]
    server_status = f"{spinner} 마무리 중... 잠시만 기다려주세요"
```

**결과**:
```
90% (서버 응답 확인)
  ↓
⠋ 마무리 중... 91%
⠙ 마무리 중... 93%
⠹ 마무리 중... 95%
⠸ 마무리 중... 97%
⠼ 마무리 중... 99%
  ↓
100% → "실행 중" ✅
```

---

## 🔧 기술적 상세

### 타임아웃 증가

```python
SERVER_CHECK_TIMEOUT = 180  # 60초 → 180초
```

**이유**:
- PyInstaller 빌드는 첫 실행 시 TensorFlow 등 무거운 라이브러리 로딩
- 실제 측정: 60-170초 소요
- 안전 마진 고려하여 180초로 설정

### UI 강제 리프레시

```python
# 0.1초마다 Blender UI 강제 리프레시
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.tag_redraw()

return 0.1  # 타이머 간격
```

### 포트 선점 체크

```python
# 서버 시작 전 포트 체크
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
result = sock.connect_ex(('127.0.0.1', port))
if result == 0:
    # 이미 실행 중 - HTTP로 우리 서버인지 확인
    with urllib.request.urlopen(f"http://127.0.0.1:{port}", timeout=2) as response:
        if response.status == 200:
            server_status = "실행 중"
            return {'FINISHED'}
```

**효과**:
- 중복 서버 시작 방지
- 이미 실행 중인 서버 재사용

---

## 📊 사용자 경험 개선

### Before (개선 전)

```
[서버 시작 버튼 클릭]
  ↓
압축 해제 중... (30-40초) ← 매번 발생
  ↓
시작 중... 40% (DB 마이그레이션) ← 120초 동안 멈춤
  ↓
실행 중 (갑자기 100%) ← 멈춘 건가? 불안함
```

### After (개선 후)

```
[서버 시작 버튼 클릭]
  ↓
시작 중... 0% → 1% → 2% ... (⚙️ 초기화)
  ↓
시작 중... 15% → 16% → 17% ... (🗄️ DB 마이그레이션)
  ↓
시작 중... 40% → 41% → 42% ... (🚀 서버 준비)
  ↓
시작 중... 65% → 66% → 67% ... (🔌 포트 바인딩)
  ↓
시작 중... 85% → 86% → 87% ... (📚 라이브러리 로딩)
  ↓
⠋ 마무리 중... 90% → 91% → ... → 100%
⠙ 마무리 중... (스피너 회전)
  ↓
실행 중 ✅
```

---

## 📁 파일 구조 변경

### PyInstaller 빌드 결과

**Before (--onefile)**:
```
server_mac/
  └── CostEstimator  (단일 실행 파일, 300MB+)
```

**After (--onedir)**:
```
server_mac/
  └── CostEstimator/  (폴더)
      ├── CostEstimator  (실행 파일, 작음)
      └── _internal/  (라이브러리들)
          ├── Python
          ├── libtorch.dylib
          ├── django/
          └── ... (모든 의존성)
```

### 애드온 배포 ZIP

```
CostEstimator_BlenderAddon_macOS.zip
  └── CostEstimator_BlenderAddon_453/
      ├── __init__.py  (메인 애드온 코드)
      ├── lib/  (websockets 라이브러리)
      └── server_mac/
          └── CostEstimator/  (--onedir 빌드 결과)
```

---

## 🧪 테스트 결과

### 성능 측정

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| 압축 해제 시간 | 30-40초 | 0초 | ✅ 100% |
| 진행률 업데이트 간격 | 불규칙 | 0.1초 | ✅ 일정 |
| 멈춤 현상 (40%) | 있음 | 없음 | ✅ 해결 |
| 완료 전환 | 즉시 점프 | 2초 애니메이션 | ✅ 부드러움 |
| 총 소요 시간 | 210-250초 | 170-180초 | ✅ 30% 단축 |

### 실제 측정 로그

```
macOS 실행 권한을 설정했습니다
🚀 서버 실행 시도 (포트: 8010)
📝 서버 로그 파일: /var/folders/.../blender_server.log

[0-20s]   시작 중... ⚙️ 초기화 (15%)
[20-40s]  시작 중... 🗄️ DB 마이그레이션 (35%)
[40-60s]  시작 중... 🗄️ DB 마이그레이션 (40%)
[60-80s]  시작 중... 🚀 서버 준비 (52%)
[80-100s] 시작 중... 🚀 서버 준비 (63%)
[100-120s] 시작 중... 🔌 포트 바인딩 (73%)
[120-140s] 시작 중... 🔌 포트 바인딩 (81%)
[140-160s] 시작 중... 📚 라이브러리 로딩 (87%)
[160-171s] 시작 중... 📚 라이브러리 로딩 (92%)

✅ 서버 응답 확인! 90% → 100% 전환 시작 (171.7초)
⠋ 마무리 중... 90%
⠙ 마무리 중... 93%
⠹ 마무리 중... 96%
⠸ 마무리 중... 99%

✅ 서버가 성공적으로 실행되었습니다 (총 173.8초)
```

---

## 🔄 Git Commit

```bash
git add CostEstimator_BlenderAddon_453/__init__.py
git add build_macos.sh
git add run_integrated_server.py
git add workings/100_2025-11-17_Blender_Addon_Server_Startup_UX_Optimization.md

git commit -m "Blender 애드온 서버 시작 UX 대폭 개선

- PyInstaller --onefile → --onedir 변경 (압축 해제 30-40초 제거)
- 진행률 세분화 (5단계, 180초 전체 커버)
- 로그 + 시간 하이브리드 방식으로 부드러운 진행률 표시
- 완료 단계 스피너 애니메이션 추가 (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏)
- 타임아웃 60초 → 180초 증가
- 포트 선점 체크 및 중복 실행 방지
- UI 리프레시 0.1초 간격으로 강제 실행

총 서버 시작 시간: 210-250초 → 170-180초 (30% 단축)
사용자 체감: 멈춤 현상 완전 제거, 진행 상황 명확히 표시"
```

---

## 📝 향후 개선 가능 항목

1. **첫 실행 최적화**: TensorFlow lazy loading
2. **캐시 활용**: OS 라이브러리 캐싱으로 두 번째 실행부터 더 빠르게
3. **백그라운드 프리로딩**: Blender 시작 시 서버 미리 준비
4. **프로그레스 바 시각화**: Blender UI에 그래픽 프로그레스 바 추가

---

## ✅ 완료 체크리스트

- [x] PyInstaller --onedir 모드 전환
- [x] build_macos.sh 수정
- [x] 진행률 5단계 세분화
- [x] 로그 + 시간 하이브리드 진행률 계산
- [x] 스피너 애니메이션 추가
- [x] 타임아웃 180초 증가
- [x] 포트 선점 체크
- [x] UI 0.1초 간격 리프레시
- [x] 배포 ZIP 생성
- [x] workings 문서화
- [x] Git commit & push
