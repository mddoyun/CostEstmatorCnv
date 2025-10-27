// three_d_viewer.js
// 3D Viewer for BIM geometry visualization
// Uses global THREE object loaded from CDN

(function() {
    let scene, camera, renderer, controls;
    let geometryLoaded = false;
    let raycaster, mouse;
    let selectedObject = null;
    let originalMaterials = new Map(); // Store original materials for deselection

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

    function loadPlaceholderGeometry() {
        if (!scene) {
            console.error("[3D Viewer] Scene not initialized!");
            return;
        }

        // Load actual BIM geometry from allRevitData
        console.log("[3D Viewer] Loading BIM geometry from allRevitData...");

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

        const geometryObjects = window.allRevitData
            .filter(obj => obj.raw_data && obj.raw_data.Parameters && obj.raw_data.Parameters.Geometry)
            .map(obj => ({
                id: obj.id,
                geometry: {
                    vertices: obj.raw_data.Parameters.Geometry.verts,
                    faces: obj.raw_data.Parameters.Geometry.faces,
                    matrix: obj.raw_data.Parameters.Geometry.matrix
                }
            }));

        if (geometryObjects.length === 0) {
            console.warn("[3D Viewer] No objects with geometry found in allRevitData. Loading placeholder cube instead.");

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

        console.log(`[3D Viewer] Found ${geometryObjects.length} objects with geometry data.`);

        // [DEBUG] Check first object's matrix
        if (geometryObjects.length > 0) {
            console.log('[DEBUG] First geometry object:', geometryObjects[0]);
            console.log('[DEBUG] Matrix:', geometryObjects[0].geometry.matrix);
            console.log('[DEBUG] Matrix length:', geometryObjects[0].geometry.matrix ? geometryObjects[0].geometry.matrix.length : 'null');
            console.log('[DEBUG] Matrix type:', typeof geometryObjects[0].geometry.matrix);
            console.log('[DEBUG] Vertices sample:', geometryObjects[0].geometry.vertices.slice(0, 3));
            console.log('[DEBUG] Faces sample:', geometryObjects[0].geometry.faces.slice(0, 3));
        }

        // Load BIM geometry using the dedicated function
        window.loadBimGeometry(geometryObjects);
    }

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

        if (loadBtn) {
            loadBtn.addEventListener('click', function() {
                console.log("[3D Viewer] Load Geometry button clicked.");
                loadPlaceholderGeometry();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                console.log("[3D Viewer] Clear Scene button clicked.");
                window.clearScene();
            });
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
            splitBtn.addEventListener('click', function() {
                console.log("[3D Viewer] Entering split mode...");
                // Show split controls, hide split button
                if (splitControlsPanel) splitControlsPanel.style.display = 'flex';
                splitBtn.style.display = 'none';
                showSplitPlaneHelper();
            });
        }

        if (splitAxisSelect) {
            splitAxisSelect.addEventListener('change', function() {
                updateSliderRange();
                updateSplitPlaneHelper();
            });
        }

        if (splitPositionSlider) {
            splitPositionSlider.addEventListener('input', function() {
                const value = parseFloat(this.value).toFixed(2);
                if (splitPositionValue) splitPositionValue.textContent = value;
                updateSplitPlaneHelper();
            });
        }

        if (previewSplitBtn) {
            previewSplitBtn.addEventListener('click', function() {
                console.log("[3D Viewer] Preview split plane");
                updateSplitPlaneHelper();
            });
        }

        if (applySplitBtn) {
            applySplitBtn.addEventListener('click', function() {
                console.log("[3D Viewer] Applying split...");
                splitSelectedObject();
                // exitSplitMode() is called inside splitSelectedObject()
            });
        }

        if (cancelSplitBtn) {
            cancelSplitBtn.addEventListener('click', function() {
                console.log("[3D Viewer] Canceling split mode");
                exitSplitMode();
            });
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

                // Apply transformation matrix if available
                if (geomData.matrix && geomData.matrix.length === 16) {
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

                // Store BIM object ID for property lookup
                mesh.userData = {
                    bimObjectId: bimObject.id || index
                };

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
            // Include both original BIM objects and split parts
            if (object instanceof THREE.Mesh && object.userData &&
                (object.userData.bimObjectId || object.userData.isSplitPart)) {
                bimMeshes.push(object);
            }
        });

        // Check for intersections (recursive to include edge lines)
        const intersects = raycaster.intersectObjects(bimMeshes, true);

        if (intersects.length > 0) {
            let clickedObject = intersects[0].object;

            // If clicked on edge line (LineSegments), get parent mesh
            if (clickedObject instanceof THREE.LineSegments) {
                clickedObject = clickedObject.parent;
                console.log('[3D Viewer] Clicked on edge line, selecting parent mesh');
            }

            // Verify we have a valid mesh with userData
            if (clickedObject instanceof THREE.Mesh && clickedObject.userData &&
                (clickedObject.userData.bimObjectId || clickedObject.userData.isSplitPart)) {
                selectObject(clickedObject);
            } else {
                console.warn('[3D Viewer] Clicked object is not a valid BIM mesh:', clickedObject);
                deselectObject();
            }
        } else {
            // Clicked on empty space - deselect
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

        console.log("[3D Viewer] Object selected:", object.userData.bimObjectId);
        console.log("[3D Viewer] Highlight material applied:", {
            color: highlightMaterial.color,
            opacity: highlightMaterial.opacity,
            transparent: highlightMaterial.transparent
        });

        // Enable split button
        const splitBtn = document.getElementById('split-object-btn');
        if (splitBtn) {
            splitBtn.disabled = false;
        }

        // Display properties
        displayObjectProperties(object);

        // Display quantity members
        displayQuantityMembers(object);

        // Display cost items
        displayCostItems(object);
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

        // Find full BIM object from allRevitData using the stored ID (use originalObjectId for split parts)
        const bimObjectId = object.userData.bimObjectId || object.userData.originalObjectId;

        if (!bimObjectId) {
            propertiesContent.innerHTML = '<p class="no-selection">객체 ID를 찾을 수 없습니다</p>';
            return;
        }

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

        // Get BIM object ID (use originalObjectId for split parts)
        const bimObjectId = object.userData.bimObjectId || object.userData.originalObjectId;

        if (!bimObjectId) {
            listContainer.innerHTML = '<p class="no-selection">객체 ID를 찾을 수 없습니다</p>';
            return;
        }

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

        // Get BIM object ID (use originalObjectId for split parts)
        const bimObjectId = object.userData.bimObjectId || object.userData.originalObjectId;

        if (!bimObjectId) {
            tableContainer.innerHTML = '<p class="no-selection">객체 ID를 찾을 수 없습니다</p>';
            return;
        }

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

        let min, max, midValue;

        if (axis === 'z') {
            min = bbox.min.z;
            max = bbox.max.z;
        } else if (axis === 'x') {
            min = bbox.min.x;
            max = bbox.max.x;
        } else if (axis === 'y') {
            min = bbox.min.y;
            max = bbox.max.y;
        }

        midValue = (min + max) / 2;

        // Use setAttribute to ensure absolute coordinate values
        slider.setAttribute('min', min.toString());
        slider.setAttribute('max', max.toString());
        slider.setAttribute('step', ((max - min) / 100).toString());
        slider.setAttribute('value', midValue.toString());

        if (valueDisplay) {
            valueDisplay.textContent = midValue.toFixed(2);
        }

        console.log('[3D Viewer] Slider range updated - Axis:', axis, 'Min:', min.toFixed(2), 'Max:', max.toFixed(2), 'Mid:', midValue.toFixed(2));
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
        const position = parseFloat(document.getElementById('split-position-slider')?.value || '0');

        // Calculate bounding box
        selectedObject.geometry.computeBoundingBox();
        const bbox = selectedObject.geometry.boundingBox;

        // Calculate split position (now using absolute values)
        let planePosition, planeNormal, planeSize;

        if (axis === 'z') {
            planePosition = parseFloat(position);
            planeNormal = new THREE.Vector3(0, 0, 1);  // Z축 선택 → Z normal (수직)
            planeSize = [bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y];
        } else if (axis === 'x') {
            planePosition = parseFloat(position);
            planeNormal = new THREE.Vector3(1, 0, 0);
            planeSize = [bbox.max.y - bbox.min.y, bbox.max.z - bbox.min.z];
        } else if (axis === 'y') {
            planePosition = parseFloat(position);
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
        console.log('  - Slider value (local):', position);
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

        console.log('[3D Viewer] Starting precise plane-based split operation on object:', selectedObject.userData.bimObjectId);

        try {
            // Get split parameters from UI
            const axis = document.getElementById('split-axis-select')?.value || 'z';
            const position = parseFloat(document.getElementById('split-position-slider')?.value || '0');

            // Calculate bounding box
            selectedObject.geometry.computeBoundingBox();
            const bbox = selectedObject.geometry.boundingBox;
            console.log('[3D Viewer] Bounding box:', bbox);

            // Calculate split plane based on selected axis and position (now using absolute values)
            let planePosition, planeNormal, axisName;

            if (axis === 'z') {
                planePosition = position;
                planeNormal = new THREE.Vector3(0, 0, 1);  // Z축 → Z normal (수직)
                axisName = 'Z';
            } else if (axis === 'x') {
                planePosition = position;
                planeNormal = new THREE.Vector3(1, 0, 0);
                axisName = 'X';
            } else if (axis === 'y') {
                planePosition = position;
                planeNormal = new THREE.Vector3(0, 1, 0);  // Y축 → Y normal (수평)
                axisName = 'Y';
            }

            // Note: planePosition is now in LOCAL coordinates (from bbox range)
            // No conversion needed - geometry vertices are already in local coords
            const planeDistance = -planePosition;

            console.log('[3D Viewer] Split operation starting');
            console.log('  - Axis:', axisName);
            console.log('  - Plane position (local):', planePosition.toFixed(2));
            console.log('  - Plane distance:', planeDistance.toFixed(2));
            console.log('  - BBox (local):', bbox);

            // Get geometry data
            const positions = selectedObject.geometry.attributes.position.array;
            const indices = selectedObject.geometry.index ? selectedObject.geometry.index.array : null;

            console.log('[3D Viewer] Original geometry - vertices:', positions.length / 3, 'faces:', indices ? indices.length / 3 : 'N/A');

            // Split geometry with precise intersection (using local coordinates)
            const splitResult = splitGeometryByPlane(positions, indices, planeNormal, planeDistance);

            console.log('[3D Viewer] Split complete - Bottom faces:', splitResult.bottomFaces.length, 'Top faces:', splitResult.topFaces.length);
            console.log('[3D Viewer] New vertices created:', splitResult.newVertices.length / 3);

            // Check if split produced valid results
            if (splitResult.bottomFaces.length === 0 || splitResult.topFaces.length === 0) {
                console.warn('[3D Viewer] Split resulted in empty geometry');
                showToast('분할 평면이 객체와 교차하지 않습니다', 'warning');
                return;
            }

            // Create new geometries
            let bottomGeometry = createGeometryFromSplitResult(splitResult.allVertices, splitResult.bottomFaces);
            let topGeometry = createGeometryFromSplitResult(splitResult.allVertices, splitResult.topFaces);

            // Validate geometries
            if (!bottomGeometry || !topGeometry ||
                bottomGeometry.attributes.position.count === 0 ||
                topGeometry.attributes.position.count === 0) {
                console.error('[3D Viewer] Failed to create valid geometries');
                showToast('형상 생성에 실패했습니다', 'error');
                return;
            }

            // Merge duplicate vertices for proper normal calculation
            // Use higher tolerance (1e-3) to ensure vertices are properly merged
            bottomGeometry.deleteAttribute('normal');
            topGeometry.deleteAttribute('normal');
            bottomGeometry = THREE.BufferGeometryUtils.mergeVertices(bottomGeometry, 1e-3);
            topGeometry = THREE.BufferGeometryUtils.mergeVertices(topGeometry, 1e-3);

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

            // Store metadata including original colors for selection highlighting
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

            // Remove original object from scene (not just hide)
            scene.remove(selectedObject);

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

            // Exit split mode
            exitSplitMode();

            // Deselect the original object
            deselectObject();

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

        // Helper: Calculate intersection point between two vertices
        function intersectEdge(i0, i1) {
            const x0 = positions[i0 * 3], y0 = positions[i0 * 3 + 1], z0 = positions[i0 * 3 + 2];
            const x1 = positions[i1 * 3], y1 = positions[i1 * 3 + 1], z1 = positions[i1 * 3 + 2];

            const d0 = signedDistance(x0, y0, z0);
            const d1 = signedDistance(x1, y1, z1);

            // Interpolation factor
            const t = d0 / (d0 - d1);

            // Intersection point
            return {
                x: x0 + t * (x1 - x0),
                y: y0 + t * (y1 - y0),
                z: z0 + t * (z1 - z0)
            };
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
                else if (belowCount > 0 && aboveCount > 0) {
                    // Find vertices on each side
                    const belowVerts = [];
                    const aboveVerts = [];
                    const vertIndices = [i0, i1, i2];
                    const dists = [d0, d1, d2];

                    for (let j = 0; j < 3; j++) {
                        if (dists[j] < -EPSILON) {
                            belowVerts.push(vertIndices[j]);
                        } else if (dists[j] > EPSILON) {
                            aboveVerts.push(vertIndices[j]);
                        } else {
                            // On plane - add to both
                            belowVerts.push(vertIndices[j]);
                            aboveVerts.push(vertIndices[j]);
                        }
                    }

                    // Case 2a: 1 below, 2 above
                    if (belowVerts.length === 1 && aboveVerts.length === 2) {
                        const vBelow = belowVerts[0];
                        const vAbove1 = aboveVerts[0];
                        const vAbove2 = aboveVerts[1];

                        // Create intersection points
                        const int1 = intersectEdge(vBelow, vAbove1);
                        const int2 = intersectEdge(vBelow, vAbove2);

                        // Add new vertices
                        const idx1 = allVertices.length / 3;
                        allVertices.push(int1.x, int1.y, int1.z);
                        newVertices.push(int1.x, int1.y, int1.z);

                        const idx2 = allVertices.length / 3;
                        allVertices.push(int2.x, int2.y, int2.z);
                        newVertices.push(int2.x, int2.y, int2.z);

                        // Bottom: 1 triangle (vBelow, int1, int2)
                        bottomFaces.push([vBelow, idx1, idx2]);

                        // Top: 2 triangles (int1, vAbove1, vAbove2) and (int1, vAbove2, int2)
                        topFaces.push([idx1, vAbove1, vAbove2]);
                        topFaces.push([idx1, vAbove2, idx2]);
                    }
                    // Case 2b: 2 below, 1 above
                    else if (belowVerts.length === 2 && aboveVerts.length === 1) {
                        const vBelow1 = belowVerts[0];
                        const vBelow2 = belowVerts[1];
                        const vAbove = aboveVerts[0];

                        // Create intersection points
                        const int1 = intersectEdge(vAbove, vBelow1);
                        const int2 = intersectEdge(vAbove, vBelow2);

                        // Add new vertices
                        const idx1 = allVertices.length / 3;
                        allVertices.push(int1.x, int1.y, int1.z);
                        newVertices.push(int1.x, int1.y, int1.z);

                        const idx2 = allVertices.length / 3;
                        allVertices.push(int2.x, int2.y, int2.z);
                        newVertices.push(int2.x, int2.y, int2.z);

                        // Bottom: 2 triangles (vBelow1, vBelow2, int1) and (vBelow2, int2, int1)
                        bottomFaces.push([vBelow1, vBelow2, idx1]);
                        bottomFaces.push([vBelow2, idx2, idx1]);

                        // Top: 1 triangle (vAbove, int1, int2)
                        topFaces.push([vAbove, idx1, idx2]);
                    }
                }
            }
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
        const positions = geometry.attributes.position.array;
        const indices = geometry.index ? geometry.index.array : null;

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

        // Get transformation matrix
        const matrix = mesh.matrix.toArray();

        return {
            vertices: vertices,
            faces: faces,
            matrix: matrix,
            vertexCount: vertices.length,
            faceCount: faces.length
        };
    }

})();
