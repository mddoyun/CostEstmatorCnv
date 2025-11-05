

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
    // Note: Property add/delete event listeners are now handled within renderQmSelectedProperties()
    // to avoid duplicate event handlers and have access to member context
    // 할당 버튼들
    document
        .getElementById('qm-assign-cost-code-btn')
        ?.addEventListener('click', assignCostCodeToQm);
    document
        .getElementById('qm-clear-cost-codes-btn')
        ?.addEventListener('click', clearCostCodesFromQm);
    document
        .getElementById('qm-cost-code-lock-checkbox')
        ?.addEventListener('change', toggleCostCodeLock);
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
    // 좌측 패널 탭 (필드선택, 부재 속성, 할당 정보)
    document
        .querySelector('#quantity-members .left-panel-tabs')
        ?.addEventListener('click', handleQmLeftPanelTabClick);
    // BIM 저작도구 연동 버튼
    document
        .getElementById('qm-get-from-client-btn')
        ?.addEventListener('click', getQmSelectionFromClient);
    document
        .getElementById('qm-select-in-client-btn')
        ?.addEventListener('click', selectQmInClient);
    // 3D 뷰포트 연동 버튼
    document
        .getElementById('qm-get-from-3d-viewer-btn')
        ?.addEventListener('click', getQmSelectionFrom3DViewer);
    document
        .getElementById('qm-select-in-3d-viewer-btn')
        ?.addEventListener('click', selectQmIn3DViewer);
    // 테이블 컨트롤 버튼
    document
        .getElementById('apply-qm-grouping-btn')
        ?.addEventListener('click', applyQmGrouping);
    document
        .getElementById('apply-qm-filter-btn')
        ?.addEventListener('click', applyQmFilter);
    document
        .getElementById('clear-qm-filter-btn')
        ?.addEventListener('click', clearQmFilter);
    document
        .getElementById('qm-clear-selection-btn')
        ?.addEventListener('click', clearQmSelection);
    document
        .getElementById('qm-clear-selection-filter-btn')
        ?.addEventListener('click', clearQmSelectionFilter);
    document
        .getElementById('qm-clear-selection-filter-btn-footer')
        ?.addEventListener('click', clearQmSelectionFilter);
    // 속성 룰셋 일괄적용 버튼
    document
        .getElementById('qm-apply-property-rules-btn')
        ?.addEventListener('click', applyPropertyRulesToAllQm);
    // ▼▼▼ [추가] 수동 수량 산출식 업데이트 버튼 (2025-11-05) ▼▼▼
    document
        .getElementById('qm-update-formulas-btn')
        ?.addEventListener('click', updateAllQmFormulas);
    // ▲▲▲ [추가] 여기까지 ▲▲▲
    // 필드 선택 버튼들
    document
        .getElementById('qm-select-all-fields-btn')
        ?.addEventListener('click', selectAllQmFields);
    document
        .getElementById('qm-deselect-all-fields-btn')
        ?.addEventListener('click', deselectAllQmFields);
    const qmRenderTableBtn = document.getElementById('qm-render-table-btn');
    console.log('[DEBUG] qm-render-table-btn element:', qmRenderTableBtn);
    if (qmRenderTableBtn) {
        qmRenderTableBtn.addEventListener('click', () => {
            console.log('[DEBUG] qm-render-table-btn clicked! Applying field selection to table...');
            updateQmColumnsFromCheckboxes(true); // 선택된 필드로 테이블 렌더링
        });
        console.log('[DEBUG] qm-render-table-btn click listener attached');
    } else {
        console.error('[ERROR] qm-render-table-btn element not found!');
    }
    // 필드 체크박스 변경 이벤트 (동적으로 생성되므로 이벤트 위임 사용)
    document
        .getElementById('qm-field-checkboxes-container')
        ?.addEventListener('change', handleQmFieldCheckboxChange);

    // 스플릿바 초기화
    initQmSplitBar();

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

        // 디버깅: 첫 번째 수량산출부재의 데이터 구조 확인
        if (loadedQuantityMembers.length > 0) {
            const firstMember = loadedQuantityMembers[0];
            console.log('[DEBUG] First QuantityMember structure:', {
                id: firstMember.id,
                name: firstMember.name,
                raw_element_id: firstMember.raw_element_id,
                split_element_id: firstMember.split_element_id,
                has_raw_element_object: !!firstMember.raw_element,
                raw_element_keys: firstMember.raw_element ? Object.keys(firstMember.raw_element) : null
            });
        }

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
    console.log('[DEBUG] createAutoQuantityMembers called. currentProjectId:', currentProjectId);

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
        console.log('[DEBUG] User cancelled auto-create confirmation');
        return;
    }

    console.log('[DEBUG] Sending auto-create request to:', `/connections/api/quantity-members/auto-create/${currentProjectId}/`);
    showToast('수량산출부재를 자동으로 생성하고 있습니다...', 'info', 5000);

    try {
        const response = await fetch(
            `/connections/api/quantity-members/auto-create/${currentProjectId}/`,
            {
                method: 'POST',
                headers: { 'X-CSRFToken': csrftoken },
            }
        );
        console.log('[DEBUG] Auto-create response status:', response.status);
        const result = await response.json();
        console.log('[DEBUG] Auto-create result:', result);

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
    const newLevelDiv = document.createElement('div');
    newLevelDiv.className = 'group-level';

    const select = document.createElement('select');
    select.className = 'group-by-select';
    select.innerHTML = '<option value="">-- 필드 선택 --</option>';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-group-level-btn';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', function() {
        newLevelDiv.remove();
        renderActiveQmView();
    });

    newLevelDiv.appendChild(select);
    newLevelDiv.appendChild(removeBtn);
    container.appendChild(newLevelDiv);

    populateQmGroupingDropdowns(); // QM 그룹핑 드롭다운 채우기
}

