# 2025-11-04: Glass Style 데이터 전송 디버깅

## 문제 상황

Blender 애드온에서 IFC Glass 스타일 정보를 정상적으로 추출하고 있으나, 웹 3D 뷰어에서 `System.Geometry`가 `undefined`로 나타나는 문제.

**Blender 콘솔 로그 (정상 추출 확인)**:
```
[DEBUG] Extracted style color from Material->StyledRepresentation: RGB([0.800000011920929, 1.0, 1.0])
[DEBUG] Extracted transparency from Material->StyledRepresentation: 0.799999997019768
```

**브라우저 콘솔 테스트 결과**:
```javascript
console.log('System.Geometry:', allRevitData[0]?.System?.Geometry);
// Output: undefined
```

## 원인 분석

데이터가 Blender에서는 정상 추출되지만 웹 뷰어까지 전달되지 않는 문제. 가능한 원인:

1. JSON 직렬화 문제
2. WebSocket 전송 과정에서 손실
3. Django 백엔드 처리 중 손실
4. 프론트엔드 역직렬화 문제

## 디버깅 코드 추가

### 1. Blender 애드온 (CostEstimator_BlenderAddon_453/__init__.py)

**Line 461-465**: JSON 직렬화 직전 materials 데이터 확인
```python
# ▼▼▼ [DEBUG] System.Geometry.materials 확인 ▼▼▼
if element_dict.get("System", {}).get("Geometry", {}).get("materials"):
    mat = element_dict["System"]["Geometry"]["materials"]
    print(f"[DEBUG] Element {element.id()} serializing with materials: color={mat.get('diffuse_color')}, transparency={mat.get('transparency')}, style={mat.get('style_name')}, name={mat.get('name')}")
# ▲▲▲ [DEBUG] 끝 ▲▲▲
```

**기대 출력**:
```
[DEBUG] Element 1220 serializing with materials: color=[0.800000011920929, 1.0, 1.0], transparency=0.799999997019768, style=Glass, name=Unknown
```

### 2. Django Consumer - 수신 단계 (connections/consumers.py)

**Line 337-343**: WebSocket으로부터 데이터 수신 직후 확인
```python
# ▼▼▼ [DEBUG] System.Geometry.materials 확인 ▼▼▼
for elem in elements_data:
    if elem.get("System", {}).get("Geometry", {}).get("materials"):
        mat = elem["System"]["Geometry"]["materials"]
        print(f"[DEBUG] Received element {elem.get('UniqueId')} with materials: color={mat.get('diffuse_color')}, transparency={mat.get('transparency')}, style={mat.get('style_name')}, name={mat.get('name')}")
        break  # 하나만 출력
# ▲▲▲ [DEBUG] 끝 ▲▲▲
```

**기대 출력**:
```
[DEBUG] Received element 2O2Fr$t4X7Zf8NOew3FLOH with materials: color=[0.800000011920929, 1.0, 1.0], transparency=0.799999997019768, style=Glass, name=Unknown
```

### 3. Django Consumer - DB 저장 후 (connections/consumers.py)

**Line 461-466**: 데이터베이스 저장 후 데이터 무결성 확인
```python
# ▼▼▼ [DEBUG] 생성된 객체의 materials 확인 ▼▼▼
for elem in created_objs[:1]:  # 첫 번째 객체만 확인
    if elem.raw_data.get("System", {}).get("Geometry", {}).get("materials"):
        mat = elem.raw_data["System"]["Geometry"]["materials"]
        print(f"[DEBUG] DB saved element {elem.element_unique_id} with materials: color={mat.get('diffuse_color')}, transparency={mat.get('transparency')}, style={mat.get('style_name')}, name={mat.get('name')}")
# ▲▲▲ [DEBUG] 끝 ▲▲▲
```

**기대 출력**:
```
[DEBUG] DB saved element 2O2Fr$t4X7Zf8NOew3FLOH with materials: color=[0.800000011920929, 1.0, 1.0], transparency=0.799999997019768, style=Glass, name=Unknown
```

## 테스트 절차

### 1. Blender에서 재전송 테스트

1. **Blender 재시작**: 애드온 코드 변경사항 반영
2. **SampleProject.ifc 열기**: 루트 폴더의 테스트 파일
3. **프로젝트 재전송**: Cost Estimator 패널에서 "데이터 전송" 버튼 클릭
4. **Blender 콘솔 확인**: 세 가지 디버그 메시지 출력 여부 확인
   - `[DEBUG] Extracted style color from Material->StyledRepresentation`
   - `[DEBUG] Extracted transparency from Material->StyledRepresentation`
   - `[DEBUG] Element 1220 serializing with materials`

### 2. Django 서버 로그 확인

Django 개발 서버 콘솔에서 다음 메시지 확인:

1. `[DEBUG] Received element ... with materials` - WebSocket 수신 확인
2. `[DEBUG] DB saved element ... with materials` - DB 저장 확인

### 3. 웹 브라우저 테스트

