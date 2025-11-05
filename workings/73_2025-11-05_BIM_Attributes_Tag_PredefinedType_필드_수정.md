# 73. 2025-11-05: BIM.Attributes.Tag 및 PredefinedType 필드 표시 수정

## 문제 상황

### 발견된 문제
1. **BIM원본데이터 탭**에서 `BIM.Attributes.Tag` 컬럼을 추가했으나 값이 표시되지 않음
2. `BIM.Attributes.PredefinedType`도 동일하게 표시되지 않음
3. Blender 애드온에서 Tag 속성을 추출하여 전송했으나 서버에서 누락됨
4. IFC 파일에는 실제로 Tag 값이 존재함 (예: "#마감 #바닥 #", "#벽돌 #벽 #")

### 근본 원인 분석

IFC 파일 검증 결과:
```python
Element: IfcSlab (ID: 1271)
  Tag (direct): #마감 #바닥 #
  Tag (getattr): #마감 #바닥 #
  Tag (get_info): #마감 #바닥 #

Element: IfcWall (ID: 1344)
  Tag (direct): #벽돌 #벽 #
  Tag (getattr): #벽돌 #벽 #
  Tag (get_info): #벽돌 #벽 #
```

**문제 원인:**
1. Blender 애드온 (`__init__.py` Line 116-117)에서 `Tag`와 `PredefinedType`을 **루트 레벨**에 추출
2. 서버 `consumers.py`의 `flatten_bim_data()` 함수 (Line 30)에서 `FIXED_FIELDS`에 `Tag`, `PredefinedType` 미포함
3. `sync_chunk_of_elements()` 함수 (Line 414)에서도 동일하게 `FIXED_FIELDS`에 누락
4. Line 417에서 `processed_item = {k: v for k, v in item.items() if k in FIXED_FIELDS}` 필터링 시 **Tag가 버려짐**
5. 결과적으로 `raw_data`에 `Tag` 필드가 저장되지 않음

## 해결 방법

### 1. 서버 `flatten_bim_data()` 함수 수정

**파일:** `/connections/consumers.py`
**위치:** Lines 29-32

**변경 전:**
```python
# 평탄화하지 않을 고정 필드들
FIXED_FIELDS = {'Name', 'IfcClass', 'ElementId', 'UniqueId', 'System'}
```

**변경 후:**
```python
# 평탄화하지 않을 고정 필드들
# ▼▼▼ [수정] Tag, PredefinedType 추가 (2025-11-05) ▼▼▼
FIXED_FIELDS = {'Name', 'IfcClass', 'ElementId', 'UniqueId', 'Tag', 'PredefinedType', 'System'}
# ▲▲▲ [수정] 여기까지 ▲▲▲
```

### 2. 서버 `sync_chunk_of_elements()` 함수 수정

**파일:** `/connections/consumers.py`
**위치:** Lines 414-417

**변경 전:**
```python
# 고정 필드만 유지하고 나머지 중첩 객체는 제거 (이미 평탄화됨)
# FIXED_FIELDS = {'Name', 'IfcClass', 'ElementId', 'UniqueId', 'System'}
FIXED_FIELDS = {'Name', 'IfcClass', 'ElementId', 'UniqueId', 'System'}
```

**변경 후:**
```python
# 고정 필드만 유지하고 나머지 중첩 객체는 제거 (이미 평탄화됨)
# ▼▼▼ [수정] Tag, PredefinedType 추가 (2025-11-05) ▼▼▼
FIXED_FIELDS = {'Name', 'IfcClass', 'ElementId', 'UniqueId', 'Tag', 'PredefinedType', 'System'}
# ▲▲▲ [수정] 여기까지 ▲▲▲
```

### 3. 디버깅 로그 추가

**파일:** `/connections/consumers.py`
**위치:** Lines 423-426

```python
# ▼▼▼ [디버깅] Tag 필드 확인 (2025-11-05) ▼▼▼
if 'Tag' in item and item['Tag']:
    print(f"    [DEBUG] Tag field found: {item['Tag']} -> processed_item.Tag: {processed_item.get('Tag', 'NOT FOUND')}")
# ▲▲▲ [디버깅] 여기까지 ▲▲▲
```

## 데이터 흐름

### 수정 전 (문제 상황)
```
Blender Addon:
  element_dict["Tag"] = "#벽돌 #벽 #"
      ↓
WebSocket 전송
      ↓
Server consumers.py:
  item['Tag'] → FIXED_FIELDS에 없음
      ↓
  processed_item = {k: v for k, v in item.items() if k in FIXED_FIELDS}
      ↓
  Tag 필드 제거됨 (필터링에서 버려짐) ❌
      ↓
DB raw_data:
  Tag 필드 없음 ❌
      ↓
Frontend ui.js:
  BIM.Attributes.Tag → internalField = 'Tag'
      ↓
  raw_data.Tag 조회 → undefined ❌
```

