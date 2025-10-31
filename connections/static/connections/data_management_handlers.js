
// /Users/mddoyun/Developments/CostEstimatorCnv/connections/static/connections/data_management_handlers.js

function setupDataManagementListeners() {
    document
        .getElementById('fetchDataBtn')
        ?.addEventListener('click', fetchDataFromClient);
    document
        .getElementById('get-from-client-btn')
        ?.addEventListener('click', getSelectionFromClient);
    document
        .getElementById('select-in-client-btn')
        ?.addEventListener('click', selectInClient);
    document
        .getElementById('render-table-btn')
        ?.addEventListener('click', () =>
            renderDataTable(
                'data-management-data-table-container',
                'data-management'
            )
        );
    document
        .querySelectorAll('#data-management .view-tab-button')
        .forEach((button) =>
            button.addEventListener('click', handleViewTabClick)
        );
    document
        .getElementById('add-group-level-btn')
        ?.addEventListener('click', () => addGroupingLevel('data-management'));
    document
        .getElementById('data-management-grouping-controls')
        ?.addEventListener('change', () =>
            renderDataTable(
                'data-management-data-table-container',
                'data-management'
            )
        ); // 그룹핑 변경 시 렌더
    document
        .getElementById('clear-selection-filter-btn')
        ?.addEventListener('click', clearSelectionFilter);
    document
        .getElementById('assign-tag-btn')
        ?.addEventListener('click', assignTagsToSelection);
    document
        .getElementById('apply-rules-btn')
        ?.addEventListener('click', () => applyClassificationRules(false)); // 확인창 표시
    document
        .getElementById('clear-tags-btn')
        ?.addEventListener('click', clearTagsFromSelection);
    const dmTableContainer = document.getElementById(
        'data-management-data-table-container'
    );
    if (dmTableContainer) {
        dmTableContainer.addEventListener('keyup', (e) =>
            handleColumnFilter(e, 'data-management')
        ); // 필터 입력
        dmTableContainer.addEventListener('click', (e) =>
            handleTableClick(e, 'data-management')
        ); // 행 선택, 그룹 토글
    }
    // 좌측 패널 탭 (필드선택, 분류, BIM속성)
    document
        .querySelector('#data-management .left-panel-tabs')
        ?.addEventListener('click', handleLeftPanelTabClick);
    console.log('[DEBUG] Data Management listeners setup complete.');
}

function fetchDataFromClient() {
    document.getElementById('project-selector').disabled = true;
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }
    // ▼▼▼ [수정] data-management 뷰어의 상태를 초기화합니다. ▼▼▼
    const state = viewerStates['data-management'];
    state.selectedElementIds.clear();
    state.revitFilteredIds.clear();
    state.isFilterToSelectionActive = false;
    // ▲▲▲ [수정] 여기까지 입니다. ▲▲▲
    document.getElementById('clear-selection-filter-btn').style.display =
        'none';

    const progressContainer = document.getElementById('progress-container');
    const progressStatus = document.getElementById('progress-status-text');
    const progressBar = document.getElementById('data-fetch-progress');

    progressContainer.style.display = 'block';
    progressStatus.textContent = `${currentMode === 'revit' ? 'Revit' : 'Blender'
        }에 데이터 요청 중...`;
    progressBar.value = 0;
    progressBar.removeAttribute('max');

    const targetGroup =
        currentMode === 'revit'
            ? 'revit_broadcast_group'
            : 'blender_broadcast_group';

    frontendSocket.send(
        JSON.stringify({
            type: 'command_to_client',
            payload: {
                command: 'fetch_all_elements_chunked',
                project_id: currentProjectId,
                target_group: targetGroup,
            },
        })
    );
    document.getElementById('status').textContent = `명령 전송 성공! ${currentMode === 'revit' ? 'Revit' : 'Blender'
        }에서 데이터를 보내는 중입니다.`;
    showToast(
        `${currentMode === 'revit' ? 'Revit' : 'Blender'
        }에 데이터 요청 명령을 보냈습니다.`,
        'info'
    );
}

