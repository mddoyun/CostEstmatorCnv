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
    table.style.minWidth = '1400px'; // 테이블 최소 너비 설정
    table.innerHTML = `
        <thead>
            <tr>
                <th style="width: 150px; min-width: 150px;">이름</th>
                <th style="width: 200px; min-width: 200px;">설명</th>
                <th style="width: 150px; min-width: 150px;">대상 분류</th>
                <th style="width: 350px; min-width: 350px;">객체 조건</th>
                <th style="width: 350px; min-width: 350px;">맵핑 스크립트</th>
                <th style="width: 80px; min-width: 80px;">우선순위</th>
                <th style="width: 120px; min-width: 120px;">작업</th>
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

            // 조건 빌더 UI 생성
            const conditions = rule.conditions || [];
            let conditionsHtml = '<div class="conditions-builder" style="max-height: 250px; overflow-y: auto;">';

            conditions.forEach((cond, idx) => {
                conditionsHtml += renderConditionRowForRE(cond, idx);
            });

            conditionsHtml += `
                <button type="button" class="add-condition-btn" style="margin-top: 5px; padding: 5px 10px;">
                    + 조건 추가
                </button>
            </div>`;

            // 맵핑 빌더 UI 생성
            const mappingScript = rule.mapping_script || {};
            let mappingsHtml = '<div class="mappings-builder" style="max-height: 250px; overflow-y: auto;">';

            const mappingEntries = Object.entries(mappingScript);
            if (mappingEntries.length > 0) {
                mappingEntries.forEach(([key, value], idx) => {
                    mappingsHtml += renderMappingRow(key, value, idx);
                });
            } else {
                // 빈 맵핑 스크립트일 경우 초기 행 하나 추가
                mappingsHtml += renderMappingRow('', '', 0);
            }

            mappingsHtml += `
                <button type="button" class="add-mapping-btn" style="margin-top: 5px; padding: 5px 10px;">
                    + 맵핑 추가
                </button>
            </div>`;

            row.innerHTML = `
                <td><input type="text" class="rule-name-input" value="${
                    rule.name || '새 규칙'
                }" placeholder="규칙 이름"></td>
                <td><input type="text" class="rule-description-input" value="${
                    rule.description || ''
                }" placeholder="규칙 설명"></td>
                <td><select class="rule-tag-select" style="width: 100%;"><option value="">-- 분류 선택 --</option>${tagOptions}</select></td>
                <td>${conditionsHtml}</td>
                <td>${mappingsHtml}</td>
                <td><input type="number" class="rule-priority-input" value="${
                    rule.priority || 0
                }" style="width: 50px;"></td>
                <td>
                    <button class="save-rule-btn">💾 저장</button>
                    <button class="cancel-edit-btn">❌ 취소</button>
                </td>
            `;
        } else {
            // 읽기 전용 모드
            let conditionsDisplay = '';
            if (rule.conditions && rule.conditions.length > 0) {
                conditionsDisplay = rule.conditions.map(c =>
                    `${c.parameter} ${c.operator} "${c.value}"`
                ).join('<br>');
            } else {
                conditionsDisplay = '<em>조건 없음</em>';
            }

            // 맵핑 스크립트를 사용자 친화적으로 표시
            let mappingDisplay = '';
            if (rule.mapping_script && typeof rule.mapping_script === 'object') {
                const entries = Object.entries(rule.mapping_script);
                if (entries.length > 0) {
                    mappingDisplay = entries.map(([key, value]) =>
                        `<strong>${key}</strong>: ${value}`
                    ).join('<br>');
                } else {
                    mappingDisplay = '<em>맵핑 없음</em>';
                }
            } else {
                mappingDisplay = '<em>맵핑 없음</em>';
            }

            row.innerHTML = `
                <td>${rule.name}</td>
                <td>${rule.description}</td>
                <td>${rule.target_tag_name}</td>
                <td>${conditionsDisplay}</td>
                <td style="font-size: 12px; line-height: 1.6;">${mappingDisplay}</td>
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

    // 스크롤 가능한 래퍼 생성
    const scrollWrapper = document.createElement('div');
    scrollWrapper.style.overflowX = 'auto';
    scrollWrapper.style.width = '100%';
    scrollWrapper.appendChild(table);

    container.appendChild(scrollWrapper);

    // 조건 빌더 리스너 설정
    setupConditionBuilderListeners();
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
        const priority = ruleRow.querySelector('.rule-priority-input').value;

        if (!target_tag_id) {
            showToast('대상 분류를 선택하세요.', 'error');
            return;
        }
        if (!name.trim()) {
            showToast('규칙 이름을 입력하세요.', 'error');
            return;
        }

        // 조건 빌더에서 조건 수집
        const conditionRows = ruleRow.querySelectorAll('.condition-row');
        const conditions = [];
        conditionRows.forEach(row => {
            const parameter = row.querySelector('.condition-parameter').value;
            const operator = row.querySelector('.condition-operator').value;
            const value = row.querySelector('.condition-value').value;
            if (parameter && operator && value) {
                conditions.push({ parameter, operator, value });
            }
        });

        // 맵핑 빌더에서 맵핑 스크립트 수집
        const mappingRows = ruleRow.querySelectorAll('.mapping-row');
        const mapping_script = {};
        mappingRows.forEach(row => {
            const key = row.querySelector('.mapping-key-input').value.trim();
            const value = row.querySelector('.mapping-value-input').value.trim();
            if (key && value) {
                mapping_script[key] = value;
            }
        });

        // 최소 하나의 맵핑은 있어야 함
        if (Object.keys(mapping_script).length === 0) {
            showToast('최소 하나의 맵핑을 추가하세요.', 'error');
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

/**
 * BIM 원본 데이터에서 사용 가능한 모든 속성을 추출하여 도우미 패널에 표시합니다.
 */
function updateMappingHelperPanel() {
    const helperList = document.getElementById('mapping-helper-properties-list');

    if (!window.allRevitData || window.allRevitData.length === 0) {
        helperList.innerHTML = '<p style="color: #999;">BIM 데이터를 불러오면 사용 가능한 속성들이 여기 표시됩니다.</p>';
        return;
    }

    // 속성 수집
    const propertyGroups = {
        '시스템 속성': new Set(),
        'Parameters': new Set(),
        'TypeParameters': new Set()
    };

    // 샘플 객체들에서 속성 추출 (최대 100개만 검사)
    const sampleSize = Math.min(100, window.allRevitData.length);
    for (let i = 0; i < sampleSize; i++) {
        const element = window.allRevitData[i];

        // 시스템 속성
        if (element.Category) propertyGroups['시스템 속성'].add('Category');
        if (element.Family) propertyGroups['시스템 속성'].add('Family');
        if (element.Type) propertyGroups['시스템 속성'].add('Type');
        if (element.Level) propertyGroups['시스템 속성'].add('Level');

        // Parameters
        if (element.Parameters) {
            Object.keys(element.Parameters).forEach(key => {
                propertyGroups['Parameters'].add(`Parameters.${key}`);
            });
        }

        // TypeParameters
        if (element.TypeParameters) {
            Object.keys(element.TypeParameters).forEach(key => {
                propertyGroups['TypeParameters'].add(`TypeParameters.${key}`);
            });
        }
    }

    // HTML 생성
    let html = '';

    for (const [groupName, properties] of Object.entries(propertyGroups)) {
        if (properties.size === 0) continue;

        const sortedProps = Array.from(properties).sort();

        html += `<div style="margin-bottom: 15px;">`;
        html += `<div style="font-weight: bold; color: #555; margin-bottom: 5px; font-size: 13px;">${groupName}</div>`;

        sortedProps.forEach(prop => {
            html += `
                <div class="helper-property-item"
                     data-property="{${prop}}"
                     style="padding: 4px 8px; margin: 2px 0; background: white; border: 1px solid #e0e0e0; border-radius: 3px; cursor: pointer; transition: all 0.2s;"
                     onmouseover="this.style.background='#e3f2fd'; this.style.borderColor='#2196f3';"
                     onmouseout="this.style.background='white'; this.style.borderColor='#e0e0e0';"
                     onclick="copyPropertyToClipboard('{${prop}}')">
                    {${prop}}
                </div>
            `;
        });

        html += `</div>`;
    }

    helperList.innerHTML = html;
}

/**
 * 속성명을 클립보드에 복사합니다.
 * @param {String} propertyName - 복사할 속성명
 */
function copyPropertyToClipboard(propertyName) {
    navigator.clipboard.writeText(propertyName).then(() => {
        showToast(`복사됨: ${propertyName}`, 'success', 1500);
    }).catch(err => {
        console.error('클립보드 복사 실패:', err);
        showToast('복사 실패', 'error');
    });
}