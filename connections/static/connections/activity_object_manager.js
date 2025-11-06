// =====================================================================
// Activity Object Manager
// 액티비티 객체 관리 관련 함수들
// =====================================================================

// 전역 변수
let loadedActivityObjects = [];
window.loadedActivityObjects = [];
let selectedAoIds = new Set();
let aoGroupingLevels = [];
let allAoFields = [];

// =====================================================================
// 이벤트 리스너 설정
// =====================================================================

function setupAoListeners() {

    // 수동 생성 버튼
    document
        .getElementById('create-ao-manual-btn')
        ?.addEventListener('click', createManualActivityObject);

    // 자동 생성 버튼
    document
        .getElementById('create-ao-auto-btn')
        ?.addEventListener('click', createActivityObjectsAuto);

    // BIM 저작도구 연동 버튼들
    document
        .getElementById('ao-get-from-client-btn')
        ?.addEventListener('click', getAoSelectionFromClient);
    document
        .getElementById('ao-select-in-client-btn')
        ?.addEventListener('click', selectAoInClient);

    // 3D 뷰포트 연동 버튼들
    document
        .getElementById('ao-get-from-3d-viewer-btn')
        ?.addEventListener('click', getAoSelectionFrom3DViewer);
    document
        .getElementById('ao-select-in-3d-viewer-btn')
        ?.addEventListener('click', selectAoIn3DViewer);

    // 필드 선택 버튼들
    document
        .getElementById('ao-select-all-fields-btn')
        ?.addEventListener('click', () => toggleAllAoFields(true));
    document
        .getElementById('ao-deselect-all-fields-btn')
        ?.addEventListener('click', () => toggleAllAoFields(false));
    document
        .getElementById('ao-render-table-btn')
        ?.addEventListener('click', applyAoFieldSelection);

    // 그룹핑 적용 버튼
    document
        .getElementById('apply-ao-grouping-btn')
        ?.addEventListener('click', () => renderActivityObjectsTable(window.loadedActivityObjects));

    // 그룹핑 추가 버튼
    document
        .getElementById('add-ao-group-level-btn')
        ?.addEventListener('click', addAoGroupingLevel);

    // 필터 버튼들
    document
        .getElementById('apply-ao-filter-btn')
        ?.addEventListener('click', applyAoFilters);
    document
        .getElementById('clear-ao-filter-btn')
        ?.addEventListener('click', clearAoFilters);

    // 선택 필터 해제 버튼 (사이드바와 footer 모두)
    document
        .getElementById('ao-clear-selection-filter-btn')
        ?.addEventListener('click', clearAoSelectionFilter);
    document
        .getElementById('ao-clear-selection-filter-btn-footer')
        ?.addEventListener('click', clearAoSelectionFilter);

    // 자동 수량계산 버튼
    document
        .getElementById('ao-auto-quantity-calc-btn')
        ?.addEventListener('click', recalculateAllAoQuantities);

    // 수동 수량입력 버튼
    document
        .getElementById('ao-manual-quantity-input-btn')
        ?.addEventListener('click', showManualAoQuantityInputModal);

    // 수동입력 해제 버튼
    document
        .getElementById('ao-reset-manual-btn')
        ?.addEventListener('click', resetManualAoInput);

    // ▼▼▼ [추가] 수동 수량 산출식 업데이트 버튼 (2025-11-05) ▼▼▼
    document
        .getElementById('ao-update-formulas-btn')
        ?.addEventListener('click', updateAllAoFormulas);
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // 좌측 패널 탭 전환
    const aoLeftPanelTabs = document.querySelector('#activity-objects .left-panel-tabs');
    if (aoLeftPanelTabs) {
        aoLeftPanelTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('left-panel-tab-button')) {
                const targetTab = e.target.dataset.tab;

                // 모든 탭 버튼 비활성화
                aoLeftPanelTabs.querySelectorAll('.left-panel-tab-button').forEach(btn => {
                    btn.classList.remove('active');
                });

                // 클릭한 탭 버튼 활성화
                e.target.classList.add('active');

                // 모든 탭 콘텐츠 숨기기
                document.querySelectorAll('#activity-objects .left-panel-tab-content').forEach(content => {
                    content.classList.remove('active');
                });

                // 선택한 탭 콘텐츠 표시
                if (targetTab === 'ao-field-selection') {
                    document.getElementById('ao-field-selection-content').classList.add('active');
                } else if (targetTab === 'ao-properties') {
                    document.getElementById('ao-properties-content').classList.add('active');
                    renderAoPropertiesPanel(); // 속성 패널 업데이트
                }

                console.log('[Activity Object Manager] Switched to tab:', targetTab);
            }
        });
    }

    // 스플릿바 초기화
    initAoSplitBar();

}

// =====================================================================
// 데이터 로드
// =====================================================================

async function loadActivityObjects() {
    if (!currentProjectId) {
        renderActivityObjectsTable([]);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/activity-objects/${currentProjectId}/`
        );
        if (!response.ok)
            throw new Error('액티비티 객체 목록을 불러오는데 실패했습니다.');

        const allObjects = await response.json();
        window.loadedActivityObjects = allObjects.filter(ao => ao.is_active !== false);
        console.log(`[Activity Object Manager] Loaded ${window.loadedActivityObjects.length} active ActivityObjects`);

        // 필드 선택 UI 업데이트 후 테이블 렌더링
        populateAoFieldSelection(window.loadedActivityObjects);
        // renderAoFieldCheckboxes()가 window.currentAoColumns를 초기화하고 테이블을 렌더링합니다
    } catch (error) {
        console.error('Error loading activity objects:', error);
        showToast(error.message, 'error');
    }
}

// Window에 노출
window.loadActivityObjects = loadActivityObjects;

// =====================================================================
// 자동 생성 (액티비티코드 기준)
// =====================================================================

async function createActivityObjectsAuto() {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }

    if (!confirm('CostItem에 할당된 Activity를 기준으로 ActivityObject를 자동 생성하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(
            `/connections/api/activity-objects/auto-create/${currentProjectId}/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
            }
        );

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || '자동 생성에 실패했습니다.');

        showToast(result.message, 'success');
        await loadActivityObjects();
    } catch (error) {
        console.error('Error creating activity objects:', error);
        showToast(error.message, 'error');
    }
}

// =====================================================================
// 수동 생성
// =====================================================================

async function createManualActivityObject() {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }

    // Activity 데이터 로드 확인
    if (!window.loadedActivities || window.loadedActivities.length === 0) {
        showToast('액티비티를 먼저 불러오세요.', 'error');
        return;
    }

    // 모달 생성
    const modalHtml = `
        <div class="modal-overlay" id="create-ao-modal">
            <div class="modal-content" style="width: 600px; max-height: 80vh;">
                <h3>액티비티 객체 수동 생성</h3>
                <div style="margin: 20px 0;">
                    <label style="display: block; margin-bottom: 10px;">
                        <strong>액티비티 선택:</strong> <span style="color: red;">*</span>
                        <select id="ao-activity-select" style="width: 100%; padding: 8px; margin-top: 5px;">
                            <option value="">-- 액티비티 선택 --</option>
                            ${window.loadedActivities.map(act =>
                                `<option value="${act.id}">${act.code} - ${act.name}</option>`
                            ).join('')}
                        </select>
                    </label>

                    <label style="display: block; margin-bottom: 10px;">
                        <strong>산출항목 선택 (선택사항):</strong>
                        <select id="ao-cost-item-select" style="width: 100%; padding: 8px; margin-top: 5px;">
                            <option value="">-- 산출항목 선택 안함 --</option>
                            ${window.loadedCostItems && window.loadedCostItems.length > 0
                                ? window.loadedCostItems.map(ci =>
                                    `<option value="${ci.id}">${ci.name || ci.id} (수량: ${ci.quantity || 0})</option>`
                                  ).join('')
                                : ''}
                        </select>
                    </label>

                    <label style="display: block; margin-bottom: 10px;">
                        <strong>수량 (선택사항):</strong>
                        <input type="number" id="ao-quantity-input" placeholder="비워두면 산출항목의 수량 사용" style="width: 100%; padding: 8px; margin-top: 5px;">
                    </label>

                    <label style="display: block; margin-bottom: 10px;">
                        <strong>시작일 (선택사항):</strong>
                        <input type="date" id="ao-start-date-input" style="width: 100%; padding: 8px; margin-top: 5px;">
                    </label>

                    <label style="display: block; margin-bottom: 10px;">
                        <strong>종료일 (선택사항):</strong>
                        <input type="date" id="ao-end-date-input" style="width: 100%; padding: 8px; margin-top: 5px;">
                    </label>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="create-ao-confirm-btn" style="padding: 8px 16px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">생성</button>
                    <button id="create-ao-cancel-btn" style="padding: 8px 16px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">취소</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 이벤트 리스너
    document.getElementById('create-ao-confirm-btn').addEventListener('click', async () => {
        const costItemId = document.getElementById('ao-cost-item-select').value;
        const activityId = document.getElementById('ao-activity-select').value;
        const quantity = document.getElementById('ao-quantity-input').value;
        const startDate = document.getElementById('ao-start-date-input').value;
        const endDate = document.getElementById('ao-end-date-input').value;

        if (!activityId) {
            showToast('액티비티를 선택해주세요.', 'error');
            return;
        }

        try {
            const payload = {
                activity_id: activityId,
                is_manual: true,
                quantity: quantity ? parseFloat(quantity) : 0,  // 기본값 0
                quantity_expression: {}  // 빈 객체로 초기화
            };

            if (costItemId) payload.cost_item_id = costItemId;
            if (startDate) payload.start_date = startDate;
            if (endDate) payload.end_date = endDate;

            const response = await fetch(
                `/connections/api/activity-objects/${currentProjectId}/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken,
                    },
                    body: JSON.stringify(payload),
                }
            );

            const result = await response.json();
            if (!response.ok) throw new Error(result.message || '생성에 실패했습니다.');

            showToast(result.message, 'success');
            document.getElementById('create-ao-modal').remove();
            await loadActivityObjects();
        } catch (error) {
            console.error('Error creating activity object:', error);
            showToast(error.message, 'error');
        }
    });

    document.getElementById('create-ao-cancel-btn').addEventListener('click', () => {
        document.getElementById('create-ao-modal').remove();
    });

    // 모달 외부 클릭 시 닫기
    document.getElementById('create-ao-modal').addEventListener('click', (e) => {
        if (e.target.id === 'create-ao-modal') {
            document.getElementById('create-ao-modal').remove();
        }
    });
}