function getSelectionFromClient() {
    const targetGroup =
        currentMode === 'revit'
            ? 'revit_broadcast_group'
            : 'blender_broadcast_group';
    frontendSocket.send(
        JSON.stringify({
            type: 'command_to_client',
            payload: {
                command: 'get_selection',
                target_group: targetGroup,
            },
        })
    );
    showToast(
        `${currentMode === 'revit' ? 'Revit' : 'Blender'
        }에 선택 정보 가져오기를 요청했습니다.`,
        'info'
    );
}

function selectInClient() {
    // ▼▼▼ [수정] 현재 활성화된 탭에 따라 올바른 선택 ID 집합을 사용합니다. ▼▼▼
    const state = getCurrentViewerState();
    const selectedIds = state.selectedElementIds;

    if (selectedIds.size === 0) {
        // ▲▲▲ [수정] 여기까지 입니다. ▲▲▲
        showToast(
            `테이블에서 ${currentMode === 'revit' ? 'Revit' : 'Blender'
            }으로 보낼 객체를 먼저 선택하세요.`,
            'error'
        );
        return;
    }
    // ▼▼▼ [수정] selectedElementIds를 selectedIds로 변경합니다. ▼▼▼
    const uniqueIdsToSend = allRevitData
        .filter((item) => selectedIds.has(item.id))
        .map((item) => item.element_unique_id);
    // ▲▲▲ [수정] 여기까지 입니다. ▲▲▲
    const targetGroup =
        currentMode === 'revit'
            ? 'revit_broadcast_group'
            : 'blender_broadcast_group';
    frontendSocket.send(
        JSON.stringify({
            type: 'command_to_client',
            payload: {
                command: 'select_elements',
                unique_ids: uniqueIdsToSend,
                target_group: targetGroup,
            },
        })
    );
    showToast(
        `${uniqueIdsToSend.length}개 객체의 선택 명령을 ${currentMode === 'revit' ? 'Revit' : 'Blender'
        }으로 보냈습니다.`,
        'info'
    );
}

function handleViewTabClick(e) {
    const clickedButton = e.currentTarget;
    const contextPrefix = clickedButton.closest('#data-management')
        ? 'data-management'
        : 'space-management';
    const state = viewerStates[contextPrefix];

    const viewTabsContainer = clickedButton.closest('.view-tabs');
    viewTabsContainer
        .querySelector('.view-tab-button.active')
        .classList.remove('active');
    clickedButton.classList.add('active');

    // ▼▼▼ [수정] viewerStates의 상태를 업데이트합니다. ▼▼▼
    state.activeView = clickedButton.dataset.view;
    state.collapsedGroups = {};
    state.columnFilters = {};
    // ▲▲▲ [수정] 여기까지 입니다. ▲▲▲

    const containerId = `${contextPrefix}-data-table-container`;
    renderDataTable(containerId, contextPrefix);
}

function clearSelectionFilter() {
    // ▼▼▼ [수정] viewerStates의 상태를 업데이트합니다. ▼▼▼
    const state = viewerStates['data-management'];
    state.isFilterToSelectionActive = false;
    state.revitFilteredIds.clear();
    // ▲▲▲ [수정] 여기까지 입니다. ▲▲▲

    document.getElementById('clear-selection-filter-btn').style.display =
        'none';
    renderDataTable('data-management-data-table-container', 'data-management');
    showToast('선택 필터를 해제하고 전체 목록을 표시합니다.', 'info');
}

function assignTagsToSelection() {
    const tagId = document.getElementById('tag-assign-select').value;
    if (!tagId) {
        showToast('적용할 분류를 선택하세요.', 'error');
        return;
    }

    // ▼▼▼ [수정] viewerStates에서 현재 컨텍스트의 선택된 ID를 가져옵니다. ▼▼▼
    const state = viewerStates['data-management']; // 이 버튼은 'data-management' 탭에만 존재합니다.
    const selectedElementIds = state.selectedElementIds;
    // ▲▲▲ [수정] 여기까지 입니다. ▲▲▲

    if (selectedElementIds.size === 0) {
        showToast('분류를 적용할 객체를 테이블에서 선택하세요.', 'error');
        return;
    }
    frontendSocket.send(
        JSON.stringify({
            type: 'assign_tags',
            payload: {
                project_id: currentProjectId,
                tag_id: tagId,
                element_ids: Array.from(selectedElementIds),
            },
        })
    );
}

