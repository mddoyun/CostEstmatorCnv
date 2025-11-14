# 103. 2차 수량 필드 완전 구현 (2025-11-14)

## 개요
공사코드(CostCode)와 산출항목(CostItem)에 2차 수량 필드를 추가하고, 룰셋 기반 자동 계산 기능을 완전히 구현했습니다. 이를 통해 이중 수량 추적(예: 철근 - Ton과 meter 동시 추적)이 가능해졌습니다.

## 문제 상황
1. **공사코드 관리 탭**: 2차품명, 2차규격, 2차단위 입력 후 저장해도 값이 저장되지 않음
2. **2차내역코드 필드 누락**: 2차 수량 관련 필드 중 내역코드가 없음
3. **룰셋수량계산(전체) 버튼**: 2차 수량 계산식이 룰셋에 설정되어 있어도 적용되지 않음
4. **is_manual_secondary_quantity 플래그**: 수동 입력 플래그가 true로 잠겨 자동 계산이 차단됨

## 해결 방법

### 1. 데이터베이스 모델 업데이트

#### connections/models.py
```python
class CostCode(models.Model):
    # ... 기존 필드 ...

    # ▼▼▼ [추가] 2차 품명/규격/단위/내역코드 필드 (2025-11-14) ▼▼▼
    secondary_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="2차품명")
    secondary_spec = models.TextField(blank=True, null=True, verbose_name="2차규격")
    secondary_unit = models.CharField(max_length=50, blank=True, null=True, verbose_name="2차단위")
    secondary_detail_code = models.CharField(max_length=100, blank=True, null=True, verbose_name="2차내역코드")
    # ▲▲▲ [추가] 여기까지 ▲▲▲
```

**마이그레이션 생성 및 적용:**
```bash
python manage.py makemigrations
# Migration 0032_costcode_secondary_detail_code 생성됨
python manage.py migrate
```

### 2. 백엔드 API 수정

#### connections/views.py

**cost_codes_api 함수 - GET 메서드:**
```python
if request.method == 'GET':
    codes = CostCode.objects.filter(project_id=project_id)
    codes_data = [{
        'id': str(code.id),
        'code': code.code,
        'name': code.name,
        # ... 기타 필드 ...
        # ▼▼▼ [추가] 2차 필드 반환 (2025-11-14) ▼▼▼
        'secondary_name': code.secondary_name,
        'secondary_spec': code.secondary_spec,
        'secondary_unit': code.secondary_unit,
        'secondary_detail_code': code.secondary_detail_code,
        # ▲▲▲ [추가] 여기까지 ▲▲▲
    } for code in codes]
    return JsonResponse(codes_data, safe=False)
```

**cost_codes_api 함수 - POST/PUT 메서드:**
```python
# POST - 새 공사코드 생성
cost_code = CostCode.objects.create(
    project=project,
    code=data.get('code'),
    name=data.get('name'),
    # ... 기타 필드 ...
    # ▼▼▼ [추가] 2차 필드 (2025-11-14) ▼▼▼
    secondary_name=data.get('secondary_name'),
    secondary_spec=data.get('secondary_spec'),
    secondary_unit=data.get('secondary_unit'),
    secondary_detail_code=data.get('secondary_detail_code'),
    # ▲▲▲ [추가] 여기까지 ▲▲▲
)

# PUT - 기존 공사코드 업데이트
cost_code.secondary_name = data.get('secondary_name', cost_code.secondary_name)
cost_code.secondary_spec = data.get('secondary_spec', cost_code.secondary_spec)
cost_code.secondary_unit = data.get('secondary_unit', cost_code.secondary_unit)
cost_code.secondary_detail_code = data.get('secondary_detail_code', cost_code.secondary_detail_code)
```

