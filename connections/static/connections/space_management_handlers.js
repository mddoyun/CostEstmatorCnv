// connections/static/connections/space_management_handlers.js

// 필요한 전역 변수 또는 헬퍼 함수를 app.js에서 가져오거나 여기에 정의합니다.
// 예: currentProjectId, csrftoken, showToast, viewerStates, loadedSpaceClassifications, loadedQuantityMembers, allRevitData, renderDataTable, renderBimPropertiesTable, renderAssignedElementsModal

/**
 * 프로젝트의 모든 공간분류를 서버에서 불러와 화면을 갱신합니다.
 */
async function loadSpaceClassifications() {
    if (!currentProjectId) {
        renderSpaceClassificationTree([]);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/space-classifications/${currentProjectId}/`
        );
        if (!response.ok)
            throw new Error('공간분류 목록을 불러오는데 실패했습니다.');
        loadedSpaceClassifications = await response.json();
        renderSpaceClassificationTree(loadedSpaceClassifications);

        // ▼▼▼ [추가] 수량산출부재 탭의 공간분류 드롭다운도 채웁니다. ▼▼▼
        const select = document.getElementById('qm-space-assign-select');
        if (select) {
            select.innerHTML = '<option value="">-- 공간분류 선택 --</option>'; // 초기화
            // 위계 구조를 시각적으로 표현하기 위해 재귀 함수 사용
            const buildOptions = (parentId = null, prefix = '') => {
                loadedSpaceClassifications
                    .filter((s) => s.parent_id === parentId)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .forEach((space) => {
                        const option = document.createElement('option');
                        option.value = space.id;
                        option.textContent = `${prefix}${space.name}`;
                        select.appendChild(option);
                        buildOptions(space.id, prefix + '  - ');
                    });
            };
            buildOptions();
        }
    } catch (error) {
        console.error('Error loading space classifications:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 공간분류 관련 CUD(생성, 수정, 삭제) 및 객체 할당 작업을 처리합니다.
 * @param {string} action - 수행할 작업 ('add_root', 'add_child', 'rename', 'delete', 'assign_elements')
 * @param {object} data - 작업에 필요한 데이터 (ID, 이름 등)
 */
async function handleSpaceActions(action, data = {}) {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }

    // ▼▼▼ [핵심 수정] 올바른 선택 ID 상태 객체를 가져옵니다. ▼▼▼
    const selectedIds = viewerStates['space-management'].selectedElementIds;
    let name, confirmed;

    switch (action) {
        case 'add_root':
        case 'add_child':
            const parentName =
                action === 'add_child' ? data.parentName : '최상위';
            name = prompt(
                `'${parentName}'의 하위에 추가할 공간의 이름을 입력하세요:`
            );
            if (!name || !name.trim()) return;

            await saveSpaceClassification({
                name: name.trim(),
                parent_id: data.parentId || null,
            });
            break;

        case 'rename':
            name = prompt('새 이름을 입력하세요:', data.name);
            if (!name || !name.trim() || name.trim() === data.name) return;

            await saveSpaceClassification(
                { id: data.id, name: name.trim() },
                true
            );
            break;

        case 'delete':
            confirmed = confirm(
                `'${data.name}'을(를) 삭제하시겠습니까?\n이 공간에 속한 모든 하위 공간들도 함께 삭제됩니다.`
            );
            if (!confirmed) return;

            await deleteSpaceClassification(data.id);
            break;

        case 'assign_elements':
            // ▼▼▼ [핵심 수정] 'spaceMgmtSelectedIds' 대신 'selectedIds'를 사용합니다. ▼▼▼
            if (selectedIds.size === 0) {
                if (
                    confirm(
                        `선택된 BIM 객체가 없습니다. '${data.name}' 공간의 모든 객체 할당을 해제하시겠습니까?`
                    )
                ) {
                    await applySpaceElementMapping(data.id, []);
                }
            } else {
                if (
                    confirm(
                        `'${data.name}' 공간에 선택된 ${selectedIds.size}개의 BIM 객체를 할당하시겠습니까?\n기존 할당 정보는 덮어쓰여집니다.`
                    )
                ) {
                    await applySpaceElementMapping(
                        data.id,
                        Array.from(selectedIds)
                    );
                }
            }
            break;
    }
}

/**
 * 공간분류를 서버에 저장(생성/수정)합니다.
 * @param {object} spaceData - 저장할 데이터
 * @param {boolean} isUpdate - 수정 작업인지 여부
 */
async function saveSpaceClassification(spaceData, isUpdate = false) {
    const url = isUpdate
        ? `/connections/api/space-classifications/${currentProjectId}/${spaceData.id}/` 
        : `/connections/api/space-classifications/${currentProjectId}/`;
    const method = isUpdate ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken,
            },
            body: JSON.stringify(spaceData),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');
        await loadSpaceClassifications(); // 성공 후 목록 새로고침
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 공간분류를 서버에서 삭제합니다.
 * @param {string} spaceId - 삭제할 공간분류 ID
 */
async function deleteSpaceClassification(spaceId) {
    try {
        const response = await fetch(
            `/connections/api/space-classifications/${currentProjectId}/${spaceId}/`,
            {
                method: 'DELETE',
                headers: { 'X-CSRFToken': csrftoken },
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');
        await loadSpaceClassifications(); //
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 공간 객체 맵핑을 위한 오른쪽 패널을 보여줍니다.
 * @param {string} spaceId - 대상 공간의 ID
 * @param {string} spaceName - 대상 공간의 이름
 */
function showSpaceMappingPanel(spaceId, spaceName) {
    const panel = document.getElementById('space-mapping-panel');
    const header = document.getElementById('space-mapping-header');

    // 맵핑 상태 업데이트
    spaceMappingState = {
        active: true,
        spaceId: spaceId,
        spaceName: spaceName,
    };

    // 헤더 텍스트 설정
    header.textContent = `'${spaceName}' 공간에 객체 할당`;

    // 이 공간에 이미 맵핑된 객체들을 미리 선택 상태로 표시
    selectedElementIds.clear();
    const spaceData = loadedSpaceClassifications.find((s) => s.id === spaceId);
    if (spaceData) {
        // 이 부분은 API가 맵핑된 element_id 목록을 반환해야 완벽하게 동작합니다.
        // 현재는 API가 반환하지 않으므로, 이 기능은 다음 개선사항으로 남겨두고 선택을 초기화합니다.
        // TODO: space_classifications_api가 맵핑된 element_id 목록도 반환하도록 개선
    }

    // BIM 데이터 테이블 렌더링
    // 수정된 renderDataTable 함수에 테이블을 그릴 컨테이너의 ID를 전달합니다.
    renderDataTable('space-mapping-table-container');

    // 패널 보이기
    panel.style.display = 'flex';

    showToast(
        "오른쪽 패널에서 할당할 객체를 선택하고 '선택 완료'를 누르세요.",
        'info',
        4000
    );
}

/**
 * 공간 객체 맵핑 패널을 숨기고 상태를 초기화합니다.
 */
function hideSpaceMappingPanel() {
    const panel = document.getElementById('space-mapping-panel');
    panel.style.display = 'none';

    // 상태 초기화
    spaceMappingState = { active: false, spaceId: null, spaceName: '' };

    // 선택된 객체 목록 초기화 및 BIM 원본 데이터 테이블 새로고침
    selectedElementIds.clear();
    renderDataTable(); // 기본 테이블 컨테이너를 새로고침
}

/**
 * [수정] 선택된 BIM 객체를 특정 공간에 할당하는 API를 호출합니다.
 * @param {string} spaceId 할당할 공간의 ID
 * @param {Array<string>} elementIds 할당할 BIM 원본 객체 ID 목록
 */
async function applySpaceElementMapping(spaceId, elementIds) {
    if (!spaceId) return;

    try {
        const response = await fetch(
            `/connections/api/space-classifications/manage-elements/${currentProjectId}/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    space_id: spaceId,
                    element_ids: elementIds,
                    action: 'assign',
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, 'success');
        await loadSpaceClassifications(); // 성공 후 트리 새로고침

        // ▼▼▼ [핵심 수정] 선택 상태 초기화 및 화면 갱신 로직을 수정합니다. ▼▼▼
        // 1. 올바른 상태 객체의 선택 목록을 비웁니다.
        viewerStates['space-management'].selectedElementIds.clear();

        // 2. 범용 렌더링 함수를 호출하여 테이블과 속성 뷰를 새로고침합니다.
        renderDataTable(
            'space-management-data-table-container',
            'space-management'
        );
        renderBimPropertiesTable('space-management');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 특정 공간에 할당된 객체 목록을 API로 조회하고 모달창에 표시합니다.
 * @param {string} spaceId - 조회할 공간의 ID
 * @param {string} spaceName - 조회할 공간의 이름
 */

async function showAssignedElements(spaceId, spaceName) {
    if (!currentProjectId) return;

    const modal = document.getElementById('assigned-elements-modal');
    const unassignBtn = document.getElementById('modal-unassign-btn');

    unassignBtn.dataset.spaceId = spaceId; // 할당 해제 버튼에 spaceId 저장

    showToast('할당된 객체 목록을 불러오는 중...', 'info');
    try {
        const response = await fetch(
            `/connections/api/space-classifications/${currentProjectId}/${spaceId}/elements/`
        );
        if (!response.ok) {
            throw new Error('할당된 객체를 불러오는데 실패했습니다.');
        }
        const elements = await response.json();

        // 2. 나중에 테이블을 다시 그릴 때 사용하기 위해, 가져온 데이터를 모달 객체에 저장해 둡니다.
        modal.dataset.elements = JSON.stringify(elements);
        modal.dataset.spaceName = spaceName;

        // 3. 가져온 데이터로 테이블을 렌더링합니다. (처음에는 필드가 선택되지 않아 안내 메시지가 보임)
        renderAssignedElementsModal(elements, spaceName);

        // 4. 모든 준비가 끝나면 모달창을 보여줍니다.
        modal.style.display = 'flex';
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 모달창에서 선택된 객체들의 할당을 해제합니다.
 */
async function handleUnassignElements() {
    const unassignBtn = document.getElementById('modal-unassign-btn');
    const spaceId = unassignBtn.dataset.spaceId;
    if (!spaceId) return;

    const modal = document.getElementById('assigned-elements-modal');
    const selectedCheckboxes = modal.querySelectorAll(
        '.unassign-checkbox:checked'
    );

    if (selectedCheckboxes.length === 0) {
        showToast('할당 해제할 항목을 선택하세요.', 'error');
        return;
    }

    if (
        !confirm(
            `${selectedCheckboxes.length}개의 객체를 이 공간에서 할당 해제하시겠습니까?`
        )
    ) {
        return;
    }

    // 현재 모달에 표시된 모든 객체의 ID (할당 해제 전 상태)
    const allAssignedIds = Array.from(
        modal.querySelectorAll('tr[data-element-id]')
    ).map((tr) => tr.dataset.elementId);

    // 할당 해제하기로 선택한 객체의 ID
    const idsToUnassign = Array.from(selectedCheckboxes).map((cb) => cb.value);

    // 최종적으로 할당 상태를 유지해야 할 객체들의 ID 목록
    const remainingIds = allAssignedIds.filter(
        (id) => !idsToUnassign.includes(id)
    );

    // 기존의 할당 API를 재사용하여, 남은 객체들로만 덮어씁니다.
    await applySpaceElementMapping(spaceId, remainingIds);

    // 작업 완료 후 모달을 닫습니다.
    modal.style.display = 'none';
    // 공간분류 트리는 applySpaceElementMapping 함수 내부에서 자동으로 새로고침됩니다.
}

// --- 공간 관리 관련 핸들러 ---
function handleSpaceTreeActions(e) {
    const target = e.target;
    const li = target.closest('li[data-id]');
    if (!li) return;
    const spaceId = li.dataset.id;
    const spaceName = li.dataset.name;

    if (target.classList.contains('add-child-space-btn'))
        handleSpaceActions('add_child', {
            parentId: spaceId,
            parentName: spaceName,
        });
    else if (target.classList.contains('rename-space-btn'))
        handleSpaceActions('rename', { id: spaceId, name: spaceName });
    else if (target.classList.contains('delete-space-btn'))
        handleSpaceActions('delete', { id: spaceId, name: spaceName });
    else if (target.classList.contains('assign-elements-btn'))
        handleSpaceActions('assign_elements', {
            id: spaceId,
            name: spaceName,
        });
    // 객체 할당 시작
    else if (target.classList.contains('view-assigned-btn'))
        showAssignedElements(spaceId, spaceName); // 할당된 객체 보기
}

function closeAssignedElementsModal() {
    const modal = document.getElementById('assigned-elements-modal');
    if (modal) modal.style.display = 'none';
}

function handleAssignedElementsTableClick(e) {
    // 전체 선택 체크박스 처리
    if (e.target.id === 'unassign-select-all') {
        const isChecked = e.target.checked;
        e.currentTarget.querySelectorAll('.unassign-checkbox').forEach((cb) => {
            cb.checked = isChecked;
        });
        console.log(
            `[DEBUG] Assigned elements table: Select All toggled to ${isChecked}`
        );
    }
    // 개별 체크박스 상태 변경 시 전체 선택 체크박스 상태 업데이트 (선택 사항)
    else if (e.target.classList.contains('unassign-checkbox')) {
        const allCheckboxes =
            e.currentTarget.querySelectorAll('.unassign-checkbox');
        const allChecked = Array.from(allCheckboxes).every((cb) => cb.checked);
        const selectAllCheckbox = document.getElementById(
            'unassign-select-all'
        );
        if (selectAllCheckbox) selectAllCheckbox.checked = allChecked;
    }
}

// New function to set up listeners for the assigned elements modal
function setupAssignedElementsModalListeners() {
    const assignedElementsModal = document.getElementById(
        'assigned-elements-modal'
    );
    if (assignedElementsModal) {
        assignedElementsModal
            .querySelector('.modal-close-btn')
            ?.addEventListener('click', closeAssignedElementsModal);
        document
            .getElementById('modal-close-assigned-elements')
            ?.addEventListener('click', closeAssignedElementsModal);
        document
            .getElementById('modal-unassign-btn')
            ?.addEventListener('click', handleUnassignElements);
        assignedElementsModal
            .querySelector('#assigned-elements-table-container')
            ?.addEventListener('click', handleAssignedElementsTableClick); // 전체 선택 등
    }
}
