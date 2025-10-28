# 3D 객체 분할 시 체적 기반 수량 배분 구현

**작업 일자**: 2025-10-28
**작업자**: Claude Code

## 1. 요청 사항

사용자가 3D 뷰어에서 객체를 분할할 때, **실제 geometry 체적을 계산하여 수량을 배분**하는 기능 구현 요청:

1. 원본 객체의 geometry_volume을 DB에 저장
2. 분할 시 각 분할된 객체의 **실제 메쉬 체적**을 계산
3. 계산된 체적 비율로 수량 배분
4. **닫힌 메쉬(watertight mesh)** 생성으로 정확한 체적 계산

## 2. 초기 문제점

### 문제 1: 체적 보존 실패 (33.33%)
- 원본 체적: 1.352626
- 분할 후 합계: 0.450875 (33.33% 보존)
- **67%의 체적 손실**

### 문제 2: 양수/음수 contribution 혼재
```
Bottom: Positive 0.45 - Negative 0.23 = 0.22
Top: Positive 0.68 - Negative 0.45 = 0.22
```
→ **일부 faces의 winding order가 반대 방향**

### 문제 3: 중복 교차점 생성
- 기대: 4개 교차점 (직육면체를 X축으로 자를 때)
- 실제: 8개 교차점 (각 edge가 2번 처리됨)

## 3. 해결 과정

### Step 1: Edge 기반 교차점 생성 구현
**파일**: `connections/static/connections/three_d_viewer.js` (lines 1997-2035)

**문제**: Triangle 단위로 교차점 생성 → 같은 edge를 2번 처리
**해결**: Edge → Intersection Mapping 생성

```javascript
// Edge key 생성 (정규화)
function edgeKey(i0, i1) {
    return i0 < i1 ? `${i0}-${i1}` : `${i1}-${i0}`;
}

// Edge → Intersection 캐싱
const edgeIntersections = new Map();

function getOrCreateIntersection(i0, i1) {
    const key = edgeKey(i0, i1);
    if (edgeIntersections.has(key)) {
        return edgeIntersections.get(key);
    }
    // 새 교차점 생성 및 캐싱
    const idx = allVertices.length / 3;
    allVertices.push(intX, intY, intZ);
    edgeIntersections.set(key, idx);
    return idx;
}
```

**결과**: 8개 → 8개 (여전히 동일, 기하학적으로 8개가 맞음)

### Step 2: Triangle Subdivision Winding Order 보존
**파일**: `connections/static/connections/three_d_viewer.js` (lines 2073-2139)

**문제**: 원본 triangle [v0, v1, v2]의 순서 정보 손실
```javascript
// 기존 방식 (잘못됨)
for (let j = 0; j < 3; j++) {
    if (dists[j] < -EPSILON) {
        belowVerts.push(vertIndices[j]);
    }
}
// → 순서 정보 손실!
```

**해결**: 6가지 crossing configuration 명시적 처리

```javascript
// Case 2a: v0 below, v1 v2 above (001)
if (below0 && above1 && above2) {
    const int01 = getOrCreateIntersection(i0, i1);
    const int02 = getOrCreateIntersection(i0, i2);
    bottomFaces.push([i0, int01, int02]);  // 원본 순서 유지
    topFaces.push([int01, i1, i2]);
    topFaces.push([int01, i2, int02]);
}
// ... 5가지 케이스 더
```

**결과**: Winding order 보존으로 모든 faces가 올바른 방향

### Step 3: Capping 2D Projection Basis Vector 버그 수정
**파일**: `connections/static/connections/three_d_viewer.js` (lines 2173-2185)

**문제**: `u.crossVectors(u, planeNormal)` → u를 자기 자신과 cross product
**해결**:
```javascript
let tempVec, u, v;
if (Math.abs(planeNormal.x) < 0.9) {
    tempVec = new THREE.Vector3(1, 0, 0);
} else {
    tempVec = new THREE.Vector3(0, 1, 0);
}
u = new THREE.Vector3().crossVectors(tempVec, planeNormal).normalize();
v = new THREE.Vector3().crossVectors(planeNormal, u).normalize();
```

**결과**: 올바른 orthonormal basis 생성

### Step 4: 체적 계산 디버깅 추가
**파일**: `connections/static/connections/three_d_viewer.js` (lines 2357-2432)

