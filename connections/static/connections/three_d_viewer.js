// three_d_viewer.js
// 3D Viewer for BIM geometry visualization
// Uses global THREE object loaded from CDN

(function() {
    let scene, camera, renderer, controls;
    let geometryLoaded = false;

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

        // Controls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.screenSpacePanning = false;
        controls.minDistance = 1;
        controls.maxDistance = 500;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1).normalize();
        scene.add(directionalLight);

        // Axes Helper
        const axesHelper = new THREE.AxesHelper(5);
        scene.add(axesHelper);

        // Grid Helper
        const gridHelper = new THREE.GridHelper(20, 20);
        scene.add(gridHelper);

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

        if (geometryLoaded) {
            console.log("[3D Viewer] Clearing existing geometry...");
            window.clearScene();
        }

        console.log("[3D Viewer] Loading placeholder geometry...");

        // Example: Add a simple box
        const geometry = new THREE.BoxGeometry(5, 5, 5);
        const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);

        geometryLoaded = true;
        console.log("[3D Viewer] Placeholder geometry loaded.");
    }

    window.clearScene = function() {
        if (!scene) {
            console.error("[3D Viewer] Scene not initialized!");
            return;
        }

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

    window.setupThreeDViewerListeners = function() {
        console.log("[3D Viewer] Setting up listeners for 3D Viewer tab.");

        const loadBtn = document.getElementById('load-geometry-btn');
        const clearBtn = document.getElementById('clear-scene-btn');

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
    };

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
                const geometry = new THREE.BufferGeometry();

                // Vertices - expecting flat array [x1,y1,z1, x2,y2,z2, ...]
                if (geomData.vertices && geomData.vertices.length > 0) {
                    const positions = new Float32Array(geomData.vertices);
                    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                }

                // Faces/Indices - expecting flat array [i1,i2,i3, i4,i5,i6, ...]
                if (geomData.faces && geomData.faces.length > 0) {
                    const indices = new Uint32Array(geomData.faces);
                    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
                }

                // Compute normals for lighting
                geometry.computeVertexNormals();

                // Create material with random color for distinction
                const color = new THREE.Color().setHSL(Math.random(), 0.7, 0.5);
                const material = new THREE.MeshPhongMaterial({
                    color: color,
                    side: THREE.DoubleSide
                });

                // Create mesh and add to scene
                const mesh = new THREE.Mesh(geometry, material);

                // Store BIM object reference
                mesh.userData = {
                    bimObjectId: bimObject.id || index,
                    bimData: bimObject
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

})();
