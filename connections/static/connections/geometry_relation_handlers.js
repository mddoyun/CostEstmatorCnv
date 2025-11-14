/**
 * Geometry 관계 룰셋 관리 핸들러
 *
 * 공간 관계 기반 속성 자동 할당 룰셋 UI 관리
 */

// 전역 변수: 로드된 Geometry 관계 룰셋 목록
let loadedGeometryRelationRules = [];

/**
 * Geometry 관계 룰셋 목록 로드
 */
async function loadGeometryRelationRules() {
    if (!currentProjectId) {
        loadedGeometryRelationRules = [];
        renderGeometryRelationRulesTable([]);
        return;
    }

    try {
        const response = await fetch(`/connections/api/rules/geometry-relation/${currentProjectId}/`);
        if (!response.ok) throw new Error('Geometry 관계 룰셋 로딩 실패');

        // ▼▼▼ [수정] 서버 응답에서 rules 배열 추출 (2025-11-13) ▼▼▼
        const data = await response.json();
        loadedGeometryRelationRules = data.rules || [];
        console.log(`[loadGeometryRelationRules] Loaded ${loadedGeometryRelationRules.length} rules`);
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        renderGeometryRelationRulesTable(loadedGeometryRelationRules);
    } catch (error) {
        console.error('[loadGeometryRelationRules] Error:', error);
        showToast(error.message, 'error');
        loadedGeometryRelationRules = [];
        renderGeometryRelationRulesTable([]);
    }
}

/**
 * Geometry 관계 룰셋 일괄 적용
 */
