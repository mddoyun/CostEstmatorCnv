# ActivityObject 수동 수량입력 및 산출식 업데이트 기능 완성

**날짜**: 2025-11-05
**작업자**: Claude (AI Assistant)

## 개요
ActivityObject 탭의 수동 수량입력 기능과 산출식 업데이트 기능을 완전히 구현하고, BIM 속성 상속 및 필드 선택 기능을 개선했습니다.

## 주요 수정 사항

### 1. 수동 수량입력 속성 선택 목록 통일
**파일**: `connections/static/connections/activity_object_manager.js`
**위치**: Lines 1362-1374

**문제**: 수동 수량입력 모달의 속성 콤보박스가 필드선택 탭과 다른 속성 목록을 표시

**해결**:
```javascript
// ▼ 수정 전: buildAoContext()로 속성 생성
const sampleContext = buildAoContext(selectedItems[0]);

// ▼ 수정 후: generateAOPropertyOptions()로 통일
const propertyOptionGroups = generateAOPropertyOptions();
propertyOptionGroups.forEach(group => {
    propertyOptions += `<optgroup label="${group.group}">`;
    group.options.forEach(opt => {
        propertyOptions += `<option value="{${opt.value}}">${opt.label}</option>`;
    });
    propertyOptions += '</optgroup>';
});
```

**효과**: 필드선택 탭과 동일한 속성 목록 표시

---

### 2. BIM 속성 Context 생성 수정
**파일**: `connections/static/connections/activity_object_manager.js`
**위치**: Lines 2388-2565

#### 2.1 CostItem 객체 처리
**위치**: Lines 2414-2419

**문제**: `ao.cost_item`이 객체 형태로 들어오는데 문자열로 가정하고 처리

**해결**:
```javascript
// cost_item이 객체인 경우 id 추출, 문자열인 경우 그대로 사용
const costItemId = typeof ao.cost_item === 'object' ? ao.cost_item.id : ao.cost_item;
const ci = window.loadedCostItems?.find(c => c.id === costItemId);
```

#### 2.2 BIM 속성 prefix 통일
**위치**: Lines 2460-2530

**문제**: BIM 속성이 `bim_attr_`, `bim_param_` 등으로 저장되어 UI 표시 형식(`BIM.`)과 불일치

**해결**:
```javascript
// QuantitySet, PropertySet 등 → BIM.{key}
if (key.startsWith('QuantitySet.') || key.startsWith('PropertySet.') ||
    key.startsWith('Type.') || key.startsWith('Spatial_Container.')) {
    context[`BIM.${key}`] = value;
}
// Attributes.xxx → BIM.Attributes.xxx
else if (key.startsWith('Attributes.')) {
    context[`BIM.${key}`] = value;
}
// Parameters.xxx → BIM.Parameters.xxx
else if (key.startsWith('Parameters.')) {
    context[`BIM.${key}`] = value;
}
// System 속성 → BIM.Attributes.xxx
else if (['Name', 'IfcClass', 'ElementId', ...].includes(key)) {
    context[`BIM.Attributes.${key}`] = value;
}
```

**효과**: Context의 키가 UI 표시 형식과 일치하여 산식 평가 정상 작동

---

### 3. 산출식 업데이트 기능 구현
**파일**: `connections/static/connections/activity_object_manager.js`
**위치**: Lines 2574-2649

#### 3.1 산식 저장 위치 수정
**문제**: `ao.manual_formula` 대신 `ao.quantity_expression.formula` 사용

**해결**:
```javascript
// 수정 전
if (!ao.is_manual || !ao.manual_formula) {
    continue;
}
const calculatedQuantity = evaluateQuantityFormula(ao.manual_formula, aoContext);

// 수정 후
if (!ao.quantity_expression || ao.quantity_expression.mode !== 'formula' ||
    !ao.quantity_expression.formula) {
    continue;
}
const calculatedQuantity = evaluateQuantityFormula(ao.quantity_expression.formula, aoContext);
```

#### 3.2 API 호출 수정
**위치**: Lines 2600-2624

**문제**:
1. `ao.activity`가 객체인데 문자열로 전송
2. `cost_item_id` 필드 누락
3. POST 메소드로 생성 시도 (→ "이미 존재" 에러)
4. PATCH 메소드 미지원 (→ 405 에러)

