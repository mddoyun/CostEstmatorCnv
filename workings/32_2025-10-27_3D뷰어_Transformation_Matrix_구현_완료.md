# 작업 요약: 3D 뷰어 Transformation Matrix 구현 및 좌표계 변환

**작업 날짜:** 2025-10-27
**주요 목표:**
1. 3D 뷰어에서 실제 BIM geometry 데이터 로드
2. Blender 애드온에서 transformation matrix 추출 및 전송
3. Z-up (IFC/Blender) → Y-up (Three.js) 좌표계 변환
4. BIM 객체를 올바른 위치와 방향으로 3D 뷰어에 표시

---

## 1. 초기 문제 상황

### 1.1 발견된 문제
- 3D 뷰어의 Load Geometry 버튼을 누르면 테스트용 녹색 큐브만 표시됨
- 실제 BIM 데이터가 로드되지 않음
- Geometry 데이터 경로가 잘못됨: `raw_data.geometry` → 실제는 `raw_data.Parameters.Geometry`

### 1.2 첫 번째 시도 - Geometry 경로 수정
```javascript
// three_d_viewer.js - loadPlaceholderGeometry()
const geometryObjects = window.allRevitData
    .filter(obj => obj.raw_data && obj.raw_data.Parameters && obj.raw_data.Parameters.Geometry)
    .map(obj => ({
        id: obj.id,
        geometry: {
            vertices: obj.raw_data.Parameters.Geometry.verts,
            faces: obj.raw_data.Parameters.Geometry.faces
        }
    }));
```

**결과:**
- ✅ Geometry 데이터 로드 성공
- ❌ 모든 벽이 원점에 누워서 표시됨 (위치/회전 정보 없음)

---

## 2. Transformation Matrix 추가

### 2.1 문제 분석
- IFC 파일에서 각 객체는 두 가지 정보를 가짐:
  - **Geometry**: 로컬 좌표계 기준 vertices, faces
  - **ObjectPlacement**: 글로벌 좌표계로의 변환 (위치, 회전, 스케일)
- `ifcopenshell.geom.create_shape()`는 `shape.transformation`에 4x4 변환 행렬 포함

### 2.2 Blender 애드온 수정 과정

#### 시도 1: 직접 변환 실패
```python
# CostEstimator_BlenderAddon_453/__init__.py
matrix = list(shape.transformation)  # ❌ 'Transformation' object is not iterable
```

#### 시도 2: 속성 접근 실패
```python
matrix = list(shape.transformation.matrix.data)  # ❌ 'Transformation' object has no attribute 'data'
```

#### 시도 3: 디버깅을 통한 구조 파악
```python
print(f"[DEBUG] Element {element.id()} trans type: {type(trans)}")
print(f"[DEBUG] Element {element.id()} attrs: {[x for x in dir(trans) if not x.startswith('_')]}")
```

**출력 결과:**
```
[DEBUG] Element 1220 trans type: <class 'ifcopenshell.ifcopenshell_wrapper.Transformation'>
[DEBUG] Element 1220 attrs: ['data', 'matrix', 'matrix_', 'this', 'thisown']
[DEBUG] Element 1220 trans.matrix type: <class 'tuple'>
```

#### 시도 4: 성공적인 추출 방법 (최종)
```python
# CostEstimator_BlenderAddon_453/__init__.py (lines 136-156)
if hasattr(trans, 'matrix'):
    try:
        trans_matrix = trans.matrix  # tuple of 16 floats

        # Try 2D array access (4x4)
        matrix = []
        for i in range(4):
            for j in range(4):
                matrix.append(float(trans_matrix[i][j]))
    except Exception as e1:
        # trans.matrix is flat tuple, not 2D
        matrix = [float(trans_matrix[i]) for i in range(16)]

print(f"[DEBUG] Element {element.id()} SUCCESS - matrix ready, length: {len(matrix)}")
```

**결과:**
```
[DEBUG] Element 1220 [i][j] failed: 'float' object is not subscriptable
[DEBUG] Element 1220 extracted via [i], length: 16
[DEBUG] Element 1220 SUCCESS - matrix ready, length: 16
```

