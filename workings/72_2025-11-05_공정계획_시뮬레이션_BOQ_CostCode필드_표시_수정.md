# 72. 2025-11-05: 공정계획 및 시뮬레이션 탭 BOQ 내역집계표 CostCode 필드 표시 수정

## 문제 상황

### 발견된 문제
1. **공정계획 탭** 아래의 내역집계표에서 CostCode 정보(내역코드, 공종, 품명, 규격, 단위)를 제대로 가져오지 못함
2. **시뮬레이션 탭** 아래의 내역집계표도 동일한 문제 발생
3. **공사코드별 비용 정보** 섹션에서도 CostCode 필드를 표시하지 못함
4. 단가 정보와 금액 정보도 제대로 표시되지 않음

### 근본 원인 분석
- 공정계획 및 시뮬레이션 탭은 `ganttCostItems`를 데이터 소스로 사용
- `ganttCostItems`는 ActivityObject API 응답에서 `ao.cost_item`을 스프레드하여 생성
- 이 API 응답의 CostItem 객체는 CostCode의 enriched 필드를 포함하지 않음
  - `cost_code_detail_code`, `cost_code_category`, `cost_code_product_name`, `cost_code_spec` 등이 undefined
- 반면 **상세견적(DD) 탭**은 `/connections/api/cost-items/` 엔드포인트에서 enriched 데이터를 로드하므로 정상 작동

### 콘솔 로그로 확인된 문제
```javascript
// 공정계획/시뮬레이션 (문제)
[Log] [Gantt BOQ] Item: undefined "CostItem fields:" {
    cost_code_code: undefined,
    cost_code_detail_code: undefined,
    cost_code_category: undefined,
    ...
}

// 3D 뷰어의 공사코드별 비용 정보 (정상)
[Log] [3D Viewer] CostItem fields: {
    cost_code_detail_code: "c-001",
    cost_code_category: "조적공사",
    cost_code_product_name: "벽돌쌓기",
    ...
}
```

## 해결 방법

### 1. 공정계획 탭 BOQ 수정 (`gantt_chart_handlers.js`)

#### 위치: `renderBoqSummary()` 함수 (lines 1563-1591)

**변경 전:**
```javascript
// 액티비티에 연결된 산출항목 수집
const activityIds = new Set(activeActivities.map(a => a.activityId));
const relevantCostItems = ganttCostItems.filter(item =>
    item.activities && item.activities.some(actId => activityIds.has(actId))
);
```

**변경 후:**
```javascript
// ▼▼▼ [수정] 서버에서 enriched cost items 로드 (2025-11-05) ▼▼▼
// 액티비티에 연결된 산출항목 수집
const activityIds = new Set(activeActivities.map(a => a.activityId));

// 서버에서 enriched cost items 가져오기 (CostCode 필드 포함)
const response = await fetch(`/connections/api/cost-items/${currentProjectId}/`);
if (!response.ok) throw new Error('산출항목 데이터를 불러오는데 실패했습니다.');

const allEnrichedCostItems = await response.json();
console.log('[BOQ Summary] Loaded enriched cost items:', allEnrichedCostItems.length);

// ganttCostItems에서 활동 ID 정보 가져오기
const costItemActivitiesMap = new Map();
ganttCostItems.forEach(item => {
    if (item.activities) {
        costItemActivitiesMap.set(item.id, item.activities);
    }
});

// enriched cost items에 활동 정보 추가하고 필터링
const relevantCostItems = allEnrichedCostItems
    .map(item => ({
        ...item,
        activities: costItemActivitiesMap.get(item.id) || []
    }))
    .filter(item =>
        item.activities.some(actId => activityIds.has(actId))
    );
// ▲▲▲ [수정] 여기까지 ▲▲▲
```

### 2. 시뮬레이션 탭 BOQ 수정 (`three_d_viewer.js`)

#### 위치: 시뮬레이션 BOQ 렌더링 함수 (lines 8982-9010)

**변경 전:**
```javascript
// 액티비티에 연결된 산출항목 수집
const activityIds = new Set(activeActivities.map(a => a.activityId));
const relevantCostItems = window.ganttCostItems.filter(item =>
    item.activities && item.activities.some(actId => activityIds.has(actId))
);
```

