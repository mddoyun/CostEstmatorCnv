# 3D 분할 객체 DB 영속화 및 로드 기능 구현

**작업 일자**: 2025-01-28
**작업자**: Claude Code
**버전**: three_d_viewer.js v26 → v31

## 개요

3D 뷰어에서 분할한 객체를 데이터베이스에 저장하고, 이후 Load Geometry 시 자동으로 복원하여 표시하는 완전한 영속화 시스템을 구현했습니다.

## 주요 기능

### 1. 분할 객체 DB 저장
- Plane Split과 Sketch Split로 생성된 객체를 DB에 저장
- World space 좌표로 geometry 저장하여 위치 정확도 보장
- Volume 정보, split 메타데이터 모두 저장
- BIM 원본 객체 변경 시 자동 무효화 (Django Signal)

### 2. 분할 객체 자동 로드
- Load Geometry 시 서버에서 최신 데이터 요청
- 활성화된 분할 객체를 DB에서 조회
- 분할된 BIM 원본 객체는 자동으로 숨김
- 분할 객체와 미분할 BIM 객체를 함께 표시

### 3. 분할 객체 선택 및 정보 표시
- DB에서 로드한 분할 객체도 클릭하여 선택 가능
- Properties 패널에 BIM 원본 정보 표시
- Volume 정보 및 split 메타데이터 표시
- Quantity Members 연동

## 구현 상세

### Backend (Django)

#### 1. 모델 추가 (`connections/models.py`)

```python
class SplitElement(models.Model):
    """3D 뷰어에서 분할된 객체를 저장하고 관리"""

    # Primary key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Foreign keys
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    raw_element = models.ForeignKey(RawElement, on_delete=models.CASCADE)
    parent_split = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True)

    # Volume information
    original_geometry_volume = models.DecimalField(max_digits=20, decimal_places=6)
    geometry_volume = models.DecimalField(max_digits=20, decimal_places=6)
    volume_ratio = models.DecimalField(max_digits=10, decimal_places=6)

    # Split information
    split_method = models.CharField(max_length=20)  # 'plane' or 'sketch'
    split_axis = models.CharField(max_length=1, null=True)  # 'x', 'y', 'z'
    split_position = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    split_part_type = models.CharField(max_length=20)  # 'bottom', 'top', etc.

    # Geometry data for reconstruction
    geometry_data = models.JSONField(default=dict)
    sketch_data = models.JSONField(default=dict, null=True)

    # Status
    is_active = models.BooleanField(default=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

**주요 메서드**:
- `invalidate_on_bim_change()`: BIM 원본 변경 시 무효화 (자식 분할 객체 재귀적으로 무효화)
- `get_split_hierarchy()`: 분할 계층 구조 조회
- `calculate_effective_volume_ratio()`: 실제 체적 비율 계산

**Django Signal**:
```python
@receiver(pre_save, sender=RawElement)
def invalidate_splits_on_bim_change(sender, instance, **kwargs):
    """RawElement의 geometry_volume이 변경되면 관련된 모든 분할 객체를 무효화"""
    if instance.pk:
        try:
            old_instance = RawElement.objects.get(pk=instance.pk)
            if old_instance.geometry_volume != instance.geometry_volume:
                for split_element in instance.split_elements.filter(is_active=True):
                    split_element.invalidate_on_bim_change()
        except RawElement.DoesNotExist:
            pass
```

#### 2. Migration (`0003_alter_rawelement_geometry_volume_splitelement.py`)
- RawElement.geometry_volume 인덱싱 추가
- SplitElement 테이블 생성

#### 3. Admin 인터페이스 (`connections/admin.py`)

```python
@admin.register(SplitElement)
class SplitElementAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'raw_element_info', 'split_method', 'split_part_type',
        'geometry_volume', 'volume_ratio_percent', 'is_active', 'created_at'
    )

    actions = ['invalidate_selected_splits']
