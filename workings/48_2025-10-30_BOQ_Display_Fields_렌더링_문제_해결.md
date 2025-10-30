# 48. BOQ 상세견적 Display Fields 렌더링 문제 해결

**날짜:** 2025-10-30
**작업자:** Claude Code (Sonnet 4.5)
**관련 이슈:** BOQ 집계표에서 표시 필드(display fields) 값들이 모두 "-"로 표시되는 문제

## 1. 문제 상황

### 초기 증상
- BOQ 상세견적 집계표에서 표시 필드 선택 후 집계표 생성 시, 모든 display field 값이 "-"로 표시됨
- 그룹핑/구분 컬럼에는 값이 정상 표시되지만, 표시 필드 컬럼들은 모두 비어있음
- 영향받는 필드:
  - 공사코드 관련 필드 (코드, 품명, 규격, 단위, 공정)
  - BIM 원본 객체 속성 (Parameters 내부 값들)
  - 수량산출부재 속성 (properties 내부 값들)
  - 일람부호 속성 (member_mark properties 내부 값들)

### 사용자 요청
1. BOQ 표시 필드 값들이 테이블에 제대로 나타나도록 수정
2. 공사코드의 "카테고리" 필드 표시명을 "공정"으로 변경
3. 표시할 필드 체크박스 초기 상태를 모두 체크 해제로 변경

## 2. 원인 분석 과정

### 2-1. 초기 조사
디버그 로그를 통해 다음을 확인:
```
[DEBUG] 표시 필드: (36) ['quantity_member__raw_element__raw_data__Parameters__EPset_Parametric__Engine', ...]
[DEBUG] Request data: {display_by: Array(36), ...}
```
- 36개의 display fields가 프론트엔드에서 서버로 정상 전송됨

### 2-2. 서버 측 조사

#### 문제 1: JSON 필드 경로 파싱 오류
서버에서 `__raw_data__` 경로를 파싱할 때 문제 발견:
```
[DEBUG] Path navigation failed at part 'Qto_WallBaseQuantities' in key_path ['Parameters', 'Qto_WallBaseQuantities', 'GrossSideArea']
```

**원인 발견:**
```python
# 기존 코드 (잘못된 경로 탐색)
key_path = ['Parameters', 'Qto_WallBaseQuantities', 'GrossSideArea']
current = raw_data['Parameters']  # dict ✓
current = current['Qto_WallBaseQuantities']  # ❌ 없음!

# 실제 데이터 구조
raw_data['Parameters'] = {
    'Qto_WallBaseQuantities__GrossSideArea': 15.1050317167502,  # ← flat한 키!
    'EPset_Parametric__Engine': 'Bonsai.DumbLayer2',
    ...
}
```

`Parameters` dict는 **중첩 구조가 아니라 flat한 키 구조**였음!

#### 수정: get_value_from_path() 함수 개선
```python
# views.py (connections/views.py:1870-1875)
if first_key in ('Parameters', 'TypeParameters') and isinstance(current, dict):
    # 나머지 경로를 '__'로 연결해서 flat key로 사용
    # ['Parameters', 'EPset_Parametric', 'Engine'] → 'EPset_Parametric__Engine'
    flat_key = '__'.join(key_path[1:])
    return current.get(flat_key)
```

**결과:** 서버가 값을 정상 추출하게 됨
```
[DEBUG] ✓ Found value for '...Engine': Bonsai.DumbLayer2
[DEBUG] ✓ Found value for '...Height': 3.0
```

### 2-3. 클라이언트 측 조사

#### 문제 2: 중복 함수 존재
`renderBoqTable()` 함수가 **두 파일에 모두 존재**:
- `ui.js` - 원본 함수
- `boq_detailed_estimation_handlers.js` - 별도 구현

JavaScript 로딩 순서상 `boq_detailed_estimation_handlers.js`의 함수가 사용됨

#### 문제 3: 잘못된 데이터 접근
`boq_detailed_estimation_handlers.js`의 `renderBoqTable()` 함수:
```javascript
// 기존 코드 (잘못된 접근)
finalColumns.forEach((col) => {
    let cellContent = item[col.id];  // ❌ 직접 접근
    ...
});

// 서버가 보낸 실제 데이터 구조
{
  name: "Bonsai.DumbLayer2",
  quantity: 9.6210,
  display_values: {  // ← 여기에 display fields가 있음!
    "quantity_member_raw_element_raw_data_Parameters_EPset_Parametric_Engine": "Bonsai.DumbLayer2",
    "cost_code_category": "골조",
    ...
  }
}
```

#### 수정: display_values에서 값 가져오기
```javascript
// boq_detailed_estimation_handlers.js (lines 1629-1636)
finalColumns.forEach((col) => {
    let cellContent;
    if (col.isDynamic && item.display_values) {
        cellContent = item.display_values[col.id];  // ✓ display_values에서 가져옴
    } else {
        cellContent = item[col.id];
    }
    ...
});
```

