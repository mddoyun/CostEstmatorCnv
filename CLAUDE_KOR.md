# CLAUDE_KOR.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소의 코드를 작업할 때 참고하는 가이드입니다.

> **참고**: 더 자세한 영문 문서는 [CLAUDE.md](./CLAUDE.md)를 참조하세요.

## 프로젝트 개요

Django로 구축된 AEC(건축, 엔지니어링 및 건설) 비용 추정 웹 애플리케이션입니다. WebSocket을 통해 Blender 및 Revit과 통합하여 실시간 3D 모델 기반 비용 추정, 고급 수량 산출 및 BIM 데이터 처리 기능을 제공합니다.

**핵심 기술 스택:**
- **백엔드**: Django 5.2+ with Channels (WebSocket/Daphne)
- **데이터베이스**: SQLite (UUID 기본키)
- **프론트엔드**: Vanilla JavaScript (32개 모듈)
- **3D 시각화**: Three.js + CSG(ThreeBSP)
- **실시간 통신**: Django Channels WebSocket
- **ML/AI**: TensorFlow/Keras
- **외부 연동**: Blender 애드온(Python), Revit 애드인(.NET/C#)

## 서버 실행

```bash
# 개발 모드
python manage.py runserver

# PyInstaller 엔트리 포인트
python run_server.py
```

## 프론트엔드 구조 (32개 JS 모듈)

**핵심**: app.js, app_core.js, websocket.js, ui.js, navigation.js, csrf_token.js

**기능 모듈**:
- project_management, data_management, tag_management
- cost_code_management, quantity_members_manager, cost_item_manager
- boq_detailed_estimation, schematic_estimation
- unit_price_management, ai_model_management
- space_management, activity_management, calendar_management, gantt_chart

**룰셋 (조건 빌더 지원)**:
- classification, property_mapping, cost_code
- member_mark_assignment, cost_code_assignment
- space_classification, space_assignment, activity_assignment

**3D**: three_d_viewer.js, ThreeBSP.js

## 룰셋 시스템

BIM 데이터 자동 처리 규칙 기반 시스템:

1. **분류 룰셋**: BIM 객체 → 분류 태그
2. **속성 맵핑**: BIM 속성 → 수량산출부재 속성
3. **일람부호 할당**: 수량산출부재 → 일람부호
4. **공사코드 룰셋**: 수량산출부재 → 공사코드 + 수량 계산
5. **공간/공정 할당**: 공간 및 공정 연결

### UI 개선 (2025-11-01)

**조건 빌더**: JSON textarea → 드롭다운 선택 (속성/연산자/값)
**맵핑 빌더**: 키-값 쌍 입력 인터페이스 (템플릿: `{속성명}`)
**헬퍼 패널**: BIM 원본 데이터 탭 우측에 속성 참조 패널

**지원 연산자**: ==, !=, contains, startsWith, endsWith, >, <, >=, <=

**속성 참조**:
- RawElement: Category, Family, Type, Level, Parameters.*, TypeParameters.*
- QuantityMember: name, classification_tag, properties.*, MM.*, RE.*

## 3D 뷰어 기능

**선택**: 단일/다중/Window/Crossing
**카메라**: Orbit 모드, Fly 모드 (WASD+QE+Shift)
**스케치**: CAD 스타일 그리기 + CSG 분할
**분할**: 부모-자식 관계, 부피 기반 수량 분배

## 최근 업데이트 (2025-10-30 ~ 2025-11-01)

1. CostCode 모델 확장 (detail_code, note)
2. BOQ 커스터마이징 (컬럼 표시, 단가 연동)
3. 3D 뷰어 강화 (다중 선택, fly 모드)
4. 분할 객체 지원 (부피 기반 분배)
5. 룰셋 UI 개편 (조건/맵핑 빌더)
6. 헬퍼 패널 추가 (속성 참조)
7. 테이블 레이아웃 개선 (스크롤, 고정 폭)

## 개발 규칙

**Python**: Django 컨벤션, UUID 기본키, @database_sync_to_async
**JavaScript**: Vanilla JS, 전역 상태, 이벤트 위임, 32개 모듈
**WebSocket**: JSON (type+payload), 청킹, 진행률 추적
**데이터베이스**: UUID, Many-to-many, JSON 필드, is_active 소프트 삭제

## 문서

- [CLAUDE.md](./CLAUDE.md): 영문 상세 문서
- [GEMINI.md](./GEMINI.md): Gemini AI용 문서
- [/docs/rulesets/](./docs/rulesets/): 룰셋 상세 가이드
- [/workings/](./workings/): 작업 이력 로그

## 외부 연동

**Blender**: Python 애드온 (IFC 추출, WebSocket)
**Revit**: .NET 애드인 (Revit API, WebSocket, 지오메트리)

## 배포

PyInstaller로 실행 파일 빌드 (macOS/Windows):
```bash
pyinstaller --name "CostEstimatorServer" --onefile \
  --add-data "db.sqlite3:." \
  --add-data "aibim_quantity_takeoff_web:aibim_quantity_takeoff_web" \
  --add-data "connections:connections" \
  run_server.py
```

런타임: `~/CostEstimator_Data` 폴더 생성

## 중요 사항

- 전역 상태 관리 (프레임워크 없음)
- 대용량 데이터 청킹
- 룰셋은 내부 JSON, 표시는 사용자 친화적
- 3D는 WebGL 필요 (Three.js r128+)
- 분할 객체는 부피 비율로 수량 분배
