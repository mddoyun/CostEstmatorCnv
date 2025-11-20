# 102_2025-11-20 Revit Addon Server Health Check and Database Persistence

## 작업 일자
2025년 11월 20일

## 작업 개요
Revit 애드인의 서버 시작 시 헬스 체크 기능 구현 및 데이터베이스 영구 저장 문제 해결

## 문제 상황

### 1. 서버 시작 상태 표시 문제
- **증상**: "서버 시작" 버튼 클릭 시 즉시 "실행 중"으로 표시되지만 실제로는 서버가 준비되지 않은 상태
- **사용자 피드백**: "지금 서버실행됐는지 어떤 상태인지 알 수 없어서 말이야"
- **문제점**:
  - 연결 버튼이 즉시 활성화되어 연결 시도 시 실패
  - 서버 준비 상태를 알 수 없음
  - Blender 애드인처럼 진행 상태를 표시할 필요

### 2. 데이터베이스 영구 저장 문제
- **증상**: 애드인 종료 후 재시작하면 이전에 생성한 프로젝트가 사라짐
- **사용자 시나리오**:
  1. 애드인 실행 → 서버 시작 → 접속
  2. 프로젝트 생성
  3. 연결 끊기 → 서버 종료 → 애드인 창 닫기
  4. 애드인 재실행 → 서버 시작 → 접속
  5. **문제**: 이전 프로젝트가 보이지 않음
- **사용자 피드백**: "프로젝트가 그대로 있었으면 좋겠어"

## 원인 분석

### 1. 서버 상태 표시 문제
- 프로세스 시작만 확인하고 실제 서버 준비 상태를 체크하지 않음
- HTTP 헬스 체크 로직 부재
- 진행 상태 표시 UI 없음

### 2. 데이터베이스 영구 저장 문제 (근본 원인)
- **Django settings.py의 DATABASE 설정 문제**:
  ```python
  # 기존 코드 (문제 있음)
  DATABASES = {
      'default': {
          'ENGINE': 'django.db.backends.sqlite3',
          'NAME': BASE_DIR / 'db.sqlite3',  # ← BASE_DIR은 PyInstaller 임시 폴더!
      }
  }
  ```
- **PyInstaller 실행 시 BASE_DIR 경로**:
  - BASE_DIR은 `sys._MEIPASS`를 가리킴 (예: `C:\Users\mddoy\AppData\Local\Temp\_MEI123456`)
  - 매 실행마다 새로운 임시 폴더가 생성됨
  - 이전 실행의 데이터베이스는 이전 임시 폴더에 남아 접근 불가

- **추가 발견: 빈 데이터베이스 파일 문제**:
  - 초기 테스트에서 0바이트 크기의 db.sqlite3 파일 발견
  - 파일 존재 여부만 체크하여 마이그레이션을 건너뛰었지만 실제로는 빈 파일
  - 결과: 테이블이 없어 데이터 저장 불가

## 해결 방법

### 1. 서버 헬스 체크 시스템 구현

#### 1.1. UI 추가 (ConnectorWindow.xaml)
```xml
<!-- 서버 시작 진행률 프로그레스 바 추가 -->
<ProgressBar x:Name="ServerProgressBar"
             Height="8"
             Minimum="0"
             Maximum="100"
             Value="0"
             Visibility="Collapsed"
             Margin="0,0,0,5"/>
```

#### 1.2. 헬스 체크 로직 구현 (ConnectorWindow.xaml.cs)

**필드 추가**:
```csharp
private DispatcherTimer _serverHealthCheckTimer;
private DateTime _serverStartTime;
private const int SERVER_CHECK_TIMEOUT_SECONDS = 180; // 3분
private const double SERVER_CHECK_INTERVAL_MS = 500;   // 0.5초마다 체크
```

**서버 시작 버튼 수정**:
```csharp
private void StartServerButton_Click(object sender, RoutedEventArgs e)
{
    // ... 기존 검증 로직 ...

    // 프로그레스 바 표시 및 연결 버튼 비활성화
    UpdateServerStatus("시작 중... (0%)");
    Dispatcher.Invoke(() =>
    {
        ServerProgressBar.Visibility = Visibility.Visible;
        ServerProgressBar.Value = 0;
        ConnectButton.IsEnabled = false; // ← 서버 준비될 때까지 비활성화
    });

    _serverProcess = Process.Start(startInfo);
    _serverStartTime = DateTime.Now;
    StartServerHealthCheck(port);  // ← 헬스 체크 시작
}
```

