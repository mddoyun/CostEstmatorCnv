/**
 * 프로젝트의 모든 '속성 맵핑 룰셋'을 서버에서 불러와 전역 변수에 저장하고 화면을 다시 그립니다.
 */
async function loadPropertyMappingRules() {
    if (!currentProjectId) {
        loadedPropertyMappingRules = [];
        renderPropertyMappingRulesetTable(loadedPropertyMappingRules);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/rules/property-mapping/${currentProjectId}/`
        );
        if (!response.ok) {
            throw new Error('속성 맵핑 룰셋 데이터를 불러오는데 실패했습니다.');
        }
        loadedPropertyMappingRules = await response.json();
        renderPropertyMappingRulesetTable(loadedPropertyMappingRules);
    } catch (error) {
        console.error('Error loading property mapping rules:', error);
        loadedPropertyMappingRules = [];
        renderPropertyMappingRulesetTable(loadedPropertyMappingRules); // 에러 시 빈 테이블 표시
        showToast(error.message, 'error');
    }
}

/**
 * '속성 맵핑 룰셋' 데이터를 기반으로 테이블을 렌더링합니다.
 * @param {Array} rules - 렌더링할 규칙 데이터 배열
 * @param {String|null} editId - 현재 편집 중인 규칙의 ID ('new'일 경우 새 규칙 추가)
 */
function renderPropertyMappingRulesetTable(rules, editId = null) {
    const container = document.getElementById(
        'mapping-ruleset-table-container'
    );
    const tags = Array.from(
        document.getElementById('tag-assign-select').options
    )
        .filter((opt) => opt.value)
        .map((opt) => ({ id: opt.value, name: opt.text }));

    if (!rules.length && editId !== 'new') {
        container.innerHTML =
            '<p>정의된 속성 맵핑 규칙이 없습니다. "새 규칙 추가" 버튼으로 시작하세요.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'ruleset-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>이름</th>
                <th>설명</th>
                <th>대상 분류</th>
                <th>객체 조건 (JSON)</th>
                <th>맵핑 스크립트 (JSON)</th>
                <th>우선순위</th>
                <th>작업</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;
    const tbody = table.querySelector('tbody');

    const renderRow = (rule) => {
        const isEditMode =
            editId &&
            (editId === 'new' ? rule.id === 'new' : rule.id === editId);
        const row = document.createElement('tr');
        row.dataset.ruleId = rule.id;

        if (isEditMode) {
            row.classList.add('rule-edit-row');
            const tagOptions = tags
                .map(
                    (t) =>
                        `<option value="${t.id}" ${
                            rule.target_tag_id === t.id ? 'selected' : ''
                        }>${t.name}</option>`
                )
                .join('');
            row.innerHTML = `
                <td><input type="text" class="rule-name-input" value="${
                    rule.name || '새 규칙'
                }" placeholder="규칙 이름"></td>
                <td><input type="text" class="rule-description-input" value="${
                    rule.description || ''
                }" placeholder="규칙 설명"></td>
                <td><select class="rule-tag-select"><option value="">-- 분류 선택 --</option>${tagOptions}</select></td>
                <td><textarea class="rule-conditions-input" rows="3" placeholder='[{"parameter":"Category", "operator":"equals", "value":"벽"}]'>${JSON.stringify(
                    rule.conditions || [],
                    null,
                    2
                )}</textarea></td>
                <td><textarea class="rule-mapping-input" rows="3" placeholder='{"체적": "{Volume}", "면적": "{Area} * 2"}'>${JSON.stringify(
                    rule.mapping_script || {},
                    null,
                    2
                )}</textarea></td>
                <td><input type="number" class="rule-priority-input" value="${
                    rule.priority || 0
                }"></td>
                <td>
                    <button class="save-rule-btn">💾 저장</button>
                    <button class="cancel-edit-btn">❌ 취소</button>
                </td>
            `;
        } else {
            row.innerHTML = `
                <td>${rule.name}</td>
                <td>${rule.description}</td>
                <td>${rule.target_tag_name}</td>
                <td><pre>${JSON.stringify(rule.conditions, null, 2)}</pre></td>
                <td><pre>${JSON.stringify(
                    rule.mapping_script,
                    null,
                    2
                )}</pre></td>
                <td>${rule.priority}</td>
                <td>
                    <button class="edit-rule-btn">✏️ 수정</button>
                    <button class="delete-rule-btn">🗑️ 삭제</button>
                </td>
            `;
        }
        return row;
    };

    if (editId === 'new') {
        const newRule = {
            id: 'new',
            conditions: [],
            mapping_script: {},
            priority: 0,
        };
        tbody.appendChild(renderRow(newRule));
    }

    rules.forEach((rule) => {
        // 편집 중인 행은 다시 그리지 않도록 필터링
        if (rule.id !== editId) {
            tbody.appendChild(renderRow(rule));
        } else {
            tbody.appendChild(renderRow(rules.find((r) => r.id === editId)));
        }
    });

    // 편집 모드일 때, 새 규칙 행이 아닌 경우 기존 규칙 목록을 다시 그림
    if (editId && editId !== 'new') {
        const otherRules = rules.filter((r) => r.id !== editId);
        tbody.innerHTML = ''; // tbody 초기화
        rules.forEach((rule) => {
            tbody.appendChild(renderRow(rule));
        });
    }

    container.innerHTML = '';
    container.appendChild(table);
}

/**
 * '속성 맵핑 룰셋' 테이블의 액션(저장, 수정, 취소, 삭제)을 처리합니다.
 * @param {Event} event
 */
async function handlePropertyMappingRuleActions(event) {
    const target = event.target;
    const ruleRow = target.closest('tr');
    if (!ruleRow) return;

    const ruleId = ruleRow.dataset.ruleId;

    // --- 수정 버튼 ---
    if (target.classList.contains('edit-rule-btn')) {
        if (
            document.querySelector(
                '#mapping-ruleset-table-container .rule-edit-row'
            )
        ) {
            showToast('이미 편집 중인 규칙이 있습니다.', 'error');
            return;
        }
        renderPropertyMappingRulesetTable(loadedPropertyMappingRules, ruleId);
    }

    // --- 삭제 버튼 ---
    else if (target.classList.contains('delete-rule-btn')) {
        if (!confirm('이 속성 맵핑 규칙을 정말 삭제하시겠습니까?')) return;
        await deletePropertyMappingRule(ruleId);
    }

    // --- 저장 버튼 ---
    else if (target.classList.contains('save-rule-btn')) {
        const name = ruleRow.querySelector('.rule-name-input').value;
        const description = ruleRow.querySelector(
            '.rule-description-input'
        ).value;
        const target_tag_id = ruleRow.querySelector('.rule-tag-select').value;
        const conditionsStr = ruleRow.querySelector(
            '.rule-conditions-input'
        ).value;
        const mappingStr = ruleRow.querySelector('.rule-mapping-input').value;
        const priority = ruleRow.querySelector('.rule-priority-input').value;

        if (!target_tag_id) {
            showToast('대상 분류를 선택하세요.', 'error');
            return;
        }
        if (!name.trim()) {
            showToast('규칙 이름을 입력하세요.', 'error');
            return;
        }

        let conditions, mapping_script;
        try {
            conditions = JSON.parse(conditionsStr || '[]');
            if (!Array.isArray(conditions))
                throw new Error('객체 조건이 배열 형식이 아닙니다.');
        } catch (e) {
            showToast(
                `객체 조건이 유효한 JSON 형식이 아닙니다: ${e.message}`,
                'error'
            );
            return;
        }
        try {
            mapping_script = JSON.parse(mappingStr || '{}');
            if (
                typeof mapping_script !== 'object' ||
                Array.isArray(mapping_script)
            ) {
                throw new Error(
                    '맵핑 스크립트가 객체(Object) 형식이 아닙니다.'
                );
            }
        } catch (e) {
            showToast(
                `맵핑 스크립트가 유효한 JSON 형식이 아닙니다: ${e.message}`,
                'error'
            );
            return;
        }

        const ruleData = {
            id: ruleId !== 'new' ? ruleId : null,
            name: name,
            description: description,
            target_tag_id: target_tag_id,
            conditions: conditions,
            mapping_script: mapping_script,
            priority: parseInt(priority) || 0,
        };

        await savePropertyMappingRule(ruleData);
    }

    // --- 취소 버튼 ---
    else if (target.classList.contains('cancel-edit-btn')) {
        renderPropertyMappingRulesetTable(loadedPropertyMappingRules);
    }
}

/**
 * '속성 맵핑 룰셋'을 서버에 저장(생성/업데이트)합니다.
 * @param {Object} ruleData - 저장할 규칙 데이터
 */
async function savePropertyMappingRule(ruleData) {
    try {
        const response = await fetch(
            `/connections/api/rules/property-mapping/${currentProjectId}/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify(ruleData),
            }
        );

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || '규칙 저장에 실패했습니다.');
        }

        showToast(result.message, 'success');
        await loadPropertyMappingRules(); // 성공 후 목록 새로고침
    } catch (error) {
        console.error('Error saving property mapping rule:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 서버에서 '속성 맵핑 룰셋'을 삭제합니다.
 * @param {String} ruleId - 삭제할 규칙의 ID
 */
async function deletePropertyMappingRule(ruleId) {
    try {
        const response = await fetch(
            `/connections/api/rules/property-mapping/${currentProjectId}/${ruleId}/`,
            {
                method: 'DELETE',
                headers: { 'X-CSRFToken': csrftoken },
            }
        );

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || '규칙 삭제에 실패했습니다.');
        }

        showToast(result.message, 'success');
        await loadPropertyMappingRules(); // 성공 후 목록 새로고침
    } catch (error) {
        console.error('Error deleting property mapping rule:', error);
        showToast(error.message, 'error');
    }
}