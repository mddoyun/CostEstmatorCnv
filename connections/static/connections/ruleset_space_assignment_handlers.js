/**
 * 프로젝트의 모든 '공간분류 할당 룰셋'을 불러옵니다.
 */
async function loadSpaceAssignmentRules() {
    if (!currentProjectId) {
        renderSpaceAssignmentRulesetTable([]);
        return;
    }
    try {
        await loadSpaceClassifications(); // 룰셋 테이블을 그리기 전에 공간 목록이 먼저 필요합니다.
        const response = await fetch(
            `/connections/api/rules/space-assignment/${currentProjectId}/`
        );
        if (!response.ok) throw new Error('공간분류 할당 룰셋 로딩 실패');
        loadedSpaceAssignmentRules = await response.json();
        renderSpaceAssignmentRulesetTable(loadedSpaceAssignmentRules);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * '공간분류 할당 룰셋' 테이블의 액션을 처리합니다.
 */
async function handleSpaceAssignmentRuleActions(event) {
    const target = event.target;
    const ruleRow = target.closest('tr');
    if (!ruleRow) return;
    const ruleId = ruleRow.dataset.ruleId;

    if (target.classList.contains('edit-rule-btn')) {
        renderSpaceAssignmentRulesetTable(loadedSpaceAssignmentRules, ruleId);
    } else if (target.classList.contains('cancel-edit-btn')) {
        renderSpaceAssignmentRulesetTable(loadedSpaceAssignmentRules);
    } else if (target.classList.contains('delete-rule-btn')) {
        if (!confirm('정말 이 규칙을 삭제하시겠습니까?')) return;
        const response = await fetch(
            `/connections/api/rules/space-assignment/${currentProjectId}/${ruleId}/`,
            {
                method: 'DELETE',
                headers: { 'X-CSRFToken': csrftoken },
            }
        );
        if (response.ok) {
            showToast('규칙이 삭제되었습니다.', 'success');
            loadSpaceAssignmentRules();
        } else {
            showToast('삭제 실패', 'error');
        }
    } else if (target.classList.contains('save-rule-btn')) {
        let member_filter_conditions;
        try {
            const conditionsStr = ruleRow
                .querySelector('.rule-member-filter-input')
                .value.trim();
            member_filter_conditions = conditionsStr
                ? JSON.parse(conditionsStr)
                : [];
        } catch (e) {
            showToast('부재 필터 조건이 유효한 JSON 형식이 아닙니다.', 'error');
            return;
        }

        const ruleData = {
            id: ruleId !== 'new' ? ruleId : null,
            name: ruleRow.querySelector('.rule-name-input').value,
            priority:
                parseInt(ruleRow.querySelector('.rule-priority-input').value) ||
                0,
            member_filter_conditions: member_filter_conditions,
            member_join_property: ruleRow
                .querySelector('.rule-member-join-input')
                .value.trim(),
            space_join_property: ruleRow
                .querySelector('.rule-space-join-input')
                .value.trim(),
        };

        if (!ruleData.member_join_property || !ruleData.space_join_property) {
            showToast('부재 및 공간 연결 속성은 필수 항목입니다.', 'error');
            return;
        }

        const response = await fetch(
            `/connections/api/rules/space-assignment/${currentProjectId}/`,
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
            loadSpaceAssignmentRules();
        } else {
            showToast(result.message, 'error');
        }
    }
}