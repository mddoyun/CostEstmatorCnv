# 룰셋 시스템 (Ruleset System)

## 개요

룰셋 시스템은 BIM 데이터를 자동으로 분류, 가공, 계산하는 규칙 기반 자동화 시스템입니다. 사용자가 정의한 규칙에 따라 BIM 객체들을 분류하고, 속성을 추출하며, 수량을 계산하고, 공사코드를 할당합니다.

## 룰셋 처리 순서

1. **분류 룰셋 (Classification Ruleset)**: BIM 원본 객체에 분류 태그 할당
2. **속성 맵핑 룰셋 (Property Mapping Ruleset)**: 분류된 객체의 속성을 추출하여 수량산출부재 생성
3. **일람부호 할당 룰셋 (Member Mark Assignment Ruleset)**: 수량산출부재에 일람부호 할당
4. **공사코드 룰셋 (Cost Code Ruleset)**: 수량산출부재에 공사코드 할당 및 수량 계산
5. **공사코드 할당 룰셋 (Cost Code Assignment Ruleset)**: 추가 공사코드 할당 규칙
6. **공간 분류/할당 룰셋 (Space Rulesets)**: 공간 구조 생성 및 할당
7. **공정 할당 룰셋 (Activity Assignment Ruleset)**: 공정(Activity) 할당

## 룰셋 목록

### 1. 분류 룰셋 (Classification Ruleset)
- **파일**: `ruleset_classification_handlers.js`
- **목적**: BIM 원본 객체(RawElement)를 분류 태그로 자동 분류
- **입력**: RawElement 속성 (Category, Family, Type, Level, Parameters 등)
- **출력**: QuantityClassificationTag 할당
- **상세**: [classification_ruleset.md](./classification_ruleset.md)

### 2. 속성 맵핑 룰셋 (Property Mapping Ruleset)
- **파일**: `ruleset_property_mapping_handlers.js`
- **목적**: BIM 객체의 속성을 추출하여 수량산출부재(QuantityMember)의 속성으로 매핑
- **입력**: RawElement 속성
- **출력**: QuantityMember properties 필드
- **상세**: [property_mapping_ruleset.md](./property_mapping_ruleset.md)

### 3. 공사코드 룰셋 (Cost Code Ruleset)
- **파일**: `ruleset_cost_code_handlers.js`
- **목적**: 수량산출부재에 공사코드 할당 및 수량 계산식 정의
- **입력**: QuantityMember 속성 (name, classification_tag, properties, MM, RE)
- **출력**: CostCode 할당 및 quantity_mapping_script 실행
- **상세**: [cost_code_ruleset.md](./cost_code_ruleset.md)

### 4. 일람부호 할당 룰셋 (Member Mark Assignment Ruleset)
- **파일**: `ruleset_member_mark_assignment_handlers.js`
- **목적**: 수량산출부재에 일람부호(MemberMark) 할당
- **입력**: QuantityMember 속성
- **출력**: MemberMark 할당 (패턴 기반 자동 증가)
- **상세**: [member_mark_assignment_ruleset.md](./member_mark_assignment_ruleset.md)

### 5. 공사코드 할당 룰셋 (Cost Code Assignment Ruleset)
- **파일**: `ruleset_cost_code_assignment_handlers.js`
- **목적**: 수량산출부재에 공사코드 할당 (공사코드 룰셋과 유사하나 다른 조건 사용)
- **입력**: QuantityMember 속성, MemberMark 속성 (MM.*)
- **출력**: CostCode 할당
- **상세**: [cost_code_assignment_ruleset.md](./cost_code_assignment_ruleset.md)

### 6. 공간 분류 룰셋 (Space Classification Ruleset)
- **파일**: `ruleset_space_classification_handlers.js`
- **목적**: BIM 객체로부터 공간(Space) 구조 생성
- **입력**: RawElement 속성
- **출력**: Space 객체 생성 (층, 실 등)
- **상세**: [space_classification_ruleset.md](./space_classification_ruleset.md)

### 7. 공간 할당 룰셋 (Space Assignment Ruleset)
- **파일**: `ruleset_space_assignment_handlers.js`
- **목적**: 수량산출부재를 공간에 할당
- **입력**: QuantityMember 속성
- **출력**: Space 할당
- **상세**: [space_assignment_ruleset.md](./space_assignment_ruleset.md)

### 8. 공정 할당 룰셋 (Activity Assignment Ruleset)
- **파일**: `ruleset_activity_assignment_handlers.js`
- **목적**: 수량산출부재를 공정(Activity)에 할당
- **입력**: QuantityMember 속성
- **출력**: Activity 할당
- **상세**: [activity_assignment_ruleset.md](./activity_assignment_ruleset.md)

