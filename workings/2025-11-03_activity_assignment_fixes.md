# 2025-11-03: Activity Assignment Ruleset 버그 수정 및 UI 개선

## 작업 요약

### 1. Activity Assignment Ruleset 적용 버그 수정

**문제점:**
- 액티비티 할당 룰셋에서 `BIM.Attributes.IfcClass equals "IfcWall"` 조건이 정상적으로 매칭되어야 하지만 `updated_count: 0`으로 할당이 되지 않음
- 데이터베이스에는 `IfcClass: "IfcWall"` 값이 정확히 저장되어 있었지만, 조건 평가 시 실제값이 빈 문자열('')로 나타남

**원인:**
- `evaluate_conditions()` 함수 (views.py:433-447)에서 property 조회 로직 문제
- `get_internal_field_name()` 함수가 `'BIM.Attributes.IfcClass'`를 `'IfcClass'`로 변환
- 하지만 `combined_properties` 딕셔너리에는 `'BIM.Attributes.IfcClass'` 키로 저장됨
- 변환된 키(`'IfcClass'`)로만 조회하여 값을 찾지 못함

**해결책:**
```python
# views.py:438-446 수정
actual_value = None
# 2. 먼저 data_dict에서 원본 표시명 (p)으로 직접 키를 찾아봅니다
if p in data_dict:
    actual_value = data_dict.get(p)
# 3. 원본 키가 없으면 변환된 내부 필드명으로 찾아봅니다
elif internal_field = in data_dict:
    actual_value = data_dict.get(internal_field)
# 4. 둘 다 없으면, 중첩된 구조(raw_data)를 탐색하는 기존 함수를 호출합니다.
else:
    actual_value = get_value_from_element(data_dict, internal_field)
```

**영향을 받는 파일:**
- `connections/views.py` (line 438-446)

---

### 2. 산출-코스트아이템 탭 액티비티 콤보박스 개선

**문제점:**
- 액티비티 관리 탭에서 새 액티비티를 추가해도 산출-코스트아이템 탭의 할당 정보 콤보박스에 즉시 반영되지 않음
- 콤보박스에 액티비티 이름만 표시되어 구분이 어려움

**해결책 1: 코드와 이름 함께 표시**
```javascript
// cost_item_manager.js:1655
option.textContent = `${activity.code} - ${activity.name}`;
```

**해결책 2: 콤보박스 클릭 시 최신 목록 자동 로드**
```javascript
// cost_item_manager.js:110-112
document
    .getElementById('ci-activity-assign-select')
    ?.addEventListener('focus', loadActivitiesForCombobox);

// cost_item_manager.js:1694-1727
async function loadActivitiesForCombobox() {
    if (!currentProjectId) return;

    try {
        const response = await fetch(`/connections/api/activities/${currentProjectId}/`);
        if (!response.ok) {
            console.error('Failed to load activities for combobox');
            return;
        }

        window.loadedActivities = await response.json();

        // 콤보박스 업데이트
        const activitySelect = document.getElementById('ci-activity-assign-select');
        if (!activitySelect) return;

        // 기존 옵션 제거 (첫 번째 "선택하세요" 옵션은 유지)
        while (activitySelect.children.length > 1) {
            activitySelect.removeChild(activitySelect.lastChild);
        }

        // 액티비티 옵션 추가 (코드와 이름 함께 표시)
        window.loadedActivities.forEach(activity => {
            const option = document.createElement('option');
            option.value = activity.id;
            option.textContent = `${activity.code} - ${activity.name}`;
            activitySelect.appendChild(option);
        });

        console.log(`[Cost Item Manager] Loaded ${window.loadedActivities.length} activities for combobox`);
    } catch (error) {
        console.error('Error loading activities for combobox:', error);
    }
}
```

**추가 개선: 자동 업데이트 함수**
```javascript
// cost_item_manager.js:1668-1689
window.updateCiActivitySelect = function() {
    const activitySelect = document.getElementById('ci-activity-assign-select');
    if (!activitySelect || !window.loadedActivities) return;

    // 기존 옵션 제거 (첫 번째 "선택하세요" 옵션은 유지)
    while (activitySelect.children.length > 1) {
        activitySelect.removeChild(activitySelect.lastChild);
    }

    // 액티비티 옵션 추가 (코드와 이름 함께 표시)
    window.loadedActivities.forEach(activity => {
        const option = document.createElement('option');
        option.value = activity.id;
        option.textContent = `${activity.code} - ${activity.name}`;
        activitySelect.appendChild(option);
    });
};

// activity_management_handlers.js:36
// loadActivities() 함수에서 자동 호출
updateCiActivitySelect();
```

**영향을 받는 파일:**
- `connections/static/connections/cost_item_manager.js` (lines 110-112, 1645-1658, 1668-1727)
- `connections/static/connections/activity_management_handlers.js` (line 36)

---

## 테스트 결과

### Activity Assignment Ruleset
- ✅ `BIM.Attributes.IfcClass equals "IfcWall"` 조건이 정상적으로 매칭됨
- ✅ 룰셋 적용 시 `updated_count > 0`으로 액티비티가 할당됨
- ✅ 서버 로그에서 조건 평가 시 실제값이 정확히 표시됨

### 액티비티 콤보박스
- ✅ 액티비티 추가 후 콤보박스 클릭 시 최신 목록이 자동으로 로드됨
- ✅ 콤보박스에 "ACT-001 - 철근배근" 형식으로 코드와 이름이 함께 표시됨
- ✅ 콘솔에 `[Cost Item Manager] Loaded X activities for combobox` 로그 출력

---

## 향후 개선 사항

1. 다른 콤보박스들도 동일한 패턴 적용 검토 (코스트코드, 멤버마크 등)
2. 액티비티 목록 캐싱 최적화 (너무 자주 DB 조회하지 않도록)
3. 로딩 인디케이터 추가 (큰 프로젝트에서 목록 로드 시간이 길 경우)

---

## 관련 이슈

- Activity Assignment Ruleset이 BIM.Attributes 속성을 제대로 인식하지 못하는 문제
- 산출-코스트아이템 탭의 액티비티 콤보박스가 실시간으로 업데이트되지 않는 문제