```

**커스텀 표시**:
- `volume_ratio_percent`: 체적 비율을 퍼센트로 표시
- `split_hierarchy_display`: 분할 계층 구조 표시
- `effective_volume_ratio_display`: 실제 체적 비율 표시

**커스텀 액션**:
- `invalidate_selected_splits`: 선택된 분할 객체 무효화

#### 4. WebSocket Consumer (`connections/consumers.py`)

**분할 객체 저장**:
```python
@database_sync_to_async
def db_save_split_element(self, payload):
    """3D 뷰어에서 생성된 분할 객체를 DB에 저장"""
    project = Project.objects.get(id=payload['project_id'])
    raw_element = RawElement.objects.get(id=payload['raw_element_id'])
    parent_split = None
    if payload.get('parent_split_id'):
        parent_split = SplitElement.objects.get(id=payload['parent_split_id'])

    split_element = SplitElement.objects.create(
        project=project,
        raw_element=raw_element,
        parent_split=parent_split,
        original_geometry_volume=payload['original_geometry_volume'],
        geometry_volume=payload['geometry_volume'],
        volume_ratio=payload['volume_ratio'],
        split_method=payload['split_method'],
        split_axis=payload.get('split_axis'),
        split_position=payload.get('split_position'),
        split_part_type=payload['split_part_type'],
        geometry_data=payload.get('geometry_data', {}),
        sketch_data=payload.get('sketch_data', {}),
        is_active=True
    )
    return split_element.id
```

**분할 객체 조회**:
```python
@database_sync_to_async
def get_split_elements_for_project(project_id):
    """프로젝트의 모든 활성 분할 객체를 가져옵니다"""
    split_elements = SplitElement.objects.filter(
        project_id=project_id,
        is_active=True
    ).select_related('raw_element').values(...)

    # 분할이 있는 RawElement ID들을 수집
    raw_element_ids_with_splits = set()
    for split_data in split_elements_list:
        raw_element_ids_with_splits.add(split_data['raw_element_id'])

    return split_elements_list, raw_element_ids_with_splits
```

**get_all_elements 수정**:
```python
elif msg_type == 'get_all_elements':
    # 분할 객체 데이터 조회
    split_elements, raw_element_ids_with_splits = await get_split_elements_for_project(project_id)

    await self.send(text_data=json.dumps({
        'type': 'revit_data_start',
        'payload': {
            'total': total_elements,
            'split_elements': split_elements,
            'raw_element_ids_with_splits': list(raw_element_ids_with_splits)
        }
    }))
