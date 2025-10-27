# 34. 3D 객체 실제 형상 분할 기능 구현 (CSG)

**날짜**: 2025-10-27
**작업 내용**: CSG (Constructive Solid Geometry) 라이브러리를 사용한 실제 형상 분할 구현

## 문제 상황

이전 프로토타입에서는 clipping planes를 사용하여 시각적으로만 객체를 분할했습니다. 이 방식은:
- 실제로 geometry의 vertices와 faces를 나누지 않음
- 두 분할 부분이 동일한 vertex/face 개수를 가짐
- 데이터베이스에 저장하거나 별도 수량 계산이 불가능

## 해결 방법

### 1. CSG 라이브러리 추가

**파일**: `connections/templates/revit_control.html`

Three.js r140과 호환되는 CSG 라이브러리 추가:

```html
<!-- CSG libraries for geometry splitting -->
<script src="https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.6.8/build/index.umd.cjs"></script>
<script src="https://cdn.jsdelivr.net/npm/three-bvh-csg@0.0.15/build/index.umd.cjs"></script>
```

**라이브러리 설명**:
- `three-mesh-bvh`: BVH (Bounding Volume Hierarchy) 가속 구조
- `three-bvh-csg`: CSG 불리언 연산 (INTERSECTION, SUBTRACTION, UNION 등)

### 2. CSG 기반 분할 함수 구현

**파일**: `connections/static/connections/three_d_viewer.js`

#### 주요 변경사항

**기존 방식** (Clipping Planes):
```javascript
// 시각적으로만 분할
const planeTop = new THREE.Plane(new THREE.Vector3(0, 0, -1), -midZ);
mat1.clippingPlanes = [planeTop];
```

**새로운 방식** (CSG Operations):
```javascript
// 실제 geometry 분할
const evaluator = new THREE.Evaluator();
const baseBrush = new THREE.Brush(selectedObject.geometry);

// 분할 박스 생성
const bottomBrush = new THREE.Brush(bottomBoxGeom);
const topBrush = new THREE.Brush(topBoxGeom);

// CSG INTERSECTION 연산
const bottomResult = evaluator.evaluate(baseBrush, bottomBrush, INTERSECTION);
const topResult = evaluator.evaluate(baseBrush, topBrush, INTERSECTION);
```

#### 분할 알고리즘

1. **Bounding Box 계산**: 객체의 범위를 계산하여 중간점 결정
2. **분할 평면 결정**: Z축 중간점에서 수평 분할
3. **Cutting Boxes 생성**:
   - Bottom box: midZ 아래 영역을 포함하는 박스
   - Top box: midZ 위 영역을 포함하는 박스
4. **CSG INTERSECTION 연산**:
   - 원본 객체 ∩ Bottom box = 하단 부분
   - 원본 객체 ∩ Top box = 상단 부분
5. **결과 Mesh 생성**: 분할된 geometry로 새 mesh 생성

### 3. UI 업데이트

**파일**: `connections/templates/three_d_viewer.html`

버튼 텍스트 변경:
```html
<!-- 이전 -->
<button id="split-object-btn" disabled>Split Object (Prototype)</button>

<!-- 변경 후 -->
<button id="split-object-btn" disabled>Split Object</button>
```

## 구현 세부사항

### CSG 라이브러리 로드 확인

```javascript
// CSG 라이브러리가 제대로 로드되었는지 확인
if (typeof THREE.Brush === 'undefined' || typeof THREE.Evaluator === 'undefined') {
    console.error('[3D Viewer] CSG libraries not loaded.');
    showToast('CSG 라이브러리가 로드되지 않았습니다', 'error');
    return;
}
```

### Cutting Box 위치 계산

```javascript
// Bottom cutting box (midZ 아래 절반 공간)
bottomBrush.position.set(
    (bbox.min.x + bbox.max.x) / 2,  // X 중심
    (bbox.min.y + bbox.max.y) / 2,  // Y 중심
    bbox.min.z + (midZ - bbox.min.z) / 2  // Z: 하단~midZ 사이의 중점
);

// Top cutting box (midZ 위 절반 공간)
topBrush.position.set(
    (bbox.min.x + bbox.max.x) / 2,
    (bbox.min.y + bbox.max.y) / 2,
    midZ + (bbox.max.z - midZ) / 2  // Z: midZ~상단 사이의 중점
);
```

### CSG 연산 타입 호환성 처리

```javascript
// 다양한 라이브러리 버전 지원을 위한 fallback
const INTERSECTION = THREE.INTERSECTION ||
                     (window.OPERATIONS && window.OPERATIONS.INTERSECTION) ||
                     1;
```

### Metadata 보존

분할된 객체는 원본 객체의 모든 metadata를 상속받고 추가 정보 저장:

```javascript
bottomMesh.userData = {
    ...selectedObject.userData,        // 원본 데이터 상속
    isSplitPart: true,                // 분할 부분임을 표시
    splitPartType: 'bottom',          // 하단/상단 구분
    originalObjectId: selectedObject.userData.bimObjectId,  // 원본 객체 ID
    splitPlaneZ: midZ                 // 분할 평면 위치
};
```

## 예상 결과

### 이전 (Clipping Planes)
```
Bottom geometry:
  vertices: 8
  faces: 12

Top geometry:
  vertices: 8
  faces: 12
```
→ 동일한 geometry, 시각적으로만 분할

### 현재 (CSG Operations)
```
Bottom geometry:
  vertices: 12+  (실제로 분할된 vertex)
  faces: 18+     (실제로 분할된 face)

Top geometry:
  vertices: 12+
  faces: 18+
```
→ 실제로 다른 geometry, 물리적으로 분할됨

## 테스트 방법

1. **3D 뷰어 탭 열기**: 상단 네비게이션에서 "🧊 3D 뷰어" 클릭
2. **Geometry 로드**: "Load Geometry" 버튼 클릭
3. **객체 선택**: 3D 뷰에서 객체 클릭
4. **분할 실행**: "Split Object" 버튼 클릭
5. **콘솔 확인**:
   - "CSG operations complete" 메시지 확인
   - Bottom/Top geometry data의 vertex/face 개수 확인
   - 두 부분의 개수가 달라야 함 (실제 분할 성공)

## 예상 이슈 및 해결

### Issue 1: CSG 라이브러리 로드 실패
**증상**: "CSG 라이브러리가 로드되지 않았습니다" 에러
**원인**: UMD 빌드 경로 또는 버전 호환성 문제
**해결**:
- CDN 링크 확인
- 브라우저 콘솔에서 `THREE.Brush`, `THREE.Evaluator` 존재 여부 확인
- 필요시 다른 버전의 라이브러리 시도

### Issue 2: INTERSECTION 상수 undefined
**증상**: "INTERSECTION is not defined" 에러
**원인**: CSG 라이브러리의 상수 노출 방식이 다름
**해결**:
- 이미 fallback 로직 구현됨
- 다른 namespace 확인: `window.OPERATIONS`, `THREE.OPERATIONS` 등

### Issue 3: Geometry가 비어있거나 잘못됨
**증상**: 분할 후 아무것도 표시되지 않음
**원인**: Cutting box 크기나 위치가 잘못됨
**해결**:
- Bounding box 확인
- Cutting box 크기를 더 크게 조정 (현재 2배로 설정됨)

## 다음 단계

1. **분할 평면 조정 UI**: 슬라이더로 분할 위치 조정
2. **다양한 분할 방식**: X축, Y축 분할 추가
3. **SubObject 모델 생성**: Django 모델 구현
4. **데이터베이스 저장**: 분할된 geometry를 DB에 저장
5. **수량 계산**: 분할된 각 부분의 수량 자동 계산
6. **데이터 상속**: Parent → SubObject 데이터 상속 및 override 구현

## 기술적 배경

### CSG (Constructive Solid Geometry)란?

CSG는 단순한 기하학적 도형들을 불리언 연산으로 결합하여 복잡한 형상을 만드는 방법입니다.

**주요 연산**:
- **UNION (합집합)**: A ∪ B - 두 객체를 합침
- **SUBTRACTION (차집합)**: A - B - A에서 B를 뺌
- **INTERSECTION (교집합)**: A ∩ B - 두 객체가 겹치는 부분만 남김

**이 프로젝트에서의 사용**:
- 원본 객체 ∩ 하단 박스 = 하단 부분
- 원본 객체 ∩ 상단 박스 = 상단 부분

### three-mesh-bvh의 역할

BVH (Bounding Volume Hierarchy)는 3D 공간을 계층적으로 나누어 ray casting이나 collision detection을 빠르게 만드는 자료구조입니다. CSG 연산에서는:
- 삼각형 교차 계산 가속화
- 복잡한 mesh의 CSG 연산 성능 향상

## 수정된 파일 목록

1. ✅ `connections/templates/revit_control.html` - CSG 라이브러리 추가
2. ✅ `connections/static/connections/three_d_viewer.js` - CSG 기반 분할 함수 구현
3. ✅ `connections/templates/three_d_viewer.html` - 버튼 텍스트 업데이트

## 참고 자료

- [three-mesh-bvh GitHub](https://github.com/gkjohnson/three-mesh-bvh)
- [three-bvh-csg GitHub](https://github.com/gkjohnson/three-bvh-csg)
- [Three.js r140 Documentation](https://threejs.org/docs/index.html#manual/en/introduction/Creating-a-scene)
- [CSG on Wikipedia](https://en.wikipedia.org/wiki/Constructive_solid_geometry)
