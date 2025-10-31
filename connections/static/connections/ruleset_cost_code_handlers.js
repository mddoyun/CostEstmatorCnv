// =====================================================================
// 공사코드 룰셋(CostCodeRule) 관리 관련 함수들
// =====================================================================

async function loadCostCodeRules() {
    if (!currentProjectId) {
        renderCostCodeRulesetTable([]);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/rules/cost-code/${currentProjectId}/`
        );
        if (!response.ok)
            throw new Error('공사코드 룰셋을 불러오는데 실패했습니다.');
        loadedCostCodeRules = await response.json();
        renderCostCodeRulesetTable(loadedCostCodeRules);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleCostCodeRuleActions(event) {
    const target = event.target;
    const ruleRow = target.closest('tr');
    if (!ruleRow) return;
    const ruleId = ruleRow.dataset.ruleId;

    if (target.classList.contains('edit-rule-btn')) {
        if (
            document.querySelector(
                '#costcode-ruleset-table-container .rule-edit-row'
            )
        ) {
            showToast('이미 편집 중인 규칙이 있습니다.', 'error');
            return;
        }
        renderCostCodeRulesetTable(loadedCostCodeRules, ruleId);
    } else if (target.classList.contains('cancel-edit-btn')) {
        renderCostCodeRulesetTable(loadedCostCodeRules);
    } else if (target.classList.contains('delete-rule-btn')) {
        if (!confirm('이 규칙을 정말 삭제하시겠습니까?')) return;
        try {
            const response = await fetch(
                `/connections/api/rules/cost-code/${currentProjectId}/${ruleId}/`,
                {
                    method: 'DELETE',
                    headers: { 'X-CSRFToken': csrftoken },
                }
            );
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            showToast(result.message, 'success');
            await loadCostCodeRules();
        } catch (error) {
            showToast(error.message, 'error');
        }
    } else if (target.classList.contains('save-rule-btn')) {
        // 조건 빌더에서 조건 수집
        const conditionRows = ruleRow.querySelectorAll('.condition-row');
        const conditions = [];
        conditionRows.forEach(row => {
            const property = row.querySelector('.condition-property').value;
            const operator = row.querySelector('.condition-operator').value;
            const value = row.querySelector('.condition-value').value;
            if (property && operator && value) {
                conditions.push({ property, operator, value });
            }
        });

        // 맵핑 빌더에서 수량 계산식 수집
        const mappingRows = ruleRow.querySelectorAll('.mapping-row');
        const quantity_mapping_script = {};
        mappingRows.forEach(row => {
            const key = row.querySelector('.mapping-key-input').value.trim();
            const value = row.querySelector('.mapping-value-input').value.trim();
            if (key && value) {
                quantity_mapping_script[key] = value;
            }
        });

        const ruleData = {
            id: ruleId !== 'new' ? ruleId : null,
            priority:
                parseInt(ruleRow.querySelector('.rule-priority-input').value) ||
                0,
            name: ruleRow.querySelector('.rule-name-input').value,
            target_cost_code_id: ruleRow.querySelector('.rule-cost-code-select')
                .value,
            conditions: conditions,
            quantity_mapping_script: quantity_mapping_script,
        };

        if (!ruleData.target_cost_code_id) {
            showToast('대상 공사코드를 선택하세요.', 'error');
            return;
        }
        if (!ruleData.name) {
            showToast('규칙 이름을 입력하세요.', 'error');
            return;
        }

        try {
            const response = await fetch(
                `/connections/api/rules/cost-code/${currentProjectId}/`,
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
            if (!response.ok) throw new Error(result.message);
            showToast(result.message, 'success');
            await loadCostCodeRules();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
}