// =====================================================================
// 필드 선택 관련
// =====================================================================

function populateAoFieldSelection(activityObjects) {
    // ▼▼▼ [수정] generateAOPropertyOptions()를 사용하여 모든 속성 수집 (2025-11-05) ▼▼▼
    // 속성은 CI → QM → BIM 순으로 상속되므로, generateAOPropertyOptions()를 사용하면
    // 모든 속성이 BIM 원본 데이터와 동일한 형식으로 유지됩니다.
    const propertyOptionGroups = generateAOPropertyOptions();
    const allFields = [];

    propertyOptionGroups.forEach(group => {
        group.options.forEach(opt => {
            allFields.push({
                key: opt.value,  // 점(.) 형식 유지
                label: opt.label,
                section: extractSection(opt.label),
                fieldName: extractFieldName(opt.label),
                fieldType: extractFieldType(opt.label)
            });
        });
    });

    // 전역 변수에 저장
    allAoFields = allFields;
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    renderAoFieldCheckboxes();
}

function renderAoFieldCheckboxes() {
    const container = document.getElementById('ao-field-checkboxes-container');
    if (!container) return;

    // ▼▼▼ [수정] 통일된 그룹핑 시스템 사용 - 첫 번째 접두어만 (2025-11-05) ▼▼▼
    // 현재 선택된 컬럼 (없으면 기본값)
    if (!window.currentAoColumns) {
        window.currentAoColumns = allAoFields.filter(f => f.label && f.label.startsWith('AO.')).map(f => f.key);
    }

    // 첫 번째 접두어로 그룹핑
    const groupedFields = groupFieldsByPrefix(allAoFields);
    const sectionDefs = getSectionDefinitions();

    let html = '';

    // 정의된 섹션 순서대로 렌더링
    sectionDefs.forEach(section => {
        const fields = groupedFields[section.key];
        if (fields && fields.length > 0) {
            html += '<div class="field-section">';
            html += `<h4 style="color: ${section.color}; margin: 10px 0 5px 0; font-size: 14px;">${section.title}</h4>`;

            // ▼▼▼ [수정] 필드를 label 기준으로 오름차순 정렬 (2025-11-05) ▼▼▼
            const sortedFields = [...fields].sort((a, b) => {
                const labelA = a.label || '';
                const labelB = b.label || '';
                return labelA.localeCompare(labelB, 'ko');
            });

            sortedFields.forEach(field => {
                const isChecked = window.currentAoColumns.includes(field.key) ? 'checked' : '';
                html += `
                    <label class="field-checkbox-label">
                        <input
                            type="checkbox"
                            class="ao-field-checkbox"
                            value="${field.key}"
                            data-field-type="${field.fieldType || ''}"
                            ${isChecked}
                        >
                        ${field.label}
                    </label>
                `;
            });
            // ▲▲▲ [수정] 여기까지 ▲▲▲

            html += '</div>';
        }
    });

    // 정의되지 않은 동적 섹션도 렌더링
    Object.keys(groupedFields).forEach(prefix => {
        const isDefined = sectionDefs.some(s => s.key === prefix);
        if (!isDefined) {
            const fields = groupedFields[prefix];
            if (fields && fields.length > 0) {
                html += '<div class="field-section">';
                html += `<h4 style="color: #607d8b; margin: 10px 0 5px 0; font-size: 14px;">📦 ${prefix} 속성</h4>`;

                // ▼▼▼ [수정] 필드를 label 기준으로 오름차순 정렬 (2025-11-05) ▼▼▼
                const sortedFields = [...fields].sort((a, b) => {
                    const labelA = a.label || '';
                    const labelB = b.label || '';
                    return labelA.localeCompare(labelB, 'ko');
                });

                sortedFields.forEach(field => {
                    const isChecked = window.currentAoColumns.includes(field.key) ? 'checked' : '';
                    html += `
                        <label class="field-checkbox-label">
                            <input
                                type="checkbox"
                                class="ao-field-checkbox"
                                value="${field.key}"
                                ${isChecked}
                            >
                            ${field.label}
                        </label>
                    `;
                });
                // ▲▲▲ [수정] 여기까지 ▲▲▲

                html += '</div>';
            }
        }
    });
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    container.innerHTML = html;

    // 이벤트 리스너 추가
    container.querySelectorAll('.ao-field-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const checkedBoxes = container.querySelectorAll('.ao-field-checkbox:checked');
            window.currentAoColumns = Array.from(checkedBoxes).map(cb => cb.value);
            console.log('[Activity Object Manager] Updated currentAoColumns:', window.currentAoColumns);
            renderActivityObjectsTable(window.loadedActivityObjects);
        });
    });

    // 초기 렌더링: 기본 선택된 컬럼으로 테이블 표시
    // 빈 배열일 때도 테이블 렌더링 (빈 테이블 헤더 표시)
    renderActivityObjectsTable(window.loadedActivityObjects || []);
}

function toggleAllAoFields(checked) {
    const container = document.getElementById('ao-field-checkboxes-container');
    if (!container) return;

    const checkboxes = container.querySelectorAll('.ao-field-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);

    // window.currentAoColumns 업데이트
    if (checked) {
        window.currentAoColumns = Array.from(checkboxes).map(cb => cb.value);
    } else {
        window.currentAoColumns = [];
    }

    console.log('[Activity Object Manager] Toggled all fields:', checked, window.currentAoColumns);
    renderActivityObjectsTable(window.loadedActivityObjects);
}

function applyAoFieldSelection() {
    // 이미 체크박스 변경 시 자동으로 업데이트되지만, 명시적으로 재렌더링
    renderActivityObjectsTable(window.loadedActivityObjects);
    showToast('선택한 필드로 테이블을 업데이트했습니다.', 'success');
}

// =====================================================================
// 테이블 렌더링 (기본)
// =====================================================================

function renderActivityObjectsTable(activityObjects) {
    const container = document.getElementById('ao-table-container');
    if (!container) return;

    // window.currentAoColumns 사용
    const selectedFields = window.currentAoColumns || [];
    if (selectedFields.length === 0) {
        container.innerHTML = '<p>표시할 필드를 선택하세요.</p>';
        return;
    }

    // 빈 배열일 때: 테이블 헤더는 표시하고 빈 메시지 표시
    if (!activityObjects || activityObjects.length === 0) {
        // Clear property panel
        const propertyPanel = document.getElementById('ao-properties-content');
        if (propertyPanel) {
            propertyPanel.innerHTML = '<p>선택된 액티비티 객체가 없습니다.</p>';
        }

        // Clear selection state
        selectedAoIds.clear();


        // 테이블 헤더는 표시하되 빈 메시지 표시 (다른 탭들과 일관성 유지)
        const table = document.createElement('table');
        table.className = 'data-table';

        // 헤더
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        // 선택 체크박스 컬럼
        const checkboxTh = document.createElement('th');
        checkboxTh.style.width = '40px';
        checkboxTh.textContent = '';
        headerRow.appendChild(checkboxTh);

        // 선택된 필드 헤더들
        selectedFields.forEach(fieldPath => {
            const th = document.createElement('th');
            th.textContent = fieldPath;
            headerRow.appendChild(th);
        });

        // 삭제 버튼 컬럼
        const deleteTh = document.createElement('th');
        deleteTh.style.width = '80px';
        deleteTh.textContent = '작업';
        headerRow.appendChild(deleteTh);

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // 빈 tbody with message
        const tbody = document.createElement('tbody');
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = selectedFields.length + 2; // +2 for checkbox and delete columns
        emptyCell.style.textAlign = 'center';
        emptyCell.style.padding = '20px';
        emptyCell.textContent = '액티비티 객체가 없습니다.';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        table.appendChild(tbody);

        container.innerHTML = '';
        container.appendChild(table);
        return;
    }

    // 선택 필터 적용 (3D 뷰포트나 BIM 저작도구에서 선택한 객체만 표시)
    let filteredObjects = activityObjects;
    if (window.isAoFilterToSelectionActive && window.aoFilteredIds && window.aoFilteredIds.size > 0) {
        filteredObjects = activityObjects.filter(ao => window.aoFilteredIds.has(ao.id));
    }

    // 그룹핑 적용
    let displayData = applyAoGrouping(filteredObjects);

    // 기본 테이블 생성
    const table = document.createElement('table');
    table.className = 'data-table';

    // 헤더
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // 선택 체크박스 컬럼
    const checkboxTh = document.createElement('th');
    checkboxTh.style.width = '40px';
    const headerCheckbox = document.createElement('input');
    headerCheckbox.type = 'checkbox';
    headerCheckbox.addEventListener('change', (e) => {
        const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const aoId = cb.dataset.aoId;
            if (e.target.checked) {
                selectedAoIds.add(aoId);
            } else {
                selectedAoIds.delete(aoId);
            }
        });
    });
    checkboxTh.appendChild(headerCheckbox);
    headerRow.appendChild(checkboxTh);

    // 필드 헤더 (필터 입력 포함)
    selectedFields.forEach(field => {
        const th = document.createElement('th');
        th.style.minWidth = '120px';

        // 필드명
        const label = document.createElement('div');
        label.textContent = field;
        label.style.marginBottom = '4px';
        th.appendChild(label);

        // 필터 입력
        const filterInput = document.createElement('input');
        filterInput.type = 'text';
        filterInput.className = 'ao-filter-input';
        filterInput.dataset.field = field;
        filterInput.placeholder = '필터...';
        filterInput.style.width = '100%';
        filterInput.style.padding = '2px 4px';
        filterInput.style.fontSize = '12px';
        filterInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyAoFilter();
            }
        });
        th.appendChild(filterInput);

        headerRow.appendChild(th);
    });

    // 액션 컬럼
    const actionTh = document.createElement('th');
    actionTh.textContent = '액션';
    actionTh.style.width = '200px';
    headerRow.appendChild(actionTh);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 바디
    const tbody = document.createElement('tbody');

    // 재귀적으로 그룹과 행 렌더링
    function renderGroupOrRows(items, level = 0) {
        items.forEach(item => {
            if (item.isGroup) {
                // 그룹 헤더 행
                const groupRow = document.createElement('tr');
                groupRow.className = `group-header-row group-level-${item.groupLevel || level}`;
                groupRow.dataset.groupLevel = item.groupLevel || level;

                const groupTd = document.createElement('td');
                groupTd.colSpan = selectedFields.length + 2;

                // 들여쓰기
                const indent = '&nbsp;&nbsp;'.repeat(item.groupLevel || level);
                groupTd.innerHTML = `${indent}▼ ${item.groupKey}: ${item.groupValue} (${countAoItems(item.items)}개)`;

                groupTd.style.fontWeight = 'bold';
                groupTd.style.padding = '8px';
                groupTd.style.cursor = 'pointer';

                groupTd.addEventListener('click', function() {
                    toggleAoGroupRows(groupRow);
                });

                groupRow.appendChild(groupTd);
                tbody.appendChild(groupRow);

                // 그룹 아이템들 (재귀적으로)
                renderGroupOrRows(item.items, (item.groupLevel || level) + 1);
            } else {
                tbody.appendChild(createAoRow(item, selectedFields));
            }
        });
    }

    renderGroupOrRows(displayData);

    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
}

