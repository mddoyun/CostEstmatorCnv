// three_d_viewer.js
// 3D Viewer for BIM geometry visualization
// Uses global THREE object loaded from CDN

(function() {
    let scene, camera, renderer, controls;
    let geometryLoaded = false;
    let raycaster, mouse;
    let selectedObject = null;
    let originalMaterials = new Map(); // Store original materials for deselection

    // For cycling through overlapping objects
    let lastClickPosition = null;
    let lastIntersects = [];
    let currentIntersectIndex = 0;

    // Cache for cost items with unit price information from BOQ report
    let costItemsWithPrices = [];

    window.initThreeDViewer = function() {
        console.log("[3D Viewer] Initializing 3D Viewer...");

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

        // Add click event listener for object selection
        canvas.addEventListener('click', onCanvasClick, false);

        // Start animation loop
        animate();

        // Handle window resize
        window.addEventListener('resize', onWindowResize, false);

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

        // ▼▼▼ [추가] 분할 객체 데이터 준비 ▼▼▼
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
        // ▲▲▲ [수정] 여기까지 ▲▲▲
    };  // ▼▼▼ [수정] 전역 함수이므로 세미콜론 추가 ▼▼▼

    window.clearScene = function() {
        if (!scene) {
            console.error("[3D Viewer] Scene not initialized!");
            return;
        }

        // Deselect any selected object
        deselectObject();

        // Remove all meshes from scene
        const objectsToRemove = [];
        scene.traverse(function(object) {
            if (object instanceof THREE.Mesh) {
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

        // Clear original materials map
        originalMaterials.clear();

        // Re-add essential scene elements
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1).normalize();
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

                // ▼▼▼ [수정] 분할 객체는 이미 world space이므로 변환 건너뛰기 ▼▼▼
                // Apply transformation matrix if available
                // Split objects are already in world space, so skip transformation
                if (!bimObject.isSplitElement && geomData.matrix && geomData.matrix.length === 16) {
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
                }
                // ▲▲▲ [수정] 여기까지 ▲▲▲

                // ▼▼▼ [수정] BIM 원본 객체와 분할 객체 구분하여 userData 설정 ▼▼▼
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

    // Handle canvas click for object selection
    function onCanvasClick(event) {
        if (!scene || !camera || !raycaster) return;

        const canvas = document.getElementById('three-d-canvas');
        const rect = canvas.getBoundingClientRect();

        // Calculate mouse position in normalized device coordinates (-1 to +1)
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update raycaster
        raycaster.setFromCamera(mouse, camera);

        // Get all BIM meshes (exclude helpers like axes, grid, lights)
        const bimMeshes = [];
        scene.traverse(function(object) {
            // ▼▼▼ [수정] DB에서 로드한 분할 객체(isSplitElement)도 포함 ▼▼▼
            // Include both original BIM objects and split parts (isSplitPart from runtime split, isSplitElement from DB)
            if (object instanceof THREE.Mesh && object.userData &&
                (object.userData.bimObjectId || object.userData.isSplitPart || object.userData.isSplitElement)) {
                bimMeshes.push(object);
            }
            // ▲▲▲ [수정] 여기까지 ▲▲▲
        });

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
                    selectObject(clickedObject);
                }
            } else {
                console.warn('[3D Viewer] Clicked object is not a valid BIM mesh:', clickedObject);
                deselectObject();
            }
            // ▲▲▲ [수정] 여기까지 ▲▲▲
        } else {
            // Clicked on empty space - deselect and reset cycle
            lastClickPosition = null;
            lastIntersects = [];
            currentIntersectIndex = 0;
            deselectObject();
        }
    }

    // Select an object
    function selectObject(object) {
        // Deselect previous object
        if (selectedObject) {
            deselectObject();
        }

        selectedObject = object;

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

        // ▼▼▼ [수정] 분할 객체가 아닌 경우에만 분할 버튼 활성화 ▼▼▼
        const isSplitObject = object.userData.isSplitPart || object.userData.isSplitElement;

        const splitBtn = document.getElementById('split-object-btn');
        if (splitBtn) {
            splitBtn.disabled = isSplitObject;
            if (isSplitObject) {
                splitBtn.title = "이미 분할된 객체는 재분할할 수 없습니다";
            } else {
                splitBtn.title = "객체 분할";
            }
        }

        const sketchSplitBtn = document.getElementById('sketch-split-btn');
        if (sketchSplitBtn) {
            sketchSplitBtn.disabled = isSplitObject;
            if (isSplitObject) {
                sketchSplitBtn.title = "이미 분할된 객체는 재분할할 수 없습니다";
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

                if (object.userData.splitPosition !== undefined) {
                    console.log('  - Split Position:', object.userData.splitPosition.toFixed(2));
                }
            }
            // ▲▲▲ [수정] 여기까지 ▲▲▲
            console.log('[3D Viewer] =======================');
        }
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
    }

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
    function displayQuantityMembers(object) {
        const listContainer = document.getElementById('three-d-quantity-members-list');
        if (!listContainer) return;

        // ▼▼▼ [수정] DB에서 로드한 분할 객체(rawElementId)도 포함 ▼▼▼
        // Get BIM object ID (use originalObjectId for split parts, rawElementId for DB-loaded splits)
        const bimObjectId = object.userData.bimObjectId || object.userData.originalObjectId || object.userData.rawElementId;

        if (!bimObjectId) {
            listContainer.innerHTML = '<p class="no-selection">객체 ID를 찾을 수 없습니다</p>';
            return;
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // Find all quantity members linked to this BIM object
        const quantityMembers = findQuantityMembersByRawElementId(bimObjectId);

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

        // Find all quantity members where raw_element_id matches this ID
        const results = window.loadedQuantityMembers.filter(qm => {
            // raw_element_id can be number or string, so convert both to string for comparison
            return qm.raw_element_id && qm.raw_element_id.toString() === rawElementId.toString();
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
        console.log('[3D Viewer] displayCostItems called');
        const tableContainer = document.getElementById('three-d-cost-items-table');
        if (!tableContainer) {
            console.error('[3D Viewer] Cost items table container not found');
            return;
        }

        // ▼▼▼ [수정] DB에서 로드한 분할 객체(rawElementId)도 포함 ▼▼▼
        // Get BIM object ID (use originalObjectId for split parts, rawElementId for DB-loaded splits)
        const bimObjectId = object.userData.bimObjectId || object.userData.originalObjectId || object.userData.rawElementId;

        if (!bimObjectId) {
            tableContainer.innerHTML = '<p class="no-selection">객체 ID를 찾을 수 없습니다</p>';
            return;
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        console.log('[3D Viewer] BIM Object ID:', bimObjectId);

        // Find all quantity members linked to this BIM object
        const quantityMembers = findQuantityMembersByRawElementId(bimObjectId);
        console.log('[3D Viewer] Found quantity members for cost items:', quantityMembers);

        if (quantityMembers.length === 0) {
            console.warn('[3D Viewer] No quantity members found for BIM object');
            tableContainer.innerHTML = '<p class="no-selection">연관된 수량산출부재가 없습니다</p>';
            return;
        }

        // Get all quantity member IDs
        const qmIds = quantityMembers.map(qm => qm.id);
        console.log('[3D Viewer] Quantity member IDs:', qmIds);

        // Check if cost items with prices are loaded
        if (!costItemsWithPrices || costItemsWithPrices.length === 0) {
            console.warn('[3D Viewer] Cost items with prices not loaded yet');
            tableContainer.innerHTML = '<p class="no-selection">단가 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.</p>';
            // Try to load cost items with prices
            window.loadCostItemsWithPrices();
            return;
        }
        console.log('[3D Viewer] Cost items with prices available:', costItemsWithPrices.length, 'items');

        // Find cost items with unit price information that match these quantity members
        const matchingCostItems = costItemsWithPrices.filter(item => {
            if (!item.quantity_member_id) return false;
            return qmIds.some(id => id.toString() === item.quantity_member_id.toString());
        });

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
        html += '<th>품명</th>';
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

        // ▼▼▼ [추가] 이미 분할된 객체는 재분할 불가 ▼▼▼
        if (selectedObject.userData.isSplitPart || selectedObject.userData.isSplitElement) {
            console.warn('[3D Viewer] Cannot split an already-split object');
            showToast('이미 분할된 객체는 다시 분할할 수 없습니다. 원본 BIM 객체만 분할 가능합니다.', 'error');
            exitSplitMode();
            return;
        }
        // ▲▲▲ [추가] 여기까지 ▲▲▲

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

            console.log('[3D Viewer] Split operation starting');
            console.log('  - Axis:', axisName);
            console.log('  - Slider value:', position + '%');
            console.log('  - BBox range [min, max]:', [bboxMin.toFixed(4), bboxMax.toFixed(4)]);
            console.log('  - Plane position (local):', planePosition.toFixed(4));
            console.log('  - Plane distance:', planeDistance.toFixed(4));
            console.log('  - Expected ratio:', (position / 100.0 * 100).toFixed(2) + '%');

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
            bottomMesh.position.copy(selectedObject.position);
            bottomMesh.rotation.copy(selectedObject.rotation);
            bottomMesh.scale.copy(selectedObject.scale);

            topMesh.position.copy(selectedObject.position);
            topMesh.rotation.copy(selectedObject.rotation);
            topMesh.scale.copy(selectedObject.scale);

            // Preserve original color from first split (don't overwrite on re-split)
            // Use the original material's color (gray), not the selected material's color
            const preservedOriginalColor = selectedObject.userData.originalColor ||
                                          originalMaterial.color.clone();

            // Note: Volume calculation will be added after geometry computation
            // Placeholder userData - will be updated with volume info below
            bottomMesh.userData = {
                ...selectedObject.userData,
                isSplitPart: true,
                splitPartType: 'bottom',
                originalObjectId: selectedObject.userData.bimObjectId || selectedObject.userData.originalObjectId,
                splitAxis: axisName,
                splitPosition: planePosition,
                splitPositionPercent: position,
                originalColor: preservedOriginalColor.clone(),  // Preserve from original
                displayColor: bottomMaterial.color.clone()      // Current display color
            };

            topMesh.userData = {
                ...selectedObject.userData,
                isSplitPart: true,
                splitPartType: 'top',
                originalObjectId: selectedObject.userData.bimObjectId || selectedObject.userData.originalObjectId,
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
            // Calculate centroid of intersection points
            let cx = 0, cy = 0, cz = 0;
            for (let i = 0; i < cappingVertices.length; i++) {
                cx += cappingVertices[i].x;
                cy += cappingVertices[i].y;
                cz += cappingVertices[i].z;
            }
            cx /= cappingVertices.length;
            cy /= cappingVertices.length;
            cz /= cappingVertices.length;

            console.log('[3D Viewer] Capping centroid:', `(${cx.toFixed(4)}, ${cy.toFixed(4)}, ${cz.toFixed(4)})`);

            // Add centroid as a new vertex
            const centroidIndex = allVertices.length / 3;
            allVertices.push(cx, cy, cz);

            // Sort vertices around centroid
            // Project onto 2D plane perpendicular to plane normal
            const sortedVerts = cappingVertices.slice();

            // Get two perpendicular vectors on the plane
            let tempVec, u, v;
            if (Math.abs(planeNormal.x) < 0.9) {
                tempVec = new THREE.Vector3(1, 0, 0);
            } else {
                tempVec = new THREE.Vector3(0, 1, 0);
            }
            u = new THREE.Vector3().crossVectors(tempVec, planeNormal).normalize();
            v = new THREE.Vector3().crossVectors(planeNormal, u).normalize();

            console.log('[3D Viewer] Capping basis vectors:');
            console.log('  - planeNormal:', planeNormal);
            console.log('  - u:', u);
            console.log('  - v:', v);

            // Convert to 2D coordinates and calculate angle
            sortedVerts.forEach(vert => {
                const dx = vert.x - cx;
                const dy = vert.y - cy;
                const dz = vert.z - cz;
                const u_coord = dx * u.x + dy * u.y + dz * u.z;
                const v_coord = dx * v.x + dy * v.y + dz * v.z;
                vert.angle = Math.atan2(v_coord, u_coord);
            });

            // Sort by angle
            sortedVerts.sort((a, b) => a.angle - b.angle);

            console.log('[3D Viewer] Sorted capping vertices by angle:');
            sortedVerts.forEach((v, i) => {
                console.log(`  ${i}: angle=${(v.angle * 180 / Math.PI).toFixed(1)}° pos=(${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)})`);
            });

            // Create triangle fan from centroid
            // For signed volume: need outward normals
            // Bottom part: plane is TOP surface -> normal should point UP (along plane normal)
            // Top part: plane is BOTTOM surface -> normal should point DOWN (opposite plane normal)
            const bottomCappingTriangles = [];
            const topCappingTriangles = [];

            for (let i = 0; i < sortedVerts.length; i++) {
                const v1 = sortedVerts[i].index;
                const v2 = sortedVerts[(i + 1) % sortedVerts.length].index;

                // Bottom part capping: normal points UP (along plane normal)
                // Counter-clockwise when viewed from above: [centroid, v1, v2]
                bottomFaces.push([centroidIndex, v1, v2]);
                bottomCappingTriangles.push([centroidIndex, v1, v2]);

                // Top part capping: normal points DOWN (opposite plane normal)
                // Counter-clockwise when viewed from below: [centroid, v2, v1]
                topFaces.push([centroidIndex, v2, v1]);
                topCappingTriangles.push([centroidIndex, v2, v1]);
            }

            console.log('[3D Viewer] Capping: Added', sortedVerts.length, 'capping triangles to each part');
            console.log('[3D Viewer] Capping: Bottom triangles:', bottomCappingTriangles);
            console.log('[3D Viewer] Capping: Top triangles:', topCappingTriangles);
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

        // Clone geometry to avoid modifying the original
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

        let signedVolume = 0.0;
        let positiveContribution = 0.0;
        let negativeContribution = 0.0;

        if (debug) {
            console.log('[3D Viewer] Volume calculation details:');
            console.log('  - Total faces:', indices.length / 3);
        }

        // Iterate through each triangle (face)
        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i];
            const i1 = indices[i + 1];
            const i2 = indices[i + 2];

            // Get vertex positions
            const v0x = positions[i0 * 3];
            const v0y = positions[i0 * 3 + 1];
            const v0z = positions[i0 * 3 + 2];

            const v1x = positions[i1 * 3];
            const v1y = positions[i1 * 3 + 1];
            const v1z = positions[i1 * 3 + 2];

            const v2x = positions[i2 * 3];
            const v2y = positions[i2 * 3 + 1];
            const v2z = positions[i2 * 3 + 2];

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
        const normal = intersection.face.normal.clone();

        // Transform normal to world space
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(_mesh.matrixWorld);
        normal.applyMatrix3(normalMatrix).normalize();

        console.log('[3D Viewer] Face normal (world):', normal);
        console.log('[3D Viewer] Intersection point (world):', point);

        // Store selected face data
        selectedFace = {
            mesh: _mesh,
            faceIndex: faceIndex,
            point: point.clone(),
            normal: normal.clone(),
            localNormal: intersection.face.normal.clone()
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

        // ▼▼▼ [추가] 이미 분할된 객체는 재분할 불가 ▼▼▼
        if (selectedObject.userData.isSplitPart || selectedObject.userData.isSplitElement) {
            console.warn('[3D Viewer] Cannot split an already-split object');
            showToast('이미 분할된 객체는 다시 분할할 수 없습니다. 원본 BIM 객체만 분할 가능합니다.', 'error');
            exitSketchMode();
            return;
        }
        // ▲▲▲ [추가] 여기까지 ▲▲▲

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

            // Store metadata (will be updated with volume info after calculation)
            remainderMesh.userData = {
                ...selectedObject.userData,
                isSplitPart: true,
                splitPartType: 'remainder',
                splitMethod: 'sketch',
                originalObjectId: selectedObject.userData.bimObjectId || selectedObject.userData.originalObjectId,
                originalColor: preservedOriginalColor.clone(),
                displayColor: remainderMaterial.color.clone()
            };

            extractedMesh.userData = {
                ...selectedObject.userData,
                isSplitPart: true,
                splitPartType: 'extracted',
                splitMethod: 'sketch',
                originalObjectId: selectedObject.userData.bimObjectId || selectedObject.userData.originalObjectId,
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

})();
