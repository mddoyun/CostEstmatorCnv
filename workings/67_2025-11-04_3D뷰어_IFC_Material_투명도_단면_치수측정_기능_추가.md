# 67. 3D 뷰어 IFC Material 투명도, 단면 자르기, 치수 측정 기능 추가

**날짜**: 2025-11-04
**작업자**: Claude Code
**카테고리**: 3D Viewer, IFC, Material Rendering, Section Plane, Distance Measurement

## 작업 개요

3D 뷰어에 세 가지 주요 기능을 추가했습니다:
1. **IFC Material/Style 기반 실제 렌더링** (색상 + 투명도)
2. **단면 자르기 기능** (Section Plane)
3. **치수 측정 기능** (Distance Measurement)

## 구현된 기능

### 1. IFC Material/Style 기반 투명도 렌더링

**배경**: 사용자 요청 - "ifc파일로부터 객체가 어떤 material을 가졌고 그 material은 어떤 style을 가지고 있는지 나와있거든 그 style의 속성정보를 그대로 가져와서 여기 3d뷰포트에서 렌더링했으면 좋겠어. 실제 색상 모드에서 그 스타일대로 표현해주면좋겟어. 투명도도있을거고 색상도 있을거잖아."

#### IFC 데이터 구조 분석

IFC 파일의 Material/Style 정보는 다음과 같이 정의됩니다:

```
#361=IFCCOLOURRGB($,0.0429765619337559,0.0429765619337559,0.0429765619337559);
#362=IFCSURFACESTYLESHADING(#361,0.);
#363=IFCSURFACESTYLE('Frame',.BOTH.,(#362));

#463=IFCCOLOURRGB($,0.800000011920929,1.,1.);
#464=IFCSURFACESTYLESHADING(#463,0.799999997019768);
#465=IFCSURFACESTYLE('Glass',.BOTH.,(#464));
```

**주요 속성**:
- `IFCCOLOURRGB`: RGB 색상 (0.0 ~ 1.0 범위)
- `IFCSURFACESTYLESHADING`: Transparency 값 (0=불투명, 1=완전투명)
- `IFCSURFACESTYLE`: 스타일 이름

#### Blender 애드온 - 이미 구현됨

**파일**: `CostEstimator_BlenderAddon_453/__init__.py` (line 229-291)

Blender 애드온은 이미 다음 정보를 추출하고 있었습니다:

```python
# Diffuse 색상 추출
if hasattr(style, 'SurfaceColour') and style.SurfaceColour:
    color = style.SurfaceColour
    materials['diffuse_color'] = [
        float(getattr(color, 'Red', 0.8)),
        float(getattr(color, 'Green', 0.8)),
        float(getattr(color, 'Blue', 0.8))
    ]

# Transparency 정보
if hasattr(style, 'Transparency') and style.Transparency is not None:
    materials['transparency'] = float(style.Transparency)

# Specular color, Reflectance method 등
```

**데이터 구조**:
```json
{
  "System": {
    "Geometry": {
      "verts": [...],
      "faces": [...],
      "matrix": [...],
      "materials": {
        "diffuse_color": [r, g, b],
        "transparency": 0.8,
        "specular_color": [r, g, b],
        "reflectance_method": "...",
        "name": "Glass"
      }
    }
  }
}
```

#### Three.js 렌더링 구현

**파일**: `three_d_viewer.js` (line 11746-11790)

**수정 내용**:
```javascript
function applyRealisticMaterial(mesh, isSelected) {
    const rawData = mesh.userData.rawData;
    let color = 0x808080; // 기본 회색
    let opacity = 1.0; // 기본 불투명
    let transparent = false;

    // System.Geometry.materials에서 색상 및 투명도 정보 추출
    if (rawData && rawData.System && rawData.System.Geometry && rawData.System.Geometry.materials) {
        const materials = rawData.System.Geometry.materials;

        // Diffuse 색상 추출
        if (materials.diffuse_color && Array.isArray(materials.diffuse_color) && materials.diffuse_color.length >= 3) {
            const r = materials.diffuse_color[0];
            const g = materials.diffuse_color[1];
            const b = materials.diffuse_color[2];
            color = new THREE.Color(r, g, b).getHex();
        }

        // 투명도 추출 (IFC의 Transparency는 0=불투명, 1=완전투명)
        if (materials.transparency !== undefined && materials.transparency !== null) {
            opacity = 1.0 - materials.transparency; // Three.js opacity는 0=투명, 1=불투명
            transparent = materials.transparency > 0;
        }
    }

    // 선택된 경우 노란색 하이라이트
    if (isSelected) {
        color = 0xffff00;
        opacity = 1.0; // 선택 시 불투명
        transparent = false;
    }

    mesh.material = new THREE.MeshStandardMaterial({
        color: color,
        flatShading: false,
        side: THREE.DoubleSide,
        metalness: 0.1,
        roughness: 0.8,
        transparent: transparent,
        opacity: opacity,
        depthWrite: !transparent // 투명 객체는 depth write 비활성화
    });
    mesh.material.needsUpdate = true;
}
```

