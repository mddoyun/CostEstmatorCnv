# 2025-11-04: IFC Glass Style 추출 수정

## 문제 상황

사용자가 `SampleProject.ifc` 파일을 업로드하고 테스트했을 때, Glass 스타일이 제대로 로드되지 않는 문제 발생:

- **테스트 파일**: SampleProject.ifc (루트 폴더)
- **내용**: 벽 1개, 바닥 1개
- **적용된 스타일**: 반투명 Glass 스타일
- **Material 이름**: "Unknown"
- **연결된 Style 객체**: "Glass"
- **증상**: 투명도와 색상이 제대로 렌더링되지 않음

## 원인 분석

### IFC 파일 구조 분석

```
#463=IFCCOLOURRGB($,0.800000011920929,1.,1.);
#464=IFCSURFACESTYLESHADING(#463,0.799999997019768);
#465=IFCSURFACESTYLE('Glass',.BOTH.,(#464));
#260=IFCMATERIAL('Unknown',$,$);
```

- **Color**: RGB(0.8, 1.0, 1.0) - 청록색 (cyan)
- **Transparency**: 0.8 (80% 투명)
- **Style**: "Glass"
- **Material**: "Unknown"

### 코드 문제점

**Blender Addon** (`CostEstimator_BlenderAddon_453/__init__.py`, line 240):

```python
if style.is_a('IfcSurfaceStyleRendering'):
```

이 코드는 `IfcSurfaceStyleRendering`만 체크하지만, SampleProject.ifc는 **`IfcSurfaceStyleShading`**을 사용합니다.

**IFC 스펙 관계**:
- `IfcSurfaceStyleShading`: 기본 클래스 (색상, 투명도)
- `IfcSurfaceStyleRendering`: 하위 클래스 (Shading + Reflectance, Specular 등 추가 속성)

## 해결 방법

### 1. Blender Addon 수정

**파일**: `CostEstimator_BlenderAddon_453/__init__.py` (lines 240-270)

**변경 전**:
```python
if style.is_a('IfcSurfaceStyleRendering'):
```

**변경 후**:
```python
# IfcSurfaceStyleShading 또는 IfcSurfaceStyleRendering (Rendering은 Shading의 하위 클래스)
if style.is_a('IfcSurfaceStyleShading') or style.is_a('IfcSurfaceStyleRendering'):
```

### 2. Style Name 추출 추가

**추가된 코드** (line 268-270):
```python
# Style name 추출
if hasattr(surface_style, 'Name') and surface_style.Name:
    materials['style_name'] = surface_style.Name
```

이제 "Glass" 스타일 이름도 추출하여 저장합니다.

### 3. 주석 개선

```python
# Reflectance method (IfcSurfaceStyleRendering에만 있음)
if hasattr(style, 'ReflectanceMethod'):
    materials['reflectance_method'] = str(style.ReflectanceMethod)

# Specular color (IfcSurfaceStyleRendering에만 있음)
if hasattr(style, 'SpecularColour') and style.SpecularColour:
```

`ReflectanceMethod`와 `SpecularColour`는 `IfcSurfaceStyleRendering`에만 존재하는 속성임을 명시했습니다.

## 추출되는 데이터 구조

수정 후 Blender에서 추출되는 materials 객체:

```json
{
  "diffuse_color": [0.8, 1.0, 1.0],     // RGB 청록색
  "transparency": 0.8,                   // 80% 투명
  "style_name": "Glass",                 // 스타일 이름
  "name": "Unknown"                      // Material 이름
}
```

## Three.js 렌더링

**기존에 구현된 코드** (`three_d_viewer.js`, lines 11746-11790):

```javascript
// 투명도 추출 (IFC의 Transparency는 0=불투명, 1=완전투명)
if (materials.transparency !== undefined && materials.transparency !== null) {
    opacity = 1.0 - materials.transparency; // Three.js opacity는 0=투명, 1=불투명
    transparent = materials.transparency > 0;
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
```

**렌더링 결과**:
- **색상**: 청록색 RGB(0.8, 1.0, 1.0)
- **투명도**: opacity = 1.0 - 0.8 = 0.2 (20% 불투명, 80% 투명)
- **적용 모드**: "실제색상" 렌더링 모드

## 테스트 방법

1. Blender에서 SampleProject.ifc 파일 열기
2. CostEstimator addon으로 데이터 전송
3. 웹 3D 뷰어에서 "실제색상" 모드 확인
4. 벽과 바닥이 청록색 반투명으로 렌더링되는지 확인

## 파일 변경 사항

### 수정된 파일

1. **CostEstimator_BlenderAddon_453/__init__.py**
   - Line 241: `IfcSurfaceStyleShading` 체크 추가
   - Line 255, 259: 주석 추가 (Rendering에만 있는 속성 명시)
   - Line 268-270: Style name 추출 코드 추가

## 기술적 세부사항

### IFC Entity 계층 구조

```
IfcSurfaceStyle (스타일 컨테이너)
└── Styles (리스트)
    ├── IfcSurfaceStyleShading (기본 클래스)
    │   ├── SurfaceColour: IfcColourRgb
    │   └── Transparency: float (0-1)
    │
    └── IfcSurfaceStyleRendering (확장 클래스)
        ├── SurfaceColour: IfcColourRgb (상속)
        ├── Transparency: float (상속)
        ├── ReflectanceMethod: string (추가)
        └── SpecularColour: IfcColourRgb (추가)
```

### IFC vs Three.js 투명도 변환

| 시스템 | 0 값 의미 | 1 값 의미 | 비고 |
|--------|-----------|-----------|------|
| IFC | 불투명 (Opaque) | 완전 투명 (Fully Transparent) | Transparency |
| Three.js | 완전 투명 | 불투명 | Opacity |

**변환 공식**: `Three.js opacity = 1.0 - IFC transparency`

### ifcopenshell shape.styles 구조

```python
shape.styles = [
    (style_id, surface_style),  # 튜플 리스트
    ...
]

surface_style.Name = "Glass"
surface_style.Styles = [
    IfcSurfaceStyleShading(...),
    ...
]
```

## 예상 결과

SampleProject.ifc의 벽과 바닥이:
- ✅ 청록색 (RGB 0.8, 1.0, 1.0)으로 렌더링
- ✅ 80% 투명도로 렌더링
- ✅ "Glass" 스타일 이름이 materials 객체에 저장
- ✅ "Unknown" Material 이름도 함께 저장

## 관련 문서

- [67_2025-11-04_3D뷰어_IFC_Material_투명도_단면_치수측정_기능_추가.md](./67_2025-11-04_3D뷰어_IFC_Material_투명도_단면_치수측정_기능_추가.md)
- IFC 4.3 Specification: IfcSurfaceStyleShading
- IFC 4.3 Specification: IfcSurfaceStyleRendering
