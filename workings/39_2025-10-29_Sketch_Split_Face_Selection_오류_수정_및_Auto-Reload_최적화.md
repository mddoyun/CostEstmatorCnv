# 39. Sketch Split Face Selection 오류 수정 및 Auto-Reload 최적화

**작성일**: 2025-10-29
**작업 범위**: Sketch Split 기능의 Face Selection 오류 해결, pendingSplitMeshes Map 추가, Auto-Reload 로직 최적화

---

## 🎯 작업 개요

Sketch Split 기능 사용 시 발생한 세 가지 핵심 문제 해결:
1. **Face Selection TypeError**: BufferGeometry에서 `intersection.face`가 null인 오류
2. **Split 객체 사라짐**: Sketch split 후 객체가 화면에서 사라지는 문제
3. **Auto-Reload 최적화**: Geometry 전체 reload로 인한 깜빡임 제거

---

## 📋 발견된 문제들

### 1. Face Selection TypeError

**증상**:
```
Uncaught TypeError: Cannot read properties of null (reading 'normal')
    at handleFaceSelection (three_d_viewer.js:3324:42)
```

**원인**:
- Three.js의 `Raycaster`가 BufferGeometry를 intersect할 때 `intersection.face`가 null
- 기존 코드는 `intersection.face.normal`을 직접 참조하여 에러 발생
- BufferGeometry는 deprecated된 Geometry와 달리 face 정보를 별도로 제공하지 않음

**위치**: `connections/static/connections/three_d_viewer.js:3324`

### 2. Sketch Split 후 객체 사라짐

**증상**:
- Sketch split 실행 후 분할된 객체가 화면에서 즉시 사라짐
- 콘솔에 "⚠ No matching mesh found in scene!" 경고 표시

**원인**:
- Sketch split에서 생성된 mesh들이 `pendingSplitMeshes` Map에 저장되지 않음
- Axis split에서만 Map 저장 로직이 있었고, sketch split에는 누락
- `split_saved` WebSocket 메시지 도착 시 mesh를 찾지 못해 `splitElementId` 설정 실패
- Auto-reload 로직이 geometry 전체를 reload하여 split 객체들이 제거됨

**위치**: `connections/static/connections/three_d_viewer.js:4467-4471`

### 3. Auto-Reload 로직 비효율

**증상**:
- Split 후 화면이 깜빡이며 geometry가 reload됨
- Split 객체가 잠깐 보였다가 사라지는 현상
- Camera state 저장/복원 로직이 불필요하게 추가됨

**원인**:
- `split_saved` 핸들러에서 `loadPlaceholderGeometry()` 호출
- 전체 scene을 clear하고 다시 load하는 과정에서 split mesh들이 제거됨
- `pendingSplitMeshes`를 통해 `splitElementId`가 즉시 설정되므로 geometry reload 불필요

**위치**: `connections/static/connections/websocket.js:589-623`

---

## 🔧 해결 방법

### 1. BufferGeometry Face Normal 계산 추가

**파일**: `connections/static/connections/three_d_viewer.js:3325-3355`

**변경 사항**:
- `intersection.face` null 체크 추가
- BufferGeometry의 경우 faceIndex로부터 수동 normal 계산
- 삼각형의 세 꼭지점에서 cross product로 normal 벡터 계산

```javascript
// ▼▼▼ [수정] BufferGeometry에서는 intersection.face가 null일 수 있음 ▼▼▼
let normal;
if (intersection.face && intersection.face.normal) {
    // Geometry (deprecated)의 경우
    normal = intersection.face.normal.clone();
} else if (faceIndex !== null && faceIndex !== undefined) {
    // BufferGeometry의 경우 - 수동으로 normal 계산
    const geometry = _mesh.geometry;
    const position = geometry.attributes.position;
    const index = geometry.index;

    // Get triangle vertices
    const i0 = index ? index.getX(faceIndex * 3) : faceIndex * 3;
    const i1 = index ? index.getX(faceIndex * 3 + 1) : faceIndex * 3 + 1;
    const i2 = index ? index.getX(faceIndex * 3 + 2) : faceIndex * 3 + 2;

    const v0 = new THREE.Vector3().fromBufferAttribute(position, i0);
    const v1 = new THREE.Vector3().fromBufferAttribute(position, i1);
    const v2 = new THREE.Vector3().fromBufferAttribute(position, i2);

    // Calculate face normal
    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

    console.log('[3D Viewer] Calculated normal from BufferGeometry:', normal);
} else {
    console.error('[3D Viewer] Cannot determine face normal');
    return;
}
```

**효과**:
- BufferGeometry 기반 split 객체에서도 face selection 정상 작동
- TypeError 완전 제거

### 2. Sketch Split에 pendingSplitMeshes 저장 추가

**파일**: `connections/static/connections/three_d_viewer.js:4508-4521`

**변경 사항**:
- Sketch split 완료 후 remainder/extracted mesh를 Map에 저장
- Key 형식: `"raw_element_id:split_part_type"`
- Axis split과 동일한 메커니즘 적용

