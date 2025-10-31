// =====================================================================
// 액티비티 할당 관련 함수들 (CostItem 기반)
// =====================================================================

let activityAssignmentData = [];
let activityObjectsData = [];

/**
 * 산출항목별 액티비티 할당 목록 불러오기 및 렌더링 (Inner Tab 1)
 */
async function loadActivityAssignments() {
    if (!currentProjectId) {
        renderActivityAssignTable([]);
        return;
    }

    try {
        // 산출항목(CostItem) 목록 불러오기
        const response = await fetch(
            `/connections/api/cost-items/${currentProjectId}/`
        );
        if (!response.ok)
            throw new Error('산출항목 목록을 불러오는데 실패했습니다.');

        const costItems = await response.json();
        activityAssignmentData = costItems;

        // 필터 적용
        applyActivityAssignmentFilters();
    } catch (error) {
        console.error('Error loading activity assignments:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 액티비티 할당 필터 적용 (Inner Tab 1)
 */
function applyActivityAssignmentFilters() {
    const filterUnassigned = document.getElementById(
        'filter-unassigned-items'
    )?.checked;
    const activityFilter =
        document.getElementById('activity-filter-assign-select')?.value;

    let filteredData = [...activityAssignmentData];

    // ▼▼▼ [수정] 복수 activities 처리 ▼▼▼
    // 미할당 필터
    if (filterUnassigned) {
        filteredData = filteredData.filter((item) => !item.activities || item.activities.length === 0);
    }

    // 액티비티 필터
    if (activityFilter) {
        filteredData = filteredData.filter(
            (item) => item.activities && item.activities.includes(activityFilter)
        );
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    renderActivityAssignTable(filteredData);
}

/**
 * 액티비티 할당 테이블 렌더링 (CostItem 기반) - Inner Tab 1
 */
function renderActivityAssignTable(costItems) {
    const container = document.getElementById(
        'activity-assign-table-container'
    );

    if (!costItems.length) {
        container.innerHTML =
            '<p>표시할 산출항목이 없습니다. 필터를 조정하거나 산출항목을 먼저 생성하세요.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'ruleset-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>공사코드</th>
                <th>이름</th>
                <th>수량</th>
                <th>단위</th>
                <th>현재 액티비티</th>
                <th>액티비티 할당</th>
                <th>상세정보</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    costItems.forEach((item) => {
        const row = document.createElement('tr');
        row.dataset.itemId = item.id;

        // ▼▼▼ [수정] 태그 기반 UI로 개선 ▼▼▼
        // 현재 할당된 액티비티들 찾기
        const currentActivities = loadedActivities.filter(
            (act) => item.activities && item.activities.includes(act.id)
        );

        // 액티비티 선택 옵션 (단일 선택 콤보박스용 - 할당되지 않은 액티비티만 표시)
        const unassignedActivities = loadedActivities.filter(
            (act) => !item.activities || !item.activities.includes(act.id)
        );
        const activityOptions = unassignedActivities
            .map(
                (act) => `<option value="${act.id}">${act.code} - ${act.name}</option>`
            )
            .join('');

        // 현재 할당된 액티비티 태그 형태로 표시
        let currentActivityDisplay = '';
        if (currentActivities.length > 0) {
            const tags = currentActivities.map(act =>
                `<span class="activity-tag" style="display: inline-block; background: #e0e0e0; padding: 4px 8px; margin: 2px; border-radius: 4px; font-size: 12px;">
                    ${act.code} - ${act.name}
                    <button class="remove-activity-btn" data-item-id="${item.id}" data-activity-id="${act.id}"
                            style="border: none; background: transparent; color: #d32f2f; font-weight: bold; cursor: pointer; margin-left: 4px; padding: 0 4px;">×</button>
                </span>`
            ).join('');
            currentActivityDisplay = `
                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 4px;">
                    ${tags}
                    <button class="clear-all-activities-btn btn-delete" data-item-id="${item.id}"
                            style="font-size: 11px; padding: 2px 6px; margin-left: 8px;">전체 초기화</button>
                </div>
            `;
        } else {
            currentActivityDisplay = '<span style="color: #999;">-</span>';
        }

        row.innerHTML = `
            <td>${item.cost_code || '-'}</td>
            <td>${item.cost_code_name || '-'}</td>
            <td>${item.quantity.toFixed(2)}</td>
            <td>${item.cost_code_unit || '-'}</td>
            <td>${currentActivityDisplay}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <select class="activity-assign-select" data-item-id="${item.id}" style="flex: 1;">
                        <option value="">액티비티 선택</option>
                        ${activityOptions}
                    </select>
                    <button class="add-activity-btn btn-save" data-item-id="${item.id}" ${unassignedActivities.length === 0 ? 'disabled' : ''}>추가</button>
                </div>
            </td>
            <td>
                <button class="view-details-btn btn-edit" data-item-id="${item.id}">상세보기</button>
            </td>
        `;

        // 추가 버튼 이벤트
        row.querySelector('.add-activity-btn')?.addEventListener(
            'click',
            async function () {
                const selectElement = row.querySelector('.activity-assign-select');
                const selectedActivityId = selectElement.value;

                if (!selectedActivityId) {
                    showToast('액티비티를 선택해주세요.', 'warning');
                    return;
                }

                // 기존 액티비티에 새로운 액티비티 추가
                const updatedActivityIds = [...(item.activities || []), selectedActivityId];
                await assignActivityToCostItem(item.id, updatedActivityIds);
            }
        );

        // 개별 삭제 버튼 이벤트 (이벤트 위임)
        row.querySelectorAll('.remove-activity-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const activityId = this.dataset.activityId;
                const activity = loadedActivities.find(act => act.id === activityId);

                if (confirm(`'${activity?.code} - ${activity?.name}' 액티비티를 제거하시겠습니까?`)) {
                    // 해당 액티비티만 제거
                    const updatedActivityIds = item.activities.filter(id => id !== activityId);
                    await assignActivityToCostItem(item.id, updatedActivityIds);
                }
            });
        });

        // 전체 초기화 버튼 이벤트
        row.querySelector('.clear-all-activities-btn')?.addEventListener(
            'click',
            async function () {
                if (confirm('모든 액티비티 할당을 해제하시겠습니까?')) {
                    await assignActivityToCostItem(item.id, []);
                }
            }
        );

        // 상세보기 버튼 이벤트
        row.querySelector('.view-details-btn').addEventListener(
            'click',
            () => {
                showCostItemDetails(item);
            }
        );

        // 행 클릭 이벤트 (속성 패널 업데이트)
        row.addEventListener('click', (e) => {
            // 버튼이나 select를 클릭한 경우는 무시
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') {
                return;
            }
            // 모든 행의 선택 표시 제거
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected-row'));
            // 현재 행 선택 표시
            row.classList.add('selected-row');
            // 속성 패널 업데이트
            updateItemPropertiesPanel(item);
        });
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        tbody.appendChild(row);
    });

    container.innerHTML = '';
    container.appendChild(table);
}

/**
 * 액티비티 객체 목록 불러오기 및 렌더링 (Inner Tab 2)
 * 액티비티가 할당된 CostItem만 표시
 */
async function loadActivityObjects() {
    if (!currentProjectId) {
        renderActivityObjectsTable([]);
        return;
    }

    try {
        const response = await fetch(
            `/connections/api/cost-items/${currentProjectId}/`
        );
        if (!response.ok)
            throw new Error('산출항목 목록을 불러오는데 실패했습니다.');

        const costItems = await response.json();
        // ▼▼▼ [수정] 복수 activities 처리: 최소 하나라도 할당된 항목만 필터링 ▼▼▼
        activityObjectsData = costItems.filter((item) => item.activities && item.activities.length > 0);
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        applyActivityObjectsFilters();
    } catch (error) {
        console.error('Error loading activity objects:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 액티비티 객체 필터 적용 (Inner Tab 2)
 */
function applyActivityObjectsFilters() {
    const activityFilter =
        document.getElementById('activity-filter-objects-select')?.value;

    let filteredData = [...activityObjectsData];

    // ▼▼▼ [수정] 복수 activities 처리 ▼▼▼
    // 액티비티 필터
    if (activityFilter) {
        filteredData = filteredData.filter(
            (item) => item.activities && item.activities.includes(activityFilter)
        );
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    renderActivityObjectsTable(filteredData);
}

/**
 * 액티비티 객체 목록 테이블 렌더링 - Inner Tab 2
 */
function renderActivityObjectsTable(costItems) {
    const container = document.getElementById(
        'activity-objects-table-container'
    );

    if (!costItems.length) {
        container.innerHTML =
            '<p>액티비티가 할당된 산출항목이 없습니다.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'ruleset-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>액티비티</th>
                <th>공사코드</th>
                <th>이름</th>
                <th>수량</th>
                <th>단위</th>
                <th>단위당 소요일수</th>
                <th>실제 소요일수</th>
                <th>작업</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    // ▼▼▼ [수정] 복수 activities 처리: 각 activity마다 별도 행으로 표시 ▼▼▼
    costItems.forEach((item) => {
        // 할당된 액티비티들 찾기
        const activities = loadedActivities.filter(
            (act) => item.activities && item.activities.includes(act.id)
        );

        // 각 액티비티마다 행 생성
        activities.forEach((activity, index) => {
            const row = document.createElement('tr');
            row.dataset.itemId = item.id;
            row.dataset.activityId = activity.id;

            // 실제 소요일수 계산
            const actualDuration = (activity.duration_per_unit * item.quantity).toFixed(1);

            row.innerHTML = `
                <td>${activity.code} - ${activity.name}</td>
                <td>${item.cost_code || '-'}</td>
                <td>${item.cost_code_name || '-'}</td>
                <td>${item.quantity.toFixed(2)}</td>
                <td>${item.cost_code_unit || '-'}</td>
                <td>${activity.duration_per_unit}</td>
                <td>${actualDuration}</td>
                <td>
                    <button class="unassign-single-activity-btn btn-delete" data-item-id="${item.id}" data-activity-id="${activity.id}">이 액티비티 해제</button>
                    <button class="view-details-btn btn-edit" data-item-id="${item.id}">상세보기</button>
                </td>
            `;

            // 단일 액티비티 할당 해제 버튼
            row.querySelector('.unassign-single-activity-btn').addEventListener(
                'click',
                async function () {
                    if (confirm(`이 산출항목에서 '${activity.code} - ${activity.name}' 액티비티 할당을 해제하시겠습니까?`)) {
                        // 현재 활당된 액티비티 중 해당 액티비티만 제거
                        const remainingActivityIds = item.activities.filter(id => id !== activity.id);
                        await assignActivityToCostItem(item.id, remainingActivityIds);
                        await loadActivityObjects(); // 목록 갱신
                    }
                }
            );

            // 상세보기 버튼
            row.querySelector('.view-details-btn').addEventListener(
                'click',
                () => {
                    showCostItemDetails(item);
                }
            );

            tbody.appendChild(row);
        });
    });
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    container.innerHTML = '';
    container.appendChild(table);
}

/**
 * 산출항목의 속성을 사이드 패널에 표시 (룰셋 작성에 도움)
 */
function updateItemPropertiesPanel(item) {
    const panel = document.getElementById('activity-item-properties-panel');
    if (!panel) return;

    let html = '<h4>산출항목 속성 (룰셋 참고용)</h4>';
    html += '<p style="font-size: 12px; color: #666; margin-bottom: 15px;">이 속성들을 액티비티 할당 룰셋 조건에 사용할 수 있습니다.</p>';

    // CostItem 속성
    html += '<div style="margin-bottom: 20px;">';
    html += '<h5 style="margin-bottom: 10px; color: #1976d2;">CostItem 속성</h5>';
    html += '<table class="ruleset-table" style="font-size: 12px;"><tbody>';
    html += `<tr><td><strong>quantity</strong></td><td>${item.quantity}</td></tr>`;
    if (item.description) {
        html += `<tr><td><strong>description</strong></td><td>${item.description}</td></tr>`;
    }
    html += '</tbody></table>';
    html += '</div>';

    // CostCode 속성 (CC 접두사)
    if (item.cost_code || item.cost_code_name) {
        html += '<div style="margin-bottom: 20px;">';
        html += '<h5 style="margin-bottom: 10px; color: #388e3c;">CostCode 속성 (CC.)</h5>';
        html += '<table class="ruleset-table" style="font-size: 12px;"><tbody>';
        if (item.cost_code) html += `<tr><td><strong>CC.code</strong></td><td>${item.cost_code}</td></tr>`;
        if (item.cost_code_name) html += `<tr><td><strong>CC.name</strong></td><td>${item.cost_code_name}</td></tr>`;
        if (item.cost_code_unit) html += `<tr><td><strong>CC.unit</strong></td><td>${item.cost_code_unit}</td></tr>`;
        html += '</tbody></table>';
        html += '</div>';
    }

    // QuantityMember 속성 (QM 접두사)
    if (item.quantity_member_properties && Object.keys(item.quantity_member_properties).length > 0) {
        html += '<div style="margin-bottom: 20px;">';
        html += '<h5 style="margin-bottom: 10px; color: #f57c00;">QuantityMember 속성 (QM.)</h5>';
        html += '<table class="ruleset-table" style="font-size: 12px;"><tbody>';
        Object.entries(item.quantity_member_properties).forEach(([key, value]) => {
            if (key !== 'properties' && value !== null && value !== undefined) {
                html += `<tr><td><strong>QM.${key}</strong></td><td>${value}</td></tr>`;
            }
        });
        html += '</tbody></table>';
        html += '</div>';
    }

    // MemberMark 속성 (MM 접두사)
    if (item.member_mark_properties && Object.keys(item.member_mark_properties).length > 0) {
        html += '<div style="margin-bottom: 20px;">';
        html += '<h5 style="margin-bottom: 10px; color: #7b1fa2;">MemberMark 속성 (MM.)</h5>';
        html += '<table class="ruleset-table" style="font-size: 12px;"><tbody>';
        Object.entries(item.member_mark_properties).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                html += `<tr><td><strong>MM.${key}</strong></td><td>${value}</td></tr>`;
            }
        });
        html += '</tbody></table>';
        html += '</div>';
    }

    // RawElement 속성 (RE 접두사)
    if (item.raw_element_properties && Object.keys(item.raw_element_properties).length > 0) {
        html += '<div style="margin-bottom: 20px;">';
        html += '<h5 style="margin-bottom: 10px; color: #d32f2f;">RawElement 속성 (RE.)</h5>';
        html += '<table class="ruleset-table" style="font-size: 12px;"><tbody>';
        // 중요 속성 먼저 표시
        const importantProps = ['Category', 'Family', 'Type', 'Level'];
        importantProps.forEach(prop => {
            if (item.raw_element_properties[prop]) {
                html += `<tr><td><strong>RE.${prop}</strong></td><td>${item.raw_element_properties[prop]}</td></tr>`;
            }
        });
        // 나머지 속성
        Object.entries(item.raw_element_properties).forEach(([key, value]) => {
            if (!importantProps.includes(key) && value !== null && value !== undefined) {
                html += `<tr><td><strong>RE.${key}</strong></td><td>${String(value).substring(0, 50)}${String(value).length > 50 ? '...' : ''}</td></tr>`;
            }
        });
        html += '</tbody></table>';
        html += '</div>';
    }

    panel.innerHTML = html;
}

/**
 * 산출항목 상세 정보 표시 (연관된 QuantityMember 및 BIM 객체 정보 포함)
 */
async function showCostItemDetails(costItem) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';

    modal.innerHTML = `
        <div class="modal-content" style="width: 80%; max-width: 1200px;">
            <div class="modal-header">
                <h2>산출항목 상세 정보</h2>
                <button class="modal-close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 20px;">
                    <h3>산출항목 정보</h3>
                    <table class="ruleset-table">
                        <tr><td><strong>공사코드</strong></td><td>${costItem.cost_code || '-'}</td></tr>
                        <tr><td><strong>이름</strong></td><td>${costItem.cost_code_name || '-'}</td></tr>
                        <tr><td><strong>수량</strong></td><td>${costItem.quantity.toFixed(2)}</td></tr>
                        <tr><td><strong>단위</strong></td><td>${costItem.cost_code_unit || '-'}</td></tr>
                    </table>
                </div>
                <div id="quantity-member-info" style="margin-bottom: 20px;">
                    <h3>연관된 수량산출부재</h3>
                    <p>로딩 중...</p>
                </div>
                <div id="raw-element-info">
                    <h3>연관된 BIM 원본 객체</h3>
                    <p>로딩 중...</p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-button-primary modal-close-btn">닫기</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // ▼▼▼ [수정] CostItem 데이터를 직접 사용하도록 수정 ▼▼▼

    // Display quantity member properties (from CostItem data)
    const qmInfo = modal.querySelector('#quantity-member-info');
    if (costItem.quantity_member_properties && Object.keys(costItem.quantity_member_properties).length > 0) {
        let qmPropsHtml = '<h3>연관된 수량산출부재</h3><table class="ruleset-table"><thead><tr><th>속성명</th><th>값</th></tr></thead><tbody>';
        Object.entries(costItem.quantity_member_properties).forEach(([key, value]) => {
            qmPropsHtml += `<tr><td><strong>${key}</strong></td><td>${value || '-'}</td></tr>`;
        });
        qmPropsHtml += '</tbody></table>';
        qmInfo.innerHTML = qmPropsHtml;
    } else {
        qmInfo.innerHTML = '<h3>연관된 수량산출부재</h3><p>연관된 수량산출부재가 없습니다.</p>';
    }

    // Display member mark properties (from CostItem data)
    if (costItem.member_mark_properties && Object.keys(costItem.member_mark_properties).length > 0) {
        let mmPropsHtml = '<div style="margin-bottom: 20px;"><h3>부재마크 정보</h3><table class="ruleset-table"><thead><tr><th>속성명</th><th>값</th></tr></thead><tbody>';
        Object.entries(costItem.member_mark_properties).forEach(([key, value]) => {
            mmPropsHtml += `<tr><td><strong>${key}</strong></td><td>${value || '-'}</td></tr>`;
        });
        mmPropsHtml += '</tbody></table></div>';
        qmInfo.insertAdjacentHTML('afterend', mmPropsHtml);
    }

    // Display raw element properties (from CostItem data)
    const reInfo = modal.querySelector('#raw-element-info');
    if (costItem.raw_element_properties && Object.keys(costItem.raw_element_properties).length > 0) {
        let propsHtml = '<h3>연관된 BIM 원본 객체 속성</h3><table class="ruleset-table"><thead><tr><th>속성명</th><th>값</th></tr></thead><tbody>';

        // Display important properties first
        const importantProps = ['Category', 'Family', 'Type', 'Level', 'Length', 'Width', 'Height', 'Area', 'Volume'];
        importantProps.forEach(prop => {
            if (costItem.raw_element_properties[prop]) {
                propsHtml += `<tr><td><strong>${prop}</strong></td><td>${costItem.raw_element_properties[prop]}</td></tr>`;
            }
        });

        // Display remaining properties
        Object.entries(costItem.raw_element_properties).forEach(([key, value]) => {
            if (!importantProps.includes(key)) {
                propsHtml += `<tr><td>${key}</td><td>${value || '-'}</td></tr>`;
            }
        });

        propsHtml += '</tbody></table>';
        reInfo.innerHTML = propsHtml;
    } else {
        reInfo.innerHTML = '<h3>연관된 BIM 원본 객체</h3><p>연관된 BIM 객체가 없습니다.</p>';
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // Close buttons
    modal.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    });
}

/**
 * 개별 산출항목에 액티비티 할당
 */
// ▼▼▼ [수정] 복수 activities 처리 ▼▼▼
async function assignActivityToCostItem(itemId, activityIds) {
    try {
        // activityIds는 배열이어야 함
        const activityIdsArray = Array.isArray(activityIds) ? activityIds : [];

        const response = await fetch(
            `/connections/api/cost-items/${currentProjectId}/${itemId}/`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken(),
                },
                body: JSON.stringify({
                    activities: activityIdsArray,
                }),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '액티비티 할당에 실패했습니다.');
        }

        // ▼▼▼ [수정] 더 자세한 토스트 메시지 ▼▼▼
        if (activityIdsArray.length === 0) {
            showToast('모든 액티비티 할당이 해제되었습니다.', 'success');
        } else if (activityIdsArray.length === 1) {
            showToast('액티비티가 할당되었습니다.', 'success');
        } else {
            showToast(`${activityIdsArray.length}개의 액티비티가 할당되었습니다.`, 'success');
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲
        await loadActivityAssignments();

        // 간트차트 새로고침 (간트차트 탭이 로드된 경우)
        if (typeof window.loadGanttChart === 'function') {
            window.loadGanttChart();
        }
    } catch (error) {
        console.error('Error assigning activity:', error);
        showToast(error.message, 'error');
    }
}
// ▲▲▲ [수정] 여기까지 ▲▲▲

// =====================================================================
// 이벤트 리스너 등록
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
    // Inner tab switching for activity assignment
    const activityAssignmentTab = document.getElementById('activity-assignment');
    if (activityAssignmentTab) {
        const innerTabButtons = activityAssignmentTab.querySelectorAll('.inner-tab-button');
        innerTabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.dataset.innerTab;

                // Update button states
                innerTabButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                // Show target content
                const allContents = activityAssignmentTab.querySelectorAll('.inner-tab-content');
                allContents.forEach(content => content.classList.remove('active'));
                const targetContent = document.getElementById(targetTab);
                if (targetContent) {
                    targetContent.classList.add('active');

                    // Load data for the selected tab
                    if (targetTab === 'activity-assign') {
                        loadActivityAssignments();
                    } else if (targetTab === 'activity-objects') {
                        loadActivityObjects();
                    }
                }
            });
        });
    }

    // 미할당 필터 체크박스 (Inner Tab 1)
    const filterUnassignedCheckbox = document.getElementById(
        'filter-unassigned-items'
    );
    if (filterUnassignedCheckbox) {
        filterUnassignedCheckbox.addEventListener(
            'change',
            applyActivityAssignmentFilters
        );
    }

    // 액티비티 필터 셀렉트 (Inner Tab 1)
    const activityFilterAssignSelect = document.getElementById(
        'activity-filter-assign-select'
    );
    if (activityFilterAssignSelect) {
        activityFilterAssignSelect.addEventListener(
            'change',
            applyActivityAssignmentFilters
        );
    }

    // 액티비티 필터 셀렉트 (Inner Tab 2)
    const activityFilterObjectsSelect = document.getElementById(
        'activity-filter-objects-select'
    );
    if (activityFilterObjectsSelect) {
        activityFilterObjectsSelect.addEventListener(
            'change',
            applyActivityObjectsFilters
        );
    }
});
