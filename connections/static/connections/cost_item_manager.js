

// =====================================================================
// 산출항목(CostItem) 관리 관련 함수들
// =====================================================================

// 전역 변수 참조 (window 객체에서 실제 저장됨)
// loadedCostItems와 selectedCiIds는 window에 정의되어 있음
const getLoadedCostItems = () => window.loadedCostItems || [];
const getSelectedCiIds = () => window.selectedCiIds || new Set();

// 전역 변수 초기화
if (typeof window.ciGroupingLevels === 'undefined') {
    window.ciGroupingLevels = [];
}

// 현재 활성화된 뷰 추적
if (typeof window.activeCiView === 'undefined') {
    window.activeCiView = 'cost-item-view'; // 기본값
}

function setupCostItemsListeners() {
    document
        .getElementById('create-ci-manual-btn')
        ?.addEventListener('click', createManualCostItem);
    document
        .getElementById('create-ci-auto-btn')
        ?.addEventListener('click', () => createAutoCostItems(false)); // 확인창 표시
    document
        .getElementById('add-ci-group-level-btn')
        ?.addEventListener('click', addCiGroupingLevel);
    const ciTableContainer = document.getElementById('ci-table-container');
    if (ciTableContainer) {
        ciTableContainer.addEventListener('click', handleCostItemActions); // 수정, 삭제, 저장, 취소, 행 선택, 그룹 토글 위임
        ciTableContainer.addEventListener('keyup', handleCiColumnFilter); // 필터
    }

    // 좌측 패널 탭 (필드선택, 산출항목 속성, 할당 정보)
    document
        .querySelector('#cost-item-management .left-panel-tabs')
        ?.addEventListener('click', handleCiLeftPanelTabClick);

    // BIM 저작도구 연동 버튼
    document
        .getElementById('ci-get-from-client-btn')
        ?.addEventListener('click', getCiSelectionFromClient);
    document
        .getElementById('ci-select-in-client-btn')
        ?.addEventListener('click', selectCiInClient);

    // 3D 뷰어 연동 버튼
    document
        .getElementById('ci-get-from-3d-viewer-btn')
        ?.addEventListener('click', getCiSelectionFrom3DViewer);
    document
        .getElementById('ci-select-in-3d-viewer-btn')
        ?.addEventListener('click', selectCiIn3DViewer);

    // 필드 선택 버튼들
    document
        .getElementById('ci-select-all-fields-btn')
        ?.addEventListener('click', () => toggleAllCiFields(true));
    document
        .getElementById('ci-deselect-all-fields-btn')
        ?.addEventListener('click', () => toggleAllCiFields(false));
    document
        .getElementById('ci-render-table-btn')
        ?.addEventListener('click', applyCiFieldSelection);

    // 그룹핑 적용 버튼
    document
        .getElementById('apply-ci-grouping-btn')
        ?.addEventListener('click', applyCiGrouping);

    // 필터 버튼들
    document
        .getElementById('apply-ci-filter-btn')
        ?.addEventListener('click', applyCiFilters);
    document
        .getElementById('clear-ci-filter-btn')
        ?.addEventListener('click', clearCiFilters);

    // 선택 필터 해제 버튼 (사이드바와 footer 모두)
    document
        .getElementById('ci-clear-selection-filter-btn')
        ?.addEventListener('click', clearCiSelectionFilter);
    document
        .getElementById('ci-clear-selection-filter-btn-footer')
        ?.addEventListener('click', clearCiSelectionFilter);

    // 룰셋수량계산 버튼 (전체)
    document
        .getElementById('ci-apply-quantity-rules-btn')
        ?.addEventListener('click', () => applyCostItemQuantityRules(false));

    // 룰셋수량계산 버튼 (선택)
    document
        .getElementById('ci-apply-quantity-rules-selected-btn')
        ?.addEventListener('click', () => applyCostItemQuantityRules(true));

    // 수동 수량입력 버튼
    document
        .getElementById('ci-manual-quantity-input-btn')
        ?.addEventListener('click', showManualQuantityInputModal);

    // 액티비티 할당 버튼들
    document
        .getElementById('ci-assign-activity-btn')
        ?.addEventListener('click', assignActivityToCi);
    document
        .getElementById('ci-clear-activities-btn')
        ?.addEventListener('click', clearActivitiesFromCi);

    // 액티비티 룰셋 적용 버튼
    document
        .getElementById('ci-apply-activity-rules-btn')
        ?.addEventListener('click', applyCiActivityRules);

    // 액티비티 콤보박스 클릭 시 최신 목록 로드
    document
        .getElementById('ci-activity-assign-select')
        ?.addEventListener('focus', loadActivitiesForCombobox);

    // 뷰 탭 전환 (코스트아이템 뷰 / 액티비티별 뷰)
    document
        .querySelector('#cost-item-management .view-tabs')
        ?.addEventListener('click', handleCiViewTabClick);

    // 스플릿바 초기화
    initCiSplitBar();

    console.log('[DEBUG] Cost Items listeners setup complete.');
}

