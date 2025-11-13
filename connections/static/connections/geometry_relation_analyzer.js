/**
 * Geometry 기반 공간 관계 분석기
 *
 * 2단계 접근 방식:
 * 1. 빠른 필터링 (Fast Filter): Bounding Box 확장 → O(n) 속도로 후보군 추출
 * 2. 정밀 검증 (Precise Check): Ray Casting + Vertex Analysis → 후보군만 정밀 분석
 *
 * 사용 예:
 * const analyzer = new GeometryRelationAnalyzer(scene, quantityMembers);
 * const relations = analyzer.analyzeRelations(targetQM, relationConfig);
 */

class GeometryRelationAnalyzer {
    constructor(scene, quantityMembers) {
        this.scene = scene;
        this.quantityMembers = quantityMembers;
        this.raycaster = new THREE.Raycaster();

        // 성능 최적화: 메시 캐시
        this.meshCache = new Map();

        console.log(`[GeometryRelationAnalyzer] Initialized with ${quantityMembers.length} quantity members`);
    }

    /**
     * 객체 간의 공간 관계 분석 (메인 함수)
     * @param {Object} targetQM - 분석 대상 수량산출부재
     * @param {Object} relationConfig - 관계 분석 설정
     * @returns {Object} 관계 분석 결과
     */
    analyzeRelations(targetQM, relationConfig) {
        const targetMesh = this.getMeshByQmId(targetQM.id);
        if (!targetMesh) {
            console.warn(`[GeometryRelationAnalyzer] Mesh not found for QM ${targetQM.id}`);
            return null;
        }

        const results = {};
        const relations = relationConfig.relations || [];

        console.log(`[GeometryRelationAnalyzer] Analyzing ${relations.length} relations for QM ${targetQM.id} (${targetQM.name})`);

        relations.forEach(relConfig => {
            const startTime = performance.now();

            const relatedObjects = this.findRelatedObjects(
                targetMesh,
                targetQM,
                relConfig
            );

            const elapsed = performance.now() - startTime;
            console.log(`  - Relation "${relConfig.id}": Found ${relatedObjects.length} objects (${elapsed.toFixed(2)}ms)`);

            results[relConfig.id] = {
                exists: relatedObjects.length > 0,
                count: relatedObjects.length,
                objects: relatedObjects.map(obj => obj.qm),
                closest: relatedObjects[0]?.qm || null,
                all: relatedObjects.map(obj => obj.qm)
            };
        });

        return results;
    }

    /**
     * 관계 객체 찾기 (2단계 접근)
     * @private
     */
    findRelatedObjects(targetMesh, targetQM, relConfig) {
        // ========== STAGE 1: 빠른 필터링 (Bounding Box) ==========
        const candidates = this.fastFilterCandidates(targetMesh, targetQM, relConfig);
        console.log(`    [Stage 1] Fast filter: ${candidates.length} candidates from bounding box check`);

        if (candidates.length === 0) {
            return [];
        }

        // ========== STAGE 2: 정밀 검증 (Ray Casting + Vertex Analysis) ==========
        const contactingObjects = [];

        candidates.forEach((candidate, idx) => {
            const candidateMesh = this.getMeshByQmId(candidate.id);
            if (!candidateMesh) return;

            const contactInfo = this.preciseContactDetection(
                targetMesh,
                candidateMesh,
                relConfig.contact_type,
                relConfig.tolerance || 0.001
            );

            if (contactInfo.isContacting) {
                contactingObjects.push({
                    qm: candidate,
                    mesh: candidateMesh,
                    contactInfo: contactInfo
                });

                console.log(`      [Stage 2] Candidate ${idx + 1}/${candidates.length}: CONTACT ` +
                           `(type: ${contactInfo.contactType}, hit ratio: ${(contactInfo.hitRatio * 100).toFixed(1)}%)`);
            }
        });

        console.log(`    [Stage 2] Precise check: ${contactingObjects.length} confirmed contacts`);

        // ========== STAGE 3: find_mode에 따라 정렬/선택 ==========
        return this.selectByMode(contactingObjects, relConfig.find_mode || 'all');
    }

