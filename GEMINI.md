# Gemini 코드 동반 에이전트 컨텍스트

이 문서는 Gemini 코드 동반 에이전트가 프로젝트 구조, 기술 및 개발 규칙을 이해하는 데 필요한 컨텍스트를 제공합니다.

## 프로젝트 개요

AEC(건축, 엔지니어링 및 건설) 산업을 위한 포괄적인 비용 추정 애플리케이션입니다. Django 웹 애플리케이션을 중심으로 Blender 및 Autodesk Revit과 통합됩니다.

### 주요 구성 요소

1. **Django 웹 애플리케이션** (백엔드)
   - Django 5.2+ with Channels (WebSocket via Daphne)
   - SQLite 데이터베이스 (UUID 기본키)
   - REST API 및 WebSocket 실시간 통신
   - TensorFlow/Keras ML 모델 지원

2. **프론트엔드** (Vanilla JavaScript SPA)
   - 32개 모듈형 JavaScript 파일
   - 프레임워크 없음 (바닐라 JS)
   - Three.js 기반 3D 뷰어 (CSG 지오메트리 분할)
   - 프로젝트 관리, 수량 산출, 비용 추정 UI

3. **Blender 애드온** (Python)
   - WebSocket으로 Django 서버 연결
   - IFC 데이터 추출 (ifcopenshell)
   - 지오메트리 데이터 전송
   - Blender ↔ 웹 애플리케이션 양방향 제어