```

### Frontend

#### 1. Geometry 추출 로직 수정 (`three_d_viewer.js`)

**문제**: 분할 객체의 position/rotation/scale이 mesh.matrix에 반영되지 않음

**해결**: World space로 변환하여 저장
```javascript
function extractGeometryData(geometry, mesh) {
    // mesh의 변환을 geometry에 적용하여 world space로 변환
    mesh.updateMatrix();
    mesh.updateMatrixWorld(true);

    const worldGeometry = geometry.clone();
    worldGeometry.applyMatrix4(mesh.matrixWorld);

    const positions = worldGeometry.attributes.position.array;
    const indices = worldGeometry.index ? worldGeometry.index.array : null;

    // Convert to nested arrays format
    const vertices = [];
    for (let i = 0; i < positions.length; i += 3) {
        vertices.push([positions[i], positions[i + 1], positions[i + 2]]);
    }

    const faces = [];
    if (indices) {
        for (let i = 0; i < indices.length; i += 3) {
            faces.push([indices[i], indices[i + 1], indices[i + 2]]);
        }
    }

    worldGeometry.dispose();

    // Identity matrix since geometry is already in world space
    const identityMatrix = new THREE.Matrix4().identity().toArray();

    return {
        vertices: vertices,
        faces: faces,
        matrix: identityMatrix,
        vertexCount: vertices.length,
        faceCount: faces.length
    };
}
```

#### 2. 분할 객체 저장 (`three_d_viewer.js`)

```javascript
function saveSplitToDatabase(mesh, splitInfo) {
    const geometryData = extractGeometryData(mesh.geometry, mesh);

    const payload = {
        project_id: window.currentProjectId,
        raw_element_id: mesh.userData.rawElementId,
        parent_split_id: mesh.userData.parentSplitId || null,
        original_geometry_volume: mesh.userData.originalGeometryVolume,
        geometry_volume: mesh.userData.geometryVolume,
        volume_ratio: mesh.userData.volumeRatio,
        split_method: splitInfo.method,
        split_part_type: mesh.userData.splitPartType,
        geometry_data: geometryData
    };

    if (splitInfo.method === 'plane') {
        payload.split_axis = mesh.userData.splitAxis;
        payload.split_position = mesh.userData.splitPosition;
    } else if (splitInfo.method === 'sketch') {
        payload.sketch_data = splitInfo.sketchData || {};
    }

    window.frontendSocket.send(JSON.stringify({
        type: 'save_split',
        payload: payload
    }));
}
```

**Plane Split 후 저장**:
```javascript
const splitInfo = { method: 'plane' };
saveSplitToDatabase(bottomMesh, splitInfo);
saveSplitToDatabase(topMesh, splitInfo);
```

**Sketch Split 후 저장**:
```javascript
const sketchInfo = {
    method: 'sketch',
    sketchData: {
        sketchPoints: sketchPoints3D.map(p => [p.x, p.y, p.z]),
        faceNormal: selectedFace ? [selectedFace.normal.x, selectedFace.normal.y, selectedFace.normal.z] : null
    }
};
saveSplitToDatabase(remainderMesh, sketchInfo);
saveSplitToDatabase(extractedMesh, sketchInfo);
```

#### 3. 분할 객체 데이터 수신 (`websocket.js`)

```javascript
case 'revit_data_start':
    // 분할 객체 데이터 저장
    if (payload.split_elements) {
        window.allSplitElements = payload.split_elements;
        console.log(`[WebSocket] Received ${payload.split_elements.length} split elements`);
    } else {
        window.allSplitElements = [];
    }

    if (payload.raw_element_ids_with_splits) {
        window.rawElementIdsWithSplits = new Set(payload.raw_element_ids_with_splits);
        console.log(`[WebSocket] ${payload.raw_element_ids_with_splits.length} BIM objects have splits`);
    } else {
        window.rawElementIdsWithSplits = new Set();
    }
    break;
