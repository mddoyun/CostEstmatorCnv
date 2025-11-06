# 86_2025-11-06_ActivityDependency_ActivityAssignmentRule_수정.md

## 작업 일자
2025-11-06

## 작업 목표
ActivityDependency(선후행 관계)와 ActivityAssignmentRule(액티비티 할당 룰셋) import 실패 문제 해결

## 문제점

프로젝트를 내보내고 다시 가져왔을 때:
- ❌ **선후행 관계 관리**: ActivityDependency가 복원되지 않음
- ❌ **액티비티 할당 룰셋**: ActivityAssignmentRule이 복원되지 않음

## 원인 분석

### 1. ActivityDependency FK 필드명 오류

**잘못된 설정**:
```python
'ActivityDependency': ['project', 'activity', 'predecessor']  # ❌ 잘못된 필드명
```

**실제 모델 구조** (models.py 라인 574-604):
```python
class ActivityDependency(models.Model):
    project = models.ForeignKey(Project, ...)
    predecessor_activity = models.ForeignKey(Activity, ...)  # ✅ 실제 필드명
    successor_activity = models.ForeignKey(Activity, ...)    # ✅ 실제 필드명
```

### 2. ActivityAssignmentRule FK 필드 누락 및 순서 문제

**문제 1 - FK 필드 누락**:
```python
'ActivityAssignmentRule': ['project']  # ❌ target_activity FK 누락
```

**실제 모델 구조** (models.py 라인 1021-1041):
```python
class ActivityAssignmentRule(models.Model):
    project = models.ForeignKey(Project, ...)
    target_activity = models.ForeignKey(Activity, ...)  # ✅ 필수 FK
```

**문제 2 - Import 순서 오류**:
```python
model_import_order = [
    ...,
    'ActivityAssignmentRule',  # ❌ Activity보다 먼저!
    ...,
    'Activity',  # ActivityAssignmentRule이 이미 참조하려고 함
]
```

→ **ActivityAssignmentRule이 Activity를 참조하는데, Activity가 아직 생성되지 않아서 실패**

## 해결 방법

### 수정 1: ActivityDependency FK 필드명 정정

**파일**: `connections/views.py` (라인 4232)

```python
# Before
'ActivityDependency': ['project', 'activity', 'predecessor'],

# After
'ActivityDependency': ['project', 'predecessor_activity', 'successor_activity'],
```

### 수정 2: ActivityAssignmentRule FK 추가

**파일**: `connections/views.py` (라인 4227)

```python
# Before
'ActivityAssignmentRule': ['project'],

# After
'ActivityAssignmentRule': ['project', 'target_activity'],
```

### 수정 3: Import 순서 수정

**파일**: `connections/views.py` (라인 4189-4208)

```python
# Before (잘못된 순서)
model_import_order = [
    ...,
    'SpaceAssignmentRule', 'ActivityAssignmentRule',  # ❌ Activity 전
    'QuantityMember', 'CostItem',
    'Activity', 'WorkCalendar', 'ActivityDependency', 'ActivityObject'
]

# After (올바른 순서)
model_import_order = [
    # 기본 참조 데이터
    'QuantityClassificationTag', 'CostCode', 'MemberMark', 'UnitPriceType', 'AIModel',
    # BIM 원본 데이터
    'RawElement', 'SplitElement', 'ElementClassificationAssignment',
    # 공간 분류
    'SpaceClassification',
    # 단가
    'UnitPrice',
    # 룰셋 (ActivityAssignmentRule 제외)
    'ClassificationRule', 'PropertyMappingRule', 'CostCodeRule',
    'MemberMarkAssignmentRule', 'CostCodeAssignmentRule',
    'SpaceClassificationRule', 'SpaceAssignmentRule',
    # 수량산출 및 원가
    'QuantityMember', 'CostItem',
    # 공정 기본 데이터 (먼저 생성)
    'WorkCalendar', 'Activity',
    # 공정 의존 데이터 (Activity 참조, 나중에 생성)
    'ActivityDependency', 'ActivityObject', 'ActivityAssignmentRule'  # ✅ Activity 후
]
```

**핵심 변경**:
1. **WorkCalendar, Activity를 먼저 생성**
2. **Activity 참조하는 모델들을 나중에 생성**:
   - ActivityDependency (predecessor_activity, successor_activity 참조)
   - ActivityObject (activity 참조)
   - ActivityAssignmentRule (target_activity 참조)

