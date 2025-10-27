# 35. 3D 객체 분할 축 방향 수정 및 렌더링 개선

**날짜**: 2025-10-28
**작업 내용**: 3D 분할 기능의 축 방향 오류 수정, 사선 음영 제거, 렌더링 방식 개선

## 문제 상황

이전에 구현한 3D 객체 분할 기능에서 여러 문제가 발생:

### 1. 축 방향 매핑 오류
- Z축 선택 시 X축 평면이 표시됨
- Y축 선택 시 Z축 평면이 표시됨
- 실제 분할 방향과 UI에 표시되는 평면이 불일치

### 2. 평면 이동 방향 오류
- Z축 선택 시 슬라이더 조정하면 Y 방향으로 이동
- Y축 선택 시 아예 이동하지 않거나 반대 방향으로 이동

### 3. 사선 음영 문제
- 분할 후 객체 표면에 대각선 줄무늬(diagonal shading) 발생
- 삼각형 메시의 내부 edge가 그대로 표시됨
- 원본 객체 로드 시에도 동일한 문제 존재

### 4. Edge Lines 문제
- EdgesGeometry threshold 조정으로는 외곽선만 표시 불가능
- 평면 표면 내부의 삼각형 선까지 모두 표시됨

## 해결 방법

### 1. 축 방향 매핑 수정

**단계 1: Y축과 Z축 로직 교환 시도**

초기에는 Y축과 Z축의 전체 로직을 서로 교환:

```javascript
// updateSliderRange()
if (axis === 'z') {
    min = bbox.min.y;  // Z축 선택 → Y 범위 사용
    max = bbox.max.y;
} else if (axis === 'y') {
    min = bbox.min.z;  // Y축 선택 → Z 범위 사용
    max = bbox.max.z;
}
```

**결과**: 작동하지 않음. 사용자가 원하는 동작과 반대로 작동.

**단계 2: 원래대로 복구 및 평면 Helper만 수정**

사용자 요구사항 이해:
- **Z축 선택**: 수직으로 자르고 싶음 → 수평면(XY plane) 보여야 함
- **Y축 선택**: 수평으로 자르고 싶음 → 수직면(XZ plane) 보여야 함

**최종 해결책** (`updateSplitPlaneHelper()`):

```javascript
if (axis === 'z') {
    // Z axis cut → 수직으로 자름 → 수평면(XY) 보임
    // PlaneGeometry: already XY (no rotation needed)
    // GridHelper: XZ → XY (rotate -90° around X)
    gridHelper.rotation.x = -Math.PI / 2;
    localPlanePos.set(
        (bbox.min.x + bbox.max.x) / 2,
        (bbox.min.y + bbox.max.y) / 2,
        planePosition  // Z position = planePosition (local)
    );
} else if (axis === 'y') {
    // Y axis cut → 수평으로 자름 → 수직면(XZ) 보임
    // PlaneGeometry: XY → XZ (rotate -90° around X)
    // GridHelper: already XZ (no rotation needed)
    planeMesh.rotation.x = -Math.PI / 2;
    localPlanePos.set(
        (bbox.min.x + bbox.max.x) / 2,
        planePosition,  // Y position = planePosition (local)
        (bbox.min.z + bbox.max.z) / 2
    );
}
```

**핵심**: Plane helper의 rotation만 수정, normal vector와 slider 범위는 원래대로 유지.

### 2. 사선 음영 문제 해결

**시도 1: Vertex Merging**

원본 및 분할 geometry 로드 시 중복 vertex 병합:

```javascript
// 원본 객체 로드
geometry.deleteAttribute('normal');
geometry = THREE.BufferGeometryUtils.mergeVertices(geometry, 1e-3);
geometry.computeVertexNormals();
geometry.normalizeNormals();

// 분할 객체
bottomGeometry = THREE.BufferGeometryUtils.mergeVertices(bottomGeometry, 1e-3);
topGeometry = THREE.BufferGeometryUtils.mergeVertices(topGeometry, 1e-3);
bottomGeometry.computeVertexNormals();
topGeometry.computeVertexNormals();
bottomGeometry.normalizeNormals();
topGeometry.normalizeNormals();
```

**결과**: 사선 음영이 약간 개선되었으나 완전히 제거되지 않음.

**시도 2: Flat Shading으로 변경**

Smooth shading이 삼각형 경계를 음영으로 보이게 만드는 것으로 판단:

```javascript
// 모든 material을 flat shading으로 변경
const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.0,
    roughness: 1.0,         // High roughness for uniform appearance
    flatShading: true,      // Flat shading to eliminate diagonal artifacts
    side: THREE.DoubleSide
});
```

**결과**: ✅ 사선 음영 대폭 감소. 각 삼각형 face가 단색으로 렌더링되어 음영 패턴이 덜 눈에 띔.