// 그룹 내 실제 아이템 개수 세기
function countAoItems(items) {
    let count = 0;
    items.forEach(item => {
        if (item.isGroup) {
            count += countAoItems(item.items);
        } else {
            count++;
        }
    });
    return count;
}

// 그룹 행 토글
function toggleAoGroupRows(groupRow) {
    const groupLevel = parseInt(groupRow.dataset.groupLevel || '0');
    const groupTd = groupRow.querySelector('td');
    const isCollapsed = groupTd.innerHTML.includes('▶');

    let sibling = groupRow.nextElementSibling;
    while (sibling) {
        // 같은 레벨 또는 더 낮은 레벨의 그룹을 만나면 중단
        if (sibling.classList.contains('group-header-row')) {
            const siblingLevel = parseInt(sibling.dataset.groupLevel || '0');
            if (siblingLevel <= groupLevel) {
                break;
            }
        }

        // 표시/숨김 토글
        sibling.style.display = isCollapsed ? '' : 'none';
        sibling = sibling.nextElementSibling;
    }

    // 아이콘 변경
    groupTd.innerHTML = isCollapsed
        ? groupTd.innerHTML.replace('▶', '▼')
        : groupTd.innerHTML.replace('▼', '▶');
}

function createAoRow(ao, selectedFields) {
    const row = document.createElement('tr');
    row.dataset.aoId = ao.id;

    // 선택된 행 하이라이트
    if (selectedAoIds.has(ao.id)) {
        row.classList.add('selected-row');
    }

    // 체크박스
    const checkboxTd = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.aoId = ao.id;
    checkbox.checked = selectedAoIds.has(ao.id);
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            selectedAoIds.add(ao.id);
            row.classList.add('selected-row');
        } else {
            selectedAoIds.delete(ao.id);
            row.classList.remove('selected-row');
        }
        renderAoPropertiesPanel();
    });
    checkboxTd.appendChild(checkbox);
    row.appendChild(checkboxTd);

    // 필드 값들
    selectedFields.forEach(field => {
        const td = document.createElement('td');
        td.textContent = getAoFieldValue(ao, field);
        row.appendChild(td);
    });

    // 액션 버튼들
    const actionTd = document.createElement('td');
    actionTd.style.whiteSpace = 'nowrap';

    if (ao.is_manual) {
        const clearManualBtn = document.createElement('button');
        clearManualBtn.textContent = '수동입력 해제';
        clearManualBtn.className = 'small-button';
        clearManualBtn.style.fontSize = '11px';
        clearManualBtn.style.padding = '4px 8px';
        clearManualBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 행 클릭 이벤트 방지
            clearManualInput(ao.id);
        });
        actionTd.appendChild(clearManualBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '삭제';
    deleteBtn.className = 'small-button danger-button';
    deleteBtn.style.fontSize = '11px';
    deleteBtn.style.padding = '4px 8px';
    deleteBtn.style.marginLeft = '4px';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 행 클릭 이벤트 방지
        deleteActivityObject(ao.id);
    });
    actionTd.appendChild(deleteBtn);

    row.appendChild(actionTd);

    // 행에 pointer cursor 추가
    row.style.cursor = 'pointer';

    // 행 클릭 시 체크박스 토글 및 속성 패널 표시
    row.addEventListener('click', (e) => {
        // 체크박스나 버튼 클릭 시에는 무시
        if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON') {
            return;
        }

        // 체크박스 토글
        checkbox.checked = !checkbox.checked;
        if (checkbox.checked) {
            selectedAoIds.add(ao.id);
            row.classList.add('selected-row');
        } else {
            selectedAoIds.delete(ao.id);
            row.classList.remove('selected-row');
        }
        renderAoPropertiesPanel();
    });

    return row;
}