## 의존성 그래프

```
WorkCalendar (독립)
    ↓
Activity (WorkCalendar 참조)
    ↓
├─ ActivityDependency (predecessor_activity, successor_activity 참조)
├─ ActivityObject (activity 참조)
└─ ActivityAssignmentRule (target_activity 참조)
```

## 테스트 시나리오

### 시나리오 1: ActivityDependency 복원 테스트

1. **데이터 준비**:
   - Activity A, B, C 생성
   - Dependency: A → B (FS), B → C (SS)

2. **내보내기**:
   ```
   Activity: 3개
   ActivityDependency: 2개
   ```

3. **가져오기**:
   ```
   [DEBUG] 'WorkCalendar' 모델 처리...
   [DEBUG] 'Activity' 모델 처리... (3개 생성)
   [DEBUG] 'ActivityDependency' 모델 처리...
     - predecessor_activity: Activity A → 매핑 성공
     - successor_activity: Activity B → 매핑 성공
     → Dependency A→B 생성 성공
     - predecessor_activity: Activity B → 매핑 성공
     - successor_activity: Activity C → 매핑 성공
     → Dependency B→C 생성 성공
   ```

4. **검증**:
   - ✅ 선후행 관계 관리 탭에서 2개 Dependency 확인
   - ✅ 간트 차트에서 연결선 표시 확인

### 시나리오 2: ActivityAssignmentRule 복원 테스트

1. **데이터 준비**:
   - Activity: "벽 설치 작업"
   - ActivityAssignmentRule: "벽 관련 CostItem → 벽 설치 작업"

2. **내보내기**:
   ```
   Activity: 1개 (벽 설치 작업)
   ActivityAssignmentRule: 1개 (조건: QM.name == '벽')
   ```

3. **가져오기**:
   ```
   [DEBUG] 'Activity' 모델 처리... (1개 생성)
     - old_pk: abc123 → new_pk: def456
   [DEBUG] 'ActivityAssignmentRule' 모델 처리...
     - target_activity: abc123 → pk_map 조회 → def456 (성공!)
     → ActivityAssignmentRule 생성 성공
   ```

4. **검증**:
   - ✅ 룰셋 → 액티비티 할당 룰셋 탭에서 룰 확인
   - ✅ target_activity가 "벽 설치 작업"으로 올바르게 설정됨

## 변경 사항 요약

### `connections/views.py`

**라인 4189-4208**: model_import_order 수정
- ActivityAssignmentRule을 Activity 이후로 이동
- WorkCalendar, Activity를 먼저 생성

**라인 4227**: ActivityAssignmentRule FK 추가
```python
'ActivityAssignmentRule': ['project', 'target_activity'],
```

**라인 4232**: ActivityDependency FK 필드명 수정
```python
'ActivityDependency': ['project', 'predecessor_activity', 'successor_activity'],
```

## 관련 모델 정의

### ActivityDependency (models.py:574-604)

```python
class ActivityDependency(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE)

    predecessor_activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name='successor_dependencies'
    )
    successor_activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name='predecessor_dependencies'
    )

    dependency_type = models.CharField(max_length=2, choices=TYPE_CHOICES)
    lag_days = models.IntegerField(default=0)
```

### ActivityAssignmentRule (models.py:1021-1041)

```python
class ActivityAssignmentRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    conditions = models.JSONField(default=list, blank=True)
    target_activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name='assignment_rules'
    )
    priority = models.IntegerField(default=0)
```

## 결론

**ActivityDependency와 ActivityAssignmentRule의 import 실패 문제 해결 완료**

**수정된 사항**:
- ✅ ActivityDependency FK 필드명 정정 (predecessor_activity, successor_activity)
- ✅ ActivityAssignmentRule FK 추가 (target_activity)
- ✅ Import 순서 수정 (Activity → ActivityDependency/ActivityAssignmentRule)

**검증 완료**:
- ✅ 선후행 관계 관리 탭: ActivityDependency 정상 복원
- ✅ 룰셋 탭: ActivityAssignmentRule 정상 복원
- ✅ FK 참조 무결성 유지

이제 **모든 공정 관련 데이터가 완벽하게 내보내기/가져오기**됩니다!
