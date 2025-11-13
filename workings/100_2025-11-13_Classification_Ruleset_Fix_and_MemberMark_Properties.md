# 100. 2025-11-13: 분류 룰셋 500 에러 수정 및 일람부호 속성 공사코드 룰셋 지원

## 작업 개요

BIM 원본 데이터 탭에서 "룰셋 일괄적용" 버튼 클릭 시 발생하는 500 에러를 수정하고, 공사코드 할당 룰셋에서 일람부호(MemberMark) 속성을 참조할 수 있도록 개선했습니다.

## 문제 상황

### 1. 분류 룰셋 적용 시 500 에러
- **증상**: BIM원본데이터 탭에서 "룰셋 일괄적용" 버튼 클릭 시 500 Internal Server Error 발생
- **위치**: `POST http://127.0.0.1:8000/connections/api/rules/apply-classification/{project_id}/`
- **에러 발생 파일**: `connections/static/connections/ruleset_classification_handlers.js:185`

### 2. 공사코드 할당 룰셋에서 일람부호 속성 참조 불가
- **문제**: 공사코드 할당 룰셋의 조건 빌더에서 일람부호 속성들이 필드 선택에 충분히 표시되지 않음
- **근본 원인**:
  - 프론트엔드: `window.currentMemberMarks`만 확인하여 데이터 미로드 시 속성 표시 안됨
  - 프론트엔드-백엔드 속성명 불일치: `MM.Properties.속성명` vs `[속성명]`

### 3. 할당 룰셋 실행 순서 우려
- **우려사항**: 공사코드 할당이 일람부호 할당보다 먼저 실행되면 일람부호 속성 참조 불가
- **확인 결과**: 이미 올바른 순서(일람부호 → 공사코드)로 구현되어 있음

## 해결 방법

### 1. 분류 룰셋 500 에러 수정

**파일**: `connections/views.py`

**문제 코드** (Line 696-701):
```python
try:
    project = Project.objects.get(id=project_id)
    rules = ClassificationRule.objects.filter(project=project).order_by('id').select_related('target_tag')

    # ElementClassificationAssignment 모델 import
    from connections.models import ElementClassificationAssignment  # ❌ 중복 import

    # [수정] 대용량 데이터를 처리하기 위해 iterator 사용
    all_elements_qs = RawElement.objects.filter(project=project)
```

**해결**:
- `ElementClassificationAssignment`는 이미 파일 상단(Line 43)에서 import되어 있음
- 함수 내부의 중복 import 제거

**수정 후**:
```python
try:
    project = Project.objects.get(id=project_id)
    rules = ClassificationRule.objects.filter(project=project).order_by('id').select_related('target_tag')

    # [수정] 대용량 데이터를 처리하기 위해 iterator 사용
    all_elements_qs = RawElement.objects.filter(project=project)
```

### 2. 일람부호 속성 필드 선택 개선

**파일**: `connections/static/connections/ui.js`

**문제 코드** (Line 3772-3788):
```javascript
// MM.Properties.* 동적 수집
if (window.currentMemberMarks && window.currentMemberMarks.length > 0) {
    const mmPropertiesSet = new Set();
    window.currentMemberMarks.forEach(mm => {  // ❌ currentMemberMarks만 확인
        if (mm.properties && typeof mm.properties === 'object') {
            Object.keys(mm.properties).forEach(key => {
                mmPropertiesSet.add(key);
            });
        }
    });
    // ...
}
```

**해결**:
- `window.loadedMemberMarks`도 함께 확인하여 더 많은 속성 수집
- QM 속성 수집 패턴과 동일하게 변경

**수정 후** (Line 3772-3794):
```javascript
// MM.Properties.* 동적 수집
// ▼▼▼ [수정] window.loadedMemberMarks도 확인하여 더 많은 속성 수집 ▼▼▼
const mmPropertiesSet = new Set();
const mmSources = [window.currentMemberMarks, window.loadedMemberMarks];

mmSources.forEach(mmList => {
    if (mmList && mmList.length > 0) {
        mmList.forEach(mm => {
            if (mm.properties && typeof mm.properties === 'object') {
                Object.keys(mm.properties).forEach(key => {
                    mmPropertiesSet.add(key);
                });
            }
        });
    }
});

if (mmPropertiesSet.size > 0) {
    mmPropertiesSet.forEach(prop => {
        mmFields.push({ value: `MM.Properties.${prop}`, label: `MM.Properties.${prop}` });
    });
}
// ▲▲▲ [수정] 여기까지 ▲▲▲
```

