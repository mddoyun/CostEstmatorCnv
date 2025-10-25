async function loadMemberMarkAssignmentRules() {
    if (!currentProjectId) {
        renderMemberMarkAssignmentRulesetTable([]);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/rules/member-mark-assignment/${currentProjectId}/`
        );
        if (!response.ok) throw new Error('일람부호 할당 룰셋 로딩 실패');
        loadedMemberMarkAssignmentRules = await response.json();
        renderMemberMarkAssignmentRulesetTable(loadedMemberMarkAssignmentRules);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleMemberMarkAssignmentRuleActions(event) {
    const target = event.target;
    const ruleRow = target.closest('tr');
    if (!ruleRow) return;
    const ruleId = ruleRow.dataset.ruleId;

    if (target.classList.contains('edit-rule-btn')) {
        renderMemberMarkAssignmentRulesetTable(
            loadedMemberMarkAssignmentRules,
            ruleId
        );
    } else if (target.classList.contains('cancel-edit-btn')) {
        renderMemberMarkAssignmentRulesetTable(loadedMemberMarkAssignmentRules);
    } else if (target.classList.contains('delete-rule-btn')) {
        if (!confirm('정말 이 규칙을 삭제하시겠습니까?')) return;
        const response = await fetch(
            `/connections/api/rules/member-mark-assignment/${currentProjectId}/${ruleId}/`,
            {
                method: 'DELETE',
                headers: { 'X-CSRFToken': csrftoken },
            }
        );
        if (response.ok) {
            showToast('규칙이 삭제되었습니다.', 'success');
            loadMemberMarkAssignmentRules();
        } else {
            showToast('삭제 실패', 'error');
        }
    } else if (target.classList.contains('save-rule-btn')) {
        let conditions;
        try {
            conditions = JSON.parse(
                ruleRow.querySelector('.rule-conditions-input').value || '[]'
            );
        } catch (e) {
            showToast('적용 조건이 유효한 JSON 형식이 아닙니다.', 'error');
            return;
        }

        const ruleData = {
            id: ruleId !== 'new' ? ruleId : null,
            name: ruleRow.querySelector('.rule-name-input').value,
            priority:
                parseInt(ruleRow.querySelector('.rule-priority-input').value) ||
                0,
            conditions: conditions,
            mark_expression: ruleRow.querySelector('.rule-expression-input')
                .value,
        };

        const response = await fetch(
            `/connections/api/rules/member-mark-assignment/${currentProjectId}/`,
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
            loadMemberMarkAssignmentRules();
        } else {
            showToast(result.message, 'error');
        }
    }
}