    /**
     * STAGE 1: 빠른 필터링 - Bounding Box 기반
     * @private
     */
    fastFilterCandidates(targetMesh, targetQM, relConfig) {
        // 1. 대상 분류에 해당하는 모든 객체 가져오기
        const allCandidates = this.quantityMembers.filter(qm =>
            qm.classification_tag?.name === relConfig.related_classification &&
            qm.id !== targetQM.id
        );

        if (allCandidates.length === 0) {
            return [];
        }

        // 2. 대상 Mesh의 Bounding Box 계산 및 확장
        const targetBox = new THREE.Box3().setFromObject(targetMesh);
        const tolerance = relConfig.tolerance || 0.001;

        // 1mm 확장 (사용자 제안 방식)
        const expandedBox = targetBox.clone().expandByScalar(tolerance);

        // 3. Bounding Box 교차 체크로 빠른 필터링
        const filteredCandidates = allCandidates.filter(candidate => {
            const candidateMesh = this.getMeshByQmId(candidate.id);
            if (!candidateMesh) return false;

            const candidateBox = new THREE.Box3().setFromObject(candidateMesh);
            return expandedBox.intersectsBox(candidateBox);
        });

        return filteredCandidates;
    }

    /**
     * STAGE 2: 정밀 접촉 검출 - Ray Casting + Vertex Analysis
     * @private
     */
    preciseContactDetection(targetMesh, candidateMesh, contactType, tolerance) {
        switch (contactType) {
            case 'top_cap':
                return this.checkTopCapContact(targetMesh, candidateMesh, tolerance);
            case 'side_top':
                return this.checkSideTopContact(targetMesh, candidateMesh, tolerance);
            case 'bottom':
                return this.checkBottomContact(targetMesh, candidateMesh, tolerance);
            case 'side_all':
                return this.checkSideContact(targetMesh, candidateMesh, tolerance);
            default:
                console.warn(`[GeometryRelationAnalyzer] Unknown contact type: ${contactType}`);
                return { isContacting: false };
        }
    }

    /**
     * 상단 캡 접촉 체크 (기둥 상단면 ↔ 슬라브 하단면)
     * @private
     */
    checkTopCapContact(columnMesh, slabMesh, tolerance) {
        // 1. 기둥의 Bounding Box에서 상단 면 정보 추출
        const columnBox = new THREE.Box3().setFromObject(columnMesh);
        const topZ = columnBox.max.z;

        // 2. 상단 면의 테스트 포인트 생성 (중심 + 4 모서리 + 4 중간점 = 9개)
        const topCenter = new THREE.Vector3(
            (columnBox.min.x + columnBox.max.x) / 2,
            (columnBox.min.y + columnBox.max.y) / 2,
            topZ
        );

        const topCorners = [
            new THREE.Vector3(columnBox.min.x, columnBox.min.y, topZ),
            new THREE.Vector3(columnBox.max.x, columnBox.min.y, topZ),
            new THREE.Vector3(columnBox.max.x, columnBox.max.y, topZ),
            new THREE.Vector3(columnBox.min.x, columnBox.max.y, topZ)
        ];

        const topMidpoints = [
            new THREE.Vector3((columnBox.min.x + columnBox.max.x) / 2, columnBox.min.y, topZ),
            new THREE.Vector3(columnBox.max.x, (columnBox.min.y + columnBox.max.y) / 2, topZ),
            new THREE.Vector3((columnBox.min.x + columnBox.max.x) / 2, columnBox.max.y, topZ),
            new THREE.Vector3(columnBox.min.x, (columnBox.min.y + columnBox.max.y) / 2, topZ)
        ];

        const testPoints = [topCenter, ...topCorners, ...topMidpoints];

        // 3. Ray casting으로 슬라브와의 교차 체크
        let hitCount = 0;
        let minDistance = Infinity;
        const rayLength = tolerance * 100; // 10cm까지 확인

        testPoints.forEach(point => {
            // 위쪽 방향으로 짧은 ray 발사
            this.raycaster.set(point, new THREE.Vector3(0, 0, 1));
            this.raycaster.near = 0;
            this.raycaster.far = rayLength;

            const intersects = this.raycaster.intersectObject(slabMesh, true);
            if (intersects.length > 0) {
                const distance = intersects[0].distance;
                if (distance <= rayLength) {
                    hitCount++;
                    minDistance = Math.min(minDistance, distance);
                }
            }
        });

        // 4. 과반수 이상의 점이 hit되면 접촉으로 판단
        const hitRatio = hitCount / testPoints.length;
        const isContacting = hitRatio >= 0.5; // 50% 이상

        return {
            isContacting: isContacting,
            contactType: 'top_cap',
            hitCount: hitCount,
            totalPoints: testPoints.length,
            hitRatio: hitRatio,
            distance: minDistance !== Infinity ? minDistance : null
        };
    }

