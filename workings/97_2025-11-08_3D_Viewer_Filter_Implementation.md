# 3D Viewer 룰셋 기반 필터링 구현

**Date:** 2025-11-08
**Summary:** 3D 뷰포트에 룰셋 기반 필터링 기능 추가 - QuantityMember, CostItem, ActivityObject의 모든 속성을 활용한 조건식 필터링

---

## 개요

3D 뷰어에서 객체를 속성 기반으로 필터링할 수 있는 기능을 구현했습니다. RawElement와 연관된 모든 엔티티(QuantityMember, CostItem, ActivityObject)의 속성을 조건식으로 필터링하여 3D 뷰포트에서 매칭되는 객체만 표시할 수 있습니다.

---

## 구현 내용

### 1. UI 추가

**위치:** `connections/templates/three_d_viewer.html`

#### 필터 버튼 추가 (Line 62-65)
```html
<!-- 필터링 그룹 -->
<div class="button-group">
    <button id="open-filter-panel-btn" title="룰셋 기반 필터링">🔍 필터</button>
</div>
```

#### 필터 패널 추가 (Line 68-90)
- **필터 패널 헤더**: 제목 및 닫기 버튼
- **필터 조건 빌더**: 동적 조건 추가 UI
- **필터 액션**: 적용/초기화 버튼
- **결과 정보**: 필터링된 객체 수 표시

**주요 구성 요소:**
- 조건 빌더: 속성 선택, 연산자 선택, 값 입력
- 조건 추가 버튼
- 필터 적용/초기화 버튼

---

### 2. Backend API 구현

**위치:** `connections/views.py` (Lines 9581-9933)

#### API 1: `get_filter_data()`
```python
@require_http_methods(["GET"])
def get_filter_data(request, project_id):
    """
    3D 뷰어 필터링을 위한 통합 데이터 조회
    RawElement + QuantityMember + CostItem + ActivityObject의 모든 속성 반환
    """
```

**반환 데이터 구조:**
```json
{
    "status": "success",
    "data": [
        {
            "raw_element_id": "uuid",
            "BIM": { /* raw_data */ },
            "QM": [
                {
                    "System": { "id", "name", "quantity", ... },
                    "Properties": { /* custom properties */ },
                    "MM": { "System": {}, "Properties": {} },
                    "SC": { "System": {} },
                    "CI": [
                        {
                            "System": { "id", "description", ... },
                            "CC": { "System": { "code", "name", ... } },
                            "AO": [
                                {
                                    "System": { "id", "quantity", ... },
                                    "AC": { "System": { "code", "name", ... } }
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}
```

**포함된 속성:**
- **BIM**: RawElement의 raw_data (IFC/Revit 속성)
- **QM**: QuantityMember 시스템/커스텀 속성
- **MM**: MemberMark 속성
- **SC**: Space 속성
- **CI**: CostItem 속성
- **CC**: CostCode 속성
- **AO**: ActivityObject 속성
- **AC**: Activity 속성

#### API 2: `apply_filter_to_viewer()`
```python
@require_http_methods(["POST"])
def apply_filter_to_viewer(request, project_id):
    """
    필터 조건을 평가하여 매칭되는 RawElement ID 리스트 반환
    """
```

**요청 형식:**
```json
{
    "conditions": [
        {
            "property": "QM.System.name",
            "operator": "contains",
            "value": "벽"
        },
        {
            "property": "CC.System.code",
            "operator": "==",
            "value": "A001"
        }
    ]
}
```

**응답 형식:**
```json
{
    "status": "success",
    "matched_ids": ["uuid1", "uuid2", ...],
    "total_count": 47
}
```

#### 보조 함수

**`build_filter_context(raw_element)`**
- RawElement의 모든 연관 데이터를 컨텍스트로 빌드
- QM, CI, AO를 순차적으로 조회하여 속성 트리 구성

**`evaluate_filter_condition(condition, context)`**
- 조건을 평가하여 True/False 반환
- 지원 연산자: ==, !=, contains, startsWith, endsWith, >, <, >=, <=

**`get_nested_value(obj, path)`**
- 중첩된 경로에서 값 가져오기 (예: "QM.System.name")
- 리스트인 경우 첫 번째 항목 사용

---

### 3. Frontend JavaScript 구현

**새 파일:** `connections/static/connections/three_d_viewer_filter.js` (~330 lines)

#### 주요 함수

**`openFilterPanel()`**
- 필터 패널 표시
- 필터 데이터 로드 (캐시되지 않은 경우)

**`loadFilterProperties()`**
- `/api/filter/data/{project_id}/` API 호출
- 사용 가능한 속성 목록 추출

**`extractProperties(data)`**
- 데이터에서 모든 속성 경로 추출
- 예: `BIM.Category`, `QM.System.name`, `CC.System.code`