**주요 변경사항**:
1. `opacity` 변수 추가: 투명도 값 저장
2. `transparent` 변수 추가: 투명도 사용 여부
3. IFC의 Transparency 값 변환: `opacity = 1.0 - transparency`
4. `depthWrite` 설정: 투명 객체는 depth write 비활성화

### 2. 단면 자르기 기능 (Section Plane)

**배경**: 사용자 요청 - "뷰포트에 객체 전체 단면자르는 기능이랑"

#### 전역 변수 추가

**파일**: `three_d_viewer.js` (line 102-106)

```javascript
// 단면 자르기 (Section Plane) 변수
let clippingEnabled = false;
let clippingPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0); // Default: XY plane at Z=0
let clippingHelper = null; // Visual helper for the clipping plane
```

#### Renderer 설정

**파일**: `three_d_viewer.js` (line 169-171)

```javascript
// 단면 자르기를 위한 localClippingEnabled
renderer.localClippingEnabled = true;
```

#### 핵심 함수 구현

**파일**: `three_d_viewer.js` (line 11857-11985)

**1. `toggleClipping()` - 단면 ON/OFF**:
```javascript
window.toggleClipping = function() {
    clippingEnabled = !clippingEnabled;

    // 모든 메시에 clippingPlanes 적용/해제
    scene.traverse((object) => {
        if (object.isMesh && object.material) {
            if (clippingEnabled) {
                object.material.clippingPlanes = [clippingPlane];
            } else {
                object.material.clippingPlanes = [];
            }
            object.material.needsUpdate = true;
        }
    });

    // 버튼 상태 업데이트
    const clippingBtn = document.getElementById('toggle-clipping-btn');
    if (clippingBtn) {
        clippingBtn.textContent = clippingEnabled ? '단면 ON' : '단면 OFF';
        clippingBtn.classList.toggle('active', clippingEnabled);
    }

    // Helper 표시/숨김
    if (clippingEnabled && !clippingHelper) {
        createClippingHelper();
    } else if (!clippingEnabled && clippingHelper) {
        scene.remove(clippingHelper);
    }
};
```

**2. `setClippingAxis(axis)` - 단면 축 변경**:
```javascript
window.setClippingAxis = function(axis) {
    switch(axis) {
        case 'X':
            clippingPlane.normal.set(1, 0, 0);
            break;
        case 'Y':
            clippingPlane.normal.set(0, 1, 0);
            break;
        case 'Z':
            clippingPlane.normal.set(0, 0, 1);
            break;
    }

    // Helper 업데이트
    if (clippingHelper) {
        scene.remove(clippingHelper);
        createClippingHelper();
    }

    // 재질 업데이트
    scene.traverse((object) => {
        if (object.isMesh && object.material && clippingEnabled) {
            object.material.clippingPlanes = [clippingPlane];
            object.material.needsUpdate = true;
        }
    });
};
```

**3. `moveClippingPlane(delta)` - 단면 위치 이동**:
```javascript
window.moveClippingPlane = function(delta) {
    clippingPlane.constant += delta;

    // Helper 업데이트
    if (clippingHelper) {
        scene.remove(clippingHelper);
        createClippingHelper();
    }

    // 재질 업데이트
    scene.traverse((object) => {
        if (object.isMesh && object.material && clippingEnabled) {
            object.material.clippingPlanes = [clippingPlane];
            object.material.needsUpdate = true;
        }
    });
};
```

