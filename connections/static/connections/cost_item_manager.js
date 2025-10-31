

// =====================================================================
// 산출항목(CostItem) 관리 관련 함수들
// =====================================================================

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
    // 코스트아이템 탭의 details-panel 탭 전환 리스너
    const ciDetailsPanelTabs = document.querySelector('#cost-item-management .details-panel-tabs');
    if (ciDetailsPanelTabs) {
        ciDetailsPanelTabs.addEventListener('click', handleCiDetailTabClick);
    }
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
        loadedCostItems = allItems.filter(ci => ci.is_active !== false);
        console.log(`[Cost Item Manager] Loaded ${loadedCostItems.length} active CostItems (filtered ${allItems.length - loadedCostItems.length} inactive)`);
        renderCostItemsTable(loadedCostItems);

        populateCiFieldSelection(loadedCostItems);
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
            '정말로 모든 산출항목을 자동으로 다시 생성하시겠습니까?\n이 작업은 기존 자동생성된 항목을 삭제하고, 현재의 공사코드 룰셋 기준으로 새로 생성합니다.'
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
        const start = Math.min(lastSelectedCiRowIndex, clickedRowIndex);
        const end = Math.max(lastSelectedCiRowIndex, clickedRowIndex);
        if (!event.ctrlKey) selectedCiIds.clear();
        for (let i = start; i <= end; i++) {
            const rowId = allVisibleRows[i].dataset.id;
            if (rowId) selectedCiIds.add(rowId);
        }
    } else if (event.ctrlKey) {
        if (selectedCiIds.has(itemId)) selectedCiIds.delete(itemId);
        else selectedCiIds.add(itemId);
    } else {
        selectedCiIds.clear();
        selectedCiIds.add(itemId);
    }
    lastSelectedCiRowIndex = clickedRowIndex;
}