**`addFilterCondition()`**
- 새로운 조건 행 추가

**`createConditionRow(condition)`**
- 조건 행 생성
  - 속성 선택 드롭다운
  - 연산자 선택 드롭다운
  - 값 입력 필드
  - 삭제 버튼

**`applyFilter()`**
- 모든 조건 수집
- `/api/filter/apply/{project_id}/` API 호출
- 3D 뷰어에 필터 적용

**`clearFilter()`**
- 모든 조건 제거
- 3D 뷰어 필터 해제

#### 이벤트 리스너
- `#open-filter-panel-btn` → `openFilterPanel()`
- `#close-filter-panel-btn` → `closeFilterPanel()`
- `#add-filter-condition-btn` → `addFilterCondition()`
- `#apply-filter-btn` → `applyFilter()`
- `#clear-filter-btn` → `clearFilter()`

---

### 4. 3D Viewer 필터 함수 추가

**위치:** `connections/static/connections/three_d_viewer.js` (Lines 13224-13292)

#### `window.viewer.applyFilter(matchedIds)`
```javascript
window.viewer.applyFilter = function(matchedIds) {
    const matchedSet = new Set(matchedIds);

    scene.traverse((object) => {
        if (object.isMesh && object.userData.rawData) {
            const rawId = object.userData.rawData.id;

            if (matchedSet.has(rawId)) {
                object.visible = true;  // 매칭됨 - 표시
            } else {
                object.visible = false; // 매칭 안됨 - 숨김
            }
        }
    });
};
```

#### `window.viewer.clearFilter()`
```javascript
window.viewer.clearFilter = function() {
    scene.traverse((object) => {
        if (object.isMesh && object.userData.rawData) {
            object.visible = true;  // 모든 객체 표시
        }
    });
};
```

---

### 5. URL 라우팅 추가

**위치:** `connections/urls.py` (Lines 219-221)

```python
# 3D Viewer Filter
path('api/filter/data/<uuid:project_id>/', views.get_filter_data, name='get_filter_data'),
path('api/filter/apply/<uuid:project_id>/', views.apply_filter_to_viewer, name='apply_filter_to_viewer'),
```

---

### 6. CSS 스타일 추가

**위치:** `connections/static/connections/style.css` (Lines 4685-4866)

**주요 스타일:**
- `.filter-panel`: 필터 패널 컨테이너 (absolute positioning)
- `.filter-panel-header`: 헤더 영역
- `.filter-condition-row`: 조건 행 레이아웃
- `.filter-property-select`, `.filter-operator-select`, `.filter-value-input`: 입력 요소
- `.add-condition-btn`, `.primary-btn`, `.secondary-btn`: 버튼 스타일
- `.filter-result-info`: 결과 표시 영역

**디자인 특징:**
- 플로팅 패널 (z-index: 1000)
- 드롭 섀도우 및 둥근 모서리
- Flexbox 레이아웃
- 반응형 버튼 및 입력 필드

---

### 7. JavaScript 파일 로드

**위치:** `connections/templates/revit_control.html` (Lines 3313-3314)

```html
<script src="{% static 'connections/three_d_viewer.js' %}?v=51"></script>
<script src="{% static 'connections/three_d_viewer_filter.js' %}"></script>
```

---

## 사용자 워크플로우

### 1. 필터 패널 열기
1. 3D Viewer 탭 진입
2. 왼쪽 컨트롤에서 **"🔍 필터"** 버튼 클릭
3. 필터 패널 표시됨

### 2. 필터 조건 추가
1. **"+ 조건 추가"** 버튼 클릭
2. **속성 선택**: 드롭다운에서 필터링할 속성 선택
   - 예: `QM.System.name`, `CC.System.code`, `BIM.Category`
3. **연산자 선택**: 조건 연산자 선택
   - 예: 같음, 포함, 시작, 큼, 작음 등
4. **값 입력**: 비교할 값 입력
   - 예: "벽", "A001", "100"
5. 여러 조건 추가 가능 (AND 조건)

### 3. 필터 적용
1. **"필터 적용"** 버튼 클릭
2. 백엔드에서 조건 평가
3. 매칭되는 객체만 3D 뷰포트에 표시
4. 결과 정보 표시: "47개 객체 필터링됨"

### 4. 필터 초기화
1. **"필터 초기화"** 버튼 클릭
2. 모든 조건 제거
3. 모든 객체 다시 표시

---

## 기술적 특징

### 1. 완전한 속성 접근
- RawElement의 BIM 속성
- QuantityMember의 시스템/커스텀 속성
- MemberMark, Space 속성
- CostItem, CostCode 속성
- ActivityObject, Activity 속성