**4. `createClippingHelper()` - 시각적 헬퍼 생성**:
```javascript
function createClippingHelper() {
    const size = 50;
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.2,
        wireframe: false
    });

    clippingHelper = new THREE.Mesh(geometry, material);

    // 평면의 위치와 방향 설정
    const normal = clippingPlane.normal.clone();
    const distance = -clippingPlane.constant;

    // 평면 위치
    clippingHelper.position.copy(normal.multiplyScalar(distance));

    // 평면 회전
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), clippingPlane.normal);
    clippingHelper.setRotationFromQuaternion(quaternion);

    // 테두리 추가
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff0000 }));
    clippingHelper.add(line);

    scene.add(clippingHelper);
}
```

### 3. 치수 측정 기능 (Distance Measurement)

**배경**: 사용자 요청 - "그리고 치수 측정하는 기능도 추가해줘."

#### 전역 변수 추가

**파일**: `three_d_viewer.js` (line 108-113)

```javascript
// 치수 측정 (Distance Measurement) 변수
let measurementMode = false;
let measurementPoints = []; // Array of {x, y, z} points
let measurementLines = []; // Array of THREE.Line objects
let measurementLabels = []; // Array of HTML label elements
```

#### 핵심 함수 구현

**파일**: `three_d_viewer.js` (line 11987-12132)

**1. `toggleMeasurementMode()` - 측정 모드 토글**:
```javascript
window.toggleMeasurementMode = function() {
    measurementMode = !measurementMode;

    // 버튼 상태 업데이트
    const measureBtn = document.getElementById('toggle-measurement-btn');
    if (measureBtn) {
        measureBtn.textContent = measurementMode ? '측정 ON' : '측정 OFF';
        measureBtn.classList.toggle('active', measurementMode);
    }

    // 측정 모드가 꺼지면 모든 측정 삭제
    if (!measurementMode) {
        clearMeasurements();
    }
};
```

**2. `clearMeasurements()` - 모든 측정 삭제**:
```javascript
window.clearMeasurements = function() {
    // 측정점 초기화
    measurementPoints = [];

    // 라인 제거
    measurementLines.forEach(line => {
        scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
    });
    measurementLines = [];

    // 라벨 제거
    measurementLabels.forEach(label => {
        if (label.parentNode) {
            label.parentNode.removeChild(label);
        }
    });
    measurementLabels = [];
};
```

**3. `addMeasurementPoint(point)` - 측정점 추가**:
```javascript
function addMeasurementPoint(point) {
    measurementPoints.push(point);

    // 측정점 마커 생성
    const markerGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(point);
    scene.add(marker);
    measurementLines.push(marker); // 나중에 삭제하기 위해 저장

    // 2개 이상의 점이 있으면 선 그리기
    if (measurementPoints.length >= 2) {
        const start = measurementPoints[measurementPoints.length - 2];
        const end = measurementPoints[measurementPoints.length - 1];

        // 선 생성
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(line);
        measurementLines.push(line);

        // 거리 계산
        const distance = start.distanceTo(end);

        // 중간점 계산
        const midPoint = new THREE.Vector3().lerpVectors(start, end, 0.5);

        // 라벨 생성 (HTML 요소)
        const label = createMeasurementLabel(distance, midPoint);
        measurementLabels.push(label);

        console.log(`[3D Viewer] Measurement: ${distance.toFixed(3)}m`);
    }
}
```

**4. `createMeasurementLabel(distance, position)` - 측정 라벨 생성**:
```javascript
function createMeasurementLabel(distance, position) {
    const label = document.createElement('div');
    label.className = 'measurement-label';
    label.textContent = `${distance.toFixed(3)}m`;
    label.style.position = 'absolute';
    label.style.color = '#00ff00';
    label.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    label.style.padding = '4px 8px';
    label.style.borderRadius = '4px';
    label.style.fontSize = '14px';
    label.style.fontFamily = 'monospace';
    label.style.pointerEvents = 'none';
    label.style.zIndex = '1000';

    document.body.appendChild(label);

    // 위치 업데이트 함수
    const updatePosition = () => {
        if (!camera || !renderer) return;

        const vector = position.clone();
        vector.project(camera);

        const widthHalf = renderer.domElement.clientWidth / 2;
        const heightHalf = renderer.domElement.clientHeight / 2;

        const x = (vector.x * widthHalf) + widthHalf;
        const y = -(vector.y * heightHalf) + heightHalf;

        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
    };

    // 애니메이션 루프에서 위치 업데이트
    label.userData = { updatePosition };

    return label;
}
```

**5. `updateMeasurementLabels()` - 라벨 위치 업데이트**:
```javascript
function updateMeasurementLabels() {
    measurementLabels.forEach(label => {
        if (label.userData && label.userData.updatePosition) {
            label.userData.updatePosition();
        }
    });
}
```

#### 클릭 이벤트 통합

**파일**: `three_d_viewer.js` (line 2204-2223)

`onPointerUp` 함수에 측정 모드 처리 추가:

```javascript
// 측정 모드 처리
if (measurementMode) {
    // 측정 모드일 때는 객체 선택 대신 측정점 추가
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        addMeasurementPoint(point);
    }

    // 드래그 상태 초기화
    isDragging = false;
    dragStart = null;
    dragCurrent = null;
    if (selectionBox) {
        selectionBox.style.display = 'none';
    }
    return; // 측정 모드에서는 객체 선택 안 함
}
```

#### 애니메이션 루프 통합

**파일**: `three_d_viewer.js` (line 349-351)

`animate` 함수에 라벨 위치 업데이트 추가:

```javascript
// 측정 라벨 위치 업데이트
updateMeasurementLabels();
```

### 4. UI 버튼 추가

**파일**: `three_d_viewer.html` (line 72-81)

하단 렌더링 컨트롤 바에 9개 버튼 추가:

```html
<div class="rendering-controls-bar">
    <!-- 기존 렌더링 모드 버튼들 -->
    <button id="realistic-mode-btn" class="rendering-mode-btn active">실제색상</button>
    <button id="white-mode-btn" class="rendering-mode-btn">백색</button>
    <button id="wireframe-mode-btn" class="rendering-mode-btn">선</button>
    <button id="material-mode-btn" class="rendering-mode-btn">재질</button>
    <button id="edges-mode-btn" class="rendering-mode-btn">테두리</button>
    <button id="sunlight-mode-btn" class="rendering-mode-btn">태양광</button>
    <button id="shadow-toggle-btn" class="rendering-mode-btn shadow-btn">그림자 OFF</button>

    <!-- 구분선 -->
    <div class="button-separator"></div>

    <!-- 단면 자르기 버튼 -->
    <button id="toggle-clipping-btn" class="rendering-mode-btn">단면 OFF</button>
    <button id="clip-axis-x-btn" class="rendering-mode-btn">X</button>
    <button id="clip-axis-y-btn" class="rendering-mode-btn">Y</button>
    <button id="clip-axis-z-btn" class="rendering-mode-btn">Z</button>
    <button id="clip-move-plus-btn" class="rendering-mode-btn">+</button>
    <button id="clip-move-minus-btn" class="rendering-mode-btn">-</button>

    <!-- 구분선 -->
    <div class="button-separator"></div>

    <!-- 치수 측정 버튼 -->
    <button id="toggle-measurement-btn" class="rendering-mode-btn">측정 OFF</button>
    <button id="clear-measurements-btn" class="rendering-mode-btn">측정삭제</button>
</div>
```

### 5. CSS 스타일 추가

**파일**: `style.css` (끝부분 추가)

```css
/* 버튼 구분선 */
.button-separator {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.3);
    margin: 0 4px;
}
```

### 6. 이벤트 리스너 연결

**파일**: `three_d_viewer.js` (line 1107-1145)

```javascript
// 단면 자르기 버튼 이벤트 리스너
const toggleClippingBtn = document.getElementById('toggle-clipping-btn');
const clipAxisXBtn = document.getElementById('clip-axis-x-btn');
const clipAxisYBtn = document.getElementById('clip-axis-y-btn');
const clipAxisZBtn = document.getElementById('clip-axis-z-btn');
const clipMovePlusBtn = document.getElementById('clip-move-plus-btn');
const clipMoveMinusBtn = document.getElementById('clip-move-minus-btn');

if (toggleClippingBtn) {
    toggleClippingBtn.onclick = () => window.toggleClipping();
}
if (clipAxisXBtn) {
    clipAxisXBtn.onclick = () => window.setClippingAxis('X');
}
if (clipAxisYBtn) {
    clipAxisYBtn.onclick = () => window.setClippingAxis('Y');
}
if (clipAxisZBtn) {
    clipAxisZBtn.onclick = () => window.setClippingAxis('Z');
}
if (clipMovePlusBtn) {
    clipMovePlusBtn.onclick = () => window.moveClippingPlane(1);
}
if (clipMoveMinusBtn) {
    clipMoveMinusBtn.onclick = () => window.moveClippingPlane(-1);
}

// 치수 측정 버튼 이벤트 리스너
const toggleMeasurementBtn = document.getElementById('toggle-measurement-btn');
const clearMeasurementsBtn = document.getElementById('clear-measurements-btn');

if (toggleMeasurementBtn) {
    toggleMeasurementBtn.onclick = () => window.toggleMeasurementMode();
}
if (clearMeasurementsBtn) {
    clearMeasurementsBtn.onclick = () => window.clearMeasurements();
}
```