```javascript
// ▼▼▼ [추가] Store meshes in pendingSplitMeshes Map for split_saved handler ▼▼▼
if (!window.pendingSplitMeshes) {
    window.pendingSplitMeshes = new Map();
}
const remainderKey = `${remainderMesh.userData.rawElementId}:${remainderMesh.userData.splitPartType}`;
const extractedKey = `${extractedMesh.userData.rawElementId}:${extractedMesh.userData.splitPartType}`;
window.pendingSplitMeshes.set(remainderKey, remainderMesh);
window.pendingSplitMeshes.set(extractedKey, extractedMesh);
console.log('[3D Viewer] Stored pending sketch split meshes:', {
    remainderKey: remainderKey,
    extractedKey: extractedKey,
    totalPending: window.pendingSplitMeshes.size
});
```

**효과**:
- `split_saved` WebSocket 메시지 도착 시 mesh를 100% 찾을 수 있음
- `splitElementId` 즉시 설정되어 데이터 표시 정상 작동
- Split 객체가 화면에서 사라지지 않음

### 3. Auto-Reload 로직 최적화

**파일**: `connections/static/connections/websocket.js:588-620`

**변경 전**:
- Geometry 전체 reload (`loadPlaceholderGeometry()`)
- Camera state 저장/복원
- 화면 깜빡임 발생

**변경 후**:
- 데이터만 reload (QuantityMembers + CostItems)
- Geometry reload 제거
- 선택된 객체 표시 자동 갱신

```javascript
window.splitDataReloadTimer = setTimeout(() => {
    console.log('[WebSocket] ========================================');
    console.log('[WebSocket] Reloading data after split completion...');

    // ▼▼▼ [수정] Geometry reload 제거, 데이터만 재로드 ▼▼▼
    // pendingSplitMeshes를 통해 splitElementId가 즉시 설정되므로 geometry reload 불필요

    // QM과 CI 데이터 재로드
    if (typeof window.loadQuantityMembersForViewer === 'function') {
        window.loadQuantityMembersForViewer();
    }
    if (typeof window.loadCostItemsWithPrices === 'function') {
        window.loadCostItemsWithPrices();
    }

    // 선택된 객체가 있으면 표시 갱신
    setTimeout(() => {
        if (window.selectedObject && window.scene) {
            console.log('[WebSocket] Refreshing selected object display...');
            // 선택된 객체의 QuantityMember와 CostItem 표시 갱신
            if (typeof window.displayQuantityMembersForObject === 'function') {
                window.displayQuantityMembersForObject(window.selectedObject);
            }
            if (typeof window.displayCostItemsForObject === 'function') {
                window.displayCostItemsForObject(window.selectedObject);
            }
            console.log('[WebSocket] Selected object display refreshed');
        }
        console.log('[WebSocket] Data reload completed');
        console.log('[WebSocket] ========================================');
    }, 200); // QM/CI 데이터 로드 완료 대기
}, 100); // 100ms 대기 후 갱신 (두 split 모두 완료될 시간)
```

**효과**:
- 화면 깜빡임 완전 제거
- Split 객체가 화면에 그대로 유지
- 부드러운 UX 제공

### 4. localNormal 안전하게 저장

**파일**: `connections/static/connections/three_d_viewer.js:3365-3369`

**변경 사항**:
- `intersection.face.normal` 접근 전 null 체크
- BufferGeometry의 경우 world normal을 localNormal로 사용

```javascript
const localNormal = intersection.face && intersection.face.normal ?
    intersection.face.normal.clone() :
    normal.clone(); // BufferGeometry의 경우 world normal을 그대로 사용

selectedFace = {
    mesh: _mesh,
    faceIndex: faceIndex,
    point: point.clone(),
    normal: normal.clone(),
    localNormal: localNormal
};
```

---

## 📊 수정된 파일 목록

1. **connections/static/connections/three_d_viewer.js**
   - `handleFaceSelection()`: BufferGeometry face normal 계산 (3325-3355)
   - `handleFaceSelection()`: localNormal 안전 저장 (3365-3369)
   - Sketch split: pendingSplitMeshes 저장 추가 (4508-4521)

2. **connections/static/connections/websocket.js**
   - `split_saved` 핸들러: Auto-reload 로직 최적화 (588-620)

---

## ✅ 테스트 시나리오

### 시나리오 1: Sketch Split Face Selection

```
1. Load Geometry
2. 객체 선택
3. "Sketch Split" 버튼 클릭
4. "작업면 선택" 클릭
5. 객체의 면 클릭
   ✓ TypeError 없이 면 선택됨
   ✓ 면 normal 정보 표시
   ✓ "스케치 시작" 버튼 활성화
```

### 시나리오 2: Sketch Split 완료 후 객체 유지

```
1. 위 시나리오 1 계속
2. 스케치 그리기 (4개 점)
3. "분할 적용" 클릭
4. 확인
   ✓ 분할된 객체가 화면에 그대로 보임
   ✓ "⚠ No matching mesh found" 없음
   ✓ 콘솔에 "Stored pending sketch split meshes" 표시
   ✓ 화면 깜빡임 없음
```

