
// /Users/mddoyun/Developments/CostEstimatorCnv/connections/static/connections/project_management_handlers.js

function handleProjectChange(e) {
    currentProjectId = e.target.value;

    // BOQ 컬럼 설정 로드 (프로젝트 변경 시)
    loadBoqColumnSettings();

    // --- 상태 초기화 ---
    allRevitData = []; // BIM 데이터 초기화

    // 3D 뷰포트 초기화 (장면 클리어)
    if (typeof window.clearScene === 'function') {
        window.clearScene();
    }

    // 각 뷰어 상태 초기화
    Object.keys(viewerStates).forEach((context) => {
        const state = viewerStates[context];
        state.selectedElementIds.clear();
        state.revitFilteredIds.clear();
        state.columnFilters = {};
        state.isFilterToSelectionActive = false;
        state.collapsedGroups = {};
        state.currentGroupByFields = [];
        state.lastSelectedRowIndex = -1;
    });
    // QM 상태 초기화
    loadedQuantityMembers = [];
    qmColumnFilters = {};
    selectedQmIds.clear();
    qmCollapsedGroups = {};
    currentQmGroupByFields = [];
    lastSelectedQmRowIndex = -1;
    activeQmView = 'quantity-member-view';
    // CI 상태 초기화
    loadedCostItems = [];
    ciColumnFilters = {};
    selectedCiIds.clear();
    ciCollapsedGroups = {};
    currentCiGroupByFields = [];
    lastSelectedCiRowIndex = -1;
    // BOQ(DD) 상태 초기화
    boqFilteredRawElementIds.clear();
    // currentBoqColumns = []; // loadBoqColumnSettings에서 처리
    // boqColumnAliases = {}; // loadBoqColumnSettings에서 처리
    lastBoqItemIds = [];
    currentBoqDetailItemId = null;
    loadedUnitPriceTypesForBoq = [];
    document.getElementById('boq-clear-selection-filter-btn').style.display =
        'none';
    // 룰셋 데이터 초기화
    loadedClassificationRules = [];
    loadedPropertyMappingRules = [];
    loadedCostCodeRules = [];
    loadedMemberMarkAssignmentRules = [];
    loadedCostCodeAssignmentRules = [];
    loadedSpaceClassificationRules = [];
    loadedSpaceAssignmentRules = [];
    // 기타 데이터 초기화
    allTags = [];
    loadedCostCodes = [];
    loadedMemberMarks = [];
    loadedSpaceClassifications = [];
    loadedUnitPriceTypes = [];
    loadedUnitPrices = [];
    selectedCostCodeIdForUnitPrice = null;
    currentUnitPriceEditState = { id: null, originalData: null };
    spaceMappingState = { active: false, spaceId: null, spaceName: '' };

    // --- [신규] AI 및 SD 관련 상태 초기화 ---
    loadedAiModels = [];
    currentTrainingTaskId = null;
    currentTrainingStatus = {};
    uploadedCsvFilename = null;
    csvHeaders = [];
    trainedModelTempFilename = null;
    trainedModelMetadata = null;
    sdEnabledCostCodes = [];
    selectedSdModelId = null;
    loadedSdCostItems = [];
    sdColumnFilters = {};
    selectedSdItemIds.clear();
    sdCollapsedGroups = {};
    currentSdGroupByFields = [];
    // 차트 인스턴스 파기
    if (trainingChartInstance) {
        trainingChartInstance.destroy();
        trainingChartInstance = null;
    }
    if (sdPredictionChartInstance) {
        sdPredictionChartInstance.destroy();
        sdPredictionChartInstance = null;
    }
    // --- 상태 초기화 끝 ---

    if (currentProjectId) {
        showToast(
            `프로젝트 '${e.target.options[e.target.selectedIndex].text
            }' 선택됨.`,
            'info'
        );
        // --- 초기 웹소켓 요청 ---
        if (frontendSocket && frontendSocket.readyState === WebSocket.OPEN) {
            frontendSocket.send(
                JSON.stringify({
                    type: 'get_tags',
                    payload: { project_id: currentProjectId },
                })
            );
            frontendSocket.send(
                JSON.stringify({
                    type: 'get_all_elements',
                    payload: { project_id: currentProjectId },
                })
            ); // BIM 데이터 요청
        } else {
            showToast('웹소켓 연결 오류. 페이지 새로고침 필요.', 'error');
        }
        // --- 초기 웹소켓 요청 끝 ---

        // --- 현재 활성 탭 데이터 로드 ---
        // (주의: WebSocket 응답(all_elements)이 오기 전에 실행될 수 있음)
        // loadDataForActiveTab 함수는 allRevitData가 비어있어도 UI 초기화 등을 수행함
        loadDataForActiveTab();

        // --- 3D 뷰어용 수량산출부재 및 산출항목 데이터 로드 ---
        // 3D 뷰포트가 항상 왼쪽에 표시되므로 프로젝트 선택 시 항상 관련 데이터 로드
        if (typeof loadQuantityMembers === 'function') {
            loadQuantityMembers();
        }
        if (typeof loadCostItems === 'function') {
            loadCostItems();
        }
        if (typeof loadActivities === 'function') {
            loadActivities();
        }
        // --- 3D 뷰어용 데이터 로드 끝 ---

        // --- 홈 탭 UI 업데이트 ---
        if (typeof updateHomeProjectListSelection === 'function') {
            updateHomeProjectListSelection(currentProjectId);
        }
        if (typeof updateHomeCurrentProjectInfo === 'function') {
            updateHomeCurrentProjectInfo();
        }
        if (typeof enableHomeProjectButtons === 'function') {
            enableHomeProjectButtons();
        }
    } else {
        // --- 프로젝트 선택 해제 시 UI 초기화 ---
        showToast('프로젝트 선택이 해제되었습니다.', 'info');
        clearAllTabData(); // UI 초기화 함수 호출

        // --- 홈 탭 UI 업데이트 ---
        if (typeof updateHomeProjectListSelection === 'function') {
            updateHomeProjectListSelection(null);
        }
        if (typeof updateHomeCurrentProjectInfo === 'function') {
            updateHomeCurrentProjectInfo();
        }
        if (typeof enableHomeProjectButtons === 'function') {
            enableHomeProjectButtons();
        }
    }
}

