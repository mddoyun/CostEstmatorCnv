// 룰셋 테이블의 모든 동작(저장, 수정, 취소, 삭제)을 처리하는 함수
async function handleClassificationRuleActions(event) {
    const target = event.target;
    const ruleRow = target.closest('tr');
    if (!ruleRow) return;

    const ruleId = ruleRow.dataset.ruleId;

    // --- 수정 버튼 클릭 ---
    if (target.classList.contains('edit-rule-btn')) {
        const existingEditRow = document.querySelector(
            '#classification-ruleset .rule-edit-row'
        );
        if (existingEditRow) {
            showToast('이미 편집 중인 규칙이 있습니다.', 'error');
            return;
        }
        // loadedClassificationRules에서 현재 데이터를 찾아 편집 모드로 렌더링
        const ruleToEdit = loadedClassificationRules.find(
            (r) => r.id === parseInt(ruleId)
        );
        renderClassificationRulesetTable(
            loadedClassificationRules,
            ruleToEdit.id
        );
    }

    // --- 삭제 버튼 클릭 ---
    else if (target.classList.contains('delete-rule-btn')) {
        if (!confirm('이 규칙을 정말 삭제하시겠습니까?')) return;
        await deleteClassificationRule(ruleId);
    }

    // --- 저장 버튼 클릭 ---
    else if (target.classList.contains('save-rule-btn')) {
        const description = ruleRow.querySelector(
            '.rule-description-input'
        ).value;
        const target_tag_id = ruleRow.querySelector('.rule-tag-select').value;

        if (!target_tag_id) {
            showToast('대상 분류를 선택하세요.', 'error');
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

        const ruleData = {
            id: ruleId !== 'new' ? parseInt(ruleId) : null,
            target_tag_id: target_tag_id,
            conditions: conditions,
            description: description,
        };

        await saveClassificationRule(ruleData);
    }

    // --- 취소 버튼 클릭 ---
    else if (target.classList.contains('cancel-edit-btn')) {
        renderClassificationRulesetTable(loadedClassificationRules);
    }
}
/**
 * '분류 할당 룰셋'을 서버에 저장(생성/업데이트)합니다.
 * @param {Object} ruleData - 저장할 규칙 데이터
 */

async function saveClassificationRule(ruleData) {
    try {
        // ▼▼▼ [수정] URL 앞에 '/connections'를 추가합니다. ▼▼▼
        const response = await fetch(
            `/connections/api/rules/classification/${currentProjectId}/`, {
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
        await loadClassificationRules(); // 성공 후 목록 새로고침
    } catch (error) {
        console.error('Error saving rule:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 서버에서 '분류 할당 룰셋'을 삭제합니다.
 * @param {Number} ruleId - 삭제할 규칙의 ID
 */

async function deleteClassificationRule(ruleId) {
    try {
        // ▼▼▼ [수정] URL 앞에 '/connections'를 추가합니다. ▼▼▼
        const response = await fetch(
            `/connections/api/rules/classification/${currentProjectId}/${ruleId}/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': csrftoken,
                },
            }
        );

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || '규칙 삭제에 실패했습니다.');
        }

        showToast(result.message, 'success');
        await loadClassificationRules(); // 성공 후 목록 새로고침
    } catch (error) {
        console.error('Error deleting rule:', error);
        showToast(error.message, 'error');
    }
}

// ui.js에서 loadClassificationRules 함수를 app.js로 이동하고 수정합니다.
/**
 * 프로젝트의 모든 '분류 할당 룰셋'을 서버에서 불러와 전역 변수에 저장하고 화면을 다시 그립니다.
 */

async function loadClassificationRules() {
    if (!currentProjectId) {
        loadedClassificationRules = [];
        renderClassificationRulesetTable(loadedClassificationRules);
        return;
    }
    try {
        // ▼▼▼ [수정] URL 앞에 '/connections'를 추가합니다. ▼▼▼
        const response = await fetch(
            `/connections/api/rules/classification/${currentProjectId}/`
        );
        if (!response.ok) {
            throw new Error('룰셋 데이터를 불러오는데 실패했습니다.');
        }
        loadedClassificationRules = await response.json(); // 불러온 데이터를 전역 변수에 저장
        renderClassificationRulesetTable(loadedClassificationRules); // 저장된 데이터로 테이블 렌더링
    } catch (error) {
        console.error('Error loading classification rules:', error);
        loadedClassificationRules = [];
        renderClassificationRulesetTable(loadedClassificationRules); // 에러 시 빈 테이블 표시
        showToast(error.message, 'error');
    }
}
async function applyClassificationRules(skipConfirmation = false) {
    // [변경] 파라미터 추가
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }

    // [변경] skipConfirmation이 false일 때만 확인 창을 띄우도록 수정
    if (
        !skipConfirmation &&
        !confirm(
            '정의된 모든 분류 할당 룰셋을 전체 객체에 적용하시겠습니까?\n기존에 할당된 분류는 유지되며, 규칙에 맞는 새로운 분류가 추가됩니다.'
        )
    ) {
        return;
    }

    console.log("[DEBUG] '룰셋 일괄적용' 시작. 서버에 API 요청을 보냅니다.");
    showToast('룰셋을 적용하고 있습니다... 잠시만 기다려주세요.', 'info', 5000);

    try {
        const response = await fetch(
            `/connections/api/rules/apply-classification/${currentProjectId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrftoken,
                    'Content-Type': 'application/json',
                },
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || '룰셋 적용에 실패했습니다.');
        }

        showToast(result.message, 'success');
        console.log(
            '[DEBUG] 서버에서 룰셋 적용 성공. 결과 메시지:',
            result.message
        );

        console.log(
            '[DEBUG] Revit/Blender 재호출 없이, 서버에 최신 객체 데이터 재요청을 보냅니다.'
        );
        if (frontendSocket && frontendSocket.readyState === WebSocket.OPEN) {
            frontendSocket.send(
                JSON.stringify({
                    type: 'get_all_elements',
                    payload: { project_id: currentProjectId },
                })
            );
        } else {
            console.error(
                '[ERROR] 웹소켓이 연결되어 있지 않아 최신 데이터를 가져올 수 없습니다.'
            );
            showToast('웹소켓 연결 오류. 페이지를 새로고침해주세요.', 'error');
        }
    } catch (error) {
        console.error('[ERROR] 룰셋 적용 중 오류 발생:', error);
        showToast(error.message, 'error');
    }
}