```javascript
function calculateGeometryVolume(geometry, debug = false) {
    let signedVolume = 0.0;
    let positiveContribution = 0.0;
    let negativeContribution = 0.0;

    for (let i = 0; i < indices.length; i += 3) {
        // Tetrahedron formula: v0 · (v1 × v2)
        const faceContribution = (v0x * crossX + v0y * crossY + v0z * crossZ);
        signedVolume += faceContribution;

        if (faceContribution > 0) {
            positiveContribution += faceContribution;
        } else {
            negativeContribution += faceContribution;
        }
    }

    if (debug) {
        console.log('  - Positive contribution:', (positiveContribution / 6.0).toFixed(6));
        console.log('  - Negative contribution:', (negativeContribution / 6.0).toFixed(6));
    }

    return Math.abs(signedVolume / 6.0);
}
```

## 4. 최종 결과

### ✅ 체적 보존: 100.00%
```
- Bottom: 0.677626 cubic units
- Top: 0.675000 cubic units
- Total: 1.352626 cubic units
- Original: 1.352626 cubic units
- Preservation: 100.00% ✅ (33.33% → 100.00%)
```

### ✅ 정확한 분할 비율
```
- Bottom: 50.10%
- Top: 49.81%
- 50% 슬라이더 위치에서 거의 정확히 50:50 비율
```

### ✅ 올바른 Face Orientation
```
Bottom Volume Calculation:
  - Positive contribution: 0.677626 ✅
  - Negative contribution: 0.000000 ✅

Top Volume Calculation:
  - Positive contribution: 0.900875 ✅
  - Negative contribution: -0.225875 (capping faces만)
```

## 5. 수정된 파일 목록

### 주요 파일
1. **connections/static/connections/three_d_viewer.js**
   - Edge 기반 교차점 생성 (lines 1997-2035)
   - Triangle subdivision winding order 보존 (lines 2073-2139)
   - Capping basis vector 수정 (lines 2173-2185)
   - 체적 계산 디버깅 (lines 2357-2432)

2. **connections/templates/revit_control.html**
   - Script version: v15 → v21

### 이전 세션에서 완료된 작업
3. **connections/models.py**
   - geometry_volume 필드 추가 (lines 235-311)
   - calculate_geometry_volume() 메서드

4. **connections/consumers.py**
   - geometry_volume WebSocket 전송 (lines 45, 70-72)
   - 자동 체적 계산 (lines 260-284)

5. **connections/admin.py**
   - RawElement admin에 geometry_volume 표시

## 6. 기술적 세부사항

### Signed Volume Method
Tetrahedron formula를 사용한 메쉬 체적 계산:
```
V = |Σ(v0 · (v1 × v2))| / 6
```
- 닫힌 메쉬에서만 정확한 결과
- Winding order가 일관되어야 함 (CCW)
- Outward-facing normals 필요

### Edge-based Intersection
```
EdgeKey = min(i0, i1) + "-" + max(i0, i1)
Map<EdgeKey, IntersectionVertexIndex>
```
- 같은 edge는 한 번만 처리
- 교차점 중복 방지

### Triangle Subdivision Configurations
6가지 케이스 (원본 vertex 순서 기반):
- 001: v0 below, v1 v2 above
- 110: v0 v1 below, v2 above
- 101: v0 above, v1 below, v2 above
- 011: v0 v2 below, v1 above
- 100: v0 above, v1 v2 below
- 010: v0 v1 above, v2 below

각 케이스마다 올바른 winding order로 subdivision

## 7. 향후 개선 가능 사항

1. **Top geometry의 negative contribution 제거**
   - 현재: -0.225875 (capping faces 일부)
   - Capping face winding order 미세 조정 필요

2. **다른 축(Y, Z) 분할 테스트**
   - 현재 X축만 테스트 완료
   - Y, Z축도 동일하게 작동하는지 확인

3. **복잡한 geometry 테스트**
   - 현재: 직육면체 형태만 테스트
   - 곡면, 복잡한 형상에서도 정확한지 검증

4. **성능 최적화**
   - Edge intersection mapping 메모리 사용량
   - 대규모 mesh 처리 시 성능

## 8. 참고 자료

- Three.js r140 BufferGeometry 문서
- Signed Volume of Polyhedron 알고리즘
- Triangle-Plane Intersection 알고리즘
- Winding Order and Face Orientation
