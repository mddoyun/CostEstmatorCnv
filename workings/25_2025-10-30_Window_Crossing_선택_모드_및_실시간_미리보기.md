# Window/Crossing 선택 모드 및 실시간 미리보기

**날짜**: 2025-10-30
**작업자**: Claude Code

## 개요

AutoCAD 스타일의 양방향 박스 선택 기능을 구현했습니다. 드래그 방향에 따라 선택 모드가 달라지며, 실시간으로 선택될 객체를 미리보기로 표시합니다.

## 구현된 기능

### 1. Window Mode (윈도우 모드) - 왼쪽 → 오른쪽

객체가 **완전히** 박스 안에 들어와야 선택됩니다.

**시각적 특징:**
- **실선** 파란색 테두리
- 배경: 연한 파란색 (rgba(33, 150, 243, 0.1))

**선택 조건:**
- 바운딩 박스의 **8개 꼭짓점 모두**가 선택 영역 안에 있어야 함
- 매우 정밀한 선택이 필요할 때 사용

**사용 사례:**
```
┌─────────────┐
│   ┌───┐     │  ✅ 완전히 포함 → 선택됨
│   └───┘     │
└─────────────┘

┌─────────────┐
│   ┌───      │  ❌ 일부만 포함 → 선택 안 됨
│   └───      │
└─────────────┘
```

### 2. Crossing Mode (크로싱 모드) - 오른쪽 → 왼쪽

객체가 **걸치기만** 해도 선택됩니다.

**시각적 특징:**
- **점선** 녹색 테두리
- 배경: 연한 녹색 (rgba(76, 175, 80, 0.1))

**선택 조건:**
- 바운딩 박스의 **하나의 꼭짓점이라도** 선택 영역 안에 있으면 선택
- 빠른 그룹 선택에 유용

**사용 사례:**
```
  ┌─────────────┐
  │   ┌───┐     │  ✅ 완전히 포함 → 선택됨
  │   └───┘     │
  └─────────────┘

  ┌─────────────┐
  │   ┌───      │  ✅ 일부만 포함 → 선택됨
  │   └───      │
  └─────────────┘

      ┌─────────┐
  ┌───┤         │  ✅ 걸침 → 선택됨
  └───┤         │
      └─────────┘
```

### 3. 실시간 미리보기 (Real-time Preview)

드래그하는 동안 선택될 객체를 **라이트 시안 색상**으로 미리 표시합니다.

**동작 방식:**
- 박스를 드래그하는 즉시 미리보기 시작
- 마우스 움직임에 따라 실시간 업데이트
- 선택 모드(Window/Crossing)에 따라 다르게 표시
- 드래그 종료 시 미리보기 자동 제거

**시각적 속성:**
```javascript
const previewMaterial = new THREE.MeshStandardMaterial({
    color: 0x4dd0e1,           // Light cyan
    emissive: 0x00bcd4,        // Cyan glow
    emissiveIntensity: 0.3,
    metalness: 0.0,
    roughness: 1.0,
    flatShading: true,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
});
```

## 색상 및 스타일 체계

| 모드/상태 | 박스 스타일 | 객체 색상 | 용도 |
|-----------|-------------|-----------|------|
| Window 모드 | 실선 파란색 | - | 정밀 선택 |
| Crossing 모드 | 점선 녹색 | - | 빠른 선택 |
| 미리보기 | - | 라이트 시안 | 선택 예정 |
| 선택됨 | - | 주황색 | 확정 선택 |
| 호버 | - | 라이트 시안 | 선택 대기 |

## 기술적 구현

### 드래그 방향 감지

```javascript
const isWindowMode = dragCurrent.x >= dragStart.x;

if (isWindowMode) {
    // 왼쪽 → 오른쪽: Window mode
    selectionBox.style.border = '2px solid #2196F3';
} else {
    // 오른쪽 → 왼쪽: Crossing mode
    selectionBox.style.border = '2px dashed #4CAF50';
}
```

### 선택 로직