function clearTagsFromSelection() {
    // ▼▼▼ [수정] viewerStates에서 현재 컨텍스트의 선택된 ID를 가져옵니다. ▼▼▼
    const state = viewerStates['data-management'];
    const selectedElementIds = state.selectedElementIds;
    // ▲▲▲ [수정] 여기까지 입니다. ▲▲▲

    if (selectedElementIds.size === 0) {
        showToast('분류를 제거할 객체를 테이블에서 선택하세요.', 'error');
        return;
    }
    if (
        confirm(
            `${selectedElementIds.size}개 항목의 모든 수량산출분류를 제거하시겠습니까?`
        )
    ) {
        frontendSocket.send(
            JSON.stringify({
                type: 'clear_tags',
                payload: {
                    project_id: currentProjectId,
                    element_ids: Array.from(selectedElementIds),
                },
            })
        );
    }
}

function handleColumnFilter(e, contextPrefix) {
    const input = e.target;
    if (!input.classList || !input.classList.contains('column-filter')) return;

    const field = input.dataset.field;
    const state = viewerStates[contextPrefix];
    if (!state) return;

    // 필터값은 항상 소문자로 저장 (비교 비용 절감)
    const v = (input.value || '').toLowerCase();
    state.columnFilters[field] = v;

    // 디바운스로 렌더 호출
    debouncedRender(contextPrefix)();
}

function handleTableClick(event, contextPrefix) {
    const row = event.target.closest('tr');
    if (!row) return;

    const state = viewerStates[contextPrefix];
    if (!state) return;

    const containerId = `${contextPrefix}-data-table-container`;

    if (row.classList.contains('group-header')) {
        const groupPath = row.dataset.groupPath;
        if (groupPath) {
            state.collapsedGroups[groupPath] =
                !state.collapsedGroups[groupPath];
            renderDataTable(containerId, contextPrefix);
        }
    } else if (row.dataset.dbId) {
        // ▼▼▼ [수정] data-dbId를 사용하도록 변경 ▼▼▼
        handleRowSelection(event, row, contextPrefix);
        renderDataTable(containerId, contextPrefix);
        // ▼▼▼ [수정] 함수 호출 시 contextPrefix 인자 전달 ▼▼▼
        renderBimPropertiesTable(contextPrefix);
        renderAssignedTagsTable(contextPrefix);
        // 룰셋 작성 도우미 패널 업데이트
        if (contextPrefix === 'data-management') {
            renderRawDataHelperPanel();
        }
    }
}

function handleRowSelection(event, clickedRow, contextPrefix) {
    const state = viewerStates[contextPrefix];
    if (!state) return;

    const tableContainer = document.getElementById(
        `${contextPrefix}-data-table-container`
    );
    const allVisibleRows = Array.from(
        tableContainer.querySelectorAll('tr[data-db-id]')
    );

    const clickedRowIndex = allVisibleRows.findIndex(
        (r) => r.dataset.dbId === clickedRow.dataset.dbId
    );
    const elementDbId = clickedRow.dataset.dbId;

    if (!elementDbId) return;

    if (event.shiftKey && state.lastSelectedRowIndex > -1) {
        const start = Math.min(state.lastSelectedRowIndex, clickedRowIndex);
        const end = Math.max(state.lastSelectedRowIndex, clickedRowIndex);
        if (!event.ctrlKey) state.selectedElementIds.clear();
        for (let i = start; i <= end; i++) {
            const rowId = allVisibleRows[i]?.dataset.dbId;
            if (rowId) state.selectedElementIds.add(rowId);
        }
    } else if (event.ctrlKey) {
        if (state.selectedElementIds.has(elementDbId)) {
            state.selectedElementIds.delete(elementDbId);
        } else {
            state.selectedElementIds.add(elementDbId);
        }
    } else {
        state.selectedElementIds.clear();
        state.selectedElementIds.add(elementDbId);
    }
    state.lastSelectedRowIndex = clickedRowIndex;
}

