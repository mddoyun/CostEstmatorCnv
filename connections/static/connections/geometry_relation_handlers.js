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

        loadedGeometryRelationRules = await response.json();
        renderGeometryRelationRulesTable(loadedGeometryRelationRules);

        console.log(`[loadGeometryRelationRules] Loaded ${loadedGeometryRelationRules.length} rules`);
    } catch (error) {
        console.error('[loadGeometryRelationRules] Error:', error);
        showToast(error.message, 'error');
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
            console.log(`[applyGeometryRelationRules] Applying rule: ${rule.name}`);

            // 대상 객체 필터링
            const targetQMs = (window.loadedQuantityMembers || []).filter(qm => {
                return evaluate_conditions_simple(qm, rule.target_conditions);
            });

            console.log(`  Found ${targetQMs.length} target objects`);

            // 각 대상 객체에 대해 관계 분석
            for (const targetQM of targetQMs) {
                const relations = analyzer.analyzeRelations(targetQM, rule.relation_config);

                if (relations) {
                    allResults.push({
                        rule_id: rule.id,
                        qm_id: targetQM.id,
                        relations: relations
                    });
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

    // classification_tag 특별 처리
    if (property === 'classification_tag') {
        actualValue = qm.classification_tag?.name || '';
    } else if (property === 'name') {
        actualValue = qm.name || '';
    } else if (property.startsWith('QM.System.')) {
        const fieldName = property.substring(10);
        actualValue = qm[fieldName];
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
    const container = document.getElementById('geometry-relation-rules-table-container');
    if (!container) return;

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
            assignments.forEach((assign, idx) => {
                html += renderAssignmentRow(assign, idx);
            });
            html += '<button type="button" class="add-assignment-btn" style="margin-top: 5px;">+ 할당 추가</button>';
            html += '</div>';
        } else {
            const assignments = rule.property_assignments?.rules || [];
            html += `${assignments.length}개 규칙` || '-';
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
 * 관계 설정 행 렌더링
 */
function renderRelationRow(relation, index) {
    const rel = relation || {
        id: '',
        name: '',
        related_classification: '',
        contact_type: 'top_cap',
        tolerance: 0.001,
        find_mode: 'highest'
    };

    let html = `<div class="relation-row" data-index="${index}" style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; background: #f9f9f9;">`;

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">';

    // ID
    html += '<div>';
    html += '<label style="display: block; font-size: 0.85em; margin-bottom: 3px;">ID:</label>';
    html += `<input type="text" class="relation-id-input" value="${rel.id}" placeholder="예: top_slab" style="width: 100%;">`;
    html += '</div>';

    // 이름
    html += '<div>';
    html += '<label style="display: block; font-size: 0.85em; margin-bottom: 3px;">이름:</label>';
    html += `<input type="text" class="relation-name-input" value="${rel.name}" placeholder="예: 상단 슬라브" style="width: 100%;">`;
    html += '</div>';

    // 관계 객체 분류
    html += '<div>';
    html += '<label style="display: block; font-size: 0.85em; margin-bottom: 3px;">관계 객체 분류:</label>';
    html += `<input type="text" class="relation-classification-input" value="${rel.related_classification}" placeholder="예: 슬라브" style="width: 100%;">`;
    html += '</div>';

    // 접촉 유형
    html += '<div>';
    html += '<label style="display: block; font-size: 0.85em; margin-bottom: 3px;">접촉 유형:</label>';
    html += '<select class="relation-contact-type-select" style="width: 100%;">';
    html += `<option value="top_cap" ${rel.contact_type === 'top_cap' ? 'selected' : ''}>상단 캡 (top_cap)</option>`;
    html += `<option value="side_top" ${rel.contact_type === 'side_top' ? 'selected' : ''}>측면 상단부 (side_top)</option>`;
    html += `<option value="bottom" ${rel.contact_type === 'bottom' ? 'selected' : ''}>하단 (bottom)</option>`;
    html += `<option value="side_all" ${rel.contact_type === 'side_all' ? 'selected' : ''}>측면 전체 (side_all)</option>`;
    html += '</select>';
    html += '</div>';

    // 허용 거리
    html += '<div>';
    html += '<label style="display: block; font-size: 0.85em; margin-bottom: 3px;">허용 거리 (m):</label>';
    html += `<input type="number" class="relation-tolerance-input" value="${rel.tolerance}" step="0.001" style="width: 100%;">`;
    html += '</div>';

    // find_mode
    html += '<div>';
    html += '<label style="display: block; font-size: 0.85em; margin-bottom: 3px;">선택 모드:</label>';
    html += '<select class="relation-findmode-select" style="width: 100%;">';
    html += `<option value="highest" ${rel.find_mode === 'highest' ? 'selected' : ''}>가장 높은 것 (highest)</option>`;
    html += `<option value="lowest" ${rel.find_mode === 'lowest' ? 'selected' : ''}>가장 낮은 것 (lowest)</option>`;
    html += `<option value="nearest" ${rel.find_mode === 'nearest' ? 'selected' : ''}>가장 가까운 것 (nearest)</option>`;
    html += `<option value="all" ${rel.find_mode === 'all' ? 'selected' : ''}>모두 (all)</option>`;
    html += '</select>';
    html += '</div>';

    html += '</div>';

    html += '<button type="button" class="remove-relation-btn" style="margin-top: 10px;">× 제거</button>';
    html += '</div>';

    return html;
}

/**
 * 속성 할당 규칙 행 렌더링
 */
function renderAssignmentRow(assignment, index) {
    const assign = assignment || {
        condition: '',
        properties: {}
    };

    let html = `<div class="assignment-row" data-index="${index}" style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; background: #f9f9f9;">`;

    // 조건
    html += '<div style="margin-bottom: 10px;">';
    html += '<label style="display: block; font-size: 0.85em; margin-bottom: 3px;">조건 (예: top_slab.exists == true):</label>';
    html += `<input type="text" class="assignment-condition-input" value="${assign.condition}" style="width: 100%;">`;
    html += '</div>';

    // 속성들
    html += '<div style="margin-bottom: 10px;">';
    html += '<label style="display: block; font-size: 0.85em; margin-bottom: 3px;">속성 할당:</label>';
    html += '<div class="assignment-properties-container">';

    Object.entries(assign.properties || {}).forEach(([key, value], propIdx) => {
        html += '<div class="property-pair" style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 5px; margin-bottom: 5px;">';
        html += `<input type="text" class="property-key-input" value="${key}" placeholder="속성명">`;
        html += `<input type="text" class="property-value-input" value="${value}" placeholder="값 (예: {top_slab.두께})">`;
        html += '<button type="button" class="remove-property-btn">×</button>';
        html += '</div>';
    });

    html += '<button type="button" class="add-property-btn" style="margin-top: 5px;">+ 속성 추가</button>';
    html += '</div>';
    html += '</div>';

    html += '<button type="button" class="remove-assignment-btn" style="margin-top: 10px;">× 제거</button>';
    html += '</div>';

    return html;
}

/**
 * 이벤트 리스너 설정
 */
function setupGeometryRelationRuleEventListeners() {
    const container = document.getElementById('geometry-relation-rules-table-container');
    if (!container) return;

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
                <div class="property-pair" style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 5px; margin-bottom: 5px;">
                    <input type="text" class="property-key-input" placeholder="속성명">
                    <input type="text" class="property-value-input" placeholder="값">
                    <button type="button" class="remove-property-btn">×</button>
                </div>
            `;
            target.insertAdjacentHTML('beforebegin', newPropHtml);
        }
        else if (target.classList.contains('remove-property-btn')) {
            target.closest('.property-pair').remove();
        }
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
    relationRows.forEach(row => {
        const relation = {
            id: row.querySelector('.relation-id-input').value.trim(),
            name: row.querySelector('.relation-name-input').value.trim(),
            related_classification: row.querySelector('.relation-classification-input').value.trim(),
            contact_type: row.querySelector('.relation-contact-type-select').value,
            tolerance: parseFloat(row.querySelector('.relation-tolerance-input').value) || 0.001,
            find_mode: row.querySelector('.relation-findmode-select').value
        };

        if (relation.id && relation.related_classification) {
            relations.push(relation);
        }
    });

    // 속성 할당 규칙
    const assignmentRows = ruleRow.querySelectorAll('.assignment-row');
    const property_assignments_rules = [];
    assignmentRows.forEach(row => {
        const condition = row.querySelector('.assignment-condition-input').value.trim();
        const propertyPairs = row.querySelectorAll('.property-pair');
        const properties = {};

        propertyPairs.forEach(pair => {
            const key = pair.querySelector('.property-key-input').value.trim();
            const value = pair.querySelector('.property-value-input').value.trim();
            if (key && value) {
                properties[key] = value;
            }
        });

        if (condition && Object.keys(properties).length > 0) {
            property_assignments_rules.push({ condition, properties });
        }
    });

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
