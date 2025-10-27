# 35. 3D 스케치 CAD 스타일 기능 완성

**날짜**: 2025-10-28
**작업 내용**: 2D 캔버스 제거, 완전한 3D 스케치, 치수 입력, CAD 스타일 스냅 시스템 구현

## 문제 상황

이전 구현에서는:
- 2D 캔버스 오버레이로 스케치 표시 → 카메라 회전 시 스케치가 따라다님
- 스케치가 실제 3D 면에 고정되지 않음
- 정밀한 치수 입력 불가능
- 스냅 타입 구분이 어려움 (모두 동일한 구체로 표시)
- 직교 스냅 기능 없음

## 해결 방법

### 1. 2D 캔버스 제거 및 완전한 3D 스케치

**파일**: `connections/static/connections/three_d_viewer.js`

#### 변경사항

**제거된 변수**:
```javascript
// 제거됨
let sketchPoints = [];
let sketchCanvas = null;
let sketchCtx = null;
```

**추가된 변수**:
```javascript
// 3D 전용 스케치
let sketch3DLine = null;
let previewLine = null;
let sketchPoints3D = [];
```

#### 렌더링 최적화

```javascript
const material = new THREE.LineBasicMaterial({
    color: 0xff0000,
    linewidth: 2,
    depthTest: false,      // 항상 보이도록
    transparent: true
});

sketch3DLine.renderOrder = 999;  // 렌더링 순서 제어
```

### 2. 카메라 자유 이동

#### 이벤트 리스너 변경

**이전** (2D 캔버스):
```javascript
sketchCanvas.addEventListener('mousedown', onSketchMouseDown);
sketchCanvas.addEventListener('mousemove', onSketchMouseMove);
sketchCanvas.style.pointerEvents = 'auto';
```

**변경 후** (3D 캔버스):
```javascript
renderer.domElement.addEventListener('mousedown', onSketchMouseDown);
renderer.domElement.addEventListener('mousemove', onSketchMouseMove);
// OrbitControls 항상 활성화 → 우클릭/휠로 카메라 조작
```

#### 마우스 버튼 구분

```javascript
function onSketchMouseDown(event) {
    // 왼쪽 클릭만 스케치 포인트 추가
    if (event.button !== 0) return;

    // 우클릭/휠은 OrbitControls가 처리
}
```

### 3. 3D 프리뷰 라인

**파일**: `connections/static/connections/three_d_viewer.js` (line 2478-2510)

```javascript
function updatePreviewLine(currentPoint, snapToFirst = false) {
    // Remove old preview line
    if (previewLine) {
        scene.remove(previewLine);
        previewLine = null;
    }

    if (!currentPoint || sketchPoints3D.length === 0) return;

    // Determine target point
    const targetPoint = snapToFirst ? sketchPoints3D[0] : currentPoint;
    const lastPoint = sketchPoints3D[sketchPoints3D.length - 1];

    // Create preview line
    const points = [lastPoint, targetPoint];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Color based on snap state
    const color = snapToFirst ? 0x00ff00 : (currentSnapPoint ? 0x00ffff : 0xffff00);
    const material = new THREE.LineDashedMaterial({
        color: color,
        linewidth: 2,
        dashSize: 0.1,
        gapSize: 0.05,
        depthTest: false,
        transparent: true
    });

    previewLine = new THREE.Line(geometry, material);
    previewLine.computeLineDistances(); // Required for dashed lines
    previewLine.renderOrder = 1000;
    scene.add(previewLine);
}
```

**프리뷰 라인 색상**:
- 🟡 노란색: 일반 상태
- 🔵 청록색: Vertex/Edge 스냅
- 🟢 초록색: 첫 점 스냅 (자동 닫기)

### 4. 정확한 치수 입력 기능

**파일**: `connections/templates/three_d_viewer.html` (line 50-52)

#### UI 추가

```html
<div id="dimension-input-display" style="position: absolute; bottom: 20px; left: 20px; display: none; background: rgba(0, 0, 0, 0.8); color: #00ff00; padding: 10px 15px; border-radius: 5px; font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; pointer-events: none; z-index: 1000;">
    <span id="dimension-input-text"></span>
</div>
```

**스타일**: CAD 스타일 검은 배경 + 초록색 모노스페이스 폰트

#### 키보드 입력 핸들러

**파일**: `connections/static/connections/three_d_viewer.js` (line 2740-2790)