### 3. Edge Lines 처리

**시도 1: EdgesGeometry Threshold 상향** (30° → 80° → 89° → 89.9°)

```javascript
const edges = new THREE.EdgesGeometry(geometry, 89.9);
```

**결과**: ❌ 평면 표면 내부의 삼각형 선도 여전히 표시됨.

**시도 2: Edge Lines 완전 제거**

```javascript
// Don't add edge lines - they show internal triangulation
// Using flat shading + shadows for visual distinction instead
```

**결과**: 표면은 깨끗하지만 외곽선도 사라짐. 사용자가 외곽선을 원함.

**시도 3: Boundary Edge Detection 구현**

진짜 외곽선만 추출하는 알고리즘 구현:

```javascript
function getBoundaryEdges(geometry) {
    const edges = new Map(); // Map of "i1-i2" -> count
    const positions = geometry.attributes.position;
    const indices = geometry.index ? geometry.index.array : null;

    // Count how many faces share each edge
    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        // Three edges per triangle
        const edge1 = [Math.min(i0, i1), Math.max(i0, i1)].join('-');
        const edge2 = [Math.min(i1, i2), Math.max(i1, i2)].join('-');
        const edge3 = [Math.min(i2, i0), Math.max(i2, i0)].join('-');

        edges.set(edge1, (edges.get(edge1) || 0) + 1);
        edges.set(edge2, (edges.get(edge2) || 0) + 1);
        edges.set(edge3, (edges.get(edge3) || 0) + 1);
    }

    // Extract edges that appear only once (boundary edges)
    const boundaryEdges = [];
    for (const [edgeKey, count] of edges.entries()) {
        if (count === 1) {
            const [i0, i1] = edgeKey.split('-').map(Number);
            boundaryEdges.push(
                positions.getX(i0), positions.getY(i0), positions.getZ(i0),
                positions.getX(i1), positions.getY(i1), positions.getZ(i1)
            );
        }
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(boundaryEdges, 3));
    return lineGeometry;
}
```

**원리**:
- Edge가 1개 face에만 속함 → Boundary edge (외곽선)
- Edge가 2개 이상 face에 공유됨 → Internal edge (내부 선)

**결과**: ❌ 구현은 완료했으나 외곽선이 제대로 표시되지 않음. 원인 불명.

**최종 결정**: Edge lines 없이 flat shading만 사용하기로 함. 추후 개선 예정.

## 수정된 파일

### 1. `connections/static/connections/three_d_viewer.js`

#### 주요 수정 사항

**원본 Geometry 로드 (lines 530-578):**
```javascript
// Create geometry from vertices and faces
let geometry = new THREE.BufferGeometry();  // const → let

// Merge duplicate vertices to fix diagonal shading artifacts
geometry.deleteAttribute('normal');
geometry = THREE.BufferGeometryUtils.mergeVertices(geometry, 1e-3);
geometry.computeVertexNormals();
geometry.normalizeNormals();

// Create material with flat shading
const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.0,
    roughness: 1.0,
    flatShading: true,
    side: THREE.DoubleSide
});

// Add only boundary edges
const boundaryGeometry = getBoundaryEdges(geometry);
const lineSegments = new THREE.LineSegments(
    boundaryGeometry,
    new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
);
mesh.add(lineSegments);
```

**Split Plane Helper 업데이트 (lines 1367-1398):**
```javascript
if (axis === 'z') {
    // Z axis cut → 수직으로 자름 → 수평면(XY) 보임
    gridHelper.rotation.x = -Math.PI / 2;
    localPlanePos.set(
        (bbox.min.x + bbox.max.x) / 2,
        (bbox.min.y + bbox.max.y) / 2,
        planePosition  // Z position
    );
} else if (axis === 'y') {
    // Y axis cut → 수평으로 자름 → 수직면(XZ) 보임
    planeMesh.rotation.x = -Math.PI / 2;
    localPlanePos.set(
        (bbox.min.x + bbox.max.x) / 2,
        planePosition,  // Y position
        (bbox.min.z + bbox.max.z) / 2
    );
}
```

**분할 Geometry 처리 (lines 1509-1587):**
```javascript
// Create geometries
let bottomGeometry = createGeometryFromSplitResult(...);
let topGeometry = createGeometryFromSplitResult(...);

// Merge vertices
bottomGeometry = THREE.BufferGeometryUtils.mergeVertices(bottomGeometry, 1e-3);
topGeometry = THREE.BufferGeometryUtils.mergeVertices(topGeometry, 1e-3);

// Compute normals
bottomGeometry.computeVertexNormals();
topGeometry.computeVertexNormals();
bottomGeometry.normalizeNormals();
topGeometry.normalizeNormals();

// Materials with flat shading
bottomMaterial.flatShading = true;
topMaterial.flatShading = true;

// Add boundary edges
const bottomBoundaryGeometry = getBoundaryEdges(bottomGeometry);
bottomMesh.add(new THREE.LineSegments(bottomBoundaryGeometry, ...));
```