### 수정 후 (정상 동작)
```
Blender Addon:
  element_dict["Tag"] = "#벽돌 #벽 #"
      ↓
WebSocket 전송
      ↓
Server consumers.py:
  item['Tag'] → FIXED_FIELDS에 포함 ✅
      ↓
  processed_item = {k: v for k, v in item.items() if k in FIXED_FIELDS}
      ↓
  Tag 필드 유지됨 ✅
      ↓
DB raw_data:
  { "Tag": "#벽돌 #벽 #", ... } ✅
      ↓
Frontend ui.js:
  BIM.Attributes.Tag → internalField = 'Tag'
      ↓
  raw_data.Tag 조회 → "#벽돌 #벽 #" ✅
```

## 기존 코드 검증

### Blender 애드온 (이미 완료)
**파일:** `/CostEstimator_BlenderAddon_453/__init__.py`
**위치:** Lines 116-117

```python
element_dict = {
    "Name": element.Name or "이름 없음",
    "IfcClass": element.is_a(),
    "ElementId": element.id(),
    "UniqueId": element.GlobalId,
    "Tag": getattr(element, 'Tag', None) or "",  # ✅ 이미 추가됨
    "PredefinedType": getattr(element, 'PredefinedType', None) or "",  # ✅ 이미 추가됨
    # ...
}
```

### 프론트엔드 (이미 완료)
**파일:** `/connections/static/connections/ui.js`
**위치:** Lines 31-35, 51-55

```javascript
// ✅ ifcAttributeProps에 이미 포함됨
const ifcAttributeProps = ['Name', 'IfcClass', 'ElementId', 'UniqueId', 'Description',
                            'RelatingType', 'SpatialContainer', 'Aggregates', 'Nests',
                            'Tag', 'PredefinedType'];

// ✅ BIM.Attributes.* 변환 로직 이미 구현됨
if (displayField.startsWith('BIM.Attributes.')) {
    return displayField.substring(15); // 'BIM.Attributes.' 제거
}
```

**값 조회 로직** (Lines 119, 128):
```javascript
// 1차: item에서 직접 조회
if (internalField in item && internalField !== 'raw_data')
    return item[internalField] ?? '';

// 2차: raw_data에서 조회
if (internalField in raw_data)
    return raw_data[internalField] ?? '';
```

## 결과

### 수정 전
- `BIM.Attributes.Tag` 컬럼에 빈 값만 표시
- `BIM.Attributes.PredefinedType` 컬럼에 빈 값만 표시
- IFC 파일에는 데이터가 존재하나 DB에 저장되지 않음

### 수정 후
- ✅ `BIM.Attributes.Tag` 컬럼에 실제 값 표시 (예: "#벽돌 #벽 #")
- ✅ `BIM.Attributes.PredefinedType` 컬럼에 실제 값 표시
- ✅ 서버 콘솔에 디버깅 로그 출력: `[DEBUG] Tag field found: #벽돌 #벽 # -> processed_item.Tag: #벽돌 #벽 #`

## 영향 범위

### 수정된 파일
1. `/connections/consumers.py`
   - `flatten_bim_data()` 함수의 `FIXED_FIELDS` (Line 31)
   - `sync_chunk_of_elements()` 함수의 `FIXED_FIELDS` (Line 416)
   - 디버깅 로그 추가 (Lines 423-426)

### 수정되지 않은 파일 (이미 완료되어 있음)
1. `/CostEstimator_BlenderAddon_453/__init__.py` - Tag 추출 로직 이미 구현됨
2. `/connections/static/connections/ui.js` - Tag 변환 및 조회 로직 이미 구현됨

## 기술적 배경

### FIXED_FIELDS의 역할
- **목적**: 평탄화하지 않고 루트 레벨에 그대로 유지할 필드들
- **기존 필드**: Name, IfcClass, ElementId, UniqueId, System
- **추가 필드**: Tag, PredefinedType (IFC 표준 속성)

### 평탄화 전략
1. **고정 필드**: 루트 레벨에 그대로 유지
   - 예: `raw_data.Name`, `raw_data.Tag`
2. **동적 필드**: 딕셔너리 구조를 평탄화
   - 예: `PropertySet.Pset_WallCommon__IsExternal` → `raw_data['PropertySet.Pset_WallCommon__IsExternal']`
3. **특수 필드**: Geometry는 중첩 구조 유지 (3D 렌더링용)

### IFC 표준 속성
- **Tag**: 요소의 식별 태그 (예: "#벽돌 #벽 #")
- **PredefinedType**: 요소의 사전 정의된 타입 (IFC 표준)
- 두 속성 모두 IFC 스키마의 표준 속성으로, 루트 레벨에 저장하는 것이 적절

## 참고사항

이 수정으로 IFC의 모든 표준 루트 레벨 속성이 올바르게 저장됩니다:
- ✅ Name
- ✅ IfcClass
- ✅ ElementId
- ✅ UniqueId
- ✅ Tag (이번 수정)
- ✅ PredefinedType (이번 수정)
- ✅ System (Geometry 포함)

동적으로 추출되는 속성들 (PropertySet, QuantitySet, Type, Spatial_Container 등)은 평탄화되어 저장됩니다.
