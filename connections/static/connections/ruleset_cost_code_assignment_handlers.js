async function loadCostCodeAssignmentRules() {
    if (!currentProjectId) {
        renderCostCodeAssignmentRulesetTable([]);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/rules/cost-code-assignment/${currentProjectId}/`
        );
        if (!response.ok) throw new Error('공사코드 할당 룰셋 로딩 실패');
        loadedCostCodeAssignmentRules = await response.json();
        renderCostCodeAssignmentRulesetTable(loadedCostCodeAssignmentRules);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleCostCodeAssignmentRuleActions(event) {
    const target = event.target;
    const ruleRow = target.closest('tr');
    if (!ruleRow) return;
    const ruleId = ruleRow.dataset.ruleId;

    if (target.classList.contains('edit-rule-btn')) {
        renderCostCodeAssignmentRulesetTable(
            loadedCostCodeAssignmentRules,
            ruleId
        );
    } else if (target.classList.contains('cancel-edit-btn')) {
        renderCostCodeAssignmentRulesetTable(loadedCostCodeAssignmentRules);
    } else if (target.classList.contains('delete-rule-btn')) {
        if (!confirm('정말 이 규칙을 삭제하시겠습니까?')) return;
        const response = await fetch(
            `/connections/api/rules/cost-code-assignment/${currentProjectId}/${ruleId}/`,
            {
                method: 'DELETE',
                headers: { 'X-CSRFToken': csrftoken },
            }
        );
        if (response.ok) {
            showToast('규칙이 삭제되었습니다.', 'success');
            loadCostCodeAssignmentRules();
        } else {
            showToast('삭제 실패', 'error');
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

        // 공사코드 선택에서 cost_code_expressions 생성
        const costCodeSelect = ruleRow.querySelector('.rule-cost-code-select');
        const selectedCostCodeId = costCodeSelect.value;

        if (!selectedCostCodeId) {
            showToast('공사코드를 선택해주세요.', 'error');
            return;
        }

        // 선택된 공사코드 정보 가져오기
        const selectedCostCode = window.loadedCostCodes.find(cc => cc.id === selectedCostCodeId);
        if (!selectedCostCode) {
            showToast('선택된 공사코드를 찾을 수 없습니다.', 'error');
            return;
        }

        const cost_code_expressions = {
            code: selectedCostCode.code,
            name: selectedCostCode.name
        };

        const ruleData = {
            id: ruleId !== 'new' ? ruleId : null,
            name: ruleRow.querySelector('.rule-name-input').value,
            description: ruleRow.querySelector('.rule-description-input')?.value || '',
            priority:
                parseInt(ruleRow.querySelector('.rule-priority-input').value) ||
                0,
            conditions: conditions,
            cost_code_expressions: cost_code_expressions,
        };

        const response = await fetch(
            `/connections/api/rules/cost-code-assignment/${currentProjectId}/`,
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
        if (response.ok) {
            showToast(result.message, 'success');
            loadCostCodeAssignmentRules();
        } else {
            showToast(result.message, 'error');
        }
    }
}