```

#### 4. Load Geometry 버튼 수정 (`three_d_viewer.js`)

**이전**: 메모리의 allRevitData만 사용
```javascript
loadBtn.onclick = function() {
    loadPlaceholderGeometry();
};
```

**수정**: 서버에 최신 데이터 요청
```javascript
loadBtn.onclick = function() {
    if (window.currentProjectId && window.frontendSocket && window.frontendSocket.readyState === WebSocket.OPEN) {
        console.log("[3D Viewer] Requesting fresh data from server (including split elements)...");
        window.frontendSocket.send(JSON.stringify({
            type: 'get_all_elements',
            payload: {
                project_id: window.currentProjectId
            }
        }));
    } else {
        loadPlaceholderGeometry();
    }
};
```

#### 5. 분할 객체 로드 (`three_d_viewer.js`)

```javascript
window.loadPlaceholderGeometry = function() {
    const rawElementIdsWithSplits = window.rawElementIdsWithSplits || new Set();

    // 분할된 BIM 원본 객체는 제외
    const geometryObjects = window.allRevitData
        .filter(obj => {
            if (rawElementIdsWithSplits.has(obj.id)) {
                return false;  // 분할된 BIM 원본은 숨김
            }
            return obj.raw_data && obj.raw_data.Parameters && obj.raw_data.Parameters.Geometry;
        })
        .map(obj => ({...}));

    // 분할 객체 데이터 준비
    const splitObjects = (window.allSplitElements || []).map(split => ({
        id: split.id,
        geometry_volume: split.geometry_volume,
        geometry: {
            vertices: split.geometry_data.vertices,
            faces: split.geometry_data.faces,
            matrix: split.geometry_data.matrix
        },
        // 분할 객체 메타데이터
        isSplitElement: true,
        rawElementId: split.raw_element_id,
        parentSplitId: split.parent_split_id,
        originalGeometryVolume: split.original_geometry_volume,
        volumeRatio: split.volume_ratio,
        splitMethod: split.split_method,
        splitAxis: split.split_axis,
        splitPosition: split.split_position,
        splitPartType: split.split_part_type
    }));

    // BIM 원본과 분할 객체 합치기
    const allObjectsToLoad = [...geometryObjects, ...splitObjects];

    window.loadBimGeometry(allObjectsToLoad);
};
```

#### 6. Geometry 로드 시 변환 건너뛰기 (`loadBimGeometry`)

**문제**: 분할 객체는 이미 world space인데 Z-up → Y-up 변환을 다시 적용하여 위치 틀어짐

**해결**: 분할 객체는 변환 건너뛰기
```javascript
// Split objects are already in world space, so skip transformation
if (!bimObject.isSplitElement && geomData.matrix && geomData.matrix.length === 16) {
    // IFC transformation matrix 적용
    const ifcMatrix = new THREE.Matrix4();
    ifcMatrix.fromArray(geomData.matrix);

    // Z-up to Y-up conversion
    const zUpToYUp = new THREE.Matrix4();
    zUpToYUp.set(
        1,  0,  0,  0,
        0,  0,  1,  0,
        0, -1,  0,  0,
        0,  0,  0,  1
    );

    const finalMatrix = new THREE.Matrix4();
    finalMatrix.multiplyMatrices(zUpToYUp, ifcMatrix);
    mesh.applyMatrix4(finalMatrix);
}
```

#### 7. userData 설정 구분 (`loadBimGeometry`)

```javascript
if (bimObject.isSplitElement) {
    // 분할 객체인 경우
    mesh.userData = {
        isSplitElement: true,
        splitId: bimObject.id,
        rawElementId: bimObject.rawElementId,
        parentSplitId: bimObject.parentSplitId,
        originalGeometryVolume: bimObject.originalGeometryVolume,
        geometryVolume: bimObject.geometry_volume,
        volumeRatio: bimObject.volumeRatio,
        splitMethod: bimObject.splitMethod,
        splitAxis: bimObject.splitAxis,
        splitPosition: bimObject.splitPosition,
        splitPartType: bimObject.splitPartType
    };
} else {
    // BIM 원본 객체인 경우
    mesh.userData = {
        bimObjectId: bimObject.id || index,
        rawElementId: bimObject.id || index,
        geometry_volume: bimObject.geometry_volume
    };
}
```

#### 8. 자동 로드 (`websocket.js`)

```javascript
case 'revit_data_complete':
    // 3D 뷰어에 geometry 자동 로드
    if (typeof loadPlaceholderGeometry === 'function') {
        console.log("[WebSocket] Auto-loading 3D geometry after data complete...");
        loadPlaceholderGeometry();
    }
    break;
```

#### 9. 분할 객체 선택 가능하도록 수정 (`three_d_viewer.js`)

**문제**:
- Runtime split 객체는 `isSplitPart = true`
- DB 로드 split 객체는 `isSplitElement = true`
- 선택 로직은 `isSplitPart`만 확인

**해결**: 모든 선택 관련 로직에 `isSplitElement` 추가

```javascript
// Get all BIM meshes
scene.traverse(function(object) {
    if (object instanceof THREE.Mesh && object.userData &&
        (object.userData.bimObjectId || object.userData.isSplitPart || object.userData.isSplitElement)) {
        bimMeshes.push(object);
    }
});

