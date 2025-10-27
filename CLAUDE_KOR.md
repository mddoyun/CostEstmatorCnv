# CLAUDE_KOR.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소의 코드를 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

Django로 구축된 AEC(건축, 엔지니어링 및 건설) 비용 추정 웹 애플리케이션입니다. 이 시스템은 WebSocket 연결을 통해 Blender 및 Autodesk Revit과 통합되어 실시간 3D 모델 기반 비용 추정을 가능하게 합니다.

**핵심 기술 스택:**
- **백엔드**: Django 5.2+ with Channels (Daphne를 통한 WebSocket 지원)
- **데이터베이스**: UUID 기본 키를 사용하는 SQLite
- **프론트엔드**: 바닐라 JavaScript (프레임워크 없음 - 26개의 모듈형 JS 파일)
- **실시간 통신**: Django Channels를 통한 WebSockets (인메모리 채널 레이어)
- **ML/AI**: 비용 추정 모델을 위한 TensorFlow/Keras
- **외부 통합**: Blender 애드온(Python) 및 Revit 애드인(.NET/C#)

## 개발 환경 설정

### 서버 실행

**표준 Django 개발:**
```bash
python manage.py runserver
```

**PyInstaller 진입점 사용:**
```bash
python run_server.py
```

서버는 기본적으로 `http://127.0.0.1:8000`에서 실행됩니다.

### 데이터베이스 마이그레이션

```bash
python manage.py migrate
```

참고: `run_server.py`를 통해 실행하면 마이그레이션이 자동으로 실행됩니다.

### 의존성

Python 의존성 설치:
```bash
pip install -r requirements.txt
```

프로젝트는 `.mddoyun/` 디렉토리에 위치한 가상 환경을 사용합니다.

## 아키텍처

### Django 앱 구조

1. **aibim_quantity_takeoff_web/** - 메인 Django 프로젝트 설정
   - `settings.py`: Channels/Daphne 설정이 포함된 Django 설정
   - `asgi.py`: WebSocket 지원을 위한 ASGI 애플리케이션
   - `urls.py`: 루트 URL 설정

2. **connections/** - WebSocket 및 데이터 관리를 처리하는 핵심 애플리케이션
   - `models.py`: 데이터베이스 모델 (Project, RawElement, QuantityClassificationTag, CostCode, AIModel 등)
   - `consumers.py`: WebSocket 컨슈머 (RevitConsumer, FrontendConsumer)
   - `routing.py`: WebSocket URL 라우팅
   - `views.py`: HTTP 뷰
   - `static/connections/`: 프론트엔드 JavaScript 파일
   - `templates/`: HTML 템플릿

### 데이터베이스 모델 (주요 엔티티)

데이터 모델은 전체적으로 UUID를 기본 키로 사용합니다. 핵심 모델은 다음과 같습니다:

- **Project**: 모든 프로젝트 데이터의 최상위 컨테이너
- **RawElement**: 원시 IFC/Revit 데이터(JSON)와 함께 BIM 요소를 저장
- **QuantityClassificationTag**: 수량 산출을 위한 분류 태그 (예: "건축_골조_슬래브_RC")
- **CostCode**: 시방서가 포함된 건설 공사 코드
- **AIModel**: 학습된 ML 모델(.h5 파일)을 메타데이터와 함께 바이너리 데이터로 저장
- **QuantityMember**: 집계된 수량 계산 결과
- **UnitPrice/UnitPriceType**: 단가 관리 시스템
- **Space**: 공간 분석을 위한 계층적 공간 구조

### WebSocket 통신

애플리케이션은 `connections/routing.py`에 정의된 세 개의 WebSocket 엔드포인트를 사용합니다:

- `ws/revit-connector/` - Revit 애드인 연결
- `ws/blender-connector/` - Blender 애드온 연결
- `ws/frontend/` - 웹 프론트엔드 연결

**메시지 프로토콜**: `type`과 `payload` 필드가 있는 JSON 메시지.

**컨슈머 구현**:
- Django Channels의 `AsyncWebsocketConsumer` 사용
- `@database_sync_to_async`로 래핑된 데이터베이스 작업
- 대용량 데이터 전송은 진행률 추적과 함께 청킹 사용

### 프론트엔드 아키텍처

프론트엔드는 26개의 모듈형 파일로 구성된 바닐라 JavaScript로 구축된 복잡한 SPA입니다:

**핵심 파일:**
- `app.js`: 이벤트 리스너 설정 및 초기화
- `app_core.js`: 핵심 애플리케이션 상태 및 데이터 관리
- `websocket.js`: WebSocket 연결 및 메시지 처리
- `ui.js`: UI 유틸리티 및 렌더링 함수
- `navigation.js`: 내비게이션 및 뷰 전환

**기능 모듈:**
- `project_management_handlers.js`: 프로젝트 CRUD 작업
- `data_management_handlers.js`: 요소 데이터 관리
- `tag_management_handlers.js`: 분류 태그 관리
- `cost_code_management_handlers.js`: 공사 코드 관리
- `ai_model_management.js`: AI 모델 업로드/관리
- `quantity_members_manager.js`: 수량 계산 관리
- `boq_detailed_estimation_handlers.js`: 상세 내역서
- `schematic_estimation_handlers.js`: 개산견적
- 분류, 매핑, 할당을 위한 다양한 룰셋 핸들러

**데이터 흐름:**
1. Revit/Blender에서 WebSocket을 통해 BIM 데이터 로드
2. `allRevitData` 전역 배열에 저장
3. 분류 및 수량 계산을 위한 룰셋을 통해 처리
4. 결과는 데이터베이스에 저장되고 테이블/뷰에 렌더링됨

### 외부 통합

**Blender 애드온** (`CostEstimator_BlenderAddon_453/`)
- Blender 4.2+ 용 Python 기반 애드온
- ifcopenshell을 사용하여 IFC 데이터 추출
- Django 서버에 연결되는 WebSocket 클라이언트
- 독립 실행형 배포를 위해 Django 서버 실행 파일을 번들로 제공 가능

**Revit 애드인** (`CostEstimator_RevitAddin_2026/`)
- .NET 8.0 Windows 애플리케이션
- Revit API와 통합되는 C# 코드베이스
- 실시간 통신을 위한 WebSocket 클라이언트
- 주요 파일: `WebSocketService.cs`, `RevitDataCollector.cs`, `RevitApiHandler.cs`

## 배포용 빌드

### 백엔드 서버 실행 파일

**macOS:**
```bash
pyinstaller --name "CostEstimatorServer" \
  --onefile \
  --add-data "db.sqlite3:." \
  --add-data "aibim_quantity_takeoff_web:aibim_quantity_takeoff_web" \
  --add-data "connections:connections" \
  run_server.py
```

**Windows:**
```bash
pyinstaller --name "CostEstimatorServer" --onefile --add-data "db.sqlite3;." --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" --add-data "connections;connections" run_server.py
```

출력 위치: `dist/CostEstimatorServer` (Windows에서는 `.exe`)

**런타임 동작**: 실행 파일은 쓰기 가능한 데이터베이스를 위해 `~/CostEstimator_Data` 폴더를 생성합니다.

## 개발 규칙

### Python 코드
- Django 규칙 및 패턴 준수
- 비동기 컨슈머의 데이터베이스 작업에 `@database_sync_to_async` 사용
- 전체적으로 디버그 print 문 존재 (`[DEBUG]`, `[ERROR]`, `[INFO]` 접두사)
- 정확한 재무 계산을 위해 모델에서 `DecimalField` 사용

### JavaScript 코드
- 바닐라 JS, 빌드 프로세스 불필요
- 애플리케이션 상태에 전역 변수 사용 (예: `currentProjectId`, `allRevitData`)
- 동적 UI 요소를 위한 이벤트 위임 패턴
- 기능 영역별 모듈식 구성
- 디버깅을 위한 `console.log` 활발히 사용

### WebSocket 메시징
- 모든 메시지는 `type` 및 `payload` 구조의 JSON 형식 사용
- 진행률 추적 메시지에는 긴 작업을 위한 total/count 필드 포함
- 요소 데이터 전송은 청킹 사용 (일반적인 청크 크기: 500-1000 요소)

### 데이터베이스
- 모든 테이블은 UUID 기본 키 사용
- 태그 및 분류에 다대다 관계 사용
- JSON 필드는 원시 BIM 데이터 및 룰셋 설정 저장
- (project, name/code) 조합에 대한 고유 제약 조건

## 일반적인 개발 패턴

### 새 WebSocket 메시지 유형 추가

1. 적절한 컨슈머(`consumers.py`)에 핸들러 추가
2. `websocket.js` switch 문에 해당 프론트엔드 핸들러 추가
3. 기능별 JS 파일에서 관련 UI 핸들러 업데이트

### 요소 데이터 작업

- 요소는 `raw_data` JSON 필드가 있는 `RawElement` 모델에 저장됨
- 프론트엔드는 `allRevitData` 배열에 캐시
- 대소문자를 구분하지 않는 속성 조회를 위해 `lowerValueCache` 사용
- 분류 태그는 다대다 관계로 저장

### 룰셋 시스템

룰셋은 요소가 분류되고 처리되는 방식을 정의합니다:
- 분류 규칙: 속성을 기반으로 요소에 태그 할당
- 속성 매핑 규칙: 요소 속성 추출/변환
- 공사 코드 할당 규칙: 요소를 공사 코드에 연결
- 부재 마크 할당 규칙: 식별 마크 할당
- 공간 할당/분류 규칙: 공간 계층 구조 관리

각 룰셋 유형에는 `ruleset_<type>_handlers.js` 패턴을 따르는 전용 핸들러 파일이 있습니다.

## 테스트 및 디버깅

- 프론트엔드 디버깅을 위해 브라우저 DevTools 콘솔 사용 (광범위한 console.log 사용)
- Django 콘솔에서 백엔드 디버그 출력 확인 가능
- 클라이언트 및 서버 양쪽에서 WebSocket 메시지 로깅
- 통합 테스트를 위해 Revit 2026 또는 Blender 4.2+ 사용

## 중요 참고 사항

- 프론트엔드 상태는 전역적으로 관리됨 - 상태 관리 프레임워크 없음
- WebSocket 전송에서 청킹을 통해 대용량 데이터셋 처리
- 데이터베이스 쓰기는 Channels 호환성을 위해 비동기 함수로 래핑된 동기식
- PyInstaller 빌드는 Django 정적 파일 및 템플릿의 신중한 포함 필요
- CSRF 토큰은 커스텀 유틸리티(`csrf_token.js`)를 통해 처리
