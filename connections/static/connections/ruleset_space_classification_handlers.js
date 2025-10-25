// =====================================================================
// 공간분류 생성 룰셋(SpaceClassificationRule) 관리 및 적용 함수들
// =====================================================================

/**
 * 프로젝트의 모든 '공간분류 생성 룰셋'을 서버에서 불러와 화면을 다시 그립니다.
 */
async function loadSpaceClassificationRules() {
    if (!currentProjectId) {
        renderSpaceClassificationRulesetTable([]);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/rules/space-classification/${currentProjectId}/
`
        );
        if (!response.ok) throw new Error('공간분류 생성 룰셋 로딩 실패');
        loadedSpaceClassificationRules = await response.json();
        renderSpaceClassificationRulesetTable(loadedSpaceClassificationRules);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * '공간분류 생성 룰셋' 테이블의 액션(저장, 수정, 취소, 삭제)을 처리합니다.
 */
async function handleSpaceClassificationRuleActions(event) {
    const target = event.target;
    const ruleRow = target.closest('tr');
    if (!ruleRow) return;
    const ruleId = ruleRow.dataset.ruleId;

    if (target.classList.contains('edit-rule-btn')) {
        renderSpaceClassificationRulesetTable(
            loadedSpaceClassificationRules,
            ruleId
        );
    } else if (target.classList.contains('cancel-edit-btn')) {
        renderSpaceClassificationRulesetTable(loadedSpaceClassificationRules);
    } else if (target.classList.contains('delete-rule-btn')) {
        if (!confirm('정말 이 규칙을 삭제하시겠습니까?')) return;
        const response = await fetch(
            `/connections/api/rules/space-classification/${currentProjectId}/${ruleId}/
`,            {
                method: 'DELETE',
                headers: { 'X-CSRFToken': csrftoken },
            }
        );
        if (response.ok) {
            showToast('규칙이 삭제되었습니다.', 'success');
            loadSpaceClassificationRules();
        } else {
            showToast('삭제 실패', 'error');
        }
    } else if (target.classList.contains('save-rule-btn')) {
        let bim_object_filter;
        try {
            bim_object_filter = JSON.parse(
                ruleRow.querySelector('.rule-bim-filter-input').value || '{}'
            );
        } catch (e) {
            showToast('BIM 객체 필터가 유효한 JSON 형식이 아닙니다.', 'error');
            return;
        }

        const ruleData = {
            id: ruleId !== 'new' ? ruleId : null,
            level_depth:
                parseInt(
                    ruleRow.querySelector('.rule-level-depth-input').value
                ) || 0,
            level_name: ruleRow.querySelector('.rule-level-name-input').value,
            bim_object_filter: bim_object_filter,
            name_source_param: ruleRow.querySelector('.rule-name-source-input')
                .value,
            parent_join_param: ruleRow.querySelector('.rule-parent-join-input')
                .value,
            child_join_param: ruleRow.querySelector('.rule-child-join-input')
                .value,
        };

        const response = await fetch(
            `/connections/api/rules/space-classification/${currentProjectId}/
`,            {
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
            loadSpaceClassificationRules();
        } else {
            showToast(result.message, 'error');
        }
    }
}

/**
 * 정의된 룰셋을 적용하여 공간분류 자동 생성/동기화를 실행합니다.
 */
async function applySpaceClassificationRules() {
    if (!currentProjectId) {
        showToast('프로젝트를 선택하세요.', 'error');
        return;
    }
    if (
        !confirm(
            '정의된 룰셋을 기반으로 공간분류를 자동 생성/동기화하시겠습니까?\n이 작업은 룰에 의해 생성된 항목만 영향을 주며, 수동으로 추가한 항목은 보존됩니다.'
        )
    ) {
        return;
    }

    showToast(
        '룰셋을 적용하여 공간분류를 동기화하고 있습니다. 잠시만 기다려주세요...', 'info', 5000
    );
    try {
        const response = await fetch(
            `/connections/api/space-classifications/apply-rules/${currentProjectId}/
`,            {
                method: 'POST',
                headers: { 'X-CSRFToken': csrftoken },
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');
        // 동기화 후, 공간분류 트리 뷰를 새로고침합니다.
        await loadSpaceClassifications();
    } catch (error) {
        showToast(`룰셋 적용 실패: ${error.message}`, 'error');
    }
}
