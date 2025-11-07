/**
 * AI 쿼리 최적화를 위한 인덱싱 시스템
 * - 자주 사용되는 속성별로 인덱스 구축
 * - 빠른 객체 검색 지원
 */

class AIIndexBuilder {
    constructor() {
        // 인덱스 저장소
        this.indexes = {
            // BIM 속성 인덱스
            byIfcClass: new Map(),        // IfcClass -> [rawElementIds]
            byCategory: new Map(),         // Category -> [rawElementIds]
            byFamily: new Map(),           // Family -> [rawElementIds]
            byType: new Map(),             // Type -> [rawElementIds]

            // QM 인덱스
            byClassificationTag: new Map(), // classification_tag -> [rawElementIds]

            // MemberMark 인덱스
            byMemberMark: new Map(),       // member_mark name -> [rawElementIds]

            // CostCode 인덱스
            byCostCode: new Map(),         // cost_code -> [rawElementIds]
            byCostCodeName: new Map(),     // cost_code name -> [rawElementIds]

            // Activity 인덱스
            byActivity: new Map(),         // activity name -> [rawElementIds]
            byActivityCode: new Map(),     // activity code -> [rawElementIds]

            // 복합 키워드 인덱스 (전체 텍스트 검색용)
            byKeyword: new Map()           // keyword -> [rawElementIds]
        };

        this.lastBuildTime = null;
        this.buildCount = 0;
    }

    /**
     * 전체 인덱스 빌드
     */
    async buildAll() {
        console.log('[AI Index] Building indexes...');
        const startTime = performance.now();

        this.clear();

        if (!window.allRevitData || window.allRevitData.length === 0) {
            console.warn('[AI Index] No BIM data available');
            return;
        }

        // 각 BIM 객체에 대해 인덱스 구축
        for (const elem of window.allRevitData) {
            await this.indexObject(elem.id);
        }

        this.lastBuildTime = Date.now();
        this.buildCount++;

        const elapsed = performance.now() - startTime;
        console.log(`[AI Index] Indexes built in ${elapsed.toFixed(2)}ms`);
        this.printStats();
    }