function addGroupingLevel(contextPrefix) {
    const container = document.getElementById(
        `${contextPrefix}-grouping-controls`
    );
    if (!container) return;

    const newIndex = container.children.length + 1;
    const newLevelDiv = document.createElement('div');
    newLevelDiv.className = 'group-level';
    newLevelDiv.innerHTML = `
        <label>${newIndex}차:</label>
        <select class="group-by-select"></select>
        <button class="remove-group-level-btn">-</button>
    `;
    container.appendChild(newLevelDiv);
    populateFieldSelection(); // 필드 목록 채우기

    newLevelDiv
        .querySelector('.remove-group-level-btn')
        .addEventListener('click', function () {
            this.parentElement.remove();
            renderDataTable(
                `${contextPrefix}-data-table-container`,
                contextPrefix
            );
        });
}

function handleLeftPanelTabClick(event) {
    const clickedButton = event.target.closest('.left-panel-tab-button');
    if (!clickedButton || clickedButton.classList.contains('active')) {
        // 버튼이 아니거나 이미 활성화된 탭이면 아무것도 하지 않음
        return;
    }

    const tabContainer = clickedButton.closest('.left-panel-tab-container');
    const targetTabId = clickedButton.dataset.tab;

    // 현재 활성화된 탭과 콘텐츠를 비활성화
    tabContainer
        .querySelector('.left-panel-tab-button.active')
        .classList.remove('active');
    tabContainer
        .querySelector('.left-panel-tab-content.active')
        .classList.remove('active');

    // 클릭된 버튼과 그에 맞는 콘텐츠를 활성화
    clickedButton.classList.add('active');
    tabContainer.querySelector(`#${targetTabId}`).classList.add('active');
}

/**
 * BIM 원본 데이터 탭에서 선택한 객체의 속성을 룰셋 작성 도우미 패널에 표시합니다.
 */
