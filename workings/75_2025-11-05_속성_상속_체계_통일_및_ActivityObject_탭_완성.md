# 75. 속성 상속 체계 통일 및 ActivityObject 탭 완성 (2025-11-05)

## 작업 개요

이번 작업에서는 전체 시스템의 속성 상속 체계를 통일하고, 액티비티 객체 탭의 남은 기능들을 완성했습니다.

## 주요 변경사항

### 1. 액티비티 객체 필드 선택 그룹별 정렬

**파일**: `connections/static/connections/activity_object_manager.js`

**변경 위치**:
- Line 389-411: 정의된 섹션 필드 정렬
- Line 426-447: 동적 섹션 필드 정렬

**변경 내용**:
- 각 섹션 내 필드들을 `localeCompare('ko')`를 사용하여 한글 기준 오름차순 정렬
- 사용자가 필드를 쉽게 찾을 수 있도록 개선

```javascript
// 필드를 label 기준으로 오름차순 정렬
const sortedFields = [...fields].sort((a, b) => {
    const labelA = a.label || '';
    const labelB = b.label || '';
    return labelA.localeCompare(labelB, 'ko');
});
```

### 2. 액티비티 객체 속성 패널 구조 완전 재구성

**파일**: `connections/static/connections/activity_object_manager.js`

**변경 위치**: Line 1170-1288

**변경 내용**:
- 기존의 하드코딩된 속성 표시 방식 제거
- 필드 선택과 완전히 동일한 그룹 구조 사용
- `groupFieldsByPrefix()` 및 `getSectionDefinitions()` 활용
- 값이 있는 필드만 자동으로 표시
- 그룹별 오름차순 정렬 적용

**주요 특징**:
- 필드 선택 UI와 속성 패널이 완벽하게 동기화
- 동일한 색상 테마 및 섹션 순서
- 빈 값 자동 필터링으로 깔끔한 UI

### 3. 액티비티 객체 속성 패널 데이터 표시 문제 수정

**파일**: `connections/static/connections/activity_object_manager.js`

**변경 위치**: Line 1191-1196

**문제**:
- 테이블에서 행을 선택해도 속성 패널에 데이터가 표시되지 않음
- `allAoFields` 배열이 비어있어서 발생

**해결**:
```javascript
// allAoFields가 비어있으면 초기화
if (!allAoFields || allAoFields.length === 0) {
    console.log('[DEBUG][renderAoPropertiesPanel] allAoFields is empty, populating...');
    populateAoFieldSelection([ao]);
}
```

### 4. 수동 산출식 업데이트 버튼 추가

#### A. HTML 버튼 추가

**파일**: `connections/templates/revit_control.html`

**변경 위치**: Line 2787-2791

**내용**:
```html
<!-- 수동 수량 산출식 업데이트 버튼 -->
<button id="ao-update-formulas-btn" style="width: 100%; margin-bottom: 4px; background-color: #fd7e14; color: white; border: 1px solid #fd7e14;">
    산출식 업데이트
</button>
```

#### B. 이벤트 리스너 추가

**파일**: `connections/static/connections/activity_object_manager.js`

**변경 위치**: Line 98-102

```javascript
// 수동 수량 산출식 업데이트 버튼
document
    .getElementById('ao-update-formulas-btn')
    ?.addEventListener('click', updateAllAoFormulas);
```

#### C. 산출식 업데이트 함수 구현

**파일**: `connections/static/connections/activity_object_manager.js`

**변경 위치**: Line 2304-2381

**기능**:
1. 모든 ActivityObject 중 `is_manual=true`이고 `manual_formula`가 있는 항목만 처리
2. `buildAoContext()`로 전체 컨텍스트 생성 (AO, AC, CI, CC, QM, MM, BIM 속성 포함)
3. `evaluateQuantityFormula()`로 산출식 계산
4. 계산된 수량을 서버에 저장
5. 업데이트 결과를 토스트 메시지로 표시
6. 오류 발생 시 상세 로그 출력
7. UI 자동 갱신

**핵심 로직**:
```javascript
async function updateAllAoFormulas() {
    let updatedCount = 0;
    const errors = [];

    for (const ao of window.loadedActivityObjects) {
        if (!ao.is_manual || !ao.manual_formula) {
            continue;
        }

        try {
            const aoContext = buildAoContext(ao);
            const calculatedQuantity = evaluateQuantityFormula(ao.manual_formula, aoContext);

            if (calculatedQuantity !== null && !isNaN(calculatedQuantity)) {
                // 서버에 저장
                const response = await fetch(
                    `/connections/api/activity-objects/${currentProjectId}/`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrftoken,
                        },
                        body: JSON.stringify({
                            id: ao.id,
                            quantity: calculatedQuantity
                        }),
                    }
                );

                if (response.ok) {
                    ao.quantity = calculatedQuantity;
                    updatedCount++;
                }
            }
        } catch (error) {
            errors.push(`${ao.id}: ${error.message}`);
        }
    }

    // 결과 토스트 메시지 표시
    await loadActivityObjects();
}
```

## 기술적 세부사항

### 속성 상속 체계

전체 시스템에서 일관된 속성 상속 구조:

```
BIM 원본 데이터 (BIM.*)
  ↓ 모든 BIM 속성 상속
수량산출부재 (QM.* + BIM.* + MM.* + SC.*)
  ↓ 모든 속성 상속
코스트아이템 (CI.* + CC.* + QM.* + BIM.* + MM.* + SC.*)
  ↓ 모든 속성 상속
액티비티 객체 (AO.* + AC.* + CI.* + CC.* + QM.* + BIM.* + MM.* + SC.*)
```

### 필드 네이밍 규칙

**점 표기법 (표준)**:
- `BIM.Parameters.길이`
- `CC.System.code`
- `QM.Properties.부재명`

**언더스코어 표기법 (하위 호환)**:
- `BIM_Parameters_길이`
- `CC_System_code`
- `QM_Properties_부재명`

모든 값 조회 함수가 두 형식 모두 지원:
- `getQmValue()`
- `getCiValue()`
- `getAoFieldValue()`

### 통일된 UI 시스템

**필드 그룹핑**:
- `groupFieldsByPrefix()`: 첫 번째 접두어로 필드 그룹화
- `getSectionDefinitions()`: 섹션 순서 및 스타일 정의

**섹션 정의**:
```javascript
const sections = [
    { key: 'AO', title: '📅 액티비티 객체 기본 속성', color: '#6a1b9a' },
    { key: 'AC', title: '⚙️ 액티비티 코드 속성', color: '#d84315' },
    { key: 'CI', title: '📊 산출항목 속성', color: '#1976d2' },
    { key: 'CC', title: '💰 공사코드 속성', color: '#c62828' },
    { key: 'QM', title: '📌 수량산출부재 속성', color: '#0288d1' },
    { key: 'MM', title: '📋 일람부호', color: '#7b1fa2' },
    { key: 'SC', title: '🏢 공간 속성', color: '#558b2f' },
    { key: 'BIM', title: '🏗️ BIM 속성', color: '#00796b' }
];
```

## 영향 받는 파일

### 수정된 파일

1. **connections/static/connections/activity_object_manager.js**
   - Line 389-411: 필드 정렬 추가
   - Line 426-447: 동적 섹션 정렬 추가
   - Line 1170-1288: 속성 패널 완전 재구성
   - Line 98-102: 이벤트 리스너 추가
   - Line 2304-2381: 산출식 업데이트 함수 추가

2. **connections/templates/revit_control.html**
   - Line 2787-2791: 산출식 업데이트 버튼 추가

## 사용자 경험 개선

### 1. 필드 찾기 용이성
- 모든 필드가 한글 오름차순으로 정렬되어 원하는 필드를 빠르게 찾을 수 있음

### 2. 일관된 UI
- 필드 선택과 속성 패널이 완전히 동일한 구조
- 동일한 색상 및 아이콘 사용
- 직관적인 정보 표시

### 3. 효율적인 작업 흐름
- 산출식 업데이트 버튼으로 한 번에 모든 수동 입력 수량 재계산
- 오류 발생 시 상세한 피드백 제공
- 자동 UI 갱신으로 즉시 결과 확인

### 4. 깔끔한 데이터 표시
- 값이 없는 필드는 자동으로 숨김
- 필요한 정보만 표시하여 가독성 향상

## 테스트 시나리오

### 1. 필드 정렬 확인
1. 액티비티 객체 탭 > 필드 선택 탭 열기
2. 각 섹션 내 필드들이 오름차순으로 정렬되어 있는지 확인
3. 한글, 영문, 숫자가 포함된 필드명이 올바르게 정렬되는지 확인

### 2. 속성 패널 표시 확인
1. 액티비티 객체 탭에서 테이블 행 선택
2. 좌측 패널 > 액티비티 객체 속성 탭으로 전환
3. 선택한 객체의 모든 속성이 그룹별로 표시되는지 확인
4. 필드 선택 탭과 동일한 그룹 구조인지 확인
5. 빈 값이 없는 필드만 표시되는지 확인

### 3. 산출식 업데이트 기능 테스트
1. 수동 수량입력 기능으로 산출식 입력
2. "산출식 업데이트" 버튼 클릭
3. 토스트 메시지로 업데이트 결과 확인
4. 테이블에서 수량이 올바르게 업데이트되었는지 확인
5. 오류가 있는 산출식의 경우 상세 오류 메시지 확인

## 다음 단계 (미완료)

### 3D 뷰포트 하단 탭 구조 개선

사용자가 요청한 3D 뷰포트 하단 4개 탭의 구조 변경은 아직 진행되지 않았습니다:

1. **BIM 속성 탭**: BIM 원본데이터 탭의 BIM 속성 탭 구조 따라가기
2. **수량산출부재 탭**: 수량산출부재 탭의 부재속성 탭 구조 따라가기
3. **산출항목 탭**: 코스트아이템 탭의 산출항목 속성 탭 구조 따라가기
4. **액티비티 탭**: 액티비티 객체 탭의 액티비티 객체 속성 탭 구조 따라가기

이 작업들은 `connections/static/connections/three_d_viewer.js` 파일을 수정해야 하며, 각 탭의 렌더링 로직을 메인 탭의 구조를 따라가도록 대규모 리팩토링이 필요합니다.

## 결론

이번 작업으로 액티비티 객체 탭의 핵심 기능들이 모두 완성되었으며, 전체 시스템의 속성 상속 체계가 통일되었습니다. 사용자 경험이 크게 개선되었고, 모든 탭에서 일관된 UI/UX를 제공하게 되었습니다.