function getAoFieldValue(ao, field) {
    if (!field) return '';

    // ▼▼▼ [수정] 점 형식과 언더스코어 형식 모두 지원 (2025-11-05) ▼▼▼

    // AO.System.* 필드 (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('AO.System.') || field.startsWith('AO_System_')) {
        const fieldName = field.startsWith('AO.System.')
            ? field.substring(10)  // 'AO.System.' 제거
            : field.substring(10); // 'AO_System_' 제거
        return ao[fieldName] ?? '';
    }

    // AC.System.* 필드 (Activity) (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('AC.System.') || field.startsWith('AC_System_')) {
        const fieldName = field.startsWith('AC.System.')
            ? field.substring(10)  // 'AC.System.' 제거
            : field.substring(10); // 'AC_System_' 제거
        return ao.activity?.[fieldName] ?? '';
    }

    // CI.System.* 필드 (CostItem) (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('CI.System.') || field.startsWith('CI_System_')) {
        const fieldName = field.startsWith('CI.System.')
            ? field.substring(10)  // 'CI.System.' 제거
            : field.substring(10); // 'CI_System_' 제거
        return ao.cost_item?.[fieldName] ?? '';
    }

    // CI.Properties.* 필드 (CostItem properties) (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('CI.Properties.') || field.startsWith('CI_Properties_')) {
        const propName = field.startsWith('CI.Properties.')
            ? field.substring(14)  // 'CI.Properties.' 제거
            : field.substring(14); // 'CI_Properties_' 제거
        return ao.cost_item?.properties?.[propName] ?? '';
    }

    // CC.System.* 필드 (CostCode) (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('CC.System.') || field.startsWith('CC_System_')) {
        const fieldName = field.startsWith('CC.System.')
            ? field.substring(10)  // 'CC.System.' 제거
            : field.substring(10); // 'CC_System_' 제거
        return ao.cost_code?.[fieldName] ?? '';
    }

    // QM.System.* 필드 (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('QM.System.') || field.startsWith('QM_System_')) {
        const fieldName = field.startsWith('QM.System.')
            ? field.substring(10)  // 'QM.System.' 제거
            : field.substring(10); // 'QM_System_' 제거
        return ao.quantity_member?.[fieldName] ?? '';
    }

    // QM.Properties.* 필드 (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('QM.Properties.') || field.startsWith('QM_Properties_')) {
        const propName = field.startsWith('QM.Properties.')
            ? field.substring(14)  // 'QM.Properties.' 제거
            : field.substring(14); // 'QM_Properties_' 제거
        return ao.quantity_member?.properties?.[propName] ?? '';
    }

    // MM.System.* 필드 (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('MM.System.') || field.startsWith('MM_System_')) {
        const fieldName = field.startsWith('MM.System.')
            ? field.substring(10)  // 'MM.System.' 제거
            : field.substring(10); // 'MM_System_' 제거
        return ao.member_mark?.[fieldName] ?? '';
    }

    // MM.Properties.* 필드 (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('MM.Properties.') || field.startsWith('MM_Properties_')) {
        const propName = field.startsWith('MM.Properties.')
            ? field.substring(14)  // 'MM.Properties.' 제거
            : field.substring(14); // 'MM_Properties_' 제거
        return ao.member_mark?.properties?.[propName] ?? '';
    }

    // SC.System.* 필드 (Space) (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('SC.System.') || field.startsWith('SC_System_')) {
        const fieldName = field.startsWith('SC.System.')
            ? field.substring(10)  // 'SC.System.' 제거
            : field.substring(10); // 'SC_System_' 제거
        return ao.space?.[fieldName] ?? '';
    }

    // SC.Properties.* 필드 (Space properties) (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('SC.Properties.') || field.startsWith('SC_Properties_')) {
        const propName = field.startsWith('SC.Properties.')
            ? field.substring(14)  // 'SC.Properties.' 제거
            : field.substring(14); // 'SC_Properties_' 제거
        return ao.space?.properties?.[propName] ?? '';
    }

    // BIM.System.* 필드 (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('BIM.System.') || field.startsWith('BIM_System_')) {
        const sysName = field.startsWith('BIM.System.')
            ? field.substring(11)  // 'BIM.System.' 제거
            : field.substring(11); // 'BIM_System_' 제거
        return ao.raw_data?.[sysName] ?? '';
    }

    // BIM.Attributes.* 필드 (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('BIM.Attributes.') || field.startsWith('BIM_Attributes_')) {
        const attrName = field.startsWith('BIM.Attributes.')
            ? field.substring(15)  // 'BIM.Attributes.' 제거
            : field.substring(15); // 'BIM_Attributes_' 제거
        return ao.raw_data?.[attrName] ?? '';
    }

    // BIM.Parameters.* 필드 (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('BIM.Parameters.') || field.startsWith('BIM_Parameters_')) {
        const paramName = field.startsWith('BIM.Parameters.')
            ? field.substring(15)  // 'BIM.Parameters.' 제거
            : field.substring(15); // 'BIM_Parameters_' 제거
        return ao.raw_data?.Parameters?.[paramName] ?? '';
    }

    // BIM.TypeParameters.* 필드 (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('BIM.TypeParameters.') || field.startsWith('BIM_TypeParameters_')) {
        const tparamName = field.startsWith('BIM.TypeParameters.')
            ? field.substring(19)  // 'BIM.TypeParameters.' 제거
            : field.substring(19); // 'BIM_TypeParameters_' 제거
        return ao.raw_data?.TypeParameters?.[tparamName] ?? '';
    }

    // BIM.QuantitySet.* 필드 (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('BIM.QuantitySet.') || field.startsWith('BIM_QuantitySet_')) {
        const qsName = field.startsWith('BIM.QuantitySet.')
            ? field.substring(16)  // 'BIM.QuantitySet.' 제거
            : field.substring(16); // 'BIM_QuantitySet_' 제거
        return ao.raw_data?.[`QuantitySet.${qsName}`] ?? '';
    }

    // BIM.PropertySet.* 필드 (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('BIM.PropertySet.') || field.startsWith('BIM_PropertySet_')) {
        const psName = field.startsWith('BIM.PropertySet.')
            ? field.substring(16)  // 'BIM.PropertySet.' 제거
            : field.substring(16); // 'BIM_PropertySet_' 제거
        return ao.raw_data?.[`PropertySet.${psName}`] ?? '';
    }

    // BIM.Spatial_Container.* 필드 (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('BIM.Spatial_Container.') || field.startsWith('BIM_Spatial_Container_')) {
        const scName = field.startsWith('BIM.Spatial_Container.')
            ? field.substring(22)  // 'BIM.Spatial_Container.' 제거
            : field.substring(22); // 'BIM_Spatial_Container_' 제거
        return ao.raw_data?.[`Spatial_Container.${scName}`] ?? '';
    }

    // BIM.Type.* 필드 (점 형식과 언더스코어 형식 모두 지원)
    if (field.startsWith('BIM.Type.') || field.startsWith('BIM_Type_')) {
        const typeName = field.startsWith('BIM.Type.')
            ? field.substring(9)  // 'BIM.Type.' 제거
            : field.substring(9); // 'BIM_Type_' 제거
        return ao.raw_data?.[`Type.${typeName}`] ?? '';
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    return '';
}

// =====================================================================
// 그룹핑
// =====================================================================

function applyAoGrouping(activityObjects) {
    // 동적으로 그룹핑 레벨 읽기
    updateAoGroupingLevels();

    if (aoGroupingLevels.length === 0) {
        return activityObjects;
    }

    // 재귀적 다단계 그룹핑
    return groupAoByLevels(activityObjects, aoGroupingLevels, 0);
}

function groupAoByLevels(items, groupFields, currentLevel) {
    if (currentLevel >= groupFields.length || groupFields.length === 0) {
        return items;
    }

    const currentField = groupFields[currentLevel];
    const groups = {};

    items.forEach(item => {
        const value = getAoFieldValue(item, currentField) || '(비어있음)';
        if (!groups[value]) {
            groups[value] = [];
        }
        groups[value].push(item);
    });

    const result = [];
    Object.entries(groups).forEach(([value, groupItems]) => {
        // 다음 레벨이 있으면 재귀적으로 그룹핑
        const subItems = currentLevel + 1 < groupFields.length
            ? groupAoByLevels(groupItems, groupFields, currentLevel + 1)
            : groupItems;

        result.push({
            isGroup: true,
            groupKey: currentField,
            groupValue: value,
            groupLevel: currentLevel,
            items: subItems
        });
    });

    return result;
}

