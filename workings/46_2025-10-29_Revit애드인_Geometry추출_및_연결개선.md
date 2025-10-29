# Revit 애드인 Geometry 추출 및 연결 기능 개선

**날짜**: 2025-10-29
**작업 분류**: Feature (Revit 애드인 독립 개발)

---

## 목표

Revit 애드인을 **웹브라우저 코드와 완전히 독립적으로** 개발하여 Blender와 동일한 기능 제공:
1. **Geometry 정보를 Blender와 동일한 구조로 전송**
2. **서버 시작 없이 바로 연결 가능** (외부 서버 지원)

---

## 요구사항

✅ **웹브라우저/서버 코드는 절대 건드리지 않음**
✅ **Revit 애드인만 수정**
✅ **Blender의 Geometry 구조를 정확히 따라야 함**

---

## Blender Geometry 구조 분석

**파일**: `CostEstimator_BlenderAddon_453/__init__.py` (Lines 185-189)

```python
element_dict["Parameters"]["Geometry"] = {
    "verts": verts.tolist(),  # [x1, y1, z1, x2, y2, z2, ...]
    "faces": faces.tolist(),  # [i1, i2, i3, i4, i5, i6, ...]
    "matrix": matrix  # [m00, m01, ..., m33] (4x4 = 16 elements)
}
```

### 구조 설명

1. **verts**: 정점 좌표 배열 (x, y, z 순서)
2. **faces**: 삼각형 인덱스 배열 (3개씩 하나의 삼각형)
3. **matrix**: 4x4 변환 행렬 (column-major order, 16개 요소)

---

## 구현 내용

### 1. Revit Geometry 추출 메서드 추가

**파일**: `CostEstimator_RevitAddin_2026/MainTools/QuantityTakeoff_web/RevitDataCollector.cs`

#### 추가된 메서드

1. **ExtractGeometry()**: 전체 Geometry 추출
2. **ProcessGeometryObject()**: GeometryObject 재귀 처리
3. **ProcessSolid()**: Solid에서 Face 삼각분할 및 정점 추출
4. **ProcessMesh()**: Mesh 정점 추출
5. **ExtractTransformMatrix()**: 4x4 변환 행렬 추출

#### 핵심 로직

```csharp
// Blender와 동일한 구조로 반환
return new Dictionary<string, object>
{
    ["verts"] = allVerts,  // List<double>
    ["faces"] = allFaces,  // List<int>
    ["matrix"] = matrix    // List<double> (16 elements)
};
```

#### Geometry 추출 과정

1. **Element.get_Geometry()** → GeometryElement 획득
2. **Solid.Faces** → Face 순회
3. **Face.Triangulate()** → 삼각형 분할
4. **Triangle.get_Vertex(j)** → 정점 좌표 추출
5. **Transform.OfPoint()** → 변환 적용
6. **정점을 verts 배열에 추가** (x, y, z 순서)
7. **인덱스를 faces 배열에 추가**

#### 변환 행렬 구조

```csharp
// Column-major order (OpenGL/Blender 방식)
// [col0_row0, col0_row1, col0_row2, col0_row3,
//  col1_row0, col1_row1, col1_row2, col1_row3,
//  col2_row0, col2_row1, col2_row2, col2_row3,
//  col3_row0, col3_row1, col3_row2, col3_row3]

// 예시:
// [BasisX.X, BasisX.Y, BasisX.Z, 0,
//  BasisY.X, BasisY.Y, BasisY.Z, 0,
//  BasisZ.X, BasisZ.Y, BasisZ.Z, 0,
//  Origin.X, Origin.Y, Origin.Z, 1]
```

### 2. 서버 시작 요구사항 제거

**파일**: `ConnectorWindow.xaml.cs`

#### Before (Lines 89-93):
```csharp
if (_serverProcess == null || _serverProcess.HasExited)
{
    MessageBox.Show("Please start the server first.", ...");
    return;
}
```

#### After:
```csharp
// [제거] 서버 프로세스 체크 제거
// 사용자가 Python으로 직접 실행하거나, Blender에서 실행한 서버에도 연결 가능
```

#### 추가된 기능

- **연결 실패 시 안내 메시지**: 서버가 실행 중인지 확인하도록 안내
- **예외 발생 시 상세 메시지**: 문제 해결에 도움이 되는 정보 제공

---

## 데이터 흐름

### Blender → 웹브라우저

```
Blender Addon (Python)
  └─> extract mesh triangles
      └─> element_dict["Parameters"]["Geometry"] = {
              "verts": [...],
              "faces": [...],
              "matrix": [...]
          }
          └─> JSON serialize
              └─> WebSocket 전송
                  └─> Django 수신
                      └─> raw_data 저장
                          └─> 웹브라우저에서 3D 렌더링
```

### Revit → 웹브라우저 (이제 동일!)

```
Revit Addin (C#)
  └─> ExtractGeometry()
      └─> Solid → Faces → Triangulate
          └─> Dictionary<string, object> {
                  ["verts"] = allVerts,
                  ["faces"] = allFaces,
                  ["matrix"] = matrix
              }
              └─> JSON serialize (자동)
                  └─> WebSocket 전송
                      └─> Django 수신
                          └─> raw_data 저장
                              └─> 웹브라우저에서 3D 렌더링
```

**결과**: **웹브라우저 코드는 Blender든 Revit이든 동일하게 처리!**

---

## 사용 시나리오

### 시나리오 1: Revit에서 자체 서버 사용