async function loadCostItems() {
    if (!currentProjectId) {
        renderCostItemsTable([]);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/cost-items/${currentProjectId}/
`
        );
        if (!response.ok)
            throw new Error('산출항목 목록을 불러오는데 실패했습니다.');

        // ▼▼▼ [수정] is_active=true인 CostItem만 로드 (분할된 경우 원본 숨김) ▼▼▼
        const allItems = await response.json();
        window.loadedCostItems = allItems.filter(ci => ci.is_active !== false);
        console.log(`[Cost Item Manager] Loaded ${window.loadedCostItems.length} active CostItems (filtered ${allItems.length - window.loadedCostItems.length} inactive)`);
        renderCostItemsTable(window.loadedCostItems);

        populateCiFieldSelection(window.loadedCostItems);
    } catch (error) {
        console.error('Error loading cost items:', error);
        showToast(error.message, 'error');
    }
}

async function createManualCostItem() {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }

    try {
        const selectedCostCodeId = await openCostCodeSelectionModal();

        const response = await fetch(
            `/connections/api/cost-items/${currentProjectId}/
`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({ cost_code_id: selectedCostCodeId }),
            }
        );

        const result = await response.json();
        if (!response.ok)
            throw new Error(result.message || '산출항목 생성에 실패했습니다.');

        showToast(result.message, 'success');
        await loadCostItems();
    } catch (error) {
        if (error) {
            console.error('Error creating manual cost item:', error);
            showToast(error.message, 'error');
        } else {
            showToast('산출항목 생성이 취소되었습니다.', 'info');
        }
    }
}

async function createAutoCostItems(skipConfirmation = false) {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }

    if (
        !skipConfirmation &&
        !confirm(
            '정말로 모든 산출항목을 자동으로 다시 생성하시겠습니까?\n이 작업은 기존 자동생성된 항목을 삭제하고, 현재의 수량산출룰셋 기준으로 새로 생성합니다.'
        )
    ) {
        return;
    }

    showToast('산출항목을 자동으로 생성하고 있습니다...', 'info', 5000);
    try {
        const response = await fetch(
            `/connections/api/cost-items/auto-create/${currentProjectId}/
`,
            {
                method: 'POST',
                headers: { 'X-CSRFToken': csrftoken },
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');
        await loadCostItems();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function handleCiRowSelection(event, clickedRow) {
    const tableContainer = document.getElementById('ci-table-container');
    const allVisibleRows = Array.from(
        tableContainer.querySelectorAll('tr[data-id]')
    );
    const clickedRowIndex = allVisibleRows.findIndex(
        (r) => r.dataset.id === clickedRow.dataset.id
    );
    const itemId = clickedRow.dataset.id;
    if (!itemId) return;

    if (event.shiftKey && lastSelectedCiRowIndex > -1) {
        // Shift+클릭: 범위 선택
        const start = Math.min(lastSelectedCiRowIndex, clickedRowIndex);
        const end = Math.max(lastSelectedCiRowIndex, clickedRowIndex);
        if (!event.ctrlKey) selectedCiIds.clear();
        for (let i = start; i <= end; i++) {
            const rowId = allVisibleRows[i].dataset.id;
            if (rowId) selectedCiIds.add(rowId);
        }
    } else {
        // 단순 클릭: 토글 (Activity Objects 방식)
        if (selectedCiIds.has(itemId)) {
            selectedCiIds.delete(itemId);
        } else {
            selectedCiIds.add(itemId);
        }
    }

    lastSelectedCiRowIndex = clickedRowIndex;

    allVisibleRows.forEach((row) => {
        if (selectedCiIds.has(row.dataset.id)) row.classList.add('selected-row');
        else row.classList.remove('selected-row');
    });

    // 속성 패널 업데이트
    renderCiSelectedProperties();
    renderCiAssignedInfo();
}

function handleCostItemActions(event) {
    const target = event.target;

    // 그룹 헤더 토글 (toggle-icon 클릭 또는 group-header 행 클릭)
    // 단, 버튼이나 입력 필드를 클릭한 경우는 제외
    const groupHeader = target.closest('.group-header');
    if (groupHeader && target.tagName !== 'BUTTON' && !target.closest('button') && target.tagName !== 'INPUT') {
        const groupPath = groupHeader.dataset.groupPath;
        ciCollapsedGroups[groupPath] = !ciCollapsedGroups[groupPath];
        renderCostItemsTable(window.loadedCostItems);
        return;
    }

    // 행 선택 (버튼 클릭이 아닌 경우에만)
    const row = target.closest('tr[data-id]');
    if (row && target.tagName !== 'BUTTON' && !target.closest('button')) {
        handleCiRowSelection(event, row);
        return;
    }

    // 수동입력 해제 버튼
    if (target.classList.contains('reset-manual-quantity-btn')) {
        const itemId = target.dataset.id;
        const item = window.loadedCostItems?.find(ci => ci.id === itemId);

        if (!item) {
            showToast('산출항목을 찾을 수 없습니다.', 'error');
            return;
        }

        if (!confirm('수동 입력을 해제하고 룰셋 기반 계산으로 돌아가시겠습니까?')) return;

        fetch(`/connections/api/cost-items/${currentProjectId}/${itemId}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken,
            },
            body: JSON.stringify({
                quantity_mapping_expression: {},
                is_manual_quantity: false  // 수동 입력 해제
            }),
        })
        .then(res => {
            if (!res.ok) {
                return res.text().then(text => {
                    console.error('[ERROR] PATCH failed:', res.status, text);
                    throw new Error(`서버 오류 (${res.status}): ${text.substring(0, 100)}`);
                });
            }
            return res.json();
        })
        .then(result => {
            if (result.status === 'success') {
                showToast('수동 입력이 해제되었습니다. 룰셋을 다시 실행하세요.', 'success');
                loadCostItems();
            } else {
                throw new Error(result.message);
            }
        })
        .catch(error => {
            console.error('[ERROR] reset-manual-quantity-btn:', error);
            showToast(error.message, 'error');
        });
        return;
    }

    // 수정 버튼 (class 또는 id)
    if (target.classList.contains('edit-ci-btn') || target.id === 'ci-edit-btn') {
        const itemId = target.dataset.id;
        if (!itemId) {
            showToast('항목 ID를 찾을 수 없습니다.', 'error');
            return;
        }
        // 테이블을 편집 모드로 재렌더링
        renderCostItemsTable(window.loadedCostItems, itemId);
        return;
    }

    // 저장 버튼 (class 또는 id)
    if (target.classList.contains('save-ci-btn') || target.id === 'ci-save-btn') {
        const row = target.closest('tr');
        const itemId = row.dataset.id;

        // 편집 가능한 필드에서 값 수집 (description만)
        const updateData = {};

        // description 필드
        const descInput = row.querySelector('textarea[data-field="description"]');
        if (descInput) {
            updateData.description = descInput.value.trim();
        }

        fetch(`/connections/api/cost-items/${currentProjectId}/${itemId}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken,
            },
            body: JSON.stringify(updateData),
        })
            .then((res) => res.json())
            .then((result) => {
                if (result.status === 'success') {
                    showToast('산출항목이 저장되었습니다.', 'success');
                    loadCostItems();
                } else {
                    throw new Error(result.message);
                }
            })
            .catch((error) => {
                showToast(error.message, 'error');
            });
        return;
    }

    // 취소 버튼 (class 또는 id)
    if (target.classList.contains('cancel-ci-btn') || target.id === 'ci-cancel-btn') {
        // 테이블을 일반 모드로 재렌더링
        renderCostItemsTable(window.loadedCostItems);
        return;
    }

    // 삭제 버튼 (class 또는 id)
    if (target.classList.contains('delete-ci-btn') || target.id === 'ci-delete-btn') {
        const row = target.closest('tr');
        const itemId = row.dataset.id;

        if (!confirm('정말로 이 산출항목을 삭제하시겠습니까?')) return;

        fetch(`/connections/api/cost-items/${currentProjectId}/${itemId}/
`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': csrftoken },
        })
            .then((res) => res.json())
            .then((result) => {
                if (result.status === 'success') {
                    showToast('산출항목이 삭제되었습니다.', 'success');
                    loadCostItems();
                } else {
                    throw new Error(result.message);
                }
            })
            .catch((error) => {
                showToast(error.message, 'error');
            });
        return;
    }
}

function addCiGroupingLevel() {
    const container = document.getElementById('ci-grouping-controls');
    const newLevelDiv = document.createElement('div');
    newLevelDiv.className = 'group-level';

    const select = document.createElement('select');
    select.className = 'group-by-select';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- 필드 선택 --';
    select.appendChild(defaultOption);

    // 필드 옵션 추가 - window.allCiFields에서 가져오기
    const fields = window.allCiFields || [];
    fields.forEach((field) => {
        const option = document.createElement('option');
        option.value = field.key;
        option.textContent = field.label;
        select.appendChild(option);
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-group-level-btn';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', function() {
        newLevelDiv.remove();
    });

    newLevelDiv.appendChild(select);
    newLevelDiv.appendChild(removeBtn);
    container.appendChild(newLevelDiv);
}

function applyCiGrouping() {
    // 현재 활성화된 뷰에 따라 적절한 렌더링 함수 호출
    if (window.activeCiView === 'activity-view') {
        renderCostItemsByActivityView();
    } else {
        // cost-item-view
        renderCostItemsTable(window.loadedCostItems);
    }
}

function handleCiColumnFilter(event) {
    if (event.key !== 'Enter') return;
    const target = event.target;
    if (!target.classList.contains('ci-filter-input')) return;

    if (!window.ciColumnFilters) {
        window.ciColumnFilters = {};
    }

    const field = target.dataset.field;
    const value = target.value.trim();

    if (value) {
        window.ciColumnFilters[field] = value.toLowerCase();
    } else {
        delete window.ciColumnFilters[field];
    }

    console.log('[DEBUG] CI filter (Enter):', field, '=', value);
    renderCostItemsTable(window.loadedCostItems);
}

/**
 * 공사코드 선택 모달 열기 (Promise 반환)
 */
function openCostCodeSelectionModal() {
    return new Promise(async (resolve, reject) => {
        if (!loadedCostCodes || loadedCostCodes.length === 0) {
            showToast('공사코드를 먼저 불러오세요.', 'error');
            reject(new Error('No cost codes loaded'));
            return;
        }

        const modalHtml = `
            <div class="modal-overlay" id="cost-code-modal">
                <div class="modal-content" style="width: 600px; max-height: 80vh;">
                    <h3>공사코드 선택</h3>
                    <input type="text" id="cost-code-search" placeholder="검색 (코드 또는 이름)" style="width: 100%; margin-bottom: 10px; padding: 6px;">
                    <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd;">
                        <table class="ruleset-table" style="width: 100%;">
                            <thead>
                                <tr>
                                    <th style="width: 120px;">코드</th>
                                    <th>이름</th>
                                    <th style="width: 80px;">선택</th>
                                </tr>
                            </thead>
                            <tbody id="cost-code-list-tbody"></tbody>
                        </table>
                    </div>
                    <div class="modal-actions">
                        <button id="cost-code-modal-cancel">취소</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('cost-code-modal');
        const tbody = document.getElementById('cost-code-list-tbody');
        const searchInput = document.getElementById('cost-code-search');

        const renderCostCodeList = (filterText = '') => {
            const filtered = filterText
                ? loadedCostCodes.filter(
                      (cc) =>
                          cc.code.toLowerCase().includes(filterText.toLowerCase()) ||
                          cc.name.toLowerCase().includes(filterText.toLowerCase())
                  )
                : loadedCostCodes;

            tbody.innerHTML = '';
            filtered.forEach((cc) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${cc.code}</td>
                    <td>${cc.name}</td>
                    <td><button class="select-cost-code-btn" data-id="${cc.id}">선택</button></td>
                `;
                tbody.appendChild(row);
            });
        };

        renderCostCodeList();

        searchInput.addEventListener('input', (e) => {
            renderCostCodeList(e.target.value.trim());
        });

        tbody.addEventListener('click', (e) => {
            if (e.target.classList.contains('select-cost-code-btn')) {
                const costCodeId = e.target.dataset.id;
                modal.remove();
                resolve(costCodeId);
            }
        });

        document.getElementById('cost-code-modal-cancel').addEventListener('click', () => {
            modal.remove();
            reject();
        });

        modal.addEventListener('click', (e) => {
            if (e.target.id === 'cost-code-modal') {
                modal.remove();
                reject();
            }
        });
    });
}

/**
 * 룰셋 작성 도우미 패널 업데이트 (기존 함수 유지)
 */
function updateCiRulesetHelperPanel() {
    const panel = document.getElementById('ci-ruleset-properties-content');
    if (!panel) return;

    if (selectedCiIds.size !== 1) {
        panel.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">산출항목을 하나만 선택해주세요.</p>';
        return;
    }

    const selectedId = selectedCiIds.values().next().value;
    const item = loadedCostItems.find((ci) => ci.id.toString() === selectedId);
    if (!item) {
        panel.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">선택된 항목의 정보를 찾을 수 없습니다.</p>';
        return;
    }

    let html = '<div style="font-size: 12px; line-height: 1.8;">';
    html += '<p style="font-weight: bold; color: #333; margin-bottom: 10px;">💡 아래 속성명을 복사하여 룰셋 조건에 활용하세요.</p>';

    // CostItem 자체 속성
    html += '<div style="margin-bottom: 15px;">';
    html += '<h5 style="color: #0288d1; border-bottom: 1px solid #0288d1; padding-bottom: 3px;">📦 CostItem 속성</h5>';
    html += '<div style="padding: 5px; background: #f9f9f9; border-radius: 3px;">';
    if (item.quantity !== undefined) {
        html += `<div><code style="background: #e3f2fd; padding: 2px 6px; border-radius: 3px;">quantity</code> = ${item.quantity}</div>`;
    }
    if (item.cost_code_name) {
        html += `<div><code style="background: #e3f2fd; padding: 2px 6px; border-radius: 3px;">cost_code_name</code> = ${item.cost_code_name}</div>`;
    }
    if (item.description) {
        html += `<div><code style="background: #e3f2fd; padding: 2px 6px; border-radius: 3px;">description</code> = ${item.description}</div>`;
    }
    html += '</div>';
    html += '</div>';

    // QM 속성
    if (item.quantity_member_properties && Object.keys(item.quantity_member_properties).length > 0) {
        html += '<div style="margin-bottom: 15px;">';
        html += '<h5 style="color: #f57c00; border-bottom: 1px solid #f57c00; padding-bottom: 3px;">🔢 QM 속성 (QuantityMember)</h5>';
        html += '<div style="padding: 5px; background: #f9f9f9; border-radius: 3px;">';
        Object.entries(item.quantity_member_properties).forEach(([key, value]) => {
            html += `<div><code style="background: #fff3e0; padding: 2px 6px; border-radius: 3px;">QM.properties.${key}</code> = ${value}</div>`;
        });
        html += '</div>';
        html += '</div>';
    }

    // MM 속성
    if (item.member_mark_properties && Object.keys(item.member_mark_properties).length > 0) {
        html += '<div style="margin-bottom: 15px;">';
        html += '<h5 style="color: #7b1fa2; border-bottom: 1px solid #7b1fa2; padding-bottom: 3px;">📋 MM 속성 (MemberMark)</h5>';
        html += '<div style="padding: 5px; background: #f9f9f9; border-radius: 3px;">';
        Object.entries(item.member_mark_properties).forEach(([key, value]) => {
            html += `<div><code style="background: #f3e5f5; padding: 2px 6px; border-radius: 3px;">MM.properties.${key}</code> = ${value}</div>`;
        });
        html += '</div>';
        html += '</div>';
    }

    // RE 속성
    if (item.raw_element_properties && Object.keys(item.raw_element_properties).length > 0) {
        html += '<div style="margin-bottom: 15px;">';
        html += '<h5 style="color: #d32f2f; border-bottom: 1px solid #d32f2f; padding-bottom: 3px;">🏗️ RE 속성 (RawElement)</h5>';
        html += '<div style="padding: 5px; background: #f9f9f9; border-radius: 3px;">';
        const reProps = item.raw_element_properties;
        Object.keys(reProps).slice(0, 20).forEach((key) => {
            const value = reProps[key];
            const displayValue = typeof value === 'object' ? JSON.stringify(value).substring(0, 50) : String(value).substring(0, 50);
            html += `<div><code style="background: #ffebee; padding: 2px 6px; border-radius: 3px;">RE.${key}</code> = ${displayValue}</div>`;
        });
        if (Object.keys(reProps).length > 20) {
            html += '<div style="color: #999; font-style: italic;">...외 ' + (Object.keys(reProps).length - 20) + '개</div>';
        }
        html += '</div>';
        html += '</div>';
    }

    html += '</div>';
    panel.innerHTML = html;
}

// =====================================================================
// 새로운 기능: 좌측 패널 탭 전환
// =====================================================================

/**
 * 좌측 패널 탭 클릭 핸들러
 */
function handleCiLeftPanelTabClick(e) {
    const tabButton = e.target.closest('.left-panel-tab-button');
    if (!tabButton) return;

    const tabName = tabButton.getAttribute('data-tab');

    // 모든 탭 버튼과 콘텐츠 비활성화
    document.querySelectorAll('#cost-item-management .left-panel-tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('#cost-item-management .left-panel-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // 클릭한 탭 활성화
    tabButton.classList.add('active');

    if (tabName === 'field-selection') {
        document.getElementById('ci-field-selection-content').classList.add('active');
    } else if (tabName === 'ci-properties') {
        document.getElementById('ci-properties-content').classList.add('active');
        renderCiSelectedProperties();
    } else if (tabName === 'assigned-info') {
        document.getElementById('ci-assigned-info-content').classList.add('active');
        renderCiAssignedInfo();
    }
}

// =====================================================================
// BIM 저작도구 연동 기능
// =====================================================================

/**
 * BIM 저작도구에서 선택 가져오기
 */
function getCiSelectionFromClient() {
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

/**
 * BIM 저작도구에서 선택 확인
 */
function selectCiInClient() {
    if (selectedCiIds.size === 0) {
        showToast(`테이블에서 ${currentMode === 'revit' ? 'Revit' : 'Blender'}으로 보낼 항목을 먼저 선택하세요.`, 'error');
        return;
    }

    // 선택된 산출항목들의 raw_element_id를 수집
    // CostItem -> QuantityMember -> RawElement 경로로 찾기
    const uniqueIdsToSend = [];
    window.loadedCostItems
        .filter(ci => selectedCiIds.has(ci.id))
        .forEach(ci => {
            if (ci.quantity_member_id) {
                // loadedQuantityMembers에서 찾기
                const qm = window.loadedQuantityMembers?.find(m => m.id === ci.quantity_member_id);
                if (qm) {
                    const elementId = qm.split_element_id || qm.raw_element_id;
                    if (elementId) {
                        const rawElement = allRevitData.find(item => item.id === elementId);
                        if (rawElement && rawElement.element_unique_id) {
                            uniqueIdsToSend.push(rawElement.element_unique_id);
                        }
                    }
                }
            }
        });

    if (uniqueIdsToSend.length === 0) {
        showToast('선택한 산출항목에 연결된 원본 요소가 없습니다.', 'warning');
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

// =====================================================================
// 3D 뷰어 연동 기능
// =====================================================================

/**
 * 3D 뷰어에서 선택 가져오기
 */
function getCiSelectionFrom3DViewer() {
    console.log('[DEBUG][CI] Getting selection from 3D viewer');

    if (typeof window.getSelectedObjectsFrom3DViewer !== 'function') {
        showToast('3D 뷰어 기능을 사용할 수 없습니다.', 'error');
        return;
    }

    const selected3DObjects = window.getSelectedObjectsFrom3DViewer();
    if (!selected3DObjects || selected3DObjects.length === 0) {
        showToast('3D 뷰포트에서 선택된 객체가 없습니다.', 'warning');
        return;
    }

    console.log(`[DEBUG][CI] Found ${selected3DObjects.length} selected objects in 3D viewer`);

    // 3D에서 선택된 객체의 BIM ID 수집
    const selectedBimIds = new Set();
    selected3DObjects.forEach(obj => {
        const bimObjectId = obj.userData.bimObjectId || obj.userData.rawElementId;
        if (bimObjectId) {
            selectedBimIds.add(bimObjectId);
        }
    });

    // 기존 선택 및 필터 초기화
    selectedCiIds.clear();
    if (!window.ciFilteredIds) {
        window.ciFilteredIds = new Set();
    }
    window.ciFilteredIds.clear();

    // 해당 BIM ID를 포함하는 CostItem 찾기
    // CostItem -> QuantityMember -> RawElement 경로로 매칭
    window.loadedCostItems.forEach(ci => {
        if (ci.quantity_member_id) {
            const qm = window.loadedQuantityMembers?.find(m => m.id === ci.quantity_member_id);
            if (qm) {
                const elementId = qm.split_element_id || qm.raw_element_id;
                if (elementId && selectedBimIds.has(elementId)) {
                    selectedCiIds.add(ci.id);
                    window.ciFilteredIds.add(ci.id); // 필터링용 ID도 저장
                }
            }
        }
    });

    console.log(`[DEBUG][CI] Selected ${selectedCiIds.size} cost items from 3D viewer`);

    // 필터 활성화 및 버튼 표시 (사이드바 버튼과 테이블 하단 버튼 모두)
    window.isCiFilterToSelectionActive = true;
    const clearBtnSidebar = document.getElementById('ci-clear-selection-filter-btn');
    const clearBtnFooter = document.getElementById('ci-clear-selection-filter-btn-footer');

    if (clearBtnSidebar) {
        clearBtnSidebar.style.display = 'inline-block';
    }
    if (clearBtnFooter) {
        clearBtnFooter.style.display = 'inline-block';
        console.log('[DEBUG][CI] Footer clear filter button displayed');
    }

    // 테이블 다시 렌더링 (필터링 적용됨)
    renderCostItemsTable(window.loadedCostItems);

    showToast(`3D 뷰포트에서 ${selectedCiIds.size}개 산출항목을 선택했습니다.`, 'success');
}

/**
 * 3D 뷰어에서 선택 확인
 */
function selectCiIn3DViewer() {
    console.log('[DEBUG][CI] Selecting objects in 3D viewer');
    console.log('[DEBUG][CI] selectedCiIds:', Array.from(selectedCiIds));

    if (selectedCiIds.size === 0) {
        showToast('테이블에서 먼저 항목을 선택하세요.', 'warning');
        return;
    }

    if (typeof window.selectObjectsIn3DViewer !== 'function') {
        showToast('3D 뷰어 기능을 사용할 수 없습니다.', 'error');
        return;
    }

    console.log('[DEBUG][CI] loadedCostItems count:', window.loadedCostItems?.length);

    // 선택된 산출항목들의 raw_element_id 또는 split_element_id를 수집
    // CostItem -> QuantityMember -> RawElement 경로
    const bimIdsToSelect = [];
    const selectedCIs = window.loadedCostItems.filter(ci => selectedCiIds.has(ci.id));
    console.log('[DEBUG][CI] Found matching CIs:', selectedCIs.length);

    selectedCIs.forEach(ci => {
        if (ci.quantity_member_id) {
            const qm = window.loadedQuantityMembers?.find(m => m.id === ci.quantity_member_id);
            if (qm) {
                const elementId = qm.split_element_id || qm.raw_element_id;
                console.log('[DEBUG][CI] CI:', ci.id, 'QM:', qm.id, 'raw_element_id:', qm.raw_element_id, 'split_element_id:', qm.split_element_id, 'using:', elementId);
                if (elementId) {
                    bimIdsToSelect.push(elementId);
                }
            }
        }
    });

    console.log('[DEBUG][CI] BIM IDs to select:', bimIdsToSelect);

    if (bimIdsToSelect.length === 0) {
        showToast('선택한 산출항목에 연결된 원본 요소가 없습니다.', 'warning');
        return;
    }

    console.log(`[DEBUG][CI] Calling window.selectObjectsIn3DViewer with ${bimIdsToSelect.length} IDs`);
    window.selectObjectsIn3DViewer(bimIdsToSelect);

    showToast(`3D 뷰포트에서 ${bimIdsToSelect.length}개 객체를 선택했습니다.`, 'success');
}

// =====================================================================
// 필드 선택 기능
// =====================================================================

/**
 * 필드 체크박스 전체 선택/해제
 */
function toggleAllCiFields(selectAll) {
    const checkboxes = document.querySelectorAll('#ci-field-checkboxes-container input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll;
    });
}

/**
 * 필드 선택 적용 (테이블 재렌더링)
 */
function applyCiFieldSelection() {
    const container = document.getElementById('ci-field-checkboxes-container');
    const checkboxes = container?.querySelectorAll('input[type="checkbox"]:checked');

    if (!checkboxes || checkboxes.length === 0) {
        showToast('선택된 필드가 없습니다.', 'warning');
        return;
    }

    const selectedFields = Array.from(checkboxes).map(cb => cb.value);

    // 전역 변수에 저장 (필드 key만 저장)
    window.currentCiColumns = selectedFields;

    renderCostItemsTable(window.loadedCostItems);
    showToast(`${selectedFields.length}개 필드가 선택되었습니다.`, 'success');
}

/**
 * BIM 원본 속성 필드 수집 (코스트아이템에서 상속받은)
 * @returns {Array} BIM 필드 배열
 */
function collectBimFieldsFromCostItems() {
    const bimFields = [];
    const attributeFields = new Set();
    const parameterFields = new Set();
    const typeParameterFields = new Set();
    const systemFields = new Set();

    // allRevitData를 스캔하여 모든 필드 수집
    if (!allRevitData || allRevitData.length === 0) return [];

    allRevitData.forEach(item => {
        const rawData = item.raw_data;
        if (!rawData) return;

        // BIM.Parameters.* - 파라미터
        if (rawData.Parameters && typeof rawData.Parameters === 'object') {
            Object.keys(rawData.Parameters).forEach(key => {
                if (key !== 'Geometry') { // Geometry는 너무 큼
                    parameterFields.add(key);
                }
            });
        }

        // BIM.TypeParameters.* - 타입 파라미터
        if (rawData.TypeParameters && typeof rawData.TypeParameters === 'object') {
            Object.keys(rawData.TypeParameters).forEach(key => {
                typeParameterFields.add(key);
            });
        }

        // BIM 원본 데이터의 다른 모든 속성
        Object.keys(rawData).forEach(k => {
            if (k !== 'Parameters' && k !== 'TypeParameters' && typeof rawData[k] !== 'object') {
                attributeFields.add(k);
            }
        });
    });

    // BIM.System.* - 시스템 속성 (항상 추가)
    const sysProps = ['id', 'element_unique_id', 'geometry_volume', 'classification_tags'];
    sysProps.forEach(prop => {
        systemFields.add(prop);
    });

    // BIM.Attributes.* 필드 추가
    attributeFields.forEach(attr => {
        bimFields.push({
            key: `BIM.Attributes.${attr}`,
            label: `BIM.Attributes.${attr}`,
            section: 'BIM.Attributes',
            bimField: attr,
            bimType: 'attribute'
        });
    });

    // BIM.Parameters.* 필드 추가
    parameterFields.forEach(param => {
        bimFields.push({
            key: `BIM.Parameters.${param}`,
            label: `BIM.Parameters.${param}`,
            section: 'BIM.Parameters',
            bimField: param,
            bimType: 'parameter'
        });
    });

    // BIM.TypeParameters.* 필드 추가
    typeParameterFields.forEach(tparam => {
        bimFields.push({
            key: `BIM.TypeParameters.${tparam}`,
            label: `BIM.TypeParameters.${tparam}`,
            section: 'BIM.TypeParameters',
            bimField: tparam,
            bimType: 'typeparameter'
        });
    });

    // BIM.System.* 필드 추가
    systemFields.forEach(sys => {
        bimFields.push({
            key: `BIM.System.${sys}`,
            label: `BIM.System.${sys}`,
            section: 'BIM.System',
            bimField: sys,
            bimType: 'system'
        });
    });

    return bimFields;
}

/**
 * 일람부호 속성 필드 수집 (코스트아이템에서 상속받은)
 * @returns {Array} MM 필드 배열
 */
function collectMemberMarkFieldsFromCostItems() {
    const mmFields = [];
    const mmPropertyFields = new Set();

    // MM.mark 기본 필드
    let hasMemberMark = false;

    // 모든 수량산출부재의 member_mark_properties 데이터 분석
    if (window.loadedQuantityMembers) {
        window.loadedQuantityMembers.forEach(member => {
            if (!member.member_mark_properties) return;

            // 일람부호가 있는 부재가 하나라도 있으면
            if (member.member_mark_mark) {
                hasMemberMark = true;
            }

            // MM.properties.* - 일람부호 속성
            if (typeof member.member_mark_properties === 'object') {
                Object.keys(member.member_mark_properties).forEach(key => {
                    mmPropertyFields.add(key);
                });
            }
        });
    }

    // MM.mark 필드 추가 (일람부호가 할당된 부재가 있을 경우)
    if (hasMemberMark) {
        mmFields.push({
            key: 'member_mark_mark',
            label: 'MM.mark',
            section: 'MM'
        });
    }

    // MM.properties.* 필드 추가 (알파벳 순 정렬)
    const sortedProps = Array.from(mmPropertyFields).sort();
    sortedProps.forEach(prop => {
        mmFields.push({
            key: `MM.properties.${prop}`,
            label: `MM.properties.${prop}`,
            section: 'MM',
            mmProperty: prop
        });
    });

    return mmFields;
}

/**
 * 공간분류 필드 수집 (코스트아이템에서 상속받은)
 * @returns {Array} Space 필드 배열
 */
function collectSpaceFieldsFromCostItems() {
    const spaceFields = [];
    let hasSpace = false;

    // 모든 수량산출부재에서 공간분류가 있는지 확인
    if (window.loadedQuantityMembers) {
        window.loadedQuantityMembers.forEach(member => {
            if (member.space_name) {
                hasSpace = true;
            }
        });
    }

    // Space.name 필드 추가 (공간분류가 할당된 부재가 있을 경우)
    if (hasSpace) {
        spaceFields.push({
            key: 'space_name',
            label: 'Space.name',
            section: 'Space'
        });
    }

    return spaceFields;
}

/**
 * QM.properties.* 필드 수집 (코스트아이템에서 상속받은)
 * @returns {Array} QM.properties 필드 배열
 */
function collectQmPropertiesFieldsForCostItems() {
    const qmPropertiesFields = [];
    const propertyKeys = new Set();

    // 모든 수량산출부재의 properties 데이터 분석
    if (window.loadedQuantityMembers) {
        window.loadedQuantityMembers.forEach(member => {
            if (!member.properties || typeof member.properties !== 'object') return;

            // QM.properties.* - 수량산출부재 속성
            Object.keys(member.properties).forEach(key => {
                propertyKeys.add(key);
            });
        });
    }

    // QM.properties.* 필드 추가 (알파벳 순 정렬)
    const sortedProps = Array.from(propertyKeys).sort();
    sortedProps.forEach(prop => {
        qmPropertiesFields.push({
            key: `QM.properties.${prop}`,
            label: `QM.properties.${prop}`,
            section: 'QM.properties',
            qmProperty: prop
        });
    });

    return qmPropertiesFields;
}

/**
 * 필드 선택 체크박스 동적 생성 (상속 흐름: BIM → QM → CI)
 */
function populateCiFieldSelection(items) {
    const container = document.getElementById('ci-field-checkboxes-container');
    if (!container) return;

    // 코스트아이템의 기본 필드들
    const ciFields = [
        { key: 'id', label: 'CI.id', section: 'CI' },
        { key: 'description', label: 'CI.description', section: 'CI' },
        { key: 'quantity', label: 'CI.quantity', section: 'CI' },
        { key: 'quantity_mapping_expression', label: 'CI.quantity_mapping_expression', section: 'CI' }
    ];

    // 수량산출부재의 기본 필드들 (상속)
    const qmFields = [
        { key: 'quantity_member_id', label: 'QM.id', section: 'QM' },
        { key: 'quantity_member_name', label: 'QM.name', section: 'QM' },
        { key: 'quantity_member_classification', label: 'QM.classification_tag', section: 'QM' }
    ];

    // BIM 원본 속성 수집 - 모든 수량산출부재의 raw_element에서 속성 추출 (상속)
    const bimFields = collectBimFieldsFromCostItems();

    // 일람부호 속성 수집 - 모든 수량산출부재의 member_mark_properties에서 속성 추출 (상속)
    const mmFields = collectMemberMarkFieldsFromCostItems();

    // 공간분류 속성 수집 - 모든 수량산출부재의 space_name에서 속성 추출 (상속)
    const spaceFields = collectSpaceFieldsFromCostItems();

    // QM.properties 속성 수집 - 모든 수량산출부재의 properties에서 속성 추출 (상속)
    const qmPropertiesFields = collectQmPropertiesFieldsForCostItems();

    // 공사코드 필드 (코스트아이템 고유)
    const costCodeFields = [
        { key: 'cost_code_name', label: 'CostCode.name', section: 'CostCode' },
        { key: 'cost_code', label: 'CostCode.code', section: 'CostCode' },
        { key: 'cost_code_detail_code', label: 'CostCode.detail_code', section: 'CostCode' },
        { key: 'cost_code_unit', label: 'CostCode.unit', section: 'CostCode' },
        { key: 'cost_code_note', label: 'CostCode.note', section: 'CostCode' }
    ];

    // 현재 선택된 컬럼 (없으면 기본값)
    if (!window.currentCiColumns) {
        window.currentCiColumns = ciFields.map(f => f.key);
    }

    // 섹션별로 그룹화
    let html = '';

    // CI 섹션
    html += '<div class="field-section"><h4 style="color: #1976d2; margin: 10px 0 5px 0; font-size: 14px;">📊 산출항목 속성 (CI)</h4>';
    ciFields.forEach(field => {
        const isChecked = window.currentCiColumns.includes(field.key) ? 'checked' : '';
        html += `
            <label class="field-checkbox-label">
                <input
                    type="checkbox"
                    class="ci-field-checkbox"
                    value="${field.key}"
                    ${isChecked}
                >
                ${field.label}
            </label>
        `;
    });
    html += '</div>';

    // QM 섹션
    html += '<div class="field-section"><h4 style="color: #0288d1; margin: 10px 0 5px 0; font-size: 14px;">📌 수량산출부재 속성 (QM, 상속)</h4>';
    qmFields.forEach(field => {
        const isChecked = window.currentCiColumns.includes(field.key) ? 'checked' : '';
        html += `
            <label class="field-checkbox-label">
                <input
                    type="checkbox"
                    class="ci-field-checkbox"
                    value="${field.key}"
                    ${isChecked}
                >
                ${field.label}
            </label>
        `;
    });
    html += '</div>';

    // CostCode 섹션
    html += '<div class="field-section"><h4 style="color: #c62828; margin: 10px 0 5px 0; font-size: 14px;">💰 공사코드 속성 (CostCode)</h4>';
    costCodeFields.forEach(field => {
        const isChecked = window.currentCiColumns.includes(field.key) ? 'checked' : '';
        html += `
            <label class="field-checkbox-label">
                <input
                    type="checkbox"
                    class="ci-field-checkbox"
                    value="${field.key}"
                    ${isChecked}
                >
                ${field.label}
            </label>
        `;
    });
    html += '</div>';

    // BIM 섹션별로 분류
    const bimSections = {
        'BIM.Attributes': [],
        'BIM.Parameters': [],
        'BIM.TypeParameters': [],
        'BIM.System': []
    };

    bimFields.forEach(field => {
        if (bimSections[field.section]) {
            bimSections[field.section].push(field);
        }
    });

    // BIM.Attributes 섹션
    if (bimSections['BIM.Attributes'].length > 0) {
        html += '<div class="field-section"><h4 style="color: #d32f2f; margin: 10px 0 5px 0; font-size: 14px;">🏗️ BIM 기본 속성 (상속)</h4>';
        bimSections['BIM.Attributes'].forEach(field => {
            const isChecked = window.currentCiColumns.includes(field.key) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input
                        type="checkbox"
                        class="ci-field-checkbox"
                        value="${field.key}"
                        data-bim-type="${field.bimType}"
                        data-bim-field="${field.bimField}"
                        ${isChecked}
                    >
                    ${field.label}
                </label>
            `;
        });
        html += '</div>';
    }

    // BIM.Parameters 섹션
    if (bimSections['BIM.Parameters'].length > 0) {
        html += '<div class="field-section"><h4 style="color: #f57c00; margin: 10px 0 5px 0; font-size: 14px;">🔧 BIM 파라미터 (상속)</h4>';
        bimSections['BIM.Parameters'].forEach(field => {
            const isChecked = window.currentCiColumns.includes(field.key) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input
                        type="checkbox"
                        class="ci-field-checkbox"
                        value="${field.key}"
                        data-bim-type="${field.bimType}"
                        data-bim-field="${field.bimField}"
                        ${isChecked}
                    >
                    ${field.label}
                </label>
            `;
        });
        html += '</div>';
    }

    // BIM.TypeParameters 섹션
    if (bimSections['BIM.TypeParameters'].length > 0) {
        html += '<div class="field-section"><h4 style="color: #7b1fa2; margin: 10px 0 5px 0; font-size: 14px;">📝 BIM 타입 파라미터 (상속)</h4>';
        bimSections['BIM.TypeParameters'].forEach(field => {
            const isChecked = window.currentCiColumns.includes(field.key) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input
                        type="checkbox"
                        class="ci-field-checkbox"
                        value="${field.key}"
                        data-bim-type="${field.bimType}"
                        data-bim-field="${field.bimField}"
                        ${isChecked}
                    >
                    ${field.label}
                </label>
            `;
        });
        html += '</div>';
    }

    // BIM.System 섹션
    if (bimSections['BIM.System'].length > 0) {
        html += '<div class="field-section"><h4 style="color: #388e3c; margin: 10px 0 5px 0; font-size: 14px;">⚙️ BIM 시스템 속성 (상속)</h4>';
        bimSections['BIM.System'].forEach(field => {
            const isChecked = window.currentCiColumns.includes(field.key) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input
                        type="checkbox"
                        class="ci-field-checkbox"
                        value="${field.key}"
                        data-bim-type="${field.bimType}"
                        data-bim-field="${field.bimField}"
                        ${isChecked}
                    >
                    ${field.label}
                </label>
            `;
        });
        html += '</div>';
    }

    // MM (일람부호) 섹션
    if (mmFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #7b1fa2; margin: 10px 0 5px 0; font-size: 14px;">📋 일람부호 속성 (MM, 상속)</h4>';
        mmFields.forEach(field => {
            const isChecked = window.currentCiColumns.includes(field.key) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input
                        type="checkbox"
                        class="ci-field-checkbox"
                        value="${field.key}"
                        ${isChecked}
                    >
                    ${field.label}
                </label>
            `;
        });
        html += '</div>';
    }

    // Space (공간분류) 섹션
    if (spaceFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #388e3c; margin: 10px 0 5px 0; font-size: 14px;">📍 공간분류 (Space, 상속)</h4>';
        spaceFields.forEach(field => {
            const isChecked = window.currentCiColumns.includes(field.key) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input
                        type="checkbox"
                        class="ci-field-checkbox"
                        value="${field.key}"
                        ${isChecked}
                    >
                    ${field.label}
                </label>
            `;
        });
        html += '</div>';
    }

    // QM.properties 섹션
    if (qmPropertiesFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #ff6f00; margin: 10px 0 5px 0; font-size: 14px;">🔢 QM 속성 (QM.properties, 상속)</h4>';
        qmPropertiesFields.forEach(field => {
            const isChecked = window.currentCiColumns.includes(field.key) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input
                        type="checkbox"
                        class="ci-field-checkbox"
                        value="${field.key}"
                        data-qm-property="${field.qmProperty || ''}"
                        ${isChecked}
                    >
                    ${field.label}
                </label>
            `;
        });
        html += '</div>';
    }

    // 모든 필드를 전역 변수에 저장 (applyCiFieldSelection에서 사용)
    window.allCiFields = [
        ...ciFields,
        ...costCodeFields,
        ...qmFields,
        ...bimFields,
        ...mmFields,
        ...spaceFields,
        ...qmPropertiesFields
    ];
    console.log('[DEBUG][populateCiFieldSelection] allCiFields initialized with', window.allCiFields.length, 'fields');

    container.innerHTML = html;

    // 이벤트 리스너 추가
    container.querySelectorAll('.ci-field-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const checkedBoxes = container.querySelectorAll('.ci-field-checkbox:checked');
            window.currentCiColumns = Array.from(checkedBoxes).map(cb => cb.value);
            console.log('[Cost Item Manager] Updated currentCiColumns:', window.currentCiColumns);
            renderCostItemsTable(window.loadedCostItems);
        });
    });

    // 전체 선택/해제 버튼 이벤트 (이미 존재하는 경우 업데이트)
    const selectAllBtn = document.getElementById('ci-select-all-fields-btn');
    const deselectAllBtn = document.getElementById('ci-deselect-all-fields-btn');

    if (selectAllBtn) {
        selectAllBtn.onclick = () => {
            container.querySelectorAll('.ci-field-checkbox').forEach(cb => cb.checked = true);
            const checkedBoxes = container.querySelectorAll('.ci-field-checkbox:checked');
            window.currentCiColumns = Array.from(checkedBoxes).map(cb => cb.value);
            renderCostItemsTable(window.loadedCostItems);
        };
    }

    if (deselectAllBtn) {
        deselectAllBtn.onclick = () => {
            container.querySelectorAll('.ci-field-checkbox').forEach(cb => cb.checked = false);
            const checkedBoxes = container.querySelectorAll('.ci-field-checkbox:checked');
            window.currentCiColumns = Array.from(checkedBoxes).map(cb => cb.value);
            renderCostItemsTable(window.loadedCostItems);
        };
    }
}

// =====================================================================
// 산출항목 속성 표시
// =====================================================================

/**
 * 선택된 산출항목의 속성 표시 (수량산출부재의 모든 데이터를 단계적으로 상속하여 표시)
 * 상속 흐름: BIM원본데이터 → 수량산출부재 → 코스트아이템 → 액티비티
 */
function renderCiSelectedProperties() {
    const container = document.getElementById('ci-selected-properties-container');
    if (!container) return;

    if (selectedCiIds.size !== 1) {
        container.innerHTML = '<p>산출항목을 하나만 선택하세요.</p>';
        return;
    }

    const selectedId = selectedCiIds.values().next().value;
    const item = loadedCostItems.find(ci => ci.id.toString() === selectedId);

    if (!item) {
        container.innerHTML = '<p>선택된 산출항목 정보를 찾을 수 없습니다.</p>';
        return;
    }

    // 연관된 QuantityMember 찾기
    const member = item.quantity_member_id ? window.loadedQuantityMembers?.find(m => m.id === item.quantity_member_id) : null;

    let html = '';

    // ============ 1. CI 기본 속성 (코스트아이템 고유 속성) ============
    html += '<div class="property-section">';
    html += '<h4 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 5px;">📊 산출항목 기본 속성</h4>';
    html += '<table class="properties-table"><tbody>';
    html += `<tr><td class="prop-name">CI.id</td><td class="prop-value">${item.id || 'N/A'}</td></tr>`;
    if (item.quantity !== undefined) {
        html += `<tr><td class="prop-name">CI.quantity</td><td class="prop-value">${item.quantity}</td></tr>`;
    }
    if (item.cost_code_name) {
        html += `<tr><td class="prop-name">CI.cost_code_name</td><td class="prop-value">${item.cost_code_name}</td></tr>`;
    }
    if (item.description) {
        html += `<tr><td class="prop-name">CI.description</td><td class="prop-value">${item.description}</td></tr>`;
    }
    if (item.quantity_member_id) {
        html += `<tr><td class="prop-name">CI.quantity_member_id</td><td class="prop-value">${item.quantity_member_id}</td></tr>`;
    }
    if (item.raw_element_id) {
        html += `<tr><td class="prop-name">CI.raw_element_id</td><td class="prop-value">${item.raw_element_id}</td></tr>`;
    }
    html += '</tbody></table>';
    html += '</div>';

    if (!member) {
        html += '<div class="property-section">';
        html += '<p style="color: #999; font-style: italic;">연결된 수량산출부재가 없습니다.</p>';
        html += '</div>';
        container.innerHTML = html;
        return;
    }

    // ============ 2. QM 기본 속성 (상속) ============
    html += '<div class="property-section">';
    html += '<h4 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 5px;">📌 기본 속성 (상속 from QM)</h4>';
    html += '<table class="properties-table"><tbody>';
    html += `<tr><td class="prop-name">QM.id</td><td class="prop-value">${member.id || 'N/A'}</td></tr>`;
    if (member.name) {
        html += `<tr><td class="prop-name">QM.name</td><td class="prop-value">${member.name}</td></tr>`;
    }
    if (member.classification_tag_name) {
        html += `<tr><td class="prop-name">QM.classification_tag</td><td class="prop-value">${member.classification_tag_name}</td></tr>`;
    }
    html += `<tr><td class="prop-name">QM.is_active</td><td class="prop-value">${member.is_active ? 'true' : 'false'}</td></tr>`;
    if (member.raw_element_id) {
        html += `<tr><td class="prop-name">QM.raw_element_id</td><td class="prop-value">${member.raw_element_id}</td></tr>`;
    }
    if (member.split_element_id) {
        html += `<tr><td class="prop-name">QM.split_element_id</td><td class="prop-value">${member.split_element_id}</td></tr>`;
    }
    html += '</tbody></table>';
    html += '</div>';

    // ============ 3. QM 부재 속성 (상속) ============
    if (member.properties && Object.keys(member.properties).length > 0) {
        html += '<div class="property-section">';
        html += '<h4 style="color: #f57c00; border-bottom: 2px solid #f57c00; padding-bottom: 5px;">🔢 부재 속성 (상속 from QM)</h4>';
        html += '<table class="properties-table"><tbody>';
        for (const [key, value] of Object.entries(member.properties)) {
            if (value !== null && value !== undefined) {
                const displayValue = typeof value === 'number' ? value.toFixed(3) : value;
                html += `<tr><td class="prop-name">QM.properties.${key}</td><td class="prop-value">${displayValue}</td></tr>`;
            }
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    // ============ 4. MM 일람부호 (상속) ============
    if (member.member_mark_mark || (member.member_mark_properties && Object.keys(member.member_mark_properties).length > 0)) {
        html += '<div class="property-section">';
        html += '<h4 style="color: #7b1fa2; border-bottom: 2px solid #7b1fa2; padding-bottom: 5px;">📋 일람부호 (상속 from MM)</h4>';
        html += '<table class="properties-table"><tbody>';
        if (member.member_mark_mark) {
            html += `<tr><td class="prop-name">MM.mark</td><td class="prop-value">${member.member_mark_mark}</td></tr>`;
        }
        if (member.member_mark_properties) {
            for (const [key, value] of Object.entries(member.member_mark_properties)) {
                if (value !== null && value !== undefined) {
                    html += `<tr><td class="prop-name">MM.properties.${key}</td><td class="prop-value">${value}</td></tr>`;
                }
            }
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    // ============ 5. Space 공간분류 (상속) ============
    if (member.space_name) {
        html += '<div class="property-section">';
        html += '<h4 style="color: #388e3c; border-bottom: 2px solid #388e3c; padding-bottom: 5px;">📍 공간분류 (상속 from Space)</h4>';
        html += '<table class="properties-table"><tbody>';
        html += `<tr><td class="prop-name">Space.name</td><td class="prop-value">${member.space_name}</td></tr>`;
        html += '</tbody></table>';
        html += '</div>';
    }

    // ============ 6~9. BIM 원본 속성 (상속) ============
    const elementId = member.split_element_id || member.raw_element_id;
    const fullBimObject = elementId && window.allRevitData ?
        window.allRevitData.find(item => item.id === elementId) : null;

    if (fullBimObject && fullBimObject.raw_data) {
        // 6. BIM 시스템 속성
        html += '<div class="property-section">';
        html += '<h4 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 5px;">🏗️ BIM 시스템 속성 (상속 from BIM.System.*)</h4>';
        html += '<table class="properties-table"><tbody>';

        const idDisplayName = window.getDisplayFieldName ? window.getDisplayFieldName('id') : 'BIM.System.id';
        const uniqueIdDisplayName = window.getDisplayFieldName ? window.getDisplayFieldName('element_unique_id') : 'BIM.System.element_unique_id';
        const volumeDisplayName = window.getDisplayFieldName ? window.getDisplayFieldName('geometry_volume') : 'BIM.System.geometry_volume';
        const tagsDisplayName = window.getDisplayFieldName ? window.getDisplayFieldName('classification_tags') : 'BIM.System.classification_tags';

        html += `<tr><td class="prop-name">${idDisplayName}</td><td class="prop-value">${fullBimObject.id || 'N/A'}</td></tr>`;
        html += `<tr><td class="prop-name">${uniqueIdDisplayName}</td><td class="prop-value">${fullBimObject.element_unique_id || 'N/A'}</td></tr>`;
        html += `<tr><td class="prop-name">${volumeDisplayName}</td><td class="prop-value">${fullBimObject.geometry_volume || 'N/A'}</td></tr>`;

        const tagsDisplay = Array.isArray(fullBimObject.classification_tags) && fullBimObject.classification_tags.length > 0
            ? fullBimObject.classification_tags.join(', ')
            : 'N/A';
        html += `<tr><td class="prop-name">${tagsDisplayName}</td><td class="prop-value">${tagsDisplay}</td></tr>`;

        html += '</tbody></table>';
        html += '</div>';

        // 7. BIM 기본 속성
        html += '<div class="property-section">';
        html += '<h4 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 5px;">🏗️ BIM 기본 속성 (상속 from BIM.Attributes.*)</h4>';
        html += '<table class="properties-table"><tbody>';

        const rawData = fullBimObject.raw_data;
        const basicAttrs = ['Name', 'IfcClass', 'ElementId', 'UniqueId', 'Description', 'RelatingType', 'SpatialContainer', 'Aggregates', 'Nests'];
        basicAttrs.forEach(attr => {
            if (rawData[attr] !== undefined && rawData[attr] !== null) {
                const displayName = window.getDisplayFieldName ? window.getDisplayFieldName(attr) : `BIM.Attributes.${attr}`;
                html += `<tr><td class="prop-name">${displayName}</td><td class="prop-value">${rawData[attr]}</td></tr>`;
            }
        });

        html += '</tbody></table>';
        html += '</div>';

        // 8. BIM Parameters
        if (rawData.Parameters && typeof rawData.Parameters === 'object' && Object.keys(rawData.Parameters).length > 0) {
            html += '<div class="property-section">';
            html += '<h4 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 5px;">🏗️ BIM 파라메터 (상속 from BIM.Parameters.*)</h4>';
            html += '<table class="properties-table"><tbody>';
            for (const [key, value] of Object.entries(rawData.Parameters)) {
                if (key === 'Geometry') continue;
                if (value !== null && value !== undefined) {
                    const displayName = window.getDisplayFieldName ? window.getDisplayFieldName(key) : `BIM.Parameters.${key}`;
                    const displayValue = (typeof value === 'object')
                        ? (window.renderNestedValue ? window.renderNestedValue(value, 1) : JSON.stringify(value).substring(0, 100))
                        : String(value).substring(0, 200);
                    html += `<tr><td class="prop-name">${displayName}</td><td class="prop-value">${displayValue}</td></tr>`;
                }
            }
            html += '</tbody></table>';
            html += '</div>';
        }

        // 9. BIM TypeParameters
        if (rawData.TypeParameters && typeof rawData.TypeParameters === 'object' && Object.keys(rawData.TypeParameters).length > 0) {
            html += '<div class="property-section">';
            html += '<h4 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 5px;">🏗️ BIM 타입 파라메터 (상속 from BIM.TypeParameters.*)</h4>';
            html += '<table class="properties-table"><tbody>';
            for (const [key, value] of Object.entries(rawData.TypeParameters)) {
                if (value !== null && value !== undefined) {
                    const displayName = window.getDisplayFieldName ? window.getDisplayFieldName(`TypeParameters.${key}`) : `BIM.TypeParameters.${key}`;
                    const displayValue = (typeof value === 'object')
                        ? (window.renderNestedValue ? window.renderNestedValue(value, 1) : JSON.stringify(value).substring(0, 100))
                        : String(value).substring(0, 200);
                    html += `<tr><td class="prop-name">${displayName}</td><td class="prop-value">${displayValue}</td></tr>`;
                }
            }
            html += '</tbody></table>';
            html += '</div>';
        }
    }

    // ============ 10. 할당된 공사코드 (QM에서 상속) ============
    if (member.cost_codes && member.cost_codes.length > 0) {
        html += '<div class="property-section">';
        html += '<h4 style="color: #0288d1; border-bottom: 2px solid #0288d1; padding-bottom: 5px;">💰 할당된 공사코드 (상속 from QM)</h4>';
        html += '<table class="properties-table"><tbody>';
        member.cost_codes.forEach(code => {
            html += `<tr><td class="prop-name">cost_code</td><td class="prop-value">${code}</td></tr>`;
        });
        html += '</tbody></table>';
        html += '</div>';
    }

    container.innerHTML = html;
}

// =====================================================================
// 할당 정보 (액티비티) 표시
// =====================================================================

/**
 * 선택된 산출항목의 할당 정보 표시
 */
function renderCiAssignedInfo() {
    const activitySelect = document.getElementById('ci-activity-assign-select');

    // 액티비티 드롭다운 채우기 (매번 새로 채움)
    if (activitySelect && window.loadedActivities) {
        // 기존 옵션 제거 (첫 번째 "선택하세요" 옵션은 유지)
        while (activitySelect.children.length > 1) {
            activitySelect.removeChild(activitySelect.lastChild);
        }
        // 액티비티 옵션 추가 (코드와 이름 함께 표시)
        window.loadedActivities.forEach(activity => {
            const option = document.createElement('option');
            option.value = activity.id;
            option.textContent = `${activity.code} - ${activity.name}`;
            activitySelect.appendChild(option);
        });
    }

    // 액티비티 목록 렌더링 (새로운 함수 사용)
    renderCiActivitiesList();
}

/**
 * 산출-코스트아이템 탭의 액티비티 콤보박스만 업데이트
 * (액티비티가 추가/수정/삭제될 때 자동으로 호출됨)
 */
window.updateCiActivitySelect = function() {
    const activitySelect = document.getElementById('ci-activity-assign-select');
    if (!activitySelect || !window.loadedActivities) return;

    // 기존 옵션 제거 (첫 번째 "선택하세요" 옵션은 유지)
    while (activitySelect.children.length > 1) {
        activitySelect.removeChild(activitySelect.lastChild);
    }

    // 액티비티 옵션 추가 (코드와 이름 함께 표시)
    window.loadedActivities.forEach(activity => {
        const option = document.createElement('option');
        option.value = activity.id;
        option.textContent = `${activity.code} - ${activity.name}`;
        activitySelect.appendChild(option);
    });
};

/**
 * 콤보박스 클릭 시 DB에서 최신 액티비티 목록 가져오기
 */
async function loadActivitiesForCombobox() {
    if (!currentProjectId) return;

    try {
        const response = await fetch(`/connections/api/activities/${currentProjectId}/`);
        if (!response.ok) {
            console.error('Failed to load activities for combobox');
            return;
        }

        window.loadedActivities = await response.json();

        // 콤보박스 업데이트
        const activitySelect = document.getElementById('ci-activity-assign-select');
        if (!activitySelect) return;

        // 기존 옵션 제거 (첫 번째 "선택하세요" 옵션은 유지)
        while (activitySelect.children.length > 1) {
            activitySelect.removeChild(activitySelect.lastChild);
        }

        // 액티비티 옵션 추가 (코드와 이름 함께 표시)
        window.loadedActivities.forEach(activity => {
            const option = document.createElement('option');
            option.value = activity.id;
            option.textContent = `${activity.code} - ${activity.name}`;
            activitySelect.appendChild(option);
        });

        console.log(`[Cost Item Manager] Loaded ${window.loadedActivities.length} activities for combobox`);
    } catch (error) {
        console.error('Error loading activities for combobox:', error);
    }
}

// 액티비티 할당 및 제거 함수는 파일 하단의 "액티비티 할당 기능" 섹션에 구현됨
// (assignActivityToCi, clearActivitiesFromCi, toggleIndividualActivityLock, removeIndividualActivity 등)

// =====================================================================
// 필터 관련
// =====================================================================

/**
 * 모든 필터 초기화
 */
/**
 * 필터 적용 - 모든 입력 필드의 값을 수집하고 테이블 재렌더링
 */
function applyCiFilters() {
    if (!window.ciColumnFilters) {
        window.ciColumnFilters = {};
    }

    // 모든 필터 입력 필드의 값을 수집
    const filterInputs = document.querySelectorAll('.ci-filter-input');
    console.log('[DEBUG] Found filter inputs:', filterInputs.length);

    filterInputs.forEach(input => {
        const field = input.dataset.field;
        const value = input.value.trim();
        console.log('[DEBUG] Filter input:', field, '=', value);

        if (value) {
            window.ciColumnFilters[field] = value.toLowerCase();
        } else {
            delete window.ciColumnFilters[field];
        }
    });

    console.log('[DEBUG] Applying CI filters:', window.ciColumnFilters);
    renderCostItemsTable(window.loadedCostItems);
    showToast('필터가 적용되었습니다.', 'success');
}

function clearCiFilters() {
    window.ciColumnFilters = {};
    const filterInputs = document.querySelectorAll('.ci-filter-input');
    filterInputs.forEach(input => {
        input.value = '';
    });
    renderCostItemsTable(window.loadedCostItems);
    showToast('필터가 초기화되었습니다.', 'success');
}

/**
 * 선택 필터 해제
 */
function clearCiSelectionFilter() {
    window.ciFilteredIds = null;
    window.isCiFilterToSelectionActive = false;

    const clearBtnSidebar = document.getElementById('ci-clear-selection-filter-btn');
    const clearBtnFooter = document.getElementById('ci-clear-selection-filter-btn-footer');

    if (clearBtnSidebar) clearBtnSidebar.style.display = 'none';
    if (clearBtnFooter) clearBtnFooter.style.display = 'none';

    renderCostItemsTable(window.loadedCostItems);
    showToast('선택 필터가 해제되었습니다.', 'success');
}

// =====================================================================
// 스플릿바 크기 조정 기능
// =====================================================================

/**
 * 코스트아이템 탭 스플릿바 초기화
 */
function initCiSplitBar() {
    const splitBar = document.querySelector('#cost-item-management .ci-split-bar');
    const leftPanel = document.querySelector('#cost-item-management .left-panel');
    const container = document.querySelector('#cost-item-management .split-layout-container');

    if (!splitBar || !leftPanel || !container) {
        console.log('[DEBUG] CI Split bar elements not found, skipping initialization');
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

    console.log('[DEBUG] CI Split bar initialized');
}

// =====================================================================
// 수량산출룰셋 적용 함수
// =====================================================================

/**
 * 수량산출룰셋을 적용하여 CostItem의 수량(quantity)을 계산
 * @param {boolean} selectedOnly - true이면 선택된 항목만, false이면 전체 항목
 */
async function applyCostItemQuantityRules(selectedOnly = false) {
    if (!currentProjectId) {
        showToast('프로젝트를 먼저 선택하세요.', 'error');
        return;
    }

    if (!loadedCostItems || loadedCostItems.length === 0) {
        showToast('산출항목이 없습니다.', 'error');
        return;
    }

    // 선택 모드인 경우 선택된 항목 확인
    let targetItems = window.loadedCostItems;
    if (selectedOnly) {
        const selectedCostItems = Array.from(window.selectedCiIds || []);
        if (!selectedCostItems || selectedCostItems.length === 0) {
            showToast('항목을 먼저 선택하세요.', 'error');
            return;
        }
        targetItems = window.window.loadedCostItems.filter(item => selectedCostItems.includes(item.id));
        console.log(`[DEBUG][applyCostItemQuantityRules] Selected mode: ${targetItems.length} items`);
    }

    try {
        console.log('[DEBUG][applyCostItemQuantityRules] Loading quantity calculation rules...');

        // 1. 수량산출룰셋 로드
        const response = await fetch(`/connections/api/rules/cost-code/${currentProjectId}/`);
        if (!response.ok) throw new Error('수량산출룰셋을 불러오는데 실패했습니다.');

        const rules = await response.json();
        console.log('[DEBUG][applyCostItemQuantityRules] Loaded rules:', rules);

        if (!rules || rules.length === 0) {
            showToast('적용할 수량산출룰셋이 없습니다.', 'warning');
            return;
        }

        // 2. Priority 순으로 정렬
        rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        let updatedCount = 0;
        const updatedItems = [];

        // 3. 각 CostItem에 대해 룰셋 적용
        for (const costItem of targetItems) {
            // 수동 입력된 수량이 있는 경우 룰셋 적용 스킵
            if (costItem.quantity_mapping_expression &&
                (costItem.quantity_mapping_expression.mode === 'direct' ||
                 costItem.quantity_mapping_expression.mode === 'formula')) {
                continue;
            }

            // CostItem의 전체 속성 객체 생성
            const ciContext = buildCostItemContext(costItem);

            // 룰셋 순회하며 조건 체크
            for (const rule of rules) {
                if (evaluateCiConditions(rule.conditions || [], ciContext)) {
                    // 수량 산식 평가
                    const quantity = evaluateQuantityFormula(rule.quantity_formula || '', ciContext);

                    if (quantity !== null && quantity !== undefined && !isNaN(quantity)) {
                        costItem.quantity = quantity;
                        updatedItems.push(costItem);
                        updatedCount++;
                        break; // 첫 번째 매칭 룰만 적용 (priority 순)
                    }
                }
            }
        }

        // 4. 변경된 항목 저장
        if (updatedItems.length > 0) {
            console.log(`[DEBUG][applyCostItemQuantityRules] Saving ${updatedItems.length} updated items...`);

            for (const item of updatedItems) {
                const saveResponse = await fetch(`/connections/api/cost-items/${currentProjectId}/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken,
                    },
                    body: JSON.stringify(item),
                });

                if (!saveResponse.ok) {
                    const error = await saveResponse.json();
                    console.warn('[WARN][applyCostItemQuantityRules] Failed to save item:', item.id, error);
                }
            }

            // 5. 테이블 갱신
            await loadCostItems();
            showToast(`${updatedCount}개 항목의 수량이 계산되었습니다.`, 'success');
        } else {
            showToast('조건에 맞는 항목이 없습니다.', 'info');
        }

    } catch (error) {
        console.error('[ERROR][applyCostItemQuantityRules]', error);
        showToast(error.message, 'error');
    }
}

/**
 * CostItem의 전체 컨텍스트 객체 생성 (CI.*, QM.*, BIM.*, MM.*, Space.*)
 */
function buildCostItemContext(costItem) {
    const context = {};

    // 1. CI 자체 속성
    context['id'] = costItem.id;
    context['quantity'] = costItem.quantity || 0;
    context['unit'] = costItem.unit || '';
    context['grouping_info'] = costItem.grouping_info || '';
    context['item_index'] = costItem.item_index || 0;

    // 공사코드
    if (costItem.cost_code) {
        const costCode = window.loadedCostCodes?.find(cc => cc.id === costItem.cost_code);
        if (costCode) {
            context['cost_code_code'] = costCode.code;
            context['cost_code_name'] = costCode.name;
            context['cost_code_detail_code'] = costCode.detail_code;
            // CostItem에는 name 필드가 없으므로 cost_code의 name을 사용
            context['name'] = `${costCode.code} - ${costCode.name}`;
        } else {
            // cost_code를 찾을 수 없는 경우
            context['name'] = 'Unknown Cost Item';
        }
    } else {
        context['name'] = 'No Cost Code';
    }

    // 2. QuantityMember 속성 (상속)
    if (costItem.quantity_member) {
        const qm = window.loadedQuantityMembers?.find(m => m.id === costItem.quantity_member);

        if (qm) {
            context['quantity_member_id'] = qm.id;
            context['quantity_member_name'] = qm.name;
            context['classification_tag'] = qm.classification_tag_name || '';
            context['qm_volume'] = qm.volume || 0;
            context['qm_area'] = qm.area || 0;
            context['qm_length'] = qm.length || 0;

            // QM properties
            if (qm.properties) {
                Object.keys(qm.properties).forEach(key => {
                    context[`qm_prop_${key}`] = qm.properties[key];
                });
            }

            // 3. BIM 원본 속성 (RE를 통한 상속)
            if (qm.raw_element_id) {
                const rawElement = window.allRevitData?.find(re => re.id === qm.raw_element_id);

                if (rawElement && rawElement.raw_data) {
                    const rd = rawElement.raw_data;

                    // IFC 기본 속성들 (Attributes로 취급)
                    // IFC 파일에서는 raw_data의 직접 속성으로 저장됨
                    const ifcAttributeKeys = ['Name', 'IfcClass', 'ElementId', 'UniqueId',
                                              'RelatingType', 'SpatialContainer', 'Aggregates', 'Nests'];
                    ifcAttributeKeys.forEach(key => {
                        if (rd[key] !== undefined) {
                            context[`bim_attr_${key}`] = rd[key];
                        }
                    });

                    // System properties (Revit 전용)
                    ['Category', 'Family', 'Type', 'Level', 'Id'].forEach(key => {
                        if (rd[key] !== undefined) {
                            context[`bim_system_${key}`] = rd[key];
                        }
                    });

                    // Attributes (Revit 구조용 - 하위 호환성)
                    if (rd.Attributes && typeof rd.Attributes === 'object') {
                        Object.keys(rd.Attributes).forEach(key => {
                            context[`bim_attr_${key}`] = rd.Attributes[key];
                        });
                    }

                    // Parameters
                    if (rd.Parameters) {
                        Object.keys(rd.Parameters).forEach(key => {
                            context[`bim_param_${key}`] = rd.Parameters[key];
                        });
                    }

                    // TypeParameters
                    if (rd.TypeParameters) {
                        Object.keys(rd.TypeParameters).forEach(key => {
                            context[`bim_tparam_${key}`] = rd.TypeParameters[key];
                        });
                    }
                }
            }

            // 4. MemberMark 속성 (상속)
            if (qm.member_mark_id) {
                const mm = window.loadedMemberMarks?.find(m => m.id === qm.member_mark_id);
                if (mm) {
                    context['member_mark_mark'] = mm.mark;

                    if (mm.properties) {
                        Object.keys(mm.properties).forEach(key => {
                            context[`mm_prop_${key}`] = mm.properties[key];
                        });
                    }
                }
            }

            // 5. Space 속성 (상속)
            if (qm.space_name) {
                context['space_name'] = qm.space_name;
            }
        }
    }

    return context;
}

/**
 * CostItem 조건 평가
 */
function evaluateCiConditions(conditions, context) {
    if (!conditions || conditions.length === 0) return true;

    for (const cond of conditions) {
        let property = cond.property || cond.parameter;
        const operator = cond.operator || 'equals';
        const expectedValue = String(cond.value || '').toLowerCase();

        // 표시 형식의 속성명을 내부 컨텍스트 키로 변환
        let contextKey = property;
        if (property.startsWith('CI.')) {
            // CI 속성 처리
            const ciProp = property.substring(3);
            if (ciProp === 'cost_code') {
                contextKey = 'cost_code_code';
            } else {
                contextKey = ciProp;
            }
        } else if (property.startsWith('QM.properties.')) {
            contextKey = 'qm_prop_' + property.substring(14);
        } else if (property.startsWith('QM.id')) {
            contextKey = 'quantity_member_id';
        } else if (property.startsWith('QM.name')) {
            contextKey = 'quantity_member_name';
        } else if (property.startsWith('QM.classification_tag')) {
            contextKey = 'classification_tag';
        } else if (property.startsWith('QM.')) {
            contextKey = 'qm_' + property.substring(3).toLowerCase();
        } else if (property.startsWith('BIM.System.')) {
            contextKey = 'bim_system_' + property.substring(11);
        } else if (property.startsWith('BIM.Attributes.')) {
            contextKey = 'bim_attr_' + property.substring(15);
        } else if (property.startsWith('BIM.Parameters.')) {
            contextKey = 'bim_param_' + property.substring(15);
        } else if (property.startsWith('BIM.TypeParameters.')) {
            contextKey = 'bim_tparam_' + property.substring(19);
        } else if (property.startsWith('MM.properties.')) {
            contextKey = 'mm_prop_' + property.substring(14);
        } else if (property.startsWith('MM.mark')) {
            contextKey = 'member_mark_mark';
        } else if (property.startsWith('Space.name')) {
            contextKey = 'space_name';
        }

        const actualValue = String(context[contextKey] || '').toLowerCase();

        let matches = false;

        switch (operator) {
            case 'equals':
            case '==':
                matches = actualValue === expectedValue;
                break;
            case 'not_equals':
            case '!=':
                matches = actualValue !== expectedValue;
                break;
            case 'contains':
                matches = actualValue.includes(expectedValue);
                break;
            case 'startswith':
                matches = actualValue.startsWith(expectedValue);
                break;
            case 'endswith':
                matches = actualValue.endsWith(expectedValue);
                break;
            case 'greater_than':
            case '>':
                matches = parseFloat(context[contextKey]) > parseFloat(cond.value);
                break;
            case 'less_than':
            case '<':
                matches = parseFloat(context[contextKey]) < parseFloat(cond.value);
                break;
            case 'greater_or_equal':
            case '>=':
                matches = parseFloat(context[contextKey]) >= parseFloat(cond.value);
                break;
            case 'less_or_equal':
            case '<=':
                matches = parseFloat(context[contextKey]) <= parseFloat(cond.value);
                break;
            default:
                matches = actualValue === expectedValue;
        }

        if (!matches) return false; // AND 조건
    }

    return true;
}

/**
 * 수량 산식 평가 (템플릿 표현식 처리)
 */
function evaluateQuantityFormula(formula, context) {
    if (!formula || formula.trim() === '') return null;

    try {
        // 템플릿 표현식 {property_name}을 실제 값으로 치환
        let evaluatedFormula = formula;

        // {property_name} 패턴 찾기
        const templatePattern = /\{([^}]+)\}/g;
        const matches = [...formula.matchAll(templatePattern)];

        console.log('[DEBUG][evaluateQuantityFormula] Original formula:', formula);

        for (const match of matches) {
            const fullMatch = match[0]; // {property_name}
            let propertyPath = match[1]; // property_name

            // 괄호와 설명 부분 제거 (예: "QM.volume (부재 체적)" -> "QM.volume")
            if (propertyPath.includes('(')) {
                propertyPath = propertyPath.split('(')[0].trim();
            }

            // 속성 경로에서 실제 컨텍스트 키 찾기
            // CI.name -> name, QM.volume -> qm_volume, BIM.Parameters.면적 -> bim_param_면적
            let contextKey = propertyPath;

            // 접두어 변환
            if (propertyPath.startsWith('CI.')) {
                contextKey = propertyPath.substring(3); // "CI." 제거
            } else if (propertyPath.startsWith('QM.properties.')) {
                // QM.properties.XXX -> qm_prop_XXX
                contextKey = 'qm_prop_' + propertyPath.substring(14);
            } else if (propertyPath.startsWith('QM.')) {
                // QM.volume -> qm_volume
                contextKey = 'qm_' + propertyPath.substring(3).toLowerCase();
            } else if (propertyPath.startsWith('BIM.System.')) {
                contextKey = 'bim_system_' + propertyPath.substring(11);
            } else if (propertyPath.startsWith('BIM.Attributes.')) {
                contextKey = 'bim_attr_' + propertyPath.substring(15);
            } else if (propertyPath.startsWith('BIM.Parameters.')) {
                contextKey = 'bim_param_' + propertyPath.substring(15);
            } else if (propertyPath.startsWith('BIM.TypeParameters.')) {
                contextKey = 'bim_tparam_' + propertyPath.substring(19);
            } else if (propertyPath.startsWith('MM.properties.')) {
                contextKey = 'mm_prop_' + propertyPath.substring(14);
            } else if (propertyPath.startsWith('MM.mark')) {
                contextKey = 'member_mark_mark';
            } else if (propertyPath.startsWith('Space.name')) {
                contextKey = 'space_name';
            }

            console.log(`[DEBUG][evaluateQuantityFormula] Property: ${propertyPath} -> Context Key: ${contextKey}`);

            const value = context[contextKey];

            if (value !== undefined && value !== null) {
                // 숫자로 변환 시도
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    evaluatedFormula = evaluatedFormula.replace(fullMatch, numValue);
                } else {
                    console.warn(`[WARN][evaluateQuantityFormula] Non-numeric value for ${propertyPath}: ${value}`);
                    evaluatedFormula = evaluatedFormula.replace(fullMatch, 0);
                }
            } else {
                console.warn(`[WARN][evaluateQuantityFormula] Missing value for ${propertyPath}`);
                evaluatedFormula = evaluatedFormula.replace(fullMatch, 0);
            }
        }

        console.log('[DEBUG][evaluateQuantityFormula] Evaluated formula:', evaluatedFormula);

        // 수식 계산
        const result = eval(evaluatedFormula);
        console.log('[DEBUG][evaluateQuantityFormula] Result:', result);

        return result;
    } catch (error) {
        console.error('[ERROR][evaluateQuantityFormula]', error);
        return null;
    }
}

// =====================================================================
// 수동 수량입력 모달
// =====================================================================

/**
 * 선택된 CostItem에 대해 수동으로 수량을 입력하는 모달 표시
 */
function showManualQuantityInputModal() {
    const selectedCostItems = Array.from(window.selectedCiIds || []);
    if (!selectedCostItems || selectedCostItems.length === 0) {
        showToast('항목을 먼저 선택하세요.', 'error');
        return;
    }

    const selectedItems = window.window.loadedCostItems.filter(item => selectedCostItems.includes(item.id));
    console.log('[DEBUG][showManualQuantityInputModal] Selected items:', selectedItems);

    // 이전에 저장된 quantity_mapping_expression 확인
    let previousExpression = null;
    let previousMode = 'direct';
    let previousValue = '';
    let previousFormula = '';

    // 첫 번째 선택 항목의 표현식 확인 (여러 항목이 선택된 경우 첫 번째 것 사용)
    if (selectedItems.length > 0 && selectedItems[0].quantity_mapping_expression) {
        previousExpression = selectedItems[0].quantity_mapping_expression;
        if (previousExpression.mode === 'direct') {
            previousMode = 'direct';
            previousValue = previousExpression.value || '';
        } else if (previousExpression.mode === 'formula') {
            previousMode = 'formula';
            previousFormula = previousExpression.formula || '';
        }
        console.log('[DEBUG][showManualQuantityInputModal] Previous expression:', previousExpression);
    }

    // 모달 HTML 생성
    const modal = document.createElement('div');
    modal.id = 'manual-quantity-input-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

    // 속성 옵션 생성
    let propertyOptions = '<option value="">-- 속성 선택 --</option>';
    if (typeof window.getAllCiFieldsForConditionBuilder === 'function') {
        const fieldGroups = window.getAllCiFieldsForConditionBuilder();
        fieldGroups.forEach(group => {
            propertyOptions += `<optgroup label="${group.group}">`;
            group.options.forEach(opt => {
                propertyOptions += `<option value="{${opt.label}}">{${opt.label}}</option>`;
            });
            propertyOptions += '</optgroup>';
        });
    }

    modal.innerHTML = `
        <div style="background: white; border-radius: 8px; padding: 24px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #333;">수동 수량입력</h3>
            <p style="margin: 0 0 16px 0; font-size: 13px; color: #666;">선택된 ${selectedItems.length}개 항목의 수량을 입력합니다.</p>

            <div style="margin-bottom: 20px; padding: 12px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold; color: #495057;">입력 방식 선택</h4>
                <div style="display: flex; gap: 12px; margin-bottom: 12px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="input-mode" value="direct" ${previousMode === 'direct' ? 'checked' : ''} style="margin-right: 6px;">
                        <span style="font-size: 13px;">직접 입력</span>
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="input-mode" value="formula" ${previousMode === 'formula' ? 'checked' : ''} style="margin-right: 6px;">
                        <span style="font-size: 13px;">산식 입력</span>
                    </label>
                </div>

                <!-- 직접 입력 모드 -->
                <div id="direct-input-mode" style="display: ${previousMode === 'direct' ? 'block' : 'none'};">
                    <label style="display: block; margin-bottom: 4px; font-size: 13px; font-weight: 500; color: #495057;">수량 값</label>
                    <input type="number" id="direct-quantity-input" step="0.0001" placeholder="예: 100.5" value="${previousValue}"
                           style="width: 100%; padding: 8px; font-size: 13px; border: 1px solid #ced4da; border-radius: 4px;">
                    <small style="display: block; margin-top: 4px; font-size: 12px; color: #6c757d;">모든 선택 항목에 동일한 수량이 적용됩니다.</small>
                </div>

                <!-- 산식 입력 모드 -->
                <div id="formula-input-mode" style="display: ${previousMode === 'formula' ? 'block' : 'none'};">
                    <label style="display: block; margin-bottom: 4px; font-size: 13px; font-weight: 500; color: #495057;">수량 산식</label>
                    <textarea id="formula-quantity-input" placeholder="예: {QM.volume} * 2.5 + {BIM.Parameters.면적} * 0.1"
                              style="width: 100%; min-height: 80px; padding: 8px; font-size: 13px; font-family: 'Courier New', monospace; border: 1px solid #ced4da; border-radius: 4px; resize: vertical;">${previousFormula}</textarea>
                    <div style="display: flex; gap: 8px; margin-top: 8px; align-items: center;">
                        <select id="formula-property-select" style="flex: 1; padding: 8px; font-size: 13px; border: 1px solid #ced4da; border-radius: 4px;">
                            ${propertyOptions}
                        </select>
                        <button type="button" id="insert-formula-property-btn" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; white-space: nowrap;">
                            속성 삽입
                        </button>
                    </div>
                    <small style="display: block; margin-top: 8px; font-size: 12px; color: #6c757d;">각 항목의 속성값을 기반으로 개별 계산됩니다.</small>
                </div>
            </div>

            <div style="margin-bottom: 20px; max-height: 200px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 4px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead style="background: #f8f9fa; position: sticky; top: 0;">
                        <tr>
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dee2e6;">항목명</th>
                            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #dee2e6;">현재 수량</th>
                            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #dee2e6;">단위</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${selectedItems.map(item => `
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${item.name}</td>
                                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #f0f0f0;">${item.quantity || 0}</td>
                                <td style="padding: 8px; text-align: center; border-bottom: 1px solid #f0f0f0;">${item.unit || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button id="manual-quantity-cancel-btn" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    취소
                </button>
                <button id="manual-quantity-apply-btn" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">
                    적용
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 입력 모드 전환 이벤트
    const directMode = modal.querySelector('#direct-input-mode');
    const formulaMode = modal.querySelector('#formula-input-mode');
    modal.querySelectorAll('input[name="input-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'direct') {
                directMode.style.display = 'block';
                formulaMode.style.display = 'none';
            } else {
                directMode.style.display = 'none';
                formulaMode.style.display = 'block';
            }
        });
    });

    // 속성 삽입 버튼
    modal.querySelector('#insert-formula-property-btn')?.addEventListener('click', () => {
        const textarea = modal.querySelector('#formula-quantity-input');
        const select = modal.querySelector('#formula-property-select');
        const selectedValue = select.value;

        if (selectedValue) {
            const startPos = textarea.selectionStart;
            const endPos = textarea.selectionEnd;
            const currentValue = textarea.value;
            const newValue = currentValue.substring(0, startPos) + selectedValue + currentValue.substring(endPos);
            textarea.value = newValue;

            // 커서 위치 업데이트
            const newCursorPos = startPos + selectedValue.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();

            // 선택 초기화
            select.selectedIndex = 0;
        }
    });

    // 취소 버튼
    modal.querySelector('#manual-quantity-cancel-btn')?.addEventListener('click', () => {
        modal.remove();
    });

    // 적용 버튼
    modal.querySelector('#manual-quantity-apply-btn')?.addEventListener('click', async () => {
        const inputMode = modal.querySelector('input[name="input-mode"]:checked').value;

        try {
            let updatedCount = 0;

            if (inputMode === 'direct') {
                // 직접 입력 모드
                const directValue = parseFloat(modal.querySelector('#direct-quantity-input').value);

                if (isNaN(directValue)) {
                    showToast('유효한 숫자를 입력하세요.', 'error');
                    return;
                }

                console.log(`[DEBUG][Manual Quantity] Direct mode: ${directValue}`);

                for (const item of selectedItems) {
                    item.quantity = directValue;
                    // 직접 입력 값을 quantity_mapping_expression에 저장
                    item.quantity_mapping_expression = {
                        mode: 'direct',
                        value: directValue
                    };

                    const saveResponse = await fetch(`/connections/api/cost-items/${currentProjectId}/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrftoken,
                        },
                        body: JSON.stringify(item),
                    });

                    if (saveResponse.ok) {
                        updatedCount++;
                    } else {
                        console.warn('[WARN] Failed to save item:', item.id);
                    }
                }
            } else {
                // 산식 입력 모드
                const formula = modal.querySelector('#formula-quantity-input').value.trim();

                if (!formula) {
                    showToast('수량 산식을 입력하세요.', 'error');
                    return;
                }

                console.log(`[DEBUG][Manual Quantity] Formula mode: ${formula}`);

                for (const item of selectedItems) {
                    const ciContext = buildCostItemContext(item);
                    const calculatedQuantity = evaluateQuantityFormula(formula, ciContext);

                    if (calculatedQuantity !== null && !isNaN(calculatedQuantity)) {
                        item.quantity = calculatedQuantity;
                        // 산식을 quantity_mapping_expression에 저장
                        item.quantity_mapping_expression = {
                            mode: 'formula',
                            formula: formula
                        };

                        const saveResponse = await fetch(`/connections/api/cost-items/${currentProjectId}/`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': csrftoken,
                            },
                            body: JSON.stringify(item),
                        });

                        if (saveResponse.ok) {
                            updatedCount++;
                        } else {
                            console.warn('[WARN] Failed to save item:', item.id);
                        }
                    } else {
                        console.warn('[WARN] Formula evaluation failed for item:', ciContext.name);
                    }
                }
            }

            // 테이블 갱신
            await loadCostItems();
            showToast(`${updatedCount}개 항목의 수량이 업데이트되었습니다.`, 'success');
            modal.remove();

        } catch (error) {
            console.error('[ERROR][Manual Quantity Input]', error);
            showToast('수량 입력 중 오류가 발생했습니다.', 'error');
        }
    });

    // 모달 배경 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// =====================================================================
// 액티비티 할당 기능
// =====================================================================

/**
 * 액티비티 할당
 */
async function assignActivityToCi() {
    const activityId = document.getElementById('ci-activity-assign-select').value;
    if (!activityId) {
        showToast('적용할 액티비티를 선택하세요.', 'error');
        return;
    }
    if (selectedCiIds.size === 0) {
        showToast('액티비티를 적용할 산출항목을 테이블에서 선택하세요.', 'error');
        return;
    }

    try {
        const response = await fetch(
            `/connections/api/cost-items/manage-activities/${currentProjectId}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    item_ids: Array.from(selectedCiIds),
                    activity_id: activityId,
                    action: 'assign',
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');

        // 선택 상태 저장
        const selectedIds = new Set(selectedCiIds);

        // 데이터 새로고침
        await loadCostItems();

        // 선택 상태 복원
        selectedCiIds.clear();
        selectedIds.forEach(id => selectedCiIds.add(id));

        // 선택된 행 다시 하이라이트
        selectedCiIds.forEach(id => {
            const row = document.querySelector(`tr[data-item-id="${id}"]`);
            if (row) row.classList.add('selected');
        });

        // 액티비티 목록 렌더링
        renderCiActivitiesList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 액티비티 제거
 */
async function clearActivitiesFromCi() {
    if (selectedCiIds.size === 0) {
        showToast('액티비티를 제거할 산출항목을 테이블에서 선택하세요.', 'error');
        return;
    }

    if (!confirm(`선택한 ${selectedCiIds.size}개 산출항목의 모든 액티비티를 제거하시겠습니까?`)) {
        return;
    }

    try {
        const response = await fetch(
            `/connections/api/cost-items/clear-activities/${currentProjectId}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    item_ids: Array.from(selectedCiIds),
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');

        // 데이터 새로고침
        await loadCostItems();
        renderCiActivitiesList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 개별 액티비티 잠금/해제
 */
async function toggleIndividualActivityLock(itemId, activityId) {
    try {
        const response = await fetch(
            `/connections/api/cost-items/toggle-activity-lock/${currentProjectId}/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    item_id: itemId,
                    activity_id: activityId,
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');

        // 해당 항목의 데이터 업데이트
        const item = loadedCostItems.find(ci => ci.id === itemId);
        if (item) {
            if (result.is_locked) {
                // 잠금 추가
                if (!item.locked_activity_ids) {
                    item.locked_activity_ids = [];
                }
                if (!item.locked_activity_ids.includes(activityId)) {
                    item.locked_activity_ids.push(activityId);
                }
            } else {
                // 잠금 해제
                if (item.locked_activity_ids) {
                    item.locked_activity_ids = item.locked_activity_ids.filter(id => id !== activityId);
                }
            }
        }

        // UI 새로고침
        renderCiActivitiesList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 개별 액티비티 제거
 */
async function removeIndividualActivity(itemId, activityId) {
    const item = loadedCostItems.find(ci => ci.id === itemId);
    const activity = window.loadedActivities?.find(a => a.id === activityId);

    if (!item || !activity) {
        showToast('산출항목 또는 액티비티를 찾을 수 없습니다.', 'error');
        return;
    }

    // 잠금 상태 확인
    const lockedActivityIds = new Set(item.locked_activity_ids || []);
    if (lockedActivityIds.has(activityId)) {
        showToast('잠긴 액티비티는 제거할 수 없습니다. 먼저 잠금을 해제하세요.', 'warning');
        return;
    }

    if (!confirm(`액티비티 "${activity.name}"을(를) 제거하시겠습니까?`)) {
        return;
    }

    try {
        const response = await fetch(
            `/connections/api/cost-items/manage-activities/${currentProjectId}/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    item_ids: [itemId],
                    activity_id: activityId,
                    action: 'remove',
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');

        // 로컬 데이터 업데이트 (activities는 이제 객체 배열)
        if (item.activities) {
            item.activities = item.activities.filter(act => act.id !== activityId);
        }

        // UI 새로고침
        renderCiActivitiesList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 액티비티 목록 렌더링
 */
function renderCiActivitiesList() {
    const container = document.getElementById('ci-assigned-activities-container');
    if (!container) return;

    if (selectedCiIds.size === 0) {
        container.innerHTML = '산출항목을 선택하세요.';
        return;
    }

    if (selectedCiIds.size > 1) {
        container.innerHTML = '액티비티 관리를 위해 산출항목을 하나만 선택하세요.';
        return;
    }

    const selectedId = Array.from(selectedCiIds)[0];
    const item = loadedCostItems.find(ci => ci.id === selectedId);

    if (!item) {
        container.innerHTML = '산출항목을 찾을 수 없습니다.';
        return;
    }

    const activities = item.activities || [];  // 백엔드에서 'activities'로 객체 배열 반환
    const lockedActivityIds = new Set(item.locked_activity_ids || []);

    if (activities.length === 0) {
        container.innerHTML = '<p style="color: #999; font-size: 11px; margin: 4px 0;">할당된 액티비티가 없습니다.</p>';
        return;
    }

    let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
    activities.forEach(activity => {
        // activity는 이미 {id, code, name, ...} 객체임
        const isLocked = lockedActivityIds.has(activity.id);
        const lockIcon = isLocked ? '🔒' : '🔓';
        const lockTitle = isLocked ? '잠금 해제' : '잠금';

        html += `
            <li style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #eee;">
                <span style="flex: 1; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${activity.code} - ${activity.name}</span>
                <div style="display: flex; gap: 2px;">
                    <button onclick="toggleIndividualActivityLock('${item.id}', '${activity.id}')"
                            style="padding: 2px 6px; font-size: 10px; background: none; border: none; cursor: pointer;"
                            title="${lockTitle}">
                        ${lockIcon}
                    </button>
                    <button onclick="removeIndividualActivity('${item.id}', '${activity.id}')"
                            style="padding: 2px 6px; font-size: 10px; background: #dc3545; color: white; border: none; border-radius: 2px; cursor: pointer;"
                            title="제거"
                            ${isLocked ? 'disabled' : ''}>
                        ✕
                    </button>
                </div>
            </li>
        `;
    });
    html += '</ul>';

    container.innerHTML = html;
}

/**
 * 액티비티 룰셋 적용
 */
async function applyCiActivityRules() {
    console.log('[DEBUG][applyCiActivityRules] Function called');
    console.log('[DEBUG][applyCiActivityRules] currentProjectId:', currentProjectId);
    console.log('[DEBUG][applyCiActivityRules] loadedCostItems count:', window.loadedCostItems?.length);

    if (!currentProjectId) {
        showToast('프로젝트를 먼저 선택하세요.', 'error');
        return;
    }

    if (!window.loadedCostItems || window.loadedCostItems.length === 0) {
        showToast('산출항목이 없습니다.', 'error');
        return;
    }

    if (!confirm('액티비티 할당 룰셋을 적용하시겠습니까?')) {
        console.log('[DEBUG][applyCiActivityRules] User cancelled');
        return;
    }

    console.log('[DEBUG][applyCiActivityRules] Sending API request...');

    try {
        const response = await fetch(
            `/connections/api/cost-items/apply-activity-rules/${currentProjectId}/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
            }
        );

        console.log('[DEBUG][applyCiActivityRules] Response received:', response.status);

        const result = await response.json();
        console.log('[DEBUG][applyCiActivityRules] Result:', result);

        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');

        // 데이터 새로고침
        await loadCostItems();
        renderCiActivitiesList();
    } catch (error) {
        console.error('[ERROR][applyCiActivityRules]', error);
        showToast(error.message, 'error');
    }
}

// =====================================================================
// 뷰 탭 전환 (코스트아이템 뷰 / 액티비티별 뷰)
// =====================================================================

function handleCiViewTabClick(e) {
    console.log('[DEBUG][handleCiViewTabClick] ===== 뷰 탭 클릭 =====');
    console.log('[DEBUG][handleCiViewTabClick] e.target:', e.target);
    console.log('[DEBUG][handleCiViewTabClick] e.target.classList:', e.target.classList);

    if (!e.target.classList.contains('view-tab-button')) {
        console.log('[DEBUG][handleCiViewTabClick] Not a view-tab-button, returning');
        return;
    }

    const viewType = e.target.dataset.view;
    console.log('[DEBUG][handleCiViewTabClick] viewType:', viewType);

    if (!viewType) {
        console.log('[DEBUG][handleCiViewTabClick] No viewType, returning');
        return;
    }

    // 탭 활성화 상태 변경
    document.querySelectorAll('#cost-item-management .view-tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');
    console.log('[DEBUG][handleCiViewTabClick] Tab activated:', viewType);

    // 현재 뷰 상태 업데이트
    window.activeCiView = viewType;

    // 뷰에 따라 테이블 렌더링
    if (viewType === 'cost-item-view') {
        console.log('[DEBUG][handleCiViewTabClick] Switching to COST-ITEM VIEW');
        // 기본 코스트아이템 뷰 - 그룹핑 초기화
        window.ciGroupingLevels = [];
        console.log('[DEBUG][handleCiViewTabClick] window.ciGroupingLevels reset to:', window.ciGroupingLevels);
        console.log('[DEBUG][handleCiViewTabClick] Rendering with loadedCostItems count:', window.loadedCostItems.length);
        renderCostItemsTable(window.loadedCostItems);
    } else if (viewType === 'activity-view') {
        console.log('[DEBUG][handleCiViewTabClick] Switching to ACTIVITY VIEW');
        // 액티비티별 뷰: 각 CostItem을 할당된 Activity마다 복제
        renderCostItemsByActivityView();
    }
    console.log('[DEBUG][handleCiViewTabClick] ===== 뷰 탭 클릭 종료 =====');
}

function renderCostItemsByActivityView() {
    console.log('[DEBUG][renderCostItemsByActivityView] ===== Activity View 렌더링 시작 =====');
    console.log('[DEBUG][renderCostItemsByActivityView] loadedCostItems count:', window.loadedCostItems.length);

    const expandedItems = [];

    window.loadedCostItems.forEach((ci, index) => {
        console.log(`[DEBUG][renderCostItemsByActivityView] Processing CostItem ${index}:`, {
            id: ci.id,
            name: ci.name || 'N/A',
            activities: ci.activities,
            activitiesCount: ci.activities ? ci.activities.length : 0
        });

        if (ci.activities && ci.activities.length > 0) {
            // 각 Activity마다 CostItem 복제
            ci.activities.forEach(activity => {
                console.log(`[DEBUG][renderCostItemsByActivityView]   - Expanding for Activity:`, {
                    code: activity.code,
                    name: activity.name,
                    id: activity.id
                });

                const expandedCi = {
                    ...ci,
                    // Activity 정보를 최상위 필드로 추가 (그룹핑용)
                    'Activity.code': activity.code,
                    'Activity.name': activity.name,
                    'Activity.id': activity.id,
                    'Activity.duration_per_unit': activity.duration_per_unit,
                    // 현재 표시 중인 Activity 정보 추가
                    _displayActivity: activity,
                    // 원본 CostItem ID 보존
                    _originalCiId: ci.id,
                    // 고유 ID 생성 (테이블 렌더링용)
                    id: `${ci.id}_activity_${activity.id}`
                };
                expandedItems.push(expandedCi);
            });
        } else {
            console.log(`[DEBUG][renderCostItemsByActivityView]   - No activities, adding as (할당 안됨)`);
            // Activity가 없는 CostItem도 표시
            expandedItems.push({
                ...ci,
                'Activity.code': '(할당 안됨)',
                'Activity.name': '(할당 안됨)',
                _displayActivity: null,
                _originalCiId: ci.id
            });
        }
    });

    console.log(`[DEBUG][renderCostItemsByActivityView] Expanded ${window.loadedCostItems.length} items to ${expandedItems.length} rows`);
    console.log('[DEBUG][renderCostItemsByActivityView] Sample expanded items (first 3):');
    expandedItems.slice(0, 3).forEach((item, idx) => {
        console.log(`  [${idx}]:`, {
            id: item.id,
            'Activity.code': item['Activity.code'],
            'Activity.name': item['Activity.name'],
            name: item.name || 'N/A'
        });
    });

    // DOM에서 사용자가 설정한 그룹핑 레벨 읽기
    const userGroupingLevels = Array.from(
        document.querySelectorAll('#ci-grouping-controls .group-by-select')
    )
        .map((s) => s.value)
        .filter(Boolean);

    // Activity.code를 최상위로, 사용자 설정 그룹핑을 하위로 설정
    window.ciGroupingLevels = ['Activity.code', ...userGroupingLevels];
    console.log('[DEBUG][renderCostItemsByActivityView] window.ciGroupingLevels set to:', window.ciGroupingLevels);

    console.log('[DEBUG][renderCostItemsByActivityView] Calling renderCostItemsTable with expandedItems...');
    renderCostItemsTable(expandedItems);
    console.log('[DEBUG][renderCostItemsByActivityView] ===== Activity View 렌더링 종료 =====');
}

// 전역 함수로 등록
window.toggleIndividualActivityLock = toggleIndividualActivityLock;
window.removeIndividualActivity = removeIndividualActivity;

// 전역 스코프에 노출
window.updateCiRulesetHelperPanel = updateCiRulesetHelperPanel;
window.initCiSplitBar = initCiSplitBar;
window.applyCostItemQuantityRules = applyCostItemQuantityRules;
window.showManualQuantityInputModal = showManualQuantityInputModal;
window.assignActivityToCi = assignActivityToCi;
window.clearActivitiesFromCi = clearActivitiesFromCi;
window.applyCiActivityRules = applyCiActivityRules;
window.renderCiActivitiesList = renderCiActivitiesList;
