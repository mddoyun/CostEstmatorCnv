

// =====================================================================
// 수량산출부재(Quantity Members) 관리 관련 함수들
// =====================================================================

function setupQuantityMembersListeners() {
    document
        .getElementById('create-qm-manual-btn')
        ?.addEventListener('click', createManualQuantityMember);
    document
        .getElementById('create-qm-auto-btn')
        ?.addEventListener('click', () => createAutoQuantityMembers(false)); // 확인창 표시
    document
        .getElementById('apply-assignment-rules-btn')
        ?.addEventListener('click', () => applyAssignmentRules(false)); // 확인창 표시
    const qmTableContainer = document.getElementById('qm-table-container');
    if (qmTableContainer) {
        qmTableContainer.addEventListener('click', handleQuantityMemberActions); // 수정, 삭제, 저장, 취소, 행 선택, 그룹 토글 위임
        qmTableContainer.addEventListener('keyup', handleQmColumnFilter); // 필터
    }
    document
        .getElementById('qm-properties-container')
        ?.closest('.control-box')
        ?.addEventListener('click', handleQmPropertiesActions); // 속성 추가/삭제 위임
    // 할당 버튼들
    document
        .getElementById('qm-assign-cost-code-btn')
        ?.addEventListener('click', assignCostCodeToQm);
    document
        .getElementById('qm-clear-cost-codes-btn')
        ?.addEventListener('click', clearCostCodesFromQm);
    document
        .getElementById('qm-assign-member-mark-btn')
        ?.addEventListener('click', assignMemberMarkToQm);
    document
        .getElementById('qm-clear-member-marks-btn')
        ?.addEventListener('click', clearMemberMarksFromQm);
    document
        .getElementById('qm-assign-space-btn')
        ?.addEventListener('click', assignSpaceToQm);
    document
        .getElementById('qm-clear-spaces-btn')
        ?.addEventListener('click', clearSpacesFromQm);
    document
        .getElementById('add-qm-group-level-btn')
        ?.addEventListener('click', addQmGroupingLevel);
    document
        .querySelector('#quantity-members .details-panel-tabs')
        ?.addEventListener('click', handleQmDetailTabClick); // 오른쪽 상세 탭
    document
        .querySelector('#quantity-members .view-tabs')
        ?.addEventListener('click', handleQmViewTabClick); // 테이블 뷰 전환 탭
    console.log('[DEBUG] Quantity Members listeners setup complete.');
}