async function handleCostItemActions(event) {
    const target = event.target;
    const actionRow = target.closest('tr');
    if (!actionRow) return;

    if (actionRow.classList.contains('group-header')) {
        const groupPath = actionRow.dataset.groupPath;
        if (groupPath) {
            ciCollapsedGroups[groupPath] = !ciCollapsedGroups[groupPath];
            renderCostItemsTable(
                loadedCostItems,
                document.querySelector('#ci-table-container .ci-edit-row')
                    ?.dataset.id
            );
        }
        return;
    }

    const itemId = actionRow.dataset.id;
    const isEditRow = document.querySelector(
        '#ci-table-container .ci-edit-row'
    );

    if (!target.closest('button') && itemId) {
        handleCiRowSelection(event, actionRow);

        // 룰셋 작성 도우미 패널 업데이트 (선택된 항목이 1개일 때만)
        if (selectedCiIds.size === 1) {
            const selectedId = Array.from(selectedCiIds)[0];
            const selectedItem = loadedCostItems.find(ci => ci.id === selectedId);
            if (selectedItem) {
                updateCiRulesetHelperPanel(selectedItem);
            }
        } else {
            updateCiRulesetHelperPanel(null);
        }

        renderCostItemsTable(loadedCostItems, isEditRow?.dataset.id);
        renderCiLinkedMemberPropertiesTable();
        return;
    }

    if (!itemId) return;

    if (target.classList.contains('edit-ci-btn')) {
        if (isEditRow) {
            showToast('이미 편집 중인 항목이 있습니다.', 'error');
            return;
        }
        renderCostItemsTable(loadedCostItems, itemId);
    }
    else if (target.classList.contains('cancel-ci-btn')) {
        renderCostItemsTable(loadedCostItems);
        renderCiLinkedMemberPropertiesTable();
    }
    else if (target.classList.contains('save-ci-btn')) {
        let mapping_expression;
        try {
            const rawMappingExpr = actionRow.querySelector(
                '.ci-mapping-expression-input'
            ).value;
            mapping_expression = 
                rawMappingExpr.trim() === '' ? {} : JSON.parse(rawMappingExpr);
        } catch (e) {
            showToast('수량 맵핑식(JSON) 형식이 올바르지 않습니다.', 'error');
            return;
        }

        const itemData = {
            quantity: parseFloat(
                actionRow.querySelector('.ci-quantity-input').value
            ),
            description: actionRow.querySelector('.ci-description-input').value,
            quantity_mapping_expression: mapping_expression,
        };

        try {
            const response = await fetch(
                `/connections/api/cost-items/${currentProjectId}/${itemId}/
`, 
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken,
                    },
                    body: JSON.stringify(itemData),
                }
            );
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            showToast(result.message, 'success');
            await loadCostItems();
            renderCiLinkedMemberPropertiesTable();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
    else if (target.classList.contains('delete-ci-btn')) {
        if (!confirm('이 산출항목을 정말 삭제하시겠습니까?')) return;
        try {
            const response = await fetch(
                `/connections/api/cost-items/${currentProjectId}/${itemId}/
`, 
                {
                    method: 'DELETE',
                    headers: { 'X-CSRFToken': csrftoken },
                }
            );
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            showToast(result.message, 'success');
            selectedCiIds.delete(itemId);
            await loadCostItems();
            renderCiLinkedMemberPropertiesTable();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
}

function addCiGroupingLevel() {
    const container = document.getElementById('ci-grouping-controls');
    const newIndex = container.children.length + 1;
    const newLevelDiv = document.createElement('div');
    newLevelDiv.className = 'group-level';
    newLevelDiv.innerHTML = `<label>${newIndex}차:</label><select class="ci-group-by-select"></select><button class="remove-group-level-btn">-</button>`;
    container.appendChild(newLevelDiv);
    populateCiFieldSelection(loadedCostItems);
    newLevelDiv
        .querySelector('.remove-group-level-btn')
        .addEventListener('click', function () {
            this.parentElement.remove();
            renderCostItemsTable(loadedCostItems);
        });
}

function handleCiColumnFilter(event) {
    if (
        event.target.classList.contains('column-filter') &&
        event.key === 'Enter'
    ) {
        ciColumnFilters[event.target.dataset.field] =
            event.target.value.toLowerCase();
        renderCostItemsTable(loadedCostItems);
    }
}

function openCostCodeSelectionModal() {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById('cost-code-selection-modal');
        const searchInput = document.getElementById('cost-code-search-input');
        const listContainer = document.getElementById(
            'cost-code-list-container'
        );
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const closeBtn = modal.querySelector('.modal-close-btn');

        let selectedCostCodeId = null;

        function renderList(filterText = '') {
            listContainer.innerHTML = '';
            const filteredCodes = loadedCostCodes.filter(
                (code) =>
                    code.code.toLowerCase().includes(filterText) ||
                    code.name.toLowerCase().includes(filterText)
            );

            if (filteredCodes.length === 0) {
                listContainer.innerHTML =
                    '<div class="modal-list-item">검색 결과가 없습니다.</div>';
                return;
            }

            filteredCodes.forEach((code) => {
                const item = document.createElement('div');
                item.className = 'modal-list-item';
                item.dataset.id = code.id;
                item.innerHTML = `<span class="item-code">${code.code}</span> <span class="item-name">${code.name}</span>`;

                item.addEventListener('click', () => {
                    const currentSelected =
                        listContainer.querySelector('.selected');
                    if (currentSelected)
                        currentSelected.classList.remove('selected');

                    item.classList.add('selected');
                    selectedCostCodeId = code.id;
                    confirmBtn.disabled = false;
                });

                listContainer.appendChild(item);
            });
        }

        function closeModal() {
            modal.style.display = 'none';
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            closeBtn.onclick = null;
            searchInput.oninput = null;
        }

        confirmBtn.onclick = () => {
            if (selectedCostCodeId) {
                resolve(selectedCostCodeId);
                closeModal();
            }
        };

        cancelBtn.onclick = () => {
            reject(null);
            closeModal();
        };
        closeBtn.onclick = () => {
            reject(null);
            closeModal();
        };

        searchInput.value = '';
        selectedCostCodeId = null;
        confirmBtn.disabled = true;
        renderList();
        modal.style.display = 'flex';
    });
}

/**
 * 룰셋 작성 도우미 패널 업데이트 (코스트아이템)
 */
