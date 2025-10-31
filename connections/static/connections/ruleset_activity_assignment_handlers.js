// ============================================
// 액티비티 할당 룰셋 관리 (ActivityAssignmentRule)
// CostItem에 Activity를 자동 할당하는 룰셋
// ============================================

let loadedActivityAssignmentRules = [];

/**
 * 액티비티 할당 룰셋 목록 로드
 */
async function loadActivityAssignmentRules() {
    if (!currentProjectId) {
        renderActivityAssignmentRulesetTable([]);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/rules/activity-assignment/${currentProjectId}/`
        );
        if (!response.ok) throw new Error('액티비티 할당 룰셋 로딩 실패');
        loadedActivityAssignmentRules = await response.json();
        renderActivityAssignmentRulesetTable(loadedActivityAssignmentRules);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 액티비티 할당 룰셋 버튼 이벤트 핸들러
 */
async function handleActivityAssignmentRuleActions(event) {
    const target = event.target;
    const ruleRow = target.closest('tr');
    if (!ruleRow) return;
    const ruleId = ruleRow.dataset.ruleId;

    // 수정 버튼
    if (target.classList.contains('edit-rule-btn')) {
        renderActivityAssignmentRulesetTable(
            loadedActivityAssignmentRules,
            ruleId
        );
    }
    // 취소 버튼
    else if (target.classList.contains('cancel-edit-btn')) {
        renderActivityAssignmentRulesetTable(loadedActivityAssignmentRules);
    }
    // 삭제 버튼
    else if (target.classList.contains('delete-rule-btn')) {
        if (!confirm('정말 이 규칙을 삭제하시겠습니까?')) return;
        const response = await fetch(
            `/connections/api/rules/activity-assignment/${currentProjectId}/${ruleId}/`,
            {
                method: 'DELETE',
                headers: { 'X-CSRFToken': csrftoken },
            }
        );
        if (response.ok) {
            showToast('규칙이 삭제되었습니다.', 'success');
            loadActivityAssignmentRules();
        } else {
            showToast('삭제 실패', 'error');
        }
    }
    // 저장 버튼
    else if (target.classList.contains('save-rule-btn')) {
        // UI에서 조건들 수집
        const conditionRows = ruleRow.querySelectorAll('.condition-row');
        const conditions = [];

        conditionRows.forEach(row => {
            const property = row.querySelector('.condition-property').value;
            const operator = row.querySelector('.condition-operator').value;
            const value = row.querySelector('.condition-value').value;

            if (property && value) {
                conditions.push({
                    property: property,
                    operator: operator,
                    value: value
                });
            }
        });

        const targetActivitySelect = ruleRow.querySelector('.rule-activity-select');
        const targetActivityId = targetActivitySelect.value;

        if (!targetActivityId) {
            showToast('대상 액티비티를 선택해주세요.', 'error');
            return;
        }

        const ruleData = {
            id: ruleId !== 'new' ? ruleId : null,
            name: ruleRow.querySelector('.rule-name-input').value,
            description: ruleRow.querySelector('.rule-description-input').value || '',
            priority:
                parseInt(ruleRow.querySelector('.rule-priority-input').value) ||
                0,
            conditions: conditions,
            target_activity_id: targetActivityId,
        };

        const response = await fetch(
            `/connections/api/rules/activity-assignment/${currentProjectId}/`,
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
            loadActivityAssignmentRules();
        } else {
            showToast(result.message, 'error');
        }
    }
}

/**
 * 액티비티 할당 룰셋 일괄 적용
 */
async function applyActivityAssignmentRules() {
    if (!currentProjectId) {
        showToast('프로젝트를 먼저 선택해주세요.', 'error');
        return;
    }

    if (!confirm('액티비티 할당 룰셋을 모든 산출항목에 일괄 적용하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(
            `/connections/api/rules/activity-assignment/apply/${currentProjectId}/`,
            {
                method: 'POST',
                headers: { 'X-CSRFToken': csrftoken },
            }
        );

        const result = await response.json();
        if (response.ok) {
            showToast(result.message, 'success');
            // 액티비티 할당 테이블 새로고침
            if (typeof loadActivityAssignments === 'function') {
                await loadActivityAssignments();
            }
            // 간트차트 새로고침 (간트차트 탭이 로드된 경우)
            if (typeof window.loadGanttChart === 'function') {
                window.loadGanttChart();
            }
        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        showToast('액티비티 할당 중 오류가 발생했습니다.', 'error');
        console.error(error);
    }
}

/**
 * 액티비티 할당 룰셋 내보내기
 */
async function exportActivityAssignmentRules() {
    if (!currentProjectId) {
        showToast('프로젝트를 먼저 선택해주세요.', 'error');
        return;
    }
    window.location.href = `/connections/api/rules/activity-assignment/${currentProjectId}/export/`;
}

/**
 * 액티비티 할당 룰셋 가져오기
 */
async function importActivityAssignmentRules() {
    if (!currentProjectId) {
        showToast('프로젝트를 먼저 선택해주세요.', 'error');
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('csv_file', file);

        try {
            const response = await fetch(
                `/connections/api/rules/activity-assignment/${currentProjectId}/import/`,
                {
                    method: 'POST',
                    headers: { 'X-CSRFToken': csrftoken },
                    body: formData,
                }
            );

            const result = await response.json();
            if (response.ok) {
                showToast(result.message, 'success');
                loadActivityAssignmentRules();
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast('가져오기 중 오류가 발생했습니다.', 'error');
            console.error(error);
        }
    };
    input.click();
}
