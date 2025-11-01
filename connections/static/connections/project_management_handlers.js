
// /Users/mddoyun/Developments/CostEstimatorCnv/connections/static/connections/project_management_handlers.js

function handleProjectChange(e) {
    currentProjectId = e.target.value;
    console.log(
        `[DEBUG][handleProjectChange] Project changed to: ${currentProjectId}`
    ); // 디버깅

    // BOQ 컬럼 설정 로드 (프로젝트 변경 시)
    loadBoqColumnSettings();

    // --- 상태 초기화 ---
    allRevitData = []; // BIM 데이터 초기화
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
    console.log('[DEBUG][handleProjectChange] AI and SD states reset.'); // 디버깅
    // --- 상태 초기화 끝 ---

    if (currentProjectId) {
        showToast(
            `프로젝트 '${e.target.options[e.target.selectedIndex].text
            }' 선택됨.`,
            'info'
        );
        console.log(
            `[DEBUG][handleProjectChange] Project selected: ${e.target.options[e.target.selectedIndex].text
            }. Loading initial data...`
        ); // 디버깅
        // --- 초기 웹소켓 요청 ---
        if (frontendSocket && frontendSocket.readyState === WebSocket.OPEN) {
            console.log(
                '[DEBUG][handleProjectChange] Sending initial WebSocket requests (get_tags, get_all_elements)...'
            ); // 디버깅
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
            console.error(
                '[ERROR][handleProjectChange] WebSocket not open. Cannot send initial requests.'
            ); // 디버깅
            showToast('웹소켓 연결 오류. 페이지 새로고침 필요.', 'error');
        }
        // --- 초기 웹소켓 요청 끝 ---

        // --- 현재 활성 탭 데이터 로드 ---
        // (주의: WebSocket 응답(all_elements)이 오기 전에 실행될 수 있음)
        // loadDataForActiveTab 함수는 allRevitData가 비어있어도 UI 초기화 등을 수행함
        console.log(
            `[DEBUG][handleProjectChange] Calling loadDataForActiveTab() for active tab: ${activeTab}`
        ); // 디버깅
        loadDataForActiveTab();

        // --- 3D 뷰어용 수량산출부재 및 산출항목 데이터 로드 ---
        // 3D 뷰포트가 항상 왼쪽에 표시되므로 프로젝트 선택 시 항상 관련 데이터 로드
        if (typeof loadQuantityMembers === 'function') {
            console.log('[DEBUG][handleProjectChange] Loading quantity members for 3D viewer...');
            loadQuantityMembers();
        }
        if (typeof loadCostItems === 'function') {
            console.log('[DEBUG][handleProjectChange] Loading cost items for 3D viewer...');
            loadCostItems();
        }
        if (typeof loadActivities === 'function') {
            console.log('[DEBUG][handleProjectChange] Loading activities for 3D viewer...');
            loadActivities();
        }
        // --- 3D 뷰어용 데이터 로드 끝 ---
    } else {
        // --- 프로젝트 선택 해제 시 UI 초기화 ---
        console.log(
            '[DEBUG][handleProjectChange] Project deselected. Clearing UI.'
        ); // 디버깅
        showToast('프로젝트 선택이 해제되었습니다.', 'info');
        clearAllTabData(); // UI 초기화 함수 호출
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
    console.log(
        "[DEBUG][exportCurrentProject] '프로젝트 내보내기' button clicked."
    ); // 디버깅
    if (!currentProjectId) {
        showToast('내보낼 프로젝트를 먼저 선택하세요.', 'error');
        console.warn(
            '[WARN][exportCurrentProject] No project selected for export.'
        ); // 디버깅
        return;
    }
    console.log(
        `[DEBUG][exportCurrentProject] Triggering project export for ID: ${currentProjectId}`
    ); // 디버깅
    // 서버의 export_project URL로 요청을 보냅니다.
    window.location.href = `/connections/export-project/${currentProjectId}/`;
}

async function handleProjectImport(event) {
    const file = event.target.files[0];
    if (!file) {
        console.log('[DEBUG][handleProjectImport] File selection cancelled.'); // 디버깅
        return;
    }

    console.log(
        `[DEBUG][handleProjectImport] File selected: ${file.name}. Starting upload...`
    ); // 디버깅
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
        console.log(
            '[DEBUG][handleProjectImport] Project import successful. Reloading page...'
        ); // 디버깅
        // 성공 시 페이지 새로고침하여 새 프로젝트 목록 로드
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        console.error(
            '[ERROR][handleProjectImport] Error during import:',
            error
        ); // 디버깅
        showToast(`오류: ${error.message}`, 'error', 7000); // 에러 메시지 상세 표시 및 시간 늘림
    } finally {
        // 성공/실패 여부와 관계없이 파일 입력 초기화
        event.target.value = '';
    }
}
