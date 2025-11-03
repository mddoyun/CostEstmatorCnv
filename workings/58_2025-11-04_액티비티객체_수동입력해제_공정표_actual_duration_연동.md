# 58. 액티비티 객체 수동입력 해제 및 공정표 actual_duration 연동

**날짜**: 2025-11-04
**작업자**: Claude Code
**관련 이슈**: 액티비티 객체 테이블 행의 "수동입력 해제" 버튼 미작동, 공정표가 AO.actual_duration 미반영

## 문제 상황

1. **수동입력 해제 버튼 미작동**
   - 액티비티 객체 테이블 각 행의 "수동입력 해제" 버튼 클릭 시 오류 발생
   - `clearManualInput()` 함수가 TODO 상태로 구현되지 않음
   - 에러: `ReferenceError: Can't find variable: renderActivityObjects`

2. **공정표 Duration 계산 오류**
   - 공정표가 `AO.actual_duration` 대신 `CostItem` 기반으로 일정 계산
   - 사용자가 수동으로 설정한 `actual_duration` 값이 공정표에 반영되지 않음
   - 동일한 액티비티 코드의 AO들의 duration을 합산하지 않음

## 해결 방법

### 1. clearManualInput() 함수 구현

**파일**: `connections/static/connections/activity_object_manager.js`
**위치**: Lines 1722-1793

