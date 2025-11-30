# 105. Property Mapping 플랫화 키 처리 수정 (2025-11-30)

## 문제 상황

속성 맵핑 룰셋에서 `{BIM.Type.PropertySet.치수__b}` 형식의 속성 경로가 적용되지 않는 문제 발생.

### 오류 메시지
```
Error: Parameter 'Type.PropertySet.치수__b' (from 'BIM.Type.PropertySet.치수__b') not found
```

## 원인 분석

1. **raw_data 키 구조**: Revit에서 전송된 데이터의 키가 **플랫화된 형태**로 저장됨
   - 예: `"Type.PropertySet.기타__b": "600.0"` (중첩 객체가 아님)

2. **기존 함수의 한계**: `get_value_from_element()` 함수가 중첩 구조만 탐색
   - `raw_data['Type']['PropertySet']['기타__b']` 형식으로만 검색
   - 플랫화된 키 `raw_data['Type.PropertySet.기타__b']`는 검색 불가

3. **PropertySet 이름 불일치**:
   - 룰셋에서 사용: `치수__b`
   - 실제 데이터: `기타__b`

## 수정 내용

### 1. get_value_from_element 함수 개선 (views.py:454-487)

```python
def get_value_from_element(raw_data, parameter_name):
    """
    점(.)이 포함된 키를 해석하여 중첩된 객체의 값을 찾아옵니다.
    """
    if not raw_data or not parameter_name:
        return None

    # 0. [수정] 전체 parameter_name을 평탄화된 키로 먼저 시도 (2025-11-29)
    # raw_data의 키가 "Type.PropertySet.치수__b" 형태로 평탄화되어 있는 경우 먼저 처리
    if parameter_name in raw_data:
        return raw_data[parameter_name]

    # Parameters/TypeParameters 내부에서도 평탄화된 키 검색
    if 'Parameters' in raw_data and isinstance(raw_data['Parameters'], dict):
        if parameter_name in raw_data['Parameters']:
            return raw_data['Parameters'][parameter_name]
    if 'TypeParameters' in raw_data and isinstance(raw_data['TypeParameters'], dict):
        if parameter_name in raw_data['TypeParameters']:
            return raw_data['TypeParameters'][parameter_name]

    # 1. 점(.)을 기준으로 키를 분리
    parts = parameter_name.split('.')

    # [수정] 부분 평탄화된 키도 시도 (2025-11-29)
    # 예: parts = ['Type', 'PropertySet', '기타__b']
    # 시도 2: raw_data['Type']['PropertySet.기타__b'] (부분 평탄화)
    if len(parts) >= 2:
        first_key = parts[0]
        rest_path = '.'.join(parts[1:])

        if first_key in raw_data and isinstance(raw_data[first_key], dict):
            if rest_path in raw_data[first_key]:
                return raw_data[first_key][rest_path]
            # 시도 3: 재귀적으로 중첩 경로 탐색
            nested_value = get_value_from_element(raw_data[first_key], rest_path)
            if nested_value is not None:
                return nested_value

    # ... 기존 중첩 구조 탐색 로직 유지
```

### 2. consumers.py 이모지 제거

Windows cp949 인코딩에서 Unicode 이모지 출력 시 오류 발생:
```
UnicodeEncodeError: 'cp949' codec can't encode character '\u2705'
```

**수정**: 모든 이모지를 ASCII로 교체
- ✅ → `[OK]`
- ❌ → `[X]`
- ⚠️ → `[WARN]`
- ✉️ → `[MSG]`
- ➡️ → `->`
- 🚀 → `[START]`

### 3. URL 라우팅 정리 (urls.py)

구현되지 않은 AI Classification API 라우트로 인한 오류 수정:
```
AttributeError: module 'connections.views' has no attribute 'add_training_data'
```

**수정**: 미구현 라우트 주석 처리

## 검색 우선순위 (수정 후)

`get_value_from_element("Type.PropertySet.기타__b")` 호출 시:

1. **플랫화 키 직접 검색**: `raw_data["Type.PropertySet.기타__b"]`
2. **Parameters 내 플랫화 키**: `raw_data["Parameters"]["Type.PropertySet.기타__b"]`
3. **TypeParameters 내 플랫화 키**: `raw_data["TypeParameters"]["Type.PropertySet.기타__b"]`
4. **부분 평탄화**: `raw_data["Type"]["PropertySet.기타__b"]`
5. **완전 중첩 구조**: `raw_data["Type"]["PropertySet"]["기타__b"]`
6. **기존 탐색 로직**: Parameters/TypeParameters 내부 중첩 검색

## 테스트 결과

1. 서버 시작 - 이모지 오류 없이 정상 작동
2. Revit 연결 성공
3. Frontend WebSocket 연결 성공
4. `{BIM.Type.PropertySet.기타__b}` 룰셋 적용 성공

## 사용자 가이드

### 올바른 속성 경로 확인 방법

1. 웹 브라우저에서 **BIM 원본데이터** 탭 열기
2. 오른쪽 **도우미 패널**에서 속성 확인
3. 표시되는 정확한 경로 사용 (예: `BIM.Type.PropertySet.기타__b`)

### PropertySet 이름 규칙

Revit에서 PropertySet 이름은 그룹 이름에서 가져옴:
- 레빗 속성 그룹 "기타" → `Type.PropertySet.기타__속성명`
- 레빗 속성 그룹 "치수" → `Type.PropertySet.치수__속성명`

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `connections/views.py` | `get_value_from_element()` 플랫화 키 검색 로직 추가 |
| `connections/consumers.py` | 모든 Unicode 이모지를 ASCII로 교체 |
| `connections/urls.py` | 미구현 AI Classification 라우트 주석 처리 |

## 버전 정보

- 버전: 1.3.2
- 수정일: 2025-11-30