4. **Revit 애드인** (.NET 8.0 C#)
   - WebSocket으로 Django 서버 연결
   - Revit API 통합
   - BIM 데이터 및 지오메트리 추출
   - Revit ↔ 웹 애플리케이션 실시간 연동

## 빌드 및 실행

### 백엔드 서버

**종속성 설치:**
```bash
pip install -r requirements.txt
```

가상 환경 위치: `.mddoyun/` 디렉토리

**서버 실행:**
```bash
# Django 개발 서버
python manage.py runserver

# PyInstaller 엔트리 포인트
python run_server.py
```

**실행 파일 빌드:**

macOS:
```bash
pyinstaller --name "CostEstimatorServer" \
  --onefile \
  --add-data "db.sqlite3:." \
  --add-data "aibim_quantity_takeoff_web:aibim_quantity_takeoff_web" \
  --add-data "connections:connections" \
  run_server.py
```

Windows:
```bash
pyinstaller --name "CostEstimatorServer" --onefile --add-data "db.sqlite3;." --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" --add-data "connections;connections" run_server.py
```

### 프론트엔드

별도의 빌드 프로세스 없음. Django에서 정적 파일 직접 제공.

### Blender 애드온

`CostEstimator_BlenderAddon_453/` 디렉토리를 Blender에 애드온으로 설치.

### Revit 애드인

`CostEstimator_RevitAddin_2026/` .NET 프로젝트를 Visual Studio 또는 .NET CLI로 빌드.

## 아키텍처

### 데이터베이스 모델 (UUID 기본키)

- **Project**: 프로젝트 최상위 컨테이너
- **RawElement**: BIM 원본 객체 (IFC/Revit 데이터, JSON)
  - 분할 객체 지원 (부모-자식 관계, `is_active` 플래그)
- **QuantityClassificationTag**: 수량 분류 태그
- **CostCode**: 공사코드 (detail_code, note 필드 포함)
- **QuantityMember**: 수량산출부재
- **MemberMark**: 일람부호
- **CostItem**: 산출항목
- **UnitPrice/UnitPriceType**: 단가 정보
- **Space**: 공간 계층 구조
- **Activity**: 공정 정보
- **AIModel**: ML 모델 (.h5 파일, 바이너리 저장)

### WebSocket 통신

**엔드포인트** (`connections/routing.py`):
- `ws/revit-connector/` - Revit 애드인
- `ws/blender-connector/` - Blender 애드온
- `ws/frontend/` - 웹 프론트엔드

**프로토콜**: JSON 메시지 (type + payload)
**특징**: AsyncWebsocketConsumer, @database_sync_to_async, 청킹, 진행률 추적

### 프론트엔드 (32개 모듈)

**핵심**: app.js, app_core.js, websocket.js, ui.js, navigation.js

**기능 모듈**: project_management, data_management, tag_management, cost_code_management, quantity_members_manager, cost_item_manager, boq_detailed_estimation, schematic_estimation, unit_price_management, ai_model_management, space_management, activity_management, calendar_management, gantt_chart

**룰셋 핸들러** (조건 빌더 UI 지원):
- classification, property_mapping, cost_code
- member_mark_assignment, cost_code_assignment
- space_classification, space_assignment, activity_assignment

**3D 뷰어**: three_d_viewer.js, ThreeBSP.js
- 다중 선택 (Window/Crossing)
- Orbit/Fly 모드 카메라
- 스케치 모드 + CSG 분할

### 룰셋 시스템

BIM 데이터 자동 처리 규칙:

1. **분류 룰셋**: BIM 객체에 분류 태그 할당
2. **속성 맵핑**: BIM 속성 추출/변환
3. **일람부호 할당**: 식별 마크 할당
4. **공사코드 룰셋**: 공사코드 + 수량 계산
5. **공간/공정**: 공간 및 공정 구조 생성/할당

**UI 개선 (2025-11-01)**:
- **조건 빌더**: JSON 대신 드롭다운 (속성/연산자/값)
- **맵핑 빌더**: 키-값 쌍 입력
- **헬퍼 패널**: BIM 원본 데이터 탭에 속성 참조 패널

## 개발 규칙

### Python
- Django 컨벤션 준수
- UUID 기본키
- DecimalField (금액 계산)
- @database_sync_to_async (비동기 DB)

### JavaScript
- Vanilla JS (빌드 프로세스 없음)
- 전역 변수 상태 관리 (currentProjectId, allRevitData)
- 이벤트 위임 패턴
- 32개 파일로 기능별 모듈화
- 파일명 규칙: `<feature>_handlers.js` 또는 `<feature>_manager.js`

### WebSocket
- JSON 형식 (type + payload)
- 청킹 (500-1000 요소/청크)
- 진행률 추적 메시지

### 데이터베이스
- UUID 기본키
- Many-to-many 관계 (태그, 분류)
- JSON 필드 (BIM 데이터, 룰셋 설정)
- 소프트 삭제 (is_active 플래그)

### UI 패턴
- 조건 빌더: 드롭다운 기반 조건 입력
- 맵핑 빌더: 키-값 쌍 매핑
- 헬퍼 패널: 컨텍스트 속성 참조
- 고정 열 너비 + 수평 스크롤

## 최근 주요 업데이트 (2025-10-30 ~ 2025-11-01)

1. **CostCode 모델 확장**: detail_code, note 필드 추가
2. **BOQ UI 개선**: 컬럼 커스터마이징, 단가 연동
3. **3D 뷰어 강화**: 다중 선택, Window/Crossing 모드, Fly 모드
4. **분할 객체**: 부피 기반 수량 분배, 재귀 분할
5. **룰셋 UI 개편**: 조건/맵핑 빌더로 사용자 친화적 개선
6. **헬퍼 패널**: BIM 원본 데이터 속성 참조
7. **테이블 레이아웃**: 가로 스크롤, 고정 열 너비

## 문제 해결

### 룰셋이 작동하지 않을 때
1. 조건 확인 (속성명, 연산자, 값)
2. 우선순위 확인 (규칙 충돌)
3. BIM 원본 데이터 탭에서 대상 객체 속성 확인

### 속성을 찾을 수 없을 때
1. BIM 원본 데이터 탭에서 객체 선택
2. 우측 헬퍼 패널에서 속성명 확인
3. 정확한 속성명 사용 (대소문자 구분)

## 문서

- [CLAUDE.md](./CLAUDE.md): 영문 상세 문서
- [CLAUDE_KOR.md](./CLAUDE_KOR.md): 한글 간략 가이드
- [/docs/rulesets/](./docs/rulesets/): 룰셋 상세 문서
- [/workings/](./workings/): 작업 이력 로그

## 중요 참고 사항

- 프론트엔드 상태는 전역 관리 (프레임워크 없음)
- 대용량 데이터는 WebSocket 청킹
- 룰셋은 내부적으로 JSON, 표시는 사용자 친화적
- 3D 뷰어는 WebGL 필요 (Three.js r128+)
- 분할 객체는 부피 비율로 수량 자동 분배
- PyInstaller 빌드 시 Django 정적 파일/템플릿 포함 필수
- CSRF 토큰은 `csrf_token.js` 유틸리티로 관리
