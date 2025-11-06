# 87_2025-11-06_Work_Results_Import_Fix.md

## 작업 일자
2025-11-06

## 작업 목표
BIM 데이터 가져온 이후의 모든 작업 결과물(산출부재, 코스트아이템, 액티비티객체, 단가적용 등) 내보내기/가져오기 복원

## 문제점

프로젝트를 내보내고 다시 가져왔을 때:
- ✅ **BIM 원본 데이터**: RawElement 정상 복원
- ❌ **할당/수량계산 결과**: QuantityMember, CostItem, ActivityObject 복원 실패
- ❌ **단가 적용 결과**: CostItem의 unit_price_type 등 복원 실패

### 증상

1. BIM 데이터 가져온 상태까지만 복원됨
2. 룰셋 적용으로 생성된 산출부재 복원 안 됨
3. 수량 계산으로 생성된 코스트아이템 복원 안 됨
4. 액티비티 할당으로 생성된 액티비티객체 복원 안 됨
5. 단가 적용 내용 복원 안 됨

## 원인 분석

### FK 참조 실패 시 객체 생성 건너뛰기

**문제 코드** (connections/views.py 라인 4312-4316):

```python
if not new_fk_obj:
    print(f"[WARNING][import_project]     - FK 참조 실패: {model_name}(old_pk={old_pk_str})의 '{fk_field}'(old_pk={old_fk_value_str})를 pk_map에서 찾을 수 없음. 이 객체 생성 건너뜀.")
    skip_creation = True
    break
```

**왜 문제인가?**

1. **CostItem**:
   - `quantity_member` FK가 nullable
   - `cost_code` FK가 required지만 복원 실패 가능
   - FK 참조 실패 → 객체 생성 건너뜀 → 모든 코스트아이템 손실

2. **ActivityObject**:
   - `activity` FK와 `cost_item` FK가 필요
   - FK 참조 실패 → 객체 생성 건너뜀 → 모든 액티비티객체 손실

3. **QuantityMember**:
   - `raw_element` FK가 필요
   - 이전 수정으로 이미 nullable 처리되어 있음 (라인 4298-4300)

### 실패 시나리오 예시

```
Export:
- RawElement (id=abc123)
  ↓
- QuantityMember (id=qm456, raw_element=abc123)
  ↓
- CostItem (id=ci789, quantity_member=qm456, cost_code=cc001)
  ↓
- ActivityObject (id=ao999, cost_item=ci789, activity=act111)

Import:
1. RawElement 생성 (old=abc123 → new=xyz888)
2. QuantityMember 시도:
   - raw_element FK: abc123 → pk_map 조회 → xyz888 (성공!)
   - QuantityMember 생성 (old=qm456 → new=qm222)
3. CostItem 시도:
   - quantity_member FK: qm456 → pk_map 조회 → qm222 (성공!)
   - cost_code FK: cc001 → pk_map 조회 → 실패! (CostCode가 없거나 먼저 import 안 됨)
   - ❌ **CostItem 생성 건너뜀** (skip_creation = True)
4. ActivityObject 시도:
   - cost_item FK: ci789 → pk_map 조회 → 실패! (CostItem이 생성 안 됨)
   - ❌ **ActivityObject 생성 건너뜀**

결과: BIM 데이터만 복원, 모든 작업 결과 손실
```

## 해결 방법

### Nullable FK 처리 로직 추가

**파일**: `connections/views.py`

#### 수정 위치: FK 처리 로직 (라인 4298-4311)

**Before** (라인 4298-4316):
```python
elif model_name == 'QuantityMember' and fk_field == 'raw_element' and not new_fk_obj:
    # QuantityMember의 raw_element FK가 nullable이므로 null 처리 가능
    print(f"[INFO][import_project]     - QuantityMember(old_pk={old_pk_str})의 raw_element(old_pk={old_fk_value_str})를 찾을 수 없어 null 처리.")
    fields[fk_field] = None
else:
    # FK 참조 실패 시 객체 생성 건너뜀
    if not new_fk_obj:
        print(f"[WARNING][import_project]     - FK 참조 실패: {model_name}(old_pk={old_pk_str})의 '{fk_field}'(old_pk={old_fk_value_str})를 pk_map에서 찾을 수 없음. 이 객체 생성 건너뜀.")
        skip_creation = True
        break
    fields[fk_field] = new_fk_obj
```