```javascript
// 8개 꼭짓점 모두 검사
let cornersInBox = 0;
for (let corner of corners) {
    const worldCorner = corner.clone().applyMatrix4(mesh.matrixWorld);
    const screenPos = worldCorner.clone().project(camera);

    const x = (screenPos.x * 0.5 + 0.5) * rect.width;
    const y = ((-screenPos.y) * 0.5 + 0.5) * rect.height;

    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        cornersInBox++;
    }
}

// 모드에 따른 선택 결정
if (isWindowMode) {
    shouldSelect = (cornersInBox === 8);  // 모든 꼭짓점
} else {
    shouldSelect = (cornersInBox > 0);    // 하나라도
}
```

### 실시간 미리보기

```javascript
function updateBoxSelectionPreview(isWindowMode) {
    // 1. 이전 미리보기 제거
    previewHighlightedObjects.forEach(obj => {
        obj.material = originalMaterials.get(obj);
    });
    previewHighlightedObjects = [];

    // 2. 현재 박스 안의 객체 찾기
    bimMeshes.forEach(mesh => {
        // 선택 조건 검사
        if (shouldHighlight) {
            // 3. 미리보기 하이라이트 적용
            mesh.material = previewMaterial;
            previewHighlightedObjects.push(mesh);
        }
    });
}
```

**호출 시점:**
- `onPointerMove()` → `updateSelectionBoxUI()` → `updateBoxSelectionPreview()`
- 마우스 움직일 때마다 실시간 업데이트

### 정리 (Cleanup)

```javascript
function onPointerUp(event) {
    // 선택 수행
    performBoxSelection(event.ctrlKey || event.metaKey);

    // 미리보기 하이라이트 정리
    previewHighlightedObjects.forEach(obj => {
        if (!selectedObjects.includes(obj)) {
            obj.material = originalMaterials.get(obj);
        }
    });
    previewHighlightedObjects = [];
}
```

## 변경된 파일

### `connections/static/connections/three_d_viewer.js`

**추가된 변수:**
```javascript
let previewHighlightedObjects = [];  // 미리보기 중인 객체들
```

**추가된 함수:**
```javascript
updateBoxSelectionPreview(isWindowMode)  // 실시간 미리보기 업데이트
```

**수정된 함수:**
```javascript
updateSelectionBoxUI()      // 박스 스타일 동적 변경 + 미리보기 호출
performBoxSelection()       // Window/Crossing 모드 구현
onPointerUp()              // 미리보기 정리
```

## 사용 시나리오

### 시나리오 1: 정밀 선택 (Window Mode)

```
상황: 밀집된 객체 중 특정 객체만 선택
방법: 왼쪽 → 오른쪽 드래그
결과: 완전히 포함된 객체만 선택됨
```

**예시:**
```
여러 기둥이 밀집되어 있을 때
→ 특정 기둥만 정확히 선택 가능
→ 실선 파란 박스로 정확히 감싸기
```

### 시나리오 2: 빠른 그룹 선택 (Crossing Mode)

```
상황: 여러 객체를 빠르게 선택
방법: 오른쪽 → 왼쪽 드래그
결과: 걸치기만 해도 모두 선택됨
```

**예시:**
```
벽체 여러 개를 한 번에 선택
→ 대략적으로 드래그
→ 점선 녹색 박스가 걸친 모든 벽 선택
```

### 시나리오 3: 실시간 확인

```
상황: 선택 전에 어떤 객체가 선택될지 확인
방법: 드래그하면서 미리보기 관찰
결과: 청록색으로 표시되는 객체 확인 후 결정
```

**예시:**
```
복잡한 구조물에서
→ 드래그하면서 청록색 하이라이트 확인
→ 원하는 객체만 표시되면 마우스 놓기
→ 원하지 않는 객체가 포함되면 드래그 취소
```

## 사용자 경험 개선

### Before (개선 전)

❌ 선택 방향에 관계없이 동일한 동작
❌ 선택될 객체를 미리 알 수 없음
❌ 정밀 선택이 어려움
❌ 박스 스타일이 항상 동일

### After (개선 후)

✅ 드래그 방향으로 모드 자동 전환
✅ 실시간으로 선택될 객체 표시
✅ Window 모드로 정밀 선택 가능
✅ 박스 스타일로 모드 구분 명확

## 성능 최적화