**헬스 체크 타이머 시작**:
```csharp
private void StartServerHealthCheck(int port)
{
    if (_serverHealthCheckTimer != null)
    {
        _serverHealthCheckTimer.Stop();
        _serverHealthCheckTimer = null;
    }

    _serverHealthCheckTimer = new DispatcherTimer
    {
        Interval = TimeSpan.FromMilliseconds(SERVER_CHECK_INTERVAL_MS)
    };

    _serverHealthCheckTimer.Tick += async (sender, e) => await CheckServerHealth(port);
    _serverHealthCheckTimer.Start();
}
```

**헬스 체크 실행**:
```csharp
private async Task CheckServerHealth(int port)
{
    var elapsed = (DateTime.Now - _serverStartTime).TotalSeconds;

    // 타임아웃 체크 (180초)
    if (elapsed > SERVER_CHECK_TIMEOUT_SECONDS)
    {
        UpdateStatus("ERROR: Server start timeout (180 seconds exceeded)");
        UpdateServerStatus("오류: 시간 초과");
        StopServerHealthCheck();
        StopServerProcess();
        // ... UI 복원 ...
        return;
    }

    // 시간 기반 진행률 계산
    int progressPercent = 0;
    string statusMessage = "시작 중...";

    if (elapsed < 15)
    {
        // 0-15초: 0% → 15% (초기화)
        progressPercent = (int)((elapsed / 15) * 15);
        statusMessage = $"시작 중... ⚙️ 초기화 중 ({elapsed:F1}초)";
    }
    else if (elapsed < 50)
    {
        // 15-50초: 15% → 40% (DB 마이그레이션)
        progressPercent = 15 + (int)(((elapsed - 15) / 35) * 25);
        statusMessage = $"시작 중... 🗄️ DB 마이그레이션 중 ({elapsed:F1}초)";
    }
    else if (elapsed < 100)
    {
        // 50-100초: 40% → 65% (서버 준비)
        progressPercent = 40 + (int)(((elapsed - 50) / 50) * 25);
        statusMessage = $"시작 중... 🚀 서버 준비 중 ({elapsed:F1}초)";
    }
    else if (elapsed < 150)
    {
        // 100-150초: 65% → 85% (포트 바인딩)
        progressPercent = 65 + (int)(((elapsed - 100) / 50) * 20);
        statusMessage = $"시작 중... 🔌 포트 바인딩 중 ({elapsed:F1}초)";
    }
    else
    {
        // 150초 이후: 85% → 95%
        progressPercent = Math.Min(95, 85 + (int)(((elapsed - 150) / 30) * 10));
        statusMessage = $"시작 중... 📚 라이브러리 로딩 중 ({elapsed:F1}초)";
    }

    Dispatcher.Invoke(() => { ServerProgressBar.Value = progressPercent; });
    UpdateServerStatus($"{statusMessage} ({progressPercent}%)");

    // HTTP 요청으로 서버 응답 확인
    try
    {
        using (var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(2) })
        {
            var response = await httpClient.GetAsync($"http://127.0.0.1:{port}/");
            if (response.IsSuccessStatusCode)
            {
                // ✅ 서버 응답 성공!
                UpdateStatus($"✅ Server is ready! (Elapsed: {elapsed:F1} seconds)");
                UpdateServerStatus("실행 중");
                Dispatcher.Invoke(() =>
                {
                    ServerProgressBar.Value = 100;
                    ServerProgressBar.Visibility = Visibility.Collapsed;
                    ConnectButton.IsEnabled = true; // ← 연결 버튼 활성화
                });
                StopServerHealthCheck();
                return;
            }
        }
    }
    catch
    {
        // 서버가 아직 준비 안 됨 (정상) - 계속 체크
    }
}
```

**타이머 정리**:
```csharp
private void StopServerHealthCheck()
{
    if (_serverHealthCheckTimer != null)
    {
        _serverHealthCheckTimer.Stop();
        _serverHealthCheckTimer = null;
    }
}

// DisconnectButton_Click에 추가
private async void DisconnectButton_Click(object sender, RoutedEventArgs e)
{
    // ... 기존 코드 ...
    StopServerHealthCheck();
    StopServerProcess();
}

// Window_Closing에 추가
private async void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
{
    // ... 기존 코드 ...
    StopServerHealthCheck();
    StopServerProcess();
}
```

### 2. 데이터베이스 영구 저장 수정