async function loadQuantityMembers() {
    if (!currentProjectId) {
        renderActiveQmView();
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/quantity-members/${currentProjectId}/
`
        );
        if (!response.ok)
            throw new Error('수량산출부재 목록을 불러오는데 실패했습니다.');

        // ▼▼▼ [수정] is_active=true인 QuantityMember만 로드 (분할된 경우 원본 숨김) ▼▼▼
        const allMembers = await response.json();
        loadedQuantityMembers = allMembers.filter(qm => qm.is_active !== false);
        console.log(`[QM Manager] Loaded ${loadedQuantityMembers.length} active QuantityMembers (filtered ${allMembers.length - loadedQuantityMembers.length} inactive)`);
        renderActiveQmView();

        populateQmFieldSelection(loadedQuantityMembers);
    } catch (error) {
        console.error('Error loading quantity members:', error);
        showToast(error.message, 'error');
    }
}

async function createManualQuantityMember() {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/quantity-members/${currentProjectId}/
`, { 
                method: 'POST',
                headers: { 'X-CSRFToken': csrftoken },
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');
        await loadQuantityMembers(); // 목록 새로고침
    } catch (error) {
        console.error('Error creating manual quantity member:', error);
        showToast(error.message, 'error');
    }
}

async function createAutoQuantityMembers(skipConfirmation = false) {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }

    if (
        !skipConfirmation &&
        !confirm(
            '정말로 모든 수량산출부재를 자동으로 다시 생성하시겠습니까?\n이 작업은 기존에 있던 모든 수량산출부재를 삭제하고, 현재의 수량산출분류를 기준으로 새로 생성합니다.'
        )
    ) {
        return;
    }

    showToast('수량산출부재를 자동으로 생성하고 있습니다...', 'info', 5000);

    try {
        const response = await fetch(
            `/connections/api/quantity-members/auto-create/${currentProjectId}/
`, { 
                method: 'POST',
                headers: { 'X-CSRFToken': csrftoken },
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');
        await loadQuantityMembers(); // 성공 후 목록 새로고침
    } catch (error) {
        console.error('Error creating auto quantity members:', error);
        showToast(error.message, 'error');
    }
}

function addQmGroupingLevel() {
    const container = document.getElementById('qm-grouping-controls');
    const newIndex = container.children.length + 1;
    const newLevelDiv = document.createElement('div');
    newLevelDiv.className = 'group-level';
    newLevelDiv.innerHTML = `
        <label>${newIndex}차:</label>
        <select class="qm-group-by-select"></select>
        <button class="remove-group-level-btn">-</button>
    `;
    container.appendChild(newLevelDiv);
    populateQmFieldSelection(loadedQuantityMembers); // QM 필드 목록으로 채웁니다.

    newLevelDiv
        .querySelector('.remove-group-level-btn')
        .addEventListener('click', function () {
            this.parentElement.remove();
            renderActiveQmView();
        });
}

function handleQmColumnFilter(event) {
    if (
        event.target.classList.contains('column-filter') &&
        event.key === 'Enter'
    ) {
        qmColumnFilters[event.target.dataset.field] =
            event.target.value.toLowerCase();
        renderActiveQmView();
    }
}

function handleQmRowSelection(event, clickedRow) {
    const tableContainer = document.getElementById('qm-table-container');
    const allVisibleRows = Array.from(
        tableContainer.querySelectorAll('tr[data-id]')
    );
    const clickedRowIndex = allVisibleRows.findIndex(
        (r) => r.dataset.id === clickedRow.dataset.id
    );
    const memberId = clickedRow.dataset.id;
    if (!memberId) return;

    if (event.shiftKey && lastSelectedQmRowIndex > -1) {
        const start = Math.min(lastSelectedQmRowIndex, clickedRowIndex);
        const end = Math.max(lastSelectedQmRowIndex, clickedRowIndex);
        if (!event.ctrlKey) selectedQmIds.clear();
        for (let i = start; i <= end; i++) {
            const rowId = allVisibleRows[i].dataset.id;
            if (rowId) selectedQmIds.add(rowId);
        }
    } else if (event.ctrlKey) {
        if (selectedQmIds.has(memberId)) selectedQmIds.delete(memberId);
        else selectedQmIds.add(memberId);
    } else {
        selectedQmIds.clear();
        selectedQmIds.add(memberId);
    }
    lastSelectedQmRowIndex = clickedRowIndex;
}

async function handleQuantityMemberActions(event) {
    const target = event.target;
    const actionRow = target.closest('tr');

    if (actionRow && actionRow.classList.contains('group-header')) {
        const groupPath = actionRow.dataset.groupPath;
        if (groupPath) toggleQmGroup(groupPath);
        return;
    }

    if (!actionRow) return;

    const memberId = actionRow.dataset.id;
    const isEditRow = document.querySelector(
        '#qm-table-container .qm-edit-row'
    );

    if (target.matches('input, select, textarea')) {
        return;
    }

    if (!target.closest('button') && actionRow.dataset.id) {
        handleQmRowSelection(event, actionRow);
        renderActiveQmView(isEditRow?.dataset.id);
        renderQmPropertiesTable(isEditRow?.dataset.id);
        renderQmCostCodesList();
        renderQmMemberMarkDetails();
        renderQmLinkedRawElementPropertiesTable();
        renderQmSpacesList();

        // 룰셋 작성 도우미 패널 업데이트 (선택된 부재가 1개일 때만)
        if (selectedQmIds.size === 1) {
            const selectedId = Array.from(selectedQmIds)[0];
            const selectedMember = loadedQuantityMembers.find(m => m.id === selectedId);
            if (selectedMember) {
                updateQmRulesetHelperPanel(selectedMember);
            }
        } else {
            updateQmRulesetHelperPanel(null);
        }

        return;
    }

    if (!memberId) return;

    if (target.classList.contains('edit-qm-btn')) {
        if (activeQmView !== 'quantity-member-view') {
            showToast(
                "'수량산출부재 뷰'에서만 항목을 수정할 수 있습니다.", 'error'
            );
            return;
        }
        if (isEditRow) {
            showToast('이미 편집 중인 부재가 있습니다.', 'error');
            return;
        }
        renderActiveQmView(memberId);
        renderQmPropertiesTable(memberId);
    }

    else if (target.classList.contains('cancel-qm-btn')) {
        renderActiveQmView();
        renderQmPropertiesTable();
    }

    else if (target.classList.contains('save-qm-btn')) {
        const nameInput = actionRow.querySelector('.qm-name-input');
        const tagSelect = actionRow.querySelector('.qm-tag-select');
        const properties = {};
        const propRows = document.querySelectorAll(
            '#qm-properties-container .property-edit-row'
        );
        let hasError = false;

        propRows.forEach((row) => {
            const keyInput = row.querySelector('.prop-key-input');
            const valueInput = row.querySelector('.prop-value-input');
            const key = keyInput.value.trim();
            if (key && properties.hasOwnProperty(key)) {
                showToast(`속성 이름 "${key}"이(가) 중복되었습니다.`, 'error');
                hasError = true;
            }
            if (key) properties[key] = valueInput.value;
        });
        if (hasError) return;

        let mapping_expression, costCodeExpressions;
        try {
            const rawMappingExpr = actionRow.querySelector(
                '.qm-mapping-expression-input'
            ).value;
            mapping_expression =
                rawMappingExpr.trim() === '' ? {} : JSON.parse(rawMappingExpr);
        } catch (e) {
            showToast('맵핑식(JSON) 형식이 올바르지 않습니다.', 'error');
            return;
        }

        const markExpression = actionRow.querySelector(
            '.qm-mark-expr-input'
        ).value;

        try {
            const rawCcExpr =
                actionRow.querySelector('.qm-cc-expr-input').value;
            costCodeExpressions =
                rawCcExpr.trim() === '' ? [] : JSON.parse(rawCcExpr);
            if (!Array.isArray(costCodeExpressions))
                throw new Error(
                    '개별 공사코드 룰은 반드시 배열(list) 형식이어야 합니다.'
                );
        } catch (e) {
            showToast(
                e.message ||
                    '개별 공사코드 룰(JSON)이 올바른 목록 형식이 아닙니다.',
                'error'
            );
            return;
        }

        const memberData = {
            name: nameInput.value,
            classification_tag_id: tagSelect.value,
            properties: properties,
            mapping_expression: mapping_expression,
            member_mark_expression: markExpression,
            cost_code_expressions: costCodeExpressions,
        };

        try {
            const response = await fetch(
                `/connections/api/quantity-members/${currentProjectId}/${memberId}/
`, { 
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken,
                    },
                    body: JSON.stringify(memberData),
                }
            );

            const result = await response.json();
            if (!response.ok)
                throw new Error(
                    result.message || `저장에 실패했습니다: ${response.status}`
                );
            showToast(result.message, 'success');

            await loadQuantityMembers();

            renderQmPropertiesTable();
            renderQmCostCodesList();
            renderQmMemberMarkDetails();
            renderQmLinkedRawElementPropertiesTable();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    else if (target.classList.contains('delete-qm-btn')) {
        if (activeQmView !== 'quantity-member-view') {
            showToast(
                "'수량산출부재 뷰'에서만 항목을 삭제할 수 있습니다.", 'error'
            );
            return;
        }
        if (confirm('이 수량산출부재를 정말 삭제하시겠습니까?')) {
            try {
                const response = await fetch(
                    `/connections/api/quantity-members/${currentProjectId}/${memberId}/
`, { 
                        method: 'DELETE',
                        headers: { 'X-CSRFToken': csrftoken },
                    }
                );
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                showToast(result.message, 'success');

                selectedQmIds.delete(memberId);
                await loadQuantityMembers();

                renderQmPropertiesTable();
                renderQmCostCodesList();
                renderQmMemberMarkDetails();
                renderQmLinkedRawElementPropertiesTable();
            } catch (error) {
                showToast(error.message, 'error');
            }
        }
    }
}

function handleQmPropertiesActions(event) {
    const target = event.target;

    if (target.id === 'add-property-btn') {
        const tableBody = document.querySelector(
            '#qm-properties-container .properties-table tbody'
        );
        if (tableBody) {
            const newRow = document.createElement('tr');
            newRow.className = 'property-edit-row';
            newRow.innerHTML = `
                <td><input type="text" class="prop-key-input" placeholder="새 속성 이름"></td>
                <td><input type="text" class="prop-value-input" placeholder="값"></td>
                <td><button class="delete-prop-btn">삭제</button></td>
            `;
            tableBody.appendChild(newRow);
        }
    }
    else if (target.classList.contains('delete-prop-btn')) {
        target.closest('tr').remove();
    }
}

function renderQmCostCodesList() {
    const container = document.getElementById('qm-cost-codes-list');
    if (selectedQmIds.size === 0) {
        container.innerHTML = '공사코드를 보려면 부재를 선택하세요.';
        return;
    }

    const selectedMembers = loadedQuantityMembers.filter((m) =>
        selectedQmIds.has(m.id)
    );
    if (selectedMembers.length === 0) {
        container.innerHTML = '선택된 부재를 찾을 수 없습니다.';
        return;
    }

    const firstMemberCodes = new Set(selectedMembers[0].cost_code_ids);
    const commonCodeIds = [...firstMemberCodes].filter((codeId) =>
        selectedMembers.every((member) => member.cost_code_ids.includes(codeId))
    );

    if (commonCodeIds.length === 0) {
        container.innerHTML =
            '선택된 부재들에 공통으로 할당된 공사코드가 없습니다.';
        if (selectedQmIds.size > 1) {
            container.innerHTML +=
                '<br><small>(개별 부재에는 할당되어 있을 수 있습니다)</small>';
        }
        return;
    }

    container.innerHTML =
        '<ul>' +
        commonCodeIds
            .map((codeId) => {
                const costCode = loadedCostCodes.find((c) => c.id === codeId);
                return costCode
                    ? `<li>${costCode.code} - ${costCode.name}</li>`
                    : `<li>알 수 없는 코드: ${codeId}</li>`;
            })
            .join('') +
        '</ul>';
}

async function assignCostCodeToQm() {
    const costCodeId = document.getElementById(
        'qm-cost-code-assign-select'
    ).value;
    if (!costCodeId) {
        showToast('적용할 공사코드를 선택하세요.', 'error');
        return;
    }
    if (selectedQmIds.size === 0) {
        showToast('공사코드를 적용할 부재를 테이블에서 선택하세요.', 'error');
        return;
    }

    try {
        const response = await fetch(
            `/connections/api/quantity-members/manage-cost-codes/${currentProjectId}/
`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    member_ids: Array.from(selectedQmIds),
                    cost_code_id: costCodeId,
                    action: 'assign',
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');

        loadedQuantityMembers.forEach((member) => {
            if (selectedQmIds.has(member.id)) {
                if (!member.cost_code_ids.includes(costCodeId)) {
                    member.cost_code_ids.push(costCodeId);
                }
            }
        });
        renderQmCostCodesList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function clearCostCodesFromQm() {
    if (selectedQmIds.size === 0) {
        showToast('공사코드를 제거할 부재를 테이블에서 선택하세요.', 'error');
        return;
    }
    if (
        !confirm(
            `${selectedQmIds.size}개 부재의 모든 공사코드를 제거하시겠습니까?`
        )
    ) {
        return;
    }

    try {
        const response = await fetch(
            `/connections/api/quantity-members/manage-cost-codes/${currentProjectId}/
`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    member_ids: Array.from(selectedQmIds),
                    action: 'clear',
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');

        loadedQuantityMembers.forEach((member) => {
            if (selectedQmIds.has(member.id)) {
                member.cost_code_ids = [];
            }
        });
        renderQmCostCodesList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderQmMemberMarksList() {
    const container = document.getElementById('qm-member-marks-list');
    if (selectedQmIds.size === 0) {
        container.innerHTML = '일람부호를 보려면 부재를 선택하세요.';
        return;
    }
    const selectedMembers = loadedQuantityMembers.filter((m) =>
        selectedQmIds.has(m.id)
    );
    if (selectedMembers.length === 0) {
        container.innerHTML = '선택된 부재를 찾을 수 없습니다.';
        return;
    }

    const firstMemberMarks = new Set(selectedMembers[0].member_mark_ids);
    const commonMarkIds = [...firstMemberMarks].filter((markId) =>
        selectedMembers.every((member) =>
            member.member_mark_ids.includes(markId)
        )
    );

    if (commonMarkIds.length === 0) {
        container.innerHTML =
            '선택된 부재들에 공통으로 할당된 일람부호가 없습니다.';
        if (selectedQmIds.size > 1) {
            container.innerHTML +=
                '<br><small>(개별 부재에는 할당되어 있을 수 있습니다)</small>';
        }
        return;
    }
    container.innerHTML =
        '<ul>' +
        commonMarkIds
            .map((markId) => {
                const mark = loadedMemberMarks.find((m) => m.id === markId);
                return mark
                    ? `<li>${mark.mark}</li>`
                    : `<li>알 수 없는 부호: ${markId}</li>`;
            })
            .join('') +
        '</ul>';
}

async function assignMemberMarkToQm() {
    const markId = document.getElementById(
        'qm-member-mark-assign-select'
    ).value;
    if (!markId) {
        showToast('적용할 일람부호를 선택하세요.', 'error');
        return;
    }
    if (selectedQmIds.size === 0) {
        showToast('일람부호를 적용할 부재를 선택하세요.', 'error');
        return;
    }

    try {
        const response = await fetch(
            `/connections/api/quantity-members/manage-member-marks/${currentProjectId}/
`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    member_ids: Array.from(selectedQmIds),
                    mark_id: markId,
                    action: 'assign',
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');

        loadedQuantityMembers.forEach((member) => {
            if (selectedQmIds.has(member.id)) {
                member.member_mark_id = markId;
            }
        });
        renderQmMemberMarkDetails();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function clearMemberMarksFromQm() {
    if (selectedQmIds.size === 0) {
        showToast('일람부호를 제거할 부재를 선택하세요.', 'error');
        return;
    }
    if (!confirm(`${selectedQmIds.size}개 부재의 일람부호를 제거하시겠습니까?`))
        return;

    try {
        const response = await fetch(
            `/connections/api/quantity-members/manage-member-marks/${currentProjectId}/
`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    member_ids: Array.from(selectedQmIds),
                    action: 'clear',
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');

        loadedQuantityMembers.forEach((member) => {
            if (selectedQmIds.has(member.id)) {
                member.member_mark_id = null;
            }
        });
        renderQmMemberMarkDetails();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function handleQmViewTabClick(event) {
    const clickedButton = event.target.closest('.view-tab-button');
    if (!clickedButton || clickedButton.classList.contains('active')) {
        return;
    }

    document
        .querySelectorAll('#quantity-members .view-tab-button.active')
        .forEach((btn) => {
            btn.classList.remove('active');
        });

    clickedButton.classList.add('active');

    activeQmView = clickedButton.dataset.view;
    qmCollapsedGroups = {};
    qmColumnFilters = {};
    renderActiveQmView();
}

function handleQmDetailTabClick(event) {
    const clickedButton = event.target.closest('.detail-tab-button');
    if (!clickedButton || clickedButton.classList.contains('active')) {
        return;
    }

    const targetTab = clickedButton.dataset.tab;
    const detailsPanel = clickedButton.closest('.details-panel');

    detailsPanel
        .querySelectorAll('.detail-tab-button.active')
        .forEach((btn) => btn.classList.remove('active'));
    detailsPanel
        .querySelectorAll('.detail-tab-content.active')
        .forEach((content) => content.classList.remove('active'));

    clickedButton.classList.add('active');
    const targetContent = detailsPanel.querySelector(
        `.detail-tab-content[data-tab="${targetTab}"]`
    );
    if (targetContent) {
        targetContent.classList.add('active');
    }
}

function renderQmSpacesList() {
    const container = document.getElementById('qm-spaces-list');
    if (selectedQmIds.size === 0) {
        container.innerHTML = '공간분류를 보려면 부재를 선택하세요.';
        return;
    }

    const selectedMembers = loadedQuantityMembers.filter((m) =>
        selectedQmIds.has(m.id)
    );
    if (selectedMembers.length === 0) {
        container.innerHTML = '선택된 부재를 찾을 수 없습니다.';
        return;
    }

    const firstMemberSpaces = new Set(
        selectedMembers[0].space_classification_ids || []
    );
    const commonSpaceIds = [...firstMemberSpaces].filter((spaceId) =>
        selectedMembers.every((member) =>
            (member.space_classification_ids || []).includes(spaceId)
        )
    );

    if (commonSpaceIds.length === 0) {
        container.innerHTML =
            '선택된 부재들에 공통으로 할당된 공간분류가 없습니다.';
        return;
    }

    container.innerHTML =
        '<ul>' +
        commonSpaceIds
            .map((spaceId) => {
                const space = loadedSpaceClassifications.find(
                    (s) => s.id === spaceId
                );
                return space
                    ? `<li>${space.name}</li>`
                    : `<li>알 수 없는 공간: ${spaceId}</li>`;
            })
            .join('') +
        '</ul>';
}

async function assignSpaceToQm() {
    const spaceId = document.getElementById('qm-space-assign-select').value;
    if (!spaceId) {
        showToast('적용할 공간분류를 선택하세요.', 'error');
        return;
    }
    if (selectedQmIds.size === 0) {
        showToast('공간분류를 적용할 부재를 테이블에서 선택하세요.', 'error');
        return;
    }

    try {
        const response = await fetch(
            `/connections/api/quantity-members/manage-spaces/${currentProjectId}/
`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    member_ids: Array.from(selectedQmIds),
                    space_id: spaceId,
                    action: 'assign',
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');
        loadedQuantityMembers.forEach((member) => {
            if (selectedQmIds.has(member.id)) {
                if (!member.space_classification_ids)
                    member.space_classification_ids = [];
                if (!member.space_classification_ids.includes(spaceId)) {
                    member.space_classification_ids.push(spaceId);
                }
            }
        });
        renderQmSpacesList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function clearSpacesFromQm() {
    if (selectedQmIds.size === 0) {
        showToast('공간분류를 제거할 부재를 선택하세요.', 'error');
        return;
    }
    if (
        !confirm(
            `${selectedQmIds.size}개 부재의 모든 공간분류를 제거하시겠습니까?`
        )
    )
        return;

    try {
        const response = await fetch(
            `/connections/api/quantity-members/manage-spaces/${currentProjectId}/
`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    member_ids: Array.from(selectedQmIds),
                    action: 'clear',
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        showToast(result.message, 'success');
        loadedQuantityMembers.forEach((member) => {
            if (selectedQmIds.has(member.id))
                member.space_classification_ids = [];
        });
        renderQmSpacesList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ▼▼▼ [추가] 3D Viewer에서 사용할 수 있도록 window에 노출 ▼▼▼
window.loadQuantityMembersForViewer = loadQuantityMembers;
// ▲▲▲ [추가] 여기까지 ▲▲▲

/**
 * 룰셋 작성 도우미 패널 업데이트 (수량산출부재)
 */
function updateQmRulesetHelperPanel(member) {
    const panel = document.getElementById('qm-ruleset-properties-content');
    if (!panel) return;

    if (!member) {
        panel.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">부재를 선택해주세요</p>';
        return;
    }

    let html = '<div style="font-size: 13px;">';

    // 기본 속성
    html += '<div style="margin-bottom: 20px;">';
    html += '<h5 style="margin: 0 0 10px 0; color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 5px;">📌 기본 속성</h5>';
    html += '<table class="ruleset-table" style="font-size: 12px; width: 100%;"><tbody>';
    if (member.name) html += `<tr><td style="font-weight: bold;">name</td><td>${member.name}</td></tr>`;
    if (member.classification_tag_name) html += `<tr><td style="font-weight: bold;">classification_tag</td><td>${member.classification_tag_name}</td></tr>`;
    html += '</tbody></table>';
    html += '</div>';

    // QuantityMember Properties
    if (member.properties && Object.keys(member.properties).length > 0) {
        html += '<div style="margin-bottom: 20px;">';
        html += '<h5 style="margin: 0 0 10px 0; color: #f57c00; border-bottom: 2px solid #f57c00; padding-bottom: 5px;">🔢 부재 속성 (properties.)</h5>';
        html += '<table class="ruleset-table" style="font-size: 12px; width: 100%;"><tbody>';
        Object.entries(member.properties).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                const displayValue = typeof value === 'number' ? value.toFixed(3) : value;
                html += `<tr><td style="font-weight: bold;">properties.${key}</td><td>${displayValue}</td></tr>`;
            }
        });
        html += '</tbody></table>';
        html += '</div>';
    }

    // MemberMark 속성
    if (member.member_mark_mark || (member.member_mark_properties && Object.keys(member.member_mark_properties).length > 0)) {
        html += '<div style="margin-bottom: 20px;">';
        html += '<h5 style="margin: 0 0 10px 0; color: #7b1fa2; border-bottom: 2px solid #7b1fa2; padding-bottom: 5px;">📋 일람부호 (MM.)</h5>';
        html += '<table class="ruleset-table" style="font-size: 12px; width: 100%;"><tbody>';
        if (member.member_mark_mark) html += `<tr><td style="font-weight: bold;">MM.mark</td><td>${member.member_mark_mark}</td></tr>`;
        if (member.member_mark_properties) {
            Object.entries(member.member_mark_properties).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    html += `<tr><td style="font-weight: bold;">MM.properties.${key}</td><td>${value}</td></tr>`;
                }
            });
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    // RawElement 속성 (주요 속성만)
    if (member.raw_element && Object.keys(member.raw_element).length > 0) {
        html += '<div style="margin-bottom: 20px;">';
        html += '<h5 style="margin: 0 0 10px 0; color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 5px;">🏗️ BIM 원본 (RE.)</h5>';
        html += '<table class="ruleset-table" style="font-size: 12px; width: 100%;"><tbody>';

        // 중요 속성 우선 표시
        const importantProps = ['Category', 'Family', 'Type', 'Level'];
        importantProps.forEach(prop => {
            if (member.raw_element[prop]) {
                html += `<tr><td style="font-weight: bold;">RE.${prop}</td><td>${member.raw_element[prop]}</td></tr>`;
            }
        });

        // Parameters
        if (member.raw_element.Parameters) {
            Object.entries(member.raw_element.Parameters).forEach(([key, value]) => {
                if (!importantProps.includes(key) && value !== null && value !== undefined) {
                    const displayValue = String(value).substring(0, 40);
                    html += `<tr><td style="font-weight: bold;">RE.Parameters.${key}</td><td>${displayValue}${String(value).length > 40 ? '...' : ''}</td></tr>`;
                }
            });
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    html += '</div>';
    panel.innerHTML = html;
}

// 전역 스코프에 노출
window.updateQmRulesetHelperPanel = updateQmRulesetHelperPanel;