**Selection Highlight Material (lines 707-717):**
```javascript
const highlightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8800,
    emissive: 0xff6600,
    emissiveIntensity: 0.5,
    metalness: 0.0,
    roughness: 1.0,
    flatShading: true,  // Match original objects
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide
});
```

**Boundary Edge Detection Function (lines 1653-1697):**
```javascript
function getBoundaryEdges(geometry) {
    const edges = new Map();
    const positions = geometry.attributes.position;
    const indices = geometry.index ? geometry.index.array : null;

    if (!indices) return new THREE.BufferGeometry();

    // Count face sharing per edge
    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        const edge1 = [Math.min(i0, i1), Math.max(i0, i1)].join('-');
        const edge2 = [Math.min(i1, i2), Math.max(i1, i2)].join('-');
        const edge3 = [Math.min(i2, i0), Math.max(i2, i0)].join('-');

        edges.set(edge1, (edges.get(edge1) || 0) + 1);
        edges.set(edge2, (edges.get(edge2) || 0) + 1);
        edges.set(edge3, (edges.get(edge3) || 0) + 1);
    }

    // Extract boundary edges (count === 1)
    const boundaryEdges = [];
    for (const [edgeKey, count] of edges.entries()) {
        if (count === 1) {
            const [i0, i1] = edgeKey.split('-').map(Number);
            boundaryEdges.push(
                positions.getX(i0), positions.getY(i0), positions.getZ(i0),
                positions.getX(i1), positions.getY(i1), positions.getZ(i1)
            );
        }
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(boundaryEdges, 3));
    return lineGeometry;
}
```

### 2. `connections/templates/revit_control.html`

BufferGeometryUtils 라이브러리 추가 (line 18):
```html
<script src="https://cdn.jsdelivr.net/npm/three@0.140.0/examples/js/utils/BufferGeometryUtils.js"></script>
```

## 대화 요약

### 축 방향 문제 (메시지 1-9)

1. **문제 제기**: "z축을 선택했는데 x축이 나와. x축을 선택했는데 y축이 나와. y축을 했는데 z축이 나와."

2. **첫 시도**: if-else 조건 순서 변경 (z → x → y)
   - 결과: 여전히 작동 안 함

3. **두 번째 시도**: Y축과 Z축 로직 완전 교환
   - 결과: 반대로 작동

4. **최종 해결**: 평면 helper rotation만 수정
   - Z축 선택 → 수평면 표시
   - Y축 선택 → 수직면 표시

### 평면 이동 문제 (메시지 10-14)

5. **문제**: Z축일 때 슬라이더 조정하면 Y 방향으로 이동

6. **해결**: position.set() 좌표 매핑 수정

7. **추가 문제**: Y축 방향 반대로 이동

8. **해결**: -planePosition 사용

### 절대 좌표 변환 (메시지 15-17)

9. **문제**: "정확한 위치에서 분할이 안돼"

10. **원인**: 객체가 원점 기준이 아닌데 평면은 원점 기준

11. **해결**:
    - Slider를 bbox 범위(절대값)로 변경
    - updateSliderRange() 함수 추가
    - Local coordinate 사용, world로 변환

### 분할 객체 선택 문제 (메시지 18-23)

12. **문제**: 분할 객체 선택 시 노란색 하이라이트가 간헐적으로만 표시됨

13. **원인**:
    - 분할 객체가 scene에서 제거되지 않고 숨겨짐
    - originalColor 덮어씌워짐
    - bimObjectId 누락

14. **해결**:
    - scene.remove() 사용
    - originalColor 보존
    - originalObjectId 사용
    - computeBoundingBox/Sphere 추가

### 시각적 스타일 변경 (메시지 24-27)

15. **요청**:
    - 모든 객체: 연회색
    - Edge lines 표시
    - 그림자 활성화
    - 선택 객체: 주황색 반투명

16. **구현**:
    - MeshStandardMaterial (0xcccccc)
    - EdgesGeometry + LineSegments
    - Shadow mapping 활성화
    - Orange highlight (0xff8800, opacity 0.7)

### Edge Line 클릭 문제 (메시지 28-29)

17. **문제**: 객체 가장자리 클릭 시 선택 실패

18. **원인**: LineSegments 클릭 시 userData 없음

19. **해결**:
    - Recursive raycasting
    - LineSegments → parent mesh 탐색
    - Null check 추가

### 분할 객체 색상 문제 (메시지 30-32)