## 3. 구현 내용

### 3-1. 서버 측 수정 (views.py)

**파일:** `connections/views.py`

**수정 1: get_value_from_path() 함수 개선 (lines 1852-1889)**
```python
def get_value_from_path(item, path):
    if '__properties__' in path:
        parts = path.split('__properties__')
        base_path, key = parts[0], parts[1]
        prop_dict = item.get(f'{base_path}__properties')
        return prop_dict.get(key) if isinstance(prop_dict, dict) else None

    if '__raw_data__' in path:
        raw_data_dict = item.get('quantity_member__raw_element__raw_data')
        if raw_data_dict is None or not isinstance(raw_data_dict, dict):
            return None

        key_path = path.split('__raw_data__')[1].strip('_').split('__')

        if len(key_path) == 0:
            return None

        first_key = key_path[0]
        current = raw_data_dict.get(first_key)

        # 단일 키 경로 (예: 'Name', 'IfcClass', 'ElementId')
        if len(key_path) == 1:
            return current

        # Parameters나 TypeParameters는 flat한 dict 구조
        if first_key in ('Parameters', 'TypeParameters') and isinstance(current, dict):
            # 나머지 경로를 '__'로 연결해서 키로 사용
            flat_key = '__'.join(key_path[1:])
            return current.get(flat_key)

        # 일반 중첩 dict 구조 (기존 로직)
        if isinstance(current, dict):
            for part in key_path[1:]:
                current = current.get(part) if isinstance(current, dict) else None
                if current is None:
                    break
        else:
            return None

        return current

    return item.get(path)
```

**핵심 개선점:**
- `Parameters`/`TypeParameters` dict의 flat한 키 구조를 올바르게 처리
- 중첩 dict와 flat dict를 모두 지원
- 경로 탐색 실패 시 `None` 반환

### 3-2. 클라이언트 측 수정

**파일 1:** `connections/static/connections/boq_detailed_estimation_handlers.js`

**수정 1: renderBoqTable() - display_values 접근 (lines 1629-1636)**
```javascript
finalColumns.forEach((col) => {
    // 동적 필드는 display_values에서 가져옴
    let cellContent;
    if (col.isDynamic && item.display_values) {
        cellContent = item.display_values[col.id];
    } else {
        cellContent = item[col.id];
    }
    let cellStyle = `text-align: ${col.align || "left"};`;
    ...
});
```

**수정 2: 빈 문자열 처리 추가 (line 1659)**
```javascript
} else if (cellContent === undefined || cellContent === null || cellContent === "") {
    cellContent = "-";
}
```

**수정 3: 체크박스 초기 상태 변경 (lines 1448-1457)**
```javascript
let html = "";
fields.forEach((field) => {
    html += `
        <label style="display: block; margin-bottom: 5px;">
            <input type="checkbox" class="boq-display-field-cb" value="${field.value}">
            ${field.label}
        </label>
    `;
});
```
- `checked` 속성 제거 → 초기 상태 체크 해제

**파일 2:** `connections/static/connections/cost_code_management_handlers.js`

**수정: "카테고리" → "공정" 표시명 변경**
```javascript
// Line 60: 테이블 헤더
<th>공정</th>

// Line 99: 입력 필드 placeholder
<td><input type="text" class="cost-category-input" value="${code.category || ''}" placeholder="공정"></td>
```

**파일 3:** `connections/views.py`

**수정: BOQ 그룹핑 필드 라벨 변경 (line 1704)**
```python
add_field('cost_code__category', '공사코드 - 공정')
```

## 4. 테스트 결과

### 테스트 케이스 1: BIM 원본 속성 표시
- **입력:** Parameters 내부 필드 선택 (EPset_Parametric__Engine, Qto_WallBaseQuantities__Height 등)
- **기대:** 해당 값들이 테이블에 표시
- **결과:** ✅ 성공 - "Bonsai.DumbLayer2", "3.0" 등 정상 표시

### 테스트 케이스 2: 공사코드 필드 표시
- **입력:** cost_code 관련 필드 선택 (코드, 품명, 규격, 단위, 공정)
- **기대:** 공사코드 정보가 테이블에 표시
- **결과:** ✅ 성공 - "3CCAB020", "골조" 등 정상 표시

### 테스트 케이스 3: 다양한 값 처리
- **입력:** 같은 그룹 내 서로 다른 값을 가진 필드
- **기대:** "<다양함>" 표시
- **결과:** ✅ 성공 - 서버에서 VARIOUS_VALUES_SENTINEL 처리 정상 작동

### 테스트 케이스 4: 초기 체크박스 상태
- **입력:** 페이지 로드
- **기대:** 모든 표시 필드 체크박스가 체크 해제 상태
- **결과:** ✅ 성공 - 모두 체크 해제로 표시

## 5. 기술적 세부사항

