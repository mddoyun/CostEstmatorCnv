
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
        .getElementById('get-from-3d-viewer-btn')
        ?.addEventListener('click', getSelectionFrom3DViewer);
    document
        .getElementById('select-in-3d-viewer-btn')
        ?.addEventListener('click', selectIn3DViewer);
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
        .getElementById('apply-grouping-btn')
        ?.addEventListener('click', () =>
            renderDataTable(
                'data-management-data-table-container',
                'data-management'
            )
        ); // 그룹핑 적용 버튼 클릭 시 렌더
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
    document
        .getElementById('apply-filter-btn')
        ?.addEventListener('click', () => {
            console.log('[DEBUG] apply-filter-btn clicked');
            applyTableFilter('data-management');
        });
    document
        .getElementById('clear-filter-btn')
        ?.addEventListener('click', () => {
            console.log('[DEBUG] clear-filter-btn clicked');
            clearTableFilter('data-management');
        });
    document
        .getElementById('dm-clear-selection-btn')
        ?.addEventListener('click', clearDmSelection);
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
    const leftPanelTabs = document.querySelector('#data-management .left-panel-tabs');
    if (leftPanelTabs) {
        // 이벤트 리스너 등록
        leftPanelTabs.addEventListener('click', handleDataMgmtLeftPanelTabClick);

        // 버튼에 직접 리스너도 추가해서 테스트
        const tabButtons = leftPanelTabs.querySelectorAll('.left-panel-tab-button');
        tabButtons.forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                try {
                    handleDataMgmtLeftPanelTabClick(e);
                } catch (error) {
                }
            });
        });
    } else {
    }
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

    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
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

    // 입력만 받고 렌더링하지 않음 (필터 적용 버튼 클릭 시 렌더링)
    // debouncedRender(contextPrefix)();
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
        // Shift+클릭: 범위 선택
        const start = Math.min(state.lastSelectedRowIndex, clickedRowIndex);
        const end = Math.max(state.lastSelectedRowIndex, clickedRowIndex);
        if (!event.ctrlKey) state.selectedElementIds.clear();
        for (let i = start; i <= end; i++) {
            const rowId = allVisibleRows[i]?.dataset.dbId;
            if (rowId) state.selectedElementIds.add(rowId);
        }
    } else {
        // 단순 클릭: 토글 (Activity Objects 방식)
        if (state.selectedElementIds.has(elementDbId)) {
            state.selectedElementIds.delete(elementDbId);
        } else {
            state.selectedElementIds.add(elementDbId);
        }
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
        <select class="group-by-select"></select>
        <button class="remove-group-level-btn">✕</button>
    `;
    container.appendChild(newLevelDiv);
    populateFieldSelection(); // 필드 목록 채우기

    newLevelDiv
        .querySelector('.remove-group-level-btn')
        .addEventListener('click', function () {
            this.parentElement.remove();
        });
}

function handleDataMgmtLeftPanelTabClick(event) {

    const clickedButton = event.target.closest('.left-panel-tab-button');

    if (!clickedButton) {
        return;
    }

    if (clickedButton.classList.contains('active')) {
        return;
    }

    const tabContainer = clickedButton.closest('.left-panel-tab-container');
    const targetTabId = clickedButton.dataset.tab;


    // 현재 활성화된 탭과 콘텐츠를 비활성화
    const activeButton = tabContainer.querySelector('.left-panel-tab-button.active');
    const activeContent = tabContainer.querySelector('.left-panel-tab-content.active');

    if (activeButton) activeButton.classList.remove('active');
    if (activeContent) activeContent.classList.remove('active');

    // 클릭된 버튼과 그에 맞는 콘텐츠를 활성화
    clickedButton.classList.add('active');
    const targetContent = tabContainer.querySelector(`#${targetTabId}`);

    if (targetContent) {
        targetContent.classList.add('active');
    } else {
    }
}

