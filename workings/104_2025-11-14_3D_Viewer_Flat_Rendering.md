# 104. 3D 뷰어 스케치업 스타일 평면 렌더링 구현 (2025-11-14)

## 문제점

3D 뷰어에서 메쉬 렌더링 시 다음과 같은 시각적 문제가 발생:

1. **일관되지 않은 음영(Shading)**
   - 메쉬 표면에 불규칙한 음영이 표시됨
   - 같은 객체 내에서도 밝기가 일정하지 않음

2. **그라데이션 효과**
   - 조명 방향에 따라 밝고 어두운 영역이 발생
   - 메쉬 표면에 그라데이션이 져서 깔끔하지 않은 외관

3. **투톤(Two-Tone) 효과**
   - 단일 방향 조명으로 인해 한쪽은 밝고 다른 쪽은 어두운 현상
   - 객체의 실제 색상을 정확히 파악하기 어려움

**사용자 요구사항**: 스케치업(SketchUp)처럼 음영이 없는 깔끔하고 평면적인 렌더링 스타일

## 시도한 해결 방법

### 1차 시도: 조명 밸런스 조정
```javascript
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);  // 0.6 → 0.7
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);  // 0.8 → 0.6
```

**재질 설정**:
```javascript
roughness: 0.8  // 1.0 → 0.8
```

**결과**: 음영이 약간 감소했으나 여전히 그라데이션 효과 존재

---

### 2차 시도: Flat Shading 활성화
```javascript
const material = new THREE.MeshStandardMaterial({
    flatShading: true,  // false → true
    // ...
});

let edgesVisible = true;  // false → true (기본값 변경)
```

**결과**: 그라데이션이 약간 줄었으나 투톤 효과는 여전히 남아있음

---

### 3차 시도: 최대 Ambient Light + 양방향 조명
```javascript
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);  // 최대 밝기
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2);  // 최소화

// 반대 방향 조명 추가
const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.2);
directionalLight2.position.set(-10, 20, -10);
scene.add(directionalLight2);
```

**결과**: 투톤 효과가 크게 감소했으나 미세한 음영은 여전히 존재

---

### 4차 시도 (최종 해결): MeshBasicMaterial 전환

**핵심 원인 분석**:
- `MeshStandardMaterial`과 `MeshPhongMaterial`은 물리 기반 렌더링(PBR) 재질로, 본질적으로 조명에 반응
- 조명 설정을 아무리 조정해도 완전히 평면적인 렌더링은 불가능
- `MeshBasicMaterial`은 조명을 완전히 무시하는 재질 → 스케치업 스타일 구현 가능

## 최종 해결 방법

### 1. 조명 설정 최적화 (3개 뷰어 모두 적용)

```javascript
// ==========================================
// 메인 뷰어 (lines 207-232)
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.2);
directionalLight2.position.set(-10, 20, -10);
scene.add(directionalLight2);

// ==========================================
// 데이터 관리 뷰어 (lines 9702-9724)
// ==========================================
// 동일한 조명 설정 적용

// ==========================================
// 시뮬레이션 뷰어 (lines 9829-9851)
// ==========================================
// 동일한 조명 설정 적용
```

### 2. MeshBasicMaterial 전환

#### 2.1 초기 지오메트리 재질 (Line 1738)
```javascript
// ❌ 이전 코드
const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    flatShading: true,
    side: THREE.DoubleSide,
    metalness: 0.0,
    roughness: 0.8
});

// ✅ 수정 코드
const material = new THREE.MeshBasicMaterial({
    color: 0xcccccc,
    side: THREE.DoubleSide
});
```

#### 2.2 Realistic 모드 - IFC 재질 색상 (Line 12542)
```javascript
function applyRealisticMaterial(mesh, isSelected) {
    // ... 색상 추출 로직 ...

    // ❌ 이전 코드
    mesh.material = new THREE.MeshStandardMaterial({
        color: color,
        flatShading: true,
        side: THREE.DoubleSide,
        metalness: 0.0,
        roughness: 0.8,
        transparent: transparent,
        opacity: opacity,
        depthWrite: !transparent
    });

    // ✅ 수정 코드
    mesh.material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: transparent,
        opacity: opacity,
        depthWrite: !transparent
    });
    mesh.material.needsUpdate = true;
}
```

#### 2.3 White 모드 (Line 12400)
```javascript
case 'white':
    // ❌ 이전 코드
    mesh.material = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xffff00 : 0xffffff,
        flatShading: true,
        side: THREE.DoubleSide,
        metalness: 0.0,
        roughness: 0.8
    });

    // ✅ 수정 코드
    mesh.material = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xffff00 : 0xffffff,
        side: THREE.DoubleSide
    });
    mesh.material.needsUpdate = true;
    break;
```