function createNewProject() {
    const projectNameInput = document.getElementById('new-project-name');
    const projectName = projectNameInput.value.trim();
    if (!projectName) {
        showToast('프로젝트 이름을 입력하세요.', 'error');
        return;
    }
    fetch('/connections/create-project/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify({ name: projectName }),
    })
        .then((res) => res.json())
        .then((data) => {
            if (data.status === 'success') {
                showToast(
                    `프로젝트 '${data.project_name}' 생성 완료.`,
                    'success'
                );
                const selector = document.getElementById('project-selector');
                const newOption = new Option(
                    data.project_name,
                    data.project_id,
                    true,
                    true
                );
                selector.add(newOption, selector.options[1]);
                selector.dispatchEvent(new Event('change'));
                projectNameInput.value = '';
            } else {
                showToast('프로젝트 생성 실패: ' + data.message, 'error');
            }
        });
}

function exportCurrentProject() {
    if (!currentProjectId) {
        showToast('내보낼 프로젝트를 먼저 선택하세요.', 'error');
        return;
    }
    // 서버의 export_project URL로 요청을 보냅니다.
    window.location.href = `/connections/export-project/${currentProjectId}/`;
}

async function handleProjectImport(event) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    showToast('프로젝트 파일을 업로드하고 있습니다...', 'info', 10000);

    const formData = new FormData();
    formData.append('project_file', file);

    try {
        const response = await fetch('/connections/import-project/', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrftoken },
            body: formData,
        });

        const result = await response.json();
        // [수정] 응답 상태(ok) 먼저 확인
        if (!response.ok) {
            // 서버에서 보낸 에러 메시지 사용, 없으면 기본 메시지
            throw new Error(
                result.message ||
                `프로젝트 가져오기에 실패했습니다. Status: ${response.status}`
            );
        }

        showToast(result.message, 'success');
        // 성공 시 페이지 새로고침하여 새 프로젝트 목록 로드
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        showToast(`오류: ${error.message}`, 'error', 7000); // 에러 메시지 상세 표시 및 시간 늘림
    } finally {
        // 성공/실패 여부와 관계없이 파일 입력 초기화
        event.target.value = '';
    }
}

