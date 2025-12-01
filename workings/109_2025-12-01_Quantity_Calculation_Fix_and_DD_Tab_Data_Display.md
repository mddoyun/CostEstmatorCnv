# 109. 수량 계산 버그 수정 및 상세견적 탭 데이터 표시 문제 해결

**날짜**: 2025-12-01

## 요약

수량 계산 시 속성명에 포함된 괄호가 잘못 제거되어 수량이 0으로 계산되는 버그와, 상세견적(DD)/개산견적(SD) 탭에서 데이터가 표시되지 않는 문제를 해결했습니다.

---

## 1. 수량 계산 버그 수정

### 문제 상황
- "룰셋수량계산(전체)" 버튼 클릭 시 모든 수량이 0으로 계산됨
- 룰셋 조건은 정상적으로 매칭되지만 수량 계산 결과가 0

### 원인 분석
속성명에 포함된 괄호 (예: `폭(m)`, `깊이(m)`, `높이(m)`)가 설명용 괄호와 구분 없이 제거됨

**문제 코드** (`evaluateQuantityFormula` 함수):
```javascript
// 모든 괄호를 제거 (버그)
if (propertyPath.includes('(')) {
    propertyPath = propertyPath.split('(')[0].trim();
}
```

**예시**:
- 수식: `{MM.properties.폭(m)}`
- 기대 context 키: `mm_prop_폭(m)`
- 실제 변환: `mm_prop_폭` (괄호 제거됨)
- 결과: 키 lookup 실패 → 0 반환

### 해결 방법
설명용 괄호 (공백 + 괄호)만 제거하도록 수정

**수정 코드**:
```javascript
// 설명 부분만 제거 (예: "QM.volume (부재 체적)" -> "QM.volume")
// 속성명의 괄호는 유지 (예: "MM.properties.폭(m)" -> "MM.properties.폭(m)")
if (propertyPath.includes(' (')) {
    propertyPath = propertyPath.split(' (')[0].trim();
}
```

### 수정 파일
1. **`cost_item_manager.js`** (라인 2115-2120)
2. **`activity_object_manager.js`** (라인 2291-2296)
   - 동일 함수가 두 파일에 정의되어 있고, HTML 로드 순서상 `activity_object_manager.js`의 함수가 사용됨

---

## 2. 상세견적/개산견적 탭 데이터 미표시 문제

### 문제 상황
- CostItem을 생성한 후 상세견적(DD) 탭으로 이동해도 "표시할 데이터가 없습니다" 표시
- 개산견적(SD) 탭도 동일 증상

### 원인 분석 1: 데이터 로딩 Race Condition
`navigation.js`에서 탭 전환 시 비동기 함수들이 await 없이 동시 호출됨

```javascript
// 문제 코드 (병렬 실행, 완료 대기 없음)
loadCostItems();
loadQuantityMembers();
loadMemberMarks();
loadUnitPriceTypes();
loadBoqGroupingFields();  // 위 함수들 완료 전에 실행됨!
```

`loadBoqGroupingFields()`는 `generateCIPropertyOptions()`를 호출하는데, 이 함수는 `window.loadedCostItems` 등의 데이터가 필요함. 데이터 로딩 전에 실행되면 빈 필드 목록 생성.

### 해결 방법 1: 순차 로딩
**수정 파일**: `navigation.js` (라인 547-596)

```javascript
case 'detailed-estimation-dd':
    (async () => {
        try {
            // 1. 필수 데이터 병렬 로드 (await으로 완료 대기)
            await Promise.all([
                loadCostItems(),
                loadQuantityMembers(),
                loadMemberMarks(),
                loadUnitPriceTypes()
            ]);

            // 2. UI 초기화
            initializeBoqUI();

            // 3. 데이터 로드 완료 후 그룹핑 필드 로드
            await loadBoqGroupingFields();

            // 4. 자동으로 집계표 생성
            if (typeof window.generateBoqReport === 'function') {
                window.generateBoqReport();
            }
        } catch (error) {
            console.error('[ERROR] Failed to load DD tab data:', error);
        }
    })();
    break;
```

### 원인 분석 2: CostCode dd_enabled 기본값
상세견적(DD) 탭은 `cost_code.dd_enabled=True`인 CostItem만 표시
개산견적(SD) 탭은 `cost_code.ai_sd_enabled=True`인 CostItem만 표시

하지만 CostCode 생성 시 기본값이 `False`로 설정되어 있어서 새로 생성된 CostCode는 SD/DD 탭에 표시되지 않음

### 해결 방법 2: 기본값 True로 변경

**수정 파일 1**: `models.py` (라인 69-72)
```python
# 기본값을 True로 변경
ai_sd_enabled = models.BooleanField(default=True, verbose_name="개산견적(SD) 사용")
dd_enabled = models.BooleanField(default=True, verbose_name="상세견적(DD) 사용")
```

**수정 파일 2**: `views.py` (라인 835-838)
```python
# CostCode 생성 API 기본값 변경
ai_sd = bool(data.get('ai_sd_enabled', True))
dd = bool(data.get('dd_enabled', True))
```

---

## 수정된 파일 목록

| 파일 | 수정 내용 |
|------|----------|
| `connections/static/connections/cost_item_manager.js` | 괄호 제거 로직 수정 (라인 2115-2120) |
| `connections/static/connections/activity_object_manager.js` | 괄호 제거 로직 수정 (라인 2291-2296) |
| `connections/static/connections/navigation.js` | DD 탭 데이터 로딩 순서 수정 (라인 547-596) |
| `connections/models.py` | CostCode 필드 기본값 True로 변경 (라인 69-72) |
| `connections/views.py` | CostCode 생성 API 기본값 True로 변경 (라인 835-838) |

---

## 테스트 방법

1. 브라우저 새로고침 (Ctrl+Shift+R)
2. 프로젝트 선택
3. BIM 데이터 로드
4. 분류룰셋 적용 → QuantityMember 생성
5. 산출코드 룰셋 적용 → CostItem 생성
6. "룰셋수량계산(전체)" 버튼 클릭 → 수량이 정상 계산되는지 확인
7. 상세견적(DD) 탭 이동 → 데이터가 표시되는지 확인
8. 개산견적(SD) 탭 이동 → 데이터가 표시되는지 확인

---

## 참고: 속성명 작성 가이드라인

수량 계산 수식에서 속성명을 참조할 때 주의사항:

1. **괄호가 포함된 속성명 사용 가능**
   - `{MM.properties.폭(m)}` ✓
   - `{QM.properties.높이(m)}` ✓

2. **설명용 괄호는 자동 제거됨**
   - `{QM.volume (부재 체적)}` → `QM.volume`으로 변환

3. **지원되는 속성 접두어**
   - `QM.System.*`, `QM.Properties.*` - QuantityMember 속성
   - `MM.System.*`, `MM.Properties.*` - MemberMark 속성
   - `BIM.*` - RawElement BIM 데이터
   - `CI.*` - CostItem 속성

4. **대소문자 주의**
   - 속성명은 대소문자를 구분함
   - 데이터에 저장된 정확한 속성명 사용 필요