#### 2.1. Django Settings 수정 (aibim_quantity_takeoff_web/settings.py)
```python
import os
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Database path: use environment variable if set, otherwise use BASE_DIR
# This allows PyInstaller builds to specify a writable data directory
DB_PATH = os.environ.get('DATABASE_PATH', str(BASE_DIR / 'db.sqlite3'))

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': DB_PATH,  # ← 환경 변수 사용
    }
}
```

#### 2.2. 서버 Entry Point 수정 (run_server.py)

**데이터베이스 파일 크기 검증 추가**:
```python
# --- 2. Copy initial database ---
db_path = writable_dir / "db.sqlite3"

# Check if database file exists AND is valid (not empty/corrupted)
# A valid database should be at least 100KB
db_is_valid = db_path.exists() and db_path.stat().st_size > 100000

if not db_is_valid:
    try:
        # Remove empty/corrupted file if exists
        if db_path.exists():
            print(f"[WARNING] Found invalid database file (size: {db_path.stat().st_size} bytes), removing...")
            db_path.unlink()

        # Copy fresh database
        if getattr(sys, 'frozen', False):
            source_db_path = Path(sys._MEIPASS) / "db.sqlite3"
        else:
            source_db_path = Path(__file__).parent / "db.sqlite3"

        if source_db_path.exists():
            shutil.copy2(source_db_path, db_path)
            print(f"[OK] Initial database copied (size: {db_path.stat().st_size} bytes)")
        else:
            print("[WARNING] Original database file (db.sqlite3) not found.")
    except Exception as e:
        print(f"[ERROR] Failed to copy database: {e}")
        input("Press Enter to exit...")
        sys.exit(1)
else:
    print(f"[OK] Using existing valid database: {db_path} (size: {db_path.stat().st_size} bytes)")
```

**환경 변수 설정 추가**:
```python
# --- 3. Configure Django environment ---
os.chdir(writable_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aibim_quantity_takeoff_web.settings')
# Set explicit database path so Django uses the correct location
os.environ['DATABASE_PATH'] = str(db_path)  # ← 환경 변수 설정
print(f"[INFO] Database path set to: {db_path}")
```

**마이그레이션 조건부 실행**:
```python
# --- 4. Run database migration (only for new/invalid database) ---
if not db_is_valid:
    print("\n--- Starting database migration (new/invalid database) ---")
    execute_from_command_line([sys.argv[0], 'migrate'])
    print("--- Database migration complete ---\n")
else:
    print("[INFO] Valid database exists, skipping migration to preserve data")
```

#### 2.3. 서버 재빌드 및 배포

**PyInstaller 빌드 명령**:
```bash
pyinstaller --name "CostEstimatorServer" \
    --onefile \
    --add-data "db.sqlite3;." \
    --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" \
    --add-data "connections;connections" \
    run_server.py
```

**배포**:
```bash
# 프로젝트 폴더에 복사
cp dist/CostEstimatorServer.exe .

# Revit 애드인 폴더에 복사
cp dist/CostEstimatorServer.exe \
   C:/Users/mddoy/AppData/Roaming/Autodesk/Revit/Addins/2026/CostEstimator_RevitAddin_2026/server/
```

## 수정된 파일 목록

1. **ConnectorWindow.xaml**
   - ServerProgressBar 추가

2. **ConnectorWindow.xaml.cs**
   - DispatcherTimer 필드 추가
   - StartServerHealthCheck() 메서드 추가
   - CheckServerHealth() 메서드 추가
   - StopServerHealthCheck() 메서드 추가
   - StartServerButton_Click() 수정 (헬스 체크 시작)
   - DisconnectButton_Click() 수정 (타이머 정리)
   - Window_Closing() 수정 (타이머 정리)

3. **run_server.py**
   - 데이터베이스 파일 크기 검증 로직 추가
   - DATABASE_PATH 환경 변수 설정
   - 조건부 마이그레이션 실행

4. **aibim_quantity_takeoff_web/settings.py**
   - DB_PATH 환경 변수 지원
   - DATABASES 설정 수정

## 개선 사항

### 1. 사용자 경험 개선
- ✅ 서버 시작 진행 상태를 실시간으로 표시
- ✅ 각 단계별 상태 메시지 표시 (초기화, DB 마이그레이션, 서버 준비, 포트 바인딩, 라이브러리 로딩)
- ✅ 진행률 프로그레스 바로 시각적 피드백 제공
- ✅ 서버가 완전히 준비될 때까지 연결 버튼 비활성화
- ✅ 180초 타임아웃으로 무한 대기 방지