/**
 * 관리 데이터 버튼 활성화/비활성화
 */
function enableManagementDataButtons() {
    const exportBtn = document.getElementById('export-management-data-btn');
    const importBtn = document.getElementById('import-management-data-btn');
    const hasProject = currentProjectId != null && currentProjectId !== '';

    if (exportBtn) {
        exportBtn.disabled = !hasProject;
    }
    if (importBtn) {
        importBtn.disabled = !hasProject;
    }
}

/**
 * 관리 데이터 내보내기 (BIM 데이터 제외, 설정/룰셋만)
 */
async function handleExportManagementData() {
    if (!currentProjectId) {
        showToast('내보낼 프로젝트를 먼저 선택하세요.', 'error');
        return;
    }

    showToast('관리 데이터를 내보내는 중...', 'info');

    try {
        const response = await fetch(`/connections/export-management-data/${currentProjectId}/`, {
            method: 'GET',
            headers: { 'X-CSRFToken': csrftoken },
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message || '관리 데이터 내보내기에 실패했습니다.');
        }

        // JSON 파일 다운로드
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // 파일명: Content-Disposition 헤더에서 가져오거나 기본값 사용
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'ManagementData.json';
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        } else {
            // Content-Disposition이 없으면 타임스탬프로 파일명 생성
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
            filename = `ManagementData_${dateStr}.json`;
        }
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showToast('관리 데이터를 성공적으로 내보냈습니다.', 'success');
    } catch (error) {
        showToast(`오류: ${error.message}`, 'error');
    }
}

/**
 * 관리 데이터 가져오기 (BIM 데이터 제외, 설정/룰셋만)
 */
async function handleImportManagementData(event) {
    if (!currentProjectId) {
        showToast('데이터를 가져올 프로젝트를 먼저 선택하세요.', 'error');
        event.target.value = ''; // 파일 입력 초기화
        return;
    }

    const file = event.target.files[0];
    if (!file) {
        return;
    }

    // 확인 대화상자
    const confirmed = confirm(
        `현재 프로젝트의 모든 관리 데이터(룰셋, 코드, 설정 등)가 삭제되고 새 데이터로 대체됩니다.\n\n계속하시겠습니까?`
    );
    if (!confirmed) {
        event.target.value = '';
        return;
    }

    showToast('관리 데이터를 업로드하고 있습니다...', 'info', 10000);

    const formData = new FormData();
    formData.append('management_file', file);

    try {
        const response = await fetch(`/connections/import-management-data/${currentProjectId}/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': csrftoken },
            body: formData,
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(
                result.message || `관리 데이터 가져오기에 실패했습니다. Status: ${response.status}`
            );
        }

        showToast(result.message, 'success');

        // 성공 시 모든 관리 데이터 다시 로드 (페이지 새로고침 없이)
        setTimeout(() => {
            // 1. WebSocket으로 태그 다시 로드
            if (frontendSocket && frontendSocket.readyState === WebSocket.OPEN) {
                frontendSocket.send(JSON.stringify({
                    type: 'get_tags',
                    payload: { project_id: currentProjectId }
                }));
            }

            // 2. 각 관리 데이터 로드 함수 호출
            if (typeof loadCostCodes === 'function') {
                loadCostCodes();
            }
            if (typeof loadMemberMarks === 'function') {
                loadMemberMarks();
            }
            if (typeof loadSpaceClassifications === 'function') {
                loadSpaceClassifications();
            }
            if (typeof loadUnitPriceTypes === 'function') {
                loadUnitPriceTypes();
            }
            if (typeof loadActivities === 'function') {
                loadActivities();
            }

            // 3. 룰셋 데이터 다시 로드 (활성화된 룰셋만)
            const activeRulesetBtn = document.querySelector('.ruleset-nav-button.active');
            if (activeRulesetBtn && typeof loadSpecificRuleset === 'function') {
                const rulesetType = activeRulesetBtn.dataset.ruleset;
                loadSpecificRuleset(rulesetType);
            }

            // 4. 현재 활성 탭 UI 업데이트
            if (typeof loadDataForActiveTab === 'function') {
                loadDataForActiveTab();
            }
        }, 500);
    } catch (error) {
        showToast(`오류: ${error.message}`, 'error', 7000);
    } finally {
        event.target.value = '';
    }
}
