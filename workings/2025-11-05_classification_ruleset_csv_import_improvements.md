# 2025-11-05: Classification Ruleset CSV Import Improvements

## 작업 개요
분류 할당 룰셋 CSV 가져오기 기능 개선 - 태그 자동 생성 및 디버깅 로그 추가

## 문제점
1. **CSV import 시 태그가 없으면 룰셋을 가져올 수 없는 문제**
   - 기존: `QuantityClassificationTag`가 프로젝트에 존재하지 않으면 해당 룰을 건너뜀
   - 사용자는 빈 프로젝트에 룰셋을 먼저 세팅하고 나중에 IFC 파일을 로드하는 워크플로우를 원함
   - 하지만 태그가 없으면 import가 실패하여 워크플로우가 불가능함

2. **Import 실패 시 원인을 알 수 없는 문제**
   - 브라우저에서는 "성공" 메시지가 표시되지만 실제로는 데이터가 0개 로드됨
   - 어떤 태그가 없어서 실패했는지 알 수 없음

## 해결 방법

### 1. 태그 자동 생성 기능 추가 (views.py:3228-3236)

**Before:**
```python
try:
    target_tag = QuantityClassificationTag.objects.get(project=project, name=tag_name)
except QuantityClassificationTag.DoesNotExist:
    print(f"경고: '{tag_name}' 태그를 찾을 수 없어 해당 규칙을 건너뜁니다.")
    continue
```

**After:**
```python
# 태그가 없으면 자동 생성
target_tag, created = QuantityClassificationTag.objects.get_or_create(
    project=project,
    name=tag_name
)
if created:
    print(f"[DEBUG][import_classification_rules] Created new tag: {tag_name}")
    created_tags.append(tag_name)
```

### 2. 사용자 피드백 메시지 개선 (views.py:3251-3256)

**자동 생성된 태그가 있는 경우:**
```python
if created_tags:
    created_list = ', '.join(created_tags)
    message = f'{imported_count}개의 분류 할당 룰셋을 성공적으로 가져왔습니다. 새로 생성된 태그: {created_list}'
    return JsonResponse({'status': 'success', 'message': message})
```

**예시 메시지:**
- `"2개의 분류 할당 룰셋을 성공적으로 가져왔습니다. 새로 생성된 태그: 조적벽, 마감바닥"`

### 3. 디버깅 로그 추가 (views.py:3207-3261)

**추가된 로그:**
```python
print(f"[DEBUG][import_classification_rules] Request received for project_id: {project_id}")
print(f"[DEBUG][import_classification_rules] CSV file: {csv_file}")
print(f"[DEBUG][import_classification_rules] Deleted existing rules")
print(f"[DEBUG][import_classification_rules] Processing row: tag_name={tag_name}")
print(f"[DEBUG][import_classification_rules] Created new tag: {tag_name}")
print(f"[DEBUG][import_classification_rules] Created rule for tag: {tag_name}")
print(f"[DEBUG][import_classification_rules] Successfully imported {imported_count} rules, created {len(created_tags)} new tags")
print(f"[ERROR][import_classification_rules] Error: {e}")
```

### 4. Frontend 디버깅 로그 추가

**app.js:540-617 - handleCsvFileSelect() 함수**
```javascript
console.log('[DEBUG][handleCsvFileSelect] Function called');
console.log('[DEBUG][handleCsvFileSelect] currentProjectId:', currentProjectId);
console.log('[DEBUG][handleCsvFileSelect] currentCsvImportUrl:', currentCsvImportUrl);
console.log('[DEBUG][handleCsvFileSelect] Selected file:', file?.name);
console.log('[DEBUG][handleCsvFileSelect] Sending POST request to:', currentCsvImportUrl);
console.log('[DEBUG][handleCsvFileSelect] Response received, status:', response.status);
console.log('[DEBUG][handleCsvFileSelect] Response data:', result);
console.log('[DEBUG][handleCsvFileSelect] CSV import successful.');
console.log('[DEBUG][handleCsvFileSelect] activeTab:', activeTab);
console.log('[DEBUG][handleCsvFileSelect] rulesetId:', rulesetId);
console.log('[DEBUG][handleCsvFileSelect] Calling loadClassificationRules()');
console.log('[DEBUG][handleCsvFileSelect] loadClassificationRules() completed');
```

**ruleset_classification_handlers.js:140-172 - loadClassificationRules() 함수**
```javascript
console.log('[DEBUG][loadClassificationRules] Function called');
console.log('[DEBUG][loadClassificationRules] currentProjectId:', currentProjectId);
console.log('[DEBUG][loadClassificationRules] About to fetch from:', url);
console.log('[DEBUG][loadClassificationRules] Fetch completed, response.ok:', response.ok, 'status:', response.status);
console.log('[DEBUG][loadClassificationRules] Loaded rules count:', loadedClassificationRules.length);
console.log('[DEBUG][loadClassificationRules] Table rendered successfully');
```

### 5. Navigation.js await 키워드 추가 (navigation.js:747-793)

