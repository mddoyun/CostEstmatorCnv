(function() {
    // Expose critical global variables and functions
    window.allRevitData = [];
    window.currentProjectId = null;
    window.currentMode = "revit";
    window.activeTab = "ruleset-management"; // 초기 활성 탭 변경 (관리->룰셋)
    window.viewerStates = {
        "data-management": {
            selectedElementIds: new Set(),
            columnFilters: {},
            isFilterToSelectionActive: false,
            revitFilteredIds: new Set(),
            activeView: "raw-data-view",
            collapsedGroups: {},
            currentGroupByFields: [],
            lastSelectedRowIndex: -1,
        },
        "space-management": {
            selectedElementIds: new Set(),
            columnFilters: {},
            isFilterToSelectionActive: false,
            revitFilteredIds: new Set(),
            activeView: "raw-data-view",
            collapsedGroups: {},
            currentGroupByFields: [],
            lastSelectedRowIndex: -1,
        },
    };

    // --- 데이터 로딩 상태 ---
    window.allTags = [];
    window.loadedCostCodes = [];
    window.loadedMemberMarks = [];
    window.loadedSpaceClassifications = [];
    window.loadedQuantityMembers = [];
    window.loadedCostItems = [];
    window.loadedUnitPriceTypes = [];
    window.loadedUnitPrices = [];
    window.loadedActivities = [];
    // 룰셋 데이터
    window.loadedClassificationRules = [];
    window.loadedPropertyMappingRules = [];
    window.loadedCostCodeRules = [];
    window.loadedMemberMarkAssignmentRules = [];
    window.loadedCostCodeAssignmentRules = [];
    window.loadedSpaceClassificationRules = [];
    window.loadedSpaceAssignmentRules = [];

    // --- UI 상태 (Quantity Members) ---
    window.qmColumnFilters = {};
    window.selectedQmIds = new Set();
    window.qmCollapsedGroups = {};
    window.currentQmGroupByFields = [];
    window.lastSelectedQmRowIndex = -1;
    window.activeQmView = "quantity-member-view";
    window.currentQmColumns = ['id', 'name', 'classification_tag_name', 'raw_element_id', 'is_active']; // 기본 컬럼
    window.isQmFilterToSelectionActive = false; // 선택 필터 활성화 여부
    window.qmFilteredIds = new Set(); // 필터링할 수량산출부재 ID

    // --- UI 상태 (Cost Items) ---
    window.ciColumnFilters = {};
    window.selectedCiIds = new Set();
    window.ciCollapsedGroups = {};
    window.currentCiGroupByFields = [];
    window.lastCiRowIndex = -1;
    window.isCiFilterToSelectionActive = false; // 선택 필터 활성화 여부
    window.ciFilteredIds = new Set(); // 필터링할 산출항목 ID

    // --- UI 상태 (Unit Price Management) ---
    window.selectedCostCodeIdForUnitPrice = null;
    window.currentUnitPriceEditState = { id: null, originalData: null };

    // --- 기타 상태 ---
    window.currentCsvImportUrl = null; // CSV 가져오기 시 사용할 URL 임시 저장
    window.spaceMappingState = { active: false, spaceId: null, spaceName: "" }; // 공간 매핑 모드 상태

    // --- [신규] AI 모델 및 학습 관련 전역 변수 ---
    window.loadedAiModels = []; // 로드된 AI 모델 목록
    window.currentTrainingTaskId = null; // 현재 진행 중인 학습 작업 ID
    window.currentTrainingStatus = {}; // 현재 학습 상태 정보 (WebSocket 업데이트용)
    window.trainingChartInstance = null; // Chart.js 인스턴스 (학습 그래프)
    window.uploadedCsvFilename = null; // 학습용으로 업로드된 CSV 파일명 (서버 임시 저장 이름)
    window.csvHeaders = []; // 업로드된 CSV 헤더 목록
    window.trainedModelTempFilename = null; // 학습 완료 후 임시 저장된 h5 파일명 (DB 저장/다운로드용)
    window.trainedModelMetadata = null; // 학습 완료 후 생성된 메타데이터

    // --- [신규] 개산견적(SD) 관련 전역 변수 ---
    window.sdEnabledCostCodes = []; // SD용 공사코드 목록 (수량 포함)
    window.selectedSdModelId = null; // SD 탭에서 선택된 AI 모델 ID
    window.sdPredictionChartInstance = null; // Chart.js 인스턴스 (SD 결과 그래프)
    window.loadedSdCostItems = []; // SD 탭 하단 테이블용 데이터
    window.sdColumnFilters = {}; // SD 테이블 필터
    window.selectedSdItemIds = new Set(); // SD 테이블 선택 ID
    window.sdCollapsedGroups = {}; // SD 테이블 그룹 상태
    window.currentSdGroupByFields = []; // SD 테이블 그룹 필드

    // Expose csrftoken globally
    window.csrftoken = null; // Initialize as null, will be set in DOMContentLoaded

    // Expose setupWebSocket globally (defined in websocket.js)
    // Note: initThreeDViewer is loaded via script tag in HTML

    document.addEventListener("DOMContentLoaded", () => {
        console.log(
            "[DEBUG] DOMContentLoaded start - Setting up event listeners..."
        ); // 디버깅

        // CSRF 토큰 설정
        const tokenInput = document.querySelector("[name=csrfmiddlewaretoken]");
        if (tokenInput && tokenInput.value) {
            window.csrftoken = tokenInput.value; // Assign to global window.csrftoken
            console.log("[DEBUG] CSRF token updated from input field.");
        } else {
            console.warn(
                "[DEBUG] CSRF token input field not found, using cookie value."
            );
        }

        // 웹소켓 설정
        window.setupWebSocket(); // Call the globally exposed setupWebSocket

        // --- 기본 UI 요소 리스너 ---
        const projectSelector = document.getElementById("project-selector");
        projectSelector?.addEventListener("change", handleProjectChange);
        document
            .getElementById("create-project-btn")
            ?.addEventListener("click", createNewProject);
        document
            .getElementById("project-export-btn")
            ?.addEventListener("click", exportCurrentProject);
        document
            .getElementById("project-import-btn")
            ?.addEventListener("click", () =>
                document.getElementById("project-import-input").click()
            );
        document
            .getElementById("project-import-input")
            ?.addEventListener("change", handleProjectImport);
        document
            .getElementById("batch-auto-update-btn")
            ?.addEventListener("click", runBatchAutoUpdate);
        document
            .querySelectorAll('input[name="connector_mode"]')
            .forEach((radio) =>
                radio.addEventListener("change", handleConnectorModeChange)
            );

        // --- 네비게이션 리스너 ---
        document
            .querySelectorAll(".main-nav .nav-button")
            .forEach((button) =>
                button.addEventListener("click", handleMainNavClick)
            );
        document
            .querySelectorAll(".sub-nav-button")
            .forEach((button) =>
                button.addEventListener("click", handleSubNavClick)
            );

        // --- CSV 파일 입력 리스너 (공통) ---
        document
            .getElementById("csv-file-input")
            ?.addEventListener("change", handleCsvFileSelect);

        // --- 각 탭별 UI 요소 리스너 설정 (헬퍼 함수 호출) ---
        setupDataManagementListeners();
        window.setupTagManagementListeners();
        setupSpaceManagementListeners();
        setupRulesetManagementListeners();
        setupCostCodeManagementListeners();
        setupMemberMarkManagementListeners();
        setupQuantityMembersListeners();
        setupCostItemsListeners();
        setupDetailedEstimationListeners(); // DD 탭
        setupUnitPriceManagementListeners();
        setupAiModelManagementListeners(); // [신규] AI 탭
        setupSchematicEstimationListeners(); // [신규] SD 탭

        // [수정] 3D Viewer는 모듈로 비동기 로드되므로 조건부 호출
        if (typeof window.setupThreeDViewerListeners === 'function') {
            window.setupThreeDViewerListeners();
        } else {
            console.log("[DEBUG] setupThreeDViewerListeners not yet loaded (will be available after module loads).");
        }

        console.log("[DEBUG] All specific tab listeners setup complete.");

        // --- 초기 프로젝트 로드 ---
        window.currentProjectId = projectSelector ? projectSelector.value : null; // Assign to global window.currentProjectId
        if (window.currentProjectId) {
            console.log(
                `[DEBUG] Initial project ID: ${window.currentProjectId}. Preparing to load initial data based on default tab...`
            );
            // 초기 데이터 로드는 아래 기본 탭 활성화 로직에서 처리
        } else {
            console.log("[DEBUG] No initial project selected.");
            clearAllTabData(); // 프로젝트 없으면 초기화
        }

        // --- 기본 탭 강제 활성화 (관리 -> 룰셋 관리) ---
        // 페이지 로드 시 기본적으로 보여줄 탭을 설정합니다.
        const defaultPrimaryTabButton = document.querySelector(
            '.main-nav .nav-button[data-primary-tab="management"]'
        );
        const defaultSubTabButton = document.querySelector(
            '#secondary-nav-management .sub-nav-button[data-tab="ruleset-management"]'
        );

        if (defaultPrimaryTabButton && defaultSubTabButton) {
            // 이미 활성화된 보조 탭이 있는지 확인 (예: 새로고침 후 브라우저가 상태 유지)
            const alreadyActiveSubTab = document.querySelector(
                ".secondary-nav.active .sub-nav-button.active"
            );

            if (
                !alreadyActiveSubTab ||
                !alreadyActiveSubTab.closest("#secondary-nav-management")
            ) {
                console.log(
                    "[DEBUG] No relevant active sub-tab found. Forcing activation of default: Management -> Ruleset Management"
                );
                // 주 탭 클릭 -> 보조 탭 자동 클릭 순서로 진행 (약간의 지연 추가)
                setTimeout(() => {
                    defaultPrimaryTabButton.click();
                    // handleMainNavClick 함수가 자동으로 첫 번째 보조 탭(룰셋 관리)을 클릭해줍니다.
                }, 150); // DOM 렌더링 및 다른 스크립트 실행 시간 확보
            } else {
                console.log(
                    "[DEBUG] Default tab activation skipped, an active sub-tab already exists in Management:",
                    alreadyActiveSubTab.dataset.tab
                );
                // 이미 활성 탭이 있으면 해당 탭 데이터 로드
                window.activeTab = alreadyActiveSubTab.dataset.tab; // Assign to global window.activeTab
                loadDataForActiveTab();
            }
        } else {
            console.warn(
                "[WARN] Could not find default tab buttons (Management -> Ruleset) for initial activation."
            );
            // 기본 탭 로드가 안될 경우 대비, 프로젝트가 있으면 데이터 관리 탭이라도 로드 시도
            if (window.currentProjectId) {
                window.activeTab = "data-management"; // 임시 기본값
                loadDataForActiveTab();
            }
        }

        console.log("[DEBUG] DOMContentLoaded end - Initial setup finished.");
    });
})();
