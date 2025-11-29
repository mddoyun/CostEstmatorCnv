# BIM 속성 탭과 테이블 데이터 조회 방식 통일

## 날짜
2025-11-29

## 버전
v1.3.1

## 문제 상황

### 증상
- BIM 원본데이터 탭에서 특정 행을 선택했을 때 왼쪽 **BIM 속성 탭**에서 보이는 값과 오른쪽 **테이블**에서 보이는 값이 서로 다름
- 예: `BIM.Attributes.Category`가 BIM 속성 탭에서는 "구조 기둥"으로 표시되지만, 테이블에서는 빈 값으로 표시

### 원인 분석
데이터는 동일하지만 두 곳에서 데이터를 조회하는 방식이 달랐음:

1. **BIM 속성 탭** (`renderBimPropertiesTable` 함수)
   - `raw_data`의 키를 직접 순회
   - `raw_data['Attributes.Category']` 형태로 **평탄화된 키**를 직접 사용
   - ✅ 정상 작동

2. **테이블** (`getValueForItem` 함수)
   - `BIM.Attributes.Category` → `getInternalFieldName()` → `Category`로 변환
   - `raw_data['Category']` 검색 → 존재하지 않음 → 빈 값
   - ❌ 잘못된 동작

### 데이터 구조
```javascript
// raw_data 실제 구조 (평탄화된 키)
raw_data = {
    "Attributes.Category": "구조 기둥",
    "Attributes.Family": "XI_Structural Column_Rectangle",
    "Attributes.FamilyType": "S_TC1_콘크리트_1000 x 1500mm",
    "Attributes.Level": "A1_지상4층 SL",
    // ...
}
```

## 해결 방법

### 1. `getInternalFieldName` 함수 수정 (`ui.js:99`)

**변경 전:**
```javascript
if (displayField.startsWith('BIM.Attributes.')) {
    return displayField.substring(15); // 'BIM.Attributes.' 제거 → 'Category'
}
```

**변경 후:**
```javascript
if (displayField.startsWith('BIM.Attributes.')) {
    return displayField.substring(4); // 'BIM.' 제거 → 'Attributes.Category'
}
```

### 2. `getValueForItem` 함수 수정 (`ui.js:183-191`)

평탄화된 키 검사를 중첩 경로 처리보다 **먼저** 수행하도록 순서 변경:

**변경 전:**
```javascript
if (internalField in item && ...) return ...;

// 중첩 경로 처리 (먼저 실행됨 - 문제!)
if (internalField.includes('.')) {
    // raw_data.Attributes.Category 접근 시도 → 실패
}

// 평탄화된 키 검사 (나중에 실행됨)
if (internalField in raw_data) {
    return raw_data[internalField];
}
```

**변경 후:**
```javascript
if (internalField in item && ...) return ...;

// 평탄화된 키 검사 (먼저 실행 - 수정!)
if (internalField in raw_data) {
    return raw_data[internalField]; // raw_data['Attributes.Category'] 성공!
}

// 중첩 경로 처리 (평탄화된 키가 없는 경우에만)
if (internalField.includes('.')) {
    // 중첩 객체 접근
}
```

## 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `connections/static/connections/ui.js` | `getInternalFieldName`, `getValueForItem` 함수 수정 |
| `installer_allinone.iss` | 버전 1.3.0 → 1.3.1 |

## 이전 세션 수정 (v1.3.0)

v1.3.0에서는 `sync_chunk_of_elements`의 NoneType 오류를 수정:
- `connections/consumers.py`의 `flatten_bim_data` 함수에 None 체크 추가

## 테스트 방법

1. 설치파일 실행: `dist/CostEstimator_AllInOne_v1.3.1_Setup.exe`
2. Revit에서 CostEstimator 실행
3. BIM 원본데이터 탭에서 객체 선택
4. BIM 속성 탭의 `Attributes` 섹션 값 확인
5. 필드선택에서 `BIM.Attributes.Category` 등 체크
6. 테이블에서 동일한 값이 표시되는지 확인

## 버전 히스토리

| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| v1.1.0 | 2024-11-28 | 초기 All-in-One 인스톨러 |
| v1.2.0 | 2024-11-28 | 버그 수정 |
| v1.3.0 | 2024-11-29 | NoneType 오류 수정 |
| v1.3.1 | 2024-11-29 | BIM 속성 탭/테이블 데이터 조회 방식 통일 |

## 관련 함수 흐름

```
필드선택 체크박스 클릭
    ↓
renderDataTable()
    ↓
getValueForItem(item, 'BIM.Attributes.Category')
    ↓
getInternalFieldName('BIM.Attributes.Category')
    → 'Attributes.Category' (수정 후)
    ↓
raw_data['Attributes.Category']
    → '구조 기둥' ✅
```