1. **프로젝트 로드**: 웹 인터페이스에서 프로젝트 선택
2. **3D 뷰어 열기**: 3D 뷰어 탭 이동
3. **브라우저 콘솔 테스트**:
```javascript
// 데이터 구조 확인
console.log('First object:', allRevitData[0]);

// System.Geometry 확인
console.log('System.Geometry:', allRevitData[0]?.System?.Geometry);

// materials 확인
console.log('Materials:', allRevitData[0]?.System?.Geometry?.materials);

// 벽 객체 찾기 (IfcClass === "IfcWall")
const wall = allRevitData.find(obj => obj.IfcClass === "IfcWall");
console.log('Wall materials:', wall?.System?.Geometry?.materials);
```

## 예상 데이터 구조

**최종적으로 allRevitData[0]에 저장되어야 할 구조**:
```json
{
  "UniqueId": "2O2Fr$t4X7Zf8NOew3FLOH",
  "Name": "Generic - 200mm",
  "IfcClass": "IfcWall",
  "System": {
    "Geometry": {
      "verts": [...],
      "faces": [...],
      "matrix": [...],
      "materials": {
        "diffuse_color": [0.800000011920929, 1.0, 1.0],
        "transparency": 0.799999997019768,
        "style_name": "Glass",
        "name": "Unknown"
      }
    }
  },
  "Parameters": {
    "Geometry": {
      // System.Geometry와 동일 (3D 뷰어 호환성)
    }
  }
}
```

## 진단 시나리오

### 시나리오 A: 모든 디버그 메시지가 정상 출력
- **의미**: 데이터가 전체 파이프라인을 통과함
- **원인**: 프론트엔드 렌더링 로직 문제 또는 이전 데이터 캐싱
- **해결**: 브라우저 캐시 삭제 후 재테스트

### 시나리오 B: Blender만 출력, Django 출력 없음
- **의미**: WebSocket 전송 과정에서 데이터 손실
- **원인**: JSON 직렬화 문제 또는 WebSocket 메시지 크기 제한
- **해결**: Blender 애드온의 WebSocket 전송 코드 확인

### 시나리오 C: Django 수신까지는 되지만 DB 저장 후 없음
- **의미**: DB 저장 과정에서 데이터 손실
- **원인**: `flatten_bim_data()` 또는 `processed_item` 처리 문제
- **해결**: `sync_chunk_of_elements()` 로직 재검토

### 시나리오 D: DB까지는 정상이지만 브라우저에서 undefined
- **의미**: DB → 프론트엔드 전송 과정 문제
- **원인**: `get_serialized_element_chunk()` 또는 WebSocket 브로드캐스트 문제
- **해결**: 프론트엔드 WebSocket 수신 로직 확인

## 데이터 흐름 요약

```
[Blender Addon]
   ↓ ifcopenshell 추출
   ↓ element_dict["System"]["Geometry"]["materials"] 구성
   ↓ json.dumps() 직렬화
   ↓ WebSocket send (fetch_progress_update)
   ↓
[Django Consumer - BlenderConsumer.receive()]
   ↓ json.loads() 역직렬화
   ↓ elements_data 리스트 구성
   ↓ sync_chunk_of_elements() 호출
   ↓
[Django Consumer - sync_chunk_of_elements()]
   ↓ flatten_bim_data() (System은 평탄화 제외)
   ↓ processed_item 구성
   ↓ RawElement.objects.bulk_create()
   ↓
[Django Database - RawElement]
   ↓ raw_data (JSONField) 저장
   ↓
[Django Consumer - FrontendConsumer.receive()]
   ↓ get_serialized_element_chunk() 호출
   ↓ RawElement.objects.filter().values('raw_data')
   ↓ WebSocket send (revit_data_chunk)
   ↓
[Frontend - websocket.js]
   ↓ JSON.parse() 역직렬화
   ↓ allRevitData.push()
   ↓
[Frontend - three_d_viewer.js]
   ↓ rawData.System.Geometry.materials 접근
   ↓ Three.js MeshStandardMaterial 생성
```

## 관련 파일

### 수정된 파일
1. **CostEstimator_BlenderAddon_453/__init__.py**
   - Line 296-343: Material→StyledRepresentation 경로 추출
   - Line 461-465: 직렬화 전 디버그 로그

2. **connections/consumers.py**
   - Line 337-343: WebSocket 수신 후 디버그 로그
   - Line 461-466: DB 저장 후 디버그 로그

### 관련 파일 (수정 없음)
- **connections/consumers.py** (flatten_bim_data, get_serialized_element_chunk)
- **connections/static/connections/websocket.js** (revit_data_chunk 수신)
- **connections/static/connections/three_d_viewer.js** (materials 렌더링)

## 다음 단계

1. ✅ 디버그 코드 추가 완료
2. ⏳ 사용자 테스트 대기
3. ⏳ 디버그 로그 분석
4. ⏳ 문제 지점 특정
5. ⏳ 수정 및 재테스트

## 참고 문서

- [67_2025-11-04_3D뷰어_IFC_Material_투명도_단면_치수측정_기능_추가.md](./67_2025-11-04_3D뷰어_IFC_Material_투명도_단면_치수측정_기능_추가.md)
- [68_2025-11-04_IFC_Glass_Style_추출_수정.md](./68_2025-11-04_IFC_Glass_Style_추출_수정.md)