### 미리보기 업데이트
- `pointermove` 이벤트마다 실행
- 하지만 드래그 중에만 활성화
- 이전 하이라이트를 먼저 제거하여 메모리 효율적

### 꼭짓점 검사
- 각 객체당 최대 8번 검사
- Window 모드에서는 조기 종료 없음 (모든 꼭짓점 확인 필요)
- Crossing 모드에서는 첫 번째 꼭짓점 발견 시 조기 종료 가능

### 메모리 관리
```javascript
// ✅ 배열 재사용
previewHighlightedObjects.forEach(obj => {
    // 정리
});
previewHighlightedObjects = [];  // 비우기

// ✅ Map으로 원본 재질 캐싱
originalMaterials.set(obj, obj.material);
```

## AutoCAD와의 비교

| 기능 | AutoCAD | 본 구현 | 상태 |
|------|---------|---------|------|
| Window 선택 | L→R 실선 | L→R 실선 파란색 | ✅ |
| Crossing 선택 | R→L 점선 | R→L 점선 녹색 | ✅ |
| 실시간 미리보기 | 있음 | 청록색 하이라이트 | ✅ |
| Ctrl 누적 선택 | Shift | Ctrl/Cmd | ✅ |
| 폴리곤 선택 | 있음 | 없음 | ⏳ 향후 |

## 테스트 시나리오

### 테스트 1: Window Mode
1. ✅ 왼쪽에서 오른쪽으로 드래그
2. ✅ 박스가 실선 파란색으로 표시
3. ✅ 완전히 포함된 객체만 청록색
4. ✅ 마우스 놓으면 주황색으로 선택

### 테스트 2: Crossing Mode
1. ✅ 오른쪽에서 왼쪽으로 드래그
2. ✅ 박스가 점선 녹색으로 표시
3. ✅ 걸친 모든 객체가 청록색
4. ✅ 마우스 놓으면 주황색으로 선택

### 테스트 3: 실시간 미리보기
1. ✅ 드래그 중 객체가 청록색으로 변함
2. ✅ 박스 크기 변경 시 하이라이트 업데이트
3. ✅ 모드 전환 시 하이라이트 재계산
4. ✅ 드래그 종료 시 미리보기 제거

### 테스트 4: 복합 시나리오
1. ✅ Window로 일부 선택 → Ctrl+Crossing으로 추가
2. ✅ 이미 선택된 객체는 미리보기 안 됨
3. ✅ 숨겨진 객체는 선택 안 됨
4. ✅ 카메라 뒤 객체 제외

## 알려진 제한사항

1. **성능**: 복잡한 씬에서 미리보기가 느릴 수 있음
   - 현재 최적화: 드래그 중에만 활성화
   - 향후 개선: 쓰로틀링 적용 검토

2. **바운딩 박스**: 회전된 객체는 실제보다 큰 박스 사용
   - Window 모드에서 더 까다로운 선택 조건
   - 대부분의 경우 문제없이 작동

3. **시각적 밀도**: 많은 객체가 미리보기되면 화면이 복잡해질 수 있음
   - 청록색의 투명도로 완화
   - 추가 UI 개선 검토 필요

## 향후 개선 방향

1. **성능 최적화**
   - Throttle 적용 (16ms = 60fps)
   - 공간 파티셔닝으로 검사 대상 축소
   - Web Worker로 꼭짓점 계산 오프로드

2. **추가 기능**
   - 폴리곤 선택 (라쏘 도구)
   - 박스 선택 크기/위치 표시 (툴팁)
   - 선택 개수 실시간 표시

3. **사용성**
   - 키보드 단축키로 모드 강제 전환
   - 설정에서 색상/스타일 커스터마이징
   - 선택 히스토리 (되돌리기)

## 커밋

- Commit: 80c1d64
- 파일: 1개 변경 (163 insertions, 7 deletions)
- Push: origin/main

## 참고

- AutoCAD의 Window/Crossing 선택은 CAD 소프트웨어의 표준
- 실시간 미리보기는 Blender, 3ds Max 등에서도 사용
- Three.js의 `project()` 메서드로 3D → 2D 변환
- 바운딩 박스 8개 꼭짓점 검사가 핵심 알고리즘