**변경 후:**
```javascript
// ▼▼▼ [수정] 서버에서 enriched cost items 로드 (2025-11-05) ▼▼▼
// 액티비티에 연결된 산출항목 수집
const activityIds = new Set(activeActivities.map(a => a.activityId));

// 서버에서 enriched cost items 가져오기 (CostCode 필드 포함)
const response = await fetch(`/connections/api/cost-items/${window.currentProjectId}/`);
if (!response.ok) throw new Error('산출항목 데이터를 불러오는데 실패했습니다.');

const allEnrichedCostItems = await response.json();
console.log('[Viewer BOQ] Loaded enriched cost items:', allEnrichedCostItems.length);

// ganttCostItems에서 활동 ID 정보 가져오기
const costItemActivitiesMap = new Map();
window.ganttCostItems.forEach(item => {
    if (item.activities) {
        costItemActivitiesMap.set(item.id, item.activities);
    }
});

// enriched cost items에 활동 정보 추가하고 필터링
const relevantCostItems = allEnrichedCostItems
    .map(item => ({
        ...item,
        activities: costItemActivitiesMap.get(item.id) || []
    }))
    .filter(item =>
        item.activities.some(actId => activityIds.has(actId))
    );
// ▲▲▲ [수정] 여기까지 ▲▲▲
```

## 핵심 개선사항

### 1. 데이터 소스 변경
- **이전**: `ganttCostItems` (ActivityObject API에서 파생, enriched 필드 없음)
- **이후**: `/connections/api/cost-items/` API (서버에서 enriched 필드 포함)

### 2. 데이터 병합 로직
1. 서버에서 모든 enriched cost items 로드
2. `ganttCostItems`에서 activity ID 매핑 정보 추출
3. enriched cost items에 activity 정보 추가
4. 관련 activities만 필터링

### 3. 표시되는 컬럼
- **내역코드**: `cost_code_detail_code`
- **공종**: `cost_code_category`
- **품명**: `cost_code_product_name`
- **규격**: `cost_code_spec`
- **단위**: `unit`
- **수량**: 집계된 quantity
- **재료비단가**, **재료비**, **노무비단가**, **노무비**
- **경비단가**, **경비**, **합계단가**, **합계금액**

## 결과

### 수정 전
- 내역코드, 공종, 품명, 규격, 단위 모두 빈 값으로 표시
- 단가 정보 표시 안 됨
- 금액 계산 불가

### 수정 후
- 모든 CostCode 필드가 정상적으로 표시됨
- 단가 정보가 정확히 표시됨
- 금액이 정확히 계산되어 표시됨
- **상세견적(DD) 탭**과 동일한 데이터 품질 제공

## 영향 범위

### 수정된 파일
1. `/connections/static/connections/gantt_chart_handlers.js`
   - `renderBoqSummary()` 함수 수정 (lines 1563-1591)

2. `/connections/static/connections/three_d_viewer.js`
   - 시뮬레이션 BOQ 렌더링 함수 수정 (lines 8982-9010)

### 기능 개선
- ✅ 공정계획 탭의 내역집계표가 CostCode 정보를 정확히 표시
- ✅ 시뮬레이션 탭의 내역집계표가 CostCode 정보를 정확히 표시
- ✅ 공사코드별 비용 정보가 정확히 표시
- ✅ 단가 및 금액 정보가 정확히 계산되어 표시

## 기술적 배경

### API 엔드포인트 차이
- **ActivityObject API** (`/connections/api/activity-objects/`):
  - 중첩된 객체 구조: `ActivityObject.cost_item`
  - CostItem에 기본 필드만 포함
  - enriched CostCode 필드 없음

- **CostItem API** (`/connections/api/cost-items/`):
  - CostItem 직접 반환
  - 서버에서 CostCode 필드를 flatten하여 포함
  - `cost_code_detail_code`, `cost_code_category`, `cost_code_product_name`, `cost_code_spec`, `unit` 등 모든 필드 포함

### 데이터 병합 필요성
- `ganttCostItems`는 활동 연결 정보를 포함하므로 완전히 대체할 수 없음
- enriched cost items와 activity 정보를 병합하여 사용하는 방식 채택

## 참고사항

이 수정으로 **공정계획**, **시뮬레이션**, **상세견적(DD)** 세 개의 탭 모두 동일한 품질의 CostCode 정보를 표시하게 되었습니다. 모든 BOQ 테이블이 통일된 데이터 소스를 사용하여 일관성이 향상되었습니다.