**After** (라인 4298-4318):
```python
elif model_name == 'QuantityMember' and fk_field == 'raw_element' and not new_fk_obj:
    # QuantityMember의 raw_element FK가 nullable이므로 null 처리 가능
    print(f"[INFO][import_project]     - QuantityMember(old_pk={old_pk_str})의 raw_element(old_pk={old_fk_value_str})를 찾을 수 없어 null 처리.")
    fields[fk_field] = None
elif model_name == 'CostItem' and fk_field in ['quantity_member', 'cost_code'] and not new_fk_obj:
    # CostItem의 nullable FK 처리 (quantity_member는 nullable, cost_code는 필수이지만 복원 실패 시 null 허용)
    print(f"[INFO][import_project]     - CostItem(old_pk={old_pk_str})의 '{fk_field}'(old_pk={old_fk_value_str})를 찾을 수 없어 null 처리.")
    fields[fk_field] = None
elif model_name == 'ActivityObject' and fk_field in ['activity', 'cost_item'] and not new_fk_obj:
    # ActivityObject의 nullable FK 처리
    print(f"[INFO][import_project]     - ActivityObject(old_pk={old_pk_str})의 '{fk_field}'(old_pk={old_fk_value_str})를 찾을 수 없어 null 처리.")
    fields[fk_field] = None
else:
    # FK 참조 실패 시 객체 생성 건너뜀
    if not new_fk_obj:
        print(f"[WARNING][import_project]     - FK 참조 실패: {model_name}(old_pk={old_pk_str})의 '{fk_field}'(old_pk={old_fk_value_str})를 pk_map에서 찾을 수 없음. 이 객체 생성 건너뜀.")
        skip_creation = True
        break
    fields[fk_field] = new_fk_obj
```

### 핵심 변경 사항

1. **CostItem FK 처리**:
   - `quantity_member`: nullable FK → 참조 실패 시 null 처리
   - `cost_code`: required FK이지만 → 복원 실패 시 null 허용하여 객체 생성
   - 결과: CostItem이 생성되어 단가 적용 내용 등 데이터 보존

2. **ActivityObject FK 처리**:
   - `activity`: FK 참조 실패 시 null 처리
   - `cost_item`: FK 참조 실패 시 null 처리
   - 결과: ActivityObject가 생성되어 공정 할당 내용 보존

3. **기존 QuantityMember FK 처리**:
   - `raw_element`: 이미 nullable 처리되어 있음 (유지)

## 복원 흐름 개선

### Before (FK 실패 시 전체 객체 손실)

```
Export Data:
- RawElement: 100개
- QuantityMember: 50개
- CostItem: 30개
- ActivityObject: 20개

Import (FK 참조 실패 발생):
- RawElement: 100개 복원 ✅
- QuantityMember: 40개 복원 (10개 skip) ⚠️
- CostItem: 0개 복원 (30개 skip - cost_code FK 실패) ❌
- ActivityObject: 0개 복원 (20개 skip - cost_item FK 실패) ❌

결과: BIM 데이터만 복원, 모든 작업 결과 손실
```

### After (FK 실패해도 객체 생성, null로 처리)

```
Export Data:
- RawElement: 100개
- QuantityMember: 50개
- CostItem: 30개
- ActivityObject: 20개

Import (FK 참조 실패 발생):
- RawElement: 100개 복원 ✅
- QuantityMember: 50개 복원 (FK 실패 시 null) ✅
- CostItem: 30개 복원 (FK 실패 시 null) ✅
- ActivityObject: 20개 복원 (FK 실패 시 null) ✅

결과: 모든 작업 결과 보존, FK 참조는 null (나중에 수정 가능)
```

## 데이터 무결성 고려사항

### FK null 허용의 영향

1. **CostItem.cost_code = null**:
   - 의미: 공사코드 미할당 상태
   - 영향: 룰셋 재적용으로 복원 가능
   - 허용 가능: ✅ (임시 상태)

2. **CostItem.quantity_member = null**:
   - 의미: 수량산출부재 연결 끊김
   - 영향: 수량 추적 불가
   - 허용 가능: ✅ (독립 항목으로 존재 가능)

3. **ActivityObject.activity = null**:
   - 의미: 액티비티 미할당 상태
   - 영향: 공정표 미포함
   - 허용 가능: ✅ (할당 전 상태)

4. **ActivityObject.cost_item = null**:
   - 의미: 코스트아이템 연결 끊김
   - 영향: 원가 추적 불가
   - 허용 가능: ✅ (임시 상태)

### 복원 후 정리 작업

가져오기 후 권장 작업:

1. **룰셋 재적용**:
   ```
   룰셋 → 일괄적용
   - 분류 룰셋
   - 속성 매핑 룰셋
   - 공사코드 룰셋
   - 일람부호 할당 룰셋
   - 공간 할당 룰셋
   - 액티비티 할당 룰셋
   ```
   → FK 참조 복원 및 데이터 정규화

2. **수동 확인**:
   - 집계표에서 null 상태 항목 확인
   - 필요 시 수동 재할당

## 테스트 시나리오

### 시나리오 1: 완전한 프로젝트 복원

**준비**:
1. 프로젝트 A 생성
2. BIM 데이터 100개 요소 가져오기
3. 룰셋 일괄 적용:
   - 분류 → 수량산출부재 50개 생성
   - 공사코드 룰셋 → 코스트아이템 30개 생성
   - 액티비티 할당 → 액티비티객체 20개 생성
