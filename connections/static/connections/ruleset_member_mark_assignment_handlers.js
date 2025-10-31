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

        // 일람부호 선택에서 mark_expression 생성
        const memberMarkSelect = ruleRow.querySelector('.rule-member-mark-select');
        const selectedMemberMarkId = memberMarkSelect.value;

        if (!selectedMemberMarkId) {
            showToast('일람부호를 선택해주세요.', 'error');
            return;
        }

        // 선택된 일람부호 정보 가져오기
        const selectedMemberMark = window.loadedMemberMarks.find(mm => mm.id === selectedMemberMarkId);
        if (!selectedMemberMark) {
            showToast('선택된 일람부호를 찾을 수 없습니다.', 'error');
            return;
        }

        const ruleData = {
            id: ruleId !== 'new' ? ruleId : null,
            name: ruleRow.querySelector('.rule-name-input').value,
            description: ruleRow.querySelector('.rule-description-input')?.value || '',
            priority:
                parseInt(ruleRow.querySelector('.rule-priority-input').value) ||
                0,
            conditions: conditions,
            mark_expression: selectedMemberMark.mark,
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