    /**
     * 단일 객체 인덱싱
     */
    async indexObject(rawElementId) {
        const elem = window.allRevitData?.find(e => e.id === rawElementId);
        if (!elem) return;

        const keywords = new Set();

        // 1. BIM 속성 인덱싱
        if (elem.raw_data) {
            const rawData = elem.raw_data;

            // IfcClass
            const ifcClass = rawData['Attributes.IfcClass'] || rawData.IfcClass;
            if (ifcClass) {
                this.addToIndex(this.indexes.byIfcClass, ifcClass, rawElementId);
                keywords.add(ifcClass);
            }

            // Category
            if (rawData.Category) {
                this.addToIndex(this.indexes.byCategory, rawData.Category, rawElementId);
                keywords.add(rawData.Category);
            }

            // Family
            if (rawData.Family) {
                this.addToIndex(this.indexes.byFamily, rawData.Family, rawElementId);
                keywords.add(rawData.Family);
            }

            // Type
            if (rawData.Type) {
                this.addToIndex(this.indexes.byType, rawData.Type, rawElementId);
                keywords.add(rawData.Type);
            }
        }

        // 2. QM 인덱싱
        if (window.loadedQuantityMembers) {
            const qms = window.loadedQuantityMembers.filter(qm => qm.raw_element_id === rawElementId);
            qms.forEach(qm => {
                if (qm.classification_tag_name) {
                    this.addToIndex(this.indexes.byClassificationTag, qm.classification_tag_name, rawElementId);
                    // 분류 태그를 "_"로 분리하여 각 단어도 키워드로 추가
                    qm.classification_tag_name.split('_').forEach(tag => keywords.add(tag));
                }
            });
        }

        // 3. MemberMark 인덱싱
        if (window.loadedQuantityMembers && window.loadedMemberMarks) {
            const qms = window.loadedQuantityMembers.filter(qm => qm.raw_element_id === rawElementId);
            qms.forEach(qm => {
                if (qm.member_mark_id) {
                    const mm = window.loadedMemberMarks.find(m => m.id === qm.member_mark_id);
                    if (mm && mm.name) {
                        this.addToIndex(this.indexes.byMemberMark, mm.name, rawElementId);
                        keywords.add(mm.name);
                    }
                }
            });
        }

        // 4. CostCode 인덱싱
        if (window.loadedCostItems && window.loadedCostCodes) {
            const qms = window.loadedQuantityMembers?.filter(qm => qm.raw_element_id === rawElementId) || [];
            qms.forEach(qm => {
                const cis = window.loadedCostItems.filter(ci => ci.quantity_member_id === qm.id);
                cis.forEach(ci => {
                    // CostItem의 cost_code_name도 키워드로 추가 (예: "cnv-006-01 - 노출콘크리트패널 마감")
                    if (ci.cost_code_name) {
                        keywords.add(ci.cost_code_name);
                    }

                    if (ci.cost_codes && Array.isArray(ci.cost_codes)) {
                        ci.cost_codes.forEach(ccId => {
                            const cc = window.loadedCostCodes.find(c => c.id === ccId);
                            if (cc) {
                                if (cc.code) {
                                    this.addToIndex(this.indexes.byCostCode, cc.code, rawElementId);
                                    keywords.add(cc.code);
                                }
                                if (cc.name) {
                                    this.addToIndex(this.indexes.byCostCodeName, cc.name, rawElementId);
                                    keywords.add(cc.name);
                                }
                            }
                        });
                    }
                });
            });
        }

        // 5. Activity 인덱싱
        if (window.loadedActivityObjects && window.loadedActivities) {
            const qms = window.loadedQuantityMembers?.filter(qm => qm.raw_element_id === rawElementId) || [];
            qms.forEach(qm => {
                const cis = window.loadedCostItems?.filter(ci => ci.quantity_member_id === qm.id) || [];
                cis.forEach(ci => {
                    const aos = window.loadedActivityObjects.filter(ao => ao.cost_item_id === ci.id);
                    aos.forEach(ao => {
                        if (ao.activity_id) {
                            const ac = window.loadedActivities.find(a => a.id === ao.activity_id);
                            if (ac) {
                                if (ac.name) {
                                    this.addToIndex(this.indexes.byActivity, ac.name, rawElementId);
                                    keywords.add(ac.name);
                                }
                                if (ac.code) {
                                    this.addToIndex(this.indexes.byActivityCode, ac.code, rawElementId);
                                    keywords.add(ac.code);
                                }
                            }
                        }
                    });
                });
            });
        }

        // 6. 모든 키워드 인덱싱 (개별 단어 분리)
        keywords.forEach(kw => {
            const kwStr = String(kw).toLowerCase();

            // 전체 키워드
            this.addToIndex(this.indexes.byKeyword, kwStr, rawElementId);

            // "_"로 분리된 단어들도 개별 인덱싱 (예: "건축_마감_벽_타일" → ["건축", "마감", "벽", "타일"])
            if (kwStr.includes('_')) {
                kwStr.split('_').forEach(part => {
                    if (part.trim()) {
                        this.addToIndex(this.indexes.byKeyword, part.trim(), rawElementId);
                    }
                });
            }

            // 띄어쓰기로 분리된 단어들도 개별 인덱싱 (예: "미장공사 마감" → ["미장공사", "마감"])
            if (kwStr.includes(' ')) {
                kwStr.split(' ').forEach(part => {
                    if (part.trim()) {
                        this.addToIndex(this.indexes.byKeyword, part.trim(), rawElementId);
                    }
                });
            }
        });

        // 7. QM properties 키워드 인덱싱 (사용자 정의 속성 값)
        if (window.loadedQuantityMembers) {
            const qms = window.loadedQuantityMembers.filter(qm => qm.raw_element_id === rawElementId);
            qms.forEach(qm => {
                if (qm.properties && typeof qm.properties === 'object') {
                    Object.entries(qm.properties).forEach(([key, value]) => {
                        if (value) {
                            const valueStr = String(value).toLowerCase();
                            this.addToIndex(this.indexes.byKeyword, valueStr, rawElementId);

                            // 값도 단어 분리
                            if (valueStr.includes('_')) {
                                valueStr.split('_').forEach(part => {
                                    if (part.trim()) {
                                        this.addToIndex(this.indexes.byKeyword, part.trim(), rawElementId);
                                    }
                                });
                            }
                            if (valueStr.includes(' ')) {
                                valueStr.split(' ').forEach(part => {
                                    if (part.trim()) {
                                        this.addToIndex(this.indexes.byKeyword, part.trim(), rawElementId);
                                    }
                                });
                            }
                        }
                    });
                }
            });
        }
    }