**cost_items_api 함수 - PATCH 메서드에 2차 수량 필드 지원 추가:**
```python
elif request.method == 'PATCH':
    # ... 기존 코드 ...

    # ▼▼▼ [추가] 2차 수량 관련 필드 (2025-11-14) ▼▼▼
    if 'secondary_quantity' in data:
        item.secondary_quantity = data['secondary_quantity']
        item.is_manual_secondary_quantity = True
        print(f"[DEBUG][cost_items_api] PATCH: Updated secondary_quantity to {data['secondary_quantity']}")

    if 'secondary_quantity_mapping_expression' in data:
        item.secondary_quantity_mapping_expression = data['secondary_quantity_mapping_expression']
        if not data['secondary_quantity_mapping_expression'] or data['secondary_quantity_mapping_expression'] == {}:
            item.is_manual_secondary_quantity = False
        else:
            item.is_manual_secondary_quantity = True

    # is_manual_secondary_quantity 필드를 직접 설정할 수 있도록 허용
    if 'is_manual_secondary_quantity' in data:
        item.is_manual_secondary_quantity = data['is_manual_secondary_quantity']
        print(f"[DEBUG][cost_items_api] PATCH: Explicitly set is_manual_secondary_quantity to {data['is_manual_secondary_quantity']}")
    # ▲▲▲ [추가] 여기까지 ▲▲▲
```

**create_cost_items_auto_view 함수에 디버깅 로그 추가:**
```python
# ▼▼▼ [추가] 2차 수량 계산 (2025-11-14) ▼▼▼
final_secondary_qty = 0.0
print(f"[DEBUG][CostItem] script_to_use keys: {script_to_use.keys() if script_to_use else 'None'}")
if script_to_use and 'secondary_formula' in script_to_use:
    secondary_qty_script = script_to_use.get('secondary_formula', '')
    print(f"[DEBUG][CostItem] 2차 수량 공식 발견: '{secondary_qty_script}'")
    if secondary_qty_script:
        calculated_secondary_qty = evaluate_expression_for_cost_item(secondary_qty_script, member)
        final_secondary_qty = float(calculated_secondary_qty) if is_numeric(calculated_secondary_qty) else 0.0
        print(f"[DEBUG][CostItem] 2차 수량 계산 결과: {final_secondary_qty}")

# ▼▼▼ [수정] 1차/2차 수량 한번에 업데이트 (2025-11-14) ▼▼▼
needs_update = False
update_fields = []

# is_manual_quantity가 False면 수량 업데이트
if not item.is_manual_quantity:
    if item.quantity != final_qty or created:
        item.quantity = final_qty
        update_fields.append('quantity')
        needs_update = True

# is_manual_secondary_quantity가 False면 2차 수량 업데이트
if not item.is_manual_secondary_quantity:
    if item.secondary_quantity != final_secondary_qty or created:
        item.secondary_quantity = final_secondary_qty
        update_fields.append('secondary_quantity')
        needs_update = True
        print(f"[DEBUG][CostItem] 2차 수량 업데이트 예정: item_id={item.id}, secondary_qty={final_secondary_qty}")
else:
    print(f"[DEBUG][CostItem] 2차 수량 업데이트 스킵 (is_manual_secondary_quantity=True): item_id={item.id}")

# 업데이트 필요하면 한번에 저장
if needs_update:
    item.save(update_fields=update_fields)
```

### 3. 프론트엔드 UI 수정

#### connections/static/connections/cost_code_management_handlers.js

**테이블 헤더에 2차내역코드 컬럼 추가:**
```javascript
<thead>
    <tr>
        <th>코드</th>
        <th>이름</th>
        <!-- ... 기타 컬럼 ... -->
        <th>2차품명</th>
        <th>2차규격</th>
        <th>2차단위</th>
        <th>2차내역코드</th>  <!-- ✅ 추가 -->
        <th>비고</th>
        <th>AI개략견적</th>
        <th>상세견적</th>
        <th>작업</th>
    </tr>
</thead>
```