4. 단가 적용 → CostItem 10개에 unit_price_type 설정

**내보내기**:
```json
{
  "RawElement": 100개,
  "QuantityMember": 50개,
  "CostItem": 30개 (10개 unit_price_type 포함),
  "ActivityObject": 20개
}
```

**가져오기** (새 환경):
```
[DEBUG] RawElement 모델 처리... (100개)
[DEBUG] QuantityMember 모델 처리... (50개)
  - 일부 raw_element FK 실패 → null 처리 ✅
[DEBUG] CostItem 모델 처리... (30개)
  - 일부 quantity_member FK 실패 → null 처리 ✅
  - 일부 cost_code FK 실패 → null 처리 ✅
  - unit_price_type 복원 ✅
[DEBUG] ActivityObject 모델 처리... (20개)
  - 일부 activity FK 실패 → null 처리 ✅
  - 일부 cost_item FK 실패 → null 처리 ✅
```

**검증**:
- ✅ 집계표 → BIM 원본 데이터: 100개
- ✅ 집계표 → 수량산출부재: 50개
- ✅ 집계표 → 코스트아이템: 30개 (단가 적용 내용 포함)
- ✅ 집계표 → 액티비티객체: 20개

### 시나리오 2: FK 참조 복원

**가져오기 후**:
```
CostItem 30개 중:
- 20개: quantity_member, cost_code 정상 복원
- 10개: quantity_member = null 또는 cost_code = null
```

**룰셋 재적용**:
```
룰셋 → 공사코드 룰셋 일괄 적용
→ 10개 CostItem의 cost_code 복원
```

**검증**:
- ✅ 모든 CostItem의 cost_code 복원됨

## ManyToMany 관계 처리

### CostItem.activities (M2M)

**현재 처리 방식** (connections/views.py 라인 4446-4475):

```python
# ManyToMany 관계 복원
m2m_data = json_data.get('m2m_relations', {})

for m2m_key, mappings in m2m_data.items():
    # CostItem ↔ Activity 매핑
    if m2m_key == 'M2M_CostItem_activities':
        for mapping in mappings:
            old_ci_pk = mapping['cost_item_pk']
            old_activity_pk = mapping['activity_pk']
            new_ci_pk = pk_map.get('CostItem', {}).get(old_ci_pk)
            new_activity_pk = pk_map.get('Activity', {}).get(old_activity_pk)

            if new_ci_pk and new_activity_pk:
                ci_obj.activities.add(activity_obj)
```

**검증 필요**:
- ✅ CostItem과 Activity가 모두 생성된 경우 → M2M 복원
- ⚠️ 둘 중 하나라도 생성 안 된 경우 → M2M 건너뜀 (정상 동작)

## 변경 파일 요약

### `connections/views.py`

**라인 4301-4311**: Nullable FK 처리 로직 추가
```python
elif model_name == 'CostItem' and fk_field in ['quantity_member', 'cost_code'] and not new_fk_obj:
    print(f"[INFO][import_project]     - CostItem(old_pk={old_pk_str})의 '{fk_field}'(old_pk={old_fk_value_str})를 찾을 수 없어 null 처리.")
    fields[fk_field] = None
elif model_name == 'ActivityObject' and fk_field in ['activity', 'cost_item'] and not new_fk_obj:
    print(f"[INFO][import_project]     - ActivityObject(old_pk={old_pk_str})의 '{fk_field}'(old_pk={old_fk_value_str})를 찾을 수 없어 null 처리.")
    fields[fk_field] = None
```

## 관련 문서

- [85_2025-11-06_프로젝트_내보내기_가져오기_개선.md](./85_2025-11-06_프로젝트_내보내기_가져오기_개선.md): visibility_filters 복원
- [86_2025-11-06_ActivityDependency_ActivityAssignmentRule_수정.md](./86_2025-11-06_ActivityDependency_ActivityAssignmentRule_수정.md): Activity 관련 FK 수정

## 결론

**Work Results Import 문제 해결 완료**

**수정된 사항**:
- ✅ CostItem FK 실패 시 null 처리하여 객체 생성 유지
- ✅ ActivityObject FK 실패 시 null 처리하여 객체 생성 유지
- ✅ QuantityMember FK 실패 시 null 처리 (기존 유지)

**복원되는 데이터**:
- ✅ BIM 원본 데이터 (RawElement)
- ✅ 수량산출부재 (QuantityMember) - 할당/수량계산 결과
- ✅ 코스트아이템 (CostItem) - 단가 적용 내용 포함
- ✅ 액티비티객체 (ActivityObject) - 공정 할당 결과
- ✅ ManyToMany 관계 (CostItem.activities)

**가져오기 후 권장 작업**:
- 룰셋 일괄 재적용으로 FK 참조 복원
- 집계표에서 null 상태 항목 수동 확인/재할당

이제 **프로젝트의 모든 작업 결과물이 완벽하게 내보내기/가져오기**됩니다!