async function applyGeometryRelationRules(skipConfirmation = false) {
    if (!currentProjectId) {
        showToast('프로젝트를 선택하세요.', 'error');
        return;
    }

    if (!window.scene) {
        showToast('3D 뷰어가 로드되지 않았습니다. 먼저 3D 데이터를 로드해주세요.', 'error');
        return;
    }

    if (!skipConfirmation && !confirm('모든 Geometry 관계 룰셋을 적용하시겠습니까?\n이 작업은 시간이 걸릴 수 있습니다.')) {
        return;
    }

    const activeRules = loadedGeometryRelationRules.filter(rule => rule.is_active);

    if (activeRules.length === 0) {
        showToast('활성화된 룰셋이 없습니다.', 'info');
        return;
    }

    showToast(`${activeRules.length}개의 룰셋을 적용 중입니다...`, 'info', 5000);

    try {
        // Analyzer 초기화
        const analyzer = new GeometryRelationAnalyzer(
            window.scene,
            window.loadedQuantityMembers || []
        );

        const allResults = [];

        // 각 룰셋 적용
        for (const rule of activeRules) {
            console.log(`[applyGeometryRelationRules] ========== Applying rule: ${rule.name} ==========`);
            console.log(`  Rule ID: ${rule.id}`);
            console.log(`  Priority: ${rule.priority}, Active: ${rule.is_active}`);

            // 대상 조건 출력
            console.log(`  Target Conditions (${rule.target_conditions?.length || 0} conditions):`);
            if (rule.target_conditions && rule.target_conditions.length > 0) {
                rule.target_conditions.forEach((cond, idx) => {
                    console.log(`    ${idx + 1}. ${cond.property} ${cond.operator} "${cond.value}"`);
                });
            } else {
                console.log(`    (No conditions - will match ALL objects)`);
            }

            // 관계 설정 출력
            console.log(`  Relation Config (${rule.relation_config?.relations?.length || 0} relations):`);
            if (rule.relation_config?.relations) {
                rule.relation_config.relations.forEach((rel, idx) => {
                    console.log(`    Relation ${idx + 1}: ${rel.name} (ID: ${rel.id})`);
                    console.log(`      - Tolerance: ${rel.tolerance}`);
                    console.log(`      - Find Mode: ${rel.find_mode}`);
                    console.log(`      - Sort Property: ${rel.sort_property || '(none)'}`);
                    console.log(`      - Related Conditions (${rel.related_conditions?.length || 0}):`);
                    if (rel.related_conditions && rel.related_conditions.length > 0) {
                        rel.related_conditions.forEach((cond, cidx) => {
                            console.log(`        ${cidx + 1}. ${cond.property} ${cond.operator} "${cond.value}"`);
                        });
                    } else {
                        console.log(`        (No conditions - will match ALL overlapping objects)`);
                    }
                });
            }

            // 속성 할당 규칙 출력
            console.log(`  Property Assignments (${rule.property_assignments?.rules?.length || 0} rules):`);
            if (rule.property_assignments?.rules) {
                rule.property_assignments.rules.forEach((assign, idx) => {
                    console.log(`    Assignment ${idx + 1}: Relation ID: ${assign.relation_id}`);
                    console.log(`      - Contact Condition: ${assign.contact_condition}`);
                    console.log(`      - Mapping Conditions: ${assign.mapping_conditions?.length || 0}`);
                    console.log(`      - Fallback Properties: ${Object.keys(assign.properties || {}).length} keys`);
                });
            }

            console.log(`  Total QuantityMembers available: ${window.loadedQuantityMembers?.length || 0}`);

            // 대상 객체 필터링 with detailed logging
            console.log(`  Checking each QuantityMember:`);
            const targetQMs = (window.loadedQuantityMembers || []).filter(qm => {
                console.log(`    - QM: ${qm.name} (ID: ${qm.id})`);
                console.log(`      classification_tag object:`, qm.classification_tag);
                console.log(`      classification_tag.name: "${qm.classification_tag?.name}"`);

                const matches = evaluate_conditions_simple(qm, rule.target_conditions);
                console.log(`      Match result: ${matches}`);

                if (matches) {
                    console.log(`      ✓ MATCHED!`);
                }
                return matches;
            });

            console.log(`  ► Found ${targetQMs.length} target objects`);

            // 각 대상 객체에 대해 관계 분석
            for (const targetQM of targetQMs) {
                const relations = analyzer.analyzeRelations(targetQM, rule.relation_config);

                if (relations) {
                    // ▼▼▼ [추가] 조건부 매핑을 위한 속성 계산 (2025-11-13) ▼▼▼
                    const properties = evaluateConditionalMapping(
                        targetQM,
                        relations,
                        rule.property_assignments
                    );

                    allResults.push({
                        rule_id: rule.id,
                        qm_id: targetQM.id,
                        relations: relations,
                        properties: properties  // 계산된 속성
                    });
                    // ▲▲▲ [추가] 여기까지 ▲▲▲
                }
            }
        }

        console.log(`[applyGeometryRelationRules] Analyzed ${allResults.length} objects`);

        // 백엔드로 결과 전송
        const response = await fetch(`/connections/api/rules/geometry-relation/apply/${currentProjectId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({ relation_results: allResults })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || '룰셋 적용 실패');
        }

        showToast(result.message, 'success');

        // 데이터 새로고침
        await loadQuantityMembers();

    } catch (error) {
        console.error('[applyGeometryRelationRules] Error:', error);
        showToast(`룰셋 적용 실패: ${error.message}`, 'error');
    }
}

/**
 * 조건부 매핑 평가 - contact_condition과 mapping_conditions 처리
 * @param {Object} targetQM - 대상 QuantityMember
 * @param {Object} relations - 관계 분석 결과 (relation_id별 관련 객체 배열)
 * @param {Object} propertyAssignments - property_assignments 설정 {rules: [...]}
 * @returns {Object} - 계산된 속성 key-value 쌍
 */
function evaluateConditionalMapping(targetQM, relations, propertyAssignments) {
    const result = {};

    if (!propertyAssignments || !propertyAssignments.rules) {
        return result;
    }

    // 각 assignment rule 처리
    for (const assignment of propertyAssignments.rules) {
        const relationId = assignment.relation_id;
        const contactCondition = assignment.contact_condition || 'any';
        const mappingConditions = assignment.mapping_conditions || [];
        const fallbackProperties = assignment.properties || {};

        // 해당 relation_id의 관련 객체 찾기
        const relationResult = relations[relationId];

        if (!relationResult || relationResult.count === 0) {
            continue;  // 관련 객체가 없으면 스킵
        }

        // fullObjects 배열 사용 (contactInfo 포함)
        const fullObjects = relationResult.fullObjects || [];
        if (fullObjects.length === 0) {
            continue;
        }

        // Top contact 여부 확인 (첫 번째 관련 객체 기준)
        const relatedObj = fullObjects[0];
        const hasTopContact = relatedObj.contactInfo?.hasTopContact || false;

        // Contact condition 체크
        let contactConditionMet = true;
        if (contactCondition === 'top_contact' && !hasTopContact) {
            contactConditionMet = false;
        } else if (contactCondition === 'no_top_contact' && hasTopContact) {
            contactConditionMet = false;
        }

        if (!contactConditionMet) {
            continue;  // Contact condition 불만족 시 스킵
        }

        // Mapping conditions 평가 (순서대로, 첫 번째 만족하는 것 사용)
        let propertiesSelected = null;

        for (const mappingCond of mappingConditions) {
            const condition = mappingCond.condition;  // e.g., "target.QM.Properties.높이 > related.QM.Properties.높이"
            const condProperties = mappingCond.properties;

            if (evaluateMappingCondition(targetQM, relatedObj, condition)) {
                propertiesSelected = condProperties;
                break;  // 첫 번째 만족하는 조건 사용
            }
        }

        // 선택된 속성이 없으면 fallback 사용
        if (!propertiesSelected) {
            propertiesSelected = fallbackProperties;
        }

        // 속성 병합 (템플릿 표현식 처리)
        for (const [key, value] of Object.entries(propertiesSelected)) {
            result[key] = evaluateTemplateExpression(value, targetQM, relatedObj);
        }
    }

    return result;
}

/**
 * Mapping condition 평가 (e.g., "target.높이 > related.높이")
 * @param {Object} targetQM - 대상 객체
 * @param {Object} relatedObj - 관련 객체 {qm: ..., contactInfo: ...}
 * @param {String} condition - 조건식
 * @returns {Boolean}
 */
function evaluateMappingCondition(targetQM, relatedObj, condition) {
    if (!condition) return false;

    try {
        // 조건식 파싱: "target.QM.Properties.높이 > related.QM.Properties.높이"
        // 연산자 추출
        const operators = ['>=', '<=', '==', '!=', '>', '<', 'contains', 'startsWith', 'endsWith'];
        let operator = null;
        let leftExpr = null;
        let rightExpr = null;

        for (const op of operators) {
            if (condition.includes(op)) {
                const parts = condition.split(op).map(s => s.trim());
                if (parts.length === 2) {
                    operator = op;
                    leftExpr = parts[0];
                    rightExpr = parts[1];
                    break;
                }
            }
        }

        if (!operator || !leftExpr || !rightExpr) {
            console.warn(`[evaluateMappingCondition] Invalid condition: ${condition}`);
            return false;
        }

        // 값 추출
        const leftValue = extractValueFromExpression(leftExpr, targetQM, relatedObj);
        const rightValue = extractValueFromExpression(rightExpr, targetQM, relatedObj);

        // 비교 수행
        return compareValues(leftValue, operator, rightValue);
    } catch (error) {
        console.error(`[evaluateMappingCondition] Error evaluating condition "${condition}":`, error);
        return false;
    }
}

/**
 * 표현식에서 값 추출 (target.* 또는 related.*)
 * @param {String} expr - 표현식 (e.g., "target.QM.Properties.높이")
 * @param {Object} targetQM - 대상 객체
 * @param {Object} relatedObj - 관련 객체
 * @returns {*} - 추출된 값
 */
function extractValueFromExpression(expr, targetQM, relatedObj) {
    if (expr.startsWith('target.')) {
        const propPath = expr.substring(7);  // "QM.Properties.높이"
        return getPropertyValueFromPath(targetQM, propPath);
    } else if (expr.startsWith('related.')) {
        const propPath = expr.substring(8);
        return getPropertyValueFromPath(relatedObj.qm, propPath);
    } else {
        // 리터럴 값
        return expr;
    }
}

/**
 * 프로퍼티 경로에서 값 추출
 * @param {Object} qm - QuantityMember 객체
 * @param {String} path - 경로 (e.g., "QM.Properties.높이")
 * @returns {*} - 값
 */
function getPropertyValueFromPath(qm, path) {
    const parts = path.split('.');

    if (parts[0] === 'QM') {
        if (parts[1] === 'System') {
            const fieldName = parts.slice(2).join('.');
            return qm[fieldName];
        } else if (parts[1] === 'Properties') {
            const propName = parts.slice(2).join('.');
            return qm.properties?.[propName];
        }
    } else if (parts[0] === 'BIM') {
        // BIM 속성 처리 (raw_element 접근)
        const rawElement = qm.raw_element;
        if (rawElement) {
            // BIM.PropertySet.치수__체적 → raw_element["PropertySet.치수__체적"]
            // 또는 BIM.Parameters.높이 → raw_element.Parameters.높이
            const category = parts[1];
            const fieldName = parts.slice(2).join('.');

            // 1. 먼저 "Category.Field" 형식으로 시도 (PropertySet 등)
            const flatKey = `${category}.${fieldName}`;
            if (rawElement[flatKey] !== undefined) {
                return rawElement[flatKey];
            }

            // 2. raw_data 내부 구조 시도
            if (rawElement.raw_data && rawElement.raw_data[category]) {
                return rawElement.raw_data[category][fieldName];
            }

            // 3. 직접 카테고리 접근 시도
            if (rawElement[category]) {
                return rawElement[category][fieldName];
            }
        }
    }

    return null;
}

/**
 * 값 비교
 * @param {*} leftValue
 * @param {String} operator
 * @param {*} rightValue
 * @returns {Boolean}
 */
function compareValues(leftValue, operator, rightValue) {
    const leftStr = String(leftValue || '');
    const rightStr = String(rightValue || '');
    const leftNum = parseFloat(leftValue);
    const rightNum = parseFloat(rightValue);

    switch (operator) {
        case '==':
            return leftStr === rightStr;
        case '!=':
            return leftStr !== rightStr;
        case '>':
            return leftNum > rightNum;
        case '<':
            return leftNum < rightNum;
        case '>=':
            return leftNum >= rightNum;
        case '<=':
            return leftNum <= rightNum;
        case 'contains':
            return leftStr.includes(rightStr);
        case 'startsWith':
            return leftStr.startsWith(rightStr);
        case 'endsWith':
            return leftStr.endsWith(rightStr);
        default:
            return false;
    }
}

/**
 * 템플릿 표현식 평가 (e.g., "{QM.Properties.높이}mm" 또는 "{BIM.PropertySet.XXX}")
 * @param {String} template
 * @param {Object} targetQM
 * @param {Object} relatedObj
 * @returns {String}
 */
function evaluateTemplateExpression(template, targetQM, relatedObj) {
    if (typeof template !== 'string') return template;

    // {target.XXX} 또는 {related.XXX} 치환
    let result = template.replace(/\{(target|related)\.([^}]+)\}/g, (match, prefix, propPath) => {
        const qm = prefix === 'target' ? targetQM : relatedObj.qm;
        const value = getPropertyValueFromPath(qm, propPath);
        return value !== null && value !== undefined ? value : match;
    });

    // ▼▼▼ [추가] {BIM.XXX}, {QM.XXX} 등 prefix 없는 경로 처리 (related 객체 기준) ▼▼▼
    result = result.replace(/\{(BIM|QM|MM|SC)\.([^}]+)\}/g, (match, prefix, propPath) => {
        // prefix 없으면 related 객체에서 찾음
        const fullPath = `${prefix}.${propPath}`;
        const value = getPropertyValueFromPath(relatedObj.qm, fullPath);
        return value !== null && value !== undefined ? value : match;
    });
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    return result;
}

/**
 * 간단한 조건 평가 (프론트엔드용)
 */
function evaluate_conditions_simple(qm, conditions) {
    if (!conditions || Object.keys(conditions).length === 0) return true;

    // 배열 형태의 조건들 (AND)
    if (Array.isArray(conditions)) {
        return conditions.every(cond => evaluate_single_condition(qm, cond));
    }

    // 단일 조건
    return evaluate_single_condition(qm, conditions);
}

function evaluate_single_condition(qm, condition) {
    const property = condition.property || condition.parameter;
    const operator = condition.operator;
    const value = condition.value;

    let actualValue;

    // classification_tag 특별 처리 - API는 classification_tag_name 필드를 사용
    if (property === 'classification_tag' || property === 'QM.System.classification_tag') {
        actualValue = qm.classification_tag_name || qm.classification_tag?.name || '';
    } else if (property === 'name' || property === 'QM.System.name') {
        actualValue = qm.name || '';
    } else if (property.startsWith('QM.System.')) {
        const fieldName = property.substring(10);
        // classification_tag와 name은 위에서 처리됨
        if (fieldName === 'classification_tag') {
            actualValue = qm.classification_tag_name || qm.classification_tag?.name || '';
        } else {
            actualValue = qm[fieldName];
        }
    } else if (property.startsWith('QM.Properties.')) {
        const propName = property.substring(14);
        actualValue = qm.properties?.[propName];
    } else {
        actualValue = qm[property];
    }

    const actualStr = String(actualValue || '');
    const valueStr = String(value);

    switch (operator) {
        case 'equals':
        case '==':
            return actualStr === valueStr;
        case 'not_equals':
        case '!=':
            return actualStr !== valueStr;
        case 'contains':
            return actualStr.includes(valueStr);
        case 'not_contains':
            return !actualStr.includes(valueStr);
        case 'starts_with':
            return actualStr.startsWith(valueStr);
        case 'ends_with':
            return actualStr.endsWith(valueStr);
        default:
            return false;
    }
}

/**
 * 새 Geometry 관계 룰셋 추가
 */
function addGeometryRelationRule() {
    // ▼▼▼ [추가] 배열 초기화 확인 (2025-11-13) ▼▼▼
    if (!Array.isArray(loadedGeometryRelationRules)) {
        console.warn('[Geometry Relation] loadedGeometryRelationRules is not an array, initializing...');
        loadedGeometryRelationRules = [];
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    const newRule = {
        id: 'new',
        name: '새 관계 룰셋',
        description: '',
        priority: 0,
        is_active: true,
        target_conditions: [],
        relation_config: {
            relations: []
        },
        property_assignments: {
            rules: []
        }
    };

    // 편집 모드로 테이블 렌더링
    loadedGeometryRelationRules.unshift(newRule);
    renderGeometryRelationRulesTable(loadedGeometryRelationRules, 'new');
}

/**
 * Geometry 관계 룰셋 저장
 */
async function saveGeometryRelationRule(ruleData) {
    try {
        const url = ruleData.id && ruleData.id !== 'new'
            ? `/connections/api/rules/geometry-relation/${currentProjectId}/${ruleData.id}/`
            : `/connections/api/rules/geometry-relation/${currentProjectId}/`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify(ruleData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || '저장 실패');
        }

        showToast(result.message || '룰셋이 저장되었습니다.', 'success');
        await loadGeometryRelationRules();

    } catch (error) {
        console.error('[saveGeometryRelationRule] Error:', error);
        showToast(error.message, 'error');
    }
}

/**
 * Geometry 관계 룰셋 삭제
 */
async function deleteGeometryRelationRule(ruleId) {
    if (!confirm('정말 이 룰셋을 삭제하시겠습니까?')) return;

    try {
        const response = await fetch(`/connections/api/rules/geometry-relation/${currentProjectId}/${ruleId}/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': csrftoken }
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message || '삭제 실패');
        }

        showToast('룰셋이 삭제되었습니다.', 'success');
        await loadGeometryRelationRules();

    } catch (error) {
        console.error('[deleteGeometryRelationRule] Error:', error);
        showToast(error.message, 'error');
    }
}