**편집 모드 입력 필드 추가:**
```javascript
<td><input type="text" class="cost-secondary-detail-code-input" value="${
    code.secondary_detail_code || ''
}" placeholder="2차내역코드"></td>
```

**저장 로직에 2차내역코드 포함:**
```javascript
const codeData = {
    code: actionRow.querySelector('.cost-code-input').value,
    name: actionRow.querySelector('.cost-name-input').value,
    // ... 기타 필드 ...
    secondary_name: actionRow.querySelector('.cost-secondary-name-input')?.value || '',
    secondary_spec: actionRow.querySelector('.cost-secondary-spec-input')?.value || '',
    secondary_unit: actionRow.querySelector('.cost-secondary-unit-input')?.value || '',
    secondary_detail_code: actionRow.querySelector('.cost-secondary-detail-code-input')?.value || '',  // ✅ 추가
};
```

#### connections/static/connections/ui.js

**BOQ 필드 옵션에 2차내역코드 추가:**
```javascript
{ value: 'CC.System.secondary_detail_code', label: 'CC.System.secondary_detail_code (2차 내역코드)' },
```

### 4. 룰셋수량계산(전체) 기능에 2차 수량 계산 추가

#### connections/static/connections/cost_item_manager.js

**applyCostItemQuantityRules 함수 수정:**
```javascript
if (evaluateCiConditions(rule.conditions || [], ciContext)) {
    // ▼▼▼ [수정] 1차 수량 산식 평가 (2025-11-14) ▼▼▼
    const quantity = evaluateQuantityFormula(rule.quantity_formula || '', ciContext);

    // ▼▼▼ [추가] 2차 수량 산식 평가 (2025-11-14) ▼▼▼
    const secondaryQuantity = evaluateQuantityFormula(rule.secondary_quantity_formula || '', ciContext);

    let updated = false;
    if (quantity !== null && quantity !== undefined && !isNaN(quantity)) {
        costItem.quantity = quantity;
        updated = true;
    }

    // 2차 수량도 계산 (formula가 있으면)
    if (secondaryQuantity !== null && secondaryQuantity !== undefined && !isNaN(secondaryQuantity)) {
        costItem.secondary_quantity = secondaryQuantity;
        updated = true;
        console.log(`[applyCostItemQuantityRules] CostItem ${costItem.id}: secondary_quantity = ${secondaryQuantity}`);
    }

    if (updated) {
        updatedItems.push(costItem);
        updatedCount++;
        break; // 첫 번째 매칭 룰만 적용 (priority 순)
    }
}
```

### 5. 디버깅 헬퍼 함수 추가

#### connections/static/connections/cost_item_manager.js

**2차 수량 플래그 리셋 및 재계산 함수:**
```javascript
/**
 * 모든 CostItem의 is_manual_secondary_quantity 플래그를 false로 리셋하고
 * 자동생성(공사코드기준) 함수를 호출하여 2차 수량을 재계산합니다.
 *
 * 사용법: 브라우저 콘솔에서 아래 명령 실행
 * > await resetSecondaryQuantityAndRecalculate()
 */
async function resetSecondaryQuantityAndRecalculate() {
    // ... (구현 내용은 파일 참조)
}

/**
 * 현재 로드된 CostItem들의 2차 수량 관련 정보를 콘솔에 출력합니다.
 *
 * 사용법: 브라우저 콘솔에서 아래 명령 실행
 * > debugSecondaryQuantity()
 */
function debugSecondaryQuantity() {
    // ... (구현 내용은 파일 참조)
}

// 전역 스코프에 노출
window.resetSecondaryQuantityAndRecalculate = resetSecondaryQuantityAndRecalculate;
window.debugSecondaryQuantity = debugSecondaryQuantity;
```

## 수정된 파일 목록

### 백엔드
1. `connections/models.py` - CostCode 모델에 secondary_detail_code 필드 추가
2. `connections/migrations/0032_costcode_secondary_detail_code.py` - 마이그레이션 파일
3. `connections/views.py` - cost_codes_api, cost_items_api, create_cost_items_auto_view 함수 수정