// Validate clicked object
if (clickedObject instanceof THREE.Mesh && clickedObject.userData &&
    (clickedObject.userData.bimObjectId || clickedObject.userData.isSplitPart || clickedObject.userData.isSplitElement)) {
    selectObject(clickedObject);
}

// Display properties
const bimObjectId = object.userData.bimObjectId || object.userData.originalObjectId || object.userData.rawElementId;

// Display volume info
if (object.userData.isSplitPart || object.userData.isSplitElement) {
    console.log('  - Split Part Type:', object.userData.splitPartType);
    // ...
}
```

## 파일 변경 사항

### Backend
1. `connections/models.py` - SplitElement 모델 추가
2. `connections/migrations/0003_alter_rawelement_geometry_volume_splitelement.py` - Migration
3. `connections/admin.py` - SplitElementAdmin 추가
4. `connections/consumers.py` - split element 조회/저장 로직 추가

### Frontend
1. `connections/static/connections/three_d_viewer.js` (v26 → v31)
   - v28: World space geometry 저장, 로드 시 변환 건너뛰기
   - v29: Load Geometry 버튼이 서버에 데이터 요청하도록 수정
   - v30: loadPlaceholderGeometry를 전역 함수로 노출
   - v31: 분할 객체 선택 가능하도록 수정
2. `connections/static/connections/websocket.js` - 분할 객체 데이터 수신 처리
3. `connections/templates/revit_control.html` - 스크립트 버전 업데이트

## 테스트 결과

### 성공 케이스
✅ Plane Split 후 DB 저장 (2개 객체)
✅ Sketch Split 후 DB 저장 (2개 객체)
✅ Load Geometry 시 분할 객체 자동 로드
✅ 분할된 BIM 원본 객체 자동 숨김
✅ 분할 객체 선택 가능
✅ 분할 객체 Properties 표시
✅ 분할 객체 Volume 정보 표시
✅ 정확한 위치에 분할 객체 로드 (world space)

### Volume 보존 확인
- Plane Split: Bottom 50% + Top 50% = 100%
- Sketch Split: Remainder + Extracted = 100%
- Original BIM volume 기준 비율 계산 정확

## 주요 기술 포인트

1. **World Space Geometry 저장**
   - `mesh.matrixWorld`를 geometry에 적용하여 world space로 변환
   - Identity matrix로 저장하여 로드 시 변환 불필요

2. **Django Signal을 통한 자동 무효화**
   - RawElement 변경 시 관련 SplitElement 자동 무효화
   - 재귀적으로 자식 split도 무효화

3. **WebSocket 비동기 처리**
   - `@database_sync_to_async` 데코레이터 활용
   - Non-blocking DB 조회/저장

4. **Frontend 상태 관리**
   - `window.allSplitElements`: 분할 객체 목록
   - `window.rawElementIdsWithSplits`: 분할된 BIM ID Set

5. **선택 로직 통합**
   - Runtime split (`isSplitPart`)와 DB split (`isSplitElement`) 모두 처리
   - BIM ID 조회 시 fallback 체인 활용

## 향후 개선 사항

1. **재분할 지원**
   - 분할 객체를 다시 분할할 수 있도록 `parentSplitId` 활용
   - 분할 계층 구조 UI 표시

2. **분할 객체 편집**
   - 분할 위치 조정
   - 분할 객체 삭제
   - 분할 취소 (원본 복원)

3. **성능 최적화**
   - 대량 분할 객체 로드 시 청크 처리
   - Geometry 압축 저장

4. **UI/UX 개선**
   - 분할 객체 구분 표시 (색상, 아이콘)
   - 분할 히스토리 표시
   - Undo/Redo 기능

## 결론

3D 분할 객체의 완전한 영속화 시스템을 구현하여, 사용자가 분할한 객체를 데이터베이스에 저장하고 언제든지 복원할 수 있게 되었습니다. World space 좌표 저장을 통해 위치 정확도를 보장하고, Django Signal을 활용한 자동 무효화로 데이터 일관성을 유지합니다.