### 5-1. JSON 경로 파싱 전략

**Blender IFC 데이터 구조:**
```json
{
  "Parameters": {
    "Geometry": {...},
    "EPset_Parametric__Engine": "Bonsai.DumbLayer2",
    "Qto_WallBaseQuantities__GrossSideArea": 15.1050317167502,
    "Qto_WallBaseQuantities__Height": 3.0
  }
}
```

**요청 경로:**
```
quantity_member__raw_element__raw_data__Parameters__EPset_Parametric__Engine
```

**파싱 과정:**
1. `__raw_data__`로 split → `['Parameters', 'EPset_Parametric', 'Engine']`
2. 첫 번째 키 `'Parameters'` 추출
3. `Parameters` dict가 flat 구조인지 확인
4. 나머지 경로를 `__`로 join → `'EPset_Parametric__Engine'`
5. `raw_data['Parameters']['EPset_Parametric__Engine']` 접근

### 5-2. 서버-클라이언트 필드명 변환

**서버 → 클라이언트 변환:**
```python
frontend_key = field.replace('__', '_')
# 'cost_code__category' → 'cost_code_category'
```

**클라이언트에서 사용:**
```javascript
const displayKey = column.id.replace(/__/g, '_');
cellContent = item.display_values[displayKey];
```

**이유:**
- JavaScript 객체 키로 `__`는 허용되지만 가독성을 위해 `_` 사용
- 서버와 클라이언트 간 일관된 변환 규칙 유지

### 5-3. 함수 중복 문제 해결

**문제:**
- `ui.js`와 `boq_detailed_estimation_handlers.js` 모두에 `renderBoqTable()` 존재
- JavaScript 로딩 순서에 따라 후자가 사용됨

**해결 방안 (적용됨):**
- `boq_detailed_estimation_handlers.js`의 `renderBoqTable()` 함수를 수정
- 이 함수가 최종적으로 사용되므로 여기에 display_values 접근 로직 추가

**향후 개선 사항:**
- 함수 이름을 다르게 하여 충돌 방지 (예: `renderBoqTableDD()`)
- 또는 한 곳으로 통합

## 6. 커밋 정보

**변경된 파일:**
1. `connections/views.py` - get_value_from_path() 함수 개선
2. `connections/static/connections/boq_detailed_estimation_handlers.js` - renderBoqTable() 수정, 체크박스 초기 상태 변경
3. `connections/static/connections/cost_code_management_handlers.js` - 카테고리 → 공정 표시명 변경

**커밋 메시지:**
```
Fix BOQ display fields rendering and rename category to 공정

- Fix get_value_from_path() to handle flat dict structure in Parameters/TypeParameters
- Update renderBoqTable() to access display_values correctly for dynamic fields
- Change initial checkbox state to unchecked for display fields
- Rename "카테고리" to "공정" in cost code management UI
```

## 7. 학습 포인트

### 디버깅 프로세스
1. **증상 확인:** 모든 display fields가 "-"로 표시
2. **데이터 흐름 추적:** 프론트엔드 → 서버 → 응답 → 렌더링
3. **각 단계별 검증:**
   - ✓ 프론트엔드에서 서버로 요청 전송 확인
   - ✗ 서버에서 JSON 경로 파싱 실패 발견
   - ✓ 서버 수정 후 정상 추출 확인
   - ✗ 클라이언트에서 잘못된 위치 접근 발견
   - ✓ 클라이언트 수정 후 정상 표시 확인

### JSON 구조 이해의 중요성
- IFC 데이터의 `Parameters` dict가 flat한 구조라는 점을 간과
- 중첩 구조로 가정하고 코드를 작성하여 오류 발생
- 실제 데이터 구조를 로그로 확인하여 문제 해결

### 함수 중복 관리
- 여러 파일에 같은 이름의 함수가 있을 경우 추적 어려움
- 명확한 naming convention과 문서화 필요
- 코드베이스 전체 검색으로 중복 함수 발견

## 8. 향후 개선 사항

1. **코드 구조 개선:**
   - `renderBoqTable()` 함수 통합 또는 이름 변경으로 중복 제거
   - display fields 렌더링 로직을 별도 함수로 분리

2. **타입 체크 강화:**
   - `item.display_values`가 존재하는지 명시적으로 확인
   - TypeScript 도입 검토

3. **에러 처리:**
   - JSON 경로 파싱 실패 시 명확한 에러 메시지
   - 프론트엔드에서 missing data에 대한 사용자 친화적 메시지

4. **성능 최적화:**
   - 대량의 display fields 처리 시 렌더링 성능 모니터링
   - 필요시 가상 스크롤링 도입

## 9. 참고 자료

- Django ORM JSON field traversal: https://docs.djangoproject.com/en/5.0/ref/models/querysets/#json-fields
- IFC data structure documentation: https://standards.buildingsmart.org/IFC/
- JavaScript object property access patterns