function populateQmGroupingDropdowns() {
    // QM 기본 필드들
    const qmFields = [
        'QM.id',
        'QM.name',
        'QM.classification_tag',
        'QM.raw_element_id',
        'QM.is_active',
        'QM.member_mark'
    ];

    // 공사코드 필드
    if (loadedCostCodes && loadedCostCodes.length > 0) {
        qmFields.push('QM.cost_codes');
    }

    // BIM 원본 속성 수집
    const bimFields = collectBimFieldsFromQuantityMembers();
    const bimFieldNames = bimFields.map(f => f.label);

    // 일람부호 속성 수집
    const mmFields = collectMemberMarkFieldsFromQuantityMembers();
    const mmFieldNames = mmFields.map(f => f.label);

    // 공간분류 속성 수집
    const spaceFields = collectSpaceFieldsFromQuantityMembers();
    const spaceFieldNames = spaceFields.map(f => f.label);

    // QM.properties 속성 수집
    const qmPropertiesFields = collectQmPropertiesFields();
    const qmPropertiesFieldNames = qmPropertiesFields.map(f => f.label);

    // 모든 필드를 하나의 배열로 합치기
    const allFields = [
        ...qmFields,
        ...qmPropertiesFieldNames,
        ...mmFieldNames,
        ...spaceFieldNames,
        ...bimFieldNames
    ].sort();

    // 모든 QM 그룹핑 드롭다운 업데이트
    const allGroupBySelects = document.querySelectorAll('#quantity-members .group-by-select');
    const optionsHtml = '<option value="">-- 필드 선택 --</option>' +
        allFields.map(field => `<option value="${field}">${field}</option>`).join('');

    allGroupBySelects.forEach(select => {
        const selectedValue = select.value;
        select.innerHTML = optionsHtml;
        select.value = selectedValue;
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
        // Shift+클릭: 범위 선택
        const start = Math.min(lastSelectedQmRowIndex, clickedRowIndex);
        const end = Math.max(lastSelectedQmRowIndex, clickedRowIndex);
        if (!event.ctrlKey) selectedQmIds.clear();
        for (let i = start; i <= end; i++) {
            const rowId = allVisibleRows[i].dataset.id;
            if (rowId) selectedQmIds.add(rowId);
        }
    } else {
        // 단순 클릭: 토글 (Activity Objects 방식)
        if (selectedQmIds.has(memberId)) {
            selectedQmIds.delete(memberId);
        } else {
            selectedQmIds.add(memberId);
        }
    }
    lastSelectedQmRowIndex = clickedRowIndex;

    // 선택된 행 시각적 표시 업데이트
    allVisibleRows.forEach((row) => {
        if (selectedQmIds.has(row.dataset.id)) {
            row.classList.add('selected-row');
        } else {
            row.classList.remove('selected-row');
        }
    });
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
        renderQmSelectedProperties(); // 선택된 부재의 속성 표시 (QM., MM., BIM. 접두어 포함)
        renderQmCostCodesList();
        renderQmMemberMarkDetails();
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
            '#qm-selected-properties-container .property-edit-row'
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

// DEPRECATED: This function is no longer used
// Property add/delete actions are now handled within renderQmSelectedProperties()
// to have direct access to the member object and avoid duplicate event handlers
function handleQmPropertiesActions(event) {
    // This function is kept for backward compatibility but should not be called
    console.warn('[handleQmPropertiesActions] DEPRECATED: This function should not be called');
}

function renderQmCostCodesList() {
    const container = document.getElementById('qm-assigned-cost-codes-container');

    if (!container) {
        console.warn('[renderQmCostCodesList] qm-assigned-cost-codes-container element not found');
        return;
    }
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

    // 단일 부재 선택 시에만 잠금 아이콘 및 삭제 버튼 표시
    if (selectedMembers.length === 1) {
        const member = selectedMembers[0];
        const lockedCodeIds = new Set(member.locked_cost_code_ids || []);

        if (!member.cost_code_ids || member.cost_code_ids.length === 0) {
            container.innerHTML = '할당된 공사코드가 없습니다.';
            return;
        }

        const listItems = member.cost_code_ids.map((codeId) => {
            const costCode = loadedCostCodes.find((c) => c.id === codeId);
            if (!costCode) return '<li>알 수 없는 코드: ' + codeId + '</li>';

            const isLocked = lockedCodeIds.has(codeId);
            const lockIconHtml = isLocked
                ? '<span class="lock-icon" style="cursor: pointer; margin-right: 8px; font-size: 18px;" title="잠금 해제 (클릭)">🔒</span>'
                : '<span class="lock-icon" style="cursor: pointer; margin-right: 8px; font-size: 18px;" title="잠금 (클릭)">🔓</span>';

            const deleteButtonHtml = isLocked
                ? '<span style="color: #ccc; font-size: 16px; margin-left: 8px; cursor: not-allowed;" title="잠긴 코드는 삭제할 수 없습니다">❌</span>'
                : '<span class="delete-cost-code-btn" data-member-id="' + member.id + '" data-code-id="' + codeId + '" style="color: #dc3545; font-size: 16px; margin-left: 8px; cursor: pointer;" title="이 코드 제거 (클릭)">❌</span>';

            const li = document.createElement('li');
            li.style.marginBottom = '8px';
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.justifyContent = 'space-between';
            li.style.padding = '4px 0';

            const leftDiv = document.createElement('div');
            leftDiv.style.display = 'flex';
            leftDiv.style.alignItems = 'center';
            leftDiv.style.flex = '1';

            const lockSpan = document.createElement('span');
            lockSpan.style.cursor = 'pointer';
            lockSpan.style.marginRight = '8px';
            lockSpan.style.fontSize = '18px';
            lockSpan.textContent = isLocked ? '🔒' : '🔓';
            lockSpan.title = isLocked ? '잠금 해제 (클릭)' : '잠금 (클릭)';
            lockSpan.onclick = () => toggleIndividualCostCodeLock(member.id, codeId);

            const textSpan = document.createElement('span');
            textSpan.textContent = costCode.code + ' - ' + costCode.name;
            textSpan.style.flex = '1';

            leftDiv.appendChild(lockSpan);
            leftDiv.appendChild(textSpan);

            const deleteSpan = document.createElement('span');
            deleteSpan.style.fontSize = '16px';
            deleteSpan.style.marginLeft = '8px';
            deleteSpan.textContent = '❌';

            if (isLocked) {
                deleteSpan.style.color = '#ccc';
                deleteSpan.style.cursor = 'not-allowed';
                deleteSpan.title = '잠긴 코드는 삭제할 수 없습니다';
            } else {
                deleteSpan.style.color = '#dc3545';
                deleteSpan.style.cursor = 'pointer';
                deleteSpan.title = '이 코드 제거 (클릭)';
                deleteSpan.onclick = () => removeIndividualCostCode(member.id, codeId);
            }

            li.appendChild(leftDiv);
            li.appendChild(deleteSpan);

            return li;
        });

        const ul = document.createElement('ul');
        ul.style.listStyle = 'none';
        ul.style.padding = '0';
        listItems.forEach(li => ul.appendChild(li));

        const helpText = document.createElement('small');
        helpText.style.color = '#666';
        helpText.style.fontSize = '11px';
        helpText.style.display = 'block';
        helpText.style.marginTop = '8px';
        helpText.innerHTML = '🔒: 잠김 (룰셋 적용 시 유지) | 🔓: 잠기지 않음 | ❌: 코드 제거<br>잠긴 코드는 삭제할 수 없습니다.';

        container.innerHTML = '';
        container.appendChild(ul);
        container.appendChild(helpText);
        return;
    }

    // 다중 부재 선택 시 공통 코드만 표시 (잠금 아이콘 없음)
    const firstMemberCodes = new Set(selectedMembers[0].cost_code_ids);
    const commonCodeIds = [...firstMemberCodes].filter((codeId) =>
        selectedMembers.every((member) => member.cost_code_ids.includes(codeId))
    );

    if (commonCodeIds.length === 0) {
        container.innerHTML =
            '선택된 부재들에 공통으로 할당된 공사코드가 없습니다.' +
            '<br><small>(개별 부재에는 할당되어 있을 수 있습니다. 잠금 관리를 위해 부재를 하나만 선택하세요.)</small>';
        return;
    }

    container.innerHTML = '<ul>' +
        commonCodeIds
            .map((codeId) => {
                const costCode = loadedCostCodes.find((c) => c.id === codeId);
                return costCode
                    ? `<li>${costCode.code} - ${costCode.name}</li>`
                    : `<li>알 수 없는 코드: ${codeId}</li>`;
            })
            .join('') +
        '</ul>' +
        '<small style="color: #666; font-size: 11px;">공통 코드 표시 중 (잠금 관리를 위해 부재를 하나만 선택하세요)</small>';
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
            `/connections/api/quantity-members/manage-cost-codes/${currentProjectId}/`, {
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

        // 데이터 새로고침
        await loadQuantityMembers();
        renderQmCostCodesList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 개별 공사코드 잠금/해제
async function toggleIndividualCostCodeLock(memberId, costCodeId) {
    try {
        const response = await fetch(
            `/connections/api/quantity-members/toggle-cost-code-lock/${currentProjectId}/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    member_id: memberId,
                    cost_code_id: costCodeId,
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');

        // 해당 부재의 데이터 업데이트
        const member = loadedQuantityMembers.find(m => m.id === memberId);
        if (member) {
            if (result.is_locked) {
                // 잠금 추가
                if (!member.locked_cost_code_ids) {
                    member.locked_cost_code_ids = [];
                }
                if (!member.locked_cost_code_ids.includes(costCodeId)) {
                    member.locked_cost_code_ids.push(costCodeId);
                }
            } else {
                // 잠금 해제
                if (member.locked_cost_code_ids) {
                    member.locked_cost_code_ids = member.locked_cost_code_ids.filter(id => id !== costCodeId);
                }
            }
        }

        // UI 새로고침
        renderQmCostCodesList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 전역 함수로 등록 (HTML onclick에서 호출 가능하도록)
window.toggleIndividualCostCodeLock = toggleIndividualCostCodeLock;

// 개별 공사코드 제거
async function removeIndividualCostCode(memberId, costCodeId) {
    const member = loadedQuantityMembers.find(m => m.id === memberId);
    const costCode = loadedCostCodes.find(c => c.id === costCodeId);

    if (!member || !costCode) {
        showToast('부재 또는 공사코드를 찾을 수 없습니다.', 'error');
        return;
    }

    // 잠금 상태 확인
    const lockedCodeIds = new Set(member.locked_cost_code_ids || []);
    if (lockedCodeIds.has(costCodeId)) {
        showToast('잠긴 공사코드는 제거할 수 없습니다. 먼저 잠금을 해제하세요.', 'warning');
        return;
    }

    if (!confirm(`공사코드 "${costCode.code} - ${costCode.name}"을(를) 제거하시겠습니까?`)) {
        return;
    }

    try {
        const response = await fetch(
            `/connections/api/quantity-members/manage-cost-codes/${currentProjectId}/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    member_ids: [memberId],
                    cost_code_id: costCodeId,
                    action: 'remove',
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');

        // 로컬 데이터 업데이트
        if (member.cost_code_ids) {
            member.cost_code_ids = member.cost_code_ids.filter(id => id !== costCodeId);
        }

        // UI 새로고침
        renderQmCostCodesList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 전역 함수로 등록
window.removeIndividualCostCode = removeIndividualCostCode;

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
    const container = document.getElementById('qm-assigned-spaces-container');
    if (!container) {
        console.warn('[renderQmSpacesList] qm-assigned-spaces-container element not found');
        return;
    }
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

// =====================================================================
// BIM 저작도구 연동 및 3D 뷰포트 연동 함수들
// =====================================================================

// BIM 저작도구에서 선택한 객체 가져오기
function getQmSelectionFromClient() {
    const targetGroup = currentMode === 'revit' ? 'revit_broadcast_group' : 'blender_broadcast_group';
    frontendSocket.send(JSON.stringify({
        type: 'command_to_client',
        payload: {
            command: 'get_selection',
            target_group: targetGroup,
        },
    }));
    showToast(`${currentMode === 'revit' ? 'Revit' : 'Blender'}에 선택 정보 가져오기를 요청했습니다.`, 'info');
}

// 테이블에서 선택한 객체를 BIM 저작도구에서 선택
function selectQmInClient() {
    if (selectedQmIds.size === 0) {
        showToast(`테이블에서 ${currentMode === 'revit' ? 'Revit' : 'Blender'}으로 보낼 항목을 먼저 선택하세요.`, 'error');
        return;
    }

    // 선택된 수량산출부재들의 raw_element_id를 수집
    const uniqueIdsToSend = [];
    window.loadedQuantityMembers
        .filter(qm => selectedQmIds.has(qm.id))
        .forEach(qm => {
            // raw_element_id 또는 split_element_id 확인
            const elementId = qm.split_element_id || qm.raw_element_id;
            if (elementId) {
                const rawElement = allRevitData.find(item => item.id === elementId);
                if (rawElement && rawElement.element_unique_id) {
                    uniqueIdsToSend.push(rawElement.element_unique_id);
                }
            }
        });

    if (uniqueIdsToSend.length === 0) {
        showToast('선택한 수량산출부재에 연결된 원본 요소가 없습니다.', 'warning');
        return;
    }

    const targetGroup = currentMode === 'revit' ? 'revit_broadcast_group' : 'blender_broadcast_group';
    frontendSocket.send(JSON.stringify({
        type: 'command_to_client',
        payload: {
            command: 'select_elements',
            unique_ids: uniqueIdsToSend,
            target_group: targetGroup,
        },
    }));
    showToast(`${currentMode === 'revit' ? 'Revit' : 'Blender'}에서 ${uniqueIdsToSend.length}개 요소를 선택하도록 요청했습니다.`, 'success');
}

// 3D 뷰포트에서 선택한 객체를 테이블에서 선택
function getQmSelectionFrom3DViewer() {
    console.log('[DEBUG][QM] Getting selection from 3D viewer');

    if (typeof window.getSelectedObjectsFrom3DViewer !== 'function') {
        showToast('3D 뷰어 기능을 사용할 수 없습니다.', 'error');
        return;
    }

    const selected3DObjects = window.getSelectedObjectsFrom3DViewer();
    if (!selected3DObjects || selected3DObjects.length === 0) {
        showToast('3D 뷰포트에서 선택된 객체가 없습니다.', 'warning');
        return;
    }

    console.log(`[DEBUG][QM] Found ${selected3DObjects.length} selected objects in 3D viewer`);

    // 3D에서 선택된 객체의 BIM ID 수집
    const selectedBimIds = new Set();
    selected3DObjects.forEach(obj => {
        const bimObjectId = obj.userData.bimObjectId || obj.userData.rawElementId;
        if (bimObjectId) {
            selectedBimIds.add(bimObjectId);
        }
    });

    // 기존 선택 및 필터 초기화
    selectedQmIds.clear();
    window.qmFilteredIds.clear();

    // 해당 BIM ID를 포함하는 수량산출부재 찾기
    window.loadedQuantityMembers.forEach(qm => {
        // raw_element_id 또는 split_element_id 확인
        const elementId = qm.split_element_id || qm.raw_element_id;
        if (elementId && selectedBimIds.has(elementId)) {
            selectedQmIds.add(qm.id);
            window.qmFilteredIds.add(qm.id); // 필터링용 ID도 저장
        }
    });

    console.log(`[DEBUG][QM] Selected ${selectedQmIds.size} quantity members from 3D viewer`);

    // 필터 활성화 및 버튼 표시 (사이드바 버튼과 테이블 하단 버튼 모두)
    window.isQmFilterToSelectionActive = true;
    const clearBtnSidebar = document.getElementById('qm-clear-selection-filter-btn');
    const clearBtnFooter = document.getElementById('qm-clear-selection-filter-btn-footer');

    if (clearBtnSidebar) {
        clearBtnSidebar.style.display = 'inline-block';
    }
    if (clearBtnFooter) {
        clearBtnFooter.style.display = 'inline-block';
        console.log('[DEBUG][QM] Footer clear filter button displayed');
    }

    // 테이블 다시 렌더링 (필터링 적용됨)
    renderActiveQmView();

    showToast(`3D 뷰포트에서 ${selectedQmIds.size}개 수량산출부재를 선택했습니다.`, 'success');
}

// 선택된 항목만 필터링하여 테이블에 표시
function filterQmTableBySelection() {
    const tableContainer = document.getElementById('qm-table-container');
    if (!tableContainer) return;

    const allRows = tableContainer.querySelectorAll('tr[data-id]');
    allRows.forEach(row => {
        const rowId = row.dataset.id;
        if (selectedQmIds.has(rowId)) {
            row.style.display = ''; // 선택된 행은 표시
        } else {
            row.style.display = 'none'; // 선택되지 않은 행은 숨김
        }
    });
}

// 테이블에서 선택한 수량산출부재를 3D 뷰포트에서 선택
function selectQmIn3DViewer() {
    console.log('[DEBUG][QM] Selecting objects in 3D viewer');
    console.log('[DEBUG][QM] selectedQmIds:', Array.from(selectedQmIds));

    if (selectedQmIds.size === 0) {
        showToast('테이블에서 먼저 항목을 선택하세요.', 'warning');
        return;
    }

    if (typeof window.selectObjectsIn3DViewer !== 'function') {
        showToast('3D 뷰어 기능을 사용할 수 없습니다.', 'error');
        return;
    }

    console.log('[DEBUG][QM] loadedQuantityMembers count:', window.loadedQuantityMembers?.length);

    // 선택된 수량산출부재들의 raw_element_id 또는 split_element_id를 수집
    const bimIdsToSelect = [];
    const selectedQMs = window.loadedQuantityMembers.filter(qm => selectedQmIds.has(qm.id));
    console.log('[DEBUG][QM] Found matching QMs:', selectedQMs.length);

    selectedQMs.forEach(qm => {
        const elementId = qm.split_element_id || qm.raw_element_id;
        console.log('[DEBUG][QM] QM:', qm.id, 'raw_element_id:', qm.raw_element_id, 'split_element_id:', qm.split_element_id, 'using:', elementId);
        if (elementId) {
            bimIdsToSelect.push(elementId);
        }
    });

    console.log('[DEBUG][QM] BIM IDs to select:', bimIdsToSelect);

    if (bimIdsToSelect.length === 0) {
        showToast('선택한 수량산출부재에 연결된 원본 요소가 없습니다.', 'warning');
        return;
    }

    console.log(`[DEBUG][QM] Calling window.selectObjectsIn3DViewer with ${bimIdsToSelect.length} IDs`);
    window.selectObjectsIn3DViewer(bimIdsToSelect);

    showToast(`3D 뷰포트에서 ${bimIdsToSelect.length}개 객체를 선택했습니다.`, 'success');
}

// =====================================================================
// 테이블 컨트롤 함수들 (그룹핑, 필터, 선택)
// =====================================================================

// 그룹핑 적용
function applyQmGrouping() {
    console.log('[DEBUG][QM] Applying grouping');
    renderActiveQmView();
}

// 필터 적용
function applyQmFilter() {
    console.log('[DEBUG][QM] Applying filter');
    renderActiveQmView();
}

// 필터 초기화
function clearQmFilter() {
    console.log('[DEBUG][QM] Clearing filter');
    qmColumnFilters = {};
    renderActiveQmView();
    showToast('필터가 초기화되었습니다.', 'success');
}

// 선택 해제
function clearQmSelection() {
    console.log('[DEBUG][QM] Clearing selection');
    selectedQmIds.clear();
    renderActiveQmView();
    showToast('선택이 해제되었습니다.', 'success');
}

// 선택 필터 해제
function clearQmSelectionFilter() {
    console.log('[DEBUG][QM] Clearing selection filter');

    // 필터 비활성화
    window.isQmFilterToSelectionActive = false;
    window.qmFilteredIds.clear();

    // 버튼 숨기기 (사이드바 버튼과 테이블 하단 버튼 모두)
    const clearBtnSidebar = document.getElementById('qm-clear-selection-filter-btn');
    const clearBtnFooter = document.getElementById('qm-clear-selection-filter-btn-footer');

    if (clearBtnSidebar) {
        clearBtnSidebar.style.display = 'none';
    }
    if (clearBtnFooter) {
        clearBtnFooter.style.display = 'none';
    }

    // 테이블 다시 렌더링 (필터 없이)
    renderActiveQmView();

    showToast('선택 필터가 해제되었습니다.', 'success');
}

// =====================================================================
// 필드 선택 및 부재 속성 표시 기능
// =====================================================================

/**
 * 좌측 패널 탭 클릭 핸들러
 */
function handleQmLeftPanelTabClick(e) {
    const tabButton = e.target.closest('.left-panel-tab-button');
    if (!tabButton) return;

    const tabName = tabButton.getAttribute('data-tab');

    // 모든 탭 버튼과 콘텐츠 비활성화
    document.querySelectorAll('#quantity-members .left-panel-tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('#quantity-members .left-panel-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // 클릭한 탭 활성화
    tabButton.classList.add('active');

    if (tabName === 'field-selection') {
        document.getElementById('qm-field-selection-content').classList.add('active');
        populateQmFieldSelection();
    } else if (tabName === 'qm-properties') {
        document.getElementById('qm-properties-content').classList.add('active');
        renderQmSelectedProperties();
    } else if (tabName === 'assigned-info') {
        document.getElementById('qm-assigned-info-content').classList.add('active');
        renderQmAssignedInfo();
    }
}

/**
 * 수량산출부재의 모든 속성 수집 (BIM + QM + MM + SC)
 * generateQMPropertyOptions()를 사용하여 완전한 속성 상속 체계를 구현합니다.
 */
function collectBimFieldsFromQuantityMembers() {
    // ▼▼▼ [수정] generateQMPropertyOptions()를 사용하여 모든 속성 수집 (2025-11-05) ▼▼▼
    const propertyOptionGroups = generateQMPropertyOptions();
    const allFields = [];

    propertyOptionGroups.forEach(group => {
        group.options.forEach(opt => {
            allFields.push({
                // ▼▼▼ [수정] 점(.)을 언더스코어(_)로 변환하지 않음 - 원본 유지 (2025-11-05) ▼▼▼
                key: opt.value,  // .replace(/\./g, '_') 제거
                // ▲▲▲ [수정] 여기까지 ▲▲▲
                label: opt.label,
                section: extractSection(opt.label),
                fieldName: extractFieldName(opt.label),
                fieldType: extractFieldType(opt.label)
            });
        });
    });

    return allFields;
    // ▲▲▲ [수정] 여기까지 ▲▲▲
}

/**
 * 필드명에서 섹션 추출 (예: BIM.Parameters.길이 -> BIM.Parameters)
 * 모든 접두어 (BIM, QM, MM, SC, CI, CC, AO, AC)를 처리합니다.
 */
function extractSection(label) {
    if (!label || !label.includes('.')) return '';
    const parts = label.split('.');
    if (parts.length >= 2) {
        return `${parts[0]}.${parts[1]}`;
    }
    return label;
}

/**
 * 필드명에서 실제 필드명 추출 (예: BIM.Parameters.길이 -> 길이, QM.System.id -> id)
 * 모든 접두어를 처리하여 내부 필드명을 반환합니다.
 */
function extractFieldName(label) {
    if (!label) return label;

    // QM.* 처리
    if (label.startsWith('QM.System.')) return label.substring(10);
    if (label.startsWith('QM.Properties.')) return label.substring(14);

    // MM.* 처리
    if (label.startsWith('MM.System.')) return label.substring(10);
    if (label.startsWith('MM.Properties.')) return label.substring(14);

    // SC.* 처리
    if (label.startsWith('SC.System.')) return label.substring(10);

    // CI.* 처리
    if (label.startsWith('CI.System.')) return label.substring(10);

    // CC.* 처리
    if (label.startsWith('CC.System.')) return label.substring(10);

    // AO.* 처리
    if (label.startsWith('AO.System.')) return label.substring(10);

    // AC.* 처리
    if (label.startsWith('AC.System.')) return label.substring(10);

    // BIM.* 처리
    if (!label.startsWith('BIM.')) return label;

    // BIM.System.id -> id
    if (label.startsWith('BIM.System.')) {
        return label.substring(11);
    }
    // BIM.Parameters.길이 -> 길이
    if (label.startsWith('BIM.Parameters.')) {
        return label.substring(15);
    }
    // BIM.TypeParameters.체적 -> 체적
    if (label.startsWith('BIM.TypeParameters.')) {
        return label.substring(19);
    }
    // BIM.Attributes.Name -> Name
    if (label.startsWith('BIM.Attributes.')) {
        return label.substring(15);
    }
    // BIM.QuantitySet.XXX -> QuantitySet.XXX
    return label.substring(4);
}

/**
 * 필드명에서 타입 추출 (모든 객체 타입 지원)
 */
function extractFieldType(label) {
    if (label.startsWith('BIM.System.')) return 'bim_system';
    if (label.startsWith('BIM.Parameters.')) return 'bim_parameter';
    if (label.startsWith('BIM.TypeParameters.')) return 'bim_typeparameter';
    if (label.startsWith('BIM.Attributes.')) return 'bim_attribute';
    if (label.startsWith('BIM.')) return 'bim_attribute'; // 기본 BIM

    if (label.startsWith('QM.System.')) return 'qm_system';
    if (label.startsWith('QM.Properties.')) return 'qm_properties';

    if (label.startsWith('MM.System.')) return 'mm_system';
    if (label.startsWith('MM.Properties.')) return 'mm_properties';

    if (label.startsWith('SC.System.')) return 'sc_system';

    if (label.startsWith('CI.System.')) return 'ci_system';

    if (label.startsWith('CC.System.')) return 'cc_system';

    if (label.startsWith('AO.System.')) return 'ao_system';

    if (label.startsWith('AC.System.')) return 'ac_system';

    return 'unknown';
}

/**
 * [Deprecated] 수량산출부재의 일람부호 속성 필드 수집
 * @deprecated Use collectBimFieldsFromQuantityMembers() and filter by MM.* instead
 * @returns {Array} MM 필드 배열
 */
function collectMemberMarkFieldsFromQuantityMembers() {
    const allFields = collectBimFieldsFromQuantityMembers();
    return allFields.filter(f => f.label.startsWith('MM.'));
}

/**
 * [Deprecated] 수량산출부재의 공간분류 필드 수집
 * @deprecated Use collectBimFieldsFromQuantityMembers() and filter by SC.* instead
 * @returns {Array} Space 필드 배열
 */
function collectSpaceFieldsFromQuantityMembers() {
    const allFields = collectBimFieldsFromQuantityMembers();
    return allFields.filter(f => f.label.startsWith('SC.'));
}

/**
 * [Deprecated] 수량산출부재의 QM.properties.* 필드 수집
 * @deprecated Use collectBimFieldsFromQuantityMembers() and filter by QM.Properties.* instead
 * @returns {Array} QM.properties 필드 배열
 */
function collectQmPropertiesFields() {
    const allFields = collectBimFieldsFromQuantityMembers();
    return allFields.filter(f => f.label.startsWith('QM.Properties.'));
}

/**
 * 조건 빌더를 위한 모든 QM 필드 수집 (전역 함수)
 * @returns {Object} 섹션별로 그룹화된 필드 객체
 */
window.getAllQmFieldsForConditionBuilder = function() {
    // ▼▼▼ [수정] 필드 선택 UI와 동일한 필드 목록 사용 (2025-11-05) ▼▼▼
    // collectBimFieldsFromQuantityMembers()를 사용하여 모든 필드를 동적으로 수집
    const allFields = collectBimFieldsFromQuantityMembers();

    // 섹션별로 그룹화
    const sectionMap = groupFieldsByPrefix(allFields);
    const sectionDefs = getSectionDefinitions();

    // 각 섹션의 필드를 {value, label} 형식으로 변환하여 그룹화
    const groups = [];
    sectionDefs.forEach(section => {
        const fields = sectionMap[section.key];
        if (fields && fields.length > 0) {
            groups.push({
                group: section.title,
                options: fields.map(f => ({
                    value: f.label,  // label을 value로 사용 (예: "QM.System.id")
                    label: f.label
                }))
            });
        }
    });

    return groups;
    // ▲▲▲ [수정] 여기까지 ▲▲▲
};

/**
 * 수량산출부재의 필드 선택 체크박스 생성
 */
function populateQmFieldSelection() {
    const container = document.getElementById('qm-field-checkboxes-container');
    if (!container) return;

    // ▼▼▼ [수정] 첫 번째 접두어 기준으로 그룹화 (2025-11-05) ▼▼▼
    const allFields = collectBimFieldsFromQuantityMembers();
    const sectionMap = groupFieldsByPrefix(allFields);  // ui.js의 공통 함수 사용
    const sectionDefs = getSectionDefinitions();  // ui.js의 공통 정의 사용

    let html = '';

    // 정의된 순서대로 섹션 렌더링
    sectionDefs.forEach(section => {
        const fields = sectionMap[section.key];
        if (fields && fields.length > 0) {
            html += `<div class="field-section"><h4 style="color: ${section.color}; margin: 10px 0 5px 0; font-size: 14px;">${section.title}</h4>`;
            fields.forEach(field => {
                const isChecked = currentQmColumns.includes(field.key) ? 'checked' : '';
                html += `
                    <label class="field-checkbox-label">
                        <input
                            type="checkbox"
                            class="qm-field-checkbox"
                            value="${field.key}"
                            data-field-type="${field.fieldType || ''}"
                            data-field-name="${field.fieldName || ''}"
                            ${isChecked}
                        >
                        ${field.label}
                    </label>
                `;
            });
            html += '</div>';
        }
    });

    // 정의되지 않은 섹션도 렌더링 (동적으로 추가된 섹션)
    Object.keys(sectionMap).forEach(prefix => {
        const isDefined = sectionDefs.some(s => s.key === prefix);
        if (!isDefined) {
            const fields = sectionMap[prefix];
            if (fields && fields.length > 0) {
                html += `<div class="field-section"><h4 style="color: #666; margin: 10px 0 5px 0; font-size: 14px;">📦 ${prefix} 속성</h4>`;
                fields.forEach(field => {
                    const isChecked = currentQmColumns.includes(field.key) ? 'checked' : '';
                    html += `
                        <label class="field-checkbox-label">
                            <input
                                type="checkbox"
                                class="qm-field-checkbox"
                                value="${field.key}"
                                data-field-type="${field.fieldType || ''}"
                                data-field-name="${field.fieldName || ''}"
                                ${isChecked}
                            >
                            ${field.label}
                        </label>
                    `;
                });
                html += '</div>';
            }
        }
    });
    // ▲▲▲ [수정] 첫 번째 접두어 기준으로 간단하게 그룹화 ▲▲▲

    container.innerHTML = html;

    // 이벤트 리스너 추가
    container.querySelectorAll('.qm-field-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleQmFieldCheckboxChange);
    });

    // 전체 선택/해제 버튼
    const selectAllBtn = document.getElementById('qm-select-all-fields-btn');
    const deselectAllBtn = document.getElementById('qm-deselect-all-fields-btn');

    if (selectAllBtn) {
        selectAllBtn.onclick = () => {
            container.querySelectorAll('.qm-field-checkbox').forEach(cb => cb.checked = true);
            updateQmColumnsFromCheckboxes();
        };
    }

    if (deselectAllBtn) {
        deselectAllBtn.onclick = () => {
            container.querySelectorAll('.qm-field-checkbox').forEach(cb => cb.checked = false);
            updateQmColumnsFromCheckboxes();
        };
    }
}

/**
 * 체크박스 상태에서 currentQmColumns 업데이트
 * @param {boolean} shouldRender - 테이블을 다시 렌더링할지 여부 (기본값: true)
 */
function updateQmColumnsFromCheckboxes(shouldRender = true) {
    const checkedBoxes = document.querySelectorAll('.qm-field-checkbox:checked');
    currentQmColumns = Array.from(checkedBoxes).map(cb => cb.value);
    console.log('[DEBUG] Updated currentQmColumns:', currentQmColumns);
    if (shouldRender) {
        console.log('[DEBUG] Rendering table with updated columns');
        renderActiveQmView();
    }
}

/**
 * 선택된 수량산출부재의 속성을 테이블로 표시 (룰셋에서 사용하는 형식과 동일하게)
 */
function renderQmSelectedProperties() {
    const container = document.getElementById('qm-selected-properties-container');
    if (!container) {
        console.warn('[renderQmSelectedProperties] Container not found');
        return;
    }

    if (selectedQmIds.size !== 1) {
        container.innerHTML = '<p>부재를 하나만 선택하세요.</p>';
        return;
    }

    const selectedId = selectedQmIds.values().next().value;
    const member = loadedQuantityMembers.find(m => m.id.toString() === selectedId);

    if (!member) {
        container.innerHTML = '<p>선택된 부재 정보를 찾을 수 없습니다.</p>';
        return;
    }

    // ▼▼▼ [수정] fullBimObject를 여기서 미리 가져오기 (2025-11-05) ▼▼▼
    // BIM 원본 요소 (allRevitData에서 실제 RawElement 객체 찾기)
    const elementId = member.split_element_id || member.raw_element_id;
    const fullBimObject = elementId && allRevitData ?
        allRevitData.find(item => item.id === elementId) : null;

    console.log('[DEBUG] renderQmSelectedProperties - elementId:', elementId, 'fullBimObject found:', !!fullBimObject);
    console.log('[DEBUG] allRevitData available:', !!allRevitData, 'count:', allRevitData ? allRevitData.length : 0);
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    let html = '';

    // ▼▼▼ [수정] 부재 속성 섹션을 기본 속성보다 위로 이동 (2025-11-05) ▼▼▼
    // 부재 속성 (QM.properties.XXX) - 편집 가능
    html += '<div class="property-section">';
    html += '<h4 style="color: #f57c00; border-bottom: 2px solid #f57c00; padding-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">';
    html += '<span>🔢 부재 속성</span>';
    html += '</h4>';

    // ▼▼▼ [수정] 새 속성 추가 폼을 맨 위로 이동 (2025-11-05) ▼▼▼
    html += '<div class="add-property-form" style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px;">';
    html += '<h5 style="margin: 0 0 10px 0;">새 속성 추가</h5>';
    html += '<div style="display: flex; flex-direction: column; gap: 8px;">';
    html += '<input type="text" id="new-property-key" placeholder="필드명 (예: 면적)" style="padding: 6px; border: 1px solid #ccc; border-radius: 3px;">';

    // 속성 선택 도우미 - 콤보박스와 적용 버튼을 세로로 배치
    html += '<div style="display: flex; flex-direction: column; gap: 4px;">';
    html += '<select id="property-helper-select" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">';
    html += '<option value="">-- 속성 선택 (산출식 작성 도움) --</option>';

    // BIM 속성 그룹
    if (fullBimObject && fullBimObject.raw_data) {
        const rd = fullBimObject.raw_data;

        // System 속성
        html += '<optgroup label="BIM 시스템 속성">';
        ['Category', 'Family', 'Type', 'Level', 'Id'].forEach(key => {
            if (rd[key] !== undefined) {
                html += `<option value="{BIM.System.${key}}">{BIM.System.${key}}</option>`;
            }
        });
        html += '</optgroup>';

        // Attributes 속성
        const attrKeys = Object.keys(rd).filter(k => k.startsWith('Attributes.') || k.startsWith('QuantitySet.'));
        if (attrKeys.length > 0) {
            html += '<optgroup label="BIM Attributes 속성">';
            attrKeys.slice(0, 20).forEach(key => { // 최대 20개만 표시
                const displayKey = key.startsWith('Attributes.') ? key.substring(11) : key;
                html += `<option value="{BIM.Attributes.${displayKey}}">{BIM.Attributes.${displayKey}}</option>`;
            });
            html += '</optgroup>';
        }

        // Parameters 속성
        if (rd.Parameters && typeof rd.Parameters === 'object') {
            const paramKeys = Object.keys(rd.Parameters);
            if (paramKeys.length > 0) {
                html += '<optgroup label="BIM Parameters 속성">';
                paramKeys.slice(0, 20).forEach(key => {
                    html += `<option value="{BIM.Parameters.${key}}">{BIM.Parameters.${key}}</option>`;
                });
                html += '</optgroup>';
            }
        }
    }

    // QM 기본 속성
    html += '<optgroup label="QM 기본 속성">';
    html += '<option value="{QM.volume}">{QM.volume}</option>';
    html += '<option value="{QM.area}">{QM.area}</option>';
    html += '<option value="{QM.length}">{QM.length}</option>';
    html += '</optgroup>';

    // QM properties
    if (member.properties && Object.keys(member.properties).length > 0) {
        html += '<optgroup label="QM 사용자 속성">';
        Object.keys(member.properties).forEach(key => {
            if (!key.endsWith('_산출식')) { // 산출식 필드는 제외
                html += `<option value="{QM.properties.${key}}">{QM.properties.${key}}</option>`;
            }
        });
        html += '</optgroup>';
    }

    // MM properties
    if (member.member_mark_properties && Object.keys(member.member_mark_properties).length > 0) {
        html += '<optgroup label="MM 일람부호 속성">';
        Object.keys(member.member_mark_properties).forEach(key => {
            html += `<option value="{MM.properties.${key}}">{MM.properties.${key}}</option>`;
        });
        html += '</optgroup>';
    }

    html += '</select>';
    html += '<button id="insert-property-btn" style="width: 100%; padding: 8px; background: #2196f3; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: 500;">적용</button>';
    html += '</div>';

    html += '<input type="text" id="new-property-value" placeholder="값 또는 산출식 (예: {BIM.Attributes.XXX} * 1.03)" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; box-sizing: border-box;">';
    html += '<button id="add-property-btn" style="width: 100%; padding: 8px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: 500;">추가</button>';
    html += '</div>';
    html += '<small style="color: #666; margin-top: 8px; display: block;">💡 팁: 위 콤보박스에서 속성을 선택하고 "적용" 버튼을 클릭하여 산출식을 쉽게 작성할 수 있습니다.</small>';
    html += '</div>';
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // 기존 속성 테이블
    if (member.properties && Object.keys(member.properties).length > 0) {
        const lockedProps = member.locked_properties || [];
        html += '<table class="properties-table editable-properties"><tbody>';
        for (const [key, value] of Object.entries(member.properties)) {
            if (value !== null && value !== undefined) {
                // 산출식인지 확인 (중괄호 포함 여부)
                const isFormula = typeof value === 'string' && value.includes('{') && value.includes('}');
                const evaluatedValue = isFormula ? evaluatePropertyFormula(value, member) : value;
                const displayValue = typeof evaluatedValue === 'number' ? evaluatedValue.toFixed(3) : evaluatedValue;
                const isLocked = lockedProps.includes(key);

                html += `<tr data-property-key="${key}">`;
                html += `<td class="prop-name">QM.properties.${key}`;
                if (isLocked) {
                    html += ` <span style="color: #f57c00; font-size: 12px;">🔒</span>`;
                }
                html += `</td>`;
                html += `<td class="prop-value">${displayValue}`;
                if (isFormula) {
                    html += `<br><small style="color: #666;">산출식: ${value}</small>`;
                }
                html += `</td>`;
                html += `<td class="prop-lock">`;
                html += `<button class="lock-property-btn" data-key="${key}" data-locked="${isLocked}">${isLocked ? '🔓' : '🔒'}</button>`;
                html += `</td>`;
                html += `<td class="prop-delete">`;
                html += `<button class="delete-property-btn" data-key="${key}">삭제</button>`;
                html += `</td>`;
                html += `</tr>`;
            }
        }
        html += '</tbody></table>';
    } else {
        html += '<p style="color: #999; font-style: italic; margin: 10px 0;">속성이 없습니다.</p>';
    }

    html += '</div>'; // 부재 속성 섹션 닫기

    // ▼▼▼ [수정] 통일된 그룹핑 시스템 적용 - 첫 번째 접두어만 사용 (2025-11-05) ▼▼▼
    // 모든 속성을 수집하여 첫 번째 접두어로 그룹핑
    const allProperties = [];

    // QM 속성 수집
    allProperties.push({ label: 'QM.System.id', value: member.id || 'N/A', editable: false });
    if (member.name) {
        allProperties.push({ label: 'QM.System.name', value: member.name, editable: false });
    }
    if (member.classification_tag_name) {
        allProperties.push({ label: 'QM.System.classification_tag', value: member.classification_tag_name, editable: false });
    }
    allProperties.push({ label: 'QM.System.is_active', value: member.is_active ? 'true' : 'false', editable: false });
    if (member.raw_element_id) {
        allProperties.push({ label: 'QM.System.raw_element_id', value: member.raw_element_id, editable: false });
    }

    // MM 속성 수집
    if (member.member_mark_mark) {
        allProperties.push({ label: 'MM.System.mark', value: member.member_mark_mark, editable: false });
    }
    if (member.member_mark_properties) {
        for (const [key, value] of Object.entries(member.member_mark_properties)) {
            if (value !== null && value !== undefined) {
                allProperties.push({ label: `MM.Properties.${key}`, value: String(value), editable: false });
            }
        }
    }

    // SC 속성 수집
    if (member.space_name) {
        allProperties.push({ label: 'SC.System.name', value: member.space_name, editable: false });
    }

    // BIM 속성 수집
    if (fullBimObject && fullBimObject.raw_data) {
        const rawData = fullBimObject.raw_data;

        // BIM 시스템 속성
        allProperties.push({ label: 'BIM.System.id', value: fullBimObject.id || 'N/A', editable: false });
        allProperties.push({ label: 'BIM.System.element_unique_id', value: fullBimObject.element_unique_id || 'N/A', editable: false });
        allProperties.push({ label: 'BIM.System.geometry_volume', value: fullBimObject.geometry_volume || 'N/A', editable: false });

        const tagsDisplay = Array.isArray(fullBimObject.classification_tags) && fullBimObject.classification_tags.length > 0
            ? fullBimObject.classification_tags.join(', ')
            : 'N/A';
        allProperties.push({ label: 'BIM.System.classification_tags', value: tagsDisplay, editable: false });

        // BIM 기본 속성 (rawData의 top-level 속성들)
        const excludedKeys = ['Parameters', 'TypeParameters', 'Geometry', 'GeometryData', 'Materials'];
        for (const [attr, value] of Object.entries(rawData)) {
            if (excludedKeys.includes(attr)) continue;
            if (value === undefined || value === null || value === '') continue;
            if (typeof value === 'object') continue;

            allProperties.push({ label: `BIM.Attributes.${attr}`, value: String(value), editable: false });
        }

        // BIM Parameters
        if (rawData.Parameters && typeof rawData.Parameters === 'object') {
            for (const [key, value] of Object.entries(rawData.Parameters)) {
                if (key === 'Geometry') continue;
                if (value === null || value === undefined || value === '') continue;
                if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 5) continue;

                const displayValue = (typeof value === 'object')
                    ? (window.renderNestedValue ? window.renderNestedValue(value, 1) : JSON.stringify(value).substring(0, 100))
                    : String(value).substring(0, 200);
                allProperties.push({ label: `BIM.Parameters.${key}`, value: displayValue, editable: false });
            }
        }

        // BIM TypeParameters
        if (rawData.TypeParameters && typeof rawData.TypeParameters === 'object') {
            for (const [key, value] of Object.entries(rawData.TypeParameters)) {
                if (value === null || value === undefined || value === '') continue;
                if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 5) continue;

                const displayValue = (typeof value === 'object')
                    ? (window.renderNestedValue ? window.renderNestedValue(value, 1) : JSON.stringify(value).substring(0, 100))
                    : String(value).substring(0, 200);
                allProperties.push({ label: `BIM.TypeParameters.${key}`, value: displayValue, editable: false });
            }
        }

        // BIM의 다른 동적 속성들 (QuantitySet 등)
        for (const [topLevelKey, topLevelValue] of Object.entries(rawData)) {
            if (excludedKeys.includes(topLevelKey)) continue;
            if (['Category', 'Family', 'Type', 'Level', 'Id'].includes(topLevelKey)) continue; // 이미 처리됨
            // ▼▼▼ [수정] null 체크 추가 (2025-11-05) ▼▼▼
            if (typeof topLevelValue === 'object' && topLevelValue !== null && !Array.isArray(topLevelValue)) {
                // Parameters, TypeParameters는 이미 처리됨
                if (topLevelKey === 'Parameters' || topLevelKey === 'TypeParameters') continue;

                for (const [key, value] of Object.entries(topLevelValue)) {
                    if (value === null || value === undefined) continue;
                    const displayValue = typeof value === 'object'
                        ? JSON.stringify(value).substring(0, 100)
                        : String(value).substring(0, 200);
                    allProperties.push({ label: `BIM.${topLevelKey}.${key}`, value: displayValue, editable: false });
                }
            }
        }
    }

    // CC 속성 수집 (공사코드)
    if (member.cost_codes && member.cost_codes.length > 0) {
        member.cost_codes.forEach((code, idx) => {
            allProperties.push({ label: `CC.System.code_${idx + 1}`, value: code, editable: false });
        });
    }

    // 첫 번째 접두어로 그룹핑
    const groupedProperties = groupFieldsByPrefix(allProperties);
    const sectionDefs = getSectionDefinitions();

    // 각 섹션별로 렌더링
    sectionDefs.forEach(section => {
        const properties = groupedProperties[section.key];
        if (properties && properties.length > 0) {
            html += '<div class="property-section">';
            html += `<h4 style="color: ${section.color}; border-bottom: 2px solid ${section.color}; padding-bottom: 5px;">${section.title}</h4>`;
            html += '<table class="properties-table"><tbody>';

            // 정렬하여 표시
            const sortedProps = properties.sort((a, b) => a.label.localeCompare(b.label));
            sortedProps.forEach(prop => {
                html += `<tr><td class="prop-name">${prop.label}</td><td class="prop-value">${prop.value}</td></tr>`;
            });

            html += '</tbody></table>';
            html += '</div>';
        }
    });
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    container.innerHTML = html;

    // ▼▼▼ [수정] 이벤트 리스너 중복 방지 (2025-11-05) ▼▼▼
    // 기존 리스너 제거 후 새로 추가
    const clickHandler = async (e) => {
        // 잠금 버튼 클릭
        if (e.target.classList.contains('lock-property-btn')) {
            const key = e.target.dataset.key;
            const isLocked = e.target.dataset.locked === 'true';
            await togglePropertyLock(member, key, !isLocked);
            return;
        }

        // 삭제 버튼 클릭
        if (e.target.classList.contains('delete-property-btn')) {
            e.stopPropagation(); // 이벤트 전파 중단
            e.preventDefault();
            const key = e.target.dataset.key;
            if (confirm(`속성 "${key}"을(를) 삭제하시겠습니까?`)) {
                await deletePropertyFromQm(member.id, key);
            }
            return;
        }
    };

    // 기존 리스너 제거
    const oldHandler = container._qmPropertiesClickHandler;
    if (oldHandler) {
        container.removeEventListener('click', oldHandler);
    }

    // 새 리스너 추가 및 저장
    container.addEventListener('click', clickHandler);
    container._qmPropertiesClickHandler = clickHandler;
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // ▼▼▼ [추가] 속성 삽입 버튼 (2025-11-05) ▼▼▼
    const insertBtn = container.querySelector('#insert-property-btn');
    if (insertBtn) {
        insertBtn.addEventListener('click', () => {
            const select = container.querySelector('#property-helper-select');
            const valueInput = container.querySelector('#new-property-value');
            const selectedValue = select.value;

            if (!selectedValue) {
                showToast('속성을 선택해주세요.', 'warning');
                return;
            }

            // 커서 위치에 삽입
            const startPos = valueInput.selectionStart;
            const endPos = valueInput.selectionEnd;
            const currentValue = valueInput.value;
            const newValue = currentValue.substring(0, startPos) + selectedValue + currentValue.substring(endPos);
            valueInput.value = newValue;

            // 커서 위치 업데이트
            const newCursorPos = startPos + selectedValue.length;
            valueInput.setSelectionRange(newCursorPos, newCursorPos);
            valueInput.focus();

            // 선택 초기화
            select.selectedIndex = 0;
        });
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // 속성 추가 버튼
    const addBtn = container.querySelector('#add-property-btn');
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const keyInput = container.querySelector('#new-property-key');
            const valueInput = container.querySelector('#new-property-value');
            const key = keyInput.value.trim();
            const value = valueInput.value.trim();

            if (!key || !value) {
                showToast('필드명과 값을 모두 입력해주세요.', 'warning');
                return;
            }

            await addPropertyToQm(member.id, key, value);
            keyInput.value = '';
            valueInput.value = '';
        });
    }
}

/**
 * 할당 정보 렌더링 (기존 기능 유지)
 */
function renderQmAssignedInfo() {
    // 기존에 구현된 할당 정보 렌더링 로직
    // 공사코드, 일람부호, 공간 할당 정보 표시
    console.log('[DEBUG] Rendering assigned info');
}

/**
 * 모든 필드 선택
 */
function selectAllQmFields() {
    const checkboxes = document.querySelectorAll('#qm-field-checkboxes-container input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = true;
    });
    updateQmTableColumns();
}

/**
 * 모든 필드 선택 해제
 */
function deselectAllQmFields() {
    const checkboxes = document.querySelectorAll('#qm-field-checkboxes-container input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
    updateQmTableColumns();
}

/**
 * 필드 체크박스 변경 핸들러
 */
function handleQmFieldCheckboxChange(e) {
    if (e.target.type === 'checkbox') {
        updateQmColumnsFromCheckboxes(true); // 실시간으로 테이블 렌더링
    }
}

/**
 * 선택된 필드에 따라 테이블 컬럼 업데이트
 */
function updateQmTableColumns() {
    // 선택된 필드 수집
    const selectedFields = [];
    const checkboxes = document.querySelectorAll('#qm-field-checkboxes-container input[type="checkbox"]:checked');
    checkboxes.forEach(cb => {
        selectedFields.push(cb.value);
    });

    console.log('[DEBUG] Selected QM fields:', selectedFields);

    // currentQmColumns에 저장
    currentQmColumns = selectedFields;
}

// =====================================================================
// 부재 속성 산출식 평가 엔진
// =====================================================================

/**
 * 속성 값에서 템플릿 표현식을 평가합니다.
 * @param {string} formula - 산출식 (예: "{BIM.Parameters.길이} * {BIM.Parameters.너비}")
 * @param {object} member - 수량산출부재 객체
 * @returns {string|number} - 평가된 값
 */
function evaluatePropertyFormula(formula, member) {
    if (!formula || typeof formula !== 'string') {
        return formula;
    }

    try {
        let result = formula;

        // 1단계: 이중 중괄호 {{XXX}} 처리 (단위 제거, 숫자만 추출)
        const doubleRegex = /\{\{([^}]+)\}\}/g;
        let match;
        const doubleReplacements = [];

        while ((match = doubleRegex.exec(formula)) !== null) {
            const expression = match[1]; // 예: "BIM.Parameters.길이"
            const value = resolvePropertyPath(expression, member);

            if (value !== null && value !== undefined) {
                // 값에서 숫자만 추출 (정규식: 앞쪽의 숫자 부분만)
                const numericMatch = String(value).match(/^\s*(-?\d+(\.\d+)?)/);
                if (numericMatch) {
                    const numericValue = numericMatch[1];
                    doubleReplacements.push({ placeholder: match[0], value: numericValue });
                } else {
                    // 숫자 추출 실패 시 0으로 처리
                    doubleReplacements.push({ placeholder: match[0], value: '0' });
                }
            } else {
                console.warn(`[evaluatePropertyFormula] Cannot resolve: ${expression}`);
                return formula;
            }
        }

        // 이중 중괄호 치환
        for (const { placeholder, value } of doubleReplacements) {
            result = result.replace(placeholder, value);
        }

        // 2단계: 단일 중괄호 {XXX} 처리 (전체 값 사용)
        const singleRegex = /\{([^}]+)\}/g;
        const singleReplacements = [];

        // 이미 처리된 이중 중괄호를 제외하고 단일 중괄호만 찾기
        while ((match = singleRegex.exec(result)) !== null) {
            const expression = match[1];
            const value = resolvePropertyPath(expression, member);

            if (value !== null && value !== undefined) {
                singleReplacements.push({ placeholder: match[0], value: value });
            } else {
                console.warn(`[evaluatePropertyFormula] Cannot resolve: ${expression}`);
                return formula;
            }
        }

        // 단일 중괄호 치환
        for (const { placeholder, value } of singleReplacements) {
            result = result.replace(placeholder, value);
        }

        // 3단계: 수식 계산 시도 (사칙연산만 지원)
        if (/^[\d\s+\-*/.()]+$/.test(result)) {
            try {
                // eval 대신 안전한 계산
                result = Function(`'use strict'; return (${result})`)();
            } catch (e) {
                console.warn('[evaluatePropertyFormula] Calculation error:', e);
                return formula;
            }
        }

        return result;
    } catch (error) {
        console.error('[evaluatePropertyFormula] Error:', error);
        return formula;
    }
}

/**
 * 속성 경로를 해결하여 값을 가져옵니다.
 * 새로운 형식 지원: {Category}, {Parameters.XXX}, {TypeParameters.XXX}
 * 기존 형식도 지원: QM.properties.XXX, BIM.Parameters.XXX, MM.properties.XXX
 * @param {string} path - 속성 경로
 * @param {object} member - 수량산출부재 객체
 * @returns {any} - 해결된 값
 */
function resolvePropertyPath(path, member) {
    const parts = path.split('.');

    // ===== 새 형식: {Parameters.XXX}, {TypeParameters.XXX} =====
    if (parts[0] === 'Parameters' && parts.length >= 2) {
        // {Parameters.XXX} → BIM raw_data.Parameters.XXX
        const elementId = member.split_element_id || member.raw_element_id;
        const fullBimObject = elementId && window.allRevitData ?
            window.allRevitData.find(item => item.id === elementId) : null;

        if (fullBimObject && fullBimObject.raw_data && fullBimObject.raw_data.Parameters) {
            const key = parts.slice(1).join('.');
            return fullBimObject.raw_data.Parameters[key];
        }
        return null;
    }

    if (parts[0] === 'TypeParameters' && parts.length >= 2) {
        // {TypeParameters.XXX} → BIM raw_data.TypeParameters.XXX
        const elementId = member.split_element_id || member.raw_element_id;
        const fullBimObject = elementId && window.allRevitData ?
            window.allRevitData.find(item => item.id === elementId) : null;

        if (fullBimObject && fullBimObject.raw_data && fullBimObject.raw_data.TypeParameters) {
            const key = parts.slice(1).join('.');
            return fullBimObject.raw_data.TypeParameters[key];
        }
        return null;
    }

    // ===== 새 형식: {Category}, {Family}, {Type}, etc. =====
    if (parts.length === 1) {
        // 단일 속성명 → BIM raw_data의 최상위 속성 시도
        const elementId = member.split_element_id || member.raw_element_id;
        const fullBimObject = elementId && window.allRevitData ?
            window.allRevitData.find(item => item.id === elementId) : null;

        if (fullBimObject && fullBimObject.raw_data) {
            const value = fullBimObject.raw_data[path];
            if (value !== undefined && value !== null) {
                return value;
            }
        }
    }

    // ===== 기존 형식: QM.XXX =====
    if (parts[0] === 'QM') {
        // QM.properties.XXX
        if (parts[1] === 'properties' && parts.length >= 3) {
            const key = parts.slice(2).join('.');
            const value = member.properties?.[key];

            // 재귀적 평가 (속성이 또 다른 산출식인 경우)
            if (typeof value === 'string' && value.includes('{') && value.includes('}')) {
                return evaluatePropertyFormula(value, member);
            }
            return value;
        }
        // QM.name, QM.id 등
        if (parts.length === 2) {
            return member[parts[1]];
        }
    }

    // ===== 기존 형식: BIM.XXX =====
    else if (parts[0] === 'BIM') {
        // member.raw_element는 실제 raw_data 객체입니다 (레거시 지원)
        const rawData = member.raw_element;
        if (!rawData) {
            console.warn(`[resolvePropertyPath] No raw_element data for member ${member.id}, path: ${path}`);
            return null;
        }

        if (parts[1] === 'Parameters' && parts.length >= 3) {
            // BIM.Parameters.XXX
            const key = parts.slice(2).join('.');
            return rawData.Parameters?.[key];
        } else if (parts[1] === 'TypeParameters' && parts.length >= 3) {
            // BIM.TypeParameters.XXX
            const key = parts.slice(2).join('.');
            return rawData.TypeParameters?.[key];
        } else if (parts[1] === 'Attributes' && parts.length >= 3) {
            // BIM.Attributes.XXX는 raw_data의 최상위 속성
            const key = parts.slice(2).join('.');
            return rawData[key];
        } else if (parts[1] === 'System' && parts.length >= 3) {
            // BIM.System.XXX는 raw_data의 최상위 System 관련 속성
            const key = parts.slice(2).join('.');
            return rawData[key];
        } else if (parts.length === 2) {
            // BIM.XXX (직접 속성, 최상위)
            return rawData[parts[1]];
        }
    }

    // ===== 기존 형식: MM.XXX =====
    else if (parts[0] === 'MM') {
        // MM.properties.XXX 또는 MM.mark
        if (parts[1] === 'properties' && parts.length >= 3) {
            const key = parts.slice(2).join('.');
            return member.member_mark_properties?.[key];
        } else if (parts[1] === 'mark') {
            return member.member_mark_mark;
        } else if (parts.length === 2) {
            // MM.XXX (직접 속성)
            return member[`member_mark_${parts[1]}`];
        }
    }

    console.warn(`[resolvePropertyPath] Could not resolve path: ${path}`);
    return null;
}

/**
 * 속성 변경 시 의존성이 있는 다른 속성들을 재계산합니다.
 * @param {object} member - 수량산출부재 객체
 */
function recalculatePropertiesWithFormulas(member) {
    if (!member.properties) return;

    // 변경 감지를 위한 반복 계산
    let hasChanges = true;
    let iterations = 0;
    const maxIterations = 10; // 무한 루프 방지

    while (hasChanges && iterations < maxIterations) {
        hasChanges = false;
        iterations++;

        for (const [key, value] of Object.entries(member.properties)) {
            if (typeof value === 'string' && value.includes('{') && value.includes('}')) {
                const newValue = evaluatePropertyFormula(value, member);

                // 계산된 값이 변경되었으면 업데이트 (내부 참조용)
                if (newValue !== value && typeof newValue === 'number') {
                    // 실제 저장은 하지 않고, 다음 평가를 위해 임시로 사용
                    hasChanges = true;
                }
            }
        }
    }

    console.log(`[recalculatePropertiesWithFormulas] Completed in ${iterations} iterations`);
}

// =====================================================================
// 스플릿바 크기 조정 기능
// =====================================================================

function initQmSplitBar() {
    const splitBar = document.querySelector('#quantity-members .qm-split-bar');
    const leftPanel = document.querySelector('#quantity-members .left-panel');
    const container = document.querySelector('#quantity-members .split-layout-container');

    if (!splitBar || !leftPanel || !container) {
        console.log('[DEBUG] Split bar elements not found, skipping initialization');
        return;
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    splitBar.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = leftPanel.offsetWidth;

        // 리사이징 중 텍스트 선택 방지
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const newWidth = startWidth + deltaX;

        // 최소/최대 너비 제한 (CSS에서 설정한 값과 동일)
        const minWidth = 200;
        const maxWidth = 600;

        if (newWidth >= minWidth && newWidth <= maxWidth) {
            leftPanel.style.flexBasis = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }
    });

    console.log('[DEBUG] QM Split bar initialized');
}