/**
 * BIM 원본 데이터 탭에서 선택한 객체의 속성을 룰셋 작성 도우미 패널에 표시합니다.
 * 통일된 그룹핑 시스템을 사용하여 첫 번째 접두어(BIM)를 기준으로 표시합니다.
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
        helperContainer.innerHTML = `<p style="color: #999;">선택한 객체의 데이터를 찾을 수 없습니다. (ID: ${firstSelectedId})</p>`;
        return;
    }


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
        }
    }

    // ▼▼▼ [수정] 필드 선택과 동일하게 세부 그룹으로 나눠서 표시 (2025-11-05, 2025-11-06 확장) ▼▼▼
    // 속성을 세부 그룹별로 수집
    const propertyGroups = {
        'System': [],
        'Attributes': [],
        'Parameters': [],
        'TypeParameters': [],
        'QuantitySet': [],
        'TypeInfo': [],            // Type.Name, Type.IfcClass 등
        'TypeAttributes': [],      // Type.Attributes.* 추가 (2025-11-06)
        'TypePropertySet': [],     // Type.PropertySet.* 추가 (2025-11-06)
        'Other': []
    };

    // 시스템 속성 수집
    const systemProps = ['Category', 'Family', 'Type', 'Level', 'Id'];
    systemProps.forEach(key => {
        const value = bimData[key];
        if (value !== undefined && value !== null && value !== '') {
            propertyGroups['System'].push({
                displayKey: `{${key}}`,
                value: String(value)
            });
        }
    });

    // 나머지 속성을 그룹별로 분류
    Object.keys(bimData).forEach(topLevelKey => {
        // 시스템 속성이나 특수 필드는 건너뛰기
        if (systemProps.includes(topLevelKey) ||
            ['db_id', 'dbId', 'DB_ID', 'id', 'raw_data', 'geometry'].includes(topLevelKey)) {
            return;
        }

        const topLevelValue = bimData[topLevelKey];

        // Parameters 그룹
        if (topLevelKey === 'Parameters' && typeof topLevelValue === 'object' && !Array.isArray(topLevelValue)) {
            Object.entries(topLevelValue).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    propertyGroups['Parameters'].push({
                        displayKey: `{Parameters.${key}}`,
                        value: String(value)
                    });
                }
            });
        }
        // TypeParameters 그룹
        else if (topLevelKey === 'TypeParameters' && typeof topLevelValue === 'object' && !Array.isArray(topLevelValue)) {
            Object.entries(topLevelValue).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    propertyGroups['TypeParameters'].push({
                        displayKey: `{TypeParameters.${key}}`,
                        value: String(value)
                    });
                }
            });
        }
        // QuantitySet 그룹
        else if (topLevelKey.includes('QuantitySet') && typeof topLevelValue === 'object' && !Array.isArray(topLevelValue)) {
            Object.entries(topLevelValue).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    propertyGroups['QuantitySet'].push({
                        displayKey: `{${topLevelKey}.${key}}`,
                        value: String(value)
                    });
                }
            });
        }
        // ▼▼▼ [추가] Type 그룹 처리 (2025-11-06) ▼▼▼
        // Type 객체 처리 (Type.Name, Type.IfcClass, Type.Attributes.*, Type.PropertySet.*)
        else if (topLevelKey === 'Type' && typeof topLevelValue === 'object' && !Array.isArray(topLevelValue)) {
            Object.entries(topLevelValue).forEach(([typeKey, typeValue]) => {
                // Type.Attributes.* 그룹
                if (typeKey === 'Attributes' && typeof typeValue === 'object' && !Array.isArray(typeValue)) {
                    Object.entries(typeValue).forEach(([attrKey, attrValue]) => {
                        if (attrValue !== undefined && attrValue !== null) {
                            propertyGroups['TypeAttributes'].push({
                                displayKey: `{Type.Attributes.${attrKey}}`,
                                value: String(attrValue)
                            });
                        }
                    });
                }
                // Type.PropertySet.* 그룹
                else if (typeKey === 'PropertySet' && typeof typeValue === 'object' && !Array.isArray(typeValue)) {
                    Object.entries(typeValue).forEach(([propKey, propValue]) => {
                        if (propValue !== undefined && propValue !== null) {
                            propertyGroups['TypePropertySet'].push({
                                displayKey: `{Type.PropertySet.${propKey}}`,
                                value: String(propValue)
                            });
                        }
                    });
                }
                // Type.Name, Type.IfcClass 등 기본 정보
                else if (typeValue !== undefined && typeValue !== null) {
                    propertyGroups['TypeInfo'].push({
                        displayKey: `{Type.${typeKey}}`,
                        value: String(typeValue)
                    });
                }
            });
        }
        // ▲▲▲ [추가] 여기까지 ▲▲▲
        // Attributes 그룹 (기타 단순 속성들)
        else if (typeof topLevelValue !== 'object' || Array.isArray(topLevelValue)) {
            if (topLevelValue !== undefined && topLevelValue !== null) {
                propertyGroups['Attributes'].push({
                    displayKey: `{${topLevelKey}}`,
                    value: String(topLevelValue)
                });
            }
        }
        // 기타 객체형 속성
        else if (typeof topLevelValue === 'object' && !Array.isArray(topLevelValue)) {
            Object.entries(topLevelValue).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    propertyGroups['Other'].push({
                        displayKey: `{${topLevelKey}.${key}}`,
                        value: String(value)
                    });
                }
            });
        }
    });

    // 각 그룹별로 렌더링 (2025-11-06: Type 그룹 추가)
    const groupConfigs = [
        { key: 'System', title: '⚙️ 시스템 속성', color: '#1976d2' },
        { key: 'Attributes', title: '🏗️ 기본 속성', color: '#388e3c' },
        { key: 'Parameters', title: '🔧 Parameters', color: '#f57c00' },
        { key: 'TypeParameters', title: '📝 TypeParameters', color: '#7b1fa2' },
        { key: 'QuantitySet', title: '📏 QuantitySet', color: '#0288d1' },
        { key: 'TypeInfo', title: '🏷️ Type Info', color: '#c2185b' },              // 추가
        { key: 'TypeAttributes', title: '🔖 Type Attributes', color: '#e91e63' },   // 추가
        { key: 'TypePropertySet', title: '📋 Type PropertySet', color: '#ad1457' }, // 추가
        { key: 'Other', title: '📦 기타 속성', color: '#607d8b' }
    ];

    let hasAnyProperties = false;

    groupConfigs.forEach(config => {
        const properties = propertyGroups[config.key];
        if (properties && properties.length > 0) {
            hasAnyProperties = true;
            html += '<div style="margin-bottom: 15px;">';
            html += `<div style="font-weight: bold; color: #555; margin-bottom: 5px; font-size: 14px; border-bottom: 2px solid ${config.color}; padding-bottom: 4px;">${config.title}</div>`;

            html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';

            // 속성을 displayKey 기준으로 정렬하여 표시
            const sortedProperties = properties.sort((a, b) => a.displayKey.localeCompare(b.displayKey));

            sortedProperties.forEach(prop => {
                html += `
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 8px 10px; font-weight: 600; color: ${config.color}; font-family: monospace; width: 40%; background: #f5f5f5; vertical-align: top;">${prop.displayKey}</td>
                        <td style="padding: 8px 10px; color: #666; width: 60%; word-break: break-word;">${prop.value}</td>
                    </tr>
                `;
            });

            html += '</table>';
            html += '</div>';
        }
    });

    if (!hasAnyProperties) {
        html += '<p style="color: #999; text-align: center; padding: 20px;">이 객체에는 표시할 속성이 없습니다.</p>';
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    helperContainer.innerHTML = html;
}

/**
 * 필터를 적용하여 테이블을 다시 렌더링합니다.
 * @param {string} contextPrefix - 컨텍스트 접두사 (예: 'data-management')
 */
