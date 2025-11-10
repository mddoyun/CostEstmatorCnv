# BOQ 집계표 CostCode 필드 매핑 오류 수정

**Date:** 2025-11-10
**Summary:** 상세견적(DD) BOQ 집계표에서 CostCode 관련 속성 값이 제대로 로드되지 않는 문제 해결

---

## 문제 상황

### 증상
- 상세견적(DD) 탭 진입 시 500 Internal Server Error 발생
- BOQ 테이블 그룹핑에서 CostCode 필드 선택 시 값이 표시되지 않음
- 브라우저 콘솔 에러: `Failed to load resource: the server responded with a status of 500`

### 에러 로그
```
[Error] Failed to load resource: the server responded with a status of 500 (Internal Server Error)
[Error] [ERROR][SD BOQ] Failed to generate SD BOQ report: – SyntaxError: The string did not match the expected pattern.
```

---

## 원인 분석

### 1. Frontend (ui.js) - 필드 정의 불일치

**파일:** `connections/static/connections/ui.js`
**함수:** `generateCIPropertyOptions()` (라인 3815-3853)

**문제:**
- CostCode 모델의 실제 필드명과 UI에서 정의한 필드명이 불일치
- 누락된 필드 다수 존재

**잘못된 코드:**
```javascript
const ccFields = [
    { value: 'CC.System.id', label: 'CC.System.id' },
    { value: 'CC.System.code', label: 'CC.System.code' },
    { value: 'CC.System.name', label: 'CC.System.name' },
    { value: 'CC.System.detail_code', label: 'CC.System.detail_code' },
    { value: 'CC.System.note', label: 'CC.System.note' },
    { value: 'CC.System.unit', label: 'CC.System.unit' },
    { value: 'CC.System.is_sd_enabled', label: 'CC.System.is_sd_enabled' }  // ❌ 잘못된 필드명
];
```

**누락된 필드:**
- `CC.System.description`
- `CC.System.product_name`
- `CC.System.spec`
- `CC.System.category`
- `CC.System.dd_enabled`

**잘못된 필드명:**
- `is_sd_enabled` → 실제 모델: `ai_sd_enabled`

### 2. Backend (views.py) - Django ORM 필드명 오류

**파일:** `connections/views.py`
**함수:** `generate_boq_report_api()` (라인 2713-3134)

**문제 1: direct_fields 정의 (라인 2763-2769)**
```python
direct_fields = {
    'id', 'quantity', 'cost_code_id', 'unit_price_type_id', 'quantity_member_id',
    # CostCode 모든 필드 추가 (그룹핑 및 표시용)
    'cost_code__code', 'cost_code__name', 'cost_code__description', 'cost_code__detail_code',
    'cost_code__work_type',        # ❌ 존재하지 않는 필드
    'cost_code__item_name',        # ❌ 존재하지 않는 필드
    'cost_code__specification',    # ❌ 존재하지 않는 필드
    'cost_code__unit', 'cost_code__note', 'cost_code__ai_sd_enabled', 'cost_code__dd_enabled'
}
```

**문제 2: processed_item 할당 (라인 2897-2908)**
```python
processed_item['cost_code_work_type'] = db_item.get('cost_code__work_type')          # ❌
processed_item['cost_code_item_name'] = db_item.get('cost_code__item_name')          # ❌
processed_item['cost_code_specification'] = db_item.get('cost_code__specification')  # ❌
```

### 3. CostCode 모델 실제 필드 (참고)

**파일:** `connections/models.py` (라인 47-74)
```python
class CostCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='cost_codes')
    code = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    spec = models.TextField(blank=True, null=True)                               # ✅ spec
    unit = models.CharField(max_length=50, blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)           # ✅ category
    description = models.TextField(blank=True, null=True)                        # ✅ description
    detail_code = models.CharField(max_length=100, blank=True, null=True)
    product_name = models.CharField(max_length=255, blank=True, null=True)       # ✅ product_name
    note = models.TextField(blank=True, null=True)
    ai_sd_enabled = models.BooleanField(default=False)                           # ✅ ai_sd_enabled
    dd_enabled = models.BooleanField(default=False)                              # ✅ dd_enabled
```