/**
 * Geometry 관계 룰셋 테이블 렌더링
 */
function renderGeometryRelationRulesTable(rules, editingRuleId = null) {
    // ▼▼▼ [수정] 올바른 컨테이너 ID 사용 (2025-11-13) ▼▼▼
    const container = document.getElementById('geometry-relation-ruleset-table-container');
    if (!container) {
        console.error('[Geometry Relation] Container not found: geometry-relation-ruleset-table-container');
        return;
    }
    console.log('[Geometry Relation] Rendering table with', rules.length, 'rules, editing:', editingRuleId);
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    if (rules.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">등록된 Geometry 관계 룰셋이 없습니다.</p>';
        return;
    }

    let html = '<table class="ruleset-table"><thead><tr>';
    html += '<th style="width: 40px;">활성</th>';
    html += '<th style="width: 60px;">우선순위</th>';
    html += '<th style="width: 180px;">룰셋 이름</th>';
    html += '<th style="width: 200px;">대상 조건</th>';
    html += '<th>관계 설정</th>';
    html += '<th>속성 할당</th>';
    html += '<th style="width: 120px;">작업</th>';
    html += '</tr></thead><tbody>';

    rules.forEach(rule => {
        const isEditing = editingRuleId === rule.id;

        html += `<tr data-rule-id="${rule.id}" class="${isEditing ? 'editing-row' : ''}">`;

        // 활성화
        html += '<td style="text-align: center;">';
        if (isEditing) {
            html += `<input type="checkbox" class="rule-active-checkbox" ${rule.is_active ? 'checked' : ''}>`;
        } else {
            html += rule.is_active ? '✓' : '';
        }
        html += '</td>';

        // 우선순위
        html += '<td style="text-align: center;">';
        if (isEditing) {
            html += `<input type="number" class="rule-priority-input" value="${rule.priority}" style="width: 50px;">`;
        } else {
            html += rule.priority;
        }
        html += '</td>';

        // 룰셋 이름
        html += '<td>';
        if (isEditing) {
            html += `<input type="text" class="rule-name-input" value="${rule.name}" style="width: 100%;">`;
        } else {
            html += rule.name;
        }
        html += '</td>';

        // 대상 조건
        html += '<td>';
        if (isEditing) {
            html += '<div class="conditions-builder">';
            const conditions = Array.isArray(rule.target_conditions) ? rule.target_conditions : [];
            conditions.forEach((cond, idx) => {
                html += renderConditionRowForQM(cond, idx);
            });
            html += '<button type="button" class="add-condition-btn" style="margin-top: 5px;">+ 조건 추가</button>';
            html += '</div>';
        } else {
            const conditions = Array.isArray(rule.target_conditions) ? rule.target_conditions : [];
            html += conditions.map(c => `${c.property} ${c.operator} ${c.value}`).join(', ') || '-';
        }
        html += '</td>';

        // 관계 설정
        html += '<td>';
        if (isEditing) {
            html += '<div class="relations-builder">';
            const relations = rule.relation_config?.relations || [];
            relations.forEach((rel, idx) => {
                html += renderRelationRow(rel, idx);
            });
            html += '<button type="button" class="add-relation-btn" style="margin-top: 5px;">+ 관계 추가</button>';
            html += '</div>';
        } else {
            const relations = rule.relation_config?.relations || [];
            html += relations.map(r => `${r.name} (${r.contact_type})`).join(', ') || '-';
        }
        html += '</td>';

        // 속성 할당
        html += '<td>';
        if (isEditing) {
            html += '<div class="assignments-builder">';
            const assignments = rule.property_assignments?.rules || [];
            const firstRelationId = rule.relation_config?.relations?.[0]?.id || '';  // ▼▼▼ [수정] 첫 관계 ID 가져오기 (2025-11-13) ▼▼▼
            assignments.forEach((assign, idx) => {
                html += renderAssignmentRow(assign, firstRelationId, idx);  // ▼▼▼ [수정] relationId 전달 ▼▼▼
            });
            html += '<button type="button" class="add-assignment-btn" style="margin-top: 5px;">+ 매핑 추가</button>';  // ▼▼▼ [수정] 버튼 텍스트 변경 ▼▼▼
            html += '</div>';
        } else {
            const assignments = rule.property_assignments?.rules || [];
            html += `${assignments.length}개 매핑` || '-';
        }
        html += '</td>';

        // 작업 버튼
        html += '<td style="text-align: center;">';
        if (isEditing) {
            html += '<button class="save-rule-btn" style="margin: 2px;">저장</button>';
            html += '<button class="cancel-edit-btn" style="margin: 2px;">취소</button>';
        } else {
            html += '<button class="edit-rule-btn" style="margin: 2px;">편집</button>';
            html += '<button class="delete-rule-btn" style="margin: 2px;">삭제</button>';
        }
        html += '</td>';

        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    // 이벤트 리스너 등록
    setupGeometryRelationRuleEventListeners();
}

/**
 * 비교 객체 조건 행 렌더링 (관계 설정 내부)
 * ▼▼▼ [신규 함수] (2025-11-13) ▼▼▼
 */
function renderRelationConditionRow(condition, index) {
    const cond = condition || { property: '', operator: '==', value: '' };

    let html = '<div class="relation-condition-row" data-cond-index="' + index + '" style="display: grid; grid-template-columns: 2fr 1fr 2fr auto; gap: 5px; margin-bottom: 5px; align-items: center;">';

    // Property dropdown
    html += '<select class="relation-condition-property" style="width: 100%; font-size: 0.85em;">';
    html += '<option value="">-- 속성 선택 --</option>';

    // QM 속성 옵션 생성
    const qmOptions = generateQMPropertyOptions();
    qmOptions.forEach(group => {
        html += `<optgroup label="${group.group}">`;
        group.options.forEach(opt => {
            const selected = opt.value === cond.property ? 'selected' : '';
            html += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
        });
        html += '</optgroup>';
    });

    html += '</select>';

    // Operator dropdown
    html += '<select class="relation-condition-operator" style="width: 100%; font-size: 0.85em;">';
    const operators = ['==', '!=', '>', '<', '>=', '<=', 'contains', 'startsWith', 'endsWith'];
    operators.forEach(op => {
        const selected = op === cond.operator ? 'selected' : '';
        html += `<option value="${op}" ${selected}>${op}</option>`;
    });
    html += '</select>';

    // Value input
    html += `<input type="text" class="relation-condition-value" value="${cond.value || ''}" placeholder="값" style="width: 100%; font-size: 0.85em;">`;

    // Remove button
    html += '<button type="button" class="remove-relation-condition-btn" style="font-size: 0.85em;">×</button>';

    html += '</div>';
    return html;
}
// ▲▲▲ [신규 함수] 여기까지 ▲▲▲

/**
 * 관계 설정 행 렌더링
 */
function renderRelationRow(relation, index) {
    const rel = relation || {
        id: `rel_${Date.now()}`,
        name: '관계 설정',
        related_conditions: [],
        tolerance: 0.001,
        find_mode: 'highest',
        sort_property: ''  // ▼▼▼ [추가] 정렬 속성 (2025-11-13) ▼▼▼
    };

    let html = `<div class="relation-row" data-index="${index}" data-relation-id="${rel.id}" style="border: 2px solid #4CAF50; padding: 15px; margin: 10px 0; background: #f9fff9; border-radius: 5px;">`;

    // ▼▼▼ [추가] 헤더 (2025-11-13) ▼▼▼
    html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #4CAF50;">`;
    html += `<div>`;
    html += `<h4 style="margin: 0 0 5px 0; color: #2E7D32;">🔗 관계 분석 ${index + 1}</h4>`;
    html += `<p style="margin: 0; font-size: 0.75em; color: #666; font-family: monospace;">ID: ${rel.id}</p>`;  // ▼▼▼ [추가] ID 표시 (2025-11-13) ▼▼▼
    html += `</div>`;
    html += `<button type="button" class="remove-relation-btn" style="background: #f44336; color: white; border: none; padding: 5px 15px; border-radius: 3px; cursor: pointer;">× 제거</button>`;
    html += `</div>`;
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // ▼▼▼ [수정] 단계별 설명 추가 (2025-11-13) ▼▼▼
    html += '<div style="background: #e8f5e9; padding: 12px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #4CAF50;">';
    html += '<p style="margin: 0; font-size: 0.9em; color: #2E7D32;"><strong>🎯 이 관계 설정의 역할:</strong></p>';
    html += '<ol style="margin: 8px 0 0 20px; padding: 0; font-size: 0.85em; color: #555;">';
    html += '<li>비교할 객체를 조건으로 필터링</li>';
    html += '<li>허용 오차 내에서 겹치는 객체만 선택</li>';
    html += '<li>선택 기준으로 최종 1개 객체 선정</li>';
    html += '</ol>';
    html += '</div>';
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // ▼▼▼ [추가] 비교 객체 조건 빌더를 먼저 표시 (2025-11-13) ▼▼▼
    html += '<div style="margin-bottom: 20px; padding: 15px; background: #fff3e0; border: 1px solid #ff9800; border-radius: 5px;">';
    html += '<label style="display: block; font-size: 0.95em; font-weight: bold; margin-bottom: 10px; color: #e65100;">📋 1단계: 비교 대상 객체 필터링</label>';
    html += '<div class="relation-conditions-builder">';

    const conditions = Array.isArray(rel.related_conditions) ? rel.related_conditions : [];
    if (conditions.length === 0) {
        html += '<p style="font-size: 0.85em; color: #999; font-style: italic; margin: 5px 0;">조건을 추가하여 비교할 객체를 필터링하세요 (예: 분류, 두께, 재질 등)</p>';
    } else {
        conditions.forEach((cond, condIdx) => {
            html += renderRelationConditionRow(cond, condIdx);
        });
    }

    html += '<button type="button" class="add-relation-condition-btn" style="margin-top: 10px; padding: 8px 15px; background: #ff9800; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.9em;">+ 조건 추가</button>';
    html += '</div>';
    html += '</div>';
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';

    // 허용 거리 (2단계)
    html += '<div>';
    html += '<label style="display: block; font-size: 0.9em; font-weight: bold; margin-bottom: 5px; color: #333;">📏 2단계: 허용 오차 (미터)</label>';
    html += `<input type="number" class="relation-tolerance-input" value="${rel.tolerance}" step="0.001" style="width: 100%; padding: 8px; font-size: 0.9em; border: 1px solid #ccc; border-radius: 3px;">`;
    html += '<p style="font-size: 0.8em; color: #666; margin: 5px 0 0 0;">이 거리 내에서 겹치는 객체만 선택 (기본: 0.001m = 1mm)</p>';
    html += '</div>';

    // 선택 모드 (3단계) - 확장
    html += '<div style="grid-column: 1 / -1;">';
    html += '<label style="display: block; font-size: 0.9em; font-weight: bold; margin-bottom: 5px; color: #333;">🎯 3단계: 최종 선택 기준</label>';
    html += '<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px;">';

    // 선택 모드 타입
    html += '<select class="relation-findmode-select" style="width: 100%; padding: 8px; font-size: 0.9em; border: 1px solid #ccc; border-radius: 3px;">';
    html += `<option value="highest" ${rel.find_mode === 'highest' ? 'selected' : ''}>Z 좌표 최대</option>`;
    html += `<option value="lowest" ${rel.find_mode === 'lowest' ? 'selected' : ''}>Z 좌표 최소</option>`;
    html += `<option value="nearest" ${rel.find_mode === 'nearest' ? 'selected' : ''}>가장 가까운 것</option>`;
    html += `<option value="property_max" ${rel.find_mode === 'property_max' ? 'selected' : ''}>속성 최대값</option>`;
    html += `<option value="property_min" ${rel.find_mode === 'property_min' ? 'selected' : ''}>속성 최소값</option>`;
    html += `<option value="all" ${rel.find_mode === 'all' ? 'selected' : ''}>모두 선택</option>`;
    html += '</select>';

    // 속성 선택 (property_max/min일 때)
    const sortProperty = rel.sort_property || '';
    html += '<input type="text" class="relation-sort-property-input" value="' + sortProperty + '" placeholder="속성명 (예: QM.Properties.두께)" style="width: 100%; padding: 8px; font-size: 0.9em; border: 1px solid #ccc; border-radius: 3px;">';

    html += '</div>';
    html += '<p style="font-size: 0.8em; color: #666; margin: 5px 0 0 0;">💡 "속성 최대/최소값" 선택 시 기준 속성을 지정하세요</p>';
    html += '</div>';

    html += '</div>';

    html += '</div>'; // relation-row 닫기

    return html;
}

/**
 * 속성 할당 규칙 행 렌더링
 * ▼▼▼ [수정] 조건부 매핑 지원 (2025-11-13) ▼▼▼
 */
function renderAssignmentRow(assignment, relationId, index) {
    const assign = assignment || {
        relation_id: relationId || '',
        contact_condition: 'any',  // any, top_contact, no_top_contact
        mapping_conditions: [],  // 조건부 매핑
        properties: {}  // 기본 속성 (조건 없을 때)
    };

    let html = `<div class="assignment-row" data-index="${index}" style="border: 2px solid #2196F3; padding: 15px; margin: 10px 0; background: #e3f2fd; border-radius: 5px;">`;

    // 헤더
    html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #2196F3;">`;
    html += `<h4 style="margin: 0; color: #1565C0;">📝 속성 매핑 ${index + 1}</h4>`;
    html += `<button type="button" class="remove-assignment-btn" style="background: #f44336; color: white; border: none; padding: 5px 15px; border-radius: 3px; cursor: pointer;">× 제거</button>`;
    html += `</div>`;

    // 관계 선택
    html += '<div style="margin-bottom: 15px;">';
    html += '<label style="display: block; font-size: 0.9em; font-weight: bold; margin-bottom: 5px; color: #333;">🔗 가져올 관계:</label>';
    html += `<input type="text" class="assignment-relation-id-input" value="${assign.relation_id}" placeholder="예: rel_1234567890" style="width: 100%; padding: 8px; font-size: 0.9em; border: 1px solid #ccc; border-radius: 3px;">`;
    html += '</div>';

    // 기하학적 접촉 조건
    html += '<div style="margin-bottom: 15px;">';
    html += '<label style="display: block; font-size: 0.9em; font-weight: bold; margin-bottom: 5px; color: #333;">🔺 상단 캡 접촉 조건:</label>';
    html += '<select class="assignment-contact-condition-select" style="width: 100%; padding: 8px; font-size: 0.9em; border: 1px solid #ccc; border-radius: 3px;">';
    html += `<option value="any" ${assign.contact_condition === 'any' ? 'selected' : ''}>무관 (모든 경우)</option>`;
    html += `<option value="top_contact" ${assign.contact_condition === 'top_contact' ? 'selected' : ''}>상단 캡에 접촉함</option>`;
    html += `<option value="no_top_contact" ${assign.contact_condition === 'no_top_contact' ? 'selected' : ''}>상단 캡에 접촉 안 함</option>`;
    html += '</select>';
    html += '<p style="font-size: 0.8em; color: #666; margin: 5px 0 0 0;">💡 대상 객체의 상단 부분에 비교 객체가 겹치는지 체크</p>';
    html += '</div>';

    // 조건부 매핑
    html += '<div style="margin-bottom: 15px;">';
    html += '<label style="display: block; font-size: 0.9em; font-weight: bold; margin-bottom: 10px; color: #333;">⚖️ 조건부 속성 매핑:</label>';
    html += '<div class="mapping-conditions-container" style="background: white; padding: 10px; border-radius: 3px;">';

    const mappingConditions = assign.mapping_conditions || [];
    if (mappingConditions.length === 0) {
        html += '<p style="font-size: 0.85em; color: #999; font-style: italic; margin: 5px 0;">조건을 추가하여 비교 결과에 따라 다른 속성을 매핑할 수 있습니다</p>';
    } else {
        mappingConditions.forEach((cond, condIdx) => {
            html += renderMappingConditionRow(cond, condIdx);
        });
    }

    html += '<button type="button" class="add-mapping-condition-btn" style="margin-top: 10px; padding: 8px 15px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.9em;">+ 조건 추가</button>';
    html += '</div>';
    html += '</div>';

    // 기본 속성 매핑 (조건 없을 때)
    html += '<div>';
    html += '<label style="display: block; font-size: 0.9em; font-weight: bold; margin-bottom: 10px; color: #333;">📌 기본 속성 매핑 (조건 없을 때):</label>';
    html += '<div class="assignment-properties-container" style="background: white; padding: 10px; border-radius: 3px;">';

    const props = assign.properties || {};
    if (Object.keys(props).length === 0) {
        html += '<p style="font-size: 0.85em; color: #999; font-style: italic; margin: 5px 0;">기본 매핑이 없습니다</p>';
    } else {
        Object.entries(props).forEach(([key, value]) => {
            html += '<div class="property-pair" style="display: grid; grid-template-columns: 2fr 3fr auto; gap: 10px; margin-bottom: 8px; align-items: center;">';
            html += `<input type="text" class="property-key-input" value="${key}" placeholder="속성명" style="padding: 8px; border: 1px solid #ccc; border-radius: 3px;">`;
            html += `<input type="text" class="property-value-input" value="${value}" placeholder="값 (예: {두께})" style="padding: 8px; border: 1px solid #ccc; border-radius: 3px;">`;
            html += '<button type="button" class="remove-property-btn" style="background: #ff5722; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">×</button>';
            html += '</div>';
        });
    }

    html += '<button type="button" class="add-property-btn" style="margin-top: 10px; padding: 8px 15px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.9em;">+ 속성 추가</button>';
    html += '</div>';
    html += '</div>';

    html += '</div>'; // assignment-row 닫기

    return html;
}

/**
 * 조건부 매핑 행 렌더링
 * ▼▼▼ [신규 함수] (2025-11-13) ▼▼▼
 */
function renderMappingConditionRow(mappingCond, index) {
    const cond = mappingCond || {
        condition: '',  // 예: "target.높이 > related.높이"
        properties: {}
    };

    let html = `<div class="mapping-condition-row" data-index="${index}" style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; background: #f5f5f5; border-radius: 3px;">`;

    html += '<div style="margin-bottom: 10px;">';
    html += '<label style="display: block; font-size: 0.85em; margin-bottom: 3px;">조건 (예: target.QM.Properties.높이 > related.QM.Properties.높이):</label>';
    html += `<input type="text" class="mapping-condition-input" value="${cond.condition}" placeholder="비교 조건" style="width: 100%; padding: 6px; font-size: 0.9em;">`;
    html += '</div>';

    html += '<div>';
    html += '<label style="display: block; font-size: 0.85em; margin-bottom: 5px;">이 조건 만족 시 매핑할 속성:</label>';
    html += '<div class="cond-properties-container">';

    Object.entries(cond.properties || {}).forEach(([key, value]) => {
        html += '<div class="cond-property-pair" style="display: grid; grid-template-columns: 2fr 3fr auto; gap: 5px; margin-bottom: 5px;">';
        html += `<input type="text" class="cond-property-key-input" value="${key}" placeholder="속성명" style="padding: 6px;">`;
        html += `<input type="text" class="cond-property-value-input" value="${value}" placeholder="값" style="padding: 6px;">`;
        html += '<button type="button" class="remove-cond-property-btn" style="padding: 5px;">×</button>';
        html += '</div>';
    });

    html += '<button type="button" class="add-cond-property-btn" style="margin-top: 5px; padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.85em;">+ 속성</button>';
    html += '</div>';
    html += '</div>';

    html += '<button type="button" class="remove-mapping-condition-btn" style="margin-top: 10px; padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">× 조건 제거</button>';
    html += '</div>';

    return html;
}
// ▲▲▲ [수정] 여기까지 ▲▲▲

/**
 * 이벤트 리스너 설정
 */
function setupGeometryRelationRuleEventListeners() {
    // ▼▼▼ [수정] 올바른 컨테이너 ID 사용 (2025-11-13) ▼▼▼
    const container = document.getElementById('geometry-relation-ruleset-table-container');
    if (!container) return;
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // 편집/저장/취소/삭제 버튼
    container.addEventListener('click', async (e) => {
        const target = e.target;
        const ruleRow = target.closest('tr');
        if (!ruleRow) return;

        const ruleId = ruleRow.dataset.ruleId;

        if (target.classList.contains('edit-rule-btn')) {
            renderGeometryRelationRulesTable(loadedGeometryRelationRules, ruleId);
        }
        else if (target.classList.contains('cancel-edit-btn')) {
            if (ruleId === 'new') {
                loadedGeometryRelationRules = loadedGeometryRelationRules.filter(r => r.id !== 'new');
            }
            renderGeometryRelationRulesTable(loadedGeometryRelationRules);
        }
        else if (target.classList.contains('delete-rule-btn')) {
            await deleteGeometryRelationRule(ruleId);
        }
        else if (target.classList.contains('save-rule-btn')) {
            await saveGeometryRelationRuleFromRow(ruleRow);
        }

        // 조건 추가/제거
        else if (target.classList.contains('add-condition-btn')) {
            const builder = target.closest('.conditions-builder');
            const newIndex = builder.querySelectorAll('.condition-row').length;
            const newCondHtml = renderConditionRowForQM({}, newIndex);
            target.insertAdjacentHTML('beforebegin', newCondHtml);
            setupConditionBuilderListeners();
        }

        // 관계 추가/제거
        else if (target.classList.contains('add-relation-btn')) {
            const builder = target.closest('.relations-builder');
            const newIndex = builder.querySelectorAll('.relation-row').length;
            const newRelHtml = renderRelationRow({}, newIndex);
            target.insertAdjacentHTML('beforebegin', newRelHtml);
        }
        else if (target.classList.contains('remove-relation-btn')) {
            target.closest('.relation-row').remove();
        }

        // ▼▼▼ [추가] 비교 객체 조건 추가/제거 (2025-11-13) ▼▼▼
        else if (target.classList.contains('add-relation-condition-btn')) {
            const builder = target.closest('.relation-conditions-builder');
            const newIndex = builder.querySelectorAll('.relation-condition-row').length;
            const newCondHtml = renderRelationConditionRow({}, newIndex);
            target.insertAdjacentHTML('beforebegin', newCondHtml);
        }
        else if (target.classList.contains('remove-relation-condition-btn')) {
            target.closest('.relation-condition-row').remove();
        }
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        // 할당 추가/제거
        else if (target.classList.contains('add-assignment-btn')) {
            const builder = target.closest('.assignments-builder');
            const newIndex = builder.querySelectorAll('.assignment-row').length;
            const newAssignHtml = renderAssignmentRow({}, newIndex);
            target.insertAdjacentHTML('beforebegin', newAssignHtml);
        }
        else if (target.classList.contains('remove-assignment-btn')) {
            target.closest('.assignment-row').remove();
        }

        // 속성 추가/제거
        else if (target.classList.contains('add-property-btn')) {
            const container = target.closest('.assignment-properties-container');
            const newPropHtml = `
                <div class="property-pair" style="display: grid; grid-template-columns: 2fr 3fr auto; gap: 10px; margin-bottom: 8px; align-items: center;">
                    <input type="text" class="property-key-input" placeholder="속성명" style="padding: 8px; border: 1px solid #ccc; border-radius: 3px;">
                    <input type="text" class="property-value-input" placeholder="값 (예: {두께})" style="padding: 8px; border: 1px solid #ccc; border-radius: 3px;">
                    <button type="button" class="remove-property-btn" style="background: #ff5722; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">×</button>
                </div>
            `;
            target.insertAdjacentHTML('beforebegin', newPropHtml);
        }
        else if (target.classList.contains('remove-property-btn')) {
            target.closest('.property-pair').remove();
        }

        // ▼▼▼ [추가] 조건부 매핑 관련 버튼 (2025-11-13) ▼▼▼
        // 조건부 매핑 추가/제거
        else if (target.classList.contains('add-mapping-condition-btn')) {
            const container = target.closest('.mapping-conditions-container');
            const newIndex = container.querySelectorAll('.mapping-condition-row').length;
            const newCondHtml = renderMappingConditionRow({}, newIndex);
            target.insertAdjacentHTML('beforebegin', newCondHtml);
        }
        else if (target.classList.contains('remove-mapping-condition-btn')) {
            target.closest('.mapping-condition-row').remove();
        }

        // 조건부 매핑 내 속성 추가/제거
        else if (target.classList.contains('add-cond-property-btn')) {
            const container = target.closest('.cond-properties-container');
            const newPropHtml = `
                <div class="cond-property-pair" style="display: grid; grid-template-columns: 2fr 3fr auto; gap: 5px; margin-bottom: 5px;">
                    <input type="text" class="cond-property-key-input" placeholder="속성명" style="padding: 6px;">
                    <input type="text" class="cond-property-value-input" placeholder="값" style="padding: 6px;">
                    <button type="button" class="remove-cond-property-btn" style="padding: 5px;">×</button>
                </div>
            `;
            target.insertAdjacentHTML('beforebegin', newPropHtml);
        }
        else if (target.classList.contains('remove-cond-property-btn')) {
            target.closest('.cond-property-pair').remove();
        }
        // ▲▲▲ [추가] 여기까지 ▲▲▲
    });
}

/**
 * 행에서 룰셋 데이터 추출 및 저장
 */
async function saveGeometryRelationRuleFromRow(ruleRow) {
    const ruleId = ruleRow.dataset.ruleId;

    // 기본 정보
    const name = ruleRow.querySelector('.rule-name-input').value.trim();
    const priority = parseInt(ruleRow.querySelector('.rule-priority-input').value) || 0;
    const isActive = ruleRow.querySelector('.rule-active-checkbox').checked;

    if (!name) {
        showToast('룰셋 이름을 입력하세요.', 'error');
        return;
    }

    // 대상 조건
    const conditionRows = ruleRow.querySelectorAll('.condition-row');
    const target_conditions = [];
    conditionRows.forEach(row => {
        const property = row.querySelector('.condition-property').value;
        const operator = row.querySelector('.condition-operator').value;
        const value = row.querySelector('.condition-value').value;
        if (property && operator && value) {
            target_conditions.push({ property, operator, value });
        }
    });

    // 관계 설정
    const relationRows = ruleRow.querySelectorAll('.relation-row');
    const relations = [];
    relationRows.forEach((row, index) => {
        // ▼▼▼ [수정] related_conditions 수집 추가 (2025-11-13) ▼▼▼
        const relCondRows = row.querySelectorAll('.relation-condition-row');
        const related_conditions = [];
        relCondRows.forEach(condRow => {
            const property = condRow.querySelector('.relation-condition-property').value;
            const operator = condRow.querySelector('.relation-condition-operator').value;
            const value = condRow.querySelector('.relation-condition-value').value;
            if (property && operator) {
                related_conditions.push({ property, operator, value });
            }
        });
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // ▼▼▼ [수정] 단순화된 구조 + sort_property 추가 (2025-11-13) ▼▼▼
        const relationId = row.dataset.relationId || `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const relation = {
            id: relationId,
            name: `관계 ${index + 1}`,  // 자동 이름
            related_conditions: related_conditions,  // 비교 객체 필터링 조건
            tolerance: parseFloat(row.querySelector('.relation-tolerance-input').value) || 0.001,
            find_mode: row.querySelector('.relation-findmode-select').value,
            sort_property: row.querySelector('.relation-sort-property-input')?.value.trim() || ''  // 정렬 속성
        };

        // 관계 row가 있으면 추가 (조건이 없어도 tolerance와 find_mode로 동작 가능)
        relations.push(relation);
        // ▲▲▲ [수정] 여기까지 ▲▲▲
    });

    // 속성 할당 규칙
    // ▼▼▼ [수정] 조건부 매핑 지원 (2025-11-13) ▼▼▼
    const assignmentRows = ruleRow.querySelectorAll('.assignment-row');
    const property_assignments_rules = [];
    assignmentRows.forEach(row => {
        const relation_id = row.querySelector('.assignment-relation-id-input')?.value.trim() || '';
        const contact_condition = row.querySelector('.assignment-contact-condition-select')?.value || 'any';

        // 조건부 매핑 수집
        const mappingConditionRows = row.querySelectorAll('.mapping-condition-row');
        const mapping_conditions = [];
        mappingConditionRows.forEach(condRow => {
            const condition = condRow.querySelector('.mapping-condition-input')?.value.trim() || '';
            const condPropPairs = condRow.querySelectorAll('.cond-property-pair');
            const condProperties = {};

            condPropPairs.forEach(pair => {
                const key = pair.querySelector('.cond-property-key-input').value.trim();
                const value = pair.querySelector('.cond-property-value-input').value.trim();
                if (key && value) {
                    condProperties[key] = value;
                }
            });

            if (condition && Object.keys(condProperties).length > 0) {
                mapping_conditions.push({ condition, properties: condProperties });
            }
        });

        // 기본 속성 수집
        const propertyPairs = row.querySelectorAll('.property-pair');
        const properties = {};

        propertyPairs.forEach(pair => {
            const key = pair.querySelector('.property-key-input').value.trim();
            const value = pair.querySelector('.property-value-input').value.trim();
            if (key && value) {
                properties[key] = value;
            }
        });

        if (relation_id) {
            property_assignments_rules.push({
                relation_id,
                contact_condition,
                mapping_conditions,
                properties
            });
        }
    });
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    const ruleData = {
        id: ruleId !== 'new' ? ruleId : null,
        name,
        priority,
        is_active: isActive,
        target_conditions,
        relation_config: { relations },
        property_assignments: { rules: property_assignments_rules }
    };

    await saveGeometryRelationRule(ruleData);
}

// Export functions for global access
if (typeof window !== 'undefined') {
    window.loadGeometryRelationRules = loadGeometryRelationRules;
    window.applyGeometryRelationRules = applyGeometryRelationRules;
    window.addGeometryRelationRule = addGeometryRelationRule;
}