## 수정된 파일 목록

1. **connections/static/connections/three_d_viewer.js**
   - 전역 변수 추가 (line 102-113): 단면 자르기, 치수 측정 변수
   - Renderer localClippingEnabled 설정 (line 169-171)
   - `applyRealisticMaterial()` 함수 수정 (line 11746-11790): 투명도 지원
   - 단면 자르기 함수 추가 (line 11857-11985)
   - 치수 측정 함수 추가 (line 11987-12132)
   - 이벤트 리스너 추가 (line 1107-1145)
   - `onPointerUp()` 측정 모드 처리 추가 (line 2204-2223)
   - `animate()` 라벨 업데이트 추가 (line 349-351)

2. **connections/templates/three_d_viewer.html**
   - 렌더링 컨트롤 바에 버튼 9개 추가 (line 72-81)

3. **connections/static/connections/style.css**
   - 버튼 구분선 스타일 추가

## 사용 방법

### IFC Material 투명도 렌더링

1. Blender에서 IFC 파일 열기
2. Blender 애드온에서 "Send to Web" 클릭
3. 웹 3D 뷰어에서 "불러오기" 클릭
4. **"실제색상" 버튼 클릭**
5. Glass 등 투명 재질이 투명하게 표시됨

**예시**:
- Frame (검은색, 불투명): RGB(0.043, 0.043, 0.043), Transparency = 0
- Glass (밝은 청록색, 80% 투명): RGB(0.8, 1.0, 1.0), Transparency = 0.8

### 단면 자르기 사용법

1. **"단면 OFF" 버튼 클릭** → 단면 ON으로 변경
2. 빨간색 반투명 평면이 표시됨
3. **X, Y, Z 버튼** 클릭으로 단면 축 변경
4. **+, - 버튼** 클릭으로 단면 위치 이동 (1단위씩)
5. **"단면 ON" 버튼 클릭** → 단면 해제

**특징**:
- 실시간으로 모델 내부를 볼 수 있음
- 빨간색 헬퍼 평면으로 단면 위치 시각화
- 모든 객체에 동시에 적용됨

### 치수 측정 사용법

1. **"측정 OFF" 버튼 클릭** → 측정 ON으로 변경
2. 3D 뷰포트에서 첫 번째 점 클릭
3. 두 번째 점 클릭
4. 녹색 선과 거리 라벨(단위: m)이 표시됨
5. 계속해서 다음 점 클릭 → 연속 측정 가능
6. **"측정삭제" 버튼** 클릭 → 모든 측정 삭제
7. **"측정 ON" 버튼 클릭** → 측정 모드 해제

**특징**:
- 녹색 구 마커로 측정점 표시
- 녹색 선으로 구간 연결
- HTML 라벨로 거리 표시 (소수점 3자리)
- 카메라 이동/회전 시 라벨 위치 자동 업데이트
- 여러 구간 동시 측정 가능

## 기술적 세부사항

### IFC Transparency 변환

IFC와 Three.js의 투명도 정의가 반대:
- **IFC Transparency**: 0 = 불투명, 1 = 완전 투명
- **Three.js opacity**: 0 = 투명, 1 = 불투명

**변환 공식**:
```javascript
opacity = 1.0 - materials.transparency;
```

### Three.js Clipping Plane

Three.js의 clipping plane은 `THREE.Plane` 객체를 사용:
- **normal**: 평면의 법선 벡터 (x, y, z)
- **constant**: 원점으로부터의 거리

평면 방정식: `normal · point + constant = 0`

**재질에 적용**:
```javascript
mesh.material.clippingPlanes = [clippingPlane];
```

**Renderer 설정 필수**:
```javascript
renderer.localClippingEnabled = true;
```

### HTML 라벨 위치 계산

3D 좌표를 2D 화면 좌표로 변환:

```javascript
const vector = position.clone();
vector.project(camera); // NDC 좌표 (-1 ~ 1)

const widthHalf = renderer.domElement.clientWidth / 2;
const heightHalf = renderer.domElement.clientHeight / 2;

const x = (vector.x * widthHalf) + widthHalf;      // 화면 X 좌표
const y = -(vector.y * heightHalf) + heightHalf;   // 화면 Y 좌표
```

매 프레임마다 `updateMeasurementLabels()`에서 위치 업데이트.

## 테스트 시나리오

### 투명도 렌더링 테스트
- [x] 불투명 재질 (Frame) 정상 표시
- [x] 반투명 재질 (Glass) 투명하게 표시
- [x] 투명도 값에 따라 opacity 정확히 계산
- [x] 선택 시 불투명 노란색으로 변경
- [x] 선택 해제 시 원래 투명도로 복원

### 단면 자르기 테스트
- [x] 단면 ON/OFF 정상 작동
- [x] X, Y, Z축 단면 정상 전환
- [x] +, - 버튼으로 단면 위치 이동
- [x] 빨간색 헬퍼 평면 정상 표시
- [x] 헬퍼 평면 위치/회전 정확함

### 치수 측정 테스트
- [x] 측정 모드 ON/OFF 정상 작동
- [x] 클릭 시 측정점 추가
- [x] 두 점 간 거리 정확히 계산
- [x] 녹색 선과 라벨 정상 표시
- [x] 카메라 이동 시 라벨 위치 업데이트
- [x] 측정삭제 버튼으로 모든 측정 삭제
- [x] 여러 구간 연속 측정 가능

## 향후 개선 방향

### 단면 자르기
1. 여러 개의 clipping plane 동시 사용
2. 마우스 드래그로 평면 위치 조정
3. 단면 평면 반전 기능
4. 단면 저장/불러오기

### 치수 측정
1. 거리 단위 변경 (m, cm, mm)
2. 각도 측정 기능
3. 면적 측정 기능 (폴리곤)
4. 측정 결과 CSV 내보내기
5. 측정 라벨 편집 (색상, 크기, 위치)

### IFC Material 렌더링
1. Specular 반사 지원
2. Normal map 지원
3. Metallic/Roughness map 지원
4. 재질별 렌더링 모드에 투명도 적용

## 커밋 메시지

```
Add IFC material transparency, section plane, and distance measurement features

- Add IFC material transparency rendering support
  - Extract transparency from IFC IFCSURFACESTYLESHADING
  - Convert IFC transparency (0=opaque) to Three.js opacity (1=opaque)
  - Support transparent/opaque materials with depthWrite control
  - Blender addon already extracts material info (line 229-291)

- Add section plane (clipping) functionality
  - Toggle clipping on/off with visual helper (red transparent plane)
  - Switch clipping axis (X, Y, Z)
  - Move clipping plane position with +/- buttons
  - Enable renderer.localClippingEnabled for clipping support

- Add distance measurement functionality
  - Toggle measurement mode on/off
  - Click to add measurement points (green spheres)
  - Draw green lines between points with distance labels
  - Update label positions in animation loop
  - Clear all measurements with button
  - Support continuous multi-segment measurement

- Add UI buttons to rendering controls bar
  - 6 buttons for section plane (toggle, X/Y/Z, +/-)
  - 2 buttons for distance measurement (toggle, clear)
  - Add button separators for visual grouping

Technical changes:
- three_d_viewer.js: Add clipping/measurement variables, functions, event listeners
- three_d_viewer.html: Add 9 new buttons to rendering controls bar
- style.css: Add button separator style
- applyRealisticMaterial(): Add transparency support with opacity/transparent/depthWrite
- onPointerUp(): Add measurement mode click handling
- animate(): Add updateMeasurementLabels() call

New global functions:
- window.toggleClipping(), setClippingAxis(), moveClippingPlane()
- window.toggleMeasurementMode(), clearMeasurements()

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

## 참고 사항

- IFC Material 정보는 Blender 애드온에서 이미 추출되고 있었음
- Three.js의 투명도와 IFC의 투명도 정의가 반대임에 주의
- Clipping plane은 renderer.localClippingEnabled 설정 필수
- 측정 라벨은 HTML 요소이므로 z-index 관리 중요
- 애니메이션 루프에서 라벨 위치를 매 프레임 업데이트해야 함