```javascript
function onSketchKeyDown(event) {
    if (!isSketchDrawing || !selectedFace) return;

    const key = event.key;

    // Number keys (0-9) or decimal point
    if (/^[0-9.]$/.test(key)) {
        event.preventDefault();

        // Activate dimension input mode
        if (sketchPoints3D.length > 0 && !dimensionInputMode) {
            dimensionInputMode = true;
        }

        // Add to buffer (prevent multiple decimal points)
        if (key === '.' && dimensionInputBuffer.includes('.')) {
            return;
        }

        dimensionInputBuffer += key;
        updateDimensionInputDisplay();
    }
    // Backspace - remove last character
    else if (key === 'Backspace') {
        // ...
    }
    // Enter - apply dimension input
    else if (key === 'Enter') {
        if (dimensionInputMode && dimensionInputBuffer.length > 0) {
            event.preventDefault();
            applyDimensionInput();
        }
    }
    // Escape - cancel dimension input
    else if (key === 'Escape') {
        // ...
    }
}
```

#### 방향 고정 및 거리 계산

**파일**: `connections/static/connections/three_d_viewer.js` (line 2695-2704)

```javascript
// Update direction for potential dimension input (if there's a last point)
if (sketchPoints3D.length > 0) {
    const lastPoint = sketchPoints3D[sketchPoints3D.length - 1];
    const direction = new THREE.Vector3().subVectors(point3D, lastPoint);
    const distance = direction.length();

    if (distance > 0.01) { // Avoid zero-length vectors
        dimensionDirection = direction.normalize();
        dimensionStartPoint = lastPoint.clone();
    }
}
```

#### 치수 적용

**파일**: `connections/static/connections/three_d_viewer.js` (line 2812-2841)

```javascript
function applyDimensionInput() {
    if (!dimensionDirection || !dimensionStartPoint) {
        console.warn('[3D Viewer] No direction set for dimension input');
        cancelDimensionInput();
        return;
    }

    const distance = parseFloat(dimensionInputBuffer);
    if (isNaN(distance) || distance <= 0) {
        showToast('유효한 거리를 입력하세요', 'warning');
        cancelDimensionInput();
        return;
    }

    // Calculate target point
    const targetPoint = dimensionStartPoint.clone().add(
        dimensionDirection.clone().multiplyScalar(distance)
    );

    // Add point to sketch
    sketchPoints3D.push(targetPoint);

    console.log('[3D Viewer] Added dimension point:', targetPoint, 'distance:', distance);

    // Update 3D visualization
    update3DSketchLine();

    // Reset dimension input mode for next input
    cancelDimensionInput();
}
```

### 5. 직교 스냅 기능

**파일**: `connections/static/connections/three_d_viewer.js` (line 2448-2505)

```javascript
function findOrthogonalSnap(position3D) {
    if (!selectedFace || sketchPoints3D.length === 0) return null;

    const lastPoint = sketchPoints3D[sketchPoints3D.length - 1];
    const direction = new THREE.Vector3().subVectors(position3D, lastPoint);

    if (direction.length() < 0.01) return null;

    // Get face local coordinate system
    const faceNormal = selectedFace.normal.clone().normalize();

    // Find two perpendicular vectors in the face plane
    let xAxis, yAxis;

    // Choose an arbitrary vector not parallel to normal
    const arbitrary = Math.abs(faceNormal.z) < 0.9
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(1, 0, 0);

    xAxis = new THREE.Vector3().crossVectors(faceNormal, arbitrary).normalize();
    yAxis = new THREE.Vector3().crossVectors(faceNormal, xAxis).normalize();

    // Project direction onto each axis
    const xComponent = direction.dot(xAxis);
    const yComponent = direction.dot(yAxis);

    const xMagnitude = Math.abs(xComponent);
    const yMagnitude = Math.abs(yComponent);

    // Orthogonal snap threshold (angle in radians)
    const snapAngle = 15 * Math.PI / 180; // 15 degrees
    const totalMagnitude = Math.sqrt(xComponent * xComponent + yComponent * yComponent);

    if (totalMagnitude < 0.01) return null;

    const xRatio = xMagnitude / totalMagnitude;
    const yRatio = yMagnitude / totalMagnitude;

    // Check if close to X axis
    if (xRatio > Math.cos(snapAngle) && xRatio > yRatio) {
        const distance = totalMagnitude * Math.sign(xComponent);
        const orthoPoint = lastPoint.clone().add(xAxis.clone().multiplyScalar(distance));
        return { point: orthoPoint, axis: 'x', axisVector: xAxis };
    }

    // Check if close to Y axis
    if (yRatio > Math.cos(snapAngle) && yRatio > xRatio) {
        const distance = totalMagnitude * Math.sign(yComponent);
        const orthoPoint = lastPoint.clone().add(yAxis.clone().multiplyScalar(distance));
        return { point: orthoPoint, axis: 'y', axisVector: yAxis };
    }

    return null;
}
```