1. Revit 열기
2. "Start Server" 버튼 클릭
3. "Connect to Server" 버튼 클릭
4. 데이터 전송

### 시나리오 2: 외부 서버 사용 (새로운 기능!)

1. 터미널에서 `python manage.py runserver` 실행
2. Revit 열기
3. **바로 "Connect to Server" 버튼 클릭** (Start Server 불필요)
4. 데이터 전송

### 시나리오 3: Blender 서버에 연결 (새로운 기능!)

1. Blender에서 서버 시작
2. Revit 열기
3. 서버 URL이 동일하면 **바로 연결 가능**
4. Blender와 Revit이 동일한 서버 공유

---

## 기술적 세부사항

### Geometry 추출 최적화

- **DetailLevel.Medium**: 너무 상세하지 않으면서도 충분한 품질
- **IncludeNonVisibleObjects = false**: 보이지 않는 객체 제외
- **GeometryInstance 처리**: 패밀리 인스턴스의 geometry도 추출
- **예외 처리**: 실패 시 null 반환하여 전체 프로세스 중단 방지

### 타입 변경

**Before**: `Dictionary<string, string>`
**After**: `Dictionary<string, object>`

**이유**: Geometry는 딕셔너리이므로 object 타입이 필요

---

## 테스트 시나리오

### 1. Geometry 데이터 확인

**단계**:
1. Revit에서 간단한 모델 열기 (벽, 기둥, 슬래브)
2. Connect to Server → 데이터 전송
3. 웹브라우저 콘솔에서 확인:
   ```javascript
   console.log(allRevitData[0].raw_data.Parameters.Geometry)
   ```

**기대 결과**:
```javascript
{
  verts: [x1, y1, z1, x2, y2, z2, ...],
  faces: [0, 1, 2, 3, 4, 5, ...],
  matrix: [m00, m01, ..., m33]  // 16 elements
}
```

### 2. 3D 뷰어 렌더링

**단계**:
1. 데이터 분석 탭 열기
2. 3D 뷰어 탭 클릭

**기대 결과**:
- ✅ Revit 객체들이 3D로 표시됨
- ✅ 색상으로 구분됨
- ✅ 마우스로 회전/줌 가능

### 3. 외부 서버 연결

**단계**:
1. 터미널: `python manage.py runserver`
2. Revit 열기
3. **Start Server 누르지 않고** 바로 Connect

**기대 결과**:
- ✅ 정상 연결됨
- ✅ 데이터 전송 가능

### 4. Blender/Revit 데이터 비교

**단계**:
1. Blender로 IFC 파일 전송
2. Revit으로 동일한 파일 전송
3. 웹브라우저에서 Geometry 구조 비교

**기대 결과**:
- ✅ 동일한 필드명: verts, faces, matrix
- ✅ 동일한 데이터 타입
- ✅ 웹브라우저 코드가 동일하게 처리

---

## 영향 범위

### 영향을 받는 파일 (Revit 애드인만!)

1. **RevitDataCollector.cs**: Geometry 추출 메서드 추가
2. **ConnectorWindow.xaml.cs**: 서버 프로세스 체크 제거

### 영향을 받지 않는 파일 (웹브라우저/서버)

1. ✅ **views.py**: 변경 없음
2. ✅ **consumers.py**: 변경 없음
3. ✅ **three_d_viewer.js**: 변경 없음
4. ✅ **모든 프론트엔드 코드**: 변경 없음

---

## 하위 호환성

✅ **완전 하위 호환**

- 기존 Revit 데이터 (Geometry 없음): 정상 작동
- 새 Revit 데이터 (Geometry 있음): 3D 뷰어 사용 가능
- Blender 데이터: 영향 없음

---

## 파일 수정 요약

### CostEstimator_RevitAddin_2026/MainTools/QuantityTakeoff_web/RevitDataCollector.cs

- **Lines 28-36**: parameters 타입을 Dictionary<string, object>로 변경
- **Lines 38-52**: Geometry 추출 및 추가
- **Lines 59-67**: typeParameters 타입을 Dictionary<string, object>로 변경
- **Lines 76-106**: ExtractGeometry() 메서드
- **Lines 108-127**: ProcessGeometryObject() 메서드
- **Lines 129-161**: ProcessSolid() 메서드
- **Lines 163-184**: ProcessMesh() 메서드
- **Lines 186-245**: ExtractTransformMatrix() 메서드

### CostEstimator_RevitAddin_2026/MainTools/QuantityTakeoff_web/ConnectorWindow.xaml.cs

- **Lines 89-91**: 서버 프로세스 체크 제거
- **Lines 127-137**: 연결 실패 시 안내 메시지 추가
- **Lines 143-150**: 예외 발생 시 안내 메시지 추가

---

## 관련 문서

- Blender addon Geometry 추출: `CostEstimator_BlenderAddon_453/__init__.py` (Lines 155-189)
- 3D 뷰어 코드: `connections/static/connections/three_d_viewer.js`

---

## 결론

**Revit 애드인을 완전히 독립적으로 개발하여 Blender와 동일한 Geometry 전송 기능을 구현했습니다.**

✅ **웹브라우저 코드는 전혀 건드리지 않음**
✅ **Blender와 Revit 데이터가 동일한 구조**
✅ **서버 시작 없이도 연결 가능**
✅ **3D 뷰어에서 Revit 객체 표시 가능**

이제 Revit 애드인과 웹브라우저는 완전히 독립적으로 개발 가능하며, Geometry 데이터 구조만 일치하면 호환됩니다!