### 2.3 최종 Blender 애드온 코드
```python
# CostEstimator_BlenderAddon_453/__init__.py (lines 113-189)
try:
    shape = ifcopenshell.geom.create_shape(settings, element)
    verts = ifcopenshell.util.shape.get_vertices(shape.geometry)
    faces = ifcopenshell.util.shape.get_faces(shape.geometry)

    # Extract transformation matrix
    matrix = None
    trans = shape.transformation
    if trans and hasattr(trans, 'matrix'):
        trans_matrix = trans.matrix
        try:
            # trans.matrix is a flat tuple of 16 floats (column-major)
            matrix = [float(trans_matrix[i]) for i in range(16)]
        except:
            matrix = None

    element_dict["Parameters"]["Geometry"] = {
        "verts": verts.tolist(),
        "faces": faces.tolist(),
        "matrix": matrix  # 4x4 transformation matrix
    }
except Exception as e:
    print(f"Could not get geometry for element {element.id()}: {e}")
    element_dict["Parameters"]["Geometry"] = None
```

---

## 3. 웹소켓 통신 문제 해결

### 3.1 문제 발견
- Blender에서 데이터 전송 시 아무 반응 없음
- 웹 브라우저가 무한 대기 상태
- 터미널 로그: `[DEBUG] Received message: fetch_all_elements_chunked` 이후 멈춤

### 3.2 원인 분석
```python
# 잘못된 코드
event_queue = asyncio.Queue()  # 비동기 큐

async def websocket_handler(uri):
    await event_queue.put(message_data)  # 비동기 put

def process_event_queue_timer():  # 동기 함수
    event_queue.get_nowait()  # ❌ 스레드 간 통신 불가
```

**문제:** `asyncio.Queue()`는 같은 이벤트 루프 내에서만 작동. 웹소켓 스레드와 Blender 메인 스레드가 분리되어 있어 큐에서 메시지를 꺼낼 수 없음.

### 3.3 해결 방법
```python
# CostEstimator_BlenderAddon_453/__init__.py
import queue  # 표준 queue 모듈 추가

# 전역 변수
event_queue = queue.Queue()  # 스레드 안전 큐로 변경

# 웹소켓 핸들러
async def websocket_handler(uri):
    message_data = json.loads(message_str)
    event_queue.put(message_data)  # await 제거, 동기 put 사용
    print(f"[DEBUG] Message added to queue, queue size: {event_queue.qsize()}")

# 타이머 함수 (Blender 메인 스레드)
def process_event_queue_timer():
    while not event_queue.empty():
        command_data = event_queue.get_nowait()  # 정상 작동
        # 명령 처리...
    return 0.1  # 0.1초마다 재실행
```

**결과:**
```
[DEBUG] Received message: fetch_all_elements_chunked
[DEBUG] Message added to queue, queue size: 1
[DEBUG] Queue has 1 messages (timer call #106)
[DEBUG] Processing command: fetch_all_elements_chunked
[DEBUG] Scheduling handle_fetch_all_elements
[DEBUG] handle_fetch_all_elements called
🔍 [Blender] 5개의 IFC 객체 데이터 직렬화를 시작합니다.
```

---

## 4. 3D 뷰어 좌표계 변환

### 4.1 문제 발견
- Geometry와 transformation matrix는 정상 로드
- 하지만 3D 뷰어에서 벽이 옆으로 누워있음
- **원인:** Blender/IFC는 Z-up (Z축이 위), Three.js는 Y-up (Y축이 위)

### 4.2 좌표계 변환 구현

#### 변환 행렬 계산
```
Z-up → Y-up 변환:
- X축: 유지
- Y축 → Z축 방향
- Z축 → -Y축 방향

변환 행렬:
[ 1   0   0   0 ]
[ 0   0   1   0 ]
[ 0  -1   0   0 ]
[ 0   0   0   1 ]
```

#### 코드 구현
```javascript
// three_d_viewer.js (lines 294-313)
if (geomData.matrix && geomData.matrix.length === 16) {
    // IFC transformation matrix (column-major format)
    const ifcMatrix = new THREE.Matrix4();
    ifcMatrix.fromArray(geomData.matrix);

    // Convert from Z-up (IFC/Blender) to Y-up (Three.js)
    const zUpToYUp = new THREE.Matrix4();
    zUpToYUp.set(
        1,  0,  0,  0,
        0,  0,  1,  0,
        0, -1,  0,  0,
        0,  0,  0,  1
    );

    // Apply: first IFC matrix, then coordinate system conversion
    const finalMatrix = new THREE.Matrix4();
    finalMatrix.multiplyMatrices(zUpToYUp, ifcMatrix);
    mesh.applyMatrix4(finalMatrix);
}
```

