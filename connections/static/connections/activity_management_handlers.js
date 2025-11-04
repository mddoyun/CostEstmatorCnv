// =====================================================================
// 액티비티(Activity) 관리 관련 함수들
// =====================================================================

let loadedActivities = [];
window.loadedActivities = []; // 전역 window 객체에도 할당
let loadedActivityDependencies = [];

// ▼▼▼ [추가] 정렬 상태 추적 ▼▼▼
let activitySortState = {
    column: null,
    ascending: true
};
// ▲▲▲ [추가] 여기까지 ▲▲▲

/**
 * 현재 프로젝트의 모든 액티비티를 서버에서 불러옵니다.
 */
async function loadActivities() {
    if (!currentProjectId) {
        renderActivitiesTable([]);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/activities/${currentProjectId}/`
        );
        if (!response.ok)
            throw new Error('액티비티 목록을 불러오는데 실패했습니다.');

        loadedActivities = await response.json();
        window.loadedActivities = loadedActivities; // window 객체에도 할당

        // Load dependencies as well for the predecessors column
        await loadActivityDependencies();

        renderActivitiesTable(loadedActivities);

        // 액티비티 할당 탭의 드롭다운 업데이트
        updateActivityFilterSelect();

        // 산출-코스트아이템 탭의 액티비티 콤보박스 업데이트
        updateCiActivitySelect();
    } catch (error) {
        console.error('Error loading activities:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 선행작업 목록을 포맷팅하여 문자열로 반환
 * 예: "WK-001 FS+2d, WK-002 SS"
 */
function formatPredecessors(predecessors) {
    if (!predecessors || predecessors.length === 0) {
        return '-';
    }

    return predecessors.map(dep => {
        const predActivity = loadedActivities.find(
            a => a.id === dep.predecessor_activity
        );
        const code = predActivity ? predActivity.code : '???';
        const type = dep.dependency_type || 'FS';
        const lag = dep.lag_days || 0;
        const lagStr = lag !== 0 ? (lag > 0 ? `+${lag}d` : `${lag}d`) : '';
        return `${code} ${type}${lagStr}`;
    }).join(', ');
}

/**
 * 선행작업 편집 모달 열기
 */
function openPredecessorsModal(activity) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';

    // Get current predecessors
    const currentPredecessors = loadedActivityDependencies.filter(
        dep => dep.successor_activity === activity.id
    );

    modal.innerHTML = `
        <div class="modal-content" style="width: 600px;">
            <div class="modal-header">
                <h2>${activity.code} - ${activity.name} 선행작업 관리</h2>
                <button class="modal-close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div id="predecessors-list"></div>
                <button id="add-predecessor-btn" class="btn-save" style="margin-top: 10px;">선행작업 추가</button>
            </div>
            <div class="modal-footer">
                <button class="modal-button-primary modal-close-btn">닫기</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Render predecessors list
    const renderPredecessorsList = () => {
        const listContainer = modal.querySelector('#predecessors-list');
        const predecessors = loadedActivityDependencies.filter(
            dep => dep.successor_activity === activity.id
        );

        if (predecessors.length === 0) {
            listContainer.innerHTML = '<p>선행작업이 없습니다.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'ruleset-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>선행작업</th>
                    <th>관계유형</th>
                    <th>Lag(일)</th>
                    <th>작업</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');
        predecessors.forEach(dep => {
            const predActivity = loadedActivities.find(
                a => a.id === dep.predecessor_activity
            );

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${predActivity ? `${predActivity.code} - ${predActivity.name}` : 'N/A'}</td>
                <td>${dep.dependency_type}</td>
                <td>${dep.lag_days || 0}</td>
                <td>
                    <button class="edit-pred-btn btn-edit" data-dep-id="${dep.id}">편집</button>
                    <button class="delete-pred-btn btn-delete" data-dep-id="${dep.id}">삭제</button>
                </td>
            `;

            // Edit button
            row.querySelector('.edit-pred-btn').addEventListener('click', () => {
                openPredecessorEditDialog(activity, dep);
            });

            // Delete button
            row.querySelector('.delete-pred-btn').addEventListener('click', async () => {
                if (confirm('이 선행작업 관계를 삭제하시겠습니까?')) {
                    await deleteDependency(dep.id);
                    renderPredecessorsList();
                    await loadActivities(); // Reload to update main table
                }
            });

            tbody.appendChild(row);
        });

        listContainer.innerHTML = '';
        listContainer.appendChild(table);
    };

    renderPredecessorsList();

    // Add predecessor button
    modal.querySelector('#add-predecessor-btn').addEventListener('click', () => {
        openPredecessorEditDialog(activity, null);
    });

    // Close buttons
    modal.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    });
}

/**
 * 선행작업 추가/편집 다이얼로그
 */
function openPredecessorEditDialog(successorActivity, existingDep) {
    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.style.display = 'flex';

    // Filter out current activity and create options
    const availableActivities = loadedActivities.filter(
        a => a.id !== successorActivity.id
    );

    const activityOptions = availableActivities.map(a =>
        `<option value="${a.id}" ${existingDep && existingDep.predecessor_activity === a.id ? 'selected' : ''}>
            ${a.code} - ${a.name}
        </option>`
    ).join('');

    dialog.innerHTML = `
        <div class="modal-content" style="width: 400px;">
            <div class="modal-header">
                <h2>${existingDep ? '선행작업 편집' : '선행작업 추가'}</h2>
                <button class="dialog-close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 15px;">
                    <label>선행작업:</label>
                    <select id="pred-activity-select" class="form-control" required>
                        <option value="">선택...</option>
                        ${activityOptions}
                    </select>
                </div>
                <div style="margin-bottom: 15px;">
                    <label>관계 유형:</label>
                    <select id="pred-type-select" class="form-control">
                        <option value="FS" ${!existingDep || existingDep.dependency_type === 'FS' ? 'selected' : ''}>Finish-to-Start (FS)</option>
                        <option value="SS" ${existingDep && existingDep.dependency_type === 'SS' ? 'selected' : ''}>Start-to-Start (SS)</option>
                        <option value="FF" ${existingDep && existingDep.dependency_type === 'FF' ? 'selected' : ''}>Finish-to-Finish (FF)</option>
                        <option value="SF" ${existingDep && existingDep.dependency_type === 'SF' ? 'selected' : ''}>Start-to-Finish (SF)</option>
                    </select>
                </div>
                <div style="margin-bottom: 15px;">
                    <label>Lag Time (일):</label>
                    <input type="number" id="pred-lag-input" class="form-control"
                           value="${existingDep ? existingDep.lag_days : 0}"
                           step="0.5" placeholder="양수=지연, 음수=앞당김">
                </div>
            </div>
            <div class="modal-footer">
                <button id="save-pred-btn" class="modal-button-primary">저장</button>
                <button class="modal-button-secondary dialog-close-btn">취소</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Save button
    dialog.querySelector('#save-pred-btn').addEventListener('click', async () => {
        const predActivityId = dialog.querySelector('#pred-activity-select').value;
        const depType = dialog.querySelector('#pred-type-select').value;
        const lagDays = parseFloat(dialog.querySelector('#pred-lag-input').value) || 0;

        if (!predActivityId) {
            showToast('선행작업을 선택하세요.', 'error');
            return;
        }

        const depData = {
            predecessor_activity: predActivityId,
            successor_activity: successorActivity.id,
            dependency_type: depType,
            lag_days: lagDays,
            description: ''
        };

        await saveDependency(existingDep ? existingDep.id : 'new', depData);

        document.body.removeChild(dialog);

        // ▼▼▼ [수정] 선행작업 모달의 리스트를 즉시 새로고침 ▼▼▼
        // Find all modal overlays (there should be 2: main modal and this dialog)
        const modals = document.querySelectorAll('.modal-overlay');
        const mainModal = Array.from(modals).find(m => m.querySelector('#predecessors-list'));

        if (mainModal) {
            // loadActivityDependencies를 먼저 호출하여 전역 데이터 업데이트
            await loadActivityDependencies();

            // 모달 내부의 리스트만 재렌더링
            const listContainer = mainModal.querySelector('#predecessors-list');
            const predecessors = loadedActivityDependencies.filter(
                dep => dep.successor_activity === successorActivity.id
            );

            if (predecessors.length === 0) {
                listContainer.innerHTML = '<p>선행작업이 없습니다.</p>';
            } else {
                const table = document.createElement('table');
                table.className = 'ruleset-table';
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>선행작업</th>
                            <th>관계유형</th>
                            <th>Lag(일)</th>
                            <th>작업</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                `;

                const tbody = table.querySelector('tbody');
                predecessors.forEach(dep => {
                    const predActivity = loadedActivities.find(
                        a => a.id === dep.predecessor_activity
                    );

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${predActivity ? `${predActivity.code} - ${predActivity.name}` : 'N/A'}</td>
                        <td>${dep.dependency_type}</td>
                        <td>${dep.lag_days || 0}</td>
                        <td>
                            <button class="edit-pred-btn btn-edit" data-dep-id="${dep.id}">편집</button>
                            <button class="delete-pred-btn btn-delete" data-dep-id="${dep.id}">삭제</button>
                        </td>
                    `;

                    // Edit button
                    row.querySelector('.edit-pred-btn').addEventListener('click', () => {
                        openPredecessorEditDialog(successorActivity, dep);
                    });

                    // Delete button
                    row.querySelector('.delete-pred-btn').addEventListener('click', async () => {
                        if (confirm('이 선행작업 관계를 삭제하시겠습니까?')) {
                            await deleteDependency(dep.id);

                            // Refresh the list again after deletion
                            await loadActivityDependencies();
                            const updatedPredecessors = loadedActivityDependencies.filter(
                                d => d.successor_activity === successorActivity.id
                            );

                            if (updatedPredecessors.length === 0) {
                                listContainer.innerHTML = '<p>선행작업이 없습니다.</p>';
                            } else {
                                // Re-trigger the save button click handler logic to refresh
                                mainModal.querySelector('#add-predecessor-btn').click();
                                mainModal.querySelector('#add-predecessor-btn').click(); // Toggle twice to refresh
                            }

                            await loadActivities(); // Reload to update main table
                        }
                    });

                    tbody.appendChild(row);
                });

                listContainer.innerHTML = '';
                listContainer.appendChild(table);
            }
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        await loadActivities(); // Reload to update main table
    });

    // Close buttons
    dialog.querySelectorAll('.dialog-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
    });
}

/**
 * 액티비티 데이터를 기반으로 테이블을 렌더링합니다.
 */
function renderActivitiesTable(activities, editId = null) {
    const container = document.getElementById('activity-table-container');
    if (!activities.length && editId !== 'new') {
        container.innerHTML =
            '<p>정의된 액티비티가 없습니다. "새 액티비티 추가" 버튼으로 시작하세요.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'ruleset-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th class="sortable-header" data-column="code" style="cursor: pointer;">
                    작업코드 <span class="sort-indicator"></span>
                </th>
                <th class="sortable-header" data-column="name" style="cursor: pointer;">
                    작업명 <span class="sort-indicator"></span>
                </th>
                <th class="sortable-header" data-column="duration_per_unit" style="cursor: pointer;">
                    단위수량당 소요일수 <span class="sort-indicator"></span>
                </th>
                <th class="sortable-header" data-column="manual_start_date" style="cursor: pointer;">
                    수동 시작일 <span class="sort-indicator"></span>
                </th>
                <th>선행작업</th>
                <th class="sortable-header" data-column="responsible_person" style="cursor: pointer;">
                    담당자 <span class="sort-indicator"></span>
                </th>
                <th>작업</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    // 개별 행 렌더
    const renderRow = (activity) => {
        const isEditMode =
            editId &&
            (editId === 'new' ? activity.id === 'new' : activity.id === editId);

        const row = document.createElement('tr');
        row.dataset.activityId = activity.id;

        if (isEditMode) {
            row.classList.add('rule-edit-row');
            row.innerHTML = `
                <td><input type="text" class="activity-code-input" value="${
                    activity.code || ''
                }" placeholder="WK-001" required></td>
                <td><input type="text" class="activity-name-input" value="${
                    activity.name || ''
                }" placeholder="작업명" required></td>
                <td><input type="number" class="activity-duration-input" value="${
                    activity.duration_per_unit || '1'
                }" step="0.1" min="0" placeholder="단위수량당 일수"></td>
                <td><input type="date" class="activity-manual-start-input" value="${
                    activity.manual_start_date || ''
                }" placeholder="YYYY-MM-DD"></td>
                <td class="predecessors-cell">-</td>
                <td><input type="text" class="activity-responsible-input" value="${
                    activity.responsible_person || ''
                }" placeholder="담당자"></td>
                <td>
                    <button class="save-activity-btn btn-save" data-activity-id="${
                        activity.id
                    }">저장</button>
                    <button class="cancel-edit-activity-btn btn-cancel">취소</button>
                </td>
            `;

            // 저장 버튼 이벤트
            row.querySelector('.save-activity-btn').addEventListener(
                'click',
                async function () {
                    const manualStartValue = row.querySelector('.activity-manual-start-input').value;
                    const activityData = {
                        code: row.querySelector('.activity-code-input').value,
                        name: row.querySelector('.activity-name-input').value,
                        duration_per_unit: parseFloat(
                            row.querySelector('.activity-duration-input').value
                        ),
                        manual_start_date: manualStartValue || null,
                        responsible_person:
                            row.querySelector('.activity-responsible-input')
                                .value || '',
                    };

                    await saveActivity(activity.id, activityData);
                }
            );

            // 취소 버튼 이벤트
            row.querySelector('.cancel-edit-activity-btn').addEventListener(
                'click',
                () => {
                    renderActivitiesTable(loadedActivities);
                }
            );
        } else {
            // Get predecessors for this activity
            const predecessors = loadedActivityDependencies.filter(
                dep => dep.successor_activity === activity.id
            );
            const predecessorText = formatPredecessors(predecessors);

            const manualStartDateDisplay = activity.manual_start_date
                ? `<span style="color: #17a2b8; font-weight: bold;">${activity.manual_start_date}</span>`
                : '-';

            row.innerHTML = `
                <td>${activity.code || ''}</td>
                <td>${activity.name || ''}</td>
                <td>${activity.duration_per_unit || '0'}</td>
                <td>${manualStartDateDisplay}</td>
                <td class="predecessors-cell clickable" data-activity-id="${activity.id}" style="cursor: pointer; color: #0066cc;">
                    ${predecessorText}
                </td>
                <td>${activity.responsible_person || '-'}</td>
                <td>
                    <button class="edit-activity-btn btn-edit" data-activity-id="${
                        activity.id
                    }">편집</button>
                    <button class="delete-activity-btn btn-delete" data-activity-id="${
                        activity.id
                    }">삭제</button>
                </td>
            `;

            // 편집 버튼 이벤트
            row.querySelector('.edit-activity-btn').addEventListener(
                'click',
                () => {
                    renderActivitiesTable(loadedActivities, activity.id);
                }
            );

            // 삭제 버튼 이벤트
            row.querySelector('.delete-activity-btn').addEventListener(
                'click',
                async () => {
                    if (
                        confirm(
                            `액티비티 "${activity.name}"을(를) 삭제하시겠습니까?`
                        )
                    ) {
                        await deleteActivity(activity.id);
                    }
                }
            );

            // 선행작업 셀 클릭 이벤트
            const predecessorsCell = row.querySelector('.predecessors-cell.clickable');
            if (predecessorsCell) {
                predecessorsCell.addEventListener('click', () => {
                    openPredecessorsModal(activity);
                });
            }
        }

        tbody.appendChild(row);
    };

    // 새 액티비티 추가 행 (editId === 'new'인 경우)
    if (editId === 'new') {
        renderRow({
            id: 'new',
            code: '',
            name: '',
            duration_per_unit: 1,
            manual_start_date: null, // ▼▼▼ [추가] 새 액티비티에 manual_start_date 필드 추가 ▼▼▼
        });
    }

    // 기존 액티비티 렌더
    activities.forEach(renderRow);

    container.innerHTML = '';
    container.appendChild(table);

    // ▼▼▼ [추가] 정렬 기능 추가 ▼▼▼
    // 정렬 인디케이터 업데이트
    const updateSortIndicators = () => {
        table.querySelectorAll('.sort-indicator').forEach(indicator => {
            indicator.textContent = '';
        });

        if (activitySortState.column) {
            const activeHeader = table.querySelector(`th[data-column="${activitySortState.column}"] .sort-indicator`);
            if (activeHeader) {
                activeHeader.textContent = activitySortState.ascending ? ' ▲' : ' ▼';
            }
        }
    };

    // 초기 인디케이터 표시
    updateSortIndicators();

    // 헤더 클릭 이벤트
    table.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-column');

            // 같은 열을 다시 클릭하면 순서 반전
            if (activitySortState.column === column) {
                activitySortState.ascending = !activitySortState.ascending;
            } else {
                // 새로운 열을 클릭하면 오름차순으로 시작
                activitySortState.column = column;
                activitySortState.ascending = true;
            }

            // 정렬 수행
            const sortedActivities = [...loadedActivities].sort((a, b) => {
                let aVal = a[column];
                let bVal = b[column];

                // null/undefined 처리
                if (aVal == null) aVal = '';
                if (bVal == null) bVal = '';

                // 숫자형 비교
                if (column === 'duration_per_unit') {
                    aVal = parseFloat(aVal) || 0;
                    bVal = parseFloat(bVal) || 0;
                }

                // 문자열 비교
                if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                if (aVal < bVal) return activitySortState.ascending ? -1 : 1;
                if (aVal > bVal) return activitySortState.ascending ? 1 : -1;
                return 0;
            });

            // 재렌더링 (편집 상태 유지)
            renderActivitiesTable(sortedActivities, editId);
        });
    });
    // ▲▲▲ [추가] 여기까지 ▲▲▲
}