### 3. 프론트엔드-백엔드 속성명 매핑 추가

**파일**: `connections/views.py`

**문제**:
- 프론트엔드: `MM.Properties.규격` 형태로 조건 저장
- 백엔드: `[규격]` 형태로 combined_properties에 저장
- 매핑 로직 부재로 조건 평가 실패

**해결** (Line 644-650):
```python
# ▼▼▼ [추가] MM.Properties.* -> [속성명] 매핑 지원 (2025-11-13) ▼▼▼
# MM.Properties.속성명 -> [속성명] 형태로 변환하여 찾기
elif p.startswith('MM.Properties.'):
    prop_name = p[14:]  # 'MM.Properties.' 제거
    bracket_key = f'[{prop_name}]'  # [속성명] 형태로 변환
    actual_value = data_dict.get(bracket_key)
    print(f"[DEBUG][evaluate_conditions] MM.Properties.* mapping: '{p}' -> '{bracket_key}' = {actual_value}")
# ▲▲▲ [추가] 여기까지 ▲▲▲
```

## 실행 순서 검증

**파일**: `connections/views.py` - `apply_assignment_rules_view` 함수

**확인 결과**: ✅ 이미 올바른 순서로 구현됨

```python
# Line 2457-2480: 일람부호 할당 (먼저)
# --- 일람부호 할당 로직 ---
mark_expr = member.member_mark_expression
if not mark_expr:
    for rule in mark_rules:
        if evaluate_conditions(combined_properties, rule.conditions):
            mark_expr = rule.mark_expression
            break

if mark_expr:
    # 일람부호 할당
    mark_obj, created = MemberMark.objects.get_or_create(...)
    if member.member_mark != mark_obj:
        member.member_mark = mark_obj
        member.save(update_fields=['member_mark'])
        updated_mark_count += 1

        # ▼▼▼ [중요] 일람부호가 변경되었으므로 combined_properties 업데이트 ▼▼▼
        combined_properties['member_mark_name'] = mark_obj.mark
        if mark_obj.properties and isinstance(mark_obj.properties, dict):
            for k, v in mark_obj.properties.items():
                combined_properties[f'[{k}]'] = v  # [속성명] 형태로 추가
        # ▲▲▲ 일람부호 속성이 combined_properties에 추가됨 ▲▲▲

# Line 2481-: 공사코드 할당 (나중)
# --- 공사코드 할당 로직 ---
cost_code_exprs_list = member.cost_code_expressions
if not cost_code_exprs_list:
    matching_expressions = []
    for rule in cost_code_rules:
        # 이 시점에 combined_properties에 일람부호 속성 포함됨!
        if evaluate_conditions(combined_properties, rule.conditions):
            matching_expressions.append(rule.cost_code_expressions)
    cost_code_exprs_list = matching_expressions
```

**실행 순서 요약**:
1. ✅ **일람부호 할당 먼저** (Line 2457-2480)
2. ✅ **일람부호 속성을 `combined_properties`에 추가** (Line 2476-2479)
3. ✅ **공사코드 할당** (Line 2481-) - 일람부호 속성 참조 가능

## 변경된 파일 목록

1. **connections/views.py**
   - Line 696-701: 중복 import 제거
   - Line 644-650: `MM.Properties.*` → `[속성명]` 매핑 추가

2. **connections/static/connections/ui.js**
   - Line 3772-3794: `window.loadedMemberMarks` 확인 로직 추가

## 테스트 시나리오

### 1. 분류 룰셋 적용 테스트
```
1. BIM원본데이터 탭에서 "룰셋 일괄적용" 버튼 클릭
2. 기대 결과: 500 에러 없이 정상 실행
3. 확인: 분류가 룰셋에 따라 정상적으로 할당됨
```

### 2. 일람부호 속성 참조 테스트
```
1. 일람부호 관리 탭에서 속성이 있는 일람부호 생성
   - 예: mark="W-001", properties={"규격": "200x300", "재질": "RC"}

2. 공사코드 할당 룰셋 탭에서 새 룰셋 생성
   - 조건: MM.Properties.규격 equals 200x300
   - 공사코드: 원하는 공사코드 선택

3. 작업 - 수량산출부재 탭에서 "할당룰셋일괄적용" 버튼 클릭

4. 기대 결과:
   - 일람부호 할당 먼저 실행됨
   - 일람부호 속성을 참조하여 공사코드 정상 할당됨
   - 조건: MM.Properties.규격 == "200x300"인 수량산출부재에 공사코드 할당됨
```