    /**
     * 측면 상단부 접촉 체크 (기둥 측면 상단 20% ↔ 보/슬라브 측면)
     * @private
     */
    checkSideTopContact(columnMesh, otherMesh, tolerance) {
        const columnBox = new THREE.Box3().setFromObject(columnMesh);

        // 기둥 상단 20% 영역 정의
        const height = columnBox.max.z - columnBox.min.z;
        const sideTopThreshold = columnBox.max.z - (height * 0.2);

        // 측면 테스트 포인트 생성 (상단 20% 영역의 둘레)
        const sidePoints = this.generateSideTopPoints(columnBox, sideTopThreshold, columnBox.max.z);

        // 각 점에서 4방향(+X, -X, +Y, -Y) ray casting
        let hitCount = 0;
        const rayLength = tolerance * 100;

        sidePoints.forEach(point => {
            const directions = [
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(-1, 0, 0),
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, -1, 0)
            ];

            for (let dir of directions) {
                this.raycaster.set(point, dir);
                this.raycaster.near = 0;
                this.raycaster.far = rayLength;

                const intersects = this.raycaster.intersectObject(otherMesh, true);
                if (intersects.length > 0 && intersects[0].distance <= rayLength) {
                    hitCount++;
                    break; // 하나라도 hit되면 이 점은 접촉으로 간주
                }
            }
        });

        const hitRatio = hitCount / sidePoints.length;
        const isContacting = hitCount > 0; // 한 점이라도 접촉하면 OK