**기존 문제:** async 함수들이 await 없이 호출되어 완료되지 않은 상태로 다음 단계 진행

**수정:**
```javascript
case 'classification-ruleset':
    await loadClassificationRules();  // await 추가
    break;
case 'mapping-ruleset':
    await loadPropertyMappingRules();  // await 추가
    break;
// ... 모든 ruleset 타입에 await 추가
```

## 수정된 파일

1. **connections/views.py** (3205-3261 라인)
   - `import_classification_rules()` 함수 개선
   - 태그 자동 생성 로직 추가
   - 디버깅 로그 추가
   - 사용자 피드백 메시지 개선

2. **connections/static/connections/app.js** (540-617 라인)
   - `handleCsvFileSelect()` 함수에 디버깅 로그 추가

3. **connections/static/connections/ruleset_classification_handlers.js** (140-172 라인)
   - `loadClassificationRules()` 함수에 디버깅 로그 추가

4. **connections/static/connections/navigation.js** (747-793 라인)
   - `loadSpecificRuleset()` 함수에 await 키워드 추가

## 사용 시나리오

### 시나리오 1: 빈 프로젝트에 룰셋 템플릿 import
```
1. 새 프로젝트 생성 (IFC 파일 없음)
2. 분류할당룰셋 탭으로 이동
3. '가져오기' 버튼 클릭
4. Sample_classification_rules.csv 선택
   - CSV에 "조적벽", "마감바닥" 태그 포함
5. 결과:
   ✅ "조적벽", "마감바닥" 태그 자동 생성
   ✅ 2개 룰셋 성공적으로 import
   ✅ 메시지: "2개의 분류 할당 룰셋을 성공적으로 가져왔습니다. 새로 생성된 태그: 조적벽, 마감바닥"
6. 나중에 IFC 파일 로드
7. 룰셋 자동 실행
```

### 시나리오 2: 일부 태그만 있는 프로젝트에 import
```
1. 프로젝트에 "조적벽" 태그만 존재
2. CSV import (조적벽, 마감바닥 포함)
3. 결과:
   ✅ "마감바닥" 태그만 자동 생성
   ✅ 2개 룰셋 모두 import
   ✅ 메시지: "2개의 분류 할당 룰셋을 성공적으로 가져왔습니다. 새로 생성된 태그: 마감바닥"
```

### 시나리오 3: 모든 태그가 이미 존재하는 경우
```
1. 프로젝트에 "조적벽", "마감바닥" 태그 모두 존재
2. CSV import
3. 결과:
   ✅ 태그 생성 없음
   ✅ 2개 룰셋 import
   ✅ 메시지: "2개의 분류 할당 룰셋을 성공적으로 가져왔습니다."
```

## 개선 효과

### Before (기존)
- ❌ 빈 프로젝트에 룰셋 import 불가능
- ❌ Import 실패 시 원인 파악 어려움
- ❌ 태그를 수동으로 먼저 생성해야 함
- ❌ 디버깅 어려움

### After (개선 후)
- ✅ 빈 프로젝트에 룰셋 import 가능
- ✅ 태그 자동 생성으로 사용자 편의성 증가
- ✅ 어떤 태그가 생성되었는지 명확한 피드백
- ✅ 상세한 디버깅 로그로 문제 추적 용이
- ✅ "룰셋 먼저, IFC 나중" 워크플로우 지원

## 워크플로우 개선

### 기존 워크플로우 (불가능)
```
1. 프로젝트 생성
2. 룰셋 import 시도 → ❌ 실패 (태그 없음)
3. 태그 수동 생성
4. 룰셋 다시 import
5. IFC 로드
```

### 새로운 워크플로우 (가능)
```
1. 프로젝트 생성
2. 룰셋 import → ✅ 성공 (태그 자동 생성)
3. IFC 로드
4. 룰셋 자동 실행
```

## 기술적 세부사항

### Django ORM get_or_create() 사용
```python
target_tag, created = QuantityClassificationTag.objects.get_or_create(
    project=project,
    name=tag_name
)
```
- `created=True`: 새로 생성됨
- `created=False`: 이미 존재함
- 원자적(atomic) 연산으로 race condition 방지

### JavaScript async/await 패턴
```javascript
// Before
loadClassificationRules();  // 완료를 기다리지 않음

// After
await loadClassificationRules();  // 완료될 때까지 대기
```

## 참고 사항

- 기존 UTF-8 BOM 처리 (2025-11-04 작업)는 유지됨
- priority 필드 제거 (2025-11-05 작업)도 유지됨
- 다른 ruleset import 함수들도 동일한 패턴으로 개선 가능

## 테스트 완료
- ✅ 빈 프로젝트에 CSV import
- ✅ 태그 자동 생성 확인
- ✅ 룰셋 데이터 정상 로드 확인
- ✅ 사용자 피드백 메시지 확인

## 향후 개선 사항
- 다른 ruleset 타입들(PropertyMapping, CostCode 등)에도 동일한 자동 생성 로직 적용 고려
- Export 시 관련 태그도 함께 export하는 기능 추가 고려