function applyTableFilter(contextPrefix) {
    console.log('[DEBUG] applyTableFilter called with contextPrefix:', contextPrefix);
    const state = viewerStates[contextPrefix];
    if (!state) {
        console.log('[DEBUG] state not found for contextPrefix:', contextPrefix);
        return;
    }

    // 테이블 컨테이너에서 모든 필터 입력 필드를 찾아서 값 수집
    const containerId = `${contextPrefix}-data-table-container`;
    const container = document.getElementById(containerId);
    console.log('[DEBUG] container:', container);
    if (container) {
        const filterInputs = container.querySelectorAll('.column-filter');
        console.log('[DEBUG] filterInputs found:', filterInputs.length);
        filterInputs.forEach(input => {
            const field = input.dataset.field;
            const value = (input.value || '').toLowerCase();
            console.log('[DEBUG] field:', field, 'value:', value);
            if (value) {
                state.columnFilters[field] = value;
            } else {
                delete state.columnFilters[field];
            }
        });
    }
    console.log('[DEBUG] state.columnFilters:', state.columnFilters);

    renderDataTable(containerId, contextPrefix);
    showToast('필터가 적용되었습니다.', 'success');
}

/**
 * 모든 필터를 초기화하고 테이블을 다시 렌더링합니다.
 * @param {string} contextPrefix - 컨텍스트 접두사 (예: 'data-management')
 */