## 조건 빌더 (Condition Builder)

모든 룰셋은 조건을 정의하여 규칙을 적용할 대상을 선택합니다.

### 조건 구조
```javascript
{
  "property": "속성명",  // 검사할 속성
  "operator": "==",      // 연산자
  "value": "값"          // 비교할 값
}
```

### 지원하는 연산자
- `==`: 같음
- `!=`: 다름
- `contains`: 포함
- `startsWith`: ~로 시작
- `endsWith`: ~로 끝남
- `>`, `<`, `>=`, `<=`: 크기 비교

### 속성 참조 형식

**RawElement (RE) 기반 룰셋:**
- `Category`: 카테고리
- `Family`: 패밀리
- `Type`: 타입
- `Level`: 레벨
- `Parameters.속성명`: 인스턴스 파라미터
- `TypeParameters.속성명`: 타입 파라미터

**QuantityMember (QM) 기반 룰셋:**
- `name`: 부재 이름
- `classification_tag`: 분류 태그
- `properties.속성명`: 부재 속성
- `MM.속성명`: 일람부호 속성
- `RE.속성명`: 원본 BIM 객체 속성

## 맵핑 빌더 (Mapping Builder)

속성 맵핑 룰셋과 공사코드 룰셋에서 사용하는 키-값 매핑 인터페이스입니다.

### 템플릿 표현식
중괄호 `{}` 안에 속성명을 넣어 값을 참조합니다:
```javascript
{
  "길이": "{Parameters.길이}",
  "높이": "{Parameters.높이}",
  "면적": "{properties.면적}"
}
```

### 계산식 예제
```javascript
{
  "수량": "{properties.면적} * 1.1",  // 10% 할증
  "단위": "m2"
}
```

## UI 개선 사항 (2025-11-01)

### 이전 방식
- JSON textarea에 직접 입력
- 문법 오류 발생 가능
- 속성명을 외우거나 추측해야 함

### 개선된 방식
- **조건 빌더**: 드롭다운으로 속성, 연산자, 값 선택
- **맵핑 빌더**: 키-값 쌍을 입력창으로 직관적으로 입력
- **헬퍼 패널**: BIM 원본 데이터 탭에서 실제 속성명 확인 가능
- **읽기 전용 표시**: 사람이 읽기 쉬운 형태로 표시
  - `name == "벽"` (이전: `{"property": "name", "operator": "==", "value": "벽"}`)

## 룰셋 작성 도우미

### BIM 원본 데이터 탭 - 룰셋 작성 도우미 패널
- BIM 원본 데이터 탭에서 객체를 선택하면 우측 패널에 속성 표시
- 속성이 룰셋에서 사용 가능한 형태로 표시됨: `{Category}`, `{Parameters.속성명}`
- 시스템 속성, Parameters, TypeParameters로 그룹화
- 스크롤 가능, 각 속성과 값이 테이블 형식으로 깔끔하게 표시

### 테이블 레이아웃
- 모든 룰셋 테이블은 좌우 스크롤 지원
- 고정 열 너비로 일관성 유지
- 긴 내용도 word-wrap으로 깔끔하게 표시

## 베스트 프랙티스

1. **분류를 먼저 정의**: 속성 맵핑과 다른 룰셋은 분류를 기반으로 작동
2. **우선순위 활용**: 여러 규칙이 충돌할 때 우선순위로 제어
3. **조건을 구체적으로**: 너무 광범위한 조건은 의도하지 않은 결과 초래
4. **헬퍼 패널 활용**: 실제 BIM 데이터의 속성명을 확인하고 복사하여 사용
5. **테스트**: 룰셋 적용 후 결과를 확인하고 필요시 조정

## 문제 해결

### 룰셋이 적용되지 않는 경우
1. 조건이 올바른지 확인 (속성명, 연산자, 값)
2. 우선순위 확인 (다른 규칙과 충돌 여부)
3. 대상 객체가 조건을 만족하는지 확인 (BIM 원본 데이터 탭에서 확인)

### 속성을 찾을 수 없는 경우
1. BIM 원본 데이터 탭에서 객체 선택
2. 우측 룰셋 작성 도우미 패널에서 속성명 확인
3. 속성명을 정확히 복사하여 사용 (대소문자 구분)

### 계산식이 작동하지 않는 경우
1. 템플릿 표현식 문법 확인: `{속성명}` 형식
2. 참조하는 속성이 실제로 존재하는지 확인
3. 수식에 오류가 없는지 확인 (예: 나누기 0)

## 참고 문서

- [CLAUDE.md](../../CLAUDE.md): 전체 프로젝트 개요
- [workings/](../../workings/): 상세 변경 이력
