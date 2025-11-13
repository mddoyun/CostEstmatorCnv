# 101. 2025-11-13: Geometry 관계 룰셋 구현 (Part 1 - 핵심 구조)

## 작업 개요

수량산출부재 객체 간의 3D geometry 접촉/인접 관계를 자동으로 분석하여 속성을 할당하는 시스템 구현 시작.

**사용 사례**:
- 기둥 상단에 접촉한 슬라브의 두께 → 기둥의 "상단부분슬라브두께" 속성
- 접촉 유형에 따라 "기둥위계구분" = "슬라브하부기준기둥" 또는 "층고기준기둥"
- 측면 상단에 접촉한 보의 깊이 → "상단부분보두께" 속성

## 구현된 내용 (Part 1)

### 1. 데이터 모델 생성

**파일**: `connections/models.py`

```python
class GeometryRelationRule(models.Model):
    """Geometry 기반 공간 관계 분석 룰셋"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='geometry_relation_rules')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    priority = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    # 대상 객체 조건
    target_conditions = models.JSONField(default=dict)
    # 예: {"property": "classification_tag", "operator": "equals", "value": "기둥"}

    # 관계 분석 설정
    relation_config = models.JSONField(default=dict)
    # 예:
    # {
    #     "relations": [
    #         {
    #             "id": "top_slab",
    #             "name": "상단 슬라브 접촉",
    #             "related_classification": "슬라브",
    #             "contact_type": "top_cap",
    #             "tolerance": 0.001,
    #             "find_mode": "highest"
    #         }
    #     ]
    # }

    # 속성 할당 규칙
    property_assignments = models.JSONField(default=dict)
    # 예:
    # {
    #     "rules": [
    #         {
    #             "condition": "top_slab.exists == true",
    #             "properties": {
    #                 "기둥위계구분": "슬라브하부기준기둥",
    #                 "상단부분슬라브두께": "{top_slab.두께}"
    #             }
    #         }
    #     ]
    # }

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['priority', 'name']
```

**Migration**: `connections/migrations/0030_geometryrelationrule.py` 생성 및 적용 완료

### 2. Geometry 관계 분석기 (핵심 엔진)

**파일**: `connections/static/connections/geometry_relation_analyzer.js`

#### 2단계 접근 방식 (성능 최적화)

```javascript
class GeometryRelationAnalyzer {
    // STAGE 1: 빠른 필터링 (Bounding Box)
    fastFilterCandidates(targetMesh, targetQM, relConfig) {
        // 1. 대상 분류의 모든 객체 가져오기
        // 2. Bounding Box 1mm 확장
        // 3. 교차 체크로 후보군 추출 → O(n)
    }

    // STAGE 2: 정밀 검증 (Ray Casting + Vertex Analysis)
    preciseContactDetection(targetMesh, candidateMesh, contactType, tolerance) {
        // 후보군만 정밀 분석
        // Ray casting으로 실제 접촉 확인
    }
}
```

#### 지원하는 접촉 유형

1. **top_cap** (상단 캡 접촉)
   - 기둥 상단 면 ↔ 슬라브 하단 면
   - 9개 테스트 포인트 (중심 + 4 모서리 + 4 중간점)
   - 50% 이상 hit시 접촉으로 판단

2. **side_top** (측면 상단부 접촉)
   - 기둥 측면 상단 20% 영역 ↔ 보 측면
   - 둘레에 다수의 테스트 포인트
   - 4방향 (+X, -X, +Y, -Y) ray casting

3. **bottom** (하단 접촉)
   - 하단 면 접촉 검출
   - top_cap과 동일 패턴, 방향만 반대

4. **side_all** (측면 전체 접촉)
   - 측면 전체 영역 접촉 검출

#### find_mode 옵션

- **highest**: Z 좌표가 가장 높은 객체 (슬라브의 경우 가장 위층)
- **lowest**: Z 좌표가 가장 낮은 객체
- **nearest**: 거리가 가장 가까운 객체
- **all**: 모든 접촉 객체 (Z 좌표 내림차순 정렬)

### 3. 접촉 검출 알고리즘 상세

#### top_cap (상단 캡) 검출 로직

```
1. 기둥 Bounding Box에서 상단 Z 좌표 추출
2. 상단 면에 9개 테스트 포인트 배치
   - 중심점 1개
   - 모서리 4개
   - 변 중간점 4개
3. 각 점에서 위쪽(+Z) 방향으로 ray 발사 (10cm 범위)
4. 슬라브 mesh와 교차 검사
5. 50% 이상 hit → 접촉 판정
```