### 4.3 부호 조정
- 초기 변환 시 위아래가 반대로 표시됨
- Z축 부호를 조정하여 해결

**최종 변환 행렬:**
```javascript
zUpToYUp.set(
    1,  0,  0,  0,
    0,  0,  1,  0,   // Y → Z (양수)
    0, -1,  0,  0,   // Z → -Y (음수)
    0,  0,  0,  1
);
```

---

## 5. 파일 변경 사항 요약

### 수정된 파일

1. **CostEstimator_BlenderAddon_453/__init__.py**
   - `import queue` 추가 (line 33)
   - `event_queue = queue.Queue()` 변경 (line 45)
   - Transformation matrix 추출 로직 추가 (lines 121-183)
   - 웹소켓 핸들러 수정: `event_queue.put()` (line 231)
   - 디버깅 로그 추가 (다수)

2. **connections/static/connections/three_d_viewer.js**
   - `loadPlaceholderGeometry()` 함수 수정 (lines 97-166)
     - BIM 데이터 경로 수정: `raw_data.Parameters.Geometry`
     - vertices, faces, matrix 매핑
     - fallback 로직 (데이터 없을 시 큐브 표시)
   - `loadBimGeometry()` 함수 수정 (lines 225-326)
     - vertices/faces 배열 평탄화: `.flat()`
     - Transformation matrix 적용
     - Z-up → Y-up 좌표계 변환
   - 디버깅 로그 추가 (lines 155-162)

3. **connections/static/connections/navigation.js**
   - `three-d-viewer` 케이스 추가 (lines 495-501)
   - 3D 뷰어 탭 전환 시 `clearAllTabData()` 호출 방지

---

## 6. 기술적 세부사항

### 6.1 IFC Transformation Matrix 구조
- **형식:** IfcOpenShell의 `Transformation` 객체
- **데이터:** `trans.matrix` - 16개 float 값의 tuple (column-major order)
- **레이아웃:**
  ```
  [0  4  8  12]   [m00 m01 m02 m03]
  [1  5  9  13] = [m10 m11 m12 m13]
  [2  6 10  14]   [m20 m21 m22 m23]
  [3  7 11  15]   [m30 m31 m32 m33]
  ```

### 6.2 Three.js Matrix4
- **형식:** `THREE.Matrix4` 클래스
- **메서드:**
  - `fromArray(array)`: 배열에서 행렬 생성
  - `multiplyMatrices(a, b)`: a × b 행렬 곱셈
  - `set(...)`: 16개 값 직접 설정
- **적용:** `mesh.applyMatrix4(matrix)` - geometry에 변환 적용

### 6.3 좌표계 변환 수학
```
Z-up 좌표 (x, y, z) → Y-up 좌표 (x', y', z')

[x']   [ 1   0   0 ] [x]   [  x  ]
[y'] = [ 0   0  -1 ] [y] = [ -z  ]
[z']   [ 0   1   0 ] [z]   [  y  ]
```

### 6.4 Geometry 데이터 변환
```javascript
// Blender 전송 형식 (2D array)
verts: [[x1, y1, z1], [x2, y2, z2], ...]
faces: [[i1, i2, i3], [i4, i5, i6], ...]

// Three.js 요구 형식 (1D flat array)
const flatVertices = verts.flat();  // [x1, y1, z1, x2, y2, z2, ...]
const flatFaces = faces.flat();     // [i1, i2, i3, i4, i5, i6, ...]

const positions = new Float32Array(flatVertices);
const indices = new Uint32Array(flatFaces);
```

---

## 7. 테스트 결과

### 성공적으로 해결된 문제
✅ BIM geometry 데이터 로드 성공
✅ Transformation matrix 추출 및 전송 성공
✅ 웹소켓 통신 스레드 간 문제 해결
✅ Z-up → Y-up 좌표계 변환 성공
✅ BIM 객체가 올바른 위치와 방향으로 3D 뷰어에 표시