        return {
            isContacting: isContacting,
            contactType: 'side_top',
            hitCount: hitCount,
            totalPoints: sidePoints.length,
            hitRatio: hitRatio
        };
    }

    /**
     * 하단 접촉 체크
     * @private
     */
    checkBottomContact(targetMesh, otherMesh, tolerance) {
        const targetBox = new THREE.Box3().setFromObject(targetMesh);
        const bottomZ = targetBox.min.z;

        // 하단 면의 테스트 포인트 생성 (top_cap과 동일 패턴, 방향만 반대)
        const bottomCenter = new THREE.Vector3(
            (targetBox.min.x + targetBox.max.x) / 2,
            (targetBox.min.y + targetBox.max.y) / 2,
            bottomZ
        );

        const bottomCorners = [
            new THREE.Vector3(targetBox.min.x, targetBox.min.y, bottomZ),
            new THREE.Vector3(targetBox.max.x, targetBox.min.y, bottomZ),
            new THREE.Vector3(targetBox.max.x, targetBox.max.y, bottomZ),
            new THREE.Vector3(targetBox.min.x, targetBox.max.y, bottomZ)
        ];

        const testPoints = [bottomCenter, ...bottomCorners];

        // 아래쪽 방향으로 ray 발사
        let hitCount = 0;
        const rayLength = tolerance * 100;

        testPoints.forEach(point => {
            this.raycaster.set(point, new THREE.Vector3(0, 0, -1));
            this.raycaster.near = 0;
            this.raycaster.far = rayLength;

            const intersects = this.raycaster.intersectObject(otherMesh, true);
            if (intersects.length > 0 && intersects[0].distance <= rayLength) {
                hitCount++;
            }
        });

        const hitRatio = hitCount / testPoints.length;
        const isContacting = hitRatio >= 0.5;

        return {
            isContacting: isContacting,
            contactType: 'bottom',
            hitCount: hitCount,
            totalPoints: testPoints.length,
            hitRatio: hitRatio
        };
    }

    /**
     * 측면 전체 접촉 체크
     * @private
     */
    checkSideContact(targetMesh, otherMesh, tolerance) {
        const targetBox = new THREE.Box3().setFromObject(targetMesh);

        // 측면 전체의 테스트 포인트 생성 (하단~상단)
        const sidePoints = this.generateSidePoints(targetBox);

        let hitCount = 0;
        const rayLength = tolerance * 100;

        sidePoints.forEach(point => {
            const directions = [
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(-1, 0, 0),
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, -1, 0)
            ];

            for (let dir of directions) {
                this.raycaster.set(point, dir);
                this.raycaster.near = 0;
                this.raycaster.far = rayLength;

                const intersects = this.raycaster.intersectObject(otherMesh, true);
                if (intersects.length > 0 && intersects[0].distance <= rayLength) {
                    hitCount++;
                    break;
                }
            }
        });

        const hitRatio = hitCount / sidePoints.length;
        const isContacting = hitCount > 0;

        return {
            isContacting: isContacting,
            contactType: 'side_all',
            hitCount: hitCount,
            totalPoints: sidePoints.length,
            hitRatio: hitRatio
        };
    }

    /**
     * find_mode에 따라 객체 선택
     * @private
     */
    selectByMode(contactingObjects, mode) {
        if (contactingObjects.length === 0) return [];

        switch (mode) {
            case 'highest':
                // Z 좌표가 가장 높은 것 (슬라브의 경우 가장 위층)
                return [contactingObjects.sort((a, b) => {
                    const aBox = new THREE.Box3().setFromObject(a.mesh);
                    const bBox = new THREE.Box3().setFromObject(b.mesh);
                    return bBox.max.z - aBox.max.z;
                })[0]];

            case 'lowest':
                // Z 좌표가 가장 낮은 것
                return [contactingObjects.sort((a, b) => {
                    const aBox = new THREE.Box3().setFromObject(a.mesh);
                    const bBox = new THREE.Box3().setFromObject(b.mesh);
                    return aBox.min.z - bBox.min.z;
                })[0]];

            case 'nearest':
                // 거리가 가장 가까운 것
                return [contactingObjects.sort((a, b) =>
                    (a.contactInfo.distance || Infinity) - (b.contactInfo.distance || Infinity)
                )[0]];

            case 'all':
            default:
                // 모든 접촉 객체 반환 (Z 좌표 내림차순 정렬)
                return contactingObjects.sort((a, b) => {
                    const aBox = new THREE.Box3().setFromObject(a.mesh);
                    const bBox = new THREE.Box3().setFromObject(b.mesh);
                    return bBox.max.z - aBox.max.z;
                });
        }
    }

    /**
     * Helper: 측면 상단부의 테스트 포인트 생성
     * @private
     */
    generateSideTopPoints(box, minZ, maxZ) {
        const points = [];
        const steps = 5; // 둘레당 5개 점

        // 4개 변의 점들 생성
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const z = minZ + (maxZ - minZ) / 2; // 중간 높이

            // 변 1: min.x, min.y → max.x, min.y
            points.push(new THREE.Vector3(
                box.min.x + (box.max.x - box.min.x) * t,
                box.min.y,
                z
            ));

            // 변 2: max.x, min.y → max.x, max.y
            points.push(new THREE.Vector3(
                box.max.x,
                box.min.y + (box.max.y - box.min.y) * t,
                z
            ));

            // 변 3: max.x, max.y → min.x, max.y
            points.push(new THREE.Vector3(
                box.max.x - (box.max.x - box.min.x) * t,
                box.max.y,
                z
            ));

            // 변 4: min.x, max.y → min.x, min.y
            points.push(new THREE.Vector3(
                box.min.x,
                box.max.y - (box.max.y - box.min.y) * t,
                z
            ));
        }

        return points;
    }

    /**
     * Helper: 측면 전체의 테스트 포인트 생성
     * @private
     */
    generateSidePoints(box) {
        const points = [];
        const stepsXY = 5;
        const stepsZ = 3;

        // Z 레벨별로 둘레 점들 생성
        for (let iz = 0; iz < stepsZ; iz++) {
            const z = box.min.z + (box.max.z - box.min.z) * (iz / (stepsZ - 1));

            for (let i = 0; i < stepsXY; i++) {
                const t = i / (stepsXY - 1);

                // 4개 변
                points.push(new THREE.Vector3(box.min.x + (box.max.x - box.min.x) * t, box.min.y, z));
                points.push(new THREE.Vector3(box.max.x, box.min.y + (box.max.y - box.min.y) * t, z));
                points.push(new THREE.Vector3(box.max.x - (box.max.x - box.min.x) * t, box.max.y, z));
                points.push(new THREE.Vector3(box.min.x, box.max.y - (box.max.y - box.min.y) * t, z));
            }
        }

        return points;
    }

    /**
     * Helper: QM ID로 Scene에서 Mesh 찾기
     * @private
     */
    getMeshByQmId(qmId) {
        // 캐시 확인
        if (this.meshCache.has(qmId)) {
            return this.meshCache.get(qmId);
        }

        // Scene에서 찾기
        let foundMesh = null;
        this.scene.traverse(obj => {
            if (obj.userData?.qmId === qmId || obj.userData?.quantityMemberId === qmId) {
                foundMesh = obj;
            }
        });

        // 캐시에 저장
        if (foundMesh) {
            this.meshCache.set(qmId, foundMesh);
        }

        return foundMesh;
    }

    /**
     * 캐시 초기화 (객체가 추가/삭제될 때 호출)
     */
    clearCache() {
        this.meshCache.clear();
        console.log('[GeometryRelationAnalyzer] Mesh cache cleared');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeometryRelationAnalyzer;
}