### 시나리오 3: Split 후 즉시 데이터 표시

```
1. Sketch split 완료
2. 분할된 객체 중 하나 선택
3. 확인
   ✓ QuantityMember 즉시 표시 (2개)
   ✓ CostItem 즉시 표시 (2개)
   ✓ "데이터 로딩 중..." 메시지 없음
   ✓ "분할 정보 저장 중..." 메시지 없음
```

### 시나리오 4: Nested Split

```
1. Split된 객체를 다시 split
2. 확인
   ✓ 모든 시나리오 정상 작동
   ✓ Volume 보존율 100%
   ✓ 데이터 표시 정확
```

---

## 🔍 핵심 개선 사항

### Before (문제)
1. **Face Selection**: BufferGeometry에서 TypeError
2. **Split 후**: 객체가 화면에서 사라짐
3. **Auto-Reload**: 화면 깜빡이며 geometry 전체 reload
4. **UX**: "분할 정보 저장 중..." 메시지 표시 후 수동으로 "Load Geometry" 클릭 필요

### After (해결)
1. **Face Selection**: BufferGeometry에서 수동 normal 계산으로 정상 작동
2. **Split 후**: pendingSplitMeshes를 통해 객체 화면에 유지
3. **Auto-Reload**: 데이터만 reload, 화면 깜빡임 없음
4. **UX**: 자동으로 데이터 갱신, 추가 작업 불필요

---

## 📝 주요 개념

### BufferGeometry vs Geometry (deprecated)

**Geometry (deprecated)**:
- `intersection.face` 객체 제공
- `face.normal` 직접 접근 가능

**BufferGeometry**:
- `intersection.face`가 null
- `faceIndex`만 제공
- 수동으로 normal 계산 필요:
  1. faceIndex로 삼각형의 세 vertex index 가져오기
  2. Position attribute에서 실제 vertex 좌표 추출
  3. Edge vector 계산 (v1-v0, v2-v0)
  4. Cross product로 normal 계산

### pendingSplitMeshes Map 메커니즘

**목적**: WebSocket `split_saved` 메시지 도착 시 올바른 mesh 찾기

**흐름**:
1. Split 완료 직후:
   ```javascript
   const key = `${rawElementId}:${splitPartType}`;
   window.pendingSplitMeshes.set(key, mesh);
   ```

2. `split_saved` 메시지 도착:
   ```javascript
   const key = `${data.raw_element_id}:${data.split_part_type}`;
   if (window.pendingSplitMeshes.has(key)) {
       const mesh = window.pendingSplitMeshes.get(key);
       mesh.userData.splitElementId = data.split_id;
       window.pendingSplitMeshes.delete(key);
   }
   ```

**장점**:
- 100% 정확한 mesh 매칭
- Scene traverse 불필요 (성능 향상)
- Nested split 지원

### Auto-Reload 최적화 원리

**변경 전**:
```
Split 완료 → loadPlaceholderGeometry() → clearScene() →
allRevitData 재로드 → 모든 mesh 재생성 →
split mesh들 사라짐 → QM/CI 로드 → 표시
```

**변경 후**:
```
Split 완료 → pendingSplitMeshes에 splitElementId 설정 →
QM/CI만 재로드 → 표시 갱신 → 완료
```

**결과**:
- Geometry는 그대로 유지 (화면 깜빡임 없음)
- 데이터만 최신화 (빠름)
- Split mesh 보존 (사라지지 않음)

---

## 🎓 배운 점

1. **Three.js Raycaster의 BufferGeometry 처리**
   - Modern Three.js는 BufferGeometry가 표준
   - Intersection 결과가 geometry 타입에 따라 다름
   - Face 정보 필요 시 수동 계산 필요

2. **WebSocket 비동기 처리의 복잡성**
   - 직접 참조 저장 (Map)이 traverse보다 안정적
   - Key 설계가 매우 중요 (unique + descriptive)

3. **과도한 최적화의 역효과**
   - "자동 reload"가 오히려 문제를 복잡하게 만듦
   - 필요한 것만 reload하는 것이 진정한 최적화
   - Camera state 저장/복원도 불필요했음

4. **디버깅의 가치**
   - 명확한 콘솔 로그가 문제 해결의 핵심
   - "⚠ No matching mesh found" 로그가 문제 지점 정확히 지적
   - Map 저장 확인 로그 추가로 즉시 원인 파악

---

## 📌 다음 작업 예정

현재 완료된 상태이며, 추가 개선 사항:
1. ~~Sketch split face selection 오류~~ ✅ 완료
2. ~~Split 후 객체 사라짐~~ ✅ 완료
3. ~~Auto-reload 최적화~~ ✅ 완료
4. 향후: Undo/Redo 기능 (split 되돌리기)

---

**작성자**: Claude Code
**검토**: 사용자 테스트 완료