**해결**:
```javascript
// Activity와 CostItem ID 추출
const activityId = typeof ao.activity === 'object' ? ao.activity.id : ao.activity;
const costItemId = typeof ao.cost_item === 'object' ? ao.cost_item.id : ao.cost_item;

const payload = {
    id: ao.id,
    activity_id: activityId,
    cost_item_id: costItemId,  // ← 추가
    quantity: calculatedQuantity,
    actual_duration: calculatedQuantity,
    quantity_expression: ao.quantity_expression
};

// PUT 메소드로 업데이트 (PATCH 대신)
const response = await fetch(
    `/connections/api/activity-objects/${currentProjectId}/${ao.id}/`,  // ← ID 포함
    {
        method: 'PUT',  // ← POST → PUT
        headers: { ... },
        body: JSON.stringify(payload)
    }
);
```

**효과**: BIM 데이터 재로드 후 "산출식 업데이트" 버튼으로 모든 산식 재계산 가능

---

### 4. QM.Properties.* 필드 표시 개선
**파일**: `connections/static/connections/ui.js`
**위치**: Lines 3693-3718

**문제**: `generateQMPropertyOptions()`가 `window.currentQuantityMembers`만 확인하여 다른 탭에서 부재 속성 미표시

**해결**:
```javascript
// 수정 전
if (window.currentQuantityMembers && window.currentQuantityMembers.length > 0) {
    window.currentQuantityMembers.forEach(qm => { ... });
}

// 수정 후
const qmPropertiesSet = new Set();
const qmSources = [window.currentQuantityMembers, window.loadedQuantityMembers];

qmSources.forEach(qmList => {
    if (qmList && qmList.length > 0) {
        qmList.forEach(qm => {
            if (qm.properties && typeof qm.properties === 'object') {
                Object.keys(qm.properties).forEach(key => {
                    qmPropertiesSet.add(key);
                });
            }
        });
    }
});
```

**효과**:
- QuantityMember 탭 필드선택 ✓
- CostItem 탭 필드선택 ✓
- ActivityObject 탭 필드선택 ✓
- 모든 탭에서 QM.Properties.* 속성 표시

---

### 5. Database Migration 추가
**파일**: `connections/migrations/0022_activityobject_quantity_expression.py`

**내용**:
```python
migrations.AddField(
    model_name='activityobject',
    name='quantity_expression',
    field=models.JSONField(
        blank=True,
        default=dict,
        help_text='수동 입력 시 사용한 수량 표현식 (JSON)'
    ),
)
```

**효과**: ActivityObject에 산식 저장 가능

---

## 파일 변경 목록

### 수정된 파일
1. **connections/static/connections/activity_object_manager.js**
   - 수동 수량입력 속성 목록 통일 (Lines 1362-1374)
   - buildAoContext 함수 개선 (Lines 2388-2565)
   - updateAllAoFormulas 함수 구현 (Lines 2574-2649)

2. **connections/static/connections/ui.js**
   - generateQMPropertyOptions 개선 (Lines 3693-3718)

3. **connections/models.py**
   - ActivityObject.quantity_expression 필드 추가 (Line 525)

4. **connections/views.py**
   - ActivityObject API GET에 quantity_expression 추가 (Line 6418)

### 추가된 파일
5. **connections/migrations/0022_activityobject_quantity_expression.py**
   - quantity_expression 필드 마이그레이션

---

## 테스트 결과

### 성공한 기능
✅ 수동 수량입력 모달의 속성 콤보박스에 모든 속성 표시
✅ BIM 속성(QuantitySet 등)을 사용한 산식 계산
✅ 산식 저장 및 불러오기
✅ "산출식 업데이트" 버튼으로 모든 ActivityObject 재계산
✅ QM.Properties.* 필드가 모든 탭 필드선택에 표시

### 해결된 에러
- ❌ Context에 BIM 속성이 없어서 산식 결과가 0으로 계산
  - ✅ BIM. prefix 통일로 해결

- ❌ "Activity를 선택해주세요" 에러
  - ✅ activity_id 필드 추가로 해결

- ❌ "NOT NULL constraint failed: cost_item_id" 에러
  - ✅ cost_item_id 필드 추가로 해결

- ❌ "이미 동일한 ActivityObject가 존재합니다" 에러
  - ✅ POST → PUT, URL에 ID 포함으로 해결

- ❌ 405 Method Not Allowed 에러
  - ✅ PATCH → PUT으로 해결

---

## 향후 개선 사항

1. **디버깅 로그 정리**: 프로덕션 배포 시 console.log 제거 고려
2. **에러 처리 개선**: 더 자세한 에러 메시지 표시
3. **성능 최적화**: 대량 ActivityObject 업데이트 시 배치 처리 고려

---

## 관련 이슈
- ActivityObject 수동 수량입력 기능 구현
- BIM 속성 상속 체계 완성
- 필드 선택 통일

---

## 참고
- 이전 작업: `76_2025-11-05_3D뷰포트_속성_탭_통일_및_상속_체계_완성.md`
- 관련 문서: `CLAUDE.md` (Property Inheritance Chain 섹션)