### 2. 데이터 영구성 보장
- ✅ 데이터베이스 파일을 사용자 홈 디렉토리에 영구 저장 (`C:\Users\mddoy\CostEstimator_Data\db.sqlite3`)
- ✅ PyInstaller 임시 폴더 문제 해결
- ✅ 애드인 재시작 후에도 데이터 유지
- ✅ 빈 데이터베이스 파일 자동 탐지 및 교체

### 3. 안정성 개선
- ✅ 데이터베이스 파일 크기 검증 (최소 100KB)
- ✅ HTTP 헬스 체크로 서버 준비 상태 확인
- ✅ 타이머 리소스 정리로 메모리 누수 방지
- ✅ 서버 프로세스 정리 로직 강화

## 기술적 세부사항

### 헬스 체크 타임라인
- **0-15초**: 초기화 (0% → 15%)
- **15-50초**: DB 마이그레이션 (15% → 40%)
- **50-100초**: 서버 준비 (40% → 65%)
- **100-150초**: 포트 바인딩 (65% → 85%)
- **150-180초**: 라이브러리 로딩 (85% → 95%)
- **180초 초과**: 타임아웃 에러

### 데이터베이스 경로
- **개발 환경**: `<프로젝트>/db.sqlite3`
- **PyInstaller 빌드**: `C:\Users\mddoy\CostEstimator_Data\db.sqlite3`
- **환경 변수**: `DATABASE_PATH`로 커스터마이징 가능

### 파일 크기 검증
- **최소 크기**: 100KB (100,000 bytes)
- **이유**: 마이그레이션 완료된 데이터베이스는 최소 100KB 이상
- **빈 파일**: 0바이트 또는 매우 작은 파일은 손상된 것으로 간주

## 테스트 시나리오

### 시나리오 1: 최초 실행
1. 애드인 실행
2. "서버 시작" 버튼 클릭
3. 프로그레스 바가 표시되며 상태 메시지 업데이트
4. 서버 준비 완료 시 "실행 중" 표시 및 연결 버튼 활성화
5. 연결 버튼 클릭하여 브라우저 열기
6. 프로젝트 생성 및 데이터 입력

### 시나리오 2: 재시작 후 데이터 확인
1. 애드인 종료 (서버도 함께 종료)
2. 애드인 재실행
3. "서버 시작" 버튼 클릭
4. 기존 데이터베이스 사용 메시지 확인: `[INFO] Valid database exists, skipping migration to preserve data`
5. 연결 버튼 클릭
6. **결과**: 이전에 생성한 프로젝트가 그대로 존재

### 시나리오 3: 손상된 데이터베이스 복구
1. `C:\Users\mddoy\CostEstimator_Data\db.sqlite3` 파일을 빈 파일로 교체 (0 bytes)
2. 애드인 실행 → 서버 시작
3. 시스템이 손상된 파일 탐지: `[WARNING] Found invalid database file (size: 0 bytes), removing...`
4. 새로운 데이터베이스 복사 및 마이그레이션 실행
5. 정상 동작 확인

## 참고 사항

### Blender 애드인과의 비교
- **공통점**:
  - HTTP 헬스 체크 사용
  - 시간 기반 진행률 계산
  - 180초 타임아웃
  - 단계별 상태 메시지

- **차이점**:
  - Blender: 로그 파일 분석으로 더 정확한 단계 추적 가능
  - Revit: 시간 기반 추정 (로그 파일 접근 불가)
  - Revit: WPF DispatcherTimer 사용 (Blender는 bpy.app.timers 사용)

### 향후 개선 가능 사항
- [ ] 서버 로그 파일 분석으로 더 정확한 진행률 표시 (현재는 시간 기반 추정)
- [ ] 서버 시작 실패 시 상세한 에러 메시지 표시
- [ ] 포트 충돌 감지 및 자동 대체 포트 제안
- [ ] 데이터베이스 백업 기능

## 결론

이번 작업을 통해 Revit 애드인의 서버 시작 경험을 크게 개선했습니다:

1. **헬스 체크 시스템**: 사용자가 서버 준비 상태를 명확히 알 수 있음
2. **데이터 영구성**: 애드인 재시작 후에도 데이터가 보존됨
3. **안정성**: 손상된 데이터베이스 자동 복구 및 타임아웃 처리

Blender 애드인과 동일한 수준의 사용자 경험을 제공하며, PyInstaller 빌드 환경에서도 안정적으로 동작합니다.