**작동 원리**:
1. 선택한 면의 법선 벡터 기준으로 로컬 좌표계 생성
2. 마우스 방향을 X축, Y축에 투영
3. 15도 이내 각도면 해당 축으로 스냅
4. 정확히 수평/수직 방향으로 정렬

### 6. CAD 스타일 스냅 인디케이터

**파일**: `connections/templates/three_d_viewer.html` (line 53-56)

#### 2D HTML 오버레이 추가

```html
<div id="snap-indicator-2d" style="position: absolute; display: none; pointer-events: none; z-index: 1001;">
    <div id="snap-icon" style="width: 20px; height: 20px; position: relative;"></div>
    <div id="snap-label" style="margin-top: 2px; font-size: 11px; font-weight: bold; color: white; text-shadow: 1px 1px 2px black; white-space: nowrap; text-align: center;"></div>
</div>
```

#### 스냅 타입별 아이콘

**파일**: `connections/static/connections/three_d_viewer.js` (line 2507-2606)

```javascript
function updateSnapIndicator(position, type) {
    // ... 3D to 2D conversion ...

    let iconHTML = '';
    let labelText = '';

    switch (type) {
        case 'vertex':
            // 🔴 Red square (끝점)
            iconHTML = '<div style="width: 16px; height: 16px; border: 3px solid #ff0000; background: transparent; box-sizing: border-box;"></div>';
            labelText = '끝점';
            break;

        case 'edge-midpoint':
            // 🔵 Cyan triangle (중간점)
            iconHTML = '<div style="width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-bottom: 17px solid #00ffff; margin: 0 auto;"></div>';
            labelText = '중간점';
            break;

        case 'edge':
            // 🔵 Cyan circle (선상의 점)
            iconHTML = '<div style="width: 14px; height: 14px; border: 3px solid #00ffff; border-radius: 50%; background: transparent; box-sizing: border-box; margin: 3px auto;"></div>';
            labelText = '선상의 점';
            break;

        case 'orthogonal':
            // 🟣 Purple X (직교)
            iconHTML = `<div style="position: relative; width: 20px; height: 20px;">
                <div style="position: absolute; width: 20px; height: 3px; background: #ff00ff; transform: rotate(45deg); top: 8px;"></div>
                <div style="position: absolute; width: 20px; height: 3px; background: #ff00ff; transform: rotate(-45deg); top: 8px;"></div>
            </div>`;
            labelText = '직교';
            break;

        case 'first':
            // 🟢 Green circle (첫 점)
            iconHTML = '<div style="width: 18px; height: 18px; border: 3px solid #00ff00; border-radius: 50%; background: rgba(0, 255, 0, 0.2); box-sizing: border-box; margin: 1px auto;"></div>';
            labelText = '첫 점';
            break;

        default:
            // 🟡 Yellow circle (평면)
            iconHTML = '<div style="width: 12px; height: 12px; border: 2px solid #ffff00; border-radius: 50%; background: transparent; box-sizing: border-box; margin: 4px auto;"></div>';
            labelText = '평면';
            break;
    }

    snapIcon.innerHTML = iconHTML;
    snapLabel.textContent = labelText;

    // Also create small 3D marker
    const color = type === 'vertex' ? 0xff0000 :
                 type === 'edge-midpoint' ? 0x00ffff :
                 type === 'edge' ? 0x00ffff :
                 type === 'orthogonal' ? 0xff00ff :
                 type === 'first' ? 0x00ff00 : 0xffff00;

    // ... create 3D sphere indicator ...
}
```

#### 3D → 2D 좌표 변환

```javascript
// Convert 3D position to 2D screen coordinates
const screenPos = position.clone().project(camera);
const rect = renderer.domElement.getBoundingClientRect();
const x = (screenPos.x * 0.5 + 0.5) * rect.width;
const y = ((-screenPos.y) * 0.5 + 0.5) * rect.height;

// Position the 2D indicator
snapIndicator2D.style.left = (x - 10) + 'px';
snapIndicator2D.style.top = (y - 10) + 'px';
snapIndicator2D.style.display = 'block';
```

### 7. 스냅 우선순위 시스템