20. **문제**: 분할 후 초록색/빨간색 표시

21. **해결**: 색상 할당 제거, originalMaterial clone

22. **추가 문제**: 표면에 메시 선과 사선 음영

23. **해결**:
    - EdgesGeometry threshold 30도로 상향
    - computeVertexNormals() 추가

### 사선 음영 제거 (메시지 33-42)

24. **문제**: "분할하고 나면 가자기 사선이 생기고 그게 그대로 보여"

25. **시도 1**: BufferGeometryUtils 추가, vertex merging
    - 에러: Cannot read properties of undefined (mergeVertices)
    - 해결: BufferGeometryUtils.js 라이브러리 추가

26. **시도 2**: const → let 변경
    - 에러: Assignment to constant variable
    - 해결: geometry 변수를 let으로 선언

27. **사용자 요구사항 명확화**:
    - "표면 렌더링 수정: 매끄러운 단색 처리"
    - "내부 선 모두 숨기고, 외곽선만 강조"

28. **시도 3**: EdgesGeometry threshold 80도 → 89도

29. **시도 4**: 원본 객체에도 vertex merging 적용

30. **문제 지속**: "문제가 개선이 안되는데 이거 렌더링 방법을 바꿔야하는건가?"

31. **최종 해결**: Flat shading으로 변경
    - flatShading: true
    - roughness: 1.0

### Edge Lines 처리 (메시지 43-50)

32. **문제**: "표면에 선도 함께 보이게 됐어"

33. **시도 1**: Edge lines 제거
    - 결과: 외곽선도 사라짐

34. **요청**: "엣지선은 보였으면좋겠는데"

35. **시도 2**: Threshold 89.9도로 최대화

36. **문제 지속**: "표면에 선도 함께 보여"

37. **시도 3**: Edge lines 완전 제거

38. **문제**: "이번엔 외곽선까지다 숨겨졌어. 이거불가능한거야?"

39. **최종 시도**: Boundary edge detection 구현
    - getBoundaryEdges() 함수 작성
    - Edge count 기반 boundary 판별

40. **결과**: "외곽선 안보여"

41. **결론**: "그냥 이건 일단 이렇게 넘어가자. 갈길이멀다."

## 최종 결과

### 구현 완료 ✅

1. **축 방향 매핑**: Z축(수직), Y축(수평), X축 분할 정상 작동
2. **평면 위치 조정**: 절대 좌표 기반 정확한 위치 분할
3. **Geometry 분할**: Plane-triangle intersection으로 실제 형상 분할
4. **Flat Shading**: 사선 음영 대폭 감소
5. **메타데이터 상속**: originalObjectId, 속성 보존
6. **선택 기능**: Edge line 클릭 포함, 재분할 가능
7. **시각적 효과**: 그림자, 반투명 선택 하이라이트

### 보류/미해결 ⏸️

1. **외곽선 표시**: Boundary edge detection 구현했으나 제대로 작동하지 않음
2. **표면 메시 선**: Flat shading으로 개선되었으나 완벽하지 않음

### 기술적 교훈

1. **Three.js Coordinate System**:
   - Local vs World coordinates 구분 중요
   - localToWorld() 변환 필요

2. **Geometry Processing**:
   - mergeVertices()로 중복 제거
   - computeVertexNormals()로 음영 계산
   - normalizeNormals()로 정규화

3. **Rendering Methods**:
   - Smooth shading: 삼각형 경계가 음영으로 보임
   - Flat shading: 각 면이 단색으로 렌더링

4. **Edge Detection**:
   - EdgesGeometry: Angle threshold 기반, 불완전
   - Boundary edges: Face count 기반, 이론적으로는 완벽하나 실제 작동 불안정

## 다음 단계 제안

1. **외곽선 표시 개선**:
   - Post-processing outline effect (예: OutlinePass)
   - Shader-based outline
   - Separate wireframe mesh

2. **분할 기능 확장**:
   - 임의의 평면으로 분할
   - 스케치 기반 분할
   - 다중 분할 (여러 조각으로)

3. **SubObject 모델**:
   - Django 모델 구현
   - 데이터베이스 저장
   - 수량 자동 계산

4. **UI/UX 개선**:
   - 분할 미리보기
   - Undo/Redo 기능
   - 분할 이력 관리

## 참고 자료

- [Three.js BufferGeometry](https://threejs.org/docs/#api/en/core/BufferGeometry)
- [Three.js BufferGeometryUtils](https://threejs.org/docs/#examples/en/utils/BufferGeometryUtils)
- [Three.js Material Properties](https://threejs.org/docs/#api/en/materials/Material)
- [Flat vs Smooth Shading](https://en.wikipedia.org/wiki/Shading#Flat_vs._smooth_shading)
