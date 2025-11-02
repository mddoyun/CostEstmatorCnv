# BIM 필드 계층적 명명 규칙 적용 - Phase 1 (2025-01-02)

## 목표

전체 시스템에서 BIM 객체 및 관련 객체(QuantityMember, CostItem, Activity)의 속성에 접근할 때 일관된 명명 규칙을 사용하여 사용자의 혼란을 방지하고 가독성을 향상시킨다.

## Phase 1 범위: BIM 원본 데이터 테이블 필드명 표시

"산출 - BIM원본데이터" 탭에서 표시되는 모든 필드명을 계층적 접두어(prefix)를 사용한 표시명으로 통일.

## 계층적 명명 규칙

### 객체 타입 접두어
- `BIM` (또는 `RE`) - RawElement (BIM 원본 객체)
- `QM` - QuantityMember
- `CI` - CostItem
- `MM` - MemberMark
- `CC` - CostCode
- `ACT` - Activity

### BIM 객체 속성 카테고리

#### **BIM.System.*** - Cost Estimator 자체 관리 속성
Cost Estimator 시스템 내부에서 관리하는 속성들. BIM 원본 데이터와는 별개로 계산되거나 할당됨.

- `BIM.System.id` - BIM 원본 시스템의 고유 ID (IFC: ElementId/GlobalId, Revit: ElementId)
- `BIM.System.element_unique_id` - Cost Estimator DB의 UUID
- `BIM.System.classification_tags` - 분류 태그 (내부 관리)
- `BIM.System.geometry_volume` - 계산된 기하 볼륨 (내부 계산)

#### **BIM 원본 데이터** - 각 시스템의 구조 그대로 반영

**IFC (Blender 모드):**
- `BIM.Attributes.*` - IFC attributes (Name, Description, IfcClass, GlobalId, RelatingType, SpatialContainer 등)
- `BIM.Parameters.*` - raw_data['Parameters']
- `BIM.TypeParameters.*` - raw_data['TypeParameters']

**Revit 모드:**
- `BIM.Parameters.*` - raw_data['Parameters'] (대부분의 속성)
  - Category, Family, Name 등도 Revit API를 통해 Parameters로 접근 가능
- `BIM.TypeParameters.*` - raw_data['TypeParameters']

### 예시

**IFC 데이터:**
- 기존: `Name` → 새로운: `BIM.Attributes.Name`
- 기존: `IfcClass` → 새로운: `BIM.Attributes.IfcClass`
- 기존: `TypeParameters.Pset_sample__owner` → 새로운: `BIM.TypeParameters.Pset_sample__owner`

**Revit 데이터:**
- 기존: `Category` → 새로운: `BIM.Parameters.Category`
- 기존: `Level` → 새로운: `BIM.Parameters.Level`
- 기존: `TypeParameters.Fire Rating` → 새로운: `BIM.TypeParameters.Fire Rating`

**공통 (시스템 속성):**
- 기존: `classification_tags` → 새로운: `BIM.System.classification_tags`
- 기존: `geometry_volume` → 새로운: `BIM.System.geometry_volume`

## 구현 세부사항

### 수정된 파일
`/Users/mddoyun/Developments/CostEstimatorCnv/connections/static/connections/ui.js`

### 1. 필드명 변환 함수 추가 (Line 3-64)

**`getDisplayFieldName(internalField)`** (Line 6-31)
- 내부 필드명을 사용자에게 표시할 계층적 이름으로 변환
- 속성 분류 로직:
  1. **BIM.System.*** - Cost Estimator 자체 속성 (id, element_unique_id, classification_tags, geometry_volume)
  2. **BIM.TypeParameters.*** - TypeParameters. 접두어가 있는 것들
  3. **BIM.Attributes.*** - IFC raw_data 직접 속성 (Name, IfcClass, ElementId, Description 등)
  4. **BIM.Parameters.*** - 나머지 모든 속성 (기본값)

**`getInternalFieldName(displayField)`** (Line 34-64)
- 계층적 표시명을 내부 필드명으로 역변환
- 하위 호환성: `BIM.` 접두어가 없는 기존 형식도 처리
- 예시:
  - `BIM.Attributes.Name` → `Name`
  - `BIM.TypeParameters.Pset_sample__owner` → `TypeParameters.Pset_sample__owner`
  - `BIM.Parameters.Category` → `Category`

### 2. `getValueForItem()` 함수 수정 (Line 66-88)