### 테스트 데이터
- **프로젝트:** Untitled.ifc
- **객체 수:** 5개 (벽 2개, 공간 요소 3개)
- **Geometry 있는 객체:** 2개 (벽 2개)
- **Transformation matrix:** 16개 float 값 (4x4 행렬)

### 최종 결과
```
[DEBUG] Element 1220 SUCCESS - matrix ready, length: 16
[DEBUG] Element 1247 SUCCESS - matrix ready, length: 16
✅ [Blender] 객체 데이터 직렬화 완료.

[3D Viewer] Found 2 objects with geometry data.
[3D Viewer] BIM geometry loaded. 2 objects processed.
[3D Viewer] Camera centered on geometry.
```

**3D 뷰어 표시:**
- 벽 2개가 Blender/IFC와 동일한 위치에 표시
- 올바른 방향으로 서 있음 (누워있지 않음)
- 상하 방향 정상 (뒤집히지 않음)

---

## 8. 학습 내용 및 핵심 개념

### 8.1 Python 비동기 프로그래밍
- `asyncio.Queue()` vs `queue.Queue()`
- 이벤트 루프와 스레드 간 통신
- `asyncio.run_coroutine_threadsafe()` 사용법

### 8.2 IFC/IfcOpenShell
- `ifcopenshell.geom.create_shape()` 사용법
- `shape.transformation` 객체 구조
- Geometry와 Placement의 분리

### 8.3 3D 그래픽스 수학
- 4x4 변환 행렬 (Transformation Matrix)
- Column-major vs Row-major 레이아웃
- 좌표계 변환 (Coordinate System Conversion)
- 행렬 곱셈 순서의 중요성

### 8.4 Three.js
- `BufferGeometry` 생성 및 속성 설정
- `Matrix4` 행렬 연산
- `applyMatrix4()` vs `setMatrix()`
- Z-up과 Y-up 좌표계 차이

---

## 9. 향후 개선 사항

### 9.1 성능 최적화
- [ ] 큰 IFC 파일 처리 시 메모리 최적화
- [ ] LOD (Level of Detail) 구현
- [ ] Frustum culling 적용

### 9.2 기능 추가
- [ ] 객체 선택 기능 (raycasting)
- [ ] 색상 커스터마이징 (재료별, 유형별)
- [ ] 단면 뷰 (Section View)
- [ ] 측정 도구

### 9.3 사용성 개선
- [ ] 로딩 인디케이터 추가
- [ ] 에러 메시지 사용자 친화적으로 개선
- [ ] 카메라 프리셋 (Top, Front, Side 뷰)

---

**작업 완료 상태:** ✅ 성공
**다음 단계:** 사용자 피드백 기반 추가 개선

## 10. 디버깅 팁 및 문제 해결

### 10.1 Blender 애드온 디버깅
```python
# 터미널에서 Blender 실행하여 print() 출력 확인
/Applications/Blender.app/Contents/MacOS/Blender

# 주요 확인 사항
- [DEBUG] WebSocket connected successfully
- [DEBUG] Queue has X messages
- [DEBUG] Element XXX SUCCESS - matrix ready
```

### 10.2 웹 브라우저 디버깅
```javascript
// 콘솔에서 데이터 확인
console.log(window.allRevitData);
const geomObj = window.allRevitData.find(obj => obj.raw_data?.Parameters?.Geometry);
console.log(geomObj.raw_data.Parameters.Geometry);
```

### 10.3 일반적인 문제와 해결책

| 문제 | 원인 | 해결 방법 |
|------|------|-----------|
| Matrix: null | Blender 애드온이 matrix를 전송하지 않음 | 애드온 재설치, IFC 파일 다시 열기 |
| 큐브만 표시됨 | allRevitData가 비어있음 | Connector Mode를 Blender로 변경, 데이터 재전송 |
| 웹소켓 응답 없음 | 큐 통신 문제 | Blender 재시작, 애드온 재설치 |
| 객체가 옆으로 누워있음 | 좌표계 변환 미적용 | three_d_viewer.js 최신 버전 확인 |
| 위아래 반대 | Z축 부호 오류 | zUpToYUp 행렬 확인 (0, -1, 0) |

---

**문서 작성일:** 2025-10-27
**작성자:** Claude Code
**관련 파일:** 31_2025-10-27_프로젝트문서_및_3D뷰어_구현_오류_해결.md