**파일**: `connections/static/connections/three_d_viewer.js` (line 2836-2902)

```javascript
// Snap priority (highest to lowest):
// 1. First point snap (for closing polygon)
// 2. Vertex snap
// 3. Edge midpoint snap
// 4. Orthogonal snap
// 5. Edge snap

let finalSnapPoint = point3D;
let finalSnapType = null;
let snapToFirst = false;

// Check for snap to first point (highest priority)
if (sketchPoints3D.length >= 3) {
    const firstPoint3D = sketchPoints3D[0];
    const distance3D = point3D.distanceTo(firstPoint3D);

    if (distance3D < snapDistance3D) {
        snapToFirst = true;
        finalSnapPoint = firstPoint3D;
        finalSnapType = 'first';
    }
}

// If not snapping to first point, check other snaps
if (!snapToFirst) {
    const snapResult = findSnapPoint(point3D);

    if (snapResult) {
        // Vertex and midpoint have high priority
        if (snapResult.type === 'vertex' || snapResult.type === 'edge-midpoint') {
            finalSnapPoint = snapResult.point;
            finalSnapType = snapResult.type;
            currentSnapPoint = snapResult.point;
        }
        // Edge snap has lower priority, check orthogonal first
        else if (snapResult.type === 'edge') {
            const orthoSnap = findOrthogonalSnap(point3D);
            if (orthoSnap) {
                finalSnapPoint = orthoSnap.point;
                finalSnapType = 'orthogonal';
                currentSnapPoint = orthoSnap.point;
            } else {
                finalSnapPoint = snapResult.point;
                finalSnapType = snapResult.type;
                currentSnapPoint = snapResult.point;
            }
        }
    } else {
        // No vertex/edge snap, check orthogonal
        const orthoSnap = findOrthogonalSnap(point3D);
        if (orthoSnap) {
            finalSnapPoint = orthoSnap.point;
            finalSnapType = 'orthogonal';
            currentSnapPoint = orthoSnap.point;
        } else {
            currentSnapPoint = null;
        }
    }
}

updateSnapIndicator(finalSnapPoint, finalSnapType);
```

### 8. Edge Midpoint 개선

**파일**: `connections/static/connections/three_d_viewer.js` (line 2355-2446)

#### 스냅 타입 분리

**이전**: 모든 모서리 스냅이 'edge' 타입
**변경 후**:
- `'edge-midpoint'`: 정확한 중간점
- `'edge'`: 선상의 임의의 점

```javascript
// Check edge midpoint (higher priority than edge)
const midpoint = new THREE.Vector3().lerpVectors(v1, v2, 0.5);
const distToMid = midpoint.distanceTo(position3D);

if (distToMid < closestDistance) {
    closestDistance = distToMid;
    closestPoint = midpoint;
    snapType = 'edge-midpoint';
}

// Check closest point on edge line segment
const line = new THREE.Line3(v1, v2);
const closestOnLine = new THREE.Vector3();
line.closestPointToPoint(position3D, true, closestOnLine);
const distToLine = closestOnLine.distanceTo(position3D);

// Don't snap to edge if it's too close to vertex or midpoint
const distToV1 = closestOnLine.distanceTo(v1);
const distToV2 = closestOnLine.distanceTo(v2);
const distToMidFromLine = closestOnLine.distanceTo(midpoint);

if (distToLine < closestDistance &&
    distToV1 > 0.02 && distToV2 > 0.02 &&
    distToMidFromLine > 0.02) {
    closestDistance = distToLine;
    closestPoint = closestOnLine;
    snapType = 'edge';
}
```

**목적**: Vertex, Midpoint, Edge 스냅이 서로 간섭하지 않도록 최소 거리 보장

## 사용 방법

### 기본 스케치

1. **Load Geometry** → 객체 선택 → **Sketch Split**
2. **작업면 선택** → 면 클릭
3. **스케치 시작** 클릭
4. **왼쪽 클릭**: 점 추가
5. **우클릭 드래그**: 카메라 회전
6. **마우스 휠**: 줌 인/아웃

### 정밀 치수 입력

1. 첫 점 클릭
2. 마우스로 **방향 설정** (클릭하지 말고 이동만)
3. **숫자 입력** (예: `5.2`)
4. **Enter** → 그 거리만큼 떨어진 점 생성

### 스냅 활용