- 표시명과 내부명 모두 처리 가능하도록 개선
- 함수 호출 시 `getInternalFieldName()`을 통해 자동 변환
- 기존 코드와의 호환성 유지

### 3. `populateFieldSelection()` 함수 수정 (Line 127-221)

**필드 체크박스 생성 (Line 173-185)**
```javascript
// 변경 전
`<label><input ... value="${k}"> ${k}</label>`

// 변경 후
const displayName = getDisplayFieldName(k);
`<label><input ... value="${displayName}"> ${displayName}</label>`
```

**그룹핑 드롭다운 옵션 생성 (Line 207-215)**
- 모든 필드를 표시명으로 변환하여 드롭다운에 추가
- 정렬 후 옵션 HTML 생성

### 4. 테이블 렌더링 자동 처리

**`renderRawDataTable()` (Line 285+)**
- `selectedFields` 배열이 이제 표시명을 포함
- 테이블 헤더 (Line 318): `label.textContent = field;` - 자동으로 표시명 사용
- 필터 입력 (Line 323): `input.dataset.field = field;` - 표시명으로 저장
- 데이터 셀 (Line 404): `getValueForItem(item, field)` - 자동 변환하여 값 추출

**`renderClassificationTable()` (Line 458+)**
- 분류 뷰 테이블도 동일하게 자동 처리
- 테이블 헤더, 그룹핑, 데이터 셀 모두 표시명 사용

## 동작 방식

1. **필드 수집 단계**:
   - BIM 데이터에서 내부 필드명 추출 (기존 방식 유지)

2. **UI 표시 단계**:
   - 각 내부 필드명을 `getDisplayFieldName()`으로 변환
   - 체크박스와 드롭다운에 표시명으로 표시
   - 체크박스 value 속성에도 표시명 저장

3. **데이터 접근 단계**:
   - 사용자가 선택한 필드명 (표시명)
   - `getValueForItem(item, field)` 호출
   - 함수 내부에서 `getInternalFieldName()`으로 변환
   - 변환된 내부명으로 실제 데이터 추출

## 하위 호환성

- `getInternalFieldName()` 함수가 `BIM.` 접두어가 없는 기존 형식도 처리
- 이전에 저장된 선택 상태나 필터가 있어도 정상 동작
- 점진적 전환 가능

## 테스트 방법

### IFC 파일 (Blender 모드) 테스트

1. 웹 애플리케이션 열기
2. 헤더에서 "Blender 모드" 선택
3. "산출 - BIM원본데이터" 탭으로 이동
4. Blender에서 IFC 파일 로드 후 데이터 전송
5. 필드 선택 영역 확인:
   - **시스템 필드**: `BIM.System.id`, `BIM.System.element_unique_id`, `BIM.System.classification_tags`, `BIM.System.geometry_volume`
   - **Attributes**: `BIM.Attributes.Name`, `BIM.Attributes.IfcClass`, `BIM.Attributes.Description` 등
   - **Parameters**: `BIM.Parameters.*`
   - **TypeParameters**: `BIM.TypeParameters.*`
6. 필드 체크박스 선택하여 테이블 렌더링
7. 테이블 헤더에 계층적 표시명 확인
8. 필터 및 그룹핑 기능 정상 동작 확인

### Revit 파일 테스트

1. 웹 애플리케이션 열기
2. 헤더에서 "Revit 모드" 선택
3. "산출 - BIM원본데이터" 탭으로 이동
4. Revit에서 데이터 전송
5. 필드 선택 영역 확인:
   - **시스템 필드**: `BIM.System.id`, `BIM.System.element_unique_id`, `BIM.System.classification_tags`, `BIM.System.geometry_volume`
   - **Parameters**: `BIM.Parameters.Category`, `BIM.Parameters.Name`, `BIM.Parameters.Level` 등
   - **TypeParameters**: `BIM.TypeParameters.Fire Rating` 등
6. 필드 체크박스 선택하여 테이블 렌더링
7. 테이블 헤더에 계층적 표시명 확인
8. 필터 및 그룹핑 기능 정상 동작 확인

## Phase 2: 분류할당 룰셋 조건식 속성 드롭다운 업데이트 (2025-01-02 완료)

### 목표
분류할당 룰셋 관리 UI에서 조건식을 작성할 때 사용하는 속성 선택 드롭다운을 계층적 명명 규칙으로 표시

### 문제점
- 기존: 하드코딩된 속성 목록 (Category, Family, Type, Level 등)
- 실제 BIM 데이터에 존재하는 모든 속성을 보여주지 못함
- 계층적 명명 규칙 미적용