function clearTableFilter(contextPrefix) {
    const state = viewerStates[contextPrefix];
    if (!state) return;

    // 모든 필터값 초기화
    state.columnFilters = {};

    // 테이블 컨테이너에서 모든 필터 입력 필드를 찾아서 값 초기화
    const containerId = `${contextPrefix}-data-table-container`;
    const container = document.getElementById(containerId);
    if (container) {
        const filterInputs = container.querySelectorAll('.column-filter');
        filterInputs.forEach(input => {
            input.value = '';
        });
    }

    // 테이블 다시 렌더링
    renderDataTable(containerId, contextPrefix);
    showToast('필터가 초기화되었습니다.', 'info');
}

// 3D 뷰포트에서 선택한 객체를 테이블에서 선택
function getSelectionFrom3DViewer() {

    // 3D 뷰어에서 선택된 객체 가져오기
    if (typeof window.getSelectedObjectsFrom3DViewer !== 'function') {
        showToast('3D 뷰어 기능을 사용할 수 없습니다.', 'error');
        return;
    }

    const selected3DObjects = window.getSelectedObjectsFrom3DViewer();
    if (!selected3DObjects || selected3DObjects.length === 0) {
        showToast('3D 뷰포트에서 선택된 객체가 없습니다.', 'warning');
        return;
    }


    const state = viewerStates['data-management'];
    if (!state) return;

    // 기존 선택 및 필터 초기화
    state.selectedElementIds.clear();
    state.revitFilteredIds.clear();

    // 3D에서 선택된 객체의 BIM ID 가져오기
    selected3DObjects.forEach(obj => {
        const bimObjectId = obj.userData.bimObjectId || obj.userData.rawElementId;
        if (bimObjectId) {
            state.selectedElementIds.add(bimObjectId);
            state.revitFilteredIds.add(bimObjectId); // 필터링용 ID도 저장
        }
    });


    // 필터 활성화 및 버튼 표시
    state.isFilterToSelectionActive = true;
    document.getElementById('clear-selection-filter-btn').style.display = 'inline-block';

    // 테이블 다시 렌더링
    renderDataTable('data-management-data-table-container', 'data-management');
    renderBimPropertiesTable('data-management');
    renderAssignedTagsTable('data-management');

    showToast(`3D 뷰포트에서 ${state.selectedElementIds.size}개 객체를 선택했습니다.`, 'success');
}

// 테이블에서 선택한 객체를 3D 뷰포트에서 선택
function selectIn3DViewer() {

    const state = viewerStates['data-management'];
    if (!state) return;

    if (state.selectedElementIds.size === 0) {
        showToast('테이블에서 먼저 항목을 선택하세요.', 'warning');
        return;
    }

    // 3D 뷰어에서 객체 선택 함수 호출
    if (typeof window.selectObjectsIn3DViewer !== 'function') {
        showToast('3D 뷰어 기능을 사용할 수 없습니다.', 'error');
        return;
    }

    const selectedIds = Array.from(state.selectedElementIds);

    window.selectObjectsIn3DViewer(selectedIds);

    showToast(`3D 뷰포트에서 ${selectedIds.length}개 객체를 선택했습니다.`, 'success');
}

// 선택 해제
function clearDmSelection() {
    const state = viewerStates['data-management'];
    if (!state) return;

    state.selectedElementIds.clear();

    // 현재 활성화된 뷰에 따라 테이블 다시 렌더링
    const containerId = 'data-management-data-table-container';
    renderDataTable(containerId, 'data-management');

    showToast('선택이 해제되었습니다.', 'success');
}
