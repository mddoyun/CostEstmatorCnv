

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