```javascript
async function clearManualInput(aoId) {
    console.log('[DEBUG][clearManualInput] Called with aoId:', aoId);

    if (!aoId) {
        showToast('액티비티 객체 ID가 없습니다.', 'error');
        return;
    }

    try {
        // 현재 객체 정보 가져오기
        const ao = window.loadedActivityObjects.find(item => item.id === aoId);
        if (!ao) {
            showToast('액티비티 객체를 찾을 수 없습니다.', 'error');
            return;
        }

        // 자동 계산 값 계산
        const durationPerUnit = ao.activity?.duration_per_unit || 0;
        const ciQuantity = ao.cost_item?.quantity || 0;
        const autoQuantity = durationPerUnit * ciQuantity;

        // 자동 계산 모드로 변경하는 데이터
        const updateData = {
            quantity: autoQuantity,
            actual_duration: autoQuantity,
            is_manual: false,
            manual_formula: '',
            quantity_expression: null
        };

        // API 요청
        const response = await fetch(`/connections/api/activity-objects/${currentProjectId}/${aoId}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[ERROR][clearManualInput] Failed to update:', response.status, errorText);
            showToast('수동입력 해제 실패: ' + response.status, 'error');
            return;
        }

        const updatedAo = await response.json();

        // 전역 데이터 업데이트
        const index = window.loadedActivityObjects.findIndex(item => item.id === aoId);
        if (index !== -1) {
            window.loadedActivityObjects[index] = updatedAo;
        }

        // UI 리프레시 (올바른 함수명 사용)
        await loadActivityObjects();

        showToast('수동입력이 해제되었습니다.', 'success');

    } catch (error) {
        console.error('[ERROR][clearManualInput] Exception:', error);
        showToast('수동입력 해제 중 오류 발생', 'error');
    }
}
```

**핵심 수정사항**:
- TODO 플레이스홀더를 완전한 구현으로 대체
- `renderActivityObjects()` → `loadActivityObjects()` (올바른 함수명 사용)
- 단일 AO를 자동 계산 모드로 전환
- `quantity`와 `actual_duration` 모두 업데이트

### 2. 공정표가 AO.actual_duration 사용하도록 수정

**파일**: `connections/static/connections/gantt_chart_handlers.js`

#### 2.1 함수 호출 시 activityObjects 전달

**위치**: Line 209

```javascript
// 간트차트 데이터 생성
ganttData = generateGanttData(itemsWithActivities, activities, dependencies, activityObjects);
```

#### 2.2 generateGanttData() 함수 수정

**위치**: Lines 232-284

**함수 시그니처 변경**:
```javascript
function generateGanttData(costItems, activities, dependencies, activityObjects) {
```

**Duration 계산 로직 변경**:
```javascript
// ▼▼▼ ActivityObject의 actual_duration을 사용하여 액티비티별 duration 합산 ▼▼▼
if (activityObjects && activityObjects.length > 0) {
    // ActivityObject를 사용하여 duration 계산
    activityObjects.forEach(ao => {
        if (!ao.activity || !ao.activity.id) return;

        const activityId = ao.activity.id;
        const activity = activityMap.get(activityId);
        if (!activity) return;

        // AO.actual_duration 사용 (없으면 자동 계산 값 사용)
        const durationDays = Math.max(
            1,
            Math.ceil(parseFloat(ao.actual_duration) ||
                (parseFloat(activity.duration_per_unit || 0) * parseFloat(ao.quantity || 0)))
        );

        // 같은 activityId의 duration을 누적
        if (!activityDurationMap.has(activityId)) {
            activityDurationMap.set(activityId, 0);
        }
        activityDurationMap.set(activityId, activityDurationMap.get(activityId) + durationDays);
    });
} else {
    // Fallback: ActivityObject가 없으면 기존 방식 (CostItem 기반) 사용
    costItems.forEach(item => {
        // ... 기존 로직 유지
    });
}
```

## 기술적 세부사항

### clearManualInput() 함수의 동작

1. **입력 검증**: aoId 유효성 확인
2. **데이터 조회**: `window.loadedActivityObjects`에서 해당 AO 찾기
3. **자동 값 계산**: `duration_per_unit × cost_item.quantity`
4. **API 업데이트**: PUT 요청으로 서버 업데이트
5. **로컬 데이터 동기화**: 전역 배열 업데이트
6. **UI 갱신**: `loadActivityObjects()` 호출로 테이블 재렌더링

### Gantt Chart Duration 계산 개선

**이전 방식**:
- CostItem 기반: `duration_per_unit × cost_item.quantity`
- 수동 설정한 `actual_duration` 무시

**개선된 방식**:
- ActivityObject 기반: `ao.actual_duration` 우선 사용
- 값이 없으면 자동 계산값으로 fallback
- 동일 액티비티 코드의 모든 AO의 `actual_duration` 합산
- 공정표 태스크 duration에 정확히 반영

### Fallback 로직

ActivityObject 데이터가 없는 경우:
- 기존 CostItem 기반 계산으로 자동 전환
- 하위 호환성 보장

## 테스트 시나리오

1. **수동입력 해제 버튼 테스트**:
   - 수동 수량이 설정된 AO 행에서 "수동입력 해제" 버튼 클릭
   - ✅ 자동 계산 값으로 복원됨
   - ✅ `is_manual: false`로 변경됨
   - ✅ 테이블이 정상적으로 갱신됨

2. **공정표 Duration 테스트**:
   - 수동으로 `actual_duration` 설정 (예: 직접입력 44, 산식입력 72)
   - 결과-공정계획 탭에서 공정표 확인
   - ✅ 설정한 `actual_duration` 값이 공정표에 반영됨
   - ✅ 같은 액티비티 코드의 여러 AO들의 duration이 합산됨

## 영향 범위

- ✅ 액티비티 객체 테이블의 개별 행 "수동입력 해제" 버튼
- ✅ 공정표(Gantt Chart) duration 계산 로직
- ✅ 수동 수량 입력 기능과의 연동
- ✅ 액티비티별 일정 자동 계산

## 추가 개선 사항

### 컨트롤 패널의 일괄 해제 버튼

기존에 추가된 컨트롤 패널의 "수동입력 해제" 버튼 (`resetManualAoInput()`)도 정상 작동:
- 선택된 여러 AO를 한 번에 자동 계산 모드로 전환
- 개별 행 버튼과 동일한 로직 사용

## 관련 파일

- `connections/static/connections/activity_object_manager.js` (1722-1793)
- `connections/static/connections/gantt_chart_handlers.js` (209, 232-284)

## 다음 단계 제안

1. ~~수동 시작일 설정 기능 구현~~ (사용자 요청으로 보류)
2. 공정표에서 AO별 상세 정보 표시 개선
3. Duration 수정 시 실시간 공정표 업데이트