// =====================================================================
// 속성 룰셋 일괄적용 기능
// =====================================================================

/**
 * 모든 수량산출부재에 속성 매핑 룰셋을 일괄 적용합니다.
 */
async function applyPropertyRulesToAllQm() {
    if (!currentProjectId) {
        showToast('프로젝트를 먼저 선택하세요.', 'warning');
        return;
    }

    if (!confirm('모든 수량산출부재에 속성 매핑 룰셋을 적용하시겠습니까?\n\n기존 속성 값이 룰셋 계산 결과로 덮어씌워질 수 있습니다.')) {
        return;
    }

    try {
        showToast('속성 룰셋을 적용 중입니다...', 'info');

        // 속성 매핑 룰셋 일괄 적용 API 호출
        const response = await fetch(
            `/connections/api/rules/property-mapping/apply/${currentProjectId}/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken(),
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '속성 룰셋 적용에 실패했습니다.');
        }

        const result = await response.json();
        showToast(result.message || '속성 룰셋이 적용되었습니다.', 'success');

        // 데이터 새로고침
        await loadQuantityMembers();

        // 선택된 부재가 있으면 속성 패널 갱신
        if (selectedQmIds.size > 0) {
            renderQmSelectedProperties();
        }

    } catch (error) {
        console.error('[applyPropertyRulesToAllQm] Error:', error);
        showToast(error.message, 'error');
    }
}

// =====================================================================
// 부재 속성 추가/삭제 기능
// =====================================================================

/**
 * 수량산출부재에 새 속성을 추가합니다.
 */
async function addPropertyToQm() {
    if (selectedQmIds.size !== 1) {
        showToast('부재를 하나만 선택하세요.', 'warning');
        return;
    }

    const keyInput = document.getElementById('new-property-key');
    const valueInput = document.getElementById('new-property-value');

    if (!keyInput || !valueInput) {
        console.error('[addPropertyToQm] Input elements not found');
        return;
    }

    const key = keyInput.value.trim();
    const value = valueInput.value.trim();

    if (!key) {
        showToast('필드명을 입력하세요.', 'warning');
        return;
    }

    if (!value) {
        showToast('값을 입력하세요.', 'warning');
        return;
    }

    const selectedId = selectedQmIds.values().next().value;
    const member = loadedQuantityMembers.find(m => m.id.toString() === selectedId);

    if (!member) {
        showToast('선택된 부재를 찾을 수 없습니다.', 'error');
        return;
    }

    try {
        // ▼▼▼ [수정] 산출식 자동 처리 (2025-11-05) ▼▼▼
        const updatedProperties = { ...(member.properties || {}) };

        // 값이 산출식인지 확인 (중괄호 포함 여부)
        const isFormula = value.includes('{') && value.includes('}');

        if (isFormula) {
            // 산출식인 경우: XXX_산출식 필드에 산식 저장, XXX 필드에 계산 결과 저장
            const formulaKey = `${key}_산출식`;
            updatedProperties[formulaKey] = value;

            // 산출식 계산
            const calculatedValue = evaluateQmPropertyFormula(value, member);
            updatedProperties[key] = calculatedValue;

            console.log(`[addPropertyToQm] 산출식 저장: ${formulaKey} = ${value}`);
            console.log(`[addPropertyToQm] 계산 결과: ${key} = ${calculatedValue}`);
        } else {
            // 일반 값인 경우: 직접 저장
            updatedProperties[key] = value;
            console.log(`[addPropertyToQm] 직접 값 저장: ${key} = ${value}`);
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // 서버에 저장
        const response = await fetch(
            `/connections/api/quantity-members/${currentProjectId}/${member.id}/`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken(),
                },
                body: JSON.stringify({ properties: updatedProperties }),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '속성 추가에 실패했습니다.');
        }

        const result = await response.json();

        // 로컬 데이터 업데이트
        member.properties = updatedProperties;

        // ▼▼▼ [추가] 수동 추가된 속성 자동 잠금 (2025-11-05) ▼▼▼
        // 기본 필드와 산출식 필드 모두 잠금
        const lockedProps = member.locked_properties || [];
        if (!lockedProps.includes(key)) {
            lockedProps.push(key);
        }
        if (isFormula) {
            const formulaKey = `${key}_산출식`;
            if (!lockedProps.includes(formulaKey)) {
                lockedProps.push(formulaKey);
            }
        }

        // 서버에 잠금 상태 저장
        await fetch(
            `/connections/api/quantity-members/${currentProjectId}/${member.id}/`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken(),
                },
                body: JSON.stringify({ locked_properties: lockedProps }),
            }
        );

        member.locked_properties = lockedProps;
        console.log(`[addPropertyToQm] 속성 잠금 적용: ${key}${isFormula ? ', ' + key + '_산출식' : ''}`);
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        showToast('속성이 추가되었습니다. (자동 잠금됨)', 'success');

        // 입력 필드 초기화
        keyInput.value = '';
        valueInput.value = '';

        // UI 갱신
        renderQmSelectedProperties();

        // 테이블도 업데이트 (properties 필드가 표시되는 경우)
        renderActiveQmView();

    } catch (error) {
        console.error('[addPropertyToQm] Error:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 수량산출부재에서 속성을 삭제합니다.
 * @param {string} memberId - 부재 ID
 * @param {string} key - 삭제할 속성의 키
 */
async function deletePropertyFromQm(memberId, key) {
    const member = loadedQuantityMembers.find(m => m.id.toString() === memberId);

    if (!member) {
        showToast('선택된 부재를 찾을 수 없습니다.', 'error');
        return;
    }

    try {
        // 속성 제거
        const updatedProperties = { ...member.properties };
        delete updatedProperties[key];

        // 서버에 저장
        const response = await fetch(
            `/connections/api/quantity-members/${currentProjectId}/${member.id}/`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken(),
                },
                body: JSON.stringify({ properties: updatedProperties }),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '속성 삭제에 실패했습니다.');
        }

        const result = await response.json();
        showToast('속성이 삭제되었습니다.', 'success');

        // 로컬 데이터 업데이트
        member.properties = updatedProperties;

        // 재계산 (다른 산출식이 이 속성을 참조하는 경우 영향)
        recalculatePropertiesWithFormulas(member);

        // UI 갱신
        renderQmSelectedProperties();

        // 테이블도 업데이트
        renderActiveQmView();

    } catch (error) {
        console.error('[deletePropertyFromQm] Error:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 속성 잠금/잠금해제를 토글합니다.
 * @param {object} member - 수량산출부재 객체
 * @param {string} key - 속성 키
 * @param {boolean} lock - true: 잠금, false: 잠금해제
 */
async function togglePropertyLock(member, key, lock) {
    try {
        // 현재 잠긴 속성 목록
        const lockedProps = member.locked_properties || [];
        let updatedLockedProps;

        if (lock) {
            // 잠금: 목록에 추가
            if (!lockedProps.includes(key)) {
                updatedLockedProps = [...lockedProps, key];
            } else {
                updatedLockedProps = lockedProps;
            }
        } else {
            // 잠금해제: 목록에서 제거
            updatedLockedProps = lockedProps.filter(k => k !== key);
        }

        // 서버에 저장
        const response = await fetch(
            `/connections/api/quantity-members/${currentProjectId}/${member.id}/`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken(),
                },
                body: JSON.stringify({ locked_properties: updatedLockedProps }),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '속성 잠금 설정에 실패했습니다.');
        }

        // 로컬 데이터 업데이트
        member.locked_properties = updatedLockedProps;

        showToast(lock ? `속성 "${key}"이(가) 잠겼습니다. 룰셋 적용 시 보존됩니다.` : `속성 "${key}"의 잠금이 해제되었습니다.`, 'success');

        // UI 갱신
        renderQmSelectedProperties();

    } catch (error) {
        console.error('[togglePropertyLock] Error:', error);
        showToast(error.message, 'error');
    }
}

// =====================================================================
// 수동 수량 산출식 계산 함수들 (2025-11-05 추가)
// =====================================================================

/**
 * QM.properties의 산출식을 평가하여 숫자값을 반환
 * @param {string} formula - 산출식 문자열 (예: "{BIM.Attributes.XXX}*1.03")
 * @param {object} member - QuantityMember 객체
 * @returns {number} - 계산된 값
 */
// ▼▼▼ [수정] resolvePropertyPath 재사용하여 MM.properties 지원 추가 (2025-11-05) ▼▼▼
function evaluateQmPropertyFormula(formula, member) {
    if (!formula || typeof formula !== 'string') return 0;

    let evaluatedFormula = formula;

    console.log('[evaluateQmPropertyFormula] Original formula:', formula);

    // {PropertyPath} 패턴 찾기
    const matches = formula.matchAll(/\{([^}]+)\}/g);
    for (const match of matches) {
        const fullMatch = match[0]; // {BIM.Attributes.XXX} 또는 {MM.properties.XXX}
        const propertyPath = match[1]; // BIM.Attributes.XXX 또는 MM.properties.XXX

        // resolvePropertyPath 함수를 사용하여 모든 경로 지원
        const actualValue = resolvePropertyPath(propertyPath, member);

        if (actualValue !== null && actualValue !== undefined) {
            evaluatedFormula = evaluatedFormula.replace(fullMatch, actualValue);
            console.log(`[evaluateQmPropertyFormula] Replaced ${fullMatch} with ${actualValue}`);
        } else {
            console.warn(`[evaluateQmPropertyFormula] Missing value for ${propertyPath}`);
            evaluatedFormula = evaluatedFormula.replace(fullMatch, '0');
        }
    }

    console.log('[evaluateQmPropertyFormula] Evaluated formula:', evaluatedFormula);

    // 수식 계산
    try {
        const result = eval(evaluatedFormula);
        console.log('[evaluateQmPropertyFormula] Result:', result);
        return result;
    } catch (e) {
        console.error('[evaluateQmPropertyFormula] Evaluation error:', e);
        return 0;
    }
}
// ▲▲▲ [수정] 여기까지 ▲▲▲

/**
 * 모든 수량산출부재의 산출식 기반 속성을 일괄 업데이트
 */
async function updateAllQmFormulas() {
    if (!loadedQuantityMembers || loadedQuantityMembers.length === 0) {
        showToast('업데이트할 부재가 없습니다.', 'warning');
        return;
    }

    let updatedCount = 0;
    const errors = [];

    for (const member of loadedQuantityMembers) {
        if (!member.properties) continue;

        const updatedProperties = { ...member.properties };
        let hasUpdates = false;

        // XXX_산출식 필드 찾기
        for (const key in updatedProperties) {
            if (key.endsWith('_산출식')) {
                const baseKey = key.substring(0, key.length - 4); // "_산출식" 제거
                const formula = updatedProperties[key];

                if (formula && typeof formula === 'string') {
                    // 산출식 계산
                    const calculatedValue = evaluateQmPropertyFormula(formula, member);
                    updatedProperties[baseKey] = calculatedValue;
                    hasUpdates = true;

                    console.log(`[updateAllQmFormulas] Updated ${member.id} - ${baseKey}: ${calculatedValue} (from formula: ${formula})`);
                }
            }
        }

        if (hasUpdates) {
            try {
                // 서버에 저장
                const response = await fetch(
                    `/connections/api/quantity-members/${currentProjectId}/${member.id}/`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCSRFToken(),
                        },
                        body: JSON.stringify({ properties: updatedProperties }),
                    }
                );

                if (!response.ok) {
                    const error = await response.json();
                    errors.push(`${member.name}: ${error.message || '저장 실패'}`);
                } else {
                    // 로컬 데이터 업데이트
                    member.properties = updatedProperties;
                    updatedCount++;
                }
            } catch (error) {
                console.error(`[updateAllQmFormulas] Error updating member ${member.id}:`, error);
                errors.push(`${member.name}: ${error.message}`);
            }
        }
    }

    if (errors.length > 0) {
        showToast(`${updatedCount}개 부재 업데이트 완료, ${errors.length}개 오류 발생`, 'warning');
        console.error('[updateAllQmFormulas] Errors:', errors);
    } else if (updatedCount > 0) {
        showToast(`${updatedCount}개 부재의 산출식이 업데이트되었습니다.`, 'success');
    } else {
        showToast('업데이트할 산출식이 없습니다.', 'info');
    }

    // UI 갱신
    renderActiveQmView();
    renderQmSelectedProperties();
}