#### 2.4 Edges 모드 (Line 12425)
```javascript
case 'edges':
    // ❌ 이전 코드
    mesh.material = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xffff00 : 0xffffff,
        flatShading: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
    });

    // ✅ 수정 코드
    mesh.material = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xffff00 : 0xffffff,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
    });
    mesh.material.needsUpdate = true;
    break;
```

#### 2.5 Sunlight 모드 (Line 12439)
```javascript
case 'sunlight':
    // ❌ 이전 코드
    mesh.material = new THREE.MeshPhongMaterial({
        color: isSelected ? 0xffff00 : 0xffffff,
        flatShading: false,
        side: THREE.DoubleSide,
        shininess: 10,
        specular: 0x222222
    });

    // ✅ 수정 코드
    mesh.material = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xffff00 : 0xffffff,
        side: THREE.DoubleSide
    });
    mesh.material.needsUpdate = true;
    break;
```

#### 2.6 Material 모드 - 재질 이름 기반 색상 (Line 12585)
```javascript
function applyMaterialBasedColor(mesh, isSelected) {
    let color = 0x808080;

    // ... 재질 이름 기반 색상 매핑 로직 ...

    if (isSelected) {
        color = 0xffff00;
    }

    // ❌ 이전 코드
    mesh.material = new THREE.MeshStandardMaterial({
        color: color,
        flatShading: false,
        side: THREE.DoubleSide,
        metalness: 0.3,
        roughness: 0.7
    });

    // ✅ 수정 코드
    mesh.material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide
    });
    mesh.material.needsUpdate = true;
}
```

### 3. 기본 설정 변경 (Line 131)
```javascript
// ❌ 이전 코드
let edgesVisible = false;

// ✅ 수정 코드
let edgesVisible = true;  // 테두리 라인 기본 표시
```

## 수정된 파일

### connections/static/connections/three_d_viewer.js

1. **조명 설정** (3개 뷰어):
   - Lines 207-232: 메인 뷰어 조명
   - Lines 9702-9724: 데이터 관리 뷰어 조명
   - Lines 9829-9851: 시뮬레이션 뷰어 조명

2. **재질 시스템**:
   - Line 131: `edgesVisible` 기본값 변경
   - Line 1738: 초기 지오메트리 재질
   - Line 12400: White 모드
   - Line 12425: Edges 모드
   - Line 12439: Sunlight 모드
   - Line 12542: Realistic 모드 (`applyRealisticMaterial`)
   - Line 12585: Material 모드 (`applyMaterialBasedColor`)

## 기술적 배경

### Three.js 재질 타입 비교

| 재질 타입 | 조명 반응 | 사용 사례 |
|-----------|----------|----------|
| `MeshBasicMaterial` | **없음** | 평면 렌더링, UI 요소 |
| `MeshStandardMaterial` | PBR (물리 기반) | 사실적 렌더링 |
| `MeshPhongMaterial` | Phong 셰이딩 | 광택 표면 |

### 조명 타입

- **AmbientLight**: 전방향성 전역 조명 (그림자 없음)
- **DirectionalLight**: 평행 광선 (태양광 시뮬레이션)

## 결과

### 달성된 효과

1. **완전 평면 렌더링**:
   - 조명에 의한 음영 효과 완전 제거
   - 스케치업(SketchUp) 스타일의 깔끔한 시각화 구현

2. **일관된 색상 표현**:
   - 객체의 실제 색상이 조명 방향에 관계없이 동일하게 표시
   - 투톤 효과 완전 제거

3. **향상된 시각적 명확성**:
   - BIM 객체의 형태와 경계가 명확히 구분됨
   - 테두리 라인 기본 표시로 객체 구분 용이

### 적용 범위

- 메인 3D 뷰어
- 데이터 관리 탭 3D 뷰어
- 시뮬레이션 탭 3D 뷰어

모든 렌더링 모드 (Realistic, White, Edges, Sunlight, Material)에 적용됨

## 참고사항

### 유지되는 MeshStandardMaterial 사용 케이스

다음 경우는 의도적으로 `MeshStandardMaterial`을 유지 (임시 시각적 피드백 용도):

- Hover 하이라이트 (Line 2237, 10672)
- 프리뷰 재질 (Line 2591, 11115)
- 선택 하이라이트 (Lines 3004, 3185, 3294, 3367)
- 시뮬레이션 진행 상태 표시 (Line 8269)
- Split 객체 부모 표시 (Lines 5392, 7524)

이들은 주 렌더링이 아닌 일시적인 시각적 효과이므로 문제되지 않음.

## 커밋 정보

- **Commit Hash**: 8aa30ad
- **Commit Message**: "3D 뷰어 스케치업 스타일 평면 렌더링 구현"
- **Date**: 2025-11-14