- **빨간 사각형** (끝점) 나타나면 → 정확한 꼭짓점에 스냅
- **청록 삼각형** (중간점) → 모서리 정중앙에 스냅
- **보라색 X** (직교) → 수평/수직 정렬
- **청록 원** (선상의 점) → 모서리 위의 임의 점
- **초록 원** (첫 점) → 클릭 시 폴리곤 자동 닫기

## 스냅 타입 요약

| 아이콘 | 색상 | 타입 | 설명 |
|--------|------|------|------|
| ◼️ | 빨강 | 끝점 | 객체의 꼭짓점 |
| ▼ | 청록 | 중간점 | 모서리의 정중앙 |
| ○ | 청록 | 선상의 점 | 모서리 위의 점 |
| ✕ | 보라 | 직교 | 수평/수직 정렬 |
| ● | 초록 | 첫 점 | 폴리곤 닫기 |
| ○ | 노랑 | 평면 | 작업면 위 임의 점 |

## 키보드 단축키

- **0-9, .**: 거리 입력 시작
- **Backspace**: 마지막 문자 삭제
- **Enter**: 거리 확정 및 점 생성
- **ESC**: 입력 취소

## 기술적 세부사항

### 좌표계 변환

**3D World Space → 2D Screen Space**:
```javascript
const screenPos = position.clone().project(camera);
const x = (screenPos.x * 0.5 + 0.5) * rect.width;
const y = ((-screenPos.y) * 0.5 + 0.5) * rect.height;
```

### 직교 스냅 수학

**로컬 좌표계 생성**:
```javascript
// Face normal
const faceNormal = selectedFace.normal.clone().normalize();

// Arbitrary vector (not parallel to normal)
const arbitrary = Math.abs(faceNormal.z) < 0.9
    ? new THREE.Vector3(0, 0, 1)
    : new THREE.Vector3(1, 0, 0);

// X axis (perpendicular to normal)
xAxis = new THREE.Vector3().crossVectors(faceNormal, arbitrary).normalize();

// Y axis (perpendicular to both)
yAxis = new THREE.Vector3().crossVectors(faceNormal, xAxis).normalize();
```

**각도 계산**:
```javascript
const snapAngle = 15 * Math.PI / 180; // 15 degrees

const xRatio = xMagnitude / totalMagnitude;
const yRatio = yMagnitude / totalMagnitude;

// cos(15°) ≈ 0.966
if (xRatio > Math.cos(snapAngle) && xRatio > yRatio) {
    // Snap to X axis
}
```

### 렌더링 순서

```javascript
sketch3DLine.renderOrder = 999;      // 스케치 라인
previewLine.renderOrder = 1000;      // 프리뷰 라인
snapIndicator.renderOrder = 1001;    // 스냅 인디케이터
```

높은 숫자 = 나중에 렌더링 = 위에 표시

## 수정된 파일 목록

1. ✅ `connections/templates/three_d_viewer.html`
   - 치수 입력 디스플레이 추가
   - 2D 스냅 인디케이터 오버레이 추가

2. ✅ `connections/static/connections/three_d_viewer.js`
   - 2D 캔버스 관련 코드 제거
   - 3D 전용 스케치 시스템 구현
   - 프리뷰 라인 추가
   - 치수 입력 핸들러 구현
   - 직교 스냅 함수 추가
   - CAD 스타일 스냅 인디케이터 구현
   - 스냅 우선순위 시스템
   - Edge midpoint 타입 분리

## 다음 단계 (향후 구현)

1. **스케치 편집**: 이미 추가된 점 수정/삭제
2. **스냅 토글**: 특정 스냅 타입 켜기/끄기
3. **각도 스냅**: 특정 각도 (30°, 45° 등)로 스냅
4. **거리 제약**: 특정 거리 고정
5. **대칭 스케치**: 중심선 기준 대칭 복사
6. **스케치 저장/불러오기**: 스케치 재사용
7. **참조점 추가**: 보조선/보조점 생성

## 참고 자료

- [Three.js Vector3 Documentation](https://threejs.org/docs/#api/en/math/Vector3)
- [Three.js Line3 Documentation](https://threejs.org/docs/#api/en/math/Line3)
- [Three.js Camera.project()](https://threejs.org/docs/#api/en/cameras/Camera.project)
- [SketchUp Inference System](https://help.sketchup.com/en/sketchup/inference-locking)
- [AutoCAD Object Snap](https://knowledge.autodesk.com/support/autocad/learn-explore/caas/CloudHelp/cloudhelp/2023/ENU/AutoCAD-Core/files/GUID-7E11264D-C94E-4E82-84A8-E8E1E2F0E5D6-htm.html)