function updateCiRulesetHelperPanel(costItem) {
    const panel = document.getElementById('ci-ruleset-properties-content');
    if (!panel) return;

    if (!costItem) {
        panel.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">산출항목을 선택해주세요</p>';
        return;
    }

    let html = '<div style="font-size: 13px;">';

    // CostItem 기본 속성
    html += '<div style="margin-bottom: 20px;">';
    html += '<h5 style="margin: 0 0 10px 0; color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 5px;">💰 CostItem 속성</h5>';
    html += '<table class="ruleset-table" style="font-size: 12px; width: 100%;"><tbody>';
    if (costItem.quantity !== undefined) html += `<tr><td style="font-weight: bold;">quantity</td><td>${costItem.quantity}</td></tr>`;
    if (costItem.description) html += `<tr><td style="font-weight: bold;">description</td><td>${costItem.description}</td></tr>`;
    html += '</tbody></table>';
    html += '</div>';

    // QuantityMember 속성
    if (costItem.quantity_member_properties && Object.keys(costItem.quantity_member_properties).length > 0) {
        html += '<div style="margin-bottom: 20px;">';
        html += '<h5 style="margin: 0 0 10px 0; color: #f57c00; border-bottom: 2px solid #f57c00; padding-bottom: 5px;">🔢 QuantityMember (QM.)</h5>';
        html += '<table class="ruleset-table" style="font-size: 12px; width: 100%;"><tbody>';
        Object.entries(costItem.quantity_member_properties).forEach(([key, value]) => {
            if (value !== null && value !== undefined && key !== 'properties') {
                html += `<tr><td style="font-weight: bold;">QM.${key}</td><td>${value}</td></tr>`;
            }
        });
        html += '</tbody></table>';
        html += '</div>';
    }

    // MemberMark 속성
    if (costItem.member_mark_properties && Object.keys(costItem.member_mark_properties).length > 0) {
        html += '<div style="margin-bottom: 20px;">';
        html += '<h5 style="margin: 0 0 10px 0; color: #7b1fa2; border-bottom: 2px solid #7b1fa2; padding-bottom: 5px;">📋 MemberMark (MM.)</h5>';
        html += '<table class="ruleset-table" style="font-size: 12px; width: 100%;"><tbody>';
        Object.entries(costItem.member_mark_properties).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                html += `<tr><td style="font-weight: bold;">MM.${key}</td><td>${value}</td></tr>`;
            }
        });
        html += '</tbody></table>';
        html += '</div>';
    }

    // RawElement 속성 (주요 속성만)
    if (costItem.raw_element_properties && Object.keys(costItem.raw_element_properties).length > 0) {
        html += '<div style="margin-bottom: 20px;">';
        html += '<h5 style="margin: 0 0 10px 0; color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 5px;">🏗️ RawElement (RE.)</h5>';
        html += '<table class="ruleset-table" style="font-size: 12px; width: 100%;"><tbody>';

        // 중요 속성 우선 표시
        const importantProps = ['Category', 'Family', 'Type', 'Level'];
        importantProps.forEach(prop => {
            if (costItem.raw_element_properties[prop]) {
                html += `<tr><td style="font-weight: bold;">RE.${prop}</td><td>${costItem.raw_element_properties[prop]}</td></tr>`;
            }
        });

        // 나머지 속성 (제한적으로)
        let count = 0;
        Object.entries(costItem.raw_element_properties).forEach(([key, value]) => {
            if (!importantProps.includes(key) && value !== null && value !== undefined && count < 10) {
                const displayValue = String(value).substring(0, 40);
                html += `<tr><td style="font-weight: bold;">RE.${key}</td><td>${displayValue}${String(value).length > 40 ? '...' : ''}</td></tr>`;
                count++;
            }
        });

        html += '</tbody></table>';
        html += '</div>';
    }

    html += '</div>';
    panel.innerHTML = html;
}

/**
 * 코스트아이템 details-panel 탭 전환 핸들러
 */
function handleCiDetailTabClick(event) {
    const target = event.target;
    if (!target.classList.contains('detail-tab-button')) return;

    const targetTab = target.dataset.tab;
    const container = document.querySelector('#cost-item-management .details-panel');

    // 모든 탭 버튼 비활성화
    container.querySelectorAll('.detail-tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // 모든 탭 컨텐츠 숨기기
    container.querySelectorAll('.detail-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // 클릭된 탭 활성화
    target.classList.add('active');
    const targetContent = container.querySelector(`.detail-tab-content[data-tab="${targetTab}"]`);
    if (targetContent) {
        targetContent.classList.add('active');
    }
}

// 전역 스코프에 노출
window.updateCiRulesetHelperPanel = updateCiRulesetHelperPanel;