**예시**:
```
기둥 상단 테스트 포인트:

   1─────4─────3
   │           │
   8     0     6  ← 0: 중심, 1-4: 모서리, 5-8: 중간점
   │           │
   2─────5─────4

각 점에서 ↑ 방향 ray 발사
슬라브와 교차하는 점의 비율로 판단
```

#### side_top (측면 상단부) 검출 로직

```
1. 기둥 상단 20% 영역 정의
   sideTopThreshold = topZ - (height * 0.2)
2. 둘레에 테스트 포인트 생성 (4변 × 5점 = 20개)
3. 각 점에서 4방향(±X, ±Y) ray 발사
4. 보 또는 슬라브와 교차 검사
5. 1개 이상 hit → 접촉 판정
```

### 4. 성능 최적화 기법

1. **Mesh 캐싱**
   ```javascript
   this.meshCache = new Map();
   // QM ID → Mesh 매핑 캐싱하여 scene 순회 최소화
   ```

2. **2단계 필터링**
   - Stage 1: 전체 객체 중 Bounding Box 교차만 체크 → 빠름
   - Stage 2: 후보군만 Ray casting → 정확함

3. **성능 측정 로그**
   ```javascript
   const startTime = performance.now();
   // ... 분석 ...
   const elapsed = performance.now() - startTime;
   console.log(`Found ${count} objects (${elapsed.toFixed(2)}ms)`);
   ```

## 아직 구현되지 않은 내용 (Part 2로 이어질 작업)

### 1. UI 핸들러 (`geometry_relation_handlers.js`)
- [ ] 룰셋 목록 로드/렌더링
- [ ] 룰셋 추가/편집/삭제
- [ ] 조건 빌더 UI (기존 패턴 재사용)
- [ ] 관계 설정 UI
- [ ] 속성 할당 규칙 설정 UI

### 2. 백엔드 API (`connections/views.py`)
- [ ] `geometry_relation_rules_api` - CRUD
- [ ] `apply_geometry_relation_rules_view` - 일괄 적용
- [ ] 관계 결과 수신 및 속성 업데이트 로직

### 3. URL 라우팅 (`connections/urls.py`)
```python
path('api/rules/geometry-relation/<uuid:project_id>/', ...),
path('api/rules/geometry-relation/<uuid:project_id>/<uuid:rule_id>/', ...),
path('api/rules/geometry-relation/apply/<uuid:project_id>/', ...),
```

### 4. UI 탭 추가 (`revit_control.html`)
```html
<div id="geometry-relation-ruleset-tab" class="tab-content">
    <div class="content-header">
        <h2>공간관계 룰셋</h2>
        <div class="header-buttons">
            <button id="add-geometry-relation-rule-btn">+ 새 룰셋 추가</button>
            <button id="apply-geometry-relation-rules-btn">일괄 적용</button>
        </div>
    </div>
    <div id="geometry-relation-rules-table-container">
        <!-- 룰셋 테이블 -->
    </div>
</div>
```

### 5. 네비게이션 연동 (`navigation.js`)
- [ ] 새 탭 버튼 추가
- [ ] 탭 전환 이벤트 핸들러

### 6. 이벤트 리스너 등록 (`app.js`)
```javascript
document.getElementById('add-geometry-relation-rule-btn')
    ?.addEventListener('click', addGeometryRelationRule);
document.getElementById('apply-geometry-relation-rules-btn')
    ?.addEventListener('click', applyGeometryRelationRules);
```

## 사용 예시 (완성 후)

### 룰셋 설정 예시

```json
{
    "name": "기둥-슬라브 관계 분석",
    "target_conditions": [
        {
            "property": "classification_tag",
            "operator": "equals",
            "value": "기둥"
        }
    ],
    "relation_config": {
        "relations": [
            {
                "id": "top_slab",
                "name": "상단 슬라브",
                "related_classification": "슬라브",
                "contact_type": "top_cap",
                "tolerance": 0.001,
                "find_mode": "highest"
            },
            {
                "id": "side_beam",
                "name": "측면 보",
                "related_classification": "보",
                "contact_type": "side_top",
                "tolerance": 0.001,
                "find_mode": "nearest"
            }
        ]
    },
    "property_assignments": {
        "rules": [
            {
                "condition": "top_slab.exists == true",
                "properties": {
                    "기둥위계구분": "슬라브하부기준기둥",
                    "상단부분슬라브두께": "{top_slab.두께}",
                    "상단부분슬라브레벨": "{top_slab.Level}"
                }
            },
            {
                "condition": "top_slab.exists == false",
                "properties": {
                    "기둥위계구분": "층고기준기둥"
                }
            },
            {
                "condition": "side_beam.exists == true",
                "properties": {
                    "상단부분보두께": "{side_beam.깊이}"
                }
            }
        ]
    }
}
```