**모든 연관 속성을 하나의 컨텍스트로 통합하여 필터링 가능**

### 2. 유연한 조건식
**지원 연산자:**
- `==` : 같음
- `!=` : 같지 않음
- `contains` : 포함
- `startsWith` : 시작
- `endsWith` : 끝
- `>`, `<`, `>=`, `<=` : 숫자 비교

**다중 조건 지원 (AND 로직)**

### 3. 성능 최적화
- 필터 데이터 캐싱
- 효율적인 Set 기반 매칭
- Scene traversal 최소화

### 4. UI/UX 최적화
- 직관적인 조건 빌더
- 드래그 가능한 필터 패널
- 실시간 결과 표시
- 조건 동적 추가/제거

---

## 파일 변경 사항 요약

| 파일 | 변경 내용 | 줄 수 |
|------|----------|-------|
| `three_d_viewer.html` | 필터 UI 및 패널 추가 | ~25 lines |
| `three_d_viewer_filter.js` | **새 파일** - 필터 로직 | ~330 lines |
| `three_d_viewer.js` | 필터 함수 추가 | ~70 lines |
| `views.py` | 필터 API 2개 추가 | ~355 lines |
| `urls.py` | URL 패턴 2개 추가 | 2 lines |
| `style.css` | 필터 패널 스타일 | ~180 lines |
| `revit_control.html` | JS 파일 로드 | 1 line |

**Total: ~960 lines of new code**

---

## API 요약

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/filter/data/<project_id>/` | 필터링을 위한 통합 데이터 조회 |
| POST | `/api/filter/apply/<project_id>/` | 필터 조건 평가 및 매칭 객체 반환 |

---

## 사용 예시

### 예시 1: 벽 객체만 표시
**조건:**
- 속성: `BIM.Category`
- 연산자: `==`
- 값: `벽`

### 예시 2: 특정 공사코드의 객체만 표시
**조건:**
- 속성: `CC.System.code`
- 연산자: `contains`
- 값: `A001`

### 예시 3: 수량이 100 이상인 객체만 표시
**조건:**
- 속성: `QM.System.quantity`
- 연산자: `>=`
- 값: `100`

### 예시 4: 복합 조건 (벽 + 수량 100 이상)
**조건 1:**
- 속성: `BIM.Category`
- 연산자: `==`
- 값: `벽`

**조건 2:**
- 속성: `QM.System.quantity`
- 연산자: `>=`
- 값: `100`

---

## 향후 개선 사항

### 1. 필터 저장 기능
- 자주 사용하는 필터 조건 저장
- 프리셋 필터 관리

### 2. OR 조건 지원
- 현재: AND 조건만 지원
- 개선: OR 조건 그룹 지원

### 3. 필터 히스토리
- 최근 사용한 필터 조건 저장
- 빠른 재적용

### 4. 속성값 자동완성
- 값 입력 시 자동완성 제안
- 기존 값 목록 표시

### 5. 필터 결과 하이라이트
- 매칭된 객체 강조 표시
- 매칭 개수 시각화

---

## 테스트 가이드

### 기본 테스트 시나리오

1. **UI 로딩 테스트**
   ```
   - 3D Viewer 탭 진입
   - 🔍 필터 버튼 클릭
   - 필터 패널 표시 확인
   ```

2. **속성 목록 로딩 테스트**
   ```
   - 필터 패널 열기
   - 조건 추가 클릭
   - 속성 드롭다운에 BIM, QM, CI, AO 속성 확인
   ```

3. **단일 조건 필터링 테스트**
   ```
   - 조건 추가: BIM.Category == "벽"
   - 필터 적용 클릭
   - 벽 객체만 표시되는지 확인
   ```

4. **복합 조건 필터링 테스트**
   ```
   - 조건 1: BIM.Category == "벽"
   - 조건 2: QM.System.quantity >= 10
   - 필터 적용 클릭
   - 두 조건 모두 만족하는 객체만 표시 확인
   ```

5. **필터 초기화 테스트**
   ```
   - 필터 적용 후
   - 필터 초기화 클릭
   - 모든 객체 다시 표시 확인
   ```

---

## 결론

3D 뷰어에 완전한 룰셋 기반 필터링 기능이 추가되었습니다. 사용자는 이제:

✅ **모든 연관 속성에 접근** (BIM, QM, MM, SC, CI, CC, AO, AC)
✅ **유연한 조건식 작성** (9가지 연산자)
✅ **복합 조건 필터링** (다중 AND 조건)
✅ **실시간 필터 적용** (즉시 시각화)
✅ **직관적인 UI** (조건 빌더)

이 시스템은 복잡한 BIM 프로젝트에서 특정 조건을 만족하는 객체를 빠르게 찾고 시각화할 수 있게 해줍니다.