function renderRawDataHelperPanel() {
    const helperContainer = document.getElementById('raw-data-helper-properties-container');

    if (!helperContainer) return;

    const state = viewerStates['data-management'];
    if (!state || state.selectedElementIds.size === 0) {
        helperContainer.innerHTML = '<p style="color: #999;">테이블에서 행을 선택하면 해당 객체의 속성이 여기에 표시됩니다.</p>';
        return;
    }

    // 첫 번째 선택된 객체만 표시
    const firstSelectedId = Array.from(state.selectedElementIds)[0];
    console.log('[DEBUG] Looking for element with ID:', firstSelectedId);
    console.log('[DEBUG] allRevitData sample:', window.allRevitData?.[0]);

    // db_id, dbId, DB_ID 등 다양한 필드명 시도
    const selectedElement = window.allRevitData?.find(el =>
        el.db_id === firstSelectedId ||
        el.dbId === firstSelectedId ||
        el.DB_ID === firstSelectedId ||
        el.id === firstSelectedId ||
        String(el.db_id) === String(firstSelectedId) ||
        String(el.dbId) === String(firstSelectedId)
    );

    if (!selectedElement) {
        console.error('[ERROR] Could not find element with ID:', firstSelectedId);
        console.log('[DEBUG] Available element IDs:', window.allRevitData?.map(el => el.db_id || el.dbId).slice(0, 5));
        helperContainer.innerHTML = `<p style="color: #999;">선택한 객체의 데이터를 찾을 수 없습니다. (ID: ${firstSelectedId})</p>`;
        return;
    }

    console.log('[DEBUG] Found element:', selectedElement);

    // HTML 생성
    let html = '<div style="margin-bottom: 10px; padding: 8px; background: #e3f2fd; border-radius: 4px; font-size: 12px; color: #1976d2;">선택한 객체의 모든 속성을 룰셋에 사용 가능한 형태로 표시합니다</div>';

    // raw_data 필드에서 실제 BIM 속성 가져오기
    let bimData = selectedElement;
    if (selectedElement.raw_data) {
        try {
            bimData = typeof selectedElement.raw_data === 'string'
                ? JSON.parse(selectedElement.raw_data)
                : selectedElement.raw_data;
        } catch (e) {
            console.error('[ERROR] Failed to parse raw_data:', e);
        }
    }

    // 시스템 속성 표시
    const systemProps = {
        'Category': bimData.Category,
        'Family': bimData.Family,
        'Type': bimData.Type,
        'Level': bimData.Level
    };

    html += '<div style="margin-bottom: 15px;">';
    html += '<div style="font-weight: bold; color: #555; margin-bottom: 5px; font-size: 14px; border-bottom: 2px solid #2196f3; padding-bottom: 4px;">시스템 속성</div>';

    let hasSystemProps = false;
    html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
    for (const [key, value] of Object.entries(systemProps)) {
        if (value !== undefined && value !== null && value !== '') {
            hasSystemProps = true;
            html += `
                <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 8px 10px; font-weight: 600; color: #1976d2; font-family: monospace; width: 40%; background: #f5f5f5; vertical-align: top;">{${key}}</td>
                    <td style="padding: 8px 10px; color: #666; width: 60%; word-break: break-word;">${value}</td>
                </tr>
            `;
        }
    }
    html += '</table>';
    if (!hasSystemProps) {
        html += '<p style="color: #999; font-size: 12px; margin: 5px 0;">시스템 속성이 없습니다</p>';
    }
    html += '</div>';

    // Parameters 표시
    if (bimData.Parameters && Object.keys(bimData.Parameters).length > 0) {
        html += '<div style="margin-bottom: 15px;">';
        html += '<div style="font-weight: bold; color: #555; margin-bottom: 5px; font-size: 14px; border-bottom: 2px solid #4caf50; padding-bottom: 4px;">Parameters</div>';

        html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
        const sortedParams = Object.entries(bimData.Parameters).sort((a, b) => a[0].localeCompare(b[0]));
        sortedParams.forEach(([key, value]) => {
            const displayValue = value !== null && value !== undefined ? String(value) : '-';
            html += `
                <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 8px 10px; font-weight: 600; color: #388e3c; font-family: monospace; width: 40%; background: #f5f5f5; vertical-align: top;">{Parameters.${key}}</td>
                    <td style="padding: 8px 10px; color: #666; width: 60%; word-break: break-word;">${displayValue}</td>
                </tr>
            `;
        });
        html += '</table>';
        html += '</div>';
    }

    // TypeParameters 표시
    if (bimData.TypeParameters && Object.keys(bimData.TypeParameters).length > 0) {
        html += '<div style="margin-bottom: 15px;">';
        html += '<div style="font-weight: bold; color: #555; margin-bottom: 5px; font-size: 14px; border-bottom: 2px solid #ff9800; padding-bottom: 4px;">TypeParameters</div>';

        html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
        const sortedTypeParams = Object.entries(bimData.TypeParameters).sort((a, b) => a[0].localeCompare(b[0]));
        sortedTypeParams.forEach(([key, value]) => {
            const displayValue = value !== null && value !== undefined ? String(value) : '-';
            html += `
                <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 8px 10px; font-weight: 600; color: #f57c00; font-family: monospace; width: 40%; background: #f5f5f5; vertical-align: top;">{TypeParameters.${key}}</td>
                    <td style="padding: 8px 10px; color: #666; width: 60%; word-break: break-word;">${displayValue}</td>
                </tr>
            `;
        });
        html += '</table>';
        html += '</div>';
    }

    // 아무 속성도 없을 경우
    if (!hasSystemProps &&
        (!bimData.Parameters || Object.keys(bimData.Parameters).length === 0) &&
        (!bimData.TypeParameters || Object.keys(bimData.TypeParameters).length === 0)) {
        html += '<p style="color: #999; text-align: center; padding: 20px;">이 객체에는 표시할 속성이 없습니다.</p>';
        console.log('[DEBUG] No properties found in element:', bimData);
    }

    helperContainer.innerHTML = html;
}