---

## 해결 방법

### 1. ui.js 수정

**파일:** `connections/static/connections/ui.js`
**위치:** 라인 3836-3850

**수정된 코드:**
```javascript
// 7. CC.* - 공사코드 속성 (CostCode)
const ccFields = [
    { value: 'CC.System.id', label: 'CC.System.id' },
    { value: 'CC.System.code', label: 'CC.System.code' },
    { value: 'CC.System.name', label: 'CC.System.name' },
    { value: 'CC.System.description', label: 'CC.System.description' },           // ✅ 추가
    { value: 'CC.System.detail_code', label: 'CC.System.detail_code' },
    { value: 'CC.System.product_name', label: 'CC.System.product_name' },         // ✅ 추가
    { value: 'CC.System.note', label: 'CC.System.note' },
    { value: 'CC.System.spec', label: 'CC.System.spec' },                         // ✅ 추가
    { value: 'CC.System.unit', label: 'CC.System.unit' },
    { value: 'CC.System.category', label: 'CC.System.category' },                 // ✅ 추가
    { value: 'CC.System.ai_sd_enabled', label: 'CC.System.ai_sd_enabled' },       // ✅ 수정
    { value: 'CC.System.dd_enabled', label: 'CC.System.dd_enabled' }              // ✅ 추가
];
```

### 2. views.py - direct_fields 수정

**파일:** `connections/views.py`
**위치:** 라인 2763-2769

**수정된 코드:**
```python
# Direct Django fields that can be used in .values()
direct_fields = {
    'id', 'quantity', 'cost_code_id', 'unit_price_type_id', 'quantity_member_id',
    # CostCode 모든 필드 추가 (그룹핑 및 표시용)
    'cost_code__code', 'cost_code__name', 'cost_code__description', 'cost_code__detail_code',
    'cost_code__category',      # ✅ 수정 (was: work_type)
    'cost_code__product_name',  # ✅ 수정 (was: item_name)
    'cost_code__spec',          # ✅ 수정 (was: specification)
    'cost_code__unit', 'cost_code__note', 'cost_code__ai_sd_enabled', 'cost_code__dd_enabled'
}
```

### 3. views.py - processed_item 할당 수정

**파일:** `connections/views.py`
**위치:** 라인 2897-2908

**수정된 코드:**
```python
# CostCode 모든 필드 추가
processed_item['cost_code_code'] = db_item.get('cost_code__code')
processed_item['cost_code_name'] = db_item.get('cost_code__name')
processed_item['cost_code_description'] = db_item.get('cost_code__description')
processed_item['cost_code_detail_code'] = db_item.get('cost_code__detail_code')
processed_item['cost_code_category'] = db_item.get('cost_code__category')          # ✅ 수정
processed_item['cost_code_product_name'] = db_item.get('cost_code__product_name')  # ✅ 수정
processed_item['cost_code_spec'] = db_item.get('cost_code__spec')                  # ✅ 수정
processed_item['cost_code_unit'] = db_item.get('cost_code__unit')
processed_item['cost_code_note'] = db_item.get('cost_code__note')
processed_item['cost_code_ai_sd_enabled'] = db_item.get('cost_code__ai_sd_enabled')
processed_item['cost_code_dd_enabled'] = db_item.get('cost_code__dd_enabled')
```

---

## 영향 범위

### 수정된 파일
1. `connections/static/connections/ui.js`
   - `generateCIPropertyOptions()` 함수의 CC 필드 정의

2. `connections/views.py`
   - `generate_boq_report_api()` 함수의 `direct_fields` 및 `processed_item` 할당

### 영향받는 기능
1. **상세견적(DD) BOQ 집계표**
   - CostCode 필드 그룹핑
   - CostCode 필드 표시

2. **개산견적(SD) BOQ 집계표**
   - 동일한 API 사용으로 동일 수정 적용

3. **필드 선택 UI**
   - CostCode 관련 필드가 올바르게 표시

### 영향받지 않는 기능
- CostItem 관리 (이미 올바른 필드명 사용 중)
- CostCode 관리 (모델 변경 없음)
- 기타 BIM, QM, MM 관련 기능

---

## 테스트 방법

### 1. 상세견적(DD) 탭 접근 테스트
```
1. 프로젝트 선택
2. "산출결과" → "상세견적(DD)" 탭 클릭
3. 500 에러 없이 정상 로드 확인
```

### 2. CostCode 필드 그룹핑 테스트
```
1. BOQ 그룹핑 레벨 추가
2. "CC.System.*" 필드 선택
   - code, name, description, detail_code, product_name, note, spec, unit, category
3. "집계표 생성" 버튼 클릭
4. 각 필드의 값이 올바르게 표시되는지 확인
```

### 3. CostCode 필드 표시 테스트
```
1. BOQ 표시 필드 체크박스에서 CC 필드 선택
2. 집계표 생성
3. 테이블에 해당 필드가 올바르게 표시되는지 확인
```

---

## 재발 방지

### 1. 필드 정의 일관성 유지 원칙
- Frontend (ui.js) 필드 정의 = Database Model 필드명
- Backend API 필드 접근 = Database Model 필드명
- 필드 추가/변경 시 3곳 모두 동기화 필요:
  1. `connections/models.py` (모델 정의)
  2. `connections/static/connections/ui.js` (UI 필드 옵션)
  3. `connections/views.py` (API 필드 처리)

### 2. 체크리스트
모델 필드 변경 시:
- [ ] models.py 업데이트
- [ ] ui.js의 generate*PropertyOptions() 함수 업데이트
- [ ] views.py의 API 엔드포인트 필드 매핑 업데이트
- [ ] 마이그레이션 생성 및 적용
- [ ] 관련 기능 테스트 (그룹핑, 표시, 필터링)

### 3. 향후 개선 제안
1. **자동화된 필드 매핑 검증**
   - Unit test로 모델 필드와 UI 필드 정의 일치 검증
   - CI/CD 파이프라인에 통합

2. **타입 안정성 강화**
   - TypeScript 도입 고려
   - 필드명 오타 방지

3. **동적 필드 생성**
   - 모델 메타데이터에서 필드 목록 자동 생성
   - 하드코딩 최소화

---

## 참고 사항

### Property Inheritance System
이 수정은 프로젝트의 핵심 아키텍처인 **Property Inheritance Chain**을 준수합니다:

```
BIM (RawElement)
  ↓ inherits ALL properties
QuantityMember (QM)
  ├─ BIM.* (inherited)
  ├─ MM.* (MemberMark)
  ├─ SC.* (Space)
  └─ QM.* (own)
    ↓ inherits ALL properties
CostItem (CI)
  ├─ BIM.* (inherited)
  ├─ QM.* (inherited)
  ├─ MM.* (inherited)
  ├─ SC.* (inherited)
  ├─ CI.* (own)
  └─ CC.* (CostCode) ← 이번 수정 대상
```

**핵심 원칙:**
- 모든 상속된 속성은 이름이 동일해야 함
- Prefix(BIM, QM, MM, SC, CI, CC)는 속성 출처를 나타냄
- 하위 엔티티는 상위의 모든 속성을 완전히 상속

---

## 커밋 정보

**Commit Message:**
```
Fix CostCode field mapping in BOQ report generation

- Update ui.js generateCIPropertyOptions() with correct CostCode fields
- Fix Django ORM field names in views.py generate_boq_report_api()
- Add missing fields: description, product_name, spec, category, dd_enabled
- Correct field names: work_type→category, item_name→product_name, specification→spec, is_sd_enabled→ai_sd_enabled

Resolves 500 error in detailed estimation (DD) tab
Enables proper CostCode field grouping and display in BOQ tables
```

**변경 파일:**
- `connections/static/connections/ui.js`
- `connections/views.py`
- `workings/99_2025-11-10_BOQ_CostCode_Field_Fix.md`