function addAoGroupingLevel() {
    const container = document.getElementById('ao-grouping-controls');
    if (!container) return;

    const newLevelDiv = document.createElement('div');
    newLevelDiv.className = 'group-level';

    const select = document.createElement('select');
    select.className = 'group-by-select';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- 필드 선택 --';
    select.appendChild(defaultOption);

    allAoFields.forEach(field => {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = field;
        select.appendChild(option);
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-group-level-btn';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', function() {
        newLevelDiv.remove();
        updateAoGroupingLevels();
    });

    newLevelDiv.appendChild(select);
    newLevelDiv.appendChild(removeBtn);
    container.appendChild(newLevelDiv);
}

function updateAoGroupingLevels() {
    const container = document.getElementById('ao-grouping-controls');
    if (!container) return;

    const selects = container.querySelectorAll('.group-by-select');
    aoGroupingLevels = Array.from(selects).map(s => s.value).filter(v => v);
}

// =====================================================================
// 필터
// =====================================================================

// 필터 상태 저장
if (typeof window.aoColumnFilters === 'undefined') {
    window.aoColumnFilters = {};
}

function applyAoFilter() {
    // 모든 필터 입력에서 값 수집
    const filterInputs = document.querySelectorAll('.ao-filter-input');
    window.aoColumnFilters = {};

    filterInputs.forEach(input => {
        const field = input.dataset.field;
        const value = input.value.trim();
        if (value) {
            window.aoColumnFilters[field] = value.toLowerCase();
        }
    });

    // 필터링 적용
    const filtered = applyAoColumnFilters(window.loadedActivityObjects);
    renderActivityObjectsTable(filtered);
    showToast('필터가 적용되었습니다.', 'success');
}

function applyAoFilters() {
    applyAoFilter();
}

function clearAoFilters() {
    window.aoColumnFilters = {};
    // 필터 입력 필드 초기화
    const filterInputs = document.querySelectorAll('.ao-filter-input');
    filterInputs.forEach(input => {
        input.value = '';
    });
    renderActivityObjectsTable(window.loadedActivityObjects);
    showToast('필터가 초기화되었습니다.', 'success');
}

function applyAoColumnFilters(activityObjects) {
    if (!window.aoColumnFilters || Object.keys(window.aoColumnFilters).length === 0) {
        return activityObjects;
    }

    return activityObjects.filter(ao => {
        for (const field in window.aoColumnFilters) {
            const filterValue = window.aoColumnFilters[field];
            const aoValue = String(getAoFieldValue(ao, field) || '').toLowerCase();
            if (!aoValue.includes(filterValue)) {
                return false;
            }
        }
        return true;
    });
}

function clearAoSelectionFilter() {

    // 필터 비활성화
    window.isAoFilterToSelectionActive = false;
    if (window.aoFilteredIds) {
        window.aoFilteredIds.clear();
    }

    // 버튼 숨기기 (사이드바 버튼과 테이블 하단 버튼 모두)
    const clearBtnSidebar = document.getElementById('ao-clear-selection-filter-btn');
    const clearBtnFooter = document.getElementById('ao-clear-selection-filter-btn-footer');

    if (clearBtnSidebar) {
        clearBtnSidebar.style.display = 'none';
    }
    if (clearBtnFooter) {
        clearBtnFooter.style.display = 'none';
    }

    // 테이블 다시 렌더링 (필터 없이)
    renderActivityObjectsTable(window.loadedActivityObjects);

    showToast('선택 필터가 해제되었습니다.', 'success');
}

// =====================================================================
// 속성 패널
// =====================================================================

function renderAoPropertiesPanel() {
    const container = document.getElementById('ao-selected-properties-container');
    if (!container) return;

    if (selectedAoIds.size !== 1) {
        container.innerHTML = '<p>액티비티 객체를 하나만 선택하세요.</p>';
        return;
    }

    const aoId = Array.from(selectedAoIds)[0];
    const ao = window.loadedActivityObjects.find(obj => obj.id === aoId);
    if (!ao) {
        container.innerHTML = '<p>선택한 객체를 찾을 수 없습니다.</p>';
        return;
    }

    // ▼▼▼ [디버깅] 데이터 구조 확인 (2025-11-05) ▼▼▼
    // ▲▲▲ [디버깅] 여기까지 ▲▲▲

    // ▼▼▼ [수정] allAoFields가 비어있으면 초기화 (2025-11-05) ▼▼▼
    if (!allAoFields || allAoFields.length === 0) {
        populateAoFieldSelection([ao]);
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // ▼▼▼ [수정] 필드 선택과 동일한 그룹 구조로 변경 (2025-11-05) ▼▼▼
    // 모든 필드를 그룹핑
    const groupedFields = groupFieldsByPrefix(allAoFields);
    const sectionDefs = getSectionDefinitions();

    let html = '';

    // 정의된 섹션 순서대로 렌더링
    sectionDefs.forEach(section => {
        const fields = groupedFields[section.key];
        if (fields && fields.length > 0) {
            // 필드를 label 기준으로 오름차순 정렬
            const sortedFields = [...fields].sort((a, b) => {
                const labelA = a.label || '';
                const labelB = b.label || '';
                return labelA.localeCompare(labelB, 'ko');
            });

            // 값이 있는 필드만 필터링
            const fieldsWithValues = sortedFields.filter(field => {
                const value = getAoFieldValue(ao, field.key);
                return value !== null && value !== undefined && value !== '';
            });

            // 값이 있는 필드가 있을 때만 섹션 표시
            if (fieldsWithValues.length > 0) {
                html += '<div class="property-section">';
                html += `<h4 style="color: ${section.color}; border-bottom: 2px solid ${section.color}; padding-bottom: 5px;">${section.title}</h4>`;
                html += '<table class="properties-table"><tbody>';

                fieldsWithValues.forEach(field => {
                    const value = getAoFieldValue(ao, field.key);
                    let displayValue = value;

                    // 숫자 값 포맷팅
                    if (typeof value === 'number') {
                        displayValue = value.toFixed(3);
                    } else if (typeof value === 'object') {
                        displayValue = JSON.stringify(value).substring(0, 100);
                    } else if (typeof value === 'string') {
                        displayValue = value.substring(0, 200);
                    }

                    html += `<tr><td class="prop-name">${field.label}</td><td class="prop-value">${displayValue}</td></tr>`;
                });

                html += '</tbody></table>';
                html += '</div>';
            }
        }
    });

    // 정의되지 않은 동적 섹션도 렌더링
    Object.keys(groupedFields).forEach(prefix => {
        const isDefined = sectionDefs.some(s => s.key === prefix);
        if (!isDefined) {
            const fields = groupedFields[prefix];
            if (fields && fields.length > 0) {
                // 필드를 label 기준으로 오름차순 정렬
                const sortedFields = [...fields].sort((a, b) => {
                    const labelA = a.label || '';
                    const labelB = b.label || '';
                    return labelA.localeCompare(labelB, 'ko');
                });

                // 값이 있는 필드만 필터링
                const fieldsWithValues = sortedFields.filter(field => {
                    const value = getAoFieldValue(ao, field.key);
                    return value !== null && value !== undefined && value !== '';
                });

                // 값이 있는 필드가 있을 때만 섹션 표시
                if (fieldsWithValues.length > 0) {
                    html += '<div class="property-section">';
                    html += `<h4 style="color: #607d8b; border-bottom: 2px solid #607d8b; padding-bottom: 5px;">📦 ${prefix} 속성</h4>`;
                    html += '<table class="properties-table"><tbody>';

                    fieldsWithValues.forEach(field => {
                        const value = getAoFieldValue(ao, field.key);
                        let displayValue = value;

                        // 숫자 값 포맷팅
                        if (typeof value === 'number') {
                            displayValue = value.toFixed(3);
                        } else if (typeof value === 'object') {
                            displayValue = JSON.stringify(value).substring(0, 100);
                        } else if (typeof value === 'string') {
                            displayValue = value.substring(0, 200);
                        }

                        html += `<tr><td class="prop-name">${field.label}</td><td class="prop-value">${displayValue}</td></tr>`;
                    });

                    html += '</tbody></table>';
                    html += '</div>';
                }
            }
        }
    });
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    container.innerHTML = html;
}

// =====================================================================
// 수동 수량입력
// =====================================================================

function showManualAoQuantityInputModal() {
    const selectedActivityObjects = Array.from(selectedAoIds || []);
    if (!selectedActivityObjects || selectedActivityObjects.length === 0) {
        showToast('항목을 먼저 선택하세요.', 'error');
        return;
    }

    const selectedItems = window.loadedActivityObjects.filter(item => selectedActivityObjects.includes(item.id));

    // 이전에 저장된 quantity_expression 확인
    let previousExpression = null;
    let previousMode = 'direct';
    let previousValue = '';
    let previousFormula = '';

    // 첫 번째 선택 항목의 표현식 확인 (여러 항목이 선택된 경우 첫 번째 것 사용)
    if (selectedItems.length > 0 && selectedItems[0].quantity_expression) {
        previousExpression = selectedItems[0].quantity_expression;
        if (previousExpression.mode === 'direct') {
            previousMode = 'direct';
            previousValue = previousExpression.value || '';
        } else if (previousExpression.mode === 'formula') {
            previousMode = 'formula';
            previousFormula = previousExpression.formula || '';
        }
    }

    // 모달 HTML 생성
    const modal = document.createElement('div');
    modal.id = 'manual-ao-quantity-input-modal';
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

    // 속성 옵션 생성 - populateAoFieldSelection()과 동일하게 generateAOPropertyOptions() 사용
    let propertyOptions = '<option value="">-- 속성 선택 --</option>';

    if (selectedItems.length > 0) {
        // ▼▼▼ [수정] generateAOPropertyOptions()를 사용하여 필드선택 탭과 동일한 속성 리스트 생성 (2025-11-05) ▼▼▼
        const propertyOptionGroups = generateAOPropertyOptions();

        // propertyOptionGroups에서 직접 optgroup 생성
        propertyOptionGroups.forEach(group => {
            propertyOptions += `<optgroup label="${group.group}">`;
            group.options.forEach(opt => {
                // opt.value는 이미 "AO.quantity" 형식이므로 중괄호로 감싸기만 하면 됨
                propertyOptions += `<option value="{${opt.value}}">${opt.label}</option>`;
            });
            propertyOptions += '</optgroup>';
        });
        // ▲▲▲ [수정] 여기까지 ▲▲▲
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
                    <textarea id="formula-quantity-input" placeholder="예: {CI.quantity} * 2.5 + {QM.volume} * 0.1"
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
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dee2e6;">Activity Code</th>
                            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #dee2e6;">현재 수량</th>
                            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #dee2e6;">기간</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${selectedItems.map(item => `
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${item.activity?.code || '-'}</td>
                                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #f0f0f0;">${item.quantity || 0}</td>
                                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #f0f0f0;">${item.actual_duration || 0}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button id="manual-ao-quantity-cancel-btn" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    취소
                </button>
                <button id="manual-ao-quantity-apply-btn" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">
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
    modal.querySelector('#manual-ao-quantity-cancel-btn')?.addEventListener('click', () => {
        modal.remove();
    });

    // 적용 버튼
    modal.querySelector('#manual-ao-quantity-apply-btn')?.addEventListener('click', async () => {
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


                for (const item of selectedItems) {
                    const updateData = {
                        quantity: directValue,
                        actual_duration: directValue,  // actual_duration도 함께 업데이트
                        is_manual: true,
                        manual_formula: '',  // null 대신 빈 문자열
                        quantity_expression: {
                            mode: 'direct',
                            value: directValue
                        }
                    };

                    const saveResponse = await fetch(`/connections/api/activity-objects/${currentProjectId}/${item.id}/`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrftoken,
                        },
                        body: JSON.stringify(updateData),
                    });

                    if (saveResponse.ok) {
                        updatedCount++;
                    } else {
                        const errorText = await saveResponse.text();
                    }
                }
            } else {
                // 산식 입력 모드
                const formula = modal.querySelector('#formula-quantity-input').value.trim();

                if (!formula) {
                    showToast('수량 산식을 입력하세요.', 'error');
                    return;
                }


                for (const item of selectedItems) {
                    const aoContext = buildAoContext(item);
                    const calculatedQuantity = evaluateQuantityFormula(formula, aoContext);

                    if (calculatedQuantity !== null && !isNaN(calculatedQuantity)) {
                        const updateData = {
                            quantity: calculatedQuantity,
                            actual_duration: calculatedQuantity,  // actual_duration도 함께 업데이트
                            is_manual: true,
                            manual_formula: formula,
                            quantity_expression: {
                                mode: 'formula',
                                formula: formula
                            }
                        };

                        const saveResponse = await fetch(`/connections/api/activity-objects/${currentProjectId}/${item.id}/`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': csrftoken,
                            },
                            body: JSON.stringify(updateData),
                        });

                        if (saveResponse.ok) {
                            updatedCount++;
                        } else {
                            const errorText = await saveResponse.text();
                        }
                    } else {
                    }
                }
            }

            // 테이블 갱신
            await loadActivityObjects();
            showToast(`${updatedCount}개 항목의 수량이 업데이트되었습니다.`, 'success');
            modal.remove();

        } catch (error) {
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

async function clearManualInput(aoId) {

    if (!aoId) {
        showToast('액티비티 객체 ID가 없습니다.', 'error');
        return;
    }

    try {
        // 현재 객체 정보 가져오기
        const ao = window.loadedActivityObjects.find(item => item.id === aoId);
        if (!ao) {
            showToast('액티비티 객체를 찾을 수 없습니다.', 'error');
            return;
        }

        // 자동 계산 값 계산
        const durationPerUnit = ao.activity?.duration_per_unit || 0;
        const ciQuantity = ao.cost_item?.quantity || 0;
        const autoQuantity = durationPerUnit * ciQuantity;


        // 자동 계산 모드로 변경하는 데이터
        const updateData = {
            quantity: autoQuantity,
            actual_duration: autoQuantity,
            is_manual: false,
            manual_formula: '',
            quantity_expression: {}
        };


        // API 요청
        const response = await fetch(`/connections/api/activity-objects/${currentProjectId}/${aoId}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            showToast('수동입력 해제 실패: ' + response.status, 'error');
            return;
        }

        const updatedAo = await response.json();

        // 전역 데이터 업데이트
        const index = window.loadedActivityObjects.findIndex(item => item.id === aoId);
        if (index !== -1) {
            window.loadedActivityObjects[index] = updatedAo;
        }

        // UI 리프레시
        await loadActivityObjects();

        showToast('수동입력이 해제되었습니다.', 'success');

    } catch (error) {
        showToast('수동입력 해제 중 오류 발생', 'error');
    }
}

// =====================================================================
// 삭제
// =====================================================================

async function deleteActivityObject(aoId) {

    if (!confirm('이 액티비티 객체를 삭제하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(
            `/connections/api/activity-objects/${currentProjectId}/${aoId}/`,
            {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': csrftoken,
                },
            }
        );

        const result = await response.json();

        if (!response.ok) throw new Error(result.message || '삭제에 실패했습니다.');

        showToast(result.message, 'success');
        await loadActivityObjects();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// =====================================================================
// BIM 저작도구 / 3D 뷰포트 연동
// =====================================================================

// BIM 저작도구에서 선택 정보 가져오기
function getAoSelectionFromClient() {
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
function selectAoInClient() {
    if (selectedAoIds.size === 0) {
        showToast(`테이블에서 ${currentMode === 'revit' ? 'Revit' : 'Blender'}으로 보낼 항목을 먼저 선택하세요.`, 'error');
        return;
    }

    // 선택된 ActivityObject들의 element_unique_id를 수집
    const uniqueIdsToSend = [];
    window.loadedActivityObjects
        .filter(ao => selectedAoIds.has(ao.id))
        .forEach(ao => {
            // ActivityObject → CostItem → QuantityMember → RawElement 체인
            if (ao.quantity_member && ao.quantity_member.id) {
                // QuantityMember ID로 raw_element_id 찾기
                const qm = window.loadedQuantityMembers?.find(q => q.id === ao.quantity_member.id);
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
        showToast('선택한 액티비티 객체에 연결된 BIM 요소가 없습니다.', 'warning');
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
function getAoSelectionFrom3DViewer() {

    if (typeof window.getSelectedObjectsFrom3DViewer !== 'function') {
        showToast('3D 뷰어 기능을 사용할 수 없습니다.', 'error');
        return;
    }

    const selected3DObjects = window.getSelectedObjectsFrom3DViewer();
    if (!selected3DObjects || selected3DObjects.length === 0) {
        showToast('3D 뷰포트에서 선택된 객체가 없습니다.', 'warning');
        return;
    }


    // 3D에서 선택된 객체의 BIM ID 수집
    const selectedBimIds = new Set();
    selected3DObjects.forEach(obj => {
        const bimObjectId = obj.userData.bimObjectId || obj.userData.rawElementId;
        if (bimObjectId) {
            selectedBimIds.add(bimObjectId);
        }
    });


    // 기존 선택 및 필터 초기화
    selectedAoIds.clear();
    window.aoFilteredIds = window.aoFilteredIds || new Set();
    window.aoFilteredIds.clear();

    // BIM ID → QuantityMember ID 매핑
    const qmIds = new Set();
    if (window.loadedQuantityMembers && window.loadedQuantityMembers.length > 0) {
        window.loadedQuantityMembers.forEach(qm => {
            const elementId = qm.split_element_id || qm.raw_element_id;
            if (elementId && selectedBimIds.has(elementId)) {
                qmIds.add(qm.id);
            }
        });
    } else {
    }


    // QuantityMember ID → CostItem ID 매핑
    const ciIds = new Set();
    if (window.loadedCostItems && window.loadedCostItems.length > 0) {
        window.loadedCostItems.forEach(ci => {
            // quantity_member는 객체일 수도 있고 ID 문자열일 수도 있음
            let qmId = null;
            if (ci.quantity_member) {
                if (typeof ci.quantity_member === 'object' && ci.quantity_member.id) {
                    qmId = ci.quantity_member.id;
                } else if (typeof ci.quantity_member === 'string') {
                    qmId = ci.quantity_member;
                }
            } else if (ci.quantity_member_id) {
                qmId = ci.quantity_member_id;
            }

            if (qmId && qmIds.has(qmId)) {
                ciIds.add(ci.id);
            }
        });
    } else {
    }


    // CostItem ID → ActivityObject 매핑
    window.loadedActivityObjects.forEach(ao => {
        if (ao.cost_item && ao.cost_item.id && ciIds.has(ao.cost_item.id)) {
            selectedAoIds.add(ao.id);
            window.aoFilteredIds.add(ao.id);
        }
    });


    // 데이터가 없을 경우 경고
    if (!window.loadedQuantityMembers || window.loadedQuantityMembers.length === 0 ||
        !window.loadedCostItems || window.loadedCostItems.length === 0) {
        showToast('수량산출부재 또는 산출항목 데이터가 없습니다. 해당 탭을 먼저 로드하세요.', 'warning');
        return;
    }

    // 필터 활성화 및 버튼 표시
    window.isAoFilterToSelectionActive = true;
    const clearBtnSidebar = document.getElementById('ao-clear-selection-filter-btn');
    const clearBtnFooter = document.getElementById('ao-clear-selection-filter-btn-footer');

    if (clearBtnSidebar) {
        clearBtnSidebar.style.display = 'inline-block';
    }
    if (clearBtnFooter) {
        clearBtnFooter.style.display = 'inline-block';
    }

    // 테이블 재렌더링
    renderActivityObjectsTable(window.loadedActivityObjects);

    if (selectedAoIds.size > 0) {
        showToast(`3D 뷰포트에서 ${selectedAoIds.size}개 액티비티 객체를 선택했습니다.`, 'success');
    } else {
        showToast('3D 뷰포트에서 선택한 객체와 매칭되는 액티비티 객체가 없습니다.', 'warning');
    }
}

// 테이블에서 선택한 객체를 3D 뷰포트에서 선택
function selectAoIn3DViewer() {

    if (selectedAoIds.size === 0) {
        showToast('테이블에서 먼저 항목을 선택하세요.', 'warning');
        return;
    }

    if (typeof window.selectObjectsIn3DViewer !== 'function') {
        showToast('3D 뷰어 기능을 사용할 수 없습니다.', 'error');
        return;
    }

    // 선택된 ActivityObject들의 raw_element_id를 수집
    const bimIdsToSelect = [];
    const selectedAOs = window.loadedActivityObjects.filter(ao => selectedAoIds.has(ao.id));

    selectedAOs.forEach(ao => {
        if (ao.quantity_member && ao.quantity_member.id) {
            // QuantityMember ID로 raw_element_id 찾기
            const qm = window.loadedQuantityMembers?.find(q => q.id === ao.quantity_member.id);
            if (qm) {
                const elementId = qm.split_element_id || qm.raw_element_id;
                if (elementId) {
                    bimIdsToSelect.push(elementId);
                }
            }
        }
    });


    if (bimIdsToSelect.length === 0) {
        showToast('선택한 액티비티 객체에 연결된 BIM 요소가 없습니다.', 'warning');
        return;
    }

    window.selectObjectsIn3DViewer(bimIdsToSelect);

    showToast(`3D 뷰포트에서 ${bimIdsToSelect.length}개 객체를 선택했습니다.`, 'success');
}

// =====================================================================
// 스플릿바
// =====================================================================

function initAoSplitBar() {
    const container = document.querySelector('#activity-objects .split-layout-container');
    const leftPanel = document.querySelector('#activity-objects .left-panel');
    const splitBar = document.querySelector('#activity-objects .ao-split-bar');
    const rightPanel = document.querySelector('#activity-objects .right-panel');

    if (!container || !leftPanel || !splitBar || !rightPanel) {
        console.log('[Activity Object Manager] Split bar elements not found:', {
            container: !!container,
            leftPanel: !!leftPanel,
            splitBar: !!splitBar,
            rightPanel: !!rightPanel
        });
        return;
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    splitBar.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = leftPanel.offsetWidth;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const newWidth = startWidth + deltaX;
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

    console.log('[Activity Object Manager] Split bar initialized successfully');
}

// =====================================================================
// 자동 수량계산
// =====================================================================

/**
 * 모든 액티비티 객체의 수량을 자동 재계산
 * - 자동 계산: Activity.duration_per_unit * CI.quantity
 * - 수동 직접입력: 값 유지
 * - 수동 산식입력: 산식 재평가
 */
async function recalculateAllAoQuantities() {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }

    if (!confirm('모든 액티비티 객체의 수량을 재계산하시겠습니까?\n(수동 직접입력 값은 유지되고, 산식은 재평가됩니다.)')) {
        return;
    }

    try {
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        const allAos = window.loadedActivityObjects || [];

        for (const ao of allAos) {
            try {
                let newQuantity = null;

                if (ao.is_manual && !ao.manual_formula) {
                    // 케이스 2: 수동 직접입력 - 값 유지
                    skippedCount++;
                    continue;

                } else if (ao.is_manual && ao.manual_formula) {
                    // 케이스 3: 수동 산식입력 - 산식 재평가
                    const aoContext = buildActivityObjectContext(ao);
                    newQuantity = evaluateQuantityFormula(ao.manual_formula, aoContext);

                    if (newQuantity === null || isNaN(newQuantity)) {
                        errorCount++;
                        continue;
                    }

                } else {
                    // 케이스 1: 자동 계산 - Activity.duration_per_unit * CI.quantity
                    const durationPerUnit = ao.activity?.duration_per_unit || 0;
                    const ciQuantity = ao.cost_item?.quantity || 0;
                    newQuantity = durationPerUnit * ciQuantity;
                }

                // 서버에 저장
                const updateData = {
                    quantity: newQuantity,
                    actual_duration: newQuantity  // actual_duration도 함께 업데이트
                };

                const saveResponse = await fetch(`/connections/api/activity-objects/${currentProjectId}/${ao.id}/`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken,
                    },
                    body: JSON.stringify(updateData),
                });

                if (saveResponse.ok) {
                    updatedCount++;
                } else {
                    const errorText = await saveResponse.text();
                    errorCount++;
                }

            } catch (itemError) {
                errorCount++;
            }
        }

        // 테이블 갱신
        await loadActivityObjects();

        let message = `${updatedCount}개 항목이 재계산되었습니다.`;
        if (skippedCount > 0) message += ` (${skippedCount}개 수동입력 유지)`;
        if (errorCount > 0) message += ` (${errorCount}개 오류)`;

        showToast(message, updatedCount > 0 ? 'success' : 'info');

    } catch (error) {
        showToast('수량 재계산 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 선택된 ActivityObject의 수동 입력 모드를 해제하고 자동 계산 모드로 전환
 */
async function resetManualAoInput() {
    const selectedIds = Array.from(selectedAoIds || []);

    if (!selectedIds || selectedIds.length === 0) {
        showToast('항목을 먼저 선택하세요.', 'error');
        return;
    }

    if (!confirm(`선택된 ${selectedIds.length}개 항목의 수동입력을 해제하고 자동 계산 모드로 전환하시겠습니까?`)) {
        return;
    }


    try {
        let successCount = 0;
        let errorCount = 0;

        for (const aoId of selectedIds) {
            const ao = window.loadedActivityObjects.find(item => item.id === aoId);
            if (!ao) {
                errorCount++;
                continue;
            }

            // 자동 계산 값 산출
            const durationPerUnit = ao.activity?.duration_per_unit || 0;
            const ciQuantity = ao.cost_item?.quantity || 0;
            const autoQuantity = durationPerUnit * ciQuantity;

            const updateData = {
                quantity: autoQuantity,
                actual_duration: autoQuantity,
                is_manual: false,
                manual_formula: '',
                quantity_expression: {}
            };

            const response = await fetch(`/connections/api/activity-objects/${currentProjectId}/${aoId}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify(updateData),
            });

            if (response.ok) {
                successCount++;
            } else {
                const errorText = await response.text();
                errorCount++;
            }
        }

        await loadActivityObjects();

        let message = `${successCount}개 항목이 자동 계산 모드로 전환되었습니다.`;
        if (errorCount > 0) message += ` (${errorCount}개 오류)`;

        showToast(message, successCount > 0 ? 'success' : 'error');

    } catch (error) {
        showToast('수동입력 해제 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * ActivityObject의 컨텍스트를 빌드 (산식 평가용)
 */
function buildActivityObjectContext(ao) {
    const context = {};

    // ActivityObject 속성
    context['AO.id'] = ao.id;
    context['AO.quantity'] = ao.quantity || 0;
    context['AO.actual_duration'] = ao.actual_duration || 0;
    context['AO.start_date'] = ao.start_date || null;
    context['AO.end_date'] = ao.end_date || null;
    context['AO.progress'] = ao.progress || 0;
    context['AO.is_manual'] = ao.is_manual || false;

    // Activity 속성
    if (ao.activity) {
        context['Activity.code'] = ao.activity.code || '';
        context['Activity.name'] = ao.activity.name || '';
        context['Activity.duration_per_unit'] = ao.activity.duration_per_unit || 0;
        context['Activity.responsible_person'] = ao.activity.responsible_person || '';
    }

    // CostItem 속성
    if (ao.cost_item) {
        context['CI.id'] = ao.cost_item.id;
        context['CI.name'] = ao.cost_item.name || '';
        context['CI.quantity'] = ao.cost_item.quantity || 0;
        context['CI.unit'] = ao.cost_item.unit || '';
        context['CI.description'] = ao.cost_item.description || '';
    }

    // CostCode 속성
    if (ao.cost_code) {
        context['CostCode.code'] = ao.cost_code.code || '';
        context['CostCode.name'] = ao.cost_code.name || '';
        context['CostCode.detail_code'] = ao.cost_code.detail_code || '';
        context['CostCode.note'] = ao.cost_code.note || '';
    }

    // QuantityMember 속성
    if (ao.quantity_member) {
        const qm = ao.quantity_member;
        context['QM.id'] = qm.id;
        context['QM.name'] = qm.name || '';
        context['QM.volume'] = qm.volume || 0;
        context['QM.area'] = qm.area || 0;
        context['QM.length'] = qm.length || 0;
        context['QM.count'] = qm.count || 0;

        // QM properties
        if (qm.properties) {
            Object.keys(qm.properties).forEach(key => {
                context[`QM.properties.${key}`] = qm.properties[key];
            });
        }
    }

    // MemberMark 속성
    if (ao.member_mark) {
        const mm = ao.member_mark;
        context['MM.mark'] = mm.mark || '';
        context['MM.description'] = mm.description || '';

        // MM properties
        if (mm.properties) {
            Object.keys(mm.properties).forEach(key => {
                context[`MM.properties.${key}`] = mm.properties[key];
            });
        }
    }

    // BIM Raw Data 속성
    if (ao.raw_data) {
        // System properties
        Object.keys(ao.raw_data).forEach(key => {
            if (key === 'Parameters' || key === 'TypeParameters') return;
            if (typeof ao.raw_data[key] !== 'object') {
                context[`BIM.Attributes.${key}`] = ao.raw_data[key];
            }
        });

        // Parameters
        if (ao.raw_data.Parameters) {
            Object.keys(ao.raw_data.Parameters).forEach(key => {
                context[`BIM.Parameters.${key}`] = ao.raw_data.Parameters[key];
            });
        }

        // TypeParameters
        if (ao.raw_data.TypeParameters) {
            Object.keys(ao.raw_data.TypeParameters).forEach(key => {
                context[`BIM.TypeParameters.${key}`] = ao.raw_data.TypeParameters[key];
            });
        }
    }

    return context;
}

// ▼▼▼ [추가] 수량 산식 평가 함수 (2025-11-05) ▼▼▼
/**
 * 수량 산식 평가 (템플릿 표현식 처리)
 * CostItem의 evaluateQuantityFormula와 동일한 로직
 */
function evaluateQuantityFormula(formula, context) {
    if (!formula || formula.trim() === '') return null;

    try {
        // 템플릿 표현식 {property_name}을 실제 값으로 치환
        let evaluatedFormula = formula;

        // {property_name} 패턴 찾기
        const templatePattern = /\{([^}]+)\}/g;
        const matches = [...formula.matchAll(templatePattern)];


        for (const match of matches) {
            const fullMatch = match[0]; // {property_name}
            let propertyPath = match[1]; // property_name

            // 괄호와 설명 부분 제거 (예: "QM.volume (부재 체적)" -> "QM.volume")
            if (propertyPath.includes('(')) {
                propertyPath = propertyPath.split('(')[0].trim();
            }

            // 속성 경로에서 실제 컨텍스트 키 찾기
            // 먼저 원본 키로 시도 (ActivityObject용)
            let value = context[propertyPath];
            let contextKey = propertyPath;

            // 원본 키로 찾지 못하면 변환된 키로 시도 (CostItem용 레거시)
            if (value === undefined || value === null) {
                // CI.name -> name, QM.volume -> qm_volume, BIM.Parameters.면적 -> bim_param_면적
                if (propertyPath.startsWith('CI.')) {
                    contextKey = propertyPath.substring(3); // "CI." 제거
                } else if (propertyPath.startsWith('AO.')) {
                    contextKey = propertyPath.substring(3); // "AO." 제거
                } else if (propertyPath.startsWith('AC.')) {
                    contextKey = 'activity_' + propertyPath.substring(3).toLowerCase();
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

                value = context[contextKey];
            }


            if (value !== undefined && value !== null) {
                // 숫자로 변환 시도
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    evaluatedFormula = evaluatedFormula.replace(fullMatch, numValue);
                } else {
                    evaluatedFormula = evaluatedFormula.replace(fullMatch, 0);
                }
            } else {
                evaluatedFormula = evaluatedFormula.replace(fullMatch, 0);
            }
        }


        // 수식 계산
        const result = eval(evaluatedFormula);

        return result;
    } catch (error) {
        return null;
    }
}
// ▲▲▲ [추가] 여기까지 ▲▲▲

// ▼▼▼ [추가] ActivityObject 컨텍스트 생성 함수 (2025-11-05) ▼▼▼
/**
 * ActivityObject의 전체 컨텍스트 객체 생성 (AO.*, AC.*, CI.*, CC.*, QM.*, MM.*, BIM.*)
 * CostItem의 buildCostItemContext와 유사하게 모든 상속 속성 포함
 */
function buildAoContext(ao) {
    const context = {};


    // 1. AO 자체 속성
    context['id'] = ao.id;
    context['quantity'] = ao.quantity || 0;
    context['start_date'] = ao.start_date || '';
    context['end_date'] = ao.end_date || '';
    context['actual_duration'] = ao.actual_duration || 0;
    context['progress'] = ao.progress || 0;
    context['is_manual'] = ao.is_manual || false;

    // 2. Activity 속성 (상속)
    if (ao.activity) {
        const activity = window.loadedActivities?.find(a => a.id === ao.activity);
        if (activity) {
            context['activity_id'] = activity.id;
            context['activity_name'] = activity.name;
            context['activity_code'] = activity.code;
            context['activity_duration'] = activity.duration || 0;
        }
    }

    // 3. CostItem 속성 (상속)
    if (ao.cost_item) {
        // ao.cost_item이 객체인 경우 id를 추출, 문자열인 경우 그대로 사용
        const costItemId = typeof ao.cost_item === 'object' ? ao.cost_item.id : ao.cost_item;
        const ci = window.loadedCostItems?.find(c => c.id === costItemId);
        if (ci) {
            context['cost_item_id'] = ci.id;
            context['cost_item_quantity'] = ci.quantity || 0;
            context['cost_item_unit'] = ci.unit || '';
            context['cost_item_grouping_info'] = ci.grouping_info || '';

            // 4. CostCode 속성 (CI를 통한 상속)
            if (ci.cost_code) {
                let costCode = window.loadedCostCodes?.find(cc => cc.id === ci.cost_code);
                if (!costCode) {
                    costCode = window.loadedCostCodes?.find(cc => cc.code === ci.cost_code);
                }
                if (costCode) {
                    context['cost_code'] = costCode.code;
                    context['cost_code_name'] = costCode.name;
                    context['cost_code_description'] = costCode.description;
                    context['cost_code_detail_code'] = costCode.detail_code;
                    context['cost_code_unit'] = costCode.unit;
                }
            }

            // 5. QuantityMember 속성 (CI를 통한 상속)
            if (ci.quantity_member) {
                const qm = window.loadedQuantityMembers?.find(m => m.id === ci.quantity_member);
                if (qm) {
                    context['qm_id'] = qm.id;
                    context['qm_name'] = qm.name;
                    context['qm_volume'] = qm.volume || 0;
                    context['qm_area'] = qm.area || 0;
                    context['qm_length'] = qm.length || 0;
                    context['classification_tag'] = qm.classification_tag_name || '';

                    // QM properties
                    if (qm.properties) {
                        Object.keys(qm.properties).forEach(key => {
                            context[`qm_prop_${key}`] = qm.properties[key];
                        });
                    }

                    // 6. BIM 원본 속성 (QM을 통한 상속)
                    if (qm.raw_element_id) {
                        const rawElement = window.allRevitData?.find(re => re.id === qm.raw_element_id);
                        if (rawElement && rawElement.raw_data) {
                            const rd = rawElement.raw_data;

                            // raw_data의 모든 키를 순회하며 적절한 prefix로 context에 저장
                            Object.keys(rd).forEach(key => {
                                const value = rd[key];

                                // ▼▼▼ [수정] BIM. prefix로 통일 (2025-11-05) ▼▼▼
                                // 평탄화된 키 처리 - UI에서 표시되는 형식과 동일하게 저장
                                if (key.startsWith('QuantitySet.') || key.startsWith('PropertySet.') ||
                                    key.startsWith('Type.') || key.startsWith('Spatial_Container.')) {
                                    // 이미 prefix가 있는 경우 그대로 BIM. prefix만 추가
                                    context[`BIM.${key}`] = value;
                                } else if (key.startsWith('Attributes.')) {
                                    // Attributes.xxx -> BIM.Attributes.xxx
                                    context[`BIM.${key}`] = value;
                                } else if (key.startsWith('Parameters.')) {
                                    // Parameters.xxx -> BIM.Parameters.xxx
                                    context[`BIM.${key}`] = value;
                                } else if (key.startsWith('TypeParameters.')) {
                                    // TypeParameters.xxx -> BIM.TypeParameters.xxx
                                    context[`BIM.${key}`] = value;
                                } else if (['Name', 'IfcClass', 'ElementId', 'UniqueId', 'RelatingType',
                                           'SpatialContainer', 'Aggregates', 'Nests', 'Category', 'Family',
                                           'Type', 'Level', 'Id', 'System'].includes(key)) {
                                    // 시스템 속성 -> BIM.Attributes.xxx
                                    context[`BIM.Attributes.${key}`] = value;
                                }
                                // ▲▲▲ [수정] 여기까지 ▲▲▲
                            });

                            // ▼▼▼ [수정] BIM. prefix로 통일 (2025-11-05) ▼▼▼
                            // 하위 호환성: 중첩 객체 처리 (Revit 구조)
                            if (rd.Attributes && typeof rd.Attributes === 'object') {
                                function flattenObject(obj, prefix = '') {
                                    Object.keys(obj).forEach(key => {
                                        const fullKey = prefix ? `${prefix}.${key}` : key;
                                        const value = obj[key];
                                        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                                            flattenObject(value, fullKey);
                                        } else {
                                            context[`BIM.Attributes.${fullKey}`] = value;
                                        }
                                    });
                                }
                                flattenObject(rd.Attributes);
                            }

                            if (rd.Parameters && typeof rd.Parameters === 'object') {
                                function flattenParams(obj, prefix = '') {
                                    Object.keys(obj).forEach(key => {
                                        const fullKey = prefix ? `${prefix}.${key}` : key;
                                        const value = obj[key];
                                        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                                            flattenParams(value, fullKey);
                                        } else {
                                            context[`BIM.Parameters.${fullKey}`] = value;
                                        }
                                    });
                                }
                                flattenParams(rd.Parameters);
                            }

                            if (rd.TypeParameters && typeof rd.TypeParameters === 'object') {
                                function flattenTypeParams(obj, prefix = '') {
                                    Object.keys(obj).forEach(key => {
                                        const fullKey = prefix ? `${prefix}.${key}` : key;
                                        const value = obj[key];
                                        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                                            flattenTypeParams(value, fullKey);
                                        } else {
                                            context[`BIM.TypeParameters.${fullKey}`] = value;
                                        }
                                    });
                                }
                                flattenTypeParams(rd.TypeParameters);
                            }
                            // ▲▲▲ [수정] 여기까지 ▲▲▲
                        }
                    }

                    // 7. MemberMark 속성 (QM을 통한 상속)
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

                    // 8. Space 속성 (QM을 통한 상속)
                    if (qm.space_name) {
                        context['space_name'] = qm.space_name;
                    }
                }
            }
        }
    }

    return context;
}
// ▲▲▲ [추가] 여기까지 ▲▲▲