### 구현 내용

#### 1. `generateBIMPropertyOptions()` 함수 추가 (ui.js Line 2410-2510)

**목적**: `allRevitData`로부터 모든 BIM 속성을 동적으로 수집하고 계층적 명명 규칙에 따라 그룹화

**알고리즘**:
1. 시스템 속성 수집: `id`, `element_unique_id`, `geometry_volume`, `classification_tags`
2. IFC Attributes 속성 수집: `Name`, `IfcClass`, `ElementId`, `UniqueId`, `Description` 등
3. 인스턴스 Parameters 수집: `raw_data.Parameters.*`
4. 타입 Parameters 수집: `raw_data.TypeParameters.*`
5. 각 카테고리별로 `getDisplayFieldName()`을 사용하여 표시명으로 변환
6. 4개 그룹으로 구조화된 옵션 배열 반환:
   - `BIM 시스템 속성 (Cost Estimator 관리)`
   - `BIM Attributes (IFC 속성)` (IFC 데이터만 해당)
   - `BIM Parameters (인스턴스 속성)`
   - `BIM TypeParameters (타입 속성)`

**특징**:
- 빈 그룹은 자동으로 제외
- 각 그룹 내에서 알파벳 정렬
- 모든 속성명이 계층적 표시명으로 변환 (예: `Category` → `BIM.Parameters.Category`)

#### 2. `renderConditionRowForRE()` 함수 수정 (ui.js Line 2512-2521)

**변경 전**:
```javascript
const propertyOptions = [
    { group: 'RawElement 시스템 속성', options: [
        { value: 'Category', label: 'Category (카테고리)' },
        // ... 하드코딩된 속성들
    ]}
];
```

**변경 후**:
```javascript
const propertyOptions = generateBIMPropertyOptions();
```

### 동작 방식

1. 분류할당 룰셋 관리 화면에서 조건식 행 렌더링 시 호출
2. `generateBIMPropertyOptions()`가 현재 로드된 `allRevitData`를 스캔
3. 모든 고유 속성을 카테고리별로 수집
4. 계층적 명명 규칙 적용하여 그룹화된 드롭다운 옵션 생성
5. 사용자가 속성 선택 시 표시명 (예: `BIM.Parameters.Category`) 저장
6. 조건 평가 시 `getValueForItem()`이 자동으로 표시명을 내부명으로 변환하여 데이터 추출

### 하위 호환성

- 기존에 저장된 룰셋의 조건식이 내부명을 사용하더라도 정상 동작
- `getInternalFieldName()` 함수가 `BIM.` 접두어 없는 형식도 처리
- 새로 작성되는 조건식은 자동으로 계층적 명명 사용

### 테스트 방법

1. 웹 애플리케이션에서 BIM 데이터 로드 (Revit 또는 Blender)
2. "룰셋 관리" → "분류 할당 룰셋 관리" 이동
3. "새 룰셋 추가" 또는 기존 룰셋 편집
4. 조건식 추가 버튼 클릭
5. 속성 선택 드롭다운 확인:
   - `BIM 시스템 속성 (Cost Estimator 관리)` 그룹
   - `BIM Attributes (IFC 속성)` 그룹 (Blender 모드만)
   - `BIM Parameters (인스턴스 속성)` 그룹
   - `BIM TypeParameters (타입 속성)` 그룹
6. 각 그룹에 실제 BIM 데이터의 속성들이 계층적 명명 규칙으로 표시되는지 확인
7. 속성 선택 후 조건식 저장 및 실행 테스트

## 향후 작업 (Phase 3+)

1. **Phase 3**: 속성 매핑 룰셋 표현식에 계층 명명 적용
2. **Phase 4**: 수량산출부재(QM) 테이블 및 룰셋에 `QM.*` 접두어 적용
3. **Phase 5**: 산출항목(CI) 및 액티비티(ACT) 관련 UI 업데이트
4. **Phase 6**: 모든 필터, 정렬, 조건식 평가 로직에 통일된 명명 규칙 적용
5. **Phase 7**: 룰셋 조건식 평가 엔진을 계층적 명명 규칙에 맞게 업데이트

## 참고 사항

- 모든 변경사항은 `/connections/static/connections/ui.js` 파일 하나에만 적용
- 백엔드 데이터 모델이나 API는 변경 없음
- 순수하게 프론트엔드 표시 레이어의 개선
- JavaScript 문법 검증 완료 (node -c 통과)