    /**
     * 인덱스에 추가
     */
    addToIndex(indexMap, key, rawElementId) {
        if (!key) return;

        const normalizedKey = String(key);
        if (!indexMap.has(normalizedKey)) {
            indexMap.set(normalizedKey, new Set());
        }
        indexMap.get(normalizedKey).add(rawElementId);
    }

    /**
     * 인덱스 검색
     */
    search(indexName, key) {
        const indexMap = this.indexes[indexName];
        if (!indexMap) {
            console.warn(`[AI Index] Index "${indexName}" not found`);
            return [];
        }

        const normalizedKey = String(key);
        const resultSet = indexMap.get(normalizedKey);
        return resultSet ? Array.from(resultSet) : [];
    }

    /**
     * 키워드로 검색 (부분 일치)
     */
    searchByKeyword(keyword) {
        const normalizedKeyword = keyword.toLowerCase();
        const results = new Set();

        for (const [key, ids] of this.indexes.byKeyword.entries()) {
            if (key.includes(normalizedKeyword)) {
                ids.forEach(id => results.add(id));
            }
        }

        return Array.from(results);
    }

    /**
     * 여러 조건으로 검색 (AND)
     */
    searchMultiple(conditions) {
        // conditions = [{ index: 'byIfcClass', key: 'IfcWall' }, ...]

        if (conditions.length === 0) return [];

        let results = new Set(this.search(conditions[0].index, conditions[0].key));

        for (let i = 1; i < conditions.length; i++) {
            const ids = new Set(this.search(conditions[i].index, conditions[i].key));
            // AND 연산 (교집합)
            results = new Set([...results].filter(id => ids.has(id)));
        }

        return Array.from(results);
    }

    /**
     * 인덱스 초기화
     */
    clear() {
        Object.values(this.indexes).forEach(indexMap => indexMap.clear());
    }

    /**
     * 통계 출력
     */
    printStats() {
        console.log('[AI Index] Statistics:');
        console.log(`  - IfcClass: ${this.indexes.byIfcClass.size} unique values`);
        console.log(`  - Category: ${this.indexes.byCategory.size} unique values`);
        console.log(`  - Classification Tags: ${this.indexes.byClassificationTag.size} unique values`);
        console.log(`  - Cost Codes: ${this.indexes.byCostCode.size} unique values`);
        console.log(`  - Activities: ${this.indexes.byActivity.size} unique values`);
        console.log(`  - Keywords: ${this.indexes.byKeyword.size} unique values`);
    }
}

// 전역 인덱스 인스턴스
window.aiIndexBuilder = new AIIndexBuilder();

// 데이터 로드 시 자동 인덱싱
window.addEventListener('revit-data-loaded', async () => {
    console.log('[AI Index] Auto-building indexes on data load...');
    await window.aiIndexBuilder.buildAll();
});

// QM 데이터 로드 시 인덱스 재빌드 (QM properties와 classification_tag 인덱싱)
window.addEventListener('quantity-members-loaded', async () => {
    console.log('[AI Index] Rebuilding indexes after quantity members loaded...');
    // BIM 데이터가 로드되어 있을 때만 재빌드
    if (window.allRevitData && window.allRevitData.length > 0) {
        await window.aiIndexBuilder.buildAll();
    } else {
        console.log('[AI Index] Skipping rebuild - waiting for BIM data to load first');
    }
});

// CostItem 데이터 로드 시 인덱스 재빌드 (cost code 인덱싱)
window.addEventListener('cost-items-loaded', async () => {
    console.log('[AI Index] Rebuilding indexes after cost items loaded...');
    // BIM 데이터가 로드되어 있을 때만 재빌드
    if (window.allRevitData && window.allRevitData.length > 0) {
        await window.aiIndexBuilder.buildAll();
    } else {
        console.log('[AI Index] Skipping rebuild - waiting for BIM data to load first');
    }
});