// ▼▼▼ [추가] 수동 수량 산출식 업데이트 함수 (2025-11-05) ▼▼▼
/**
 * 모든 ActivityObject의 manual_formula 산출식을 재계산하여 quantity를 업데이트합니다.
 */
async function updateAllAoFormulas() {
    if (!window.loadedActivityObjects || window.loadedActivityObjects.length === 0) {
        showToast('업데이트할 액티비티 객체가 없습니다.', 'warning');
        return;
    }

    let updatedCount = 0;
    const errors = [];

    for (const ao of window.loadedActivityObjects) {
        // quantity_expression이 있고 formula 모드인 경우만 처리
        if (!ao.quantity_expression || ao.quantity_expression.mode !== 'formula' || !ao.quantity_expression.formula) {
            continue;
        }

        try {
            // ActivityObject 컨텍스트 생성
            const aoContext = buildAoContext(ao);

            // 산출식 계산
            const calculatedQuantity = evaluateQuantityFormula(ao.quantity_expression.formula, aoContext);
            console.log(`[updateAllAoFormulas] AO ${ao.id} - formula: ${ao.quantity_expression.formula}, result: ${calculatedQuantity}`);

            if (calculatedQuantity !== null && calculatedQuantity !== undefined && !isNaN(calculatedQuantity)) {
                // 서버에 저장 - 필수 필드 포함
                // activity와 cost_item이 객체인 경우 id 추출
                const activityId = typeof ao.activity === 'object' ? ao.activity.id : ao.activity;
                const costItemId = typeof ao.cost_item === 'object' ? ao.cost_item.id : ao.cost_item;

                const payload = {
                    id: ao.id,
                    activity_id: activityId,
                    cost_item_id: costItemId,
                    quantity: calculatedQuantity,
                    actual_duration: calculatedQuantity,  // actual_duration도 함께 업데이트
                    quantity_expression: ao.quantity_expression
                };


                const response = await fetch(
                    `/connections/api/activity-objects/${currentProjectId}/${ao.id}/`,
                    {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrftoken,
                        },
                        body: JSON.stringify(payload),
                    }
                );

                if (!response.ok) {
                    const error = await response.json();
                    errors.push(`${ao.id}: ${error.message || '저장 실패'}`);
                } else {
                    // 로컬 데이터 업데이트
                    ao.quantity = calculatedQuantity;
                    updatedCount++;
                    console.log(`[updateAllAoFormulas] Updated ${ao.id} - quantity: ${calculatedQuantity} (from formula: ${ao.quantity_expression.formula})`);
                }
            }
        } catch (error) {
            console.error(`[updateAllAoFormulas] Error updating activity object ${ao.id}:`, error);
            errors.push(`${ao.id}: ${error.message}`);
        }
    }

    if (errors.length > 0) {
        showToast(`${updatedCount}개 항목 업데이트 완료, ${errors.length}개 오류 발생`, 'warning');
        console.error('[updateAllAoFormulas] Errors:', errors);
    } else if (updatedCount > 0) {
        showToast(`${updatedCount}개 항목의 산출식이 업데이트되었습니다.`, 'success');
    } else {
        showToast('업데이트할 산출식이 없습니다.', 'info');
    }

    // UI 갱신
    await loadActivityObjects();
}
// ▲▲▲ [추가] 여기까지 ▲▲▲

// Window에 함수 노출
window.setupAoListeners = setupAoListeners;
window.initAoSplitBar = initAoSplitBar;
window.recalculateAllAoQuantities = recalculateAllAoQuantities;
window.updateAllAoFormulas = updateAllAoFormulas;
