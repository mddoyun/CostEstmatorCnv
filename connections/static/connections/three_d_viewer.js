// three_d_viewer.js
// 3D Viewer for BIM geometry visualization
// Uses global THREE object loaded from CDN

(function() {
    let scene, camera, renderer, controls;
    let geometryLoaded = false;
    let raycaster, mouse;
    let selectedObject = null;
    let selectedObjects = []; // ▼▼▼ [추가] 복수 선택을 위한 배열 ▼▼▼
    let originalMaterials = new Map(); // Store original materials for deselection
    let hoveredObject = null; // ▼▼▼ [추가] 호버된 객체 ▼▼▼

    // For cycling through overlapping objects
    let lastClickPosition = null;
    let lastIntersects = [];
    let currentIntersectIndex = 0;

    // ▼▼▼ [추가] 박스 선택을 위한 변수들 ▼▼▼
    let isDragging = false;
    let dragStart = null;
    let dragCurrent = null;
    let selectionBox = null;  // HTML element for visual selection box
    let pointerDownTime = 0;  // To distinguish click from drag
    let previewHighlightedObjects = [];  // Objects highlighted during box drag
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // Visibility state management
    let hiddenObjectIds = new Set(); // Store IDs of hidden objects

    // Cache for cost items with unit price information from BOQ report
    let costItemsWithPrices = [];

    // Retry counters for data loading
    let displayCostItemsRetryCount = new Map(); // mesh -> retry count

    // Camera state for restoration after reload (전역으로 노출)
    window.savedCameraState = null;

    window.initThreeDViewer = function() {
        console.log("[3D Viewer] Initializing 3D Viewer...");

        // Check if already initialized
        if (scene && renderer && camera && controls) {
            console.log("[3D Viewer] 3D Viewer already initialized, skipping...");
            // Restore visibility state if returning from another tab
            if (typeof restoreVisibilityState === 'function') {
                restoreVisibilityState();
            }
            return;
        }

        const container = document.querySelector('.three-d-viewer-container');
        const canvas = document.getElementById('three-d-canvas');

        if (!container || !canvas) {
            console.error("[3D Viewer] Container or canvas not found.");
            return;
        }

        // Check if THREE is available
        if (typeof THREE === 'undefined') {
            console.error("[3D Viewer] THREE.js library not loaded!");
            return;
        }

        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xcccccc);

        // Camera
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(10, 10, 10);
        camera.lookAt(0, 0, 0);

        // Renderer
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);

        // Enable shadows
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Controls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.screenSpacePanning = false;
        controls.minDistance = 1;
        controls.maxDistance = 500;

        // ▼▼▼ [추가] 박스 선택을 위해 좌클릭 비활성화 ▼▼▼
        // 좌클릭: 비활성화 (박스 선택 전용)
        // 우클릭: 회전
        // 중간 버튼: 이동
        controls.mouseButtons = {
            LEFT: null,                    // 좌클릭 비활성화
            MIDDLE: THREE.MOUSE.PAN,       // 중간 버튼 = 이동
            RIGHT: THREE.MOUSE.ROTATE      // 우클릭 = 회전
        };
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;

        // Configure shadow properties
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;

        scene.add(directionalLight);

        // Axes Helper
        const axesHelper = new THREE.AxesHelper(5);
        scene.add(axesHelper);

        // Grid Helper
        const gridHelper = new THREE.GridHelper(20, 20);
        scene.add(gridHelper);

        // Initialize raycaster for object selection
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // ▼▼▼ [수정] 박스 선택을 위한 이벤트 리스너 변경 ▼▼▼
        // Create selection box UI element
        selectionBox = document.createElement('div');
        selectionBox.style.position = 'absolute';
        selectionBox.style.border = '2px dashed #4CAF50';
        selectionBox.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        selectionBox.style.pointerEvents = 'none';
        selectionBox.style.display = 'none';
        selectionBox.style.zIndex = '1000';
        container.style.position = 'relative';  // Ensure container is positioned
        container.appendChild(selectionBox);

        // Add pointer event listeners for box selection
        canvas.addEventListener('pointerdown', onPointerDown, false);
        canvas.addEventListener('pointermove', onPointerMove, false);
        canvas.addEventListener('pointerup', onPointerUp, false);
        canvas.addEventListener('pointerleave', onPointerLeave, false);  // Clear hover when leaving canvas
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // Start animation loop
        animate();

        // Handle window resize
        window.addEventListener('resize', onWindowResize, false);

        // ▼▼▼ [추가] camera와 controls를 전역으로 노출 ▼▼▼
        window.camera = camera;
        window.controls = controls;
        window.scene = scene;
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        console.log("[3D Viewer] 3D Viewer initialized successfully.");
    };

    function animate() {
        requestAnimationFrame(animate);
        if (controls) {
            controls.update();
        }
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }

    function onWindowResize() {
        const container = document.querySelector('.three-d-viewer-container');
        if (!container || !camera || !renderer) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    // ▼▼▼ [수정] 전역으로 노출하여 websocket.js에서 호출 가능하도록 ▼▼▼
    window.loadPlaceholderGeometry = function() {
        if (!scene) {
            console.error("[3D Viewer] Scene not initialized!");
            return;
        }

        // Load actual BIM geometry from allRevitData
        console.log("[3D Viewer] Loading BIM geometry from allRevitData...");

        // ▼▼▼ [추가] 분할된 BIM 원본 객체 ID 집합 확인 ▼▼▼
        const rawElementIdsWithSplits = window.rawElementIdsWithSplits || new Set();
        console.log(`[3D Viewer] ${rawElementIdsWithSplits.size} BIM objects have splits and will be hidden`);
        console.log('[3D Viewer] IDs with splits:', Array.from(rawElementIdsWithSplits));
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        // Filter objects that have geometry data
        if (!window.allRevitData || window.allRevitData.length === 0) {
            console.warn("[3D Viewer] No Revit data available. Loading placeholder cube instead.");

            if (geometryLoaded) {
                window.clearScene();
            }

            // Fallback: Add a simple box
            const geometry = new THREE.BoxGeometry(5, 5, 5);
            const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
            const cube = new THREE.Mesh(geometry, material);
            scene.add(cube);
            geometryLoaded = true;
            console.log("[3D Viewer] Placeholder cube loaded (no BIM data found).");
            return;
        }

        // ▼▼▼ [수정] 분할된 BIM 원본 객체는 제외하고 필터링 ▼▼▼
        let filteredOutCount = 0;
        const geometryObjects = window.allRevitData
            .filter(obj => {
                // 지오메트리 데이터가 없으면 먼저 제외
                if (!obj.raw_data || !obj.raw_data.Parameters || !obj.raw_data.Parameters.Geometry) {
                    return false;
                }

                // BIM 원본 객체가 분할되었으면 제외
                if (rawElementIdsWithSplits.has(obj.id)) {
                    console.log(`[3D Viewer] Filtering out split BIM object: ${obj.id}`);
                    filteredOutCount++;
                    return false;
                }

                return true;
            })
            .map(obj => ({
                id: obj.id,
                geometry_volume: obj.geometry_volume,
                geometry: {
                    vertices: obj.raw_data.Parameters.Geometry.verts,
                    faces: obj.raw_data.Parameters.Geometry.faces,
                    matrix: obj.raw_data.Parameters.Geometry.matrix
                }
            }));
        console.log(`[3D Viewer] Filtered out ${filteredOutCount} BIM objects that have splits`);
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // ▼▼▼ [추가] 분할 객체 데이터 준비 (parent split 제외) ▼▼▼
        // 1. parent로 사용된 split의 ID 목록 추출 (재분할된 경우)
        const parentSplitIds = new Set(
            (window.allSplitElements || [])
                .filter(split => split.parent_split_id)
                .map(split => split.parent_split_id)
        );
        console.log(`[3D Viewer] Found ${parentSplitIds.size} parent splits that will be hidden`);

        // 2. leaf split만 로드 (parent가 아닌 것만)
        const splitObjects = (window.allSplitElements || [])
            .filter(split => !parentSplitIds.has(split.id))
            .map(split => ({
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

        console.log(`[3D Viewer] Found ${geometryObjects.length} unsplit BIM objects with geometry data.`);
        console.log(`[3D Viewer] Found ${splitObjects.length} split objects to load.`);
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        // ▼▼▼ [수정] BIM 원본 객체와 분할 객체 합치기 ▼▼▼
        const allObjectsToLoad = [...geometryObjects, ...splitObjects];

        if (allObjectsToLoad.length === 0) {
            console.warn("[3D Viewer] No objects with geometry found. Loading placeholder cube instead.");

            if (geometryLoaded) {
                window.clearScene();
            }

            // Fallback: Add a simple box
            const geometry = new THREE.BoxGeometry(5, 5, 5);
            const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
            const cube = new THREE.Mesh(geometry, material);
            scene.add(cube);
            geometryLoaded = true;
            console.log("[3D Viewer] Placeholder cube loaded (no geometry property found).");
            return;
        }

        console.log(`[3D Viewer] Total objects to load: ${allObjectsToLoad.length}`);

        // [DEBUG] Check first object's matrix
        if (allObjectsToLoad.length > 0) {
            console.log('[DEBUG] First geometry object:', allObjectsToLoad[0]);
            console.log('[DEBUG] Matrix:', allObjectsToLoad[0].geometry.matrix);
            console.log('[DEBUG] Matrix length:', allObjectsToLoad[0].geometry.matrix ? allObjectsToLoad[0].geometry.matrix.length : 'null');
            console.log('[DEBUG] Matrix type:', typeof allObjectsToLoad[0].geometry.matrix);
            console.log('[DEBUG] Vertices sample:', allObjectsToLoad[0].geometry.vertices.slice(0, 3));
            console.log('[DEBUG] Faces sample:', allObjectsToLoad[0].geometry.faces.slice(0, 3));
        }

        // Load BIM geometry using the dedicated function
        window.loadBimGeometry(allObjectsToLoad);

        // ▼▼▼ [추가] 저장된 카메라 상태 복원 ▼▼▼
        if (window.savedCameraState && camera && controls) {
            console.log('[3D Viewer] Restoring camera state...');
            camera.position.copy(window.savedCameraState.position);
            camera.rotation.copy(window.savedCameraState.rotation);
            camera.zoom = window.savedCameraState.zoom;
            camera.updateProjectionMatrix();

            if (controls.target) {
                controls.target.copy(window.savedCameraState.target);
            }
            controls.update();

            console.log('[3D Viewer] Camera state restored');
            window.savedCameraState = null; // 사용 후 초기화
        }
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        // Restore visibility state if returning from another tab
        restoreVisibilityState();

        // Update visibility control buttons
        updateVisibilityControlButtons();
        // ▲▲▲ [수정] 여기까지 ▲▲▲
    };  // ▼▼▼ [수정] 전역 함수이므로 세미콜론 추가 ▼▼▼

    window.clearScene = function() {
        if (!scene) {
            console.error("[3D Viewer] Scene not initialized!");
            return;
        }

        // Deselect any selected object
        deselectObject();

        // ▼▼▼ [수정] meshes, lights, helpers 모두 제거 ▼▼▼
        const objectsToRemove = [];
        scene.traverse(function(object) {
            // Remove meshes, lights, and helpers (but keep camera)
            if (object instanceof THREE.Mesh ||
                object instanceof THREE.Light ||
                object instanceof THREE.AxesHelper ||
                object instanceof THREE.GridHelper) {
                objectsToRemove.push(object);
            }
        });

        objectsToRemove.forEach(function(object) {
            if (object.geometry) {
                object.geometry.dispose();
            }
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
            scene.remove(object);
        });
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // Clear original materials map
        originalMaterials.clear();

        // Re-add essential scene elements (matching initThreeDViewer settings)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;

        // Configure shadow properties
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;

        scene.add(directionalLight);

        const axesHelper = new THREE.AxesHelper(5);
        scene.add(axesHelper);

        const gridHelper = new THREE.GridHelper(20, 20);
        scene.add(gridHelper);

        geometryLoaded = false;
        console.log("[3D Viewer] Scene cleared.");
    };

    // Load cost items with unit price information
    // This loads cost items and enriches them with unit price data from cost codes
    window.loadCostItemsWithPrices = async function() {
        console.log("[3D Viewer] Loading cost items with unit price information...");

        if (!window.currentProjectId) {
            console.warn("[3D Viewer] No project selected, cannot load cost items with prices");
            return;
        }

        try {
            // Step 1: Load cost items
            console.log("[3D Viewer] Fetching cost items...");
            const costItemsResponse = await fetch(
                `/connections/api/cost-items/${window.currentProjectId}/`
            );
            if (!costItemsResponse.ok) {
                throw new Error(`Failed to load cost items: ${costItemsResponse.status}`);
            }
            const costItems = await costItemsResponse.json();
            console.log(`[3D Viewer] Loaded ${costItems.length} cost items`);

            // Step 2: Load cost codes with unit prices
            console.log("[3D Viewer] Fetching cost codes...");
            const costCodesResponse = await fetch(
                `/connections/api/cost-codes/${window.currentProjectId}/`
            );
            if (!costCodesResponse.ok) {
                throw new Error(`Failed to load cost codes: ${costCodesResponse.status}`);
            }
            const costCodes = await costCodesResponse.json();
            console.log(`[3D Viewer] Loaded ${costCodes.length} cost codes`);

            // Step 3: For each cost code, fetch its unit prices
            console.log("[3D Viewer] Fetching unit prices for each cost code...");
            const costCodesWithPrices = await Promise.all(
                costCodes.map(async (cc) => {
                    try {
                        const unitPricesResponse = await fetch(
                            `/connections/api/unit-prices/${window.currentProjectId}/${cc.id}/`
                        );
                        if (unitPricesResponse.ok) {
                            const unitPrices = await unitPricesResponse.json();
                            return { ...cc, unit_prices: unitPrices };
                        }
                        return cc;
                    } catch (err) {
                        console.warn(`[3D Viewer] Failed to load unit prices for cost code ${cc.code}:`, err);
                        return cc;
                    }
                })
            );
            console.log(`[3D Viewer] Enriched ${costCodesWithPrices.length} cost codes with unit prices`);

            // Step 4: Match cost items with cost codes and calculate prices
            costItemsWithPrices = costItems.map(item => {
                console.log('[3D Viewer] Processing item for enrichment:', item.id, item.cost_code_name);

                // Find the cost code for this item
                let costCode = null;

                // Try to match by code extracted from cost_code_name
                if (item.cost_code_name) {
                    const codeMatch = item.cost_code_name.match(/^([^\s-]+)/);
                    if (codeMatch) {
                        const code = codeMatch[1].trim();
                        console.log('[3D Viewer] Looking for cost code with code:', code);
                        costCode = costCodesWithPrices.find(cc => cc.code === code);
                        console.log('[3D Viewer] Found cost code:', costCode ? costCode.code : 'NOT FOUND');
                    }
                }

                if (!costCode) {
                    console.warn(`[3D Viewer] No cost code found for item:`, item);
                    return item;
                }

                // Debug: Check item and cost code structure
                console.log('[3D Viewer] Item unit_price_type_id:', item.unit_price_type_id);
                console.log('[3D Viewer] Cost code unit_prices:', costCode.unit_prices);
                console.log('[3D Viewer] Cost code unit_prices length:', costCode.unit_prices ? costCode.unit_prices.length : 0);

                // Get unit price matching the item's unit_price_type_id
                let materialUnitPrice = 0;
                let laborUnitPrice = 0;
                let expenseUnitPrice = 0;

                if (item.unit_price_type_id && costCode.unit_prices && costCode.unit_prices.length > 0) {
                    console.log('[3D Viewer] Looking for unit price with unit_price_type_id:', item.unit_price_type_id);
                    // Find unit price that matches the item's unit_price_type_id
                    const matchingUnitPrice = costCode.unit_prices.find(up =>
                        up.unit_price_type_id && up.unit_price_type_id.toString() === item.unit_price_type_id.toString()
                    );
                    console.log('[3D Viewer] Found matching unit price:', matchingUnitPrice);
                    if (matchingUnitPrice) {
                        materialUnitPrice = parseFloat(matchingUnitPrice.material_cost) || 0;
                        laborUnitPrice = parseFloat(matchingUnitPrice.labor_cost) || 0;
                        expenseUnitPrice = parseFloat(matchingUnitPrice.expense_cost) || 0;
                        console.log('[3D Viewer] Extracted unit prices - Material:', materialUnitPrice, 'Labor:', laborUnitPrice, 'Expense:', expenseUnitPrice);
                    } else {
                        console.warn('[3D Viewer] No matching unit price found for unit_price_type_id:', item.unit_price_type_id);
                    }
                } else if (costCode.unit_prices && costCode.unit_prices.length > 0) {
                    // Fallback: If no unit_price_type_id, use the first available unit price
                    console.log('[3D Viewer] No unit_price_type_id on item, using first available unit price');
                    const firstUnitPrice = costCode.unit_prices[0];
                    console.log('[3D Viewer] First unit price object:', firstUnitPrice);

                    // Use correct field names: material_cost, labor_cost, expense_cost
                    materialUnitPrice = parseFloat(firstUnitPrice.material_cost) || 0;
                    laborUnitPrice = parseFloat(firstUnitPrice.labor_cost) || 0;
                    expenseUnitPrice = parseFloat(firstUnitPrice.expense_cost) || 0;
                    console.log('[3D Viewer] Using first unit price - Material:', materialUnitPrice, 'Labor:', laborUnitPrice, 'Expense:', expenseUnitPrice);
                } else {
                    console.warn('[3D Viewer] No unit prices available for cost code:', costCode.code);
                }

                const quantity = parseFloat(item.quantity) || 0;
                const totalUnitPrice = materialUnitPrice + laborUnitPrice + expenseUnitPrice;

                // Return enriched item with price information
                return {
                    ...item,
                    cost_code_code: costCode.code,
                    work_type: costCode.category || costCode.work_type || '-',
                    spec: costCode.spec || '-',
                    unit: costCode.unit || '-',
                    material_cost_unit: materialUnitPrice,
                    labor_cost_unit: laborUnitPrice,
                    expense_cost_unit: expenseUnitPrice,
                    total_cost_unit: totalUnitPrice,
                    material_cost_total: materialUnitPrice * quantity,
                    labor_cost_total: laborUnitPrice * quantity,
                    expense_cost_total: expenseUnitPrice * quantity,
                    total_cost_total: totalUnitPrice * quantity
                };
            });

            console.log(`[3D Viewer] Enriched ${costItemsWithPrices.length} cost items with unit price information`);
        } catch (error) {
            console.error("[3D Viewer] Failed to load cost items with prices:", error);
            showToast(`단가 정보 로딩 실패: ${error.message}`, "error");
            costItemsWithPrices = [];
        }
    };

    window.setupThreeDViewerListeners = function() {
        console.log("[3D Viewer] Setting up listeners for 3D Viewer tab.");

        const loadBtn = document.getElementById('load-geometry-btn');
        const clearBtn = document.getElementById('clear-scene-btn');
        const splitBtn = document.getElementById('split-object-btn');
        const deleteAllSplitsBtn = document.getElementById('delete-all-splits-btn');

        // Use onclick to avoid duplicate event listeners
        if (loadBtn) {
            loadBtn.onclick = function() {
                console.log("[3D Viewer] Load Geometry button clicked.");

                // ▼▼▼ [수정] 서버에서 최신 데이터 요청 (분할 객체 포함) ▼▼▼
                if (window.currentProjectId && window.frontendSocket && window.frontendSocket.readyState === WebSocket.OPEN) {
                    console.log("[3D Viewer] Requesting fresh data from server (including split elements)...");
                    window.frontendSocket.send(JSON.stringify({
                        type: 'get_all_elements',
                        payload: {
                            project_id: window.currentProjectId
                        }
                    }));
                    // Note: loadPlaceholderGeometry() will be called automatically
                    // when 'revit_data_complete' is received via WebSocket
                } else {
                    console.warn("[3D Viewer] No project selected or WebSocket not connected. Loading from cached data.");
                    loadPlaceholderGeometry();
                }
                // ▲▲▲ [수정] 여기까지 ▲▲▲
            };
        }

        if (clearBtn) {
            clearBtn.onclick = function() {
                console.log("[3D Viewer] Clear Scene button clicked.");
                window.clearScene();
            };
        }

        // ▼▼▼ [추가] 모든 분할 객체 삭제 버튼 ▼▼▼
        if (deleteAllSplitsBtn) {
            deleteAllSplitsBtn.onclick = async function() {
                console.log("[3D Viewer] Delete All Splits button clicked.");

                if (!window.currentProjectId) {
                    showToast('프로젝트를 먼저 선택하세요', 'warning');
                    return;
                }

                // 확인 대화상자
                const confirmed = confirm('정말로 모든 분할 객체를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 연관된 산출부재와 산출항목도 함께 삭제됩니다.');

                if (!confirmed) {
                    console.log("[3D Viewer] Delete operation cancelled by user.");
                    return;
                }

                try {
                    console.log("[3D Viewer] Calling API to delete all split elements...");

                    const response = await fetch(`/connections/api/projects/${window.currentProjectId}/split-elements/delete-all/`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': window.csrfToken || document.querySelector('[name=csrfmiddlewaretoken]')?.value
                        }
                    });

                    const result = await response.json();

                    if (result.status === 'success') {
                        console.log(`[3D Viewer] Successfully deleted ${result.deleted_count} split elements`);
                        console.log(`[3D Viewer] Cascade details:`, result.cascade_details);

                        showToast(result.message, 'success');

                        // 화면 새로고침 - Load Geometry 버튼 클릭
                        console.log("[3D Viewer] Reloading geometry after deletion...");
                        if (loadBtn) {
                            loadBtn.click();
                        }
                    } else {
                        console.error('[3D Viewer] Delete failed:', result.message);
                        showToast(`삭제 실패: ${result.message}`, 'error');
                    }
                } catch (error) {
                    console.error('[3D Viewer] Error deleting split elements:', error);
                    showToast('분할 객체 삭제 중 오류가 발생했습니다', 'error');
                }
            };
        }
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        // Split mode controls
        const splitControlsPanel = document.getElementById('split-controls-panel');
        const splitAxisSelect = document.getElementById('split-axis-select');
        const splitPositionSlider = document.getElementById('split-position-slider');
        const splitPositionValue = document.getElementById('split-position-value');
        const previewSplitBtn = document.getElementById('preview-split-btn');
        const applySplitBtn = document.getElementById('apply-split-btn');
        const cancelSplitBtn = document.getElementById('cancel-split-btn');

        if (splitBtn) {
            splitBtn.onclick = function() {
                console.log("[3D Viewer] Entering split mode...");
                // Show split controls, hide split button
                if (splitControlsPanel) splitControlsPanel.style.display = 'flex';
                splitBtn.style.display = 'none';
                showSplitPlaneHelper();
            };
        }

        if (splitAxisSelect) {
            splitAxisSelect.onchange = function() {
                updateSliderRange();
                updateSplitPlaneHelper();
            };
        }

        if (splitPositionSlider) {
            splitPositionSlider.oninput = function() {
                const value = parseFloat(this.value);
                if (splitPositionValue) splitPositionValue.textContent = value + '%';
                updateSplitPlaneHelper();
            };
        }

        if (previewSplitBtn) {
            previewSplitBtn.onclick = function() {
                console.log("[3D Viewer] Preview split plane");
                updateSplitPlaneHelper();
            };
        }

        if (applySplitBtn) {
            applySplitBtn.onclick = function() {
                console.log("[3D Viewer] Applying split...");
                splitSelectedObject();
                // exitSplitMode() is called inside splitSelectedObject()
            };
        }

        if (cancelSplitBtn) {
            cancelSplitBtn.onclick = function() {
                console.log("[3D Viewer] Canceling split mode");
                exitSplitMode();
            };
        }

        // Sketch split mode controls
        const sketchSplitBtn = document.getElementById('sketch-split-btn');
        const sketchControlsPanel = document.getElementById('sketch-controls-panel');
        const selectFaceBtn = document.getElementById('select-face-btn');
        const startSketchBtn = document.getElementById('start-sketch-btn');
        const clearSketchBtn = document.getElementById('clear-sketch-btn');
        const closeSketchBtn = document.getElementById('close-sketch-btn');
        const applySketchSplitBtn = document.getElementById('apply-sketch-split-btn');
        const cancelSketchBtn = document.getElementById('cancel-sketch-btn');

        // Use onclick to avoid duplicate event listeners
        if (sketchSplitBtn) {
            sketchSplitBtn.onclick = function() {
                console.log("[3D Viewer] Entering sketch split mode...");
                enterSketchMode();
            };
        }

        if (selectFaceBtn) {
            selectFaceBtn.onclick = function() {
                console.log("[3D Viewer] Select face mode activated");
                activateFaceSelectionMode();
            };
        }

        if (startSketchBtn) {
            startSketchBtn.onclick = function() {
                console.log("[3D Viewer] Starting sketch");
                startSketchMode();
            };
        }

        if (clearSketchBtn) {
            clearSketchBtn.onclick = function() {
                console.log("[3D Viewer] Clearing sketch");
                clearSketch();
            };
        }

        if (closeSketchBtn) {
            closeSketchBtn.onclick = function() {
                console.log("[3D Viewer] Closing sketch");
                closeSketch();
            };
        }

        if (applySketchSplitBtn) {
            applySketchSplitBtn.onclick = function() {
                console.log("[3D Viewer] Applying sketch split");
                applySketchSplit();
            };
        }

        if (cancelSketchBtn) {
            cancelSketchBtn.onclick = function() {
                console.log("[3D Viewer] Canceling sketch mode");
                exitSketchMode();
            };
        }

        // Visibility control buttons
        const isolateSelectionBtn = document.getElementById('isolate-selection-btn');
        const hideSelectionBtn = document.getElementById('hide-selection-btn');
        const showAllBtn = document.getElementById('show-all-btn');

        if (isolateSelectionBtn) {
            isolateSelectionBtn.onclick = function() {
                console.log("[3D Viewer] Isolating selected object");
                isolateSelection();
            };
        }

        if (hideSelectionBtn) {
            hideSelectionBtn.onclick = function() {
                console.log("[3D Viewer] Hiding selected object");
                hideSelection();
            };
        }

        if (showAllBtn) {
            showAllBtn.onclick = function() {
                console.log("[3D Viewer] Showing all objects");
                showAll();
            };
        }

        // Setup properties panel tab listeners
        setupPropertiesPanelTabs();
    };

    // Setup properties panel tabs
    function setupPropertiesPanelTabs() {
        const tabButtons = document.querySelectorAll('.properties-tab-button');

        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');

                // Remove active class from all buttons and tabs
                tabButtons.forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.properties-tab-content').forEach(content => {
                    content.classList.remove('active');
                });

                // Add active class to clicked button and corresponding tab
                this.classList.add('active');
                const targetContent = document.getElementById(targetTab + '-tab');
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }

    // Load BIM geometry from data
    window.loadBimGeometry = function(geometryData) {
        if (!scene) {
            console.error("[3D Viewer] Scene not initialized!");
            return;
        }

        if (geometryLoaded) {
            console.log("[3D Viewer] Clearing existing geometry before loading new...");
            window.clearScene();
        }

        console.log("[3D Viewer] Loading BIM geometry...", geometryData);

        if (!geometryData || geometryData.length === 0) {
            console.warn("[3D Viewer] No geometry data provided.");
            return;
        }

        // Process each BIM object
        geometryData.forEach(function(bimObject, index) {
            try {
                // Check if object has geometry property
                if (!bimObject.geometry) {
                    return; // Skip objects without geometry
                }

                const geomData = bimObject.geometry;

                // Create geometry from vertices and faces
                let geometry = new THREE.BufferGeometry();

                // Vertices - convert 2D array [[x,y,z], ...] to flat array [x,y,z, ...]
                if (geomData.vertices && geomData.vertices.length > 0) {
                    const flatVertices = geomData.vertices.flat();
                    const positions = new Float32Array(flatVertices);
                    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                }

                // Faces/Indices - convert 2D array [[i1,i2,i3], ...] to flat array [i1,i2,i3, ...]
                if (geomData.faces && geomData.faces.length > 0) {
                    const flatFaces = geomData.faces.flat();
                    const indices = new Uint32Array(flatFaces);
                    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
                }

                // Merge duplicate vertices to fix diagonal shading artifacts
                // Higher tolerance (1e-3) ensures coplanar edges are properly merged
                geometry.deleteAttribute('normal');
                geometry = THREE.BufferGeometryUtils.mergeVertices(geometry, 1e-3);

                // Compute normals for lighting
                geometry.computeVertexNormals();
                geometry.normalizeNormals();

                // Create material with light gray color and flat shading
                const material = new THREE.MeshStandardMaterial({
                    color: 0xcccccc,        // Light gray
                    metalness: 0.0,
                    roughness: 1.0,         // High roughness for more uniform appearance
                    flatShading: true,      // Flat shading to eliminate diagonal shading artifacts
                    side: THREE.DoubleSide
                });

                // Create mesh and add to scene
                const mesh = new THREE.Mesh(geometry, material);

                // Enable shadow casting and receiving
                mesh.castShadow = true;
                mesh.receiveShadow = true;

                // Add only boundary edges (external outline, no internal triangulation)
                const boundaryGeometry = getBoundaryEdges(geometry);
                const lineMaterial = new THREE.LineBasicMaterial({
                    color: 0x000000,
                    linewidth: 1
                });
                const lineSegments = new THREE.LineSegments(boundaryGeometry, lineMaterial);
                mesh.add(lineSegments);

                // ▼▼▼ [수정] 분할 객체는 world space → local space로 변환 필요 ▼▼▼
                // Apply transformation matrix if available
                if (!bimObject.isSplitElement && geomData.matrix && geomData.matrix.length === 16) {
                    console.log('[loadBimGeometry] Applying IFC matrix to BIM object');

                    // IFC transformation matrix (4x4) - column-major format
                    const ifcMatrix = new THREE.Matrix4();
                    ifcMatrix.fromArray(geomData.matrix);

                    // Convert from Z-up (IFC/Blender) to Y-up (Three.js)
                    // Transformation: X stays, Y->Z, Z->-Y (flipped)
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

                    console.log('[loadBimGeometry] After applyMatrix4 - mesh transform:', {
                        position: mesh.position.toArray(),
                        rotation: mesh.rotation.toArray(),
                        scale: mesh.scale.toArray()
                    });
                } else if (bimObject.isSplitElement) {
                    // Split objects are stored in world space with identity transform
                    // Keep them as-is for consistent behavior
                    console.log('[loadBimGeometry] Split element - keeping world space geometry with identity transform');
                }
                // ▲▲▲ [수정] 여기까지 ▲▲▲

                // ▼▼▼ [수정] BIM 원본 객체와 분할 객체 구분하여 userData 설정 ▼▼▼
                if (bimObject.isSplitElement) {
                    // 분할 객체인 경우
                    mesh.userData = {
                        isSplitElement: true,
                        isSplitPart: true,  // 분할된 부분임을 표시
                        splitElementId: bimObject.id,  // DB의 SplitElement.id (재분할 시 parentSplitId로 사용)
                        rawElementId: bimObject.rawElementId,
                        parentSplitId: bimObject.parentSplitId,
                        originalGeometryVolume: bimObject.originalGeometryVolume,
                        geometryVolume: bimObject.geometry_volume,
                        geometry_volume: bimObject.geometry_volume,  // 일관성을 위해 추가
                        volumeRatio: bimObject.volumeRatio,
                        splitMethod: bimObject.splitMethod,
                        splitAxis: bimObject.splitAxis,
                        splitPosition: bimObject.splitPosition,
                        splitPartType: bimObject.splitPartType,
                        originalColor: new THREE.Color(0xcccccc)  // 기본 색상 저장
                    };
                } else {
                    // BIM 원본 객체인 경우
                    mesh.userData = {
                        bimObjectId: bimObject.id || index,
                        rawElementId: bimObject.id || index,  // Same as bimObjectId, used for split DB storage
                        geometry_volume: bimObject.geometry_volume  // DB volume for original BIM object
                    };
                }
                // ▲▲▲ [수정] 여기까지 ▲▲▲

                scene.add(mesh);

            } catch (error) {
                console.error(`[3D Viewer] Error loading geometry for object ${index}:`, error);
            }
        });

        geometryLoaded = true;
        console.log(`[3D Viewer] BIM geometry loaded. ${geometryData.length} objects processed.`);

        // Center camera on loaded geometry
        centerCameraOnGeometry();

        // Restore visibility state (if returning from another tab)
        restoreVisibilityState();

        // Update visibility control buttons
        updateVisibilityControlButtons();
    };

    function centerCameraOnGeometry() {
        if (!scene || !camera || !controls) return;

        const box = new THREE.Box3().setFromObject(scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.5; // Add some padding

        camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
        camera.lookAt(center);

        controls.target.copy(center);
        controls.update();

        console.log("[3D Viewer] Camera centered on geometry.");
    }

    // ▼▼▼ [추가] 박스 선택을 위한 새로운 이벤트 핸들러 ▼▼▼

    // Pointer down - start drag or prepare for click
    function onPointerDown(event) {
        if (!scene || !camera || !raycaster) return;

        // Ignore if controls are being used (right-click, middle-click)
        if (event.button !== 0) return;  // Only handle left-click

        const canvas = document.getElementById('three-d-canvas');
        const rect = canvas.getBoundingClientRect();

        dragStart = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            clientX: event.clientX,
            clientY: event.clientY
        };

        pointerDownTime = Date.now();
        isDragging = false;  // Will be set to true if mouse moves
    }

    // Pointer move - update selection box if dragging, or show hover effect
    function onPointerMove(event) {
        const canvas = document.getElementById('three-d-canvas');
        const rect = canvas.getBoundingClientRect();

        if (dragStart) {
            // Dragging mode - update selection box
            const currentX = event.clientX - rect.left;
            const currentY = event.clientY - rect.top;

            // Check if moved enough to be considered a drag (5px threshold)
            const dx = currentX - dragStart.x;
            const dy = currentY - dragStart.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 5) {
                isDragging = true;
                dragCurrent = { x: currentX, y: currentY };

                // Update selection box visual
                updateSelectionBoxUI();
            }
        } else {
            // ▼▼▼ [추가] 호버 모드 - 마우스 아래 객체 감지 ▼▼▼
            if (!scene || !camera || !raycaster) return;

            // Calculate mouse position in normalized device coordinates
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            // Update raycaster
            raycaster.setFromCamera(mouse, camera);

            // Get all BIM meshes
            const bimMeshes = [];
            scene.traverse(function(object) {
                if (object instanceof THREE.Mesh && object.userData &&
                    (object.userData.bimObjectId || object.userData.isSplitPart || object.userData.isSplitElement) &&
                    object.visible) {  // Only visible objects
                    bimMeshes.push(object);
                }
            });

            // Check for intersections
            const intersects = raycaster.intersectObjects(bimMeshes, true);

            // Filter to get first valid object that's in front of camera
            let newHoveredObject = null;
            for (let intersect of intersects) {
                let obj = intersect.object;

                // Get parent if it's a LineSegments
                if (obj instanceof THREE.LineSegments && obj.parent) {
                    obj = obj.parent;
                }

                // Verify it's a valid mesh
                if (obj instanceof THREE.Mesh && obj.userData &&
                    (obj.userData.bimObjectId || obj.userData.isSplitPart || obj.userData.isSplitElement)) {

                    // Check if object is in front of camera (not behind)
                    const worldPos = new THREE.Vector3();
                    obj.getWorldPosition(worldPos);
                    const screenPos = worldPos.clone().project(camera);

                    if (screenPos.z < 1 && screenPos.z > -1) {  // In viewport
                        newHoveredObject = obj;
                        break;
                    }
                }
            }

            // Update hover state
            if (newHoveredObject !== hoveredObject) {
                // Clear old hover
                if (hoveredObject && !selectedObjects.includes(hoveredObject) && hoveredObject !== selectedObject) {
                    if (originalMaterials.has(hoveredObject)) {
                        hoveredObject.material = originalMaterials.get(hoveredObject);
                        hoveredObject.material.needsUpdate = true;
                    }
                }

                // Apply new hover
                hoveredObject = newHoveredObject;
                if (hoveredObject && !selectedObjects.includes(hoveredObject) && hoveredObject !== selectedObject) {
                    if (!originalMaterials.has(hoveredObject)) {
                        originalMaterials.set(hoveredObject, hoveredObject.material);
                    }

                    // Hover highlight - light blue
                    const hoverMaterial = new THREE.MeshStandardMaterial({
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

                    hoveredObject.material = hoverMaterial;
                    hoveredObject.material.needsUpdate = true;
                }
            }
            // ▲▲▲ [추가] 여기까지 ▲▲▲
        }
    }

    // Pointer leave - clear hover effect when leaving canvas
    function onPointerLeave(event) {
        // Clear hover effect
        if (hoveredObject && !selectedObjects.includes(hoveredObject) && hoveredObject !== selectedObject) {
            if (originalMaterials.has(hoveredObject)) {
                hoveredObject.material = originalMaterials.get(hoveredObject);
                hoveredObject.material.needsUpdate = true;
            }
        }
        hoveredObject = null;
    }

    // Pointer up - complete selection
    function onPointerUp(event) {
        if (!dragStart) return;

        const clickDuration = Date.now() - pointerDownTime;

        if (isDragging && clickDuration > 100) {
            // Box selection mode
            performBoxSelection(event.ctrlKey || event.metaKey);
        } else {
            // Click selection mode
            performClickSelection(event);
        }

        // Clean up
        isDragging = false;
        dragStart = null;
        dragCurrent = null;
        if (selectionBox) {
            selectionBox.style.display = 'none';
        }

        // ▼▼▼ [추가] 미리보기 하이라이트 정리 ▼▼▼
        previewHighlightedObjects.forEach(obj => {
            if (!selectedObjects.includes(obj) && obj !== selectedObject) {
                if (originalMaterials.has(obj)) {
                    obj.material = originalMaterials.get(obj);
                    obj.material.needsUpdate = true;
                }
            }
        });
        previewHighlightedObjects = [];
        // ▲▲▲ [추가] 여기까지 ▲▲▲
    }

    // Update selection box UI during drag
    function updateSelectionBoxUI() {
        if (!selectionBox || !dragStart || !dragCurrent) return;

        const left = Math.min(dragStart.x, dragCurrent.x);
        const top = Math.min(dragStart.y, dragCurrent.y);
        const width = Math.abs(dragCurrent.x - dragStart.x);
        const height = Math.abs(dragCurrent.y - dragStart.y);

        // ▼▼▼ [추가] 드래그 방향에 따라 스타일 변경 ▼▼▼
        const isLeftToRight = dragCurrent.x >= dragStart.x;

        if (isLeftToRight) {
            // Window mode: 실선, 파란색
            selectionBox.style.border = '2px solid #2196F3';
            selectionBox.style.backgroundColor = 'rgba(33, 150, 243, 0.1)';
        } else {
            // Crossing mode: 점선, 녹색
            selectionBox.style.border = '2px dashed #4CAF50';
            selectionBox.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        }
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
        selectionBox.style.display = 'block';

        // ▼▼▼ [추가] 실시간 미리보기 하이라이트 ▼▼▼
        updateBoxSelectionPreview(isLeftToRight);
        // ▲▲▲ [추가] 여기까지 ▲▲▲
    }

    // ▼▼▼ [추가] 실시간 미리보기 하이라이트 ▼▼▼
    function updateBoxSelectionPreview(isWindowMode) {
        if (!scene || !camera || !dragStart || !dragCurrent) return;

        const canvas = document.getElementById('three-d-canvas');
        const rect = canvas.getBoundingClientRect();

        // Selection box bounds (선택 박스 좌표)
        const selMinX = Math.min(dragStart.x, dragCurrent.x);
        const selMaxX = Math.max(dragStart.x, dragCurrent.x);
        const selMinY = Math.min(dragStart.y, dragCurrent.y);
        const selMaxY = Math.max(dragStart.y, dragCurrent.y);

        // Clear previous preview highlights
        previewHighlightedObjects.forEach(obj => {
            if (!selectedObjects.includes(obj) && obj !== selectedObject) {
                if (originalMaterials.has(obj)) {
                    obj.material = originalMaterials.get(obj);
                    obj.material.needsUpdate = true;
                }
            }
        });
        previewHighlightedObjects = [];

        // Get all visible BIM meshes
        const bimMeshes = [];
        scene.traverse(function(object) {
            if (object instanceof THREE.Mesh && object.userData &&
                (object.userData.bimObjectId || object.userData.isSplitPart || object.userData.isSplitElement) &&
                object.visible) {
                bimMeshes.push(object);
            }
        });

        // Find objects that would be selected
        bimMeshes.forEach(mesh => {
            if (selectedObjects.includes(mesh) || mesh === selectedObject) return;

            if (!mesh.geometry.boundingBox) {
                mesh.geometry.computeBoundingBox();
            }

            const bbox = mesh.geometry.boundingBox;
            if (!bbox) return;

            // ▼▼▼ [수정] 더 촘촘한 샘플링: 각 모서리에 3개 포인트 추가 ▼▼▼
            const bboxMinX = bbox.min.x, bboxMinY = bbox.min.y, bboxMinZ = bbox.min.z;
            const bboxMaxX = bbox.max.x, bboxMaxY = bbox.max.y, bboxMaxZ = bbox.max.z;
            const bboxMidX = (bboxMinX + bboxMaxX) / 2;
            const bboxMidY = (bboxMinY + bboxMaxY) / 2;
            const bboxMidZ = (bboxMinZ + bboxMaxZ) / 2;

            // 각 축의 1/4, 3/4 지점 추가 (더 촘촘한 샘플링)
            const bboxQ1X = bboxMinX + (bboxMaxX - bboxMinX) * 0.25;
            const bboxQ3X = bboxMinX + (bboxMaxX - bboxMinX) * 0.75;
            const bboxQ1Y = bboxMinY + (bboxMaxY - bboxMinY) * 0.25;
            const bboxQ3Y = bboxMinY + (bboxMaxY - bboxMinY) * 0.75;
            const bboxQ1Z = bboxMinZ + (bboxMaxZ - bboxMinZ) * 0.25;
            const bboxQ3Z = bboxMinZ + (bboxMaxZ - bboxMinZ) * 0.75;

            const samplePoints = [
                // 8 corners (꼭짓점)
                new THREE.Vector3(bboxMinX, bboxMinY, bboxMinZ),
                new THREE.Vector3(bboxMaxX, bboxMinY, bboxMinZ),
                new THREE.Vector3(bboxMinX, bboxMaxY, bboxMinZ),
                new THREE.Vector3(bboxMaxX, bboxMaxY, bboxMinZ),
                new THREE.Vector3(bboxMinX, bboxMinY, bboxMaxZ),
                new THREE.Vector3(bboxMaxX, bboxMinY, bboxMaxZ),
                new THREE.Vector3(bboxMinX, bboxMaxY, bboxMaxZ),
                new THREE.Vector3(bboxMaxX, bboxMaxY, bboxMaxZ),

                // 12 edge midpoints (모서리 중점)
                new THREE.Vector3(bboxMidX, bboxMinY, bboxMinZ),
                new THREE.Vector3(bboxMidX, bboxMaxY, bboxMinZ),
                new THREE.Vector3(bboxMidX, bboxMinY, bboxMaxZ),
                new THREE.Vector3(bboxMidX, bboxMaxY, bboxMaxZ),
                new THREE.Vector3(bboxMinX, bboxMidY, bboxMinZ),
                new THREE.Vector3(bboxMaxX, bboxMidY, bboxMinZ),
                new THREE.Vector3(bboxMinX, bboxMidY, bboxMaxZ),
                new THREE.Vector3(bboxMaxX, bboxMidY, bboxMaxZ),
                new THREE.Vector3(bboxMinX, bboxMinY, bboxMidZ),
                new THREE.Vector3(bboxMaxX, bboxMinY, bboxMidZ),
                new THREE.Vector3(bboxMinX, bboxMaxY, bboxMidZ),
                new THREE.Vector3(bboxMaxX, bboxMaxY, bboxMidZ),

                // 6 face centers (면 중심점)
                new THREE.Vector3(bboxMidX, bboxMidY, bboxMinZ),
                new THREE.Vector3(bboxMidX, bboxMidY, bboxMaxZ),
                new THREE.Vector3(bboxMinX, bboxMidY, bboxMidZ),
                new THREE.Vector3(bboxMaxX, bboxMidY, bboxMidZ),
                new THREE.Vector3(bboxMidX, bboxMinY, bboxMidZ),
                new THREE.Vector3(bboxMidX, bboxMaxY, bboxMidZ),

                // 24 quarter points on edges (모서리 1/4, 3/4 지점 - 더 촘촘)
                new THREE.Vector3(bboxQ1X, bboxMinY, bboxMinZ), new THREE.Vector3(bboxQ3X, bboxMinY, bboxMinZ),
                new THREE.Vector3(bboxQ1X, bboxMaxY, bboxMinZ), new THREE.Vector3(bboxQ3X, bboxMaxY, bboxMinZ),
                new THREE.Vector3(bboxQ1X, bboxMinY, bboxMaxZ), new THREE.Vector3(bboxQ3X, bboxMinY, bboxMaxZ),
                new THREE.Vector3(bboxQ1X, bboxMaxY, bboxMaxZ), new THREE.Vector3(bboxQ3X, bboxMaxY, bboxMaxZ),
                new THREE.Vector3(bboxMinX, bboxQ1Y, bboxMinZ), new THREE.Vector3(bboxMinX, bboxQ3Y, bboxMinZ),
                new THREE.Vector3(bboxMaxX, bboxQ1Y, bboxMinZ), new THREE.Vector3(bboxMaxX, bboxQ3Y, bboxMinZ),
                new THREE.Vector3(bboxMinX, bboxQ1Y, bboxMaxZ), new THREE.Vector3(bboxMinX, bboxQ3Y, bboxMaxZ),
                new THREE.Vector3(bboxMaxX, bboxQ1Y, bboxMaxZ), new THREE.Vector3(bboxMaxX, bboxQ3Y, bboxMaxZ),
                new THREE.Vector3(bboxMinX, bboxMinY, bboxQ1Z), new THREE.Vector3(bboxMinX, bboxMinY, bboxQ3Z),
                new THREE.Vector3(bboxMaxX, bboxMinY, bboxQ1Z), new THREE.Vector3(bboxMaxX, bboxMinY, bboxQ3Z),
                new THREE.Vector3(bboxMinX, bboxMaxY, bboxQ1Z), new THREE.Vector3(bboxMinX, bboxMaxY, bboxQ3Z),
                new THREE.Vector3(bboxMaxX, bboxMaxY, bboxQ1Z), new THREE.Vector3(bboxMaxX, bboxMaxY, bboxQ3Z)
            ];
            // ▲▲▲ [수정] 여기까지 (총 50개 샘플 포인트) ▲▲▲

            // ▼▼▼ [수정] 샘플 포인트 검사로 변경 ▼▼▼
            let pointsInBox = 0;
            let cornersInBox = 0;  // 8개 꼭짓점만 카운트
            let allBehindCamera = true;

            for (let i = 0; i < samplePoints.length; i++) {
                const point = samplePoints[i];
                const worldPoint = point.clone().applyMatrix4(mesh.matrixWorld);
                const screenPos = worldPoint.clone().project(camera);

                if (screenPos.z < 1 && screenPos.z > -1) {
                    allBehindCamera = false;

                    const x = (screenPos.x * 0.5 + 0.5) * rect.width;
                    const y = ((-screenPos.y) * 0.5 + 0.5) * rect.height;

                    if (x >= selMinX && x <= selMaxX && y >= selMinY && y <= selMaxY) {
                        pointsInBox++;
                        if (i < 8) {  // First 8 are corners
                            cornersInBox++;
                        }
                    }
                }
            }

            // Determine if object should be highlighted
            let shouldHighlight = false;
            if (!allBehindCamera) {
                if (isWindowMode) {
                    // Window mode (왼쪽→오른쪽): 모든 꼭짓점이 박스 안에 있어야 함
                    shouldHighlight = (cornersInBox === 8);
                } else {
                    // Crossing mode (오른쪽→왼쪽): 어떤 샘플 포인트라도 걸치면 선택
                    shouldHighlight = (pointsInBox > 0);
                }
            }
            // ▲▲▲ [수정] 여기까지 ▲▲▲

            if (shouldHighlight) {
                if (!originalMaterials.has(mesh)) {
                    originalMaterials.set(mesh, mesh.material);
                }

                // Preview highlight - cyan
                const previewMaterial = new THREE.MeshStandardMaterial({
                    color: 0x4dd0e1,
                    emissive: 0x00bcd4,
                    emissiveIntensity: 0.3,
                    metalness: 0.0,
                    roughness: 1.0,
                    flatShading: true,
                    transparent: true,
                    opacity: 0.6,
                    side: THREE.DoubleSide
                });

                mesh.material = previewMaterial;
                mesh.material.needsUpdate = true;
                previewHighlightedObjects.push(mesh);
            }
        });
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // Perform box selection
    function performBoxSelection(isAdditive) {
        if (!dragStart || !dragCurrent) return;

        // ▼▼▼ [수정] 드래그 방향 감지 ▼▼▼
        const isWindowMode = dragCurrent.x >= dragStart.x;  // 왼쪽→오른쪽 = Window mode
        console.log('[3D Viewer] Performing box selection, mode:', isWindowMode ? 'Window' : 'Crossing', 'additive:', isAdditive);
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        const canvas = document.getElementById('three-d-canvas');
        const rect = canvas.getBoundingClientRect();

        // Get selection box bounds (선택 박스 좌표)
        const selMinX = Math.min(dragStart.x, dragCurrent.x);
        const selMaxX = Math.max(dragStart.x, dragCurrent.x);
        const selMinY = Math.min(dragStart.y, dragCurrent.y);
        const selMaxY = Math.max(dragStart.y, dragCurrent.y);

        // ▼▼▼ [수정] 화면에 보이고 visible한 BIM 메시만 가져오기 ▼▼▼
        const bimMeshes = [];
        scene.traverse(function(object) {
            if (object instanceof THREE.Mesh && object.userData &&
                (object.userData.bimObjectId || object.userData.isSplitPart || object.userData.isSplitElement) &&
                object.visible) {  // Only visible objects
                bimMeshes.push(object);
            }
        });

        // ▼▼▼ [수정] Window/Crossing 모드에 따른 선택 로직 ▼▼▼
        const objectsInBox = [];
        bimMeshes.forEach(mesh => {
            // Compute bounding box if not already computed
            if (!mesh.geometry.boundingBox) {
                mesh.geometry.computeBoundingBox();
            }

            const bbox = mesh.geometry.boundingBox;
            if (!bbox) return;

            // ▼▼▼ [수정] 더 촘촘한 샘플링: 각 모서리에 3개 포인트 추가 ▼▼▼
            const bboxMinX = bbox.min.x, bboxMinY = bbox.min.y, bboxMinZ = bbox.min.z;
            const bboxMaxX = bbox.max.x, bboxMaxY = bbox.max.y, bboxMaxZ = bbox.max.z;
            const bboxMidX = (bboxMinX + bboxMaxX) / 2;
            const bboxMidY = (bboxMinY + bboxMaxY) / 2;
            const bboxMidZ = (bboxMinZ + bboxMaxZ) / 2;

            // 각 축의 1/4, 3/4 지점 추가 (더 촘촘한 샘플링)
            const bboxQ1X = bboxMinX + (bboxMaxX - bboxMinX) * 0.25;
            const bboxQ3X = bboxMinX + (bboxMaxX - bboxMinX) * 0.75;
            const bboxQ1Y = bboxMinY + (bboxMaxY - bboxMinY) * 0.25;
            const bboxQ3Y = bboxMinY + (bboxMaxY - bboxMinY) * 0.75;
            const bboxQ1Z = bboxMinZ + (bboxMaxZ - bboxMinZ) * 0.25;
            const bboxQ3Z = bboxMinZ + (bboxMaxZ - bboxMinZ) * 0.75;

            const samplePoints = [
                // 8 corners (꼭짓점)
                new THREE.Vector3(bboxMinX, bboxMinY, bboxMinZ),
                new THREE.Vector3(bboxMaxX, bboxMinY, bboxMinZ),
                new THREE.Vector3(bboxMinX, bboxMaxY, bboxMinZ),
                new THREE.Vector3(bboxMaxX, bboxMaxY, bboxMinZ),
                new THREE.Vector3(bboxMinX, bboxMinY, bboxMaxZ),
                new THREE.Vector3(bboxMaxX, bboxMinY, bboxMaxZ),
                new THREE.Vector3(bboxMinX, bboxMaxY, bboxMaxZ),
                new THREE.Vector3(bboxMaxX, bboxMaxY, bboxMaxZ),

                // 12 edge midpoints (모서리 중점)
                new THREE.Vector3(bboxMidX, bboxMinY, bboxMinZ),
                new THREE.Vector3(bboxMidX, bboxMaxY, bboxMinZ),
                new THREE.Vector3(bboxMidX, bboxMinY, bboxMaxZ),
                new THREE.Vector3(bboxMidX, bboxMaxY, bboxMaxZ),
                new THREE.Vector3(bboxMinX, bboxMidY, bboxMinZ),
                new THREE.Vector3(bboxMaxX, bboxMidY, bboxMinZ),
                new THREE.Vector3(bboxMinX, bboxMidY, bboxMaxZ),
                new THREE.Vector3(bboxMaxX, bboxMidY, bboxMaxZ),
                new THREE.Vector3(bboxMinX, bboxMinY, bboxMidZ),
                new THREE.Vector3(bboxMaxX, bboxMinY, bboxMidZ),
                new THREE.Vector3(bboxMinX, bboxMaxY, bboxMidZ),
                new THREE.Vector3(bboxMaxX, bboxMaxY, bboxMidZ),

                // 6 face centers (면 중심점)
                new THREE.Vector3(bboxMidX, bboxMidY, bboxMinZ),
                new THREE.Vector3(bboxMidX, bboxMidY, bboxMaxZ),
                new THREE.Vector3(bboxMinX, bboxMidY, bboxMidZ),
                new THREE.Vector3(bboxMaxX, bboxMidY, bboxMidZ),
                new THREE.Vector3(bboxMidX, bboxMinY, bboxMidZ),
                new THREE.Vector3(bboxMidX, bboxMaxY, bboxMidZ),

                // 24 quarter points on edges (모서리 1/4, 3/4 지점 - 더 촘촘)
                new THREE.Vector3(bboxQ1X, bboxMinY, bboxMinZ), new THREE.Vector3(bboxQ3X, bboxMinY, bboxMinZ),
                new THREE.Vector3(bboxQ1X, bboxMaxY, bboxMinZ), new THREE.Vector3(bboxQ3X, bboxMaxY, bboxMinZ),
                new THREE.Vector3(bboxQ1X, bboxMinY, bboxMaxZ), new THREE.Vector3(bboxQ3X, bboxMinY, bboxMaxZ),
                new THREE.Vector3(bboxQ1X, bboxMaxY, bboxMaxZ), new THREE.Vector3(bboxQ3X, bboxMaxY, bboxMaxZ),
                new THREE.Vector3(bboxMinX, bboxQ1Y, bboxMinZ), new THREE.Vector3(bboxMinX, bboxQ3Y, bboxMinZ),
                new THREE.Vector3(bboxMaxX, bboxQ1Y, bboxMinZ), new THREE.Vector3(bboxMaxX, bboxQ3Y, bboxMinZ),
                new THREE.Vector3(bboxMinX, bboxQ1Y, bboxMaxZ), new THREE.Vector3(bboxMinX, bboxQ3Y, bboxMaxZ),
                new THREE.Vector3(bboxMaxX, bboxQ1Y, bboxMaxZ), new THREE.Vector3(bboxMaxX, bboxQ3Y, bboxMaxZ),
                new THREE.Vector3(bboxMinX, bboxMinY, bboxQ1Z), new THREE.Vector3(bboxMinX, bboxMinY, bboxQ3Z),
                new THREE.Vector3(bboxMaxX, bboxMinY, bboxQ1Z), new THREE.Vector3(bboxMaxX, bboxMinY, bboxQ3Z),
                new THREE.Vector3(bboxMinX, bboxMaxY, bboxQ1Z), new THREE.Vector3(bboxMinX, bboxMaxY, bboxQ3Z),
                new THREE.Vector3(bboxMaxX, bboxMaxY, bboxQ1Z), new THREE.Vector3(bboxMaxX, bboxMaxY, bboxQ3Z)
            ];
            // ▲▲▲ [수정] 여기까지 (총 50개 샘플 포인트) ▲▲▲

            // ▼▼▼ [수정] 샘플 포인트 검사로 변경 ▼▼▼
            let pointsInBox = 0;
            let cornersInBox = 0;  // 8개 꼭짓점만 카운트
            let allBehindCamera = true;

            for (let i = 0; i < samplePoints.length; i++) {
                const point = samplePoints[i];

                // Transform to world coordinates
                const worldPoint = point.clone().applyMatrix4(mesh.matrixWorld);

                // Project to screen space
                const screenPos = worldPoint.clone().project(camera);

                // Check if in front of camera
                if (screenPos.z < 1 && screenPos.z > -1) {
                    allBehindCamera = false;

                    // Convert to canvas coordinates
                    const x = (screenPos.x * 0.5 + 0.5) * rect.width;
                    const y = ((-screenPos.y) * 0.5 + 0.5) * rect.height;

                    // Check if this point is within selection box
                    if (x >= selMinX && x <= selMaxX && y >= selMinY && y <= selMaxY) {
                        pointsInBox++;
                        if (i < 8) {  // First 8 are corners
                            cornersInBox++;
                        }
                    }
                }
            }

            // Determine selection based on mode
            let shouldSelect = false;
            if (!allBehindCamera) {
                if (isWindowMode) {
                    // Window mode (왼쪽→오른쪽): 모든 꼭짓점이 박스 안에 있어야 함
                    shouldSelect = (cornersInBox === 8);
                } else {
                    // Crossing mode (오른쪽→왼쪽): 어떤 샘플 포인트라도 걸치면 선택
                    shouldSelect = (pointsInBox > 0);
                }
            }
            // ▲▲▲ [수정] 여기까지 ▲▲▲

            if (shouldSelect) {
                objectsInBox.push(mesh);
            }
        });
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        console.log(`[3D Viewer] Found ${objectsInBox.length} objects in selection box`);

        if (objectsInBox.length > 0) {
            if (isAdditive) {
                // Add to existing selection
                toggleMultipleObjects(objectsInBox);
            } else {
                // Replace selection
                selectMultipleObjects(objectsInBox);
            }
            showToast(`${objectsInBox.length}개 객체 선택됨`, 'success');
        } else {
            if (!isAdditive) {
                deselectAllObjects();
            }
        }
    }

    // Perform click selection (existing logic)
    function performClickSelection(event) {
        const canvas = document.getElementById('three-d-canvas');
        const rect = canvas.getBoundingClientRect();

        // Calculate mouse position in normalized device coordinates (-1 to +1)
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update raycaster
        raycaster.setFromCamera(mouse, camera);

        // ▼▼▼ [수정] 화면에 보이는 BIM 메시만 가져오기 ▼▼▼
        const bimMeshes = [];
        scene.traverse(function(object) {
            // Include both original BIM objects and split parts (isSplitPart from runtime split, isSplitElement from DB)
            // Only include visible objects
            if (object instanceof THREE.Mesh && object.userData &&
                (object.userData.bimObjectId || object.userData.isSplitPart || object.userData.isSplitElement) &&
                object.visible) {  // Only visible objects
                bimMeshes.push(object);
            }
        });
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // Check for intersections (recursive to include edge lines)
        const intersects = raycaster.intersectObjects(bimMeshes, true);

        if (intersects.length > 0) {
            // Check if clicking at the same position (for cycling through overlapping objects)
            const currentClickPos = new THREE.Vector2(mouse.x, mouse.y);
            const isSamePosition = lastClickPosition &&
                                  currentClickPos.distanceTo(lastClickPosition) < 0.01; // Small threshold

            if (isSamePosition && lastIntersects.length > 1) {
                // Cycle to next object at same position
                currentIntersectIndex = (currentIntersectIndex + 1) % lastIntersects.length;
                console.log(`[3D Viewer] Cycling through overlapping objects: ${currentIntersectIndex + 1}/${lastIntersects.length}`);
                showToast(`겹친 객체 ${currentIntersectIndex + 1}/${lastIntersects.length} 선택`, 'info');
            } else {
                // New position - reset cycle
                lastClickPosition = currentClickPos.clone();

                // Filter and deduplicate intersects
                const seenMeshes = new Set();
                lastIntersects = [];

                for (let i = 0; i < intersects.length; i++) {
                    let intersect = intersects[i];
                    let obj = intersect.object;

                    // Get parent if it's a LineSegments (edge line)
                    if (obj instanceof THREE.LineSegments && obj.parent) {
                        obj = obj.parent;
                    }

                    // ▼▼▼ [수정] DB에서 로드한 분할 객체(isSplitElement)도 포함 ▼▼▼
                    // Only include valid meshes
                    if (!(obj instanceof THREE.Mesh && obj.userData &&
                          (obj.userData.bimObjectId || obj.userData.isSplitPart || obj.userData.isSplitElement))) {
                        continue;
                    }
                    // ▲▲▲ [수정] 여기까지 ▲▲▲

                    // Deduplicate: skip if we've already seen this mesh
                    const meshId = obj.uuid;
                    if (seenMeshes.has(meshId)) {
                        continue;
                    }

                    seenMeshes.add(meshId);

                    // Create new intersect with corrected object reference
                    lastIntersects.push({
                        ...intersect,
                        object: obj  // Replace with parent mesh if it was a LineSegments
                    });
                }

                currentIntersectIndex = 0;

                if (lastIntersects.length > 1) {
                    console.log(`[3D Viewer] Found ${lastIntersects.length} overlapping objects. Click again to cycle.`);
                    showToast(`${lastIntersects.length}개의 객체가 겹쳐있습니다. 다시 클릭하여 전환`, 'info');
                }
            }

            // Get the selected intersection
            const selectedIntersect = lastIntersects[currentIntersectIndex];
            if (!selectedIntersect) {
                console.warn('[3D Viewer] No valid intersection found');
                deselectObject();
                return;
            }

            let clickedObject = selectedIntersect.object;

            // If clicked on edge line (LineSegments), get parent mesh
            if (clickedObject instanceof THREE.LineSegments) {
                clickedObject = clickedObject.parent;
                console.log('[3D Viewer] Clicked on edge line, selecting parent mesh');
            }

            // ▼▼▼ [수정] DB에서 로드한 분할 객체(isSplitElement)도 포함 ▼▼▼
            // Verify we have a valid mesh with userData
            if (clickedObject instanceof THREE.Mesh && clickedObject.userData &&
                (clickedObject.userData.bimObjectId || clickedObject.userData.isSplitPart || clickedObject.userData.isSplitElement)) {

                // Check if we're in face selection mode
                if (faceSelectionMode) {
                    handleFaceSelection(selectedIntersect, clickedObject);
                } else {
                    // ▼▼▼ [추가] Ctrl+클릭으로 복수 선택 지원 ▼▼▼
                    const isCtrlKey = event.ctrlKey || event.metaKey;
                    if (isCtrlKey) {
                        // Toggle this object in multi-selection
                        toggleSingleObject(clickedObject);
                    } else {
                        // Normal click - single selection
                        selectObject(clickedObject);
                    }
                    // ▲▲▲ [추가] 여기까지 ▲▲▲
                }
            } else {
                console.warn('[3D Viewer] Clicked object is not a valid BIM mesh:', clickedObject);
                deselectObject();
            }
            // ▲▲▲ [수정] 여기까지 ▲▲▲
        } else {
            // Clicked on empty space
            lastClickPosition = null;
            lastIntersects = [];
            currentIntersectIndex = 0;
            // ▼▼▼ [수정] Ctrl+클릭이 아닌 경우에만 선택 해제 ▼▼▼
            const isCtrlKey = event.ctrlKey || event.metaKey;
            if (!isCtrlKey) {
                deselectAllObjects();
            }
            // ▲▲▲ [수정] 여기까지 ▲▲▲
        }
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // Select an object
    // ▼▼▼ [추가] 선택된 객체의 중심으로 회전 피벗 설정 ▼▼▼
    function updateOrbitTarget() {
        if (!controls) return;

        // 선택된 객체들의 중심 계산
        let targetObjects = selectedObjects.length > 0 ? selectedObjects : (selectedObject ? [selectedObject] : []);

        if (targetObjects.length === 0) return;

        // 모든 선택된 객체의 중심점들을 합산
        let centerSum = new THREE.Vector3(0, 0, 0);
        targetObjects.forEach(obj => {
            const center = new THREE.Vector3();

            // Bounding box를 계산하여 중심점 가져오기
            if (!obj.geometry.boundingBox) {
                obj.geometry.computeBoundingBox();
            }

            const bbox = obj.geometry.boundingBox;
            if (bbox) {
                center.x = (bbox.min.x + bbox.max.x) / 2;
                center.y = (bbox.min.y + bbox.max.y) / 2;
                center.z = (bbox.min.z + bbox.max.z) / 2;

                // World 좌표로 변환
                center.applyMatrix4(obj.matrixWorld);
            }

            centerSum.add(center);
        });

        // 평균 중심점 계산
        centerSum.divideScalar(targetObjects.length);

        // OrbitControls의 target 업데이트 (화면은 그대로, 회전 중심만 변경)
        controls.target.copy(centerSum);
        // ⚠️ controls.update()를 호출하지 않음 - 화면 이동 방지
        // target만 변경하면 다음 회전 시 해당 점을 중심으로 회전

        console.log('[3D Viewer] Orbit pivot updated to:', centerSum);
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    function selectObject(object) {
        // Deselect previous object
        if (selectedObject) {
            deselectObject();
        }

        selectedObject = object;

        // ▼▼▼ [추가] 새 객체 선택 시 재시도 카운트 초기화 ▼▼▼
        displayCostItemsRetryCount.delete(object);
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        // Store original material
        if (!originalMaterials.has(object)) {
            originalMaterials.set(object, object.material);
        }

        // Create new highlight material - orange semi-transparent
        const highlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xff8800,           // Orange
            emissive: 0xff6600,        // Orange glow
            emissiveIntensity: 0.5,
            metalness: 0.0,
            roughness: 1.0,
            flatShading: true,         // Flat shading to match original objects
            transparent: true,
            opacity: 0.7,              // Semi-transparent
            side: THREE.DoubleSide
        });

        object.material = highlightMaterial;
        object.material.needsUpdate = true;

        // ▼▼▼ [수정] 분할 객체와 BIM 원본 모두 처리 ▼▼▼
        const objectId = object.userData.bimObjectId || object.userData.splitId || object.userData.rawElementId;
        console.log("[3D Viewer] Object selected:", objectId);
        // ▲▲▲ [수정] 여기까지 ▲▲▲
        console.log("[3D Viewer] Highlight material applied:", {
            color: highlightMaterial.color,
            opacity: highlightMaterial.opacity,
            transparent: highlightMaterial.transparent
        });

        // ▼▼▼ [수정] 모든 객체에 대해 분할 버튼 활성화 ▼▼▼
        const isSplitObject = object.userData.isSplitPart || object.userData.isSplitElement;

        const splitBtn = document.getElementById('split-object-btn');
        if (splitBtn) {
            splitBtn.disabled = false;  // 모든 객체 분할 가능
            if (isSplitObject) {
                splitBtn.title = "분할된 객체 재분할 (중첩 분할)";
            } else {
                splitBtn.title = "객체 분할";
            }
        }

        const sketchSplitBtn = document.getElementById('sketch-split-btn');
        if (sketchSplitBtn) {
            sketchSplitBtn.disabled = false;  // 모든 객체 분할 가능
            if (isSplitObject) {
                sketchSplitBtn.title = "분할된 객체 스케치 재분할 (중첩 분할)";
            } else {
                sketchSplitBtn.title = "스케치로 분할";
            }
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // Display properties
        displayObjectProperties(object);

        // Display quantity members
        displayQuantityMembers(object);

        // Display cost items
        displayCostItems(object);

        // Display volume information if available (for split objects)
        if (object.userData.geometryVolume !== undefined) {
            console.log('[3D Viewer] === Volume Information ===');
            console.log('  - Geometry Volume:', object.userData.geometryVolume.toFixed(6), 'cubic units');

            if (object.userData.volumeRatio !== undefined) {
                console.log('  - Volume Ratio:', (object.userData.volumeRatio * 100).toFixed(2) + '%');
            }

            if (object.userData.originalGeometryVolume !== undefined) {
                console.log('  - Original BIM Volume:', object.userData.originalGeometryVolume.toFixed(6), 'cubic units');
            }

            // ▼▼▼ [수정] DB에서 로드한 분할 객체(isSplitElement)도 포함 ▼▼▼
            if (object.userData.isSplitPart || object.userData.isSplitElement) {
                console.log('  - Split Part Type:', object.userData.splitPartType);

                if (object.userData.splitMethod) {
                    console.log('  - Split Method:', object.userData.splitMethod);
                }

                if (object.userData.splitAxis) {
                    console.log('  - Split Axis:', object.userData.splitAxis.toUpperCase());
                }

                if (object.userData.splitPosition !== undefined && object.userData.splitPosition !== null) {
                    console.log('  - Split Position:', object.userData.splitPosition.toFixed(2));
                }
            }
            // ▲▲▲ [수정] 여기까지 ▲▲▲
            console.log('[3D Viewer] =======================');
        }

        // Update visibility control buttons
        updateVisibilityControlButtons();

        // ▼▼▼ [추가] 회전 피벗을 선택된 객체 중심으로 설정 ▼▼▼
        updateOrbitTarget();
        // ▲▲▲ [추가] 여기까지 ▲▲▲
    }

    // Deselect current object
    function deselectObject() {
        if (!selectedObject) return;

        // Restore original material
        if (originalMaterials.has(selectedObject)) {
            selectedObject.material = originalMaterials.get(selectedObject);
            selectedObject.material.needsUpdate = true;
        }

        console.log("[3D Viewer] Object deselected");
        selectedObject = null;

        // Disable split button
        const splitBtn = document.getElementById('split-object-btn');
        if (splitBtn) {
            splitBtn.disabled = true;
        }

        // Disable sketch split button
        const sketchSplitBtn = document.getElementById('sketch-split-btn');
        if (sketchSplitBtn) {
            sketchSplitBtn.disabled = true;
        }

        // Clear properties panel
        clearPropertiesPanel();

        // Clear quantity members
        clearQuantityMembersPanel();

        // Clear cost items
        clearCostItemsPanel();

        // Update visibility control buttons
        updateVisibilityControlButtons();
    }

    // ▼▼▼ [추가] 복수 선택 함수들 ▼▼▼
    /**
     * Select multiple objects at once
     * @param {Array} objects - Array of THREE.Mesh objects to select
     */
    function selectMultipleObjects(objects) {
        // Deselect all previous selections
        deselectAllObjects();

        if (!objects || objects.length === 0) {
            console.log("[3D Viewer] No objects to select");
            return;
        }

        console.log(`[3D Viewer] Selecting ${objects.length} objects`);

        // Select each object
        selectedObjects = [];
        objects.forEach(object => {
            // Store original material
            if (!originalMaterials.has(object)) {
                originalMaterials.set(object, object.material);
            }

            // Create new highlight material - orange semi-transparent
            const highlightMaterial = new THREE.MeshStandardMaterial({
                color: 0xff8800,           // Orange
                emissive: 0xff6600,        // Orange glow
                emissiveIntensity: 0.5,
                metalness: 0.0,
                roughness: 1.0,
                flatShading: true,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            });

            object.material = highlightMaterial;
            object.material.needsUpdate = true;

            selectedObjects.push(object);
        });

        // Set first object as the primary selectedObject for backwards compatibility
        if (selectedObjects.length > 0) {
            selectedObject = selectedObjects[0];

            // Display properties for first object
            displayObjectProperties(selectedObject);
            displayQuantityMembers(selectedObject);
            displayCostItems(selectedObject);
        }

        // Update visibility control buttons
        updateVisibilityControlButtons();

        console.log("[3D Viewer] Multiple selection complete");
    }

    /**
     * Deselect all selected objects
     */
    function deselectAllObjects() {
        if (selectedObjects.length === 0 && !selectedObject) return;

        // Deselect all objects in array
        selectedObjects.forEach(object => {
            if (originalMaterials.has(object)) {
                object.material = originalMaterials.get(object);
                object.material.needsUpdate = true;
            }
        });

        // Also deselect single selectedObject if exists
        if (selectedObject && !selectedObjects.includes(selectedObject)) {
            if (originalMaterials.has(selectedObject)) {
                selectedObject.material = originalMaterials.get(selectedObject);
                selectedObject.material.needsUpdate = true;
            }
        }

        console.log(`[3D Viewer] Deselected ${selectedObjects.length} objects`);
        selectedObjects = [];
        selectedObject = null;

        // Disable split buttons
        const splitBtn = document.getElementById('split-object-btn');
        if (splitBtn) splitBtn.disabled = true;

        const sketchSplitBtn = document.getElementById('sketch-split-btn');
        if (sketchSplitBtn) sketchSplitBtn.disabled = true;

        // Clear panels
        clearPropertiesPanel();
        clearQuantityMembersPanel();
        clearCostItemsPanel();

        // Update visibility control buttons
        updateVisibilityControlButtons();
    }

    /**
     * Toggle single object in multi-selection (Ctrl+click)
     * @param {THREE.Mesh} object - Object to toggle
     */
    function toggleSingleObject(object) {
        const index = selectedObjects.indexOf(object);

        if (index >= 0) {
            // Object is already selected - deselect it
            if (originalMaterials.has(object)) {
                object.material = originalMaterials.get(object);
                object.material.needsUpdate = true;
            }
            selectedObjects.splice(index, 1);
            console.log(`[3D Viewer] Removed object from selection, ${selectedObjects.length} remaining`);
        } else {
            // Object is not selected - add it
            if (!originalMaterials.has(object)) {
                originalMaterials.set(object, object.material);
            }

            const highlightMaterial = new THREE.MeshStandardMaterial({
                color: 0xff8800,
                emissive: 0xff6600,
                emissiveIntensity: 0.5,
                metalness: 0.0,
                roughness: 1.0,
                flatShading: true,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            });

            object.material = highlightMaterial;
            object.material.needsUpdate = true;
            selectedObjects.push(object);
            console.log(`[3D Viewer] Added object to selection, ${selectedObjects.length} total`);
        }

        // Update selectedObject reference
        if (selectedObjects.length > 0) {
            selectedObject = selectedObjects[0];
            displayObjectProperties(selectedObject);
            displayQuantityMembers(selectedObject);
            displayCostItems(selectedObject);
        } else {
            selectedObject = null;
            clearPropertiesPanel();
            clearQuantityMembersPanel();
            clearCostItemsPanel();
        }

        updateVisibilityControlButtons();
        showToast(`${selectedObjects.length}개 객체 선택됨`, 'info');

        // ▼▼▼ [추가] 회전 피벗을 선택된 객체 중심으로 설정 ▼▼▼
        updateOrbitTarget();
        // ▲▲▲ [추가] 여기까지 ▲▲▲
    }

    /**
     * Toggle multiple objects in selection (for box selection with Ctrl)
     * @param {Array} objects - Array of objects to toggle
     */
    function toggleMultipleObjects(objects) {
        if (!objects || objects.length === 0) return;

        objects.forEach(object => {
            const index = selectedObjects.indexOf(object);

            if (index >= 0) {
                // Already selected - deselect
                if (originalMaterials.has(object)) {
                    object.material = originalMaterials.get(object);
                    object.material.needsUpdate = true;
                }
                selectedObjects.splice(index, 1);
            } else {
                // Not selected - add
                if (!originalMaterials.has(object)) {
                    originalMaterials.set(object, object.material);
                }

                const highlightMaterial = new THREE.MeshStandardMaterial({
                    color: 0xff8800,
                    emissive: 0xff6600,
                    emissiveIntensity: 0.5,
                    metalness: 0.0,
                    roughness: 1.0,
                    flatShading: true,
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide
                });

                object.material = highlightMaterial;
                object.material.needsUpdate = true;
                selectedObjects.push(object);
            }
        });

        // Update selectedObject reference
        if (selectedObjects.length > 0) {
            selectedObject = selectedObjects[0];
            displayObjectProperties(selectedObject);
            displayQuantityMembers(selectedObject);
            displayCostItems(selectedObject);
        } else {
            selectedObject = null;
            clearPropertiesPanel();
            clearQuantityMembersPanel();
            clearCostItemsPanel();
        }

        updateVisibilityControlButtons();
        console.log(`[3D Viewer] Toggled ${objects.length} objects, ${selectedObjects.length} total selected`);

        // ▼▼▼ [추가] 회전 피벗을 선택된 객체 중심으로 설정 ▼▼▼
        updateOrbitTarget();
        // ▲▲▲ [추가] 여기까지 ▲▲▲
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // Helper function to recursively render nested objects/arrays
    function renderNestedValue(value, depth = 0) {
        if (value === null || value === undefined) {
            return '<span class="property-value">N/A</span>';
        }

        // For arrays
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '<span class="property-value">[]</span>';
            }

            // If array is too long, show count
            if (value.length > 20) {
                return `<span class="property-value">[Array with ${value.length} items]</span>`;
            }

            let html = '<div class="nested-array" style="margin-left: ' + (depth * 15) + 'px;">';
            value.forEach((item, index) => {
                if (typeof item === 'object' && item !== null) {
                    html += `<div class="property-row"><span class="property-label">[${index}]:</span>`;
                    html += renderNestedValue(item, depth + 1);
                    html += '</div>';
                } else {
                    html += `<div class="property-row"><span class="property-label">[${index}]:</span><span class="property-value">${item}</span></div>`;
                }
            });
            html += '</div>';
            return html;
        }

        // For objects
        if (typeof value === 'object') {
            const keys = Object.keys(value);
            if (keys.length === 0) {
                return '<span class="property-value">{}</span>';
            }

            let html = '<div class="nested-object" style="margin-left: ' + (depth * 15) + 'px;">';
            for (const [key, val] of Object.entries(value)) {
                html += `<div class="property-row"><span class="property-label">${key}:</span>`;
                html += renderNestedValue(val, depth + 1);
                html += '</div>';
            }
            html += '</div>';
            return html;
        }

        // For primitive values
        return `<span class="property-value">${value}</span>`;
    }

    // Display object properties in the panel
    function displayObjectProperties(object) {
        const propertiesContent = document.getElementById('three-d-properties-content');
        if (!propertiesContent) return;

        // ▼▼▼ [수정] DB에서 로드한 분할 객체(rawElementId)도 포함 ▼▼▼
        // Find full BIM object from allRevitData using the stored ID (use originalObjectId for split parts, rawElementId for DB-loaded splits)
        const bimObjectId = object.userData.bimObjectId || object.userData.originalObjectId || object.userData.rawElementId;

        if (!bimObjectId) {
            propertiesContent.innerHTML = '<p class="no-selection">객체 ID를 찾을 수 없습니다</p>';
            return;
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        console.log('[3D Viewer] Looking up BIM object with ID:', bimObjectId);

        const fullBimObject = window.allRevitData.find(obj => obj.id === bimObjectId);
        if (!fullBimObject) {
            console.warn('[3D Viewer] BIM object not found for ID:', bimObjectId);
            propertiesContent.innerHTML = '<p class="no-selection">BIM object not found</p>';
            return;
        }

        console.log('[3D Viewer] Found BIM object:', fullBimObject);
        const rawData = fullBimObject.raw_data;

        let html = '';

        // ▼▼▼ [추가] 복수 선택 시 정보 표시 ▼▼▼
        if (selectedObjects.length > 1) {
            html += '<div class="property-section" style="background-color: #f0f8ff; border-left: 4px solid #4CAF50;">';
            html += '<h4>복수 선택</h4>';
            html += `<div class="property-row"><span class="property-label">선택된 객체 수:</span><span class="property-value">${selectedObjects.length}</span></div>`;
            html += '<p style="margin-top: 10px; color: #666; font-size: 0.9em;">아래는 첫 번째 객체의 속성입니다.</p>';
            html += '</div>';
        }
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        // Basic Information
        html += '<div class="property-section">';
        html += '<h4>Basic Information</h4>';
        html += `<div class="property-row"><span class="property-label">Name:</span><span class="property-value">${rawData.Name || 'N/A'}</span></div>`;
        html += `<div class="property-row"><span class="property-label">IFC Class:</span><span class="property-value">${rawData.IfcClass || 'N/A'}</span></div>`;
        html += `<div class="property-row"><span class="property-label">Element ID:</span><span class="property-value">${rawData.ElementId || 'N/A'}</span></div>`;
        html += `<div class="property-row"><span class="property-label">Unique ID:</span><span class="property-value">${rawData.UniqueId || 'N/A'}</span></div>`;
        html += '</div>';

        // Parameters - with detailed nested rendering
        if (rawData.Parameters && Object.keys(rawData.Parameters).length > 0) {
            html += '<div class="property-section">';
            html += '<h4>Parameters</h4>';
            for (const [key, value] of Object.entries(rawData.Parameters)) {
                // Skip Geometry parameter (too large)
                if (key === 'Geometry') continue;

                html += `<div class="property-row"><span class="property-label">${key}:</span>`;
                html += renderNestedValue(value, 1);
                html += '</div>';
            }
            html += '</div>';
        }

        // Type Parameters - with detailed nested rendering
        if (rawData.TypeParameters && Object.keys(rawData.TypeParameters).length > 0) {
            html += '<div class="property-section">';
            html += '<h4>Type Parameters</h4>';
            for (const [key, value] of Object.entries(rawData.TypeParameters)) {
                html += `<div class="property-row"><span class="property-label">${key}:</span>`;
                html += renderNestedValue(value, 1);
                html += '</div>';
            }
            html += '</div>';
        }

        // Relationships
        html += '<div class="property-section">';
        html += '<h4>Relationships</h4>';
        html += `<div class="property-row"><span class="property-label">Type:</span><span class="property-value">${rawData.RelatingType || 'N/A'}</span></div>`;
        html += `<div class="property-row"><span class="property-label">Container:</span><span class="property-value">${rawData.SpatialContainer || 'N/A'}</span></div>`;
        if (rawData.Aggregates) {
            html += `<div class="property-row"><span class="property-label">Aggregates:</span><span class="property-value">${rawData.Aggregates}</span></div>`;
        }
        if (rawData.Nests) {
            html += `<div class="property-row"><span class="property-label">Nests:</span><span class="property-value">${rawData.Nests}</span></div>`;
        }
        html += '</div>';

        propertiesContent.innerHTML = html;
    }

    // Clear properties panel
    function clearPropertiesPanel() {
        const propertiesContent = document.getElementById('three-d-properties-content');
        if (propertiesContent) {
            propertiesContent.innerHTML = '<p class="no-selection">Click on an object to view its properties</p>';
        }
    }

    // Display quantity members for selected BIM object
    // ▼▼▼ [수정] 전역으로 노출하여 websocket.js에서 접근 가능하도록 ▼▼▼
    function displayQuantityMembers(object) {
        const listContainer = document.getElementById('three-d-quantity-members-list');
        if (!listContainer) return;

        // ▼▼▼ [수정] 분할 객체인 경우 split_element_id로 조회 ▼▼▼
        let quantityMembers = [];

        if (object.userData.splitElementId) {
            // 분할 객체인 경우: split_element_id로 연결된 QuantityMember 조회
            console.log('[3D Viewer] Split object selected, searching by split_element_id:', object.userData.splitElementId);
            quantityMembers = findQuantityMembersBySplitElementId(object.userData.splitElementId);
        } else if (object.userData.isSplitPart || object.userData.isSplitElement) {
            // 분할 객체이지만 splitElementId가 아직 설정되지 않음 (split 직후)
            console.warn('[3D Viewer] Split object but splitElementId not set yet - showing waiting message');
            listContainer.innerHTML = '<p class="no-selection">분할 정보 저장 중...</p>';
            return;
        } else {
            // 원본 BIM 객체인 경우: raw_element_id로 조회
            const bimObjectId = object.userData.bimObjectId || object.userData.rawElementId;
            if (!bimObjectId) {
                listContainer.innerHTML = '<p class="no-selection">객체 ID를 찾을 수 없습니다</p>';
                return;
            }
            console.log('[3D Viewer] Original BIM object selected, searching by raw_element_id:', bimObjectId);
            quantityMembers = findQuantityMembersByRawElementId(bimObjectId);
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        if (quantityMembers.length === 0) {
            listContainer.innerHTML = '<p class="no-selection">연관된 수량산출부재가 없습니다</p>';
            return;
        }

        console.log('[3D Viewer] Found quantity members:', quantityMembers);

        let html = '';
        quantityMembers.forEach((qm, index) => {
            html += `<div class="quantity-member-item" data-qm-id="${qm.id}">`;
            html += `<div class="quantity-member-item-name">${qm.name || 'Unnamed Member'}</div>`;
            html += `<div class="quantity-member-item-info">`;
            html += `ID: ${qm.id}`;
            if (qm.member_mark_name) {
                html += ` | 일람부호: ${qm.member_mark_name}`;
            }
            html += `</div>`;
            html += `</div>`;
        });

        listContainer.innerHTML = html;

        // Add click listeners to quantity member items
        const items = listContainer.querySelectorAll('.quantity-member-item');
        console.log('[3D Viewer] Setting up click listeners for', items.length, 'quantity member items');
        items.forEach(item => {
            item.addEventListener('click', function() {
                console.log('[3D Viewer] Quantity member item clicked');

                // Remove selected class from all items
                items.forEach(i => i.classList.remove('selected'));
                // Add selected class to clicked item
                this.classList.add('selected');

                // Display details
                const qmId = this.getAttribute('data-qm-id');
                console.log('[3D Viewer] Looking for quantity member with ID:', qmId);
                // Compare as string since ID might be a number or string
                const qm = quantityMembers.find(m => m.id.toString() === qmId.toString());
                console.log('[3D Viewer] Found quantity member:', qm);
                if (qm) {
                    displayQuantityMemberDetails(qm);
                } else {
                    console.warn('[3D Viewer] Quantity member not found for ID:', qmId);
                }
            });
        });
    }

    // Find quantity members by split element ID
    function findQuantityMembersBySplitElementId(splitElementId) {
        if (!window.loadedQuantityMembers || !Array.isArray(window.loadedQuantityMembers)) {
            console.warn('[3D Viewer] loadedQuantityMembers not found in global scope');
            return [];
        }

        console.log('[3D Viewer] Searching for quantity members with split_element_id:', splitElementId);

        if (!splitElementId) {
            console.warn('[3D Viewer] splitElementId is null or undefined');
            return [];
        }

        // is_active=True이고 split_element_id가 일치하는 QuantityMember 조회
        const results = window.loadedQuantityMembers.filter(qm => {
            return qm.split_element_id &&
                   qm.split_element_id.toString() === splitElementId.toString() &&
                   qm.is_active === true;
        });

        console.log('[3D Viewer] Found matching quantity members for split:', results);
        return results;
    }

    // Find quantity members by raw element ID
    function findQuantityMembersByRawElementId(rawElementId) {
        // Check if loadedQuantityMembers exists in global scope
        if (!window.loadedQuantityMembers || !Array.isArray(window.loadedQuantityMembers)) {
            console.warn('[3D Viewer] loadedQuantityMembers not found in global scope');
            return [];
        }

        console.log('[3D Viewer] Searching for quantity members with raw_element_id:', rawElementId);
        console.log('[3D Viewer] Total quantity members:', window.loadedQuantityMembers.length);

        // Validate rawElementId
        if (!rawElementId) {
            console.warn('[3D Viewer] rawElementId is null or undefined');
            return [];
        }

        // ▼▼▼ [수정] is_active=True 조건만 사용 (split_element_id 조건 제거) ▼▼▼
        // 원본이 분할되면 is_active=False로 자동 변경되므로 split_element_id 체크 불필요
        const results = window.loadedQuantityMembers.filter(qm => {
            const match = qm.raw_element_id &&
                          qm.raw_element_id.toString() === rawElementId.toString() &&
                          qm.is_active === true;

            // 디버깅: 필터링 과정 출력
            if (qm.raw_element_id && qm.raw_element_id.toString() === rawElementId.toString()) {
                console.log('[3D Viewer] QM found with matching raw_element_id:', {
                    id: qm.id,
                    name: qm.name,
                    is_active: qm.is_active,
                    split_element_id: qm.split_element_id,
                    matched: match
                });
            }

            return match;
        });

        console.log('[3D Viewer] Found matching quantity members:', results);
        return results;
    }

    // Display details of a selected quantity member
    function displayQuantityMemberDetails(qm) {
        console.log('[3D Viewer] displayQuantityMemberDetails called with:', qm);
        const detailsContainer = document.getElementById('three-d-quantity-member-details');
        console.log('[3D Viewer] Details container element:', detailsContainer);
        if (!detailsContainer) {
            console.error('[3D Viewer] Details container not found!');
            return;
        }

        let html = '';

        // Basic Information
        html += '<div class="property-section">';
        html += '<h4>기본 정보</h4>';
        html += `<div class="property-row"><span class="property-label">이름:</span><span class="property-value">${qm.name || 'N/A'}</span></div>`;
        html += `<div class="property-row"><span class="property-label">ID:</span><span class="property-value">${qm.id}</span></div>`;
        html += `<div class="property-row"><span class="property-label">분류:</span><span class="property-value">${qm.tag_name || 'N/A'}</span></div>`;
        html += `<div class="property-row"><span class="property-label">일람부호:</span><span class="property-value">${qm.member_mark_name || 'N/A'}</span></div>`;
        html += '</div>';

        // Properties
        if (qm.properties && Object.keys(qm.properties).length > 0) {
            html += '<div class="property-section">';
            html += '<h4>속성</h4>';
            for (const [key, value] of Object.entries(qm.properties)) {
                html += `<div class="property-row"><span class="property-label">${key}:</span>`;
                html += renderNestedValue(value, 1);
                html += '</div>';
            }
            html += '</div>';
        }

        // Cost Codes
        if (qm.cost_codes && qm.cost_codes.length > 0) {
            html += '<div class="property-section">';
            html += '<h4>공사코드</h4>';
            qm.cost_codes.forEach(cc => {
                html += `<div class="property-row"><span class="property-label">${cc.code}:</span><span class="property-value">${cc.name}</span></div>`;
            });
            html += '</div>';
        }

        // Linked Raw Element
        if (qm.raw_element_id) {
            html += '<div class="property-section">';
            html += '<h4>연관 BIM 원본 객체</h4>';
            html += `<div class="property-row"><span class="property-label">Raw Element ID:</span><span class="property-value">${qm.raw_element_id}</span></div>`;
            if (qm.raw_element_name) {
                html += `<div class="property-row"><span class="property-label">이름:</span><span class="property-value">${qm.raw_element_name}</span></div>`;
            }
            html += '</div>';
        }

        console.log('[3D Viewer] Setting details HTML, length:', html.length);
        detailsContainer.innerHTML = html;
        console.log('[3D Viewer] Details displayed successfully');
    }

    // Clear quantity members panel
    function clearQuantityMembersPanel() {
        const listContainer = document.getElementById('three-d-quantity-members-list');
        const detailsContainer = document.getElementById('three-d-quantity-member-details');

        if (listContainer) {
            listContainer.innerHTML = '<p class="no-selection">객체를 선택하세요</p>';
        }

        if (detailsContainer) {
            detailsContainer.innerHTML = '<p class="no-selection">리스트에서 수량산출부재를 선택하세요</p>';
        }
    }

    // Display cost items for selected BIM object
    function displayCostItems(object) {
        console.log('[3D Viewer] ========================================');
        console.log('[3D Viewer] displayCostItems called');
        console.log('[3D Viewer] Object userData:', object.userData);
        const tableContainer = document.getElementById('three-d-cost-items-table');
        if (!tableContainer) {
            console.error('[3D Viewer] Cost items table container not found');
            return;
        }

        // ▼▼▼ [수정] 분할 객체인 경우 split_element_id로 조회 ▼▼▼
        let quantityMembers = [];

        console.log('[3D Viewer] Checking object type:');
        console.log('  - isSplitElement:', object.userData.isSplitElement);
        console.log('  - isSplitPart:', object.userData.isSplitPart);
        console.log('  - splitElementId:', object.userData.splitElementId);
        console.log('  - rawElementId:', object.userData.rawElementId);
        console.log('  - splitPartType:', object.userData.splitPartType);

        if (object.userData.splitElementId) {
            // 분할 객체인 경우: split_element_id로 연결된 QuantityMember 조회
            console.log('[3D Viewer] ✓ Split object selected (splitElementId exists)');
            console.log('[3D Viewer] Querying by split_element_id:', object.userData.splitElementId);

            // ▼▼▼ [추가] loadedQuantityMembers가 비어있으면 대기 메시지 표시 ▼▼▼
            if (!window.loadedQuantityMembers || window.loadedQuantityMembers.length === 0) {
                console.warn('[3D Viewer] loadedQuantityMembers is empty - data is loading...');
                tableContainer.innerHTML = '<p class="no-selection">데이터 로딩 중... (Split 후 자동 재로드 중)</p>';
                return;
            }
            // ▲▲▲ [추가] 여기까지 ▲▲▲

            quantityMembers = findQuantityMembersBySplitElementId(object.userData.splitElementId);
        } else if (object.userData.isSplitPart || object.userData.isSplitElement) {
            // 분할 객체이지만 splitElementId가 아직 설정되지 않음 (split 직후)
            // 자동 재로드가 진행 중이므로 대기 메시지만 표시
            console.warn('[3D Viewer] ⚠ Split object but splitElementId not set yet - waiting for split_saved');
            tableContainer.innerHTML = '<p class="no-selection">분할 정보 저장 중... (자동 재로드 대기)</p>';
            return;
        } else {
            // 원본 BIM 객체인 경우: raw_element_id로 조회
            const bimObjectId = object.userData.bimObjectId || object.userData.rawElementId;
            if (!bimObjectId) {
                tableContainer.innerHTML = '<p class="no-selection">객체 ID를 찾을 수 없습니다</p>';
                return;
            }
            console.log('[3D Viewer] ✓ Original BIM object selected');
            console.log('[3D Viewer] Querying by raw_element_id:', bimObjectId);
            quantityMembers = findQuantityMembersByRawElementId(bimObjectId);
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲
        console.log('[3D Viewer] Found quantity members:', quantityMembers.length);
        console.log('[3D Viewer] Quantity member details:', quantityMembers);

        // ▼▼▼ [수정] Split 직후 QM이 없으면 자동 재시도 ▼▼▼
        if (quantityMembers.length === 0) {
            if (object.userData.splitElementId) {
                // Split 객체인데 QM이 없으면 서버가 계산 중 - 자동 재시도
                console.warn('[3D Viewer] Split object but no QM found - retrying...');
                tableContainer.innerHTML = '<p class="no-selection">산출항목 계산 중... (자동 재시도)</p>';

                // 재시도 (최대 10회, 1000ms 간격 - split은 시간이 더 걸림)
                const retryCount = displayCostItemsRetryCount.get(object) || 0;
                if (retryCount < 10) {
                    displayCostItemsRetryCount.set(object, retryCount + 1);
                    console.log(`[3D Viewer] Retry ${retryCount + 1}/10 after 1000ms...`);
                    setTimeout(() => {
                        console.log('[3D Viewer] Retrying displayCostItems after split...');
                        displayCostItems(object);
                    }, 1000);
                } else {
                    displayCostItemsRetryCount.delete(object);
                    tableContainer.innerHTML = '<p class="no-selection">산출항목을 불러올 수 없습니다. 페이지를 새로고침하세요.</p>';
                }
                return;
            }

            console.warn('[3D Viewer] No quantity members found for BIM object');
            tableContainer.innerHTML = '<p class="no-selection">연관된 수량산출부재가 없습니다</p>';
            return;
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // Get all quantity member IDs
        const qmIds = quantityMembers.map(qm => qm.id);
        console.log('[3D Viewer] Quantity member IDs:', qmIds);

        // Check if cost items with prices are loaded
        if (!costItemsWithPrices || costItemsWithPrices.length === 0) {
            console.warn('[3D Viewer] Cost items with prices not loaded yet');
            tableContainer.innerHTML = '<p class="no-selection">단가 정보를 불러오는 중입니다... (자동 재시도)</p>';

            // Try to load cost items with prices
            if (typeof window.loadCostItemsWithPrices === 'function') {
                window.loadCostItemsWithPrices();
            }

            // 재시도 (최대 8회, 500ms 간격)
            const retryCount = displayCostItemsRetryCount.get(object) || 0;
            if (retryCount < 8) {
                displayCostItemsRetryCount.set(object, retryCount + 1);
                setTimeout(() => {
                    console.log('[3D Viewer] Retrying after loading cost items with prices...');
                    displayCostItems(object);
                }, 500);
            } else {
                displayCostItemsRetryCount.delete(object);
                tableContainer.innerHTML = '<p class="no-selection">단가 정보를 불러올 수 없습니다. 페이지를 새로고침하세요.</p>';
            }
            return;
        }
        console.log('[3D Viewer] Cost items with prices available:', costItemsWithPrices.length, 'items');

        // Find cost items with unit price information that match these quantity members
        // ▼▼▼ [수정] is_active=True 필터 추가 ▼▼▼
        const matchingCostItems = costItemsWithPrices.filter(item => {
            if (!item.quantity_member_id) return false;
            // is_active=True인 항목만 표시
            if (item.is_active === false) return false;
            return qmIds.some(id => id.toString() === item.quantity_member_id.toString());
        });
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        console.log('[3D Viewer] Found matching cost items with prices:', matchingCostItems);

        if (matchingCostItems.length === 0) {
            console.warn('[3D Viewer] No cost items found for quantity members');
            tableContainer.innerHTML = '<p class="no-selection">연관된 산출항목이 없습니다</p>';
            return;
        }

        // Render table
        let html = '<table class="cost-items-table">';
        html += '<thead>';
        html += '<tr>';
        html += '<th>공사코드</th>';
        html += '<th>공종</th>';
        html += '<th>이름</th>';
        html += '<th>규격</th>';
        html += '<th>단위</th>';
        html += '<th>수량</th>';
        html += '<th>재료비단가</th>';
        html += '<th>재료비</th>';
        html += '<th>노무비단가</th>';
        html += '<th>노무비</th>';
        html += '<th>경비단가</th>';
        html += '<th>경비</th>';
        html += '<th>합계단가</th>';
        html += '<th>합계금액</th>';
        html += '</tr>';
        html += '</thead>';
        html += '<tbody>';

        let totalMaterial = 0;
        let totalLabor = 0;
        let totalExpense = 0;
        let totalAmount = 0;

        matchingCostItems.forEach(item => {
            console.log('[3D Viewer] Processing cost item with prices:', item);

            // Get values from BOQ report data (these already include unit price information)
            const quantity = parseFloat(item.quantity) || 0;
            const materialUnitPrice = parseFloat(item.material_cost_unit) || 0;
            const laborUnitPrice = parseFloat(item.labor_cost_unit) || 0;
            const expenseUnitPrice = parseFloat(item.expense_cost_unit) || 0;
            const totalUnitPrice = parseFloat(item.total_cost_unit) || 0;

            // Calculate amounts (or use pre-calculated values if available)
            const materialAmount = parseFloat(item.material_cost_total) || (materialUnitPrice * quantity);
            const laborAmount = parseFloat(item.labor_cost_total) || (laborUnitPrice * quantity);
            const expenseAmount = parseFloat(item.expense_cost_total) || (expenseUnitPrice * quantity);
            const itemTotalAmount = parseFloat(item.total_cost_total) || (totalUnitPrice * quantity);

            console.log('[3D Viewer] Item prices - Material:', materialUnitPrice, 'Labor:', laborUnitPrice, 'Expense:', expenseUnitPrice);
            console.log('[3D Viewer] Item amounts - Material:', materialAmount, 'Labor:', laborAmount, 'Expense:', expenseAmount, 'Total:', itemTotalAmount);

            // Add to totals
            totalMaterial += materialAmount;
            totalLabor += laborAmount;
            totalExpense += expenseAmount;
            totalAmount += itemTotalAmount;

            // Extract cost code info from item
            const costCodeCode = item.cost_code_code || '-';
            const costCodeName = item.cost_code_name || '-';
            const workType = item.work_type || '-';
            const spec = item.spec || '-';
            const unit = item.unit || '-';

            html += '<tr>';
            html += `<td>${costCodeCode}</td>`;
            html += `<td>${workType}</td>`;
            html += `<td>${costCodeName}</td>`;
            html += `<td>${spec}</td>`;
            html += `<td>${unit}</td>`;
            html += `<td class="number">${formatNumber(quantity)}</td>`;
            html += `<td class="number">${formatNumber(materialUnitPrice)}</td>`;
            html += `<td class="number">${formatNumber(materialAmount)}</td>`;
            html += `<td class="number">${formatNumber(laborUnitPrice)}</td>`;
            html += `<td class="number">${formatNumber(laborAmount)}</td>`;
            html += `<td class="number">${formatNumber(expenseUnitPrice)}</td>`;
            html += `<td class="number">${formatNumber(expenseAmount)}</td>`;
            html += `<td class="number">${formatNumber(totalUnitPrice)}</td>`;
            html += `<td class="number">${formatNumber(itemTotalAmount)}</td>`;
            html += '</tr>';
        });

        html += '</tbody>';
        html += '<tfoot>';
        html += '<tr>';
        html += '<td colspan="7" class="label">합계</td>';
        html += `<td class="number">${formatNumber(totalMaterial)}</td>`;
        html += '<td></td>'; // 노무비단가 열
        html += `<td class="number">${formatNumber(totalLabor)}</td>`;
        html += '<td></td>'; // 경비단가 열
        html += `<td class="number">${formatNumber(totalExpense)}</td>`;
        html += '<td></td>'; // 합계단가 열
        html += `<td class="number">${formatNumber(totalAmount)}</td>`;
        html += '</tr>';
        html += '</tfoot>';
        html += '</table>';

        tableContainer.innerHTML = html;
    }
    // ▲▲▲ [수정] displayCostItems 함수 종료 ▲▲▲

    // ▼▼▼ [추가] 함수들을 전역으로 노출 ▼▼▼
    window.displayQuantityMembersForObject = displayQuantityMembers;
    window.displayCostItemsForObject = displayCostItems;
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // Format number with commas
    function formatNumber(num) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        return parseFloat(num).toLocaleString('ko-KR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }

    // Clear cost items panel
    function clearCostItemsPanel() {
        const tableContainer = document.getElementById('three-d-cost-items-table');
        if (tableContainer) {
            tableContainer.innerHTML = '<p class="no-selection">객체를 선택하세요</p>';
        }
    }

    // ===================================================================
    // PROTOTYPE: Object Splitting Functionality
    // ===================================================================

    // Split mode variables
    let splitPlaneHelper = null;

    /**
     * Show split plane helper
     */
    function showSplitPlaneHelper() {
        if (!selectedObject) return;

        updateSliderRange();
        updateSplitPlaneHelper();
    }

    /**
     * Update slider range based on selected axis and object bounds
     */
    function updateSliderRange() {
        if (!selectedObject) return;

        selectedObject.geometry.computeBoundingBox();
        const bbox = selectedObject.geometry.boundingBox;

        const axis = document.getElementById('split-axis-select')?.value || 'z';
        const slider = document.getElementById('split-position-slider');
        const valueDisplay = document.getElementById('split-position-value');

        if (!slider) return;

        // Use percentage-based slider (0-100%)
        slider.setAttribute('min', '0');
        slider.setAttribute('max', '100');
        slider.setAttribute('step', '1');
        slider.setAttribute('value', '50');  // Default to middle (50%)

        if (valueDisplay) {
            valueDisplay.textContent = '50%';
        }

        console.log('[3D Viewer] Slider range updated - Axis:', axis, 'Range: 0-100%');
    }

    /**
     * Update split plane helper based on axis and position
     */
    function updateSplitPlaneHelper() {
        if (!selectedObject) return;

        // Remove existing helper
        if (splitPlaneHelper) {
            scene.remove(splitPlaneHelper);
            splitPlaneHelper = null;
        }

        // Get split parameters
        const axis = document.getElementById('split-axis-select')?.value || 'z';
        const positionPercent = parseFloat(document.getElementById('split-position-slider')?.value || '50');

        // Calculate bounding box
        selectedObject.geometry.computeBoundingBox();
        const bbox = selectedObject.geometry.boundingBox;

        // Calculate split position - convert percentage to actual coordinate
        let planePosition, planeNormal, planeSize;

        if (axis === 'z') {
            const min = bbox.min.z;
            const max = bbox.max.z;
            planePosition = min + (max - min) * (positionPercent / 100.0);
            planeNormal = new THREE.Vector3(0, 0, 1);  // Z축 선택 → Z normal (수직)
            planeSize = [bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y];
        } else if (axis === 'x') {
            const min = bbox.min.x;
            const max = bbox.max.x;
            planePosition = min + (max - min) * (positionPercent / 100.0);
            planeNormal = new THREE.Vector3(1, 0, 0);
            planeSize = [bbox.max.y - bbox.min.y, bbox.max.z - bbox.min.z];
        } else if (axis === 'y') {
            const min = bbox.min.y;
            const max = bbox.max.y;
            planePosition = min + (max - min) * (positionPercent / 100.0);
            planeNormal = new THREE.Vector3(0, 1, 0);  // Y축 선택 → Y normal (수평)
            planeSize = [bbox.max.x - bbox.min.x, bbox.max.z - bbox.min.z];
        }

        // Create helper plane with grid
        const planeSize1 = Math.max(...planeSize) * 1.5;

        // Create group for plane + grid
        splitPlaneHelper = new THREE.Group();

        // Create semi-transparent plane
        const planeGeometry = new THREE.PlaneGeometry(planeSize1, planeSize1);
        const planeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);

        // Create grid helper
        const gridHelper = new THREE.GridHelper(planeSize1, 10, 0xffff00, 0xffff00);
        gridHelper.material.opacity = 0.5;
        gridHelper.material.transparent = true;

        // Position and orient based on axis
        // PlaneGeometry default: XY plane (normal = +Z)
        // GridHelper default: XZ plane (normal = +Y, horizontal)

        // Create local position vector for the plane
        const localPlanePos = new THREE.Vector3();

        if (axis === 'z') {
            // Z axis cut → 수직으로 자름 → 수평면(XY) 보임
            // PlaneGeometry: already XY (no rotation needed)
            // GridHelper: XZ → XY (rotate -90° around X)
            gridHelper.rotation.x = -Math.PI / 2;
            localPlanePos.set(
                (bbox.min.x + bbox.max.x) / 2,
                (bbox.min.y + bbox.max.y) / 2,
                planePosition  // Z position = planePosition (local)
            );
        } else if (axis === 'x') {
            // X axis cut → plane perpendicular to X axis
            // PlaneGeometry: XY → YZ (rotate -90° around Y)
            // GridHelper: XZ → YZ (rotate -90° around Y)
            planeMesh.rotation.y = -Math.PI / 2;
            gridHelper.rotation.y = -Math.PI / 2;
            localPlanePos.set(
                planePosition,  // X position = planePosition (local)
                (bbox.min.y + bbox.max.y) / 2,
                (bbox.min.z + bbox.max.z) / 2
            );
        } else if (axis === 'y') {
            // Y axis cut → 수평으로 자름 → 수직면(XZ) 보임
            // PlaneGeometry: XY → XZ (rotate -90° around X)
            // GridHelper: already XZ (no rotation needed)
            planeMesh.rotation.x = -Math.PI / 2;
            localPlanePos.set(
                (bbox.min.x + bbox.max.x) / 2,
                planePosition,  // Y position = planePosition (local)
                (bbox.min.z + bbox.max.z) / 2
            );
        }

        splitPlaneHelper.add(planeMesh);
        splitPlaneHelper.add(gridHelper);

        // Convert local position to world position
        const worldPlanePos = selectedObject.localToWorld(localPlanePos.clone());
        splitPlaneHelper.position.copy(worldPlanePos);

        // Match object's rotation so plane is properly oriented
        splitPlaneHelper.rotation.copy(selectedObject.rotation);
        splitPlaneHelper.scale.copy(selectedObject.scale);

        scene.add(splitPlaneHelper);
        console.log('[3D Viewer] Split plane helper updated');
        console.log('  - Axis:', axis);
        console.log('  - Slider value (percent):', positionPercent + '%');
        console.log('  - Plane position (local):', planePosition);
        console.log('  - Plane position (world):', worldPlanePos);
        console.log('  - BBox range (local):', axis === 'z' ? [bbox.min.z, bbox.max.z] : (axis === 'x' ? [bbox.min.x, bbox.max.x] : [bbox.min.y, bbox.max.y]));
        console.log('  - Object position (world):', selectedObject.position);
    }

    /**
     * Exit split mode
     */
    function exitSplitMode() {
        // Remove helper
        if (splitPlaneHelper) {
            scene.remove(splitPlaneHelper);
            splitPlaneHelper = null;
        }

        // Hide split controls, show split button
        const splitControlsPanel = document.getElementById('split-controls-panel');
        const splitBtn = document.getElementById('split-object-btn');

        if (splitControlsPanel) splitControlsPanel.style.display = 'none';
        if (splitBtn) splitBtn.style.display = 'inline-block';

        console.log('[3D Viewer] Exited split mode');
    }

    /**
     * Split the selected object using a horizontal plane (Z-axis midpoint)
     * Uses precise plane-triangle intersection algorithm
     */
    function splitSelectedObject() {
        if (!selectedObject) {
            console.warn('[3D Viewer] No object selected for splitting');
            showToast('분할할 객체를 먼저 선택하세요', 'warning');
            return;
        }

        // ▼▼▼ [수정] 분할된 객체도 재분할 가능 ▼▼▼
        if (selectedObject.userData.isSplitPart || selectedObject.userData.isSplitElement) {
            console.log('[3D Viewer] Re-splitting an already-split object (nested split)');
            console.log('  - Parent split ID:', selectedObject.userData.splitElementId);
        } else {
            console.log('[3D Viewer] Splitting original BIM object');
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        console.log('[3D Viewer] Starting precise plane-based split operation on object:', selectedObject.userData.bimObjectId);

        try {
            // Get split parameters from UI
            const axis = document.getElementById('split-axis-select')?.value || 'z';
            const position = parseFloat(document.getElementById('split-position-slider')?.value || '0');

            // Calculate bounding box
            selectedObject.geometry.computeBoundingBox();
            const bbox = selectedObject.geometry.boundingBox;
            console.log('[3D Viewer] Bounding box:', bbox);

            // Calculate split plane based on selected axis and position
            // Convert slider percentage (0-100) to actual bbox coordinate
            let planePosition, planeNormal, axisName;

            if (axis === 'z') {
                const min = bbox.min.z;
                const max = bbox.max.z;
                planePosition = min + (max - min) * (position / 100.0);
                planeNormal = new THREE.Vector3(0, 0, 1);  // Z축 → Z normal (수직)
                axisName = 'Z';
            } else if (axis === 'x') {
                const min = bbox.min.x;
                const max = bbox.max.x;
                planePosition = min + (max - min) * (position / 100.0);
                planeNormal = new THREE.Vector3(1, 0, 0);
                axisName = 'X';
            } else if (axis === 'y') {
                const min = bbox.min.y;
                const max = bbox.max.y;
                planePosition = min + (max - min) * (position / 100.0);
                planeNormal = new THREE.Vector3(0, 1, 0);  // Y축 → Y normal (수평)
                axisName = 'Y';
            }

            // Note: planePosition is now in LOCAL coordinates (from bbox range)
            // No conversion needed - geometry vertices are already in local coords
            const planeDistance = -planePosition;

            // Get bbox range for the selected axis
            let bboxMin, bboxMax;
            if (axis === 'z') {
                bboxMin = bbox.min.z;
                bboxMax = bbox.max.z;
            } else if (axis === 'x') {
                bboxMin = bbox.min.x;
                bboxMax = bbox.max.x;
            } else if (axis === 'y') {
                bboxMin = bbox.min.y;
                bboxMax = bbox.max.y;
            }

            console.log('[3D Viewer] ============= SPLIT OPERATION STARTING =============');
            console.log('[3D Viewer] Selected object info:');
            console.log('  - Is split part:', selectedObject.userData.isSplitPart);
            console.log('  - Parent split ID:', selectedObject.userData.splitElementId);
            console.log('  - Object position:', selectedObject.position.toArray());
            console.log('  - Object rotation:', selectedObject.rotation.toArray());
            console.log('  - Object scale:', selectedObject.scale.toArray());
            console.log('[3D Viewer] Split parameters:');
            console.log('  - Axis:', axisName);
            console.log('  - Slider value:', position + '%');
            console.log('  - BBox:', {
                min: [bbox.min.x.toFixed(4), bbox.min.y.toFixed(4), bbox.min.z.toFixed(4)],
                max: [bbox.max.x.toFixed(4), bbox.max.y.toFixed(4), bbox.max.z.toFixed(4)]
            });
            console.log('  - BBox range [min, max]:', [bboxMin.toFixed(4), bboxMax.toFixed(4)]);
            console.log('  - BBox size:', (bboxMax - bboxMin).toFixed(4));
            console.log('  - Plane position:', planePosition.toFixed(4));
            console.log('  - Plane distance:', planeDistance.toFixed(4));
            console.log('  - Plane normal:', planeNormal.toArray());
            console.log('  - Expected split ratio:', (position / 100.0 * 100).toFixed(2) + '%');

            // Get geometry data
            const positions = selectedObject.geometry.attributes.position.array;
            const indices = selectedObject.geometry.index ? selectedObject.geometry.index.array : null;

            // Calculate original geometry volume for verification
            const originalGeometryVolume = calculateGeometryVolume(selectedObject.geometry);
            console.log('[3D Viewer] Original geometry info:');
            console.log('  - Vertices:', positions.length / 3);
            console.log('  - Faces:', indices ? indices.length / 3 : 'N/A');
            console.log('  - Calculated volume from geometry:', originalGeometryVolume.toFixed(6));
            console.log('  - DB volume (geometry_volume):', selectedObject.userData.geometry_volume || 'not available');

            // Debug: Print all vertices
            console.log('[3D Viewer] Original vertices:');
            for (let i = 0; i < Math.min(positions.length / 3, 8); i++) {
                const x = positions[i * 3].toFixed(4);
                const y = positions[i * 3 + 1].toFixed(4);
                const z = positions[i * 3 + 2].toFixed(4);
                console.log(`  v${i}: (${x}, ${y}, ${z})`);
            }

            // Use plane-based split
            console.log('[3D Viewer] Using plane-based split...');

            // Split geometry with precise intersection
            const splitResult = splitGeometryByPlane(positions, indices, planeNormal, planeDistance);

            console.log('[3D Viewer] Split complete - Bottom faces:', splitResult.bottomFaces.length, 'Top faces:', splitResult.topFaces.length);
            console.log('[3D Viewer] New vertices created:', splitResult.newVertices.length / 3);

            // Debug: Print bottom and top face counts breakdown
            console.log('[3D Viewer] Split faces breakdown:');
            console.log('  - Total allVertices:', splitResult.allVertices.length / 3);
            console.log('  - Bottom faces:', splitResult.bottomFaces.length);
            console.log('  - Top faces:', splitResult.topFaces.length);

            // Check if split produced valid results
            if (splitResult.bottomFaces.length === 0 || splitResult.topFaces.length === 0) {
                console.warn('[3D Viewer] Split resulted in empty geometry');
                showToast('분할 평면이 객체와 교차하지 않습니다', 'warning');
                return;
            }

            // Create new geometries
            let bottomGeometry = createGeometryFromSplitResult(splitResult.allVertices, splitResult.bottomFaces);
            let topGeometry = createGeometryFromSplitResult(splitResult.allVertices, splitResult.topFaces);

            console.log('[3D Viewer] Geometries created');
            console.log('  - Bottom geometry vertices:', bottomGeometry.attributes.position.count);
            console.log('  - Top geometry vertices:', topGeometry.attributes.position.count);

            // Validate geometries
            if (!bottomGeometry || !topGeometry ||
                bottomGeometry.attributes.position.count === 0 ||
                topGeometry.attributes.position.count === 0) {
                console.error('[3D Viewer] Failed to create valid geometries');
                showToast('형상 생성에 실패했습니다', 'error');
                return;
            }

            // Calculate volume from split geometries
            console.log('[3D Viewer] === BOTTOM GEOMETRY VOLUME CALCULATION ===');
            const bottomVolume = calculateGeometryVolume(bottomGeometry, true);
            console.log('[3D Viewer] === TOP GEOMETRY VOLUME CALCULATION ===');
            const topVolume = calculateGeometryVolume(topGeometry, true);

            console.log('[3D Viewer] Volume from split geometries:');
            console.log('  - Bottom:', bottomVolume.toFixed(6));
            console.log('  - Top:', topVolume.toFixed(6));
            console.log('  - Total:', (bottomVolume + topVolume).toFixed(6));
            console.log('  - Original:', originalGeometryVolume.toFixed(6));
            console.log('  - Preservation:', ((bottomVolume + topVolume) / originalGeometryVolume * 100).toFixed(2) + '%');

            // NOTE: Plane-based split without capping may not preserve exact volume
            // We use the calculated volumes of split parts for ratio calculation
            console.log('[3D Viewer] NOTE: Using actual split geometry volumes for ratio calculation');

            // Recompute normals for smooth shading
            bottomGeometry.computeVertexNormals();
            topGeometry.computeVertexNormals();

            // Normalize normals to ensure consistent shading
            bottomGeometry.normalizeNormals();
            topGeometry.normalizeNormals();

            // Create materials - use original gray material (not current selected material)
            let originalMaterial = originalMaterials.get(selectedObject);
            if (!originalMaterial) {
                // If not found, create new gray material
                originalMaterial = new THREE.MeshStandardMaterial({
                    color: 0xcccccc,
                    metalness: 0.0,
                    roughness: 1.0,
                    flatShading: true,
                    side: THREE.DoubleSide
                });
            }

            const bottomMaterial = originalMaterial.clone();
            const topMaterial = originalMaterial.clone();
            bottomMaterial.flatShading = true;
            topMaterial.flatShading = true;
            bottomMaterial.needsUpdate = true;
            topMaterial.needsUpdate = true;

            // Create meshes from results
            const bottomMesh = new THREE.Mesh(bottomGeometry, bottomMaterial);
            const topMesh = new THREE.Mesh(topGeometry, topMaterial);

            // Enable shadow casting and receiving
            bottomMesh.castShadow = true;
            bottomMesh.receiveShadow = true;
            topMesh.castShadow = true;
            topMesh.receiveShadow = true;

            // Add only boundary edges (external outline, no internal triangulation)
            const bottomBoundaryGeometry = getBoundaryEdges(bottomGeometry);
            const bottomLineSegments = new THREE.LineSegments(
                bottomBoundaryGeometry,
                new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
            );
            bottomMesh.add(bottomLineSegments);

            const topBoundaryGeometry = getBoundaryEdges(topGeometry);
            const topLineSegments = new THREE.LineSegments(
                topBoundaryGeometry,
                new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
            );
            topMesh.add(topLineSegments);

            // Copy transformation from original
            console.log('[Split] Original mesh transform:', {
                position: selectedObject.position.toArray(),
                rotation: selectedObject.rotation.toArray(),
                scale: selectedObject.scale.toArray(),
                isSplitElement: selectedObject.userData.isSplitElement,
                isSplitPart: selectedObject.userData.isSplitPart
            });

            bottomMesh.position.copy(selectedObject.position);
            bottomMesh.rotation.copy(selectedObject.rotation);
            bottomMesh.scale.copy(selectedObject.scale);

            topMesh.position.copy(selectedObject.position);
            topMesh.rotation.copy(selectedObject.rotation);
            topMesh.scale.copy(selectedObject.scale);

            console.log('[Split] After copying transform - bottomMesh:', {
                position: bottomMesh.position.toArray(),
                rotation: bottomMesh.rotation.toArray(),
                scale: bottomMesh.scale.toArray()
            });
            console.log('[Split] After copying transform - topMesh:', {
                position: topMesh.position.toArray(),
                rotation: topMesh.rotation.toArray(),
                scale: topMesh.scale.toArray()
            });

            // Preserve original color from first split (don't overwrite on re-split)
            // Use the original material's color (gray), not the selected material's color
            const preservedOriginalColor = selectedObject.userData.originalColor ||
                                          originalMaterial.color.clone();

            // Note: Volume calculation will be added after geometry computation
            // Placeholder userData - will be updated with volume info below
            // ▼▼▼ [수정] parentSplitId 추가 ▼▼▼
            const parentSplitId = selectedObject.userData.splitElementId || null;
            console.log('[3D Viewer] Parent split ID for new meshes:', parentSplitId);
            // ▲▲▲ [수정] 여기까지 ▲▲▲

            bottomMesh.userData = {
                ...selectedObject.userData,
                isSplitPart: true,
                isSplitElement: true,  // 분할 객체임을 표시
                splitElementId: undefined,  // 새로운 split이므로 초기화 (split_saved에서 설정됨)
                splitPartType: 'bottom',
                originalObjectId: selectedObject.userData.bimObjectId || selectedObject.userData.originalObjectId,
                parentSplitId: parentSplitId,  // ▼▼▼ [추가] 부모 분할 ID ▼▼▼
                splitAxis: axisName,
                splitPosition: planePosition,
                splitPositionPercent: position,
                originalColor: preservedOriginalColor.clone(),  // Preserve from original
                displayColor: bottomMaterial.color.clone()      // Current display color
            };

            topMesh.userData = {
                ...selectedObject.userData,
                isSplitPart: true,
                isSplitElement: true,  // 분할 객체임을 표시
                splitElementId: undefined,  // 새로운 split이므로 초기화 (split_saved에서 설정됨)
                splitPartType: 'top',
                originalObjectId: selectedObject.userData.bimObjectId || selectedObject.userData.originalObjectId,
                parentSplitId: parentSplitId,  // ▼▼▼ [추가] 부모 분할 ID ▼▼▼
                splitAxis: axisName,
                splitPosition: planePosition,
                splitPositionPercent: position,
                originalColor: preservedOriginalColor.clone(),  // Preserve from original
                displayColor: topMaterial.color.clone()         // Current display color
            };

            // Compute bounding boxes and spheres for the new geometries
            bottomGeometry.computeBoundingBox();
            bottomGeometry.computeBoundingSphere();
            topGeometry.computeBoundingBox();
            topGeometry.computeBoundingSphere();

            console.log('[3D Viewer] Geometries computed - normals, bounding boxes, and bounding spheres ready');

            // ===== Volume Ratio Calculation =====
            // Determine the original BIM object volume (최초 BIM 원본 volume)
            // This should remain constant across multiple splits
            let originalBIMVolume;
            if (selectedObject.userData.originalGeometryVolume) {
                // Already a split part - preserve original BIM volume
                originalBIMVolume = selectedObject.userData.originalGeometryVolume;
                console.log('[3D Viewer] Using parent originalGeometryVolume:', originalBIMVolume.toFixed(6));
            } else if (selectedObject.userData.geometry_volume) {
                // First split of original BIM object - use DB volume
                originalBIMVolume = selectedObject.userData.geometry_volume;
                console.log('[3D Viewer] Using BIM geometry_volume from DB:', originalBIMVolume.toFixed(6));
            } else {
                // Fallback: use calculated volume
                originalBIMVolume = originalGeometryVolume;
                console.log('[3D Viewer] Using calculated volume as original:', originalBIMVolume.toFixed(6));
            }

            const totalSplitVolume = bottomVolume + topVolume;

            // Calculate volume ratios based on ORIGINAL BIM VOLUME (not immediate parent)
            // This ensures ratios always reference the initial BIM object
            const bottomRatio = originalBIMVolume > 0 ? bottomVolume / originalBIMVolume : 0.5;
            const topRatio = originalBIMVolume > 0 ? topVolume / originalBIMVolume : 0.5;

            console.log('[3D Viewer] Final volume summary:');
            console.log('  - Bottom: ' + bottomVolume.toFixed(6) + ' (' + (bottomRatio * 100).toFixed(2) + '%)');
            console.log('  - Top: ' + topVolume.toFixed(6) + ' (' + (topRatio * 100).toFixed(2) + '%)');
            console.log('  - Total split: ' + totalSplitVolume.toFixed(6));
            console.log('  - Immediate parent: ' + originalGeometryVolume.toFixed(6));
            console.log('  - Original BIM: ' + originalBIMVolume.toFixed(6));
            console.log('  - Preservation: ' + ((totalSplitVolume / originalGeometryVolume) * 100).toFixed(2) + '%');

            // Update userData with volume information
            // IMPORTANT: originalGeometryVolume is the ORIGINAL BIM volume (constant)
            //            geometryVolume is the current object's volume
            //            volumeRatio is relative to ORIGINAL BIM volume
            bottomMesh.userData.originalGeometryVolume = originalBIMVolume;  // 최초 BIM 원본 (변하지 않음)
            bottomMesh.userData.geometryVolume = bottomVolume;
            bottomMesh.userData.volumeRatio = bottomRatio;

            topMesh.userData.originalGeometryVolume = originalBIMVolume;  // 최초 BIM 원본 (변하지 않음)
            topMesh.userData.geometryVolume = topVolume;
            topMesh.userData.volumeRatio = topRatio;

            // Clear selection and restore material before removing object
            if (selectedObject) {
                const originalMat = originalMaterials.get(selectedObject);
                if (originalMat) {
                    selectedObject.material = originalMat;
                    selectedObject.material.needsUpdate = true;
                }
            }

            // Remove original object from scene
            scene.remove(selectedObject);
            selectedObject = null; // Clear selection

            // Add split parts to scene
            scene.add(bottomMesh);
            scene.add(topMesh);

            // ▼▼▼ [추가] Split된 mesh들을 전역 Map에 저장 (split_saved에서 참조용) ▼▼▼
            if (!window.pendingSplitMeshes) {
                window.pendingSplitMeshes = new Map();
            }
            // Key: "raw_element_id:split_part_type"
            const bottomKey = `${bottomMesh.userData.rawElementId}:${bottomMesh.userData.splitPartType}`;
            const topKey = `${topMesh.userData.rawElementId}:${topMesh.userData.splitPartType}`;
            window.pendingSplitMeshes.set(bottomKey, bottomMesh);
            window.pendingSplitMeshes.set(topKey, topMesh);
            console.log('[3D Viewer] Stored pending split meshes:', {
                bottomKey: bottomKey,
                topKey: topKey
            });
            // ▲▲▲ [추가] 여기까지 ▲▲▲

            console.log('[3D Viewer] Split complete - created 2 parts with precise geometry');
            console.log('[3D Viewer] Bottom part:', bottomMesh.userData);
            console.log('[3D Viewer] Top part:', topMesh.userData);
            console.log('[3D Viewer] Bottom BBox:', bottomGeometry.boundingBox);
            console.log('[3D Viewer] Top BBox:', topGeometry.boundingBox);

            // Extract geometry data for console output
            const bottomGeomData = extractGeometryData(bottomMesh.geometry, bottomMesh);
            const topGeomData = extractGeometryData(topMesh.geometry, topMesh);

            console.log('[3D Viewer] Bottom geometry data:', bottomGeomData);
            console.log('[3D Viewer] Top geometry data:', topGeomData);

            showToast('객체가 정확하게 분할되었습니다', 'success');

            // Save split elements to database
            const splitInfo = {
                method: 'plane'
            };
            saveSplitToDatabase(bottomMesh, splitInfo);
            saveSplitToDatabase(topMesh, splitInfo);

            // Exit split mode
            exitSplitMode();

        } catch (error) {
            console.error('[3D Viewer] Split operation failed:', error);
            showToast('분할 중 오류가 발생했습니다: ' + error.message, 'error');
            // Don't exit split mode on error, user might want to try again
        }
    }

    /**
     * Extract only boundary edges (edges that belong to only 1 face)
     * This filters out internal triangulation edges on flat surfaces
     */
    function getBoundaryEdges(geometry) {
        const edges = new Map(); // Map of "i1-i2" -> count
        const positions = geometry.attributes.position;
        const indices = geometry.index ? geometry.index.array : null;

        if (!indices) return new THREE.BufferGeometry(); // No indices, no edges

        // Count how many faces share each edge
        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i];
            const i1 = indices[i + 1];
            const i2 = indices[i + 2];

            // Three edges per triangle
            const edge1 = [Math.min(i0, i1), Math.max(i0, i1)].join('-');
            const edge2 = [Math.min(i1, i2), Math.max(i1, i2)].join('-');
            const edge3 = [Math.min(i2, i0), Math.max(i2, i0)].join('-');

            edges.set(edge1, (edges.get(edge1) || 0) + 1);
            edges.set(edge2, (edges.get(edge2) || 0) + 1);
            edges.set(edge3, (edges.get(edge3) || 0) + 1);
        }

        // Extract edges that appear only once (boundary edges)
        const boundaryEdges = [];
        for (const [edgeKey, count] of edges.entries()) {
            if (count === 1) {
                const [i0, i1] = edgeKey.split('-').map(Number);
                // Add both vertices
                boundaryEdges.push(
                    positions.getX(i0), positions.getY(i0), positions.getZ(i0),
                    positions.getX(i1), positions.getY(i1), positions.getZ(i1)
                );
            }
        }

        // Create line geometry from boundary edges
        const lineGeometry = new THREE.BufferGeometry();
        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(boundaryEdges, 3));
        return lineGeometry;
    }

    /**
     * Split geometry by plane with precise triangle-plane intersection
     * Uses edge-based intersection to avoid duplicate intersection points
     * @param {Float32Array} positions - Vertex positions
     * @param {Uint16Array|Uint32Array} indices - Face indices
     * @param {THREE.Vector3} planeNormal - Plane normal vector
     * @param {number} planeDistance - Plane distance from origin
     * @returns {Object} Split result with bottom/top faces and all vertices
     */
    function splitGeometryByPlane(positions, indices, planeNormal, planeDistance) {
        const EPSILON = 0.00001;

        // Store all vertices (original + new intersection vertices)
        const allVertices = [];
        for (let i = 0; i < positions.length; i++) {
            allVertices.push(positions[i]);
        }

        const bottomFaces = [];
        const topFaces = [];
        const newVertices = [];

        // Helper: Calculate signed distance from point to plane
        function signedDistance(x, y, z) {
            return planeNormal.x * x + planeNormal.y * y + planeNormal.z * z + planeDistance;
        }

        // Helper: Create edge key (use smaller index first for consistency)
        function edgeKey(i0, i1) {
            return i0 < i1 ? `${i0}-${i1}` : `${i1}-${i0}`;
        }

        // Step 1: Build edge→intersection mapping
        // This ensures each edge is processed exactly once
        const edgeIntersections = new Map();

        function getOrCreateIntersection(i0, i1) {
            const key = edgeKey(i0, i1);

            if (edgeIntersections.has(key)) {
                return edgeIntersections.get(key);
            }

            // Calculate intersection
            const x0 = positions[i0 * 3], y0 = positions[i0 * 3 + 1], z0 = positions[i0 * 3 + 2];
            const x1 = positions[i1 * 3], y1 = positions[i1 * 3 + 1], z1 = positions[i1 * 3 + 2];

            const d0 = signedDistance(x0, y0, z0);
            const d1 = signedDistance(x1, y1, z1);

            // Interpolation factor
            const t = d0 / (d0 - d1);

            // Intersection point
            const intX = x0 + t * (x1 - x0);
            const intY = y0 + t * (y1 - y0);
            const intZ = z0 + t * (z1 - z0);

            // Add new vertex
            const idx = allVertices.length / 3;
            allVertices.push(intX, intY, intZ);
            newVertices.push(intX, intY, intZ);

            edgeIntersections.set(key, idx);
            return idx;
        }

        // Process each triangle
        if (indices) {
            for (let i = 0; i < indices.length; i += 3) {
                const i0 = indices[i];
                const i1 = indices[i + 1];
                const i2 = indices[i + 2];

                // Get vertices
                const v0 = { x: positions[i0 * 3], y: positions[i0 * 3 + 1], z: positions[i0 * 3 + 2] };
                const v1 = { x: positions[i1 * 3], y: positions[i1 * 3 + 1], z: positions[i1 * 3 + 2] };
                const v2 = { x: positions[i2 * 3], y: positions[i2 * 3 + 1], z: positions[i2 * 3 + 2] };

                // Calculate signed distances
                const d0 = signedDistance(v0.x, v0.y, v0.z);
                const d1 = signedDistance(v1.x, v1.y, v1.z);
                const d2 = signedDistance(v2.x, v2.y, v2.z);

                // Classify vertices
                const below0 = d0 < -EPSILON;
                const below1 = d1 < -EPSILON;
                const below2 = d2 < -EPSILON;

                const above0 = d0 > EPSILON;
                const above1 = d1 > EPSILON;
                const above2 = d2 > EPSILON;

                const belowCount = (below0 ? 1 : 0) + (below1 ? 1 : 0) + (below2 ? 1 : 0);
                const aboveCount = (above0 ? 1 : 0) + (above1 ? 1 : 0) + (above2 ? 1 : 0);

                // Case 1: All vertices on one side
                if (belowCount === 3) {
                    bottomFaces.push([i0, i1, i2]);
                } else if (aboveCount === 3) {
                    topFaces.push([i0, i1, i2]);
                }
                // Case 2: Triangle crosses the plane
                // Handle all 6 crossing configurations explicitly to preserve winding order
                else if (belowCount > 0 && aboveCount > 0) {
                    // Determine configuration based on which vertices are below/above
                    // We need to preserve the original [v0, v1, v2] order

                    // Case 2a: v0 below, v1 v2 above (001 configuration)
                    if (below0 && above1 && above2) {
                        const int01 = getOrCreateIntersection(i0, i1);
                        const int02 = getOrCreateIntersection(i0, i2);
                        // Original triangle: [v0, v1, v2]
                        // Bottom: [v0, int01, int02] (preserves CCW)
                        bottomFaces.push([i0, int01, int02]);
                        // Top: quad [int01, v1, v2, int02] split into 2 triangles
                        topFaces.push([int01, i1, i2]);
                        topFaces.push([int01, i2, int02]);
                    }
                    // Case 2b: v0 v1 below, v2 above (110 configuration)
                    else if (below0 && below1 && above2) {
                        const int12 = getOrCreateIntersection(i1, i2);
                        const int02 = getOrCreateIntersection(i0, i2);
                        // Bottom: quad [v0, v1, int12, int02] split into 2 triangles
                        bottomFaces.push([i0, i1, int12]);
                        bottomFaces.push([i0, int12, int02]);
                        // Top: [int02, int12, v2] (preserves CCW)
                        topFaces.push([int02, int12, i2]);
                    }
                    // Case 2c: v0 above, v1 below, v2 above (101 configuration)
                    else if (above0 && below1 && above2) {
                        const int01 = getOrCreateIntersection(i0, i1);
                        const int12 = getOrCreateIntersection(i1, i2);
                        // Bottom: [int01, v1, int12] (preserves CCW)
                        bottomFaces.push([int01, i1, int12]);
                        // Top: quad [v0, int01, int12, v2] split into 2 triangles
                        topFaces.push([i0, int01, int12]);
                        topFaces.push([i0, int12, i2]);
                    }
                    // Case 2d: v0 v2 below, v1 above (011 configuration)
                    else if (below0 && above1 && below2) {
                        const int01 = getOrCreateIntersection(i0, i1);
                        const int12 = getOrCreateIntersection(i1, i2);
                        // Bottom: quad [v0, int01, int12, v2] split into 2 triangles
                        bottomFaces.push([i0, int01, int12]);
                        bottomFaces.push([i0, int12, i2]);
                        // Top: [int01, v1, int12] (preserves CCW)
                        topFaces.push([int01, i1, int12]);
                    }
                    // Case 2e: v0 above, v1 v2 below (100 configuration)
                    else if (above0 && below1 && below2) {
                        const int01 = getOrCreateIntersection(i0, i1);
                        const int02 = getOrCreateIntersection(i0, i2);
                        // Bottom: quad [int01, v1, v2, int02] split into 2 triangles
                        bottomFaces.push([int01, i1, i2]);
                        bottomFaces.push([int01, i2, int02]);
                        // Top: [v0, int01, int02] (preserves CCW)
                        topFaces.push([i0, int01, int02]);
                    }
                    // Case 2f: v0 v1 above, v2 below (010 configuration)
                    else if (above0 && above1 && below2) {
                        const int12 = getOrCreateIntersection(i1, i2);
                        const int02 = getOrCreateIntersection(i0, i2);
                        // Bottom: [int02, int12, v2] (preserves CCW)
                        bottomFaces.push([int02, int12, i2]);
                        // Top: quad [v0, v1, int12, int02] split into 2 triangles
                        topFaces.push([i0, i1, int12]);
                        topFaces.push([i0, int12, int02]);
                    }
                }
            }
        }

        console.log('[3D Viewer] Edge-based split: Created', edgeIntersections.size, 'unique intersection points');

        // ===== ADD CAPPING FACES =====
        // Collect intersection vertices (already unique due to edge-based approach)
        const cappingVertices = [];

        for (let i = 0; i < newVertices.length; i += 3) {
            cappingVertices.push({
                x: newVertices[i],
                y: newVertices[i + 1],
                z: newVertices[i + 2],
                index: (allVertices.length - newVertices.length) / 3 + i / 3
            });
        }

        console.log('[3D Viewer] Capping: Found', cappingVertices.length, 'unique intersection points');

        // Debug: Print all capping vertices
        console.log('[3D Viewer] Capping vertices:', cappingVertices.map(v => `(${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)})`));

        if (cappingVertices.length >= 3) {
            // Calculate centroid of intersection points (without offset)
            let cx = 0, cy = 0, cz = 0;
            for (let i = 0; i < cappingVertices.length; i++) {
                cx += cappingVertices[i].x;
                cy += cappingVertices[i].y;
                cz += cappingVertices[i].z;
            }
            cx /= cappingVertices.length;
            cy /= cappingVertices.length;
            cz /= cappingVertices.length;

            console.log('[3D Viewer] Capping centroid (raw):', `(${cx.toFixed(4)}, ${cy.toFixed(4)}, ${cz.toFixed(4)})`);

            // Epsilon offset to avoid coplanarity issues with subsequent splits
            const EPSILON_OFFSET = 0.001;  // 1mm offset for numerical stability

            // Get two perpendicular vectors on the plane for sorting
            let tempVec, u, v;
            const absX = Math.abs(planeNormal.x);
            const absY = Math.abs(planeNormal.y);
            const absZ = Math.abs(planeNormal.z);

            if (absX <= absY && absX <= absZ) {
                tempVec = new THREE.Vector3(1, 0, 0);
            } else if (absY <= absX && absY <= absZ) {
                tempVec = new THREE.Vector3(0, 1, 0);
            } else {
                tempVec = new THREE.Vector3(0, 0, 1);
            }
            u = new THREE.Vector3().crossVectors(tempVec, planeNormal).normalize();
            v = new THREE.Vector3().crossVectors(planeNormal, u).normalize();

            console.log('[3D Viewer] Capping basis vectors:');
            console.log('  - planeNormal:', planeNormal);
            console.log('  - u:', u);
            console.log('  - v:', v);

            // Sort vertices around centroid by angle
            const sortedVerts = cappingVertices.slice();
            sortedVerts.forEach(vert => {
                const dx = vert.x - cx;
                const dy = vert.y - cy;
                const dz = vert.z - cz;
                const u_coord = dx * u.x + dy * u.y + dz * u.z;
                const v_coord = dx * v.x + dy * v.y + dz * v.z;
                vert.angle = Math.atan2(v_coord, u_coord);
            });
            sortedVerts.sort((a, b) => a.angle - b.angle);

            console.log('[3D Viewer] Sorted capping vertices by angle:');
            sortedVerts.forEach((v, i) => {
                console.log(`  ${i}: angle=${(v.angle * 180 / Math.PI).toFixed(1)}° pos=(${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)})`);
            });

            // ===== CREATE BOTTOM PART CAPPING =====
            // All vertices offset in +planeNormal direction to avoid coplanarity

            // Add bottom centroid with +epsilon offset
            const bottomCentroidX = cx + planeNormal.x * EPSILON_OFFSET;
            const bottomCentroidY = cy + planeNormal.y * EPSILON_OFFSET;
            const bottomCentroidZ = cz + planeNormal.z * EPSILON_OFFSET;
            const bottomCentroidIndex = allVertices.length / 3;
            allVertices.push(bottomCentroidX, bottomCentroidY, bottomCentroidZ);

            console.log('[3D Viewer] Bottom capping centroid (with +epsilon):', `(${bottomCentroidX.toFixed(4)}, ${bottomCentroidY.toFixed(4)}, ${bottomCentroidZ.toFixed(4)})`);

            // Add bottom perimeter vertices with +epsilon offset
            const bottomPerimeterIndices = [];
            for (let i = 0; i < sortedVerts.length; i++) {
                const origX = sortedVerts[i].x;
                const origY = sortedVerts[i].y;
                const origZ = sortedVerts[i].z;
                const offsetX = origX + planeNormal.x * EPSILON_OFFSET;
                const offsetY = origY + planeNormal.y * EPSILON_OFFSET;
                const offsetZ = origZ + planeNormal.z * EPSILON_OFFSET;
                const idx = allVertices.length / 3;
                allVertices.push(offsetX, offsetY, offsetZ);
                bottomPerimeterIndices.push(idx);
            }

            // Create bottom triangle fan
            const bottomCappingTriangles = [];
            for (let i = 0; i < bottomPerimeterIndices.length; i++) {
                const v1 = bottomPerimeterIndices[i];
                const v2 = bottomPerimeterIndices[(i + 1) % bottomPerimeterIndices.length];
                // Bottom part: normal points UP (along plane normal)
                // Counter-clockwise when viewed from above: [centroid, v1, v2]
                bottomFaces.push([bottomCentroidIndex, v1, v2]);
                bottomCappingTriangles.push([bottomCentroidIndex, v1, v2]);
            }

            // ===== CREATE TOP PART CAPPING =====
            // All vertices offset in -planeNormal direction to avoid coplanarity

            // Add top centroid with -epsilon offset
            const topCentroidX = cx - planeNormal.x * EPSILON_OFFSET;
            const topCentroidY = cy - planeNormal.y * EPSILON_OFFSET;
            const topCentroidZ = cz - planeNormal.z * EPSILON_OFFSET;
            const topCentroidIndex = allVertices.length / 3;
            allVertices.push(topCentroidX, topCentroidY, topCentroidZ);

            console.log('[3D Viewer] Top capping centroid (with -epsilon):', `(${topCentroidX.toFixed(4)}, ${topCentroidY.toFixed(4)}, ${topCentroidZ.toFixed(4)})`);

            // Add top perimeter vertices with -epsilon offset
            const topPerimeterIndices = [];
            for (let i = 0; i < sortedVerts.length; i++) {
                const origX = sortedVerts[i].x;
                const origY = sortedVerts[i].y;
                const origZ = sortedVerts[i].z;
                const offsetX = origX - planeNormal.x * EPSILON_OFFSET;
                const offsetY = origY - planeNormal.y * EPSILON_OFFSET;
                const offsetZ = origZ - planeNormal.z * EPSILON_OFFSET;
                const idx = allVertices.length / 3;
                allVertices.push(offsetX, offsetY, offsetZ);
                topPerimeterIndices.push(idx);
            }

            // Create top triangle fan
            const topCappingTriangles = [];
            for (let i = 0; i < topPerimeterIndices.length; i++) {
                const v1 = topPerimeterIndices[i];
                const v2 = topPerimeterIndices[(i + 1) % topPerimeterIndices.length];
                // Top part: normal points DOWN (opposite plane normal)
                // Counter-clockwise when viewed from below: [centroid, v2, v1]
                topFaces.push([topCentroidIndex, v2, v1]);
                topCappingTriangles.push([topCentroidIndex, v2, v1]);
            }

            console.log('[3D Viewer] Capping: Added', sortedVerts.length, 'capping triangles to each part');
            console.log('[3D Viewer] Capping: Bottom triangles:', bottomCappingTriangles);
            console.log('[3D Viewer] Capping: Top triangles:', topCappingTriangles);

            // ===== REMAP NON-CAPPING FACES TO USE EPSILON OFFSET VERTICES =====
            // Create mapping from original intersection indices to new perimeter indices
            const bottomIndexMap = new Map();
            const topIndexMap = new Map();
            for (let i = 0; i < sortedVerts.length; i++) {
                const originalIndex = sortedVerts[i].index;
                bottomIndexMap.set(originalIndex, bottomPerimeterIndices[i]);
                topIndexMap.set(originalIndex, topPerimeterIndices[i]);
            }

            console.log('[3D Viewer] Remapping non-capping faces to use epsilon offset vertices...');
            console.log('  - Original intersection indices:', Array.from(bottomIndexMap.keys()));
            console.log('  - Bottom perimeter indices:', bottomPerimeterIndices);
            console.log('  - Top perimeter indices:', topPerimeterIndices);

            // Remap bottom faces (excluding capping triangles we just added)
            const numBottomFacesBeforeCapping = bottomFaces.length - bottomCappingTriangles.length;
            for (let i = 0; i < numBottomFacesBeforeCapping; i++) {
                const face = bottomFaces[i];
                for (let j = 0; j < 3; j++) {
                    if (bottomIndexMap.has(face[j])) {
                        face[j] = bottomIndexMap.get(face[j]);
                    }
                }
            }

            // Remap top faces (excluding capping triangles we just added)
            const numTopFacesBeforeCapping = topFaces.length - topCappingTriangles.length;
            for (let i = 0; i < numTopFacesBeforeCapping; i++) {
                const face = topFaces[i];
                for (let j = 0; j < 3; j++) {
                    if (topIndexMap.has(face[j])) {
                        face[j] = topIndexMap.get(face[j]);
                    }
                }
            }

            console.log('[3D Viewer] Remapping complete - all faces now use epsilon offset vertices');
        }

        return {
            allVertices: allVertices,
            newVertices: newVertices,
            bottomFaces: bottomFaces,
            topFaces: topFaces
        };
    }

    /**
     * Create a BufferGeometry from split result
     */
    function createGeometryFromSplitResult(allVertices, faces) {
        const vertices = [];
        const indices = [];
        const vertexMap = new Map();

        console.log('[3D Viewer] createGeometryFromSplitResult called:');
        console.log('  - Input allVertices:', allVertices.length / 3);
        console.log('  - Input faces:', faces.length);

        // Build new vertex array with only used vertices
        for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            for (let j = 0; j < 3; j++) {
                const oldIndex = face[j];

                if (!vertexMap.has(oldIndex)) {
                    const newIndex = vertices.length / 3;
                    vertexMap.set(oldIndex, newIndex);

                    // Add vertex position
                    vertices.push(
                        allVertices[oldIndex * 3],
                        allVertices[oldIndex * 3 + 1],
                        allVertices[oldIndex * 3 + 2]
                    );
                }

                indices.push(vertexMap.get(oldIndex));
            }
        }

        console.log('  - Output vertices:', vertices.length / 3);
        console.log('  - Output indices:', indices.length);
        console.log('  - Output faces:', indices.length / 3);

        // Create BufferGeometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }

    // Removed: createGeometryFromFaces() - replaced by createGeometryFromSplitResult()

    /**
     * Extract geometry data from a mesh (for saving to database)
     */
    function extractGeometryData(geometry, mesh) {
        // ▼▼▼ [수정] World space로 변환된 geometry를 저장 ▼▼▼
        // mesh의 변환을 geometry에 적용하여 world space로 변환
        mesh.updateMatrix();
        mesh.updateMatrixWorld(true);

        console.log('[extractGeometryData] Mesh transform:', {
            position: mesh.position.toArray(),
            rotation: mesh.rotation.toArray(),
            scale: mesh.scale.toArray(),
            isSplitPart: mesh.userData.isSplitPart
        });

        // Clone geometry to avoid modifying the original
        const worldGeometry = geometry.clone();

        // Calculate volume BEFORE transformation
        const volumeBefore = calculateGeometryVolume(worldGeometry, false);
        console.log('[extractGeometryData] Geometry volume BEFORE transformation:', volumeBefore.toFixed(6));

        // For split parts, geometry is in parent's local space with mesh transform applied
        // We need to apply the full matrixWorld to convert to world space
        if (mesh.userData.isSplitPart) {
            console.log('[extractGeometryData] Split part detected - applying full matrixWorld to bake transform into geometry');
            worldGeometry.applyMatrix4(mesh.matrixWorld);
        } else {
            // For original BIM objects, apply full transformation matrix
            console.log('[extractGeometryData] Original BIM object - applying full matrixWorld');
            worldGeometry.applyMatrix4(mesh.matrixWorld);
        }

        // Calculate volume AFTER transformation
        const volumeAfter = calculateGeometryVolume(worldGeometry, false);
        console.log('[extractGeometryData] Geometry volume AFTER transformation:', volumeAfter.toFixed(6));

        if (Math.abs(volumeAfter - volumeBefore) > 0.0001) {
            console.warn('[extractGeometryData] WARNING: Volume changed by transformation!');
            console.warn('  Volume change ratio:', (volumeAfter / volumeBefore).toFixed(4));
        }

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

        // Dispose cloned geometry
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
        // ▲▲▲ [수정] 여기까지 ▲▲▲
    }

    /**
     * Save split element to database via WebSocket
     */
    function saveSplitToDatabase(mesh, splitInfo) {
        if (!window.frontendSocket || window.frontendSocket.readyState !== WebSocket.OPEN) {
            console.warn('[3D Viewer] WebSocket not connected. Cannot save split to database.');
            return;
        }

        if (!window.currentProjectId) {
            console.warn('[3D Viewer] No project selected. Cannot save split to database.');
            return;
        }

        if (!mesh.userData.rawElementId) {
            console.warn('[3D Viewer] No raw_element_id found in mesh userData. Cannot save split.');
            return;
        }

        console.log('[3D Viewer] Saving split to database...');

        // Extract geometry data
        const geometryData = extractGeometryData(mesh.geometry, mesh);

        // Build payload
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

        // Add method-specific data
        if (splitInfo.method === 'plane') {
            payload.split_axis = mesh.userData.splitAxis;
            payload.split_position = mesh.userData.splitPosition;
        } else if (splitInfo.method === 'sketch') {
            payload.sketch_data = splitInfo.sketchData || {};
        }

        console.log('[3D Viewer] Split payload:', payload);

        // Send to server
        window.frontendSocket.send(JSON.stringify({
            type: 'save_split',
            payload: payload
        }));
    }

    /**
     * Convert old Geometry to BufferGeometry (for Three.js r140+)
     * @param {THREE.Geometry} geometry - Old geometry format
     * @returns {THREE.BufferGeometry} - New BufferGeometry format
     */
    function geometryToBufferGeometry(geometry) {
        const bufferGeometry = new THREE.BufferGeometry();

        // Extract vertices
        const vertices = [];
        for (let i = 0; i < geometry.vertices.length; i++) {
            const v = geometry.vertices[i];
            vertices.push(v.x, v.y, v.z);
        }

        // Extract faces (convert to indices)
        const indices = [];
        for (let i = 0; i < geometry.faces.length; i++) {
            const f = geometry.faces[i];
            indices.push(f.a, f.b, f.c);
        }

        // Set attributes
        bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        bufferGeometry.setIndex(indices);

        return bufferGeometry;
    }

    /**
     * Calculate volume of a geometry using signed volume method
     * Uses the same algorithm as the Python backend (tetrahedron formula)
     * @param {THREE.BufferGeometry} geometry - The geometry to calculate volume for
     * @param {boolean} debug - Enable debug logging
     * @returns {number} - The calculated volume in cubic units
     */
    function calculateGeometryVolume(geometry, debug = false) {
        if (!geometry || !geometry.attributes.position) {
            console.warn('[3D Viewer] Cannot calculate volume: invalid geometry');
            return 0;
        }

        const positions = geometry.attributes.position.array;
        const indices = geometry.index ? geometry.index.array : null;

        if (!indices) {
            console.warn('[3D Viewer] Cannot calculate volume: geometry has no indices');
            return 0;
        }

        // Calculate centroid to improve numerical stability for world-space geometries
        let cx = 0, cy = 0, cz = 0;
        const vertexCount = positions.length / 3;
        for (let i = 0; i < vertexCount; i++) {
            cx += positions[i * 3];
            cy += positions[i * 3 + 1];
            cz += positions[i * 3 + 2];
        }
        cx /= vertexCount;
        cy /= vertexCount;
        cz /= vertexCount;

        let signedVolume = 0.0;
        let positiveContribution = 0.0;
        let negativeContribution = 0.0;

        if (debug) {
            console.log('[3D Viewer] Volume calculation details:');
            console.log('  - Total faces:', indices.length / 3);
            console.log('  - Centroid:', `(${cx.toFixed(4)}, ${cy.toFixed(4)}, ${cz.toFixed(4)})`);
        }

        // Iterate through each triangle (face)
        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i];
            const i1 = indices[i + 1];
            const i2 = indices[i + 2];

            // Get vertex positions relative to centroid
            const v0x = positions[i0 * 3] - cx;
            const v0y = positions[i0 * 3 + 1] - cy;
            const v0z = positions[i0 * 3 + 2] - cz;

            const v1x = positions[i1 * 3] - cx;
            const v1y = positions[i1 * 3 + 1] - cy;
            const v1z = positions[i1 * 3 + 2] - cz;

            const v2x = positions[i2 * 3] - cx;
            const v2y = positions[i2 * 3 + 1] - cy;
            const v2z = positions[i2 * 3 + 2] - cz;

            // Cross product: v1 × v2
            const crossX = v1y * v2z - v1z * v2y;
            const crossY = v1z * v2x - v1x * v2z;
            const crossZ = v1x * v2y - v1y * v2x;

            // Signed volume of tetrahedron: v0 · (v1 × v2)
            const faceContribution = (v0x * crossX + v0y * crossY + v0z * crossZ);
            signedVolume += faceContribution;

            if (faceContribution > 0) {
                positiveContribution += faceContribution;
            } else {
                negativeContribution += faceContribution;
            }
        }

        if (debug) {
            console.log('  - Positive contribution:', (positiveContribution / 6.0).toFixed(6));
            console.log('  - Negative contribution:', (negativeContribution / 6.0).toFixed(6));
            console.log('  - Signed volume:', (signedVolume / 6.0).toFixed(6));
            console.log('  - Absolute volume:', (Math.abs(signedVolume / 6.0)).toFixed(6));
        }

        // Take absolute value and divide by 6 (tetrahedron formula)
        const volume = Math.abs(signedVolume / 6.0);

        return volume;
    }

    // ===================================================================
    // Sketch-Based Splitting Functionality
    // ===================================================================

    // Sketch mode variables
    let faceSelectionMode = false;
    let selectedFace = null;
    let savedCameraState = null;

    // 3D sketch visualization (no 2D canvas)
    let sketch3DLine = null;
    let previewLine = null;
    let sketchPoints3D = [];
    let snapIndicator = null;
    let currentSnapPoint = null;
    const SNAP_DISTANCE = 0.1; // World units
    let isSketchDrawing = false;

    // Dimension input mode (for precise distance entry)
    let dimensionInputMode = false;
    let dimensionInputBuffer = '';
    let dimensionDirection = null; // Vector3 (normalized)
    let dimensionStartPoint = null; // Vector3
    let dimensionInputDisplay = null; // HTML element

    // 2D snap indicator
    let snapIndicator2D = null; // HTML element
    let snapIcon = null; // HTML element
    let snapLabel = null; // HTML element

    /**
     * Enter sketch split mode
     */
    function enterSketchMode() {
        if (!selectedObject) {
            showToast('객체를 먼저 선택하세요', 'warning');
            return;
        }

        sketchMode = true;
        console.log('[3D Viewer] Entered sketch mode');

        // Show sketch controls, hide sketch split button
        const sketchControlsPanel = document.getElementById('sketch-controls-panel');
        const sketchSplitBtn = document.getElementById('sketch-split-btn');
        const splitBtn = document.getElementById('split-object-btn');

        if (sketchControlsPanel) sketchControlsPanel.style.display = 'flex';
        if (sketchSplitBtn) sketchSplitBtn.style.display = 'none';
        if (splitBtn) splitBtn.style.display = 'none';

        showToast('작업면을 선택하세요', 'info');
    }

    /**
     * Exit sketch split mode
     */
    function exitSketchMode() {
        sketchMode = false;
        faceSelectionMode = false;
        selectedFace = null;
        sketchPoints3D = [];
        isSketchDrawing = false;

        // Remove 3D visualization objects
        if (sketch3DLine) {
            scene.remove(sketch3DLine);
            sketch3DLine = null;
        }
        if (previewLine) {
            scene.remove(previewLine);
            previewLine = null;
        }
        if (snapIndicator) {
            scene.remove(snapIndicator);
            snapIndicator = null;
        }

        // Remove event listeners if attached
        if (renderer && renderer.domElement) {
            renderer.domElement.removeEventListener('mousedown', onSketchMouseDown);
            renderer.domElement.removeEventListener('mousemove', onSketchMouseMove);
        }
        document.removeEventListener('keydown', onSketchKeyDown);

        // Hide dimension input display
        if (dimensionInputDisplay) {
            dimensionInputDisplay.style.display = 'none';
        }

        // Hide 2D snap indicator
        if (snapIndicator2D) {
            snapIndicator2D.style.display = 'none';
        }

        // Reset dimension input mode
        dimensionInputMode = false;
        dimensionInputBuffer = '';
        dimensionDirection = null;
        dimensionStartPoint = null;

        // Hide sketch controls, show sketch split button
        const sketchControlsPanel = document.getElementById('sketch-controls-panel');
        const sketchSplitBtn = document.getElementById('sketch-split-btn');
        const splitBtn = document.getElementById('split-object-btn');

        if (sketchControlsPanel) sketchControlsPanel.style.display = 'none';
        if (sketchSplitBtn) sketchSplitBtn.style.display = 'inline-block';
        if (splitBtn) splitBtn.style.display = 'inline-block';

        // Clear face info
        const faceInfo = document.getElementById('selected-face-info');
        if (faceInfo) faceInfo.textContent = '';

        // Restore camera if saved
        if (savedCameraState) {
            camera.position.copy(savedCameraState.position);
            camera.quaternion.copy(savedCameraState.quaternion);
            if (controls) controls.target.copy(savedCameraState.target);
            savedCameraState = null;
        }

        console.log('[3D Viewer] Exited sketch mode');
    }

    /**
     * Activate face selection mode
     */
    function activateFaceSelectionMode() {
        if (!selectedObject) {
            showToast('객체를 먼저 선택하세요', 'warning');
            return;
        }

        faceSelectionMode = true;
        showToast('객체의 면을 클릭하세요', 'info');
        console.log('[3D Viewer] Face selection mode activated');
    }

    /**
     * Handle face selection from raycasting result
     */
    function handleFaceSelection(intersection, _mesh) {
        if (!intersection || !_mesh) return;

        console.log('[3D Viewer] Face clicked:', intersection);

        // Get face information
        const faceIndex = intersection.faceIndex;
        const point = intersection.point;

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
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // Transform normal to world space
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(_mesh.matrixWorld);
        normal.applyMatrix3(normalMatrix).normalize();

        console.log('[3D Viewer] Face normal (world):', normal);
        console.log('[3D Viewer] Intersection point (world):', point);

        // Store selected face data
        // ▼▼▼ [수정] localNormal도 안전하게 저장 ▼▼▼
        const localNormal = intersection.face && intersection.face.normal ?
            intersection.face.normal.clone() :
            normal.clone(); // BufferGeometry의 경우 world normal을 그대로 사용
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        selectedFace = {
            mesh: _mesh,
            faceIndex: faceIndex,
            point: point.clone(),
            normal: normal.clone(),
            localNormal: localNormal
        };

        // Visualize selected face
        visualizeSelectedFace(_mesh, faceIndex);

        // Move camera to face front
        moveCameraToFace(selectedFace);

        // Update UI
        const faceInfo = document.getElementById('selected-face-info');
        if (faceInfo) {
            faceInfo.textContent = `면 선택됨 (Normal: ${normal.x.toFixed(2)}, ${normal.y.toFixed(2)}, ${normal.z.toFixed(2)})`;
        }

        // Enable sketch start button
        const startSketchBtn = document.getElementById('start-sketch-btn');
        if (startSketchBtn) {
            startSketchBtn.disabled = false;
        }

        // Disable face selection mode
        faceSelectionMode = false;

        showToast('작업면이 선택되었습니다. 스케치를 시작하세요', 'success');
        console.log('[3D Viewer] Face selected successfully');
    }

    /**
     * Visualize selected face with highlight
     */
    function visualizeSelectedFace(mesh, faceIndex) {
        // Create a helper plane to show selected face
        // This is optional visualization
        console.log('[3D Viewer] Visualizing face', faceIndex);

        // TODO: Add visual highlight for selected face
        // For now, we'll just log it
    }

    /**
     * Move camera to face front view
     */
    function moveCameraToFace(face) {
        if (!face || !controls) return;

        // Save current camera state
        savedCameraState = {
            position: camera.position.clone(),
            quaternion: camera.quaternion.clone(),
            target: controls.target.clone()
        };

        // Calculate camera position
        const distance = 10; // Distance from face
        const cameraTarget = face.point.clone();
        const cameraPosition = face.point.clone().add(face.normal.clone().multiplyScalar(distance));

        // Animate camera movement
        const startPos = camera.position.clone();
        const startTarget = controls.target.clone();
        const duration = 1000; // 1 second
        const startTime = Date.now();

        function animateCamera() {
            const elapsed = Date.now() - startTime;
            const t = Math.min(elapsed / duration, 1);

            // Ease in-out
            const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

            camera.position.lerpVectors(startPos, cameraPosition, eased);
            controls.target.lerpVectors(startTarget, cameraTarget, eased);
            controls.update();

            if (t < 1) {
                requestAnimationFrame(animateCamera);
            } else {
                console.log('[3D Viewer] Camera moved to face front');
            }
        }

        animateCamera();
    }

    /**
     * Find snap point near the given 3D position
     * Returns {point: Vector3, type: 'vertex'|'edge-midpoint'|'edge'|null}
     */
    function findSnapPoint(position3D) {
        if (!selectedFace || !selectedFace.mesh) return null;

        const mesh = selectedFace.mesh;
        const geometry = mesh.geometry;

        // Update world matrix
        mesh.updateMatrixWorld(true);

        let closestPoint = null;
        let closestDistance = SNAP_DISTANCE;
        let snapType = null;

        // Check vertices (highest priority)
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const vertex = new THREE.Vector3(
                positions.array[i * 3],
                positions.array[i * 3 + 1],
                positions.array[i * 3 + 2]
            );

            // Transform to world space
            vertex.applyMatrix4(mesh.matrixWorld);

            const distance = vertex.distanceTo(position3D);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPoint = vertex;
                snapType = 'vertex';
            }
        }

        // Check edges (midpoints and closest points on edges)
        const indices = geometry.index ? geometry.index.array : null;
        if (indices) {
            for (let i = 0; i < indices.length; i += 3) {
                // For each triangle edge
                for (let j = 0; j < 3; j++) {
                    const idx1 = indices[i + j];
                    const idx2 = indices[i + ((j + 1) % 3)];

                    const v1 = new THREE.Vector3(
                        positions.array[idx1 * 3],
                        positions.array[idx1 * 3 + 1],
                        positions.array[idx1 * 3 + 2]
                    ).applyMatrix4(mesh.matrixWorld);

                    const v2 = new THREE.Vector3(
                        positions.array[idx2 * 3],
                        positions.array[idx2 * 3 + 1],
                        positions.array[idx2 * 3 + 2]
                    ).applyMatrix4(mesh.matrixWorld);

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
                }
            }
        }

        return closestPoint ? { point: closestPoint, type: snapType } : null;
    }

    /**
     * Check for orthogonal snap (perpendicular/parallel to face axes)
     * Returns {point: Vector3, axis: 'x'|'y'|null} or null
     */
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

    /**
     * Create or update snap indicator (2D HTML overlay)
     */
    function updateSnapIndicator(position, type) {
        // Hide 2D indicator if no position
        if (!position || !snapIndicator2D || !snapIcon || !snapLabel) {
            if (snapIndicator2D) snapIndicator2D.style.display = 'none';

            // Also remove 3D indicator
            if (snapIndicator) {
                scene.remove(snapIndicator);
                snapIndicator = null;
            }
            return;
        }

        // Convert 3D position to 2D screen coordinates
        const screenPos = position.clone().project(camera);
        const rect = renderer.domElement.getBoundingClientRect();
        const x = (screenPos.x * 0.5 + 0.5) * rect.width;
        const y = ((-screenPos.y) * 0.5 + 0.5) * rect.height;

        // Position the 2D indicator
        snapIndicator2D.style.left = (x - 10) + 'px'; // Center on point
        snapIndicator2D.style.top = (y - 10) + 'px';
        snapIndicator2D.style.display = 'block';

        // Update icon based on type
        let iconHTML = '';
        let labelText = '';

        switch (type) {
            case 'vertex':
                // Red square (끝점)
                iconHTML = '<div style="width: 16px; height: 16px; border: 3px solid #ff0000; background: transparent; box-sizing: border-box;"></div>';
                labelText = '끝점';
                break;

            case 'edge-midpoint':
                // Cyan triangle (중간점)
                iconHTML = '<div style="width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-bottom: 17px solid #00ffff; margin: 0 auto;"></div>';
                labelText = '중간점';
                break;

            case 'edge':
                // Cyan circle (선상의 점)
                iconHTML = '<div style="width: 14px; height: 14px; border: 3px solid #00ffff; border-radius: 50%; background: transparent; box-sizing: border-box; margin: 3px auto;"></div>';
                labelText = '선상의 점';
                break;

            case 'orthogonal':
                // Purple X (직교)
                iconHTML = `<div style="position: relative; width: 20px; height: 20px;">
                    <div style="position: absolute; width: 20px; height: 3px; background: #ff00ff; transform: rotate(45deg); top: 8px;"></div>
                    <div style="position: absolute; width: 20px; height: 3px; background: #ff00ff; transform: rotate(-45deg); top: 8px;"></div>
                </div>`;
                labelText = '직교';
                break;

            case 'first':
                // Green circle (첫 점으로 스냅)
                iconHTML = '<div style="width: 18px; height: 18px; border: 3px solid #00ff00; border-radius: 50%; background: rgba(0, 255, 0, 0.2); box-sizing: border-box; margin: 1px auto;"></div>';
                labelText = '첫 점';
                break;

            default:
                // Yellow circle (평면)
                iconHTML = '<div style="width: 12px; height: 12px; border: 2px solid #ffff00; border-radius: 50%; background: transparent; box-sizing: border-box; margin: 4px auto;"></div>';
                labelText = '평면';
                break;
        }

        snapIcon.innerHTML = iconHTML;
        snapLabel.textContent = labelText;

        // Also create small 3D marker
        if (snapIndicator) {
            scene.remove(snapIndicator);
            snapIndicator = null;
        }

        const geometry = new THREE.SphereGeometry(0.03, 8, 8);
        const color = type === 'vertex' ? 0xff0000 :
                     type === 'edge-midpoint' ? 0x00ffff :
                     type === 'edge' ? 0x00ffff :
                     type === 'orthogonal' ? 0xff00ff :
                     type === 'first' ? 0x00ff00 : 0xffff00;

        const material = new THREE.MeshBasicMaterial({
            color: color,
            depthTest: false,
            transparent: true,
            opacity: 0.5
        });

        snapIndicator = new THREE.Mesh(geometry, material);
        snapIndicator.position.copy(position);
        snapIndicator.renderOrder = 1001;
        scene.add(snapIndicator);
    }

    /**
     * Update 3D sketch line visualization
     */
    function update3DSketchLine() {
        // Remove old line
        if (sketch3DLine) {
            scene.remove(sketch3DLine);
            sketch3DLine = null;
        }

        if (sketchPoints3D.length < 2) return;

        // Create line geometry
        const points = sketchPoints3D.map(p => p.clone());
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0xff0000,
            linewidth: 2,
            depthTest: false,
            transparent: true
        });

        sketch3DLine = new THREE.Line(geometry, material);
        sketch3DLine.renderOrder = 999; // Render on top
        scene.add(sketch3DLine);
    }

    /**
     * Update preview line (from last point to current mouse position)
     */
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
        previewLine.renderOrder = 1000; // Render on top of sketch line
        scene.add(previewLine);
    }

    /**
     * Start sketch mode (after face is selected)
     */
    function startSketchMode() {
        if (!selectedFace) {
            showToast('먼저 작업면을 선택하세요', 'warning');
            return;
        }

        // Initialize 3D sketch mode
        sketchPoints3D = [];
        isSketchDrawing = true;

        // Attach event listeners to renderer canvas (not overlay)
        if (renderer && renderer.domElement) {
            renderer.domElement.addEventListener('mousedown', onSketchMouseDown);
            renderer.domElement.addEventListener('mousemove', onSketchMouseMove);
            renderer.domElement.style.cursor = 'crosshair';
        }

        // Attach keyboard event listener for dimension input
        document.addEventListener('keydown', onSketchKeyDown);

        // Get dimension input display element
        dimensionInputDisplay = document.getElementById('dimension-input-display');

        // Get 2D snap indicator elements
        snapIndicator2D = document.getElementById('snap-indicator-2d');
        snapIcon = document.getElementById('snap-icon');
        snapLabel = document.getElementById('snap-label');

        // OrbitControls stays enabled - user can rotate/pan with right-click/wheel

        // Enable buttons
        const clearSketchBtn = document.getElementById('clear-sketch-btn');
        const closeSketchBtn = document.getElementById('close-sketch-btn');
        if (clearSketchBtn) clearSketchBtn.disabled = false;
        if (closeSketchBtn) closeSketchBtn.disabled = false;

        showToast('스케치 시작: 왼쪽 클릭으로 점 추가. 우클릭/휠로 카메라 조작 가능', 'info');
        console.log('[3D Viewer] 3D Sketch mode started');
    }

    /**
     * Sketch event handlers (3D only - no 2D canvas)
     */
    function onSketchMouseDown(event) {
        // Only handle left click for adding points
        if (event.button !== 0) return;

        if (!isSketchDrawing || !selectedFace) return;

        // Don't add point via click if dimension input mode is active
        if (dimensionInputMode) {
            console.log('[3D Viewer] Dimension input mode active - use Enter to confirm');
            return;
        }

        const rect = renderer.domElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Use current snap point if available, otherwise raycast to face
        let point3D;

        if (currentSnapPoint) {
            // Use snap point
            point3D = currentSnapPoint.clone();
            console.log('[3D Viewer] Using snap point:', point3D);
        } else {
            // Raycast to face plane
            const mouseNDC = new THREE.Vector2(
                (x / rect.width) * 2 - 1,
                -(y / rect.height) * 2 + 1
            );

            raycaster.setFromCamera(mouseNDC, camera);
            const facePlane = new THREE.Plane();
            facePlane.setFromNormalAndCoplanarPoint(selectedFace.normal, selectedFace.point);

            point3D = new THREE.Vector3();
            raycaster.ray.intersectPlane(facePlane, point3D);

            if (!point3D) {
                console.warn('[3D Viewer] Could not project mouse to face plane');
                return;
            }
        }

        // Check for snap to first point (close polygon)
        const snapDistance3D = 0.2; // World units
        if (sketchPoints3D.length >= 3) {
            const firstPoint3D = sketchPoints3D[0];
            const distance3D = point3D.distanceTo(firstPoint3D);

            if (distance3D < snapDistance3D) {
                // Snap to first point and close sketch automatically
                console.log('[3D Viewer] Snapped to first point - auto closing sketch');
                closeSketch();
                return;
            }
        }

        // Add point to 3D array only
        sketchPoints3D.push(point3D);

        console.log('[3D Viewer] Added sketch point:', point3D, '(total:', sketchPoints3D.length, ')');

        // Update 3D visualization
        update3DSketchLine();
    }

    function onSketchMouseMove(event) {
        if (!isSketchDrawing || !selectedFace) return;

        const rect = renderer.domElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Raycast to face plane to get current 3D position
        const mouseNDC = new THREE.Vector2(
            (x / rect.width) * 2 - 1,
            -(y / rect.height) * 2 + 1
        );

        raycaster.setFromCamera(mouseNDC, camera);
        const facePlane = new THREE.Plane();
        facePlane.setFromNormalAndCoplanarPoint(selectedFace.normal, selectedFace.point);

        const point3D = new THREE.Vector3();
        raycaster.ray.intersectPlane(facePlane, point3D);

        if (!point3D) {
            // Clear preview and snap indicator if raycast fails
            updatePreviewLine(null);
            updateSnapIndicator(null, null);
            currentSnapPoint = null;
            return;
        }

        // If dimension input mode is active, use fixed direction
        if (dimensionInputMode && dimensionDirection && dimensionStartPoint) {
            // Calculate point along the direction based on input buffer
            const distance = parseFloat(dimensionInputBuffer) || 0;
            const targetPoint = dimensionStartPoint.clone().add(
                dimensionDirection.clone().multiplyScalar(distance)
            );

            updatePreviewLine(targetPoint, false);
            return;
        }

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

        // Snap priority (highest to lowest):
        // 1. First point snap (for closing polygon)
        // 2. Vertex snap
        // 3. Edge midpoint snap
        // 4. Orthogonal snap
        // 5. Edge snap

        let finalSnapPoint = point3D;
        let finalSnapType = null;
        let snapToFirst = false;

        // Check for snap to first point (highest priority when available)
        const snapDistance3D = 0.2; // World units
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
            // Check vertex/edge snaps
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

        // Update snap indicator
        updateSnapIndicator(finalSnapPoint, finalSnapType);

        // Update 3D preview line
        updatePreviewLine(finalSnapPoint, snapToFirst);
    }

    /**
     * Keyboard input handler for dimension entry
     */
    function onSketchKeyDown(event) {
        if (!isSketchDrawing || !selectedFace) return;

        const key = event.key;

        // Number keys (0-9) or decimal point
        if (/^[0-9.]$/.test(key)) {
            event.preventDefault();

            // Activate dimension input mode if there's at least one point
            if (sketchPoints3D.length > 0 && !dimensionInputMode) {
                dimensionInputMode = true;
                console.log('[3D Viewer] Dimension input mode activated');
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
            if (dimensionInputMode && dimensionInputBuffer.length > 0) {
                event.preventDefault();
                dimensionInputBuffer = dimensionInputBuffer.slice(0, -1);
                updateDimensionInputDisplay();

                // Exit dimension mode if buffer is empty
                if (dimensionInputBuffer.length === 0) {
                    cancelDimensionInput();
                }
            }
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
            if (dimensionInputMode) {
                event.preventDefault();
                cancelDimensionInput();
            }
        }
    }

    /**
     * Update dimension input display
     */
    function updateDimensionInputDisplay() {
        if (!dimensionInputDisplay) return;

        if (dimensionInputMode && dimensionInputBuffer.length > 0) {
            dimensionInputDisplay.style.display = 'block';
            const textElement = document.getElementById('dimension-input-text');
            if (textElement) {
                textElement.textContent = `길이: ${dimensionInputBuffer}`;
            }
        } else {
            dimensionInputDisplay.style.display = 'none';
        }
    }

    /**
     * Apply dimension input (Enter key)
     */
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

    /**
     * Cancel dimension input (Escape key or empty buffer)
     */
    function cancelDimensionInput() {
        dimensionInputMode = false;
        dimensionInputBuffer = '';
        dimensionDirection = null;
        dimensionStartPoint = null;

        if (dimensionInputDisplay) {
            dimensionInputDisplay.style.display = 'none';
        }

        // Note: Don't hide snap indicator here - it should continue showing geometry snaps

        console.log('[3D Viewer] Dimension input cancelled');
    }

    /**
     * Clear sketch
     */
    function clearSketch() {
        sketchPoints3D = [];

        // Remove 3D visualizations
        if (sketch3DLine) {
            scene.remove(sketch3DLine);
            sketch3DLine = null;
        }
        if (previewLine) {
            scene.remove(previewLine);
            previewLine = null;
        }
        if (snapIndicator) {
            scene.remove(snapIndicator);
            snapIndicator = null;
        }

        // Hide 2D snap indicator
        if (snapIndicator2D) {
            snapIndicator2D.style.display = 'none';
        }

        // Reset dimension input
        cancelDimensionInput();

        const applySketchSplitBtn = document.getElementById('apply-sketch-split-btn');
        if (applySketchSplitBtn) applySketchSplitBtn.disabled = true;

        console.log('[3D Viewer] Sketch cleared');
    }

    /**
     * Close sketch (complete polygon)
     */
    function closeSketch() {
        if (sketchPoints3D.length < 3) {
            showToast('최소 3개의 점이 필요합니다', 'warning');
            return;
        }

        // Add closing line to 3D visualization
        if (sketch3DLine && sketchPoints3D.length >= 3) {
            scene.remove(sketch3DLine);

            // Create closed polygon by including first point at the end
            const closedPoints = [...sketchPoints3D, sketchPoints3D[0]];
            const geometry = new THREE.BufferGeometry().setFromPoints(closedPoints);
            const material = new THREE.LineBasicMaterial({
                color: 0xff0000,
                linewidth: 2,
                depthTest: false,
                transparent: true
            });

            sketch3DLine = new THREE.Line(geometry, material);
            sketch3DLine.renderOrder = 999;
            scene.add(sketch3DLine);
        }

        // Remove preview line and snap indicator
        if (previewLine) {
            scene.remove(previewLine);
            previewLine = null;
        }
        if (snapIndicator) {
            scene.remove(snapIndicator);
            snapIndicator = null;
        }

        // Stop sketch drawing - remove event listeners
        isSketchDrawing = false;
        if (renderer && renderer.domElement) {
            renderer.domElement.removeEventListener('mousedown', onSketchMouseDown);
            renderer.domElement.removeEventListener('mousemove', onSketchMouseMove);
            renderer.domElement.style.cursor = 'default';
        }
        document.removeEventListener('keydown', onSketchKeyDown);

        // Hide dimension input display
        if (dimensionInputDisplay) {
            dimensionInputDisplay.style.display = 'none';
        }

        // Hide 2D snap indicator
        if (snapIndicator2D) {
            snapIndicator2D.style.display = 'none';
        }

        // Reset dimension input mode
        dimensionInputMode = false;
        dimensionInputBuffer = '';
        dimensionDirection = null;
        dimensionStartPoint = null;

        // Disable clear and close buttons, enable apply button
        const clearSketchBtn = document.getElementById('clear-sketch-btn');
        const closeSketchBtn = document.getElementById('close-sketch-btn');
        const applySketchSplitBtn = document.getElementById('apply-sketch-split-btn');

        if (clearSketchBtn) clearSketchBtn.disabled = true;
        if (closeSketchBtn) closeSketchBtn.disabled = true;
        if (applySketchSplitBtn) applySketchSplitBtn.disabled = false;

        showToast('스케치 완료! 분할을 적용하세요', 'success');
        console.log('[3D Viewer] Sketch closed with', sketchPoints3D.length, 'points');
    }

    /**
     * Apply sketch split
     */
    function applySketchSplit() {
        if (!selectedObject || !selectedFace || sketchPoints3D.length < 3) {
            showToast('스케치가 완료되지 않았습니다', 'warning');
            return;
        }

        // ▼▼▼ [수정] 분할된 객체도 재분할 가능 ▼▼▼
        if (selectedObject.userData.isSplitPart || selectedObject.userData.isSplitElement) {
            console.log('[3D Viewer] Re-splitting an already-split object with sketch (nested split)');
            console.log('  - Parent split ID:', selectedObject.userData.splitElementId);
        } else {
            console.log('[3D Viewer] Sketch splitting original BIM object');
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        console.log('[3D Viewer] Starting sketch split operation...');
        console.log('[3D Viewer] Sketch points (3D):', sketchPoints3D);

        try {
            // Step 1: Use already computed 3D points (no conversion needed)
            const sketch3DPoints = sketchPoints3D;
            console.log('[3D Viewer] Using 3D sketch points:', sketch3DPoints.length, 'points');

            // Step 2: Create extrusion geometry from sketch
            const extrusionDepth = calculateExtrusionDepth(selectedObject);
            const extrusionGeometry = createExtrusionFromSketch(sketch3DPoints, selectedFace, extrusionDepth);
            console.log('[3D Viewer] Extrusion geometry created');

            // Step 3: Visualize extrusion for debugging
            visualizeExtrusion(extrusionGeometry);

            // Step 4: Perform Boolean operations using ThreeBSP
            // Check if ThreeBSP is loaded
            console.log('[3D Viewer] Checking ThreeBSP library...');
            console.log('  - ThreeBSP:', typeof ThreeBSP);

            if (typeof ThreeBSP === 'undefined') {
                console.error('[3D Viewer] ThreeBSP library not loaded. Cannot proceed.');
                showToast('CSG 라이브러리가 로드되지 않았습니다. 페이지를 새로고침하세요.', 'error');
                return;
            }

            console.log('[3D Viewer] Starting ThreeBSP Boolean operations...');

            // Apply transformations to geometries to work in world space
            selectedObject.updateMatrixWorld(true);
            const originalGeometry = selectedObject.geometry.clone();
            originalGeometry.applyMatrix4(selectedObject.matrixWorld);

            console.log('[3D Viewer] Original object world matrix:', selectedObject.matrixWorld);
            console.log('[3D Viewer] Original geometry transformed to world space');

            // Extrusion is already in world space, no transformation needed

            // Convert to BSP (pass mesh with identity matrix since geometry is already in world space)
            console.log('[3D Viewer] Converting to BSP format...');
            const originalMesh = new THREE.Mesh(originalGeometry);
            originalMesh.updateMatrix(); // Ensure matrix is identity

            const extrusionMesh = new THREE.Mesh(extrusionGeometry);
            extrusionMesh.updateMatrix(); // Ensure matrix is identity

            const originalBSP = new ThreeBSP(originalMesh);
            const extrusionBSP = new ThreeBSP(extrusionMesh);

            console.log('[3D Viewer] BSP created with identity matrices (geometry already in world space)');

            console.log('[3D Viewer] Performing SUBTRACT operation...');
            // Operation 1: Original - Extrusion = Remainder (main object with hole)
            const remainderBSP = originalBSP.subtract(extrusionBSP);

            console.log('[3D Viewer] Performing INTERSECT operation...');
            // Operation 2: Original ∩ Extrusion = Extracted part
            const extractedBSP = originalBSP.intersect(extrusionBSP);

            console.log('[3D Viewer] Converting BSP back to BufferGeometry...');
            const remainderBufferGeometry = remainderBSP.toGeometry();
            const extractedBufferGeometry = extractedBSP.toGeometry();

            console.log('[3D Viewer] CSG operations complete');
            console.log('  - Remainder geometry:', remainderBufferGeometry);
            console.log('  - Extracted geometry:', extractedBufferGeometry);

            // Validate results
            if (!remainderBufferGeometry.attributes.position || !extractedBufferGeometry.attributes.position ||
                remainderBufferGeometry.attributes.position.count === 0 ||
                extractedBufferGeometry.attributes.position.count === 0) {
                console.error('[3D Viewer] CSG operation produced empty geometry');
                showToast('분할 연산 실패: 빈 형상이 생성되었습니다', 'error');
                return;
            }

            // Normals are already computed in toGeometry()
            console.log('[3D Viewer] Geometries validated and ready');

            // Get original material
            let originalMaterial = originalMaterials.get(selectedObject);
            if (!originalMaterial) {
                originalMaterial = new THREE.MeshStandardMaterial({
                    color: 0xcccccc,
                    metalness: 0.0,
                    roughness: 1.0,
                    flatShading: true,
                    side: THREE.DoubleSide
                });
            }

            const remainderMaterial = originalMaterial.clone();
            const extractedMaterial = originalMaterial.clone();
            remainderMaterial.flatShading = true;
            extractedMaterial.flatShading = true;

            const remainderMesh = new THREE.Mesh(remainderBufferGeometry, remainderMaterial);
            const extractedMesh = new THREE.Mesh(extractedBufferGeometry, extractedMaterial);

            // Enable shadows
            remainderMesh.castShadow = true;
            remainderMesh.receiveShadow = true;
            extractedMesh.castShadow = true;
            extractedMesh.receiveShadow = true;

            // Add boundary edges
            const remainderBoundaryGeometry = getBoundaryEdges(remainderBufferGeometry);
            const remainderLineSegments = new THREE.LineSegments(
                remainderBoundaryGeometry,
                new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
            );
            remainderMesh.add(remainderLineSegments);

            const extractedBoundaryGeometry = getBoundaryEdges(extractedBufferGeometry);
            const extractedLineSegments = new THREE.LineSegments(
                extractedBoundaryGeometry,
                new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
            );
            extractedMesh.add(extractedLineSegments);

            // Preserve original color
            const preservedOriginalColor = selectedObject.userData.originalColor ||
                                          originalMaterial.color.clone();

            // ▼▼▼ [추가] parentSplitId 설정 ▼▼▼
            const parentSplitId = selectedObject.userData.splitElementId || null;
            console.log('[3D Viewer] Parent split ID for sketch meshes:', parentSplitId);
            // ▲▲▲ [추가] 여기까지 ▲▲▲

            // Store metadata (will be updated with volume info after calculation)
            remainderMesh.userData = {
                ...selectedObject.userData,
                isSplitPart: true,
                isSplitElement: true,  // 분할 객체임을 표시
                splitPartType: 'remainder',
                splitMethod: 'sketch',
                originalObjectId: selectedObject.userData.bimObjectId || selectedObject.userData.originalObjectId,
                parentSplitId: parentSplitId,  // ▼▼▼ [추가] 부모 분할 ID ▼▼▼
                originalColor: preservedOriginalColor.clone(),
                displayColor: remainderMaterial.color.clone()
            };

            extractedMesh.userData = {
                ...selectedObject.userData,
                isSplitPart: true,
                isSplitElement: true,  // 분할 객체임을 표시
                splitPartType: 'extracted',
                splitMethod: 'sketch',
                originalObjectId: selectedObject.userData.bimObjectId || selectedObject.userData.originalObjectId,
                parentSplitId: parentSplitId,  // ▼▼▼ [추가] 부모 분할 ID ▼▼▼
                originalColor: preservedOriginalColor.clone(),
                displayColor: extractedMaterial.color.clone()
            };

            // Compute bounding boxes and spheres
            remainderBufferGeometry.computeBoundingBox();
            remainderBufferGeometry.computeBoundingSphere();
            extractedBufferGeometry.computeBoundingBox();
            extractedBufferGeometry.computeBoundingSphere();

            console.log('[3D Viewer] Geometries ready - normals and bounds computed');

            // ===== Calculate volumes for sketch split =====
            console.log('[3D Viewer] Calculating volumes for sketch split...');

            // Calculate original geometry volume (before split)
            const originalSketchGeometry = selectedObject.geometry;
            const originalSketchVolume = calculateGeometryVolume(originalSketchGeometry);

            console.log('[3D Viewer] === REMAINDER GEOMETRY VOLUME CALCULATION ===');
            const remainderVolume = calculateGeometryVolume(remainderBufferGeometry, true);

            console.log('[3D Viewer] === EXTRACTED GEOMETRY VOLUME CALCULATION ===');
            const extractedVolume = calculateGeometryVolume(extractedBufferGeometry, true);

            // Determine the original BIM object volume (최초 BIM 원본 volume)
            let originalBIMVolume;
            if (selectedObject.userData.originalGeometryVolume) {
                // Already a split part - preserve original BIM volume
                originalBIMVolume = selectedObject.userData.originalGeometryVolume;
                console.log('[3D Viewer] Using parent originalGeometryVolume:', originalBIMVolume.toFixed(6));
            } else if (selectedObject.userData.geometry_volume) {
                // First split of original BIM object - use DB volume
                originalBIMVolume = selectedObject.userData.geometry_volume;
                console.log('[3D Viewer] Using BIM geometry_volume from DB:', originalBIMVolume.toFixed(6));
            } else {
                // Fallback: use calculated volume
                originalBIMVolume = originalSketchVolume;
                console.log('[3D Viewer] Using calculated volume as original:', originalBIMVolume.toFixed(6));
            }

            const totalSketchSplitVolume = remainderVolume + extractedVolume;

            // Calculate volume ratios based on ORIGINAL BIM VOLUME
            const remainderRatio = originalBIMVolume > 0 ? remainderVolume / originalBIMVolume : 0.5;
            const extractedRatio = originalBIMVolume > 0 ? extractedVolume / originalBIMVolume : 0.5;

            console.log('[3D Viewer] Sketch split volume summary:');
            console.log('  - Remainder: ' + remainderVolume.toFixed(6) + ' (' + (remainderRatio * 100).toFixed(2) + '%)');
            console.log('  - Extracted: ' + extractedVolume.toFixed(6) + ' (' + (extractedRatio * 100).toFixed(2) + '%)');
            console.log('  - Total split: ' + totalSketchSplitVolume.toFixed(6));
            console.log('  - Immediate parent: ' + originalSketchVolume.toFixed(6));
            console.log('  - Original BIM: ' + originalBIMVolume.toFixed(6));
            console.log('  - Preservation: ' + ((totalSketchSplitVolume / originalSketchVolume) * 100).toFixed(2) + '%');

            // Update userData with volume information
            remainderMesh.userData.originalGeometryVolume = originalBIMVolume;  // 최초 BIM 원본 (변하지 않음)
            remainderMesh.userData.geometryVolume = remainderVolume;
            remainderMesh.userData.volumeRatio = remainderRatio;

            extractedMesh.userData.originalGeometryVolume = originalBIMVolume;  // 최초 BIM 원본 (변하지 않음)
            extractedMesh.userData.geometryVolume = extractedVolume;
            extractedMesh.userData.volumeRatio = extractedRatio;

            // Clear selection and restore material before removing object
            if (selectedObject) {
                const originalMat = originalMaterials.get(selectedObject);
                if (originalMat) {
                    selectedObject.material = originalMat;
                }
            }

            // Remove original object and visualization
            scene.remove(selectedObject);
            selectedObject = null; // Clear selection

            // Remove extrusion visualization
            const extrusionViz = scene.getObjectByName('sketch-extrusion-visualization');
            if (extrusionViz) {
                scene.remove(extrusionViz);
            }

            // Add split parts to scene
            scene.add(remainderMesh);
            scene.add(extractedMesh);

            // Store in original materials map for future operations
            originalMaterials.set(remainderMesh, remainderMaterial.clone());
            originalMaterials.set(extractedMesh, extractedMaterial.clone());

            console.log('[3D Viewer] Sketch split complete - objects added to scene');
            console.log('  - Remainder vertices:', remainderBufferGeometry.attributes.position.count);
            console.log('  - Extracted vertices:', extractedBufferGeometry.attributes.position.count);

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
            // ▲▲▲ [추가] 여기까지 ▲▲▲

            showToast('스케치 분할 완료', 'success');

            // Save split elements to database
            const sketchInfo = {
                method: 'sketch',
                sketchData: {
                    sketchPoints: sketchPoints3D.map(p => [p.x, p.y, p.z]),
                    faceNormal: selectedFace ? [
                        selectedFace.normal.x,
                        selectedFace.normal.y,
                        selectedFace.normal.z
                    ] : null
                }
            };
            saveSplitToDatabase(remainderMesh, sketchInfo);
            saveSplitToDatabase(extractedMesh, sketchInfo);

            // Exit sketch mode
            exitSketchMode();

        } catch (error) {
            console.error('[3D Viewer] Sketch split failed:', error);
            showToast('스케치 분할 실패: ' + error.message, 'error');
        }
    }

    /**
     * Convert 2D sketch points to 3D world coordinates
     */
    function convertSketchTo3D(points2D, face) {
        const points3D = [];

        // Get canvas dimensions
        const canvas = renderer.domElement;
        const canvasRect = canvas.getBoundingClientRect();

        for (const point2D of points2D) {
            // Convert canvas coordinates to NDC (Normalized Device Coordinates)
            const x = (point2D.x / canvasRect.width) * 2 - 1;
            const y = -(point2D.y / canvasRect.height) * 2 + 1;

            // Create raycaster from screen point
            const mouse = new THREE.Vector2(x, y);
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);

            // Intersect with a plane at the selected face
            const facePlane = new THREE.Plane();
            facePlane.setFromNormalAndCoplanarPoint(face.normal, face.point);

            const intersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(facePlane, intersection);

            if (intersection) {
                points3D.push(intersection);
            } else {
                console.warn('[3D Viewer] Could not project point to face plane:', point2D);
            }
        }

        return points3D;
    }

    /**
     * Calculate appropriate extrusion depth based on object size
     */
    function calculateExtrusionDepth(object) {
        object.geometry.computeBoundingBox();
        const bbox = object.geometry.boundingBox;

        // Use longest dimension as reference
        const sizeX = bbox.max.x - bbox.min.x;
        const sizeY = bbox.max.y - bbox.min.y;
        const sizeZ = bbox.max.z - bbox.min.z;
        const maxSize = Math.max(sizeX, sizeY, sizeZ);

        // Extrusion depth = 150% of max size to ensure it cuts through
        return maxSize * 1.5;
    }

    /**
     * Create extrusion geometry from 3D sketch points
     */
    function createExtrusionFromSketch(points3D, face, depth) {
        // Create a shape from the 3D points
        // We need to project them to a local 2D coordinate system on the face plane

        // Create local coordinate system on the face
        const normal = face.normal.clone();
        const tangent = new THREE.Vector3();
        const bitangent = new THREE.Vector3();

        // Find tangent (perpendicular to normal)
        if (Math.abs(normal.x) < 0.9) {
            tangent.set(1, 0, 0);
        } else {
            tangent.set(0, 1, 0);
        }
        tangent.cross(normal).normalize();

        // Bitangent (perpendicular to both)
        bitangent.crossVectors(normal, tangent).normalize();

        console.log('[3D Viewer] Local coordinate system:');
        console.log('  Normal:', normal);
        console.log('  Tangent:', tangent);
        console.log('  Bitangent:', bitangent);

        // Project 3D points to 2D local coordinates
        const points2DLocal = points3D.map(p => {
            const localPoint = p.clone().sub(face.point);
            return new THREE.Vector2(
                localPoint.dot(tangent),
                localPoint.dot(bitangent)
            );
        });

        console.log('[3D Viewer] Local 2D points:', points2DLocal);

        // Create Three.js Shape
        const shape = new THREE.Shape();
        if (points2DLocal.length > 0) {
            shape.moveTo(points2DLocal[0].x, points2DLocal[0].y);
            for (let i = 1; i < points2DLocal.length; i++) {
                shape.lineTo(points2DLocal[i].x, points2DLocal[i].y);
            }
            shape.lineTo(points2DLocal[0].x, points2DLocal[0].y); // Close the shape
        }

        // Extrude the shape
        const extrudeSettings = {
            depth: depth,
            bevelEnabled: false
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // Transform geometry to world space
        // The extrusion is in local 2D space, we need to transform it
        const matrix = new THREE.Matrix4();

        // Create transformation matrix from local coordinate system
        // Column 1: tangent, Column 2: bitangent, Column 3: -normal (extrude inward)
        matrix.set(
            tangent.x, bitangent.x, -normal.x, face.point.x,
            tangent.y, bitangent.y, -normal.y, face.point.y,
            tangent.z, bitangent.z, -normal.z, face.point.z,
            0, 0, 0, 1
        );

        geometry.applyMatrix4(matrix);

        return geometry;
    }

    /**
     * Visualize extrusion for debugging
     */
    function visualizeExtrusion(geometry) {
        // Remove previous visualization
        const oldVisualization = scene.getObjectByName('sketch-extrusion-visualization');
        if (oldVisualization) {
            scene.remove(oldVisualization);
        }

        // Create mesh with semi-transparent material
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            wireframe: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'sketch-extrusion-visualization';
        scene.add(mesh);

        // Add wireframe
        const wireframe = new THREE.WireframeGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
        const wireframeMesh = new THREE.LineSegments(wireframe, lineMaterial);
        mesh.add(wireframeMesh);

        console.log('[3D Viewer] Extrusion visualized (green semi-transparent)');
        showToast('녹색 반투명 영역이 분할될 부분입니다', 'info');
    }

    // ===== VISIBILITY CONTROL FUNCTIONS =====

    /**
     * Get unique ID for an object (BIM object or split element)
     */
    function getObjectId(object) {
        if (!object || !object.userData) return null;

        // Priority: splitElementId (for split parts) > bimObjectId (for originals)
        return object.userData.splitElementId || object.userData.bimObjectId;
    }

    /**
     * Isolate selected object (hide all others)
     */
    function isolateSelection() {
        if (!selectedObject) {
            showToast('객체를 먼저 선택해주세요', 'warning');
            return;
        }

        const selectedId = getObjectId(selectedObject);
        if (!selectedId) {
            showToast('선택된 객체의 ID를 찾을 수 없습니다', 'error');
            return;
        }

        console.log('[3D Viewer] Isolating object:', selectedId);

        // Hide all objects except selected
        hiddenObjectIds.clear();
        let totalMeshCount = 0;
        let validObjectCount = 0;
        scene.traverse((object) => {
            if (object.isMesh) {
                totalMeshCount++;
                const objectId = getObjectId(object);
                if (objectId) {
                    validObjectCount++;
                    console.log('[3D Viewer] Found mesh:', {
                        bimObjectId: object.userData.bimObjectId,
                        splitElementId: object.userData.splitElementId,
                        rawElementId: object.userData.rawElementId,
                        objectId: objectId,
                        isSelected: objectId === selectedId
                    });
                    if (objectId !== selectedId) {
                        object.visible = false;
                        hiddenObjectIds.add(objectId);
                    }
                }
            }
        });

        console.log('[3D Viewer] Scene stats - Total meshes:', totalMeshCount, 'Valid objects:', validObjectCount);
        console.log('[3D Viewer] Hidden', hiddenObjectIds.size, 'objects');
        showToast(`선택된 객체만 표시 (${hiddenObjectIds.size}개 숨김)`, 'success');

        // Persist visibility state
        window.viewerVisibilityState = { hiddenObjectIds: Array.from(hiddenObjectIds) };

        // Update button states
        updateVisibilityControlButtons();
    }

    /**
     * Hide selected object
     */
    function hideSelection() {
        if (!selectedObject) {
            showToast('객체를 먼저 선택해주세요', 'warning');
            return;
        }

        const selectedId = getObjectId(selectedObject);
        if (!selectedId) {
            showToast('선택된 객체의 ID를 찾을 수 없습니다', 'error');
            return;
        }

        console.log('[3D Viewer] Hiding object:', selectedId);

        // Hide the selected object
        selectedObject.visible = false;
        hiddenObjectIds.add(selectedId);

        // Deselect the object
        deselectObject();

        console.log('[3D Viewer] Object hidden. Total hidden:', hiddenObjectIds.size);
        showToast('선택된 객체를 숨겼습니다', 'success');

        // Persist visibility state
        window.viewerVisibilityState = { hiddenObjectIds: Array.from(hiddenObjectIds) };

        // Update button states (called after deselectObject, so buttons will be updated correctly)
        updateVisibilityControlButtons();
    }

    /**
     * Show all hidden objects
     */
    function showAll() {
        console.log('[3D Viewer] ========================================');
        console.log('[3D Viewer] showAll called');
        console.log('[3D Viewer] Current hiddenObjectIds size:', hiddenObjectIds.size);
        console.log('[3D Viewer] Selected object:', selectedObject ? getObjectId(selectedObject) : 'none');

        let restoredCount = 0;
        let totalMeshes = 0;
        scene.traverse((object) => {
            if (object.isMesh) {
                totalMeshes++;
                const objectId = getObjectId(object);
                if (objectId) {
                    const wasHidden = !object.visible;
                    if (wasHidden) {
                        object.visible = true;
                        restoredCount++;
                        console.log('[3D Viewer] Restored object:', objectId);
                    }
                }
            }
        });

        hiddenObjectIds.clear();

        console.log('[3D Viewer] Total meshes:', totalMeshes);
        console.log('[3D Viewer] Restored', restoredCount, 'objects');
        console.log('[3D Viewer] ========================================');

        showToast(`모든 객체 표시 (${restoredCount}개 복원)`, 'success');

        // Persist visibility state
        window.viewerVisibilityState = { hiddenObjectIds: [] };

        // Update button states
        updateVisibilityControlButtons();

        // Force render update
        if (window.render && typeof window.render === 'function') {
            window.render();
        }
    }

    /**
     * Restore visibility state (called after loading geometry or tab switch)
     */
    function restoreVisibilityState() {
        if (!window.viewerVisibilityState || !window.viewerVisibilityState.hiddenObjectIds) {
            return;
        }

        const savedHiddenIds = new Set(window.viewerVisibilityState.hiddenObjectIds);
        if (savedHiddenIds.size === 0) {
            return;
        }

        console.log('[3D Viewer] Restoring visibility state...');
        console.log('[3D Viewer] Hidden object IDs:', Array.from(savedHiddenIds));

        hiddenObjectIds = savedHiddenIds;
        let hiddenCount = 0;

        scene.traverse((object) => {
            if (object.isMesh) {
                const objectId = getObjectId(object);
                if (objectId && hiddenObjectIds.has(objectId)) {
                    object.visible = false;
                    hiddenCount++;
                }
            }
        });

        console.log('[3D Viewer] Visibility state restored:', hiddenCount, 'objects hidden');
    }

    /**
     * Update visibility control button states based on selection
     */
    function updateVisibilityControlButtons() {
        const isolateBtn = document.getElementById('isolate-selection-btn');
        const hideBtn = document.getElementById('hide-selection-btn');
        const showAllBtn = document.getElementById('show-all-btn');

        // ▼▼▼ [수정] 복수 선택 지원 ▼▼▼
        const hasSelection = selectedObject !== null || selectedObjects.length > 0;
        // ▲▲▲ [수정] 여기까지 ▲▲▲
        const hasHiddenObjects = hiddenObjectIds.size > 0;

        console.log('[3D Viewer] updateVisibilityControlButtons called');
        console.log('[3D Viewer] - hasSelection:', hasSelection);
        console.log('[3D Viewer] - hasHiddenObjects:', hasHiddenObjects);
        console.log('[3D Viewer] - hiddenObjectIds.size:', hiddenObjectIds.size);

        if (isolateBtn) {
            isolateBtn.disabled = !hasSelection;
            console.log('[3D Viewer] - isolateBtn.disabled:', isolateBtn.disabled);
        }

        if (hideBtn) {
            hideBtn.disabled = !hasSelection;
            console.log('[3D Viewer] - hideBtn.disabled:', hideBtn.disabled);
        }

        if (showAllBtn) {
            showAllBtn.disabled = !hasHiddenObjects;
            console.log('[3D Viewer] - showAllBtn.disabled:', showAllBtn.disabled);
        }
    }

    // Expose visibility functions globally for external calls
    window.restoreViewerVisibilityState = restoreVisibilityState;

    // ▼▼▼ [추가] 3D 뷰어 선택 객체 정보 가져오기 함수 ▼▼▼
    /**
     * Get currently selected object in 3D viewer
     * @returns {Object|null} Selected object with userData containing raw_element_id, split_element_id, etc.
     */
    window.getViewerSelectedObject = function() {
        return selectedObject;
    };

    /**
     * Get all currently selected objects in 3D viewer
     * @returns {Array} Array of selected objects with userData
     */
    window.getViewerSelectedObjects = function() {
        return selectedObjects.length > 0 ? selectedObjects : (selectedObject ? [selectedObject] : []);
    };

    /**
     * Select object in 3D viewer by raw_element_id or split_element_id
     * @param {string} elementId - raw_element_id or split_element_id to select
     * @param {boolean} isSplitElement - true if elementId is a split_element_id
     */
    window.selectObjectInViewer = function(elementId, isSplitElement = false) {
        if (!scene) {
            console.warn('[3D Viewer] Scene not initialized');
            return;
        }

        // Deselect current object first
        if (selectedObject) {
            deselectObject();
        }

        // Find the object in the scene
        let targetObject = null;
        scene.traverse((child) => {
            if (child.isMesh && child.userData) {
                if (isSplitElement) {
                    // Check for splitElementId (stored in camelCase in userData)
                    if (child.userData.splitElementId === elementId) {
                        targetObject = child;
                        return;
                    }
                } else {
                    // Check for rawElementId (stored in camelCase in userData)
                    if (child.userData.rawElementId === elementId) {
                        targetObject = child;
                        return;
                    }
                }
            }
        });

        if (targetObject) {
            selectObject(targetObject);

            // Focus camera on selected object
            if (controls && targetObject.geometry) {
                targetObject.geometry.computeBoundingBox();
                const box = targetObject.geometry.boundingBox.clone();
                box.applyMatrix4(targetObject.matrixWorld);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = camera.fov * (Math.PI / 180);
                let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
                cameraZ *= 1.5; // Zoom out a bit

                camera.position.set(center.x, center.y, center.z + cameraZ);
                controls.target.copy(center);
                controls.update();
            }

            console.log('[3D Viewer] Object selected:', elementId);
            return true;
        } else {
            console.warn('[3D Viewer] Object not found:', elementId);
            return false;
        }
    };

    /**
     * Select multiple objects in 3D viewer by their IDs
     * @param {Array} elementData - Array of {id: string, isSplitElement: boolean} objects
     * @returns {number} Number of objects successfully selected
     */
    window.selectMultipleObjectsInViewer = function(elementData) {
        if (!scene) {
            console.warn('[3D Viewer] Scene not initialized');
            return 0;
        }

        if (!elementData || elementData.length === 0) {
            console.warn('[3D Viewer] No element data provided');
            return 0;
        }

        console.log(`[3D Viewer] Selecting multiple objects: ${elementData.length} elements`);

        // Find all matching objects
        const objectsToSelect = [];
        const foundIds = new Set();

        elementData.forEach(data => {
            const elementId = data.id;
            const isSplitElement = data.isSplitElement || false;

            scene.traverse((child) => {
                if (child.isMesh && child.userData && !foundIds.has(elementId)) {
                    if (isSplitElement) {
                        if (child.userData.splitElementId === elementId) {
                            objectsToSelect.push(child);
                            foundIds.add(elementId);
                        }
                    } else {
                        if (child.userData.rawElementId === elementId) {
                            objectsToSelect.push(child);
                            foundIds.add(elementId);
                        }
                    }
                }
            });
        });

        if (objectsToSelect.length > 0) {
            selectMultipleObjects(objectsToSelect);

            // Focus camera on the center of all selected objects
            if (controls && objectsToSelect.length > 0) {
                const boundingBox = new THREE.Box3();
                objectsToSelect.forEach(obj => {
                    if (obj.geometry) {
                        obj.geometry.computeBoundingBox();
                        const box = obj.geometry.boundingBox.clone();
                        box.applyMatrix4(obj.matrixWorld);
                        boundingBox.union(box);
                    }
                });

                const center = boundingBox.getCenter(new THREE.Vector3());
                const size = boundingBox.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = camera.fov * (Math.PI / 180);
                let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
                cameraZ *= 1.5; // Zoom out a bit

                camera.position.set(center.x, center.y, center.z + cameraZ);
                controls.target.copy(center);
                controls.update();
            }

            console.log(`[3D Viewer] Successfully selected ${objectsToSelect.length} objects`);
            return objectsToSelect.length;
        } else {
            console.warn('[3D Viewer] No objects found matching provided IDs');
            return 0;
        }
    };
    // ▲▲▲ [추가] 여기까지 ▲▲▲

})();