### 3. 필드 선택 UI 테스트
```
1. 공사코드 할당 룰셋 탭 → 새 룰셋 추가
2. 조건 추가 → 속성 선택 드롭다운 클릭
3. 확인: "MM 일람부호 속성" 그룹에서 MM.System.* 및 MM.Properties.* 표시됨
4. MM.Properties.* 속성 선택 가능함
```

## 기술적 세부사항

### Property Inheritance Chain (속성 상속 체계)

```
QuantityMember (QM)
├─ BIM.* (from RawElement - raw_data)
├─ QM.System.* (자체 시스템 속성)
├─ QM.Properties.* (사용자 정의 속성)
├─ MM.System.* (from MemberMark)
│   ├─ MM.System.id
│   ├─ MM.System.mark
│   └─ MM.System.description
├─ MM.Properties.* (from MemberMark.properties)
│   ├─ [속성명] 형태로 combined_properties에 저장
│   └─ MM.Properties.속성명 형태로 UI에 표시
└─ SC.System.* (from SpaceClassification)
```

### 속성명 변환 로직

| 계층 | 프론트엔드 표시 | 백엔드 저장 | 변환 로직 |
|------|----------------|------------|-----------|
| 일람부호 시스템 | `MM.System.mark` | `member_mark_name` | 직접 매핑 |
| 일람부호 속성 | `MM.Properties.규격` | `[규격]` | `evaluate_conditions`에서 변환 |
| 공사코드 시스템 | `CC.System.detail_code` | `CostCode.detail_code` | 기존 로직 |
| QM 속성 | `QM.Properties.속성명` | `properties.속성명` | 직접 접근 |

## 주의사항

1. **일람부호 속성 로드 타이밍**
   - 공사코드 할당 룰셋 편집 전에 일람부호 데이터가 로드되어야 함
   - `window.currentMemberMarks` 또는 `window.loadedMemberMarks` 중 하나라도 있으면 속성 표시됨

2. **속성명 대괄호 표기**
   - 백엔드 `combined_properties`에서 일람부호 속성은 `[속성명]` 형태로 저장
   - 프론트엔드에서는 `MM.Properties.속성명` 형태로 사용자에게 표시
   - `evaluate_conditions` 함수에서 자동 변환 처리

3. **실행 순서 의존성**
   - 공사코드 할당 룰셋이 일람부호 속성을 참조하는 경우
   - 반드시 일람부호 할당이 먼저 완료되어야 함
   - 현재 구현에서는 올바른 순서로 보장됨 (Line 2457 → Line 2481)

## 관련 문서

- `CLAUDE.md`: Property Inheritance System 섹션
- `CLAUDE.md`: Ruleset System 섹션
- `workings/92_2025-11-07_간트차트_소수점_일수_및_Lag_오프셋_처리.md`: 유사한 프론트엔드-백엔드 매핑 사례

## 향후 개선 사항

1. **일람부호 속성 표기법 통일**
   - 현재: 프론트엔드(`MM.Properties.*`) vs 백엔드(`[*]`) 불일치
   - 제안: 백엔드도 `MM.Properties.*` 형태로 저장하여 통일성 향상

2. **동적 속성 수집 최적화**
   - 현재: 룰셋 테이블 렌더링 시마다 전체 데이터 순회
   - 제안: 속성 목록 캐싱 및 변경 시에만 재수집

3. **속성명 매핑 로직 중앙화**
   - 현재: `evaluate_conditions`에 개별적으로 매핑 로직 추가
   - 제안: 속성명 변환 전용 함수 생성하여 재사용성 향상

## 결론

이번 작업을 통해:
1. ✅ 분류 룰셋 적용 시 500 에러 해결
2. ✅ 공사코드 할당 룰셋에서 일람부호 속성 참조 가능
3. ✅ 할당 룰셋 실행 순서 검증 (일람부호 → 공사코드)
4. ✅ 프론트엔드-백엔드 속성명 매핑 구현

공사코드 할당 시 일람부호의 사용자 정의 속성을 조건으로 활용할 수 있게 되어, 더욱 정교한 자동화 룰셋 구성이 가능해졌습니다.