/**
 * 액티비티 저장 (생성/수정)
 */
async function saveActivity(activityId, activityData) {
    if (!currentProjectId) {
        showToast('프로젝트를 먼저 선택하세요.', 'error');
        return;
    }

    try {
        const url =
            activityId === 'new'
                ? `/connections/api/activities/${currentProjectId}/`
                : `/connections/api/activities/detail/${activityId}/`;

        const method = activityId === 'new' ? 'POST' : 'PUT';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken(),
            },
            body: JSON.stringify(activityData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '액티비티 저장에 실패했습니다.');
        }

        showToast(
            activityId === 'new'
                ? '액티비티가 추가되었습니다.'
                : '액티비티가 수정되었습니다.',
            'success'
        );
        await loadActivities();

        // 간트차트 새로고침 (간트차트 탭이 로드된 경우)
        if (typeof window.loadGanttChart === 'function') {
            window.loadGanttChart();
        }
    } catch (error) {
        console.error('Error saving activity:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 액티비티 삭제
 */
async function deleteActivity(activityId) {
    try {
        const response = await fetch(
            `/connections/api/activities/detail/${activityId}/`,
            {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '액티비티 삭제에 실패했습니다.');
        }

        showToast('액티비티가 삭제되었습니다.', 'success');
        await loadActivities();

        // 간트차트 새로고침 (간트차트 탭이 로드된 경우)
        if (typeof window.loadGanttChart === 'function') {
            window.loadGanttChart();
        }
    } catch (error) {
        console.error('Error deleting activity:', error);
        showToast(error.message, 'error');
    }
}

// =====================================================================
// 선후행 관계(ActivityDependency) 관리
// =====================================================================

/**
 * 선후행 관계 목록 불러오기
 */
async function loadActivityDependencies() {
    if (!currentProjectId) {
        renderDependenciesTable([]);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/activity-dependencies/${currentProjectId}/`
        );
        if (!response.ok)
            throw new Error('선후행 관계 목록을 불러오는데 실패했습니다.');

        loadedActivityDependencies = await response.json();
        renderDependenciesTable(loadedActivityDependencies);
    } catch (error) {
        console.error('Error loading activity dependencies:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 선후행 관계 테이블 렌더링
 */
function renderDependenciesTable(dependencies, editId = null) {
    const container = document.getElementById('dependency-table-container');
    if (!dependencies.length && editId !== 'new') {
        container.innerHTML =
            '<p>정의된 선후행 관계가 없습니다. "관계 추가" 버튼으로 시작하세요.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'ruleset-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>선행 작업</th>
                <th>후행 작업</th>
                <th>관계 유형</th>
                <th>Lag/Lead (일)</th>
                <th>설명</th>
                <th>작업</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    // 개별 행 렌더
    const renderRow = (dep) => {
        const isEditMode =
            editId && (editId === 'new' ? dep.id === 'new' : dep.id === editId);

        const row = document.createElement('tr');
        row.dataset.depId = dep.id;

        if (isEditMode) {
            row.classList.add('rule-edit-row');

            // 액티비티 선택 옵션 생성
            const activityOptions = loadedActivities
                .map(
                    (act) =>
                        `<option value="${act.id}" ${dep.predecessor_activity === act.id ? 'selected' : ''}>${act.code} - ${act.name}</option>`
                )
                .join('');

            const activityOptions2 = loadedActivities
                .map(
                    (act) =>
                        `<option value="${act.id}" ${dep.successor_activity === act.id ? 'selected' : ''}>${act.code} - ${act.name}</option>`
                )
                .join('');

            row.innerHTML = `
                <td>
                    <select class="dep-predecessor-input" required>
                        <option value="">선택</option>
                        ${activityOptions}
                    </select>
                </td>
                <td>
                    <select class="dep-successor-input" required>
                        <option value="">선택</option>
                        ${activityOptions2}
                    </select>
                </td>
                <td>
                    <select class="dep-type-input">
                        <option value="FS" ${dep.dependency_type === 'FS' ? 'selected' : ''}>Finish-to-Start</option>
                        <option value="SS" ${dep.dependency_type === 'SS' ? 'selected' : ''}>Start-to-Start</option>
                        <option value="FF" ${dep.dependency_type === 'FF' ? 'selected' : ''}>Finish-to-Finish</option>
                        <option value="SF" ${dep.dependency_type === 'SF' ? 'selected' : ''}>Start-to-Finish</option>
                    </select>
                </td>
                <td><input type="number" class="dep-lag-input" value="${
                    dep.lag_days || '0'
                }" step="0.5"></td>
                <td><input type="text" class="dep-description-input" value="${
                    dep.description || ''
                }" placeholder="설명"></td>
                <td>
                    <button class="save-dep-btn btn-save" data-dep-id="${
                        dep.id
                    }">저장</button>
                    <button class="cancel-edit-dep-btn btn-cancel">취소</button>
                </td>
            `;

            // 저장 버튼 이벤트
            row.querySelector('.save-dep-btn').addEventListener(
                'click',
                async function () {
                    const depData = {
                        predecessor_activity: row.querySelector(
                            '.dep-predecessor-input'
                        ).value,
                        successor_activity: row.querySelector(
                            '.dep-successor-input'
                        ).value,
                        dependency_type:
                            row.querySelector('.dep-type-input').value,
                        lag_days: parseFloat(
                            row.querySelector('.dep-lag-input').value
                        ),
                        description:
                            row.querySelector('.dep-description-input').value ||
                            '',
                    };

                    if (
                        !depData.predecessor_activity ||
                        !depData.successor_activity
                    ) {
                        showToast('선행 작업과 후행 작업을 선택하세요.', 'error');
                        return;
                    }

                    await saveDependency(dep.id, depData);
                }
            );

            // 취소 버튼 이벤트
            row.querySelector('.cancel-edit-dep-btn').addEventListener(
                'click',
                () => {
                    renderDependenciesTable(loadedActivityDependencies);
                }
            );
        } else {
            const predActivity = loadedActivities.find(
                (a) => a.id === dep.predecessor_activity
            );
            const succActivity = loadedActivities.find(
                (a) => a.id === dep.successor_activity
            );

            row.innerHTML = `
                <td>${predActivity ? `${predActivity.code} - ${predActivity.name}` : 'N/A'}</td>
                <td>${succActivity ? `${succActivity.code} - ${succActivity.name}` : 'N/A'}</td>
                <td>${dep.dependency_type}</td>
                <td>${dep.lag_days || '0'}</td>
                <td>${dep.description || '-'}</td>
                <td>
                    <button class="edit-dep-btn btn-edit" data-dep-id="${
                        dep.id
                    }">편집</button>
                    <button class="delete-dep-btn btn-delete" data-dep-id="${
                        dep.id
                    }">삭제</button>
                </td>
            `;

            // 편집 버튼 이벤트
            row.querySelector('.edit-dep-btn').addEventListener('click', () => {
                renderDependenciesTable(loadedActivityDependencies, dep.id);
            });

            // 삭제 버튼 이벤트
            row.querySelector('.delete-dep-btn').addEventListener(
                'click',
                async () => {
                    if (confirm(`이 선후행 관계를 삭제하시겠습니까?`)) {
                        await deleteDependency(dep.id);
                    }
                }
            );
        }

        tbody.appendChild(row);
    };

    // 새 관계 추가 행
    if (editId === 'new') {
        renderRow({
            id: 'new',
            predecessor_activity: '',
            successor_activity: '',
            dependency_type: 'FS',
            lag_days: 0,
            description: '',
        });
    }

    // 기존 관계 렌더
    dependencies.forEach(renderRow);

    container.innerHTML = '';
    container.appendChild(table);
}

/**
 * 선후행 관계 저장
 */
async function saveDependency(depId, depData) {
    if (!currentProjectId) {
        showToast('프로젝트를 먼저 선택하세요.', 'error');
        return;
    }

    try {
        const url =
            depId === 'new'
                ? `/connections/api/activity-dependencies/${currentProjectId}/`
                : `/connections/api/activity-dependencies/detail/${depId}/`;

        const method = depId === 'new' ? 'POST' : 'PUT';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken(),
            },
            body: JSON.stringify(depData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '선후행 관계 저장에 실패했습니다.');
        }

        showToast(
            depId === 'new'
                ? '선후행 관계가 추가되었습니다.'
                : '선후행 관계가 수정되었습니다.',
            'success'
        );
        await loadActivityDependencies();

        // 간트차트 새로고침 (간트차트 탭이 로드된 경우)
        if (typeof window.loadGanttChart === 'function') {
            window.loadGanttChart();
        }
    } catch (error) {
        console.error('Error saving dependency:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 선후행 관계 삭제
 */
async function deleteDependency(depId) {
    try {
        const response = await fetch(
            `/connections/api/activity-dependencies/detail/${depId}/`,
            {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '선후행 관계 삭제에 실패했습니다.');
        }

        showToast('선후행 관계가 삭제되었습니다.', 'success');
        await loadActivityDependencies();

        // 간트차트 새로고침 (간트차트 탭이 로드된 경우)
        if (typeof window.loadGanttChart === 'function') {
            window.loadGanttChart();
        }
    } catch (error) {
        console.error('Error deleting dependency:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 액티비티 필터 셀렉트 업데이트 (액티비티 할당 탭용)
 */
function updateActivityFilterSelect() {
    const select = document.getElementById('activity-filter-select');
    if (!select) return;

    select.innerHTML = '<option value="">전체</option>';
    loadedActivities.forEach((activity) => {
        const option = document.createElement('option');
        option.value = activity.id;
        option.textContent = `${activity.code} - ${activity.name}`;
        select.appendChild(option);
    });
}

// =====================================================================
// 이벤트 리스너 등록
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
    // 새 액티비티 추가 버튼
    const addActivityBtn = document.getElementById('add-activity-btn');
    if (addActivityBtn) {
        addActivityBtn.addEventListener('click', () => {
            renderActivitiesTable(loadedActivities, 'new');
        });
    }

    // 새 선후행 관계 추가 버튼
    const addDepBtn = document.getElementById('add-dependency-btn');
    if (addDepBtn) {
        addDepBtn.addEventListener('click', () => {
            if (loadedActivities.length < 2) {
                showToast(
                    '선후행 관계를 추가하려면 최소 2개의 액티비티가 필요합니다.',
                    'warning'
                );
                return;
            }
            renderDependenciesTable(loadedActivityDependencies, 'new');
        });
    }

    // Inner tab switching for activity management
    const activityManagementTab = document.getElementById('activity-management');
    if (activityManagementTab) {
        const innerTabButtons = activityManagementTab.querySelectorAll('.inner-tab-button');
        innerTabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.dataset.innerTab;

                // Update button states
                innerTabButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                // Update content visibility
                const allContents = activityManagementTab.querySelectorAll('.inner-tab-content');
                allContents.forEach(content => content.classList.remove('active'));

                const targetContent = document.getElementById(targetTab);
                if (targetContent) {
                    targetContent.classList.add('active');

                    // Load data for the selected tab
                    if (targetTab === 'activity-list') {
                        loadActivities();
                    } else if (targetTab === 'activity-dependency') {
                        loadActivityDependencies();
                    } else if (targetTab === 'calendar-management') {
                        if (currentProjectId && typeof loadCalendarsList === 'function') {
                            loadCalendarsList(currentProjectId);
                        }
                    }
                }
            });
        });
    }
});

// Expose loadActivities globally for 3D viewer
window.loadActivities = loadActivities;