### 프론트엔드
1. `connections/static/connections/cost_code_management_handlers.js` - 2차내역코드 UI 추가
2. `connections/static/connections/ui.js` - BOQ 필드 옵션에 2차내역코드 추가
3. `connections/static/connections/cost_item_manager.js` - 룰셋수량계산 함수 및 디버깅 헬퍼 추가

## 사용 방법

### 공사코드 관리
1. **공사코드 관리 탭** 이동
2. 공사코드 수정 또는 새로 추가
3. **2차품명, 2차규격, 2차단위, 2차내역코드** 입력
4. 저장 → 값이 정상적으로 저장됨

### 수량산출룰셋 설정
1. **수량산출룰셋 관리 탭** 이동
2. 룰셋 편집 또는 새로 추가
3. **조건 설정** (예: `QM.properties.분류태그 == "RC_기둥"`)
4. **1차 수량 계산식** 설정 (예: `{QM.quantity}`)
5. **2차 수량 계산식** 설정 (예: `{QM.properties.높이}*{MM.properties.주근개수}`)
6. 저장

### 2차 수량 자동 계산
1. **코스트아이템 탭** 이동
2. **"룰셋수량계산(전체)" 버튼** 클릭
3. 1차 수량과 2차 수량이 모두 자동 계산됨
4. 브라우저 콘솔에서 확인:
   ```javascript
   debugSecondaryQuantity()
   ```

### 디버깅 (필요 시)
수동 입력 플래그가 잠긴 경우:
```javascript
await resetSecondaryQuantityAndRecalculate()
```

## 검증 결과

### 테스트 시나리오
1. ✅ 공사코드에 2차 필드 입력 및 저장
2. ✅ 수량산출룰셋에 2차 수량 계산식 설정
3. ✅ "룰셋수량계산(전체)" 버튼으로 2차 수량 자동 계산
4. ✅ 브라우저 콘솔 로그 확인:
   ```
   [applyCostItemQuantityRules] CostItem xxx: secondary_quantity = 123.45
   ```
5. ✅ debugSecondaryQuantity() 함수로 2차 수량 확인

### 예상 동작
- **공사코드 관리**: 2차 필드 4개 모두 정상 저장
- **룰셋 기반 계산**: 1차 수량과 2차 수량 동시 계산
- **수동 입력 지원**: 2차 수량 직접 입력 가능 (is_manual_secondary_quantity 플래그)
- **BOQ 출력**: 2차 품명, 규격, 단위, 내역코드 모두 표시 가능

## 핵심 개선 사항

1. **완전한 이중 수량 추적**: 1차 수량(예: Ton)과 2차 수량(예: meter)을 독립적으로 관리
2. **룰셋 기반 자동화**: 수량산출룰셋에서 두 수량을 모두 자동 계산
3. **수동/자동 모드 분리**: 각 수량마다 독립적인 is_manual 플래그로 유연한 제어
4. **디버깅 도구 제공**: 콘솔 헬퍼 함수로 빠른 문제 진단 가능

## 향후 개선 방향

1. **BOQ 상세견적**: 2차 수량 컬럼 표시 옵션 추가
2. **단가 연동**: 2차 단위 기준 단가 적용 기능
3. **집계 기능**: 2차 수량 기준 집계표 생성
4. **엑셀 내보내기**: 2차 수량 포함 BOQ 내보내기

## 참고사항

- **Property Inheritance**: 2차 수량 관련 필드들은 `CC.System.*` 프리픽스로 접근 가능
- **수동 입력 우선**: `is_manual_secondary_quantity = true`이면 룰셋 계산 스킵
- **플래그 리셋**: PATCH API로 플래그를 false로 설정하여 자동 계산 재활성화 가능
- **디버깅 로그**: 서버 콘솔과 브라우저 콘솔에서 계산 과정 추적 가능