### 프론트엔드 사용 예시

```javascript
// 1. Analyzer 초기화
const analyzer = new GeometryRelationAnalyzer(
    scene,                    // Three.js scene
    window.loadedQuantityMembers  // 수량산출부재 목록
);

// 2. 특정 객체에 대해 관계 분석
const targetQM = window.loadedQuantityMembers.find(qm => qm.name === "C1");
const relationConfig = {
    relations: [
        {
            id: "top_slab",
            related_classification: "슬라브",
            contact_type: "top_cap",
            tolerance: 0.001,
            find_mode: "highest"
        }
    ]
};

const results = analyzer.analyzeRelations(targetQM, relationConfig);

// 3. 결과 확인
console.log(results);
// {
//     top_slab: {
//         exists: true,
//         count: 2,
//         closest: { id: "...", name: "SL1", properties: {두께: 200, ...} },
//         all: [...]
//     }
// }

// 4. 백엔드로 결과 전송하여 속성 업데이트
await fetch(`/connections/api/rules/geometry-relation/apply/${projectId}/`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-CSRFToken': csrftoken},
    body: JSON.stringify({
        rule_id: ruleId,
        relation_results: [{
            qm_id: targetQM.id,
            relations: results
        }]
    })
});
```

## 기술적 세부사항

### 1. Ray Casting 정확도

- **Ray 길이**: `tolerance * 100` (기본 10cm)
  - 1mm tolerance → 10cm 범위 탐색
  - 너무 짧으면 miss 가능
  - 너무 길면 불필요한 객체까지 감지

- **Hit 판정 기준**:
  - top_cap: 50% 이상 (9개 중 5개 이상)
  - side_top: 1개 이상
  - 기준은 contact_type에 따라 조정 가능

### 2. Bounding Box 확장

```javascript
const expandedBox = targetBox.clone().expandByScalar(tolerance);
```

- 사용자 제안 방식: 1mm 확장
- 접촉 허용 오차를 geometry에 반영
- Stage 1 필터링에서 false negative 방지

### 3. 좌표계 주의사항

- Three.js는 Y-up (Revit) 또는 Z-up (IFC) 좌표계
- 본 구현은 **Z-up 기준** (Z가 높이)
- 만약 Y-up이면 코드 수정 필요

### 4. 메모리 및 성능

- **메시 캐싱** 필수: 반복적인 scene.traverse() 방지
- **대량 객체 처리 시**:
  - Octree/BVH 같은 공간 분할 자료구조 고려
  - Web Worker로 병렬 처리
  - 배치 단위 처리 (500개씩)

## 다음 세션에서 할 작업

1. **UI 핸들러 완성** (`geometry_relation_handlers.js`)
   - 룰셋 CRUD UI
   - 조건/관계/속성 빌더 UI

2. **백엔드 API 완성**
   - 룰셋 CRUD endpoints
   - 일괄 적용 로직
   - 속성 할당 expression 평가기

3. **UI 탭 추가 및 네비게이션 연동**
   - HTML 템플릿에 탭 추가
   - 버튼 및 이벤트 리스너 연결

4. **테스트 및 디버깅**
   - 샘플 데이터로 접촉 검출 테스트
   - 성능 측정 및 최적화

5. **문서화**
   - 사용자 가이드
   - API 문서

## 참고사항

- **기존 시스템과의 통합**:
  - 조건 빌더: `renderConditionRowForQM()` 재사용
  - 속성 expression 평가: `evaluate_member_properties_expression()` 재사용
  - 룰셋 테이블 렌더러: `ui.js`의 기존 패턴 따름

- **Three.js 의존성**:
  - `THREE.Box3`, `THREE.Raycaster` 사용
  - `ThreeBSP`는 필요시에만 (성능 고려)

- **디버그 로그**:
  - 모든 주요 단계에 console.log 포함
  - 성능 측정 시간 출력
  - 후보 수 및 hit 비율 추적

## 결론

Part 1에서 Geometry 관계 룰셋 시스템의 **핵심 엔진**을 완성했습니다:

✅ 데이터 모델 (GeometryRelationRule)
✅ 2단계 접촉 검출 알고리즘 (빠름 + 정확함)
✅ 4가지 접촉 유형 지원 (top_cap, side_top, bottom, side_all)
✅ 성능 최적화 (캐싱, 로깅)

이제 UI와 백엔드 API만 완성하면 **기둥-슬라브-보 관계 기반 자동 속성 할당**이 가능합니다!
