// ▼▼▼ [교체] 파일 최상단의 전역 변수 선언 영역 전체를 아래 코드로 교체 ▼▼▼
// main.js
let allRevitData = [];
let currentProjectId = null;
let currentMode = "revit";

// --- 탭 및 상태 관리 ---
let activeTab = "ruleset-management"; // 초기 활성 탭 변경 (관리->룰셋)
const viewerStates = {
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
let allTags = [];
let loadedCostCodes = [];
let loadedMemberMarks = [];
let loadedSpaceClassifications = [];
let loadedQuantityMembers = [];
let loadedCostItems = [];
let loadedUnitPriceTypes = [];
let loadedUnitPrices = [];
// 룰셋 데이터
let loadedClassificationRules = [];
let loadedPropertyMappingRules = [];
let loadedCostCodeRules = [];
let loadedMemberMarkAssignmentRules = [];
let loadedCostCodeAssignmentRules = [];
let loadedSpaceClassificationRules = [];
let loadedSpaceAssignmentRules = [];

// --- UI 상태 (Quantity Members) ---
let qmColumnFilters = {};
let selectedQmIds = new Set();
let qmCollapsedGroups = {};
let currentQmGroupByFields = [];
let lastSelectedQmRowIndex = -1;
let activeQmView = "quantity-member-view";

// --- UI 상태 (Cost Items) ---
let ciColumnFilters = {};
let selectedCiIds = new Set();
let ciCollapsedGroups = {};
let currentCiGroupByFields = [];
let lastSelectedCiRowIndex = -1;

// --- UI 상태 (Unit Price Management) ---
let selectedCostCodeIdForUnitPrice = null;
let currentUnitPriceEditState = { id: null, originalData: null };

// --- UI 상태 (BOQ - DD) ---
let boqFilteredRawElementIds = new Set();
let availableBoqFields = [];
let currentBoqColumns = [];
let boqColumnAliases = {};
let lastBoqItemIds = []; // BOQ 상세에서 이전 그룹으로 돌아가기 위한 ID 저장 (미사용 시 제거 가능)
let currentBoqDetailItemId = null; // BOQ 상세에서 현재 선택된 Item ID
let loadedUnitPriceTypesForBoq = [];
let lastSelectedUnitPriceTypeId = null;

// --- 기타 상태 ---
let currentCsvImportUrl = null; // CSV 가져오기 시 사용할 URL 임시 저장
let spaceMappingState = { active: false, spaceId: null, spaceName: "" }; // 공간 매핑 모드 상태

// --- [신규] AI 모델 및 학습 관련 전역 변수 ---
let loadedAiModels = []; // 로드된 AI 모델 목록
let currentTrainingTaskId = null; // 현재 진행 중인 학습 작업 ID
let currentTrainingStatus = {}; // 현재 학습 상태 정보 (WebSocket 업데이트용)
let trainingChartInstance = null; // Chart.js 인스턴스 (학습 그래프)
let uploadedCsvFilename = null; // 학습용으로 업로드된 CSV 파일명 (서버 임시 저장 이름)
let csvHeaders = []; // 업로드된 CSV 헤더 목록
let trainedModelTempFilename = null; // 학습 완료 후 임시 저장된 h5 파일명 (DB 저장/다운로드용)
let trainedModelMetadata = null; // 학습 완료 후 생성된 메타데이터

// --- [신규] 개산견적(SD) 관련 전역 변수 ---
let sdEnabledCostCodes = []; // SD용 공사코드 목록 (수량 포함)
let selectedSdModelId = null; // SD 탭에서 선택된 AI 모델 ID
let sdPredictionChartInstance = null; // Chart.js 인스턴스 (SD 결과 그래프)
let loadedSdCostItems = []; // SD 탭 하단 테이블용 데이터
let sdColumnFilters = {}; // SD 테이블 필터
let selectedSdItemIds = new Set(); // SD 테이블 선택 ID
let sdCollapsedGroups = {}; // SD 테이블 그룹 상태
let currentSdGroupByFields = []; // SD 테이블 그룹 필드
// ▲▲▲ [교체] 여기까지 ▲▲▲

// ▼▼▼ [교체] 기존 DOMContentLoaded 이벤트 리스너 함수 전체를 아래 코드로 교체 ▼▼▼
document.addEventListener("DOMContentLoaded", () => {
    console.log(
        "[DEBUG] DOMContentLoaded start - Setting up event listeners..."
    ); // 디버깅

    // BOQ 컬럼 설정 로드 (초기 로드 시)
    loadBoqColumnSettings();

    // CSRF 토큰 설정
    const tokenInput = document.querySelector("[name=csrfmiddlewaretoken]");
    if (tokenInput && tokenInput.value) {
        csrftoken = tokenInput.value;
        console.log("[DEBUG] CSRF token updated from input field.");
    } else {
        console.warn(
            "[DEBUG] CSRF token input field not found, using cookie value."
        );
    }

    // 웹소켓 설정
    setupWebSocket();

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
    setupTagManagementListeners();
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

    console.log("[DEBUG] All specific tab listeners setup complete.");

    // --- 초기 프로젝트 로드 ---
    currentProjectId = projectSelector ? projectSelector.value : null;
    if (currentProjectId) {
        console.log(
            `[DEBUG] Initial project ID: ${currentProjectId}. Preparing to load initial data based on default tab...`
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
            activeTab = alreadyActiveSubTab.dataset.tab;
            loadDataForActiveTab();
        }
    } else {
        console.warn(
            "[WARN] Could not find default tab buttons (Management -> Ruleset) for initial activation."
        );
        // 기본 탭 로드가 안될 경우 대비, 프로젝트가 있으면 데이터 관리 탭이라도 로드 시도
        if (currentProjectId) {
            activeTab = "data-management"; // 임시 기본값
            loadDataForActiveTab();
        }
    }

    console.log("[DEBUG] DOMContentLoaded end - Initial setup finished.");
});

// --- 리스너 설정 헬퍼 함수들 (기존 함수들 포함) ---

function setupTagManagementListeners() {
    document
        .getElementById("create-tag-btn")
        ?.addEventListener("click", createNewTag);
    document
        .getElementById("tag-list")
        ?.addEventListener("click", handleTagListActions); // 수정, 삭제 위임
    document
        .getElementById("import-tags-btn")
        ?.addEventListener("click", () =>
            document.getElementById("tag-file-input").click()
        );
    document
        .getElementById("tag-file-input")
        ?.addEventListener("change", importTags);
    document
        .getElementById("export-tags-btn")
        ?.addEventListener("click", exportTags);
    console.log("[DEBUG] Tag Management listeners setup complete.");
}

function setupSpaceManagementListeners() {
    document
        .getElementById("add-root-space-btn")
        ?.addEventListener("click", () => handleSpaceActions("add_root"));
    document
        .getElementById("apply-space-rules-btn")
        ?.addEventListener("click", applySpaceClassificationRules);
    document
        .getElementById("export-space-classifications-btn")
        ?.addEventListener("click", exportSpaceClassifications);
    document
        .getElementById("import-space-classifications-btn")
        ?.addEventListener("click", triggerSpaceClassificationsImport);

    const spaceTreeContainer = document.getElementById("space-tree-container");
    if (spaceTreeContainer && !spaceTreeContainer.dataset.listenerAttached) {
        spaceTreeContainer.addEventListener("click", handleSpaceTreeActions); // 트리 내 버튼 위임
        spaceTreeContainer.dataset.listenerAttached = "true";
    }
    const smPanel = document.getElementById("space-management");
    if (smPanel) {
        smPanel
            .querySelector(".left-panel-tabs")
            ?.addEventListener("click", handleLeftPanelTabClick); // 좌측 패널 탭
        document
            .getElementById("sm-render-table-btn")
            ?.addEventListener("click", () =>
                renderDataTable(
                    "space-management-data-table-container",
                    "space-management"
                )
            );
        document
            .getElementById("add-space-management-group-level-btn")
            ?.addEventListener("click", () =>
                addGroupingLevel("space-management")
            );
        document
            .getElementById("space-management-grouping-controls")
            ?.addEventListener("change", () =>
                renderDataTable(
                    "space-management-data-table-container",
                    "space-management"
                )
            ); // 그룹핑 변경
        const smTableContainer = document.getElementById(
            "space-management-data-table-container"
        );
        if (smTableContainer) {
            smTableContainer.addEventListener("keyup", (e) =>
                handleColumnFilter(e, "space-management")
            ); // 필터
            smTableContainer.addEventListener("click", (e) =>
                handleTableClick(e, "space-management")
            ); // 행 선택, 그룹 토글
        }
    }

    setupAssignedElementsModalListeners(); // Call the new setup function
    console.log("[DEBUG] Space Management listeners setup complete.");
}

function setupRulesetManagementListeners() {
    document
        .querySelectorAll(".ruleset-nav-button")
        .forEach((button) =>
            button.addEventListener("click", handleRulesetNavClick)
        ); // 룰셋 종류 탭
    // 각 룰셋 '새 규칙 추가' 버튼
    document
        .getElementById("add-classification-rule-btn")
        ?.addEventListener("click", () =>
            renderClassificationRulesetTable(loadedClassificationRules, "new")
        );
    document
        .getElementById("add-mapping-rule-btn")
        ?.addEventListener("click", () =>
            renderPropertyMappingRulesetTable(loadedPropertyMappingRules, "new")
        );
    document
        .getElementById("add-costcode-rule-btn")
        ?.addEventListener("click", () =>
            renderCostCodeRulesetTable(loadedCostCodeRules, "new")
        );
    document
        .getElementById("add-member-mark-assignment-rule-btn")
        ?.addEventListener("click", () =>
            renderMemberMarkAssignmentRulesetTable(
                loadedMemberMarkAssignmentRules,
                "new"
            )
        );
    document
        .getElementById("add-cost-code-assignment-rule-btn")
        ?.addEventListener("click", () =>
            renderCostCodeAssignmentRulesetTable(
                loadedCostCodeAssignmentRules,
                "new"
            )
        );
    document
        .getElementById("add-space-classification-rule-btn")
        ?.addEventListener("click", () =>
            renderSpaceClassificationRulesetTable(
                loadedSpaceClassificationRules,
                "new"
            )
        );
    document
        .getElementById("add-space-assignment-rule-btn")
        ?.addEventListener("click", () =>
            renderSpaceAssignmentRulesetTable(loadedSpaceAssignmentRules, "new")
        );
    // 각 룰셋 테이블 이벤트 위임 (수정, 삭제, 저장, 취소)
    document
        .getElementById("classification-ruleset")
        ?.addEventListener("click", handleClassificationRuleActions);
    document
        .getElementById("mapping-ruleset-table-container")
        ?.addEventListener("click", handlePropertyMappingRuleActions);
    document
        .getElementById("costcode-ruleset-table-container")
        ?.addEventListener("click", handleCostCodeRuleActions);
    document
        .getElementById("member-mark-assignment-ruleset-table-container")
        ?.addEventListener("click", handleMemberMarkAssignmentRuleActions);
    document
        .getElementById("cost-code-assignment-ruleset-table-container")
        ?.addEventListener("click", handleCostCodeAssignmentRuleActions);
    document
        .getElementById("space-classification-ruleset-table-container")
        ?.addEventListener("click", handleSpaceClassificationRuleActions);
    document
        .getElementById("space-assignment-ruleset-table-container")
        ?.addEventListener("click", handleSpaceAssignmentRuleActions);
    // CSV 가져오기/내보내기 버튼 (동적 설정)
    setupRulesetCsvButtons();
    console.log("[DEBUG] Ruleset Management listeners setup complete.");
}

function setupCostCodeManagementListeners() {
    document
        .getElementById("add-cost-code-btn")
        ?.addEventListener("click", () =>
            renderCostCodesTable(loadedCostCodes, "new")
        );
    document
        .getElementById("cost-codes-table-container")
        ?.addEventListener("click", handleCostCodeActions); // 수정, 삭제, 저장, 취소 위임
    document
        .getElementById("export-cost-codes-btn")
        ?.addEventListener("click", exportCostCodes);
    document
        .getElementById("import-cost-codes-btn")
        ?.addEventListener("click", triggerCostCodesImport);
    console.log("[DEBUG] Cost Code Management listeners setup complete.");
}

function setupMemberMarkManagementListeners() {
    document
        .getElementById("add-member-mark-btn")
        ?.addEventListener("click", () =>
            renderMemberMarksTable(loadedMemberMarks, "new")
        );
    document
        .getElementById("member-marks-table-container")
        ?.addEventListener("click", handleMemberMarkActions); // 수정, 삭제, 저장, 취소 위임
    document
        .getElementById("export-member-marks-btn")
        ?.addEventListener("click", exportMemberMarks);
    document
        .getElementById("import-member-marks-btn")
        ?.addEventListener("click", triggerMemberMarksImport);
    console.log("[DEBUG] Member Mark Management listeners setup complete.");
}

function setupDetailedEstimationListeners() {
    document
        .getElementById("generate-boq-btn")
        ?.addEventListener("click", generateBoqReport);
    document
        .getElementById("boq-reset-columns-btn")
        ?.addEventListener("click", () => resetBoqColumnsAndRegenerate(false)); // 확인창 표시
    document
        .getElementById("export-boq-btn")
        ?.addEventListener("click", exportBoqReportToExcel);
    document
        .getElementById("boq-get-from-client-btn")
        ?.addEventListener("click", handleBoqGetFromClient);
    document
        .getElementById("boq-select-in-client-btn")
        ?.addEventListener("click", handleBoqSelectInClient);
    document
        .getElementById("boq-clear-selection-filter-btn")
        ?.addEventListener("click", handleBoqClearFilter);
    document
        .getElementById("add-boq-group-level-btn")
        ?.addEventListener("click", addBoqGroupingLevel);
    // 필터 체크박스
    document
        .getElementById("boq-filter-ai")
        ?.addEventListener("change", generateBoqReport);
    document
        .getElementById("boq-filter-dd")
        ?.addEventListener("change", generateBoqReport);
    // DD 탭 UI 초기화 (토글 버튼, 탭 등)
    initializeBoqUI(); // 패널 토글, 상세 탭 리스너 설정
    console.log("[DEBUG] Detailed Estimation (DD) listeners setup complete.");
}

function setupAiModelManagementListeners() {
    // 내부 탭 전환
    document
        .querySelector("#ai-model-manager .inner-tab-nav")
        ?.addEventListener("click", handleAiInnerTabClick);
    // 모델 업로드 관련
    document
        .getElementById("upload-ai-model-files-btn")
        ?.addEventListener("click", triggerAiFileUpload);
    document
        .getElementById("confirm-upload-ai-model-btn")
        ?.addEventListener("click", uploadAiModel);
    document
        .getElementById("ai-model-h5-input")
        ?.addEventListener("change", () =>
            displaySelectedFileName(
                "ai-model-h5-input",
                "upload-ai-model-files-btn"
            )
        );
    document
        .getElementById("ai-model-json-input")
        ?.addEventListener("change", () =>
            displaySelectedFileName(
                "ai-model-json-input",
                "upload-ai-model-files-btn"
            )
        );
    // 모델 목록 테이블 액션 (수정, 삭제, 다운로드)
    document
        .getElementById("ai-model-list-container")
        ?.addEventListener("click", handleAiModelListActions);
    // 모델 학습 관련
    document
        .getElementById("upload-csv-btn")
        ?.addEventListener("click", uploadAndAnalyzeCsv);
    document
        .getElementById("training-csv-input")
        ?.addEventListener("change", () =>
            displaySelectedFileName("training-csv-input", "upload-csv-btn")
        );
    document
        .getElementById("start-training-btn")
        ?.addEventListener("click", startTraining);
    document
        .getElementById("save-trained-model-btn")
        ?.addEventListener("click", saveTrainedModel); // DB 저장 버튼
    document
        .getElementById("download-trained-model-h5-btn")
        ?.addEventListener("click", () => downloadTrainedModelFile("h5")); // H5 다운로드
    document
        .getElementById("download-trained-model-json-btn")
        ?.addEventListener("click", () => downloadTrainedModelFile("json")); // JSON 다운로드
    document
        .getElementById("reset-training-btn")
        ?.addEventListener("click", resetTrainingUI); // 학습 리셋
    // 피처 선택 리스너 (체크박스 변경 감지)
    document
        .getElementById("input-feature-list")
        ?.addEventListener("change", handleFeatureSelection);
    document
        .getElementById("output-feature-list")
        ?.addEventListener("change", handleFeatureSelection);

    document
        .getElementById("add-hidden-layer-btn")
        ?.addEventListener("click", addHiddenLayerRow);

    // 제거 버튼은 동적으로 추가되므로 이벤트 위임 사용 (컨테이너에 리스너 추가)
    const layersContainer = document.getElementById("hidden-layers-config");
    if (layersContainer && !layersContainer.dataset.listenerAttached) {
        // 중복 방지
        layersContainer.addEventListener("click", (event) => {
            if (event.target.classList.contains("remove-layer-btn")) {
                removeHiddenLayerRow(event);
            }
        });
        layersContainer.dataset.listenerAttached = "true"; // 리스너 추가됨 표시
    }

    // 데이터 분할 비율 변경 시 Test 비율 업데이트
    const trainRatioInput = document.getElementById("train-ratio");
    const valRatioInput = document.getElementById("val-ratio");
    const testRatioDisplay = document.getElementById("test-ratio-display");
    const updateTestRatio = () => {
        const trainR = parseInt(trainRatioInput?.value) || 0;
        const valR = parseInt(valRatioInput?.value) || 0;
        const testR = 100 - trainR - valR;
        if (testRatioDisplay) {
            testRatioDisplay.textContent = `Test 비율(%): ${
                testR >= 0 ? testR : "오류"
            }`;
        }
    };
    trainRatioInput?.addEventListener("input", updateTestRatio);
    valRatioInput?.addEventListener("input", updateTestRatio);

    // 랜덤 시드 고정 옵션 변경 시 입력 필드 표시/숨김
    const useRandomSeedCheckbox = document.getElementById("use-random-seed");
    const randomSeedValueInput = document.getElementById("random-seed-value");
    useRandomSeedCheckbox?.addEventListener("change", (event) => {
        if (randomSeedValueInput) {
            randomSeedValueInput.style.display = event.target.checked
                ? "inline-block"
                : "none";
        }
    });

    // 설정 초기화 버튼
    document
        .getElementById("reset-training-config-btn")
        ?.addEventListener("click", () => {
            if (
                confirm(
                    "모델 구조, 하이퍼파라미터, 데이터 분할 설정을 기본값으로 초기화하시겠습니까?"
                )
            ) {
                resetTrainingUI(false); // UI만 리셋 (CSV는 유지)
                // resetTrainingUI 함수 내부에서 UI 요소들 초기화
                // resetHiddenLayersConfig() 호출 불필요 (resetTrainingUI에서 처리)
                showToast("학습 설정을 초기화했습니다.", "info");
            }
        });

    console.log("[DEBUG] AI Model Management listeners setup complete.");
}

// ▲▲▲ [교체] 여기까지 ▲▲▲

// --- 핸들러 함수들 ---

function handleRulesetNavClick(e) {
    const targetButton = e.currentTarget;
    if (targetButton.classList.contains("active")) return;

    // 현재 활성화된 버튼/컨텐츠 비활성화
    const currentActiveButton = document.querySelector(
        ".ruleset-nav-button.active"
    );
    if (currentActiveButton) currentActiveButton.classList.remove("active");
    document
        .querySelectorAll(".ruleset-content.active")
        .forEach((content) => content.classList.remove("active"));

    // 클릭된 버튼/컨텐츠 활성화
    targetButton.classList.add("active");
    const targetRulesetId = targetButton.dataset.ruleset; // e.g., "classification-ruleset"
    const targetContent = document.getElementById(targetRulesetId);
    if (targetContent) targetContent.classList.add("active");

    const buttonText =
        targetButton.querySelector("strong")?.innerText || "선택된 룰셋";
    showToast(`${buttonText} 탭으로 전환합니다.`, "info");

    // --- [핵심] 여기서 해당 룰셋 데이터 로드 함수 호출 ---
    loadSpecificRuleset(targetRulesetId);
}

// 룰셋 테이블의 모든 동작(저장, 수정, 취소, 삭제)을 처리하는 함수

// 룰셋 테이블의 모든 동작(저장, 수정, 취소, 삭제)을 처리하는 함수

/**
 * '분류 할당 룰셋'을 서버에 저장(생성/업데이트)합니다.
 * @param {Object} ruleData - 저장할 규칙 데이터
 */

/**
 * 서버에서 '분류 할당 룰셋'을 삭제합니다.
 * @param {Number} ruleId - 삭제할 규칙의 ID
 */

// ▼▼▼ [추가] 파일의 이 위치에 아래 함수들을 모두 추가해주세요. ▼▼▼

// ▲▲▲ [추가] 여기까지 입니다. ▲▲▲

// ... (기존 createAutoQuantityMembers 함수 아래)

// connections/static/connections/main.js 파일 가장 하단에 추가
// aibim_quantity_takeoff_web/connections/static/connections/main.js

// ... (파일의 다른 부분은 그대로 유지합니다) ...

// main.js
// main.js

// ▼▼▼ [추가] 파일의 맨 아래에 아래 함수들을 모두 추가해주세요. ▼▼▼

// =====================================================================
// 산출항목(CostItem) 관리 관련 함수들
// =====================================================================

// connections/static/connections/main.js 파일에서 loadCostItems 함수를 찾아 아래 코드로 교체하세요.
// connections/static/connections/main.js 파일에서
// 기존 loadCostItems 함수를 찾아 아래 코드로 교체하세요.

// =====================================================================
// 공사코드 룰셋(CostCodeRule) 관리 관련 함수들
// =====================================================================

// ▼▼▼ [추가] 이 함수 블록을 추가해주세요. ▼▼▼
/**
 * '수량산출부재' 탭 내부의 뷰 탭('수량산출부재 뷰', '공사코드별 뷰') 클릭을 처리합니다.
 */
function handleQmViewTabClick(event) {
    const clickedButton = event.target.closest(".view-tab-button");
    if (!clickedButton || clickedButton.classList.contains("active")) {
        return;
    }

    // 모든 탭 버튼에서 active 클래스 제거
    document
        .querySelectorAll("#quantity-members .view-tab-button.active")
        .forEach((btn) => {
            btn.classList.remove("active");
        });

    // 클릭된 버튼에 active 클래스 추가
    clickedButton.classList.add("active");

    // 전역 상태 업데이트 및 테이블 다시 그리기
    activeQmView = clickedButton.dataset.view;
    qmCollapsedGroups = {}; // 뷰가 바뀌면 그룹 접힘 상태 초기화
    qmColumnFilters = {}; // 뷰가 바뀌면 컬럼 필터 초기화
    renderActiveQmView();
}
// ▲▲▲ 여기까지 입니다. ▲▲▲

// ▼▼▼ [추가] 공사코드 선택 모달을 제어하는 함수 블록 ▼▼▼

// =====================================================================
// 할당 룰셋 (MemberMark, CostCode) 관리 및 적용 함수들
// =====================================================================

// 기존의 applyAssignmentRules 함수를 찾아서 아래 코드로 전체를 교체해주세요.

async function applyAssignmentRules(skipConfirmation = false) {
    // [변경] 파라미터 추가
    if (!currentProjectId) {
        showToast("프로젝트를 선택하세요.", "error");
        return;
    }

    // [변경] skipConfirmation이 false일 때만 확인 창을 띄우도록 수정
    if (
        !skipConfirmation &&
        !confirm(
            "정의된 모든 할당 룰셋(일람부호, 공사코드)을 전체 부재에 적용하시겠습니까?\n이 작업은 기존 할당 정보를 덮어쓰거나 추가할 수 있습니다."
        )
    ) {
        return;
    }

    showToast("룰셋을 적용하고 있습니다. 잠시만 기다려주세요...", "info", 5000);
    try {
        const response = await fetch(
            `/connections/api/quantity-members/apply-assignment-rules/${currentProjectId}/`,
            {
                method: "POST",
                headers: { "X-CSRFToken": csrftoken },
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        showToast(result.message, "success");

        await loadCostCodes();
        await loadMemberMarks();
        await loadQuantityMembers();

        renderQmCostCodesList();
        renderQmMemberMarkDetails();
    } catch (error) {
        showToast(`룰셋 적용 실패: ${error.message}`, "error");
    }
}
/**
 * '수량산출부재' 탭의 오른쪽 상세 정보 패널의 탭 클릭을 처리합니다.
 */
function handleQmDetailTabClick(event) {
    const clickedButton = event.target.closest(".detail-tab-button");
    if (!clickedButton || clickedButton.classList.contains("active")) {
        return; // 버튼이 아니거나 이미 활성화된 버튼이면 무시
    }

    const targetTab = clickedButton.dataset.tab;
    const detailsPanel = clickedButton.closest(".details-panel");

    // 모든 탭 버튼과 컨텐츠에서 'active' 클래스 제거
    detailsPanel
        .querySelectorAll(".detail-tab-button.active")
        .forEach((btn) => btn.classList.remove("active"));
    detailsPanel
        .querySelectorAll(".detail-tab-content.active")
        .forEach((content) => content.classList.remove("active"));

    // 클릭된 버튼과 그에 맞는 컨텐츠에 'active' 클래스 추가
    clickedButton.classList.add("active");
    const targetContent = detailsPanel.querySelector(
        `.detail-tab-content[data-tab="${targetTab}"]`
    );
    if (targetContent) {
        targetContent.classList.add("active");
    }
}

// ▼▼▼ [추가] 파일의 맨 아래에 아래 이벤트 리스너와 함수들을 추가해주세요. ▼▼▼

// --- '집계' 탭 이벤트 리스너 ---

async function loadBoqGroupingFields() {
    if (!currentProjectId) {
        showToast("먼저 프로젝트를 선택하세요.", "error");
        return;
    }

    // ▼▼▼ [핵심 수정] 탭에 진입할 때마다 필드 목록을 새로 가져오도록 기존 캐싱 로직(if 문)을 삭제합니다. ▼▼▼
    console.log("[DEBUG] BOQ 탭의 그룹핑/표시 필드 목록을 서버에 요청합니다.");

    try {
        const response = await fetch(
            `/connections/api/boq/grouping-fields/${currentProjectId}/`
        );
        if (!response.ok) {
            throw new Error("그룹핑 필드 목록을 불러오는데 실패했습니다.");
        }

        availableBoqFields = await response.json();
        console.log(
            `[DEBUG] ${availableBoqFields.length}개의 사용 가능한 BOQ 필드를 수신했습니다.`,
            availableBoqFields
        );

        // 기존 UI 렌더링 로직은 그대로 유지합니다.
        renderBoqDisplayFieldControls(availableBoqFields);

        // 그룹핑 컨트롤 UI가 비어있을 때만 첫 번째 그룹핑 레벨을 추가합니다.
        if (document.querySelectorAll(".boq-group-level").length === 0) {
            addBoqGroupingLevel();
        } else {
            // 이미 그룹핑 컨트롤이 있다면, 필드 목록만 최신화합니다.
            const groupBySelects = document.querySelectorAll(
                ".boq-group-by-select"
            );
            let optionsHtml = availableBoqFields
                .map(
                    (field) =>
                        `<option value="${field.value}">${field.label}</option>`
                )
                .join("");

            groupBySelects.forEach((select) => {
                const selectedValue = select.value;
                select.innerHTML = optionsHtml;
                select.value = selectedValue; // 기존 선택값 유지
            });
            console.log(
                "[DEBUG] 기존 그룹핑 컨트롤의 필드 목록을 최신화했습니다."
            );
        }
    } catch (error) {
        console.error("Error loading BOQ grouping fields:", error);
        showToast(error.message, "error");
        availableBoqFields = []; // 에러 발생 시 목록 초기화
        renderBoqDisplayFieldControls([]);
    }
}

function addBoqGroupingLevel() {
    console.log("[DEBUG] '+ 그룹핑 추가' 버튼 클릭됨");
    const container = document.getElementById("boq-grouping-controls");
    const newIndex = container.children.length;

    if (availableBoqFields.length === 0) {
        showToast("그룹핑 필드 정보를 먼저 불러와야 합니다.", "info");
        console.warn(
            "[DEBUG] availableBoqFields가 비어있어 그룹핑 레벨 추가 중단."
        );
        return;
    }

    const newLevelDiv = document.createElement("div");
    newLevelDiv.className = "boq-group-level";

    let optionsHtml = availableBoqFields
        .map(
            (field) => `<option value="${field.value}">${field.label}</option>`
        )
        .join("");

    newLevelDiv.innerHTML = `
        <label>${newIndex + 1}차:</label>
        <select class="boq-group-by-select">${optionsHtml}</select>
        <button class="remove-boq-group-level-btn" style="padding: 2px 6px; font-size: 12px;">-</button>
    `;
    container.appendChild(newLevelDiv);
    console.log(`[DEBUG] ${newIndex + 1}차 그룹핑 레벨 추가됨.`);

    newLevelDiv
        .querySelector(".remove-boq-group-level-btn")
        .addEventListener("click", function () {
            console.log("[DEBUG] 그룹핑 레벨 제거 버튼 클릭됨");
            this.parentElement.remove();
            container
                .querySelectorAll(".boq-group-level label")
                .forEach((label, index) => {
                    label.textContent = `${index + 1}차:`;
                });
            console.log("[DEBUG] 그룹핑 레벨 재정렬 완료.");
        });
}

async function generateBoqReport(preserveColumnOrder = false) {
    console.log("[DEBUG] '집계표 생성' 버튼 클릭됨 / 혹은 단가기준 변경됨");

    if (!currentProjectId) {
        showToast("먼저 프로젝트를 선택하세요.", "error");
        console.error("[DEBUG] 프로젝트가 선택되지 않아 중단됨.");
        return;
    }

    // --- [핵심 수정] 체크박스 상태 읽기를 함수 내부로 이동 ---
    // 상세견적(DD) 탭은 DD 활성 공사코드만 집계하도록 필터를 고정합니다.
    const filterAiChecked = false;
    const filterDdChecked = true;
    console.log(
        "[DEBUG] Detailed Estimation filter fixed to DD-only (AI=false, DD=true)."
    );
    // --- [핵심 수정] 여기까지 ---

    const groupBySelects = document.querySelectorAll(".boq-group-by-select");
    if (groupBySelects.length === 0 && activeTab === "boq") {
        // activeTab 체크 추가
        showToast("하나 이상의 그룹핑 기준을 추가하세요.", "error");
        console.error("[DEBUG] 그룹핑 기준이 없어 중단됨.");
        return;
    }

    const params = new URLSearchParams();
    groupBySelects.forEach((select) => params.append("group_by", select.value));
    console.log("[DEBUG] 그룹핑 기준:", params.getAll("group_by"));

    const displayByCheckboxes = document.querySelectorAll(
        ".boq-display-field-cb:checked"
    );
    displayByCheckboxes.forEach((cb) => params.append("display_by", cb.value));
    console.log("[DEBUG] 표시 필드:", params.getAll("display_by"));

    params.append("filter_ai", filterAiChecked); // 이미 함수 내에서 정의됨
    params.append("filter_dd", filterDdChecked); // 이미 함수 내에서 정의됨

    if (boqFilteredRawElementIds.size > 0) {
        boqFilteredRawElementIds.forEach((id) =>
            params.append("raw_element_ids", id)
        );
        console.log(
            `[DEBUG] Revit 필터링 ID ${boqFilteredRawElementIds.size}개 적용됨.`
        );
    }

    const tableContainer = document.getElementById("boq-table-container");
    tableContainer.innerHTML =
        '<p style="padding: 20px;">집계 데이터를 생성 중입니다...</p>';
    showToast("집계표 생성 중...", "info");
    console.log(
        `[DEBUG] 서버에 집계표 데이터 요청 시작... /connections/api/boq/report/${currentProjectId}/?${params.toString()}`
    );

    try {
        const response = await fetch(
            `/connections/api/boq/report/${currentProjectId}/?${params.toString()}`
        );
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(
                errorResult.message || `서버 오류 (${response.status})`
            );
        }

        const data = await response.json();
        console.log("[DEBUG] 서버로부터 집계표 데이터 수신 완료:", data);
        if (data.items_detail) {
            // [수정] SD탭과 변수를 공유하지 않도록 DD탭 전용 변수에 저장 (필요 시 변수명 변경)
            // loadedCostItems = data.items_detail; // 기존 코드 주석 처리 또는 제거
            // console.log(`[DEBUG] loadedCostItems 업데이트 완료 (${loadedCostItems.length}개 항목).`); // 로그 수정

            // DD탭에서 사용할 상세 아이템 데이터 저장 (예: 별도 변수 사용)
            loadedDdCostItems = data.items_detail; // 예시: DD용 변수 사용
            console.log(
                `[DEBUG] loadedDdCostItems 업데이트 완료 (${loadedDdCostItems.length}개 항목).`
            );
        } else {
            console.warn("[WARN] API 응답에 'items_detail' 필드가 없습니다.");
            loadedDdCostItems = []; // DD용 변수 초기화
        }
        loadedUnitPriceTypesForBoq = data.unit_price_types || [];
        console.log(
            `[DEBUG] ${loadedUnitPriceTypesForBoq.length}개의 단가 기준 목록 수신.`
        );

        // [추가] DD용 컬럼 상태 업데이트 (렌더링 전에 호출)
        if (!preserveColumnOrder) {
            updateDdBoqColumns();
        }

        // [핵심 수정] renderBoqTable 호출 시 대상 컨테이너 ID 명시적 전달
        renderBoqTable(
            data.report,
            data.summary,
            loadedUnitPriceTypesForBoq,
            "boq-table-container"
        );
        setupBoqTableInteractions(); // DD 테이블 상호작용 설정 함수 호출 (setupSdBoqTableInteractions와 구분)
        console.log("[DEBUG] 집계표 렌더링 완료.");

        updateBoqDetailsPanel(null); // 하단 패널 초기화
    } catch (error) {
        console.error("[DEBUG] 집계표 생성 중 오류 발생:", error);
        tableContainer.innerHTML = `<p style="padding: 20px; color: red;">오류: ${error.message}</p>`;
        showToast(error.message, "error");
    }
}

/**
 * 집계 테이블과 상세 정보 패널의 모든 상호작용을 위한 이벤트 리스너를 설정합니다.
 * (수정됨: 탭 클릭 리스너는 initializeBoqUI 함수로 이동)
 */
function setupBoqTableInteractions() {
    // 디버깅 로그 추가
    console.log("[DEBUG] Setting up BOQ table interactions...");
    const tableContainer = document.getElementById("boq-table-container");
    const table = tableContainer.querySelector(".boq-table");
    if (!table) {
        console.warn("[WARN] BOQ table element not found for interactions."); // 디버깅
        return;
    }

    // --- 1. 메인 BOQ 테이블 상호작용 (열 이름 변경, 드래그앤드롭 등) ---
    const thead = table.querySelector("thead");
    if (thead && !thead.dataset.interactionsAttached) {
        // 중복 리스너 방지
        // Column name editing listener
        thead.addEventListener("click", (e) => {
            if (e.target.classList.contains("col-edit-btn")) {
                const th = e.target.closest("th");
                if (th.querySelector("input")) return; // Already in edit mode

                const colId = th.dataset.columnId;
                const textNode = Array.from(th.childNodes).find(
                    (node) => node.nodeType === Node.TEXT_NODE
                );
                if (!textNode) return;

                const originalText = textNode.nodeValue.trim();
                const editIcon = th.querySelector(".col-edit-btn");

                textNode.nodeValue = "";
                if (editIcon) editIcon.style.display = "none";

                const input = document.createElement("input");
                input.type = "text";
                input.value = originalText;
                input.className = "th-edit-input";

                th.prepend(input);
                input.focus();
                input.select();

                let alreadyHandled = false;

                const handleCleanup = (shouldSave) => {
                    if (alreadyHandled) return;
                    alreadyHandled = true;

                    const newAlias = input.value.trim();

                    input.remove();
                    if (editIcon) editIcon.style.display = "";

                    if (shouldSave) {
                        if (newAlias && newAlias !== originalText) {
                            boqColumnAliases[colId] = newAlias;
                            textNode.nodeValue = `${newAlias} `;
                            saveBoqColumnSettings();
                        } else if (newAlias === "") {
                            const defaultLabel =
                                currentBoqColumns.find((c) => c.id === colId)
                                    ?.label || colId;
                            delete boqColumnAliases[colId];
                            textNode.nodeValue = `${defaultLabel} `;
                            saveBoqColumnSettings();
                        } else {
                            textNode.nodeValue = `${originalText} `;
                        }
                    } else {
                        // Cancelled, restore original text
                        textNode.nodeValue = `${originalText} `;
                    }
                };

                input.addEventListener("blur", () => handleCleanup(true));
                input.addEventListener("keydown", (ev) => {
                    if (ev.isComposing || ev.keyCode === 229) return;

                    if (ev.key === "Enter") {
                        handleCleanup(true);
                    } else if (ev.key === "Escape") {
                        handleCleanup(false);
                    }
                });
            }
        });

        thead.dataset.interactionsAttached = "true"; // Mark as attached
        console.log(
            "[DEBUG] BOQ table header interactions (drag/drop, edit) attached."
        ); // 디버깅
    }

    // --- 2. 메인 BOQ 테이블 '행' 클릭 시 -> 중앙 하단 목록 업데이트 ---
    const tbody = table.querySelector("tbody");
    if (tbody && !tbody.dataset.rowClickListenerAttached) {
        // 중복 리스너 방지
        tbody.addEventListener("click", (e) => {
            const row = e.target.closest("tr.boq-group-header");
            if (row && !e.target.matches("select, button, i")) {
                // 드롭다운, 버튼 클릭 시 행 선택 방지
                const currentSelected = table.querySelector(
                    "tr.selected-boq-row"
                );
                if (currentSelected)
                    currentSelected.classList.remove("selected-boq-row");
                row.classList.add("selected-boq-row");

                const itemIds = JSON.parse(row.dataset.itemIds || "[]");
                console.log(
                    `[DEBUG][Event] Main BOQ table row clicked. Item IDs: ${itemIds.length}`
                ); // 디버깅
                updateBoqDetailsPanel(itemIds); // 하단 CostItem 목록 및 상세 정보 업데이트 (★ 여기서 하단 테이블 그려짐)
            }
        });
        tbody.dataset.rowClickListenerAttached = "true"; // 리스너 추가됨 표시
        console.log("[DEBUG] Main BOQ table row click listener attached."); // 디버깅
    }

    // --- 3. 메인 BOQ 테이블 '단가기준' 드롭다운 변경 시 ---
    // (이 리스너는 tbody에 이미 위임되어 있음, 중복 추가 불필요)
    if (tbody && !tbody.dataset.unitPriceChangeListenerAttached) {
        // 중복 리스너 방지
        tbody.addEventListener("change", async (e) => {
            if (e.target.classList.contains("unit-price-type-select")) {
                const selectElement = e.target;
                const newTypeId = selectElement.value; // 선택된 새 UnitPriceType ID (빈 문자열 가능)
                const itemIdsToUpdate = JSON.parse(
                    selectElement.dataset.itemIds || "[]"
                );

                if (itemIdsToUpdate.length === 0) return;

                console.log(
                    `[DEBUG][Event] UnitPriceType changed for ${itemIdsToUpdate.length} items. New Type ID: ${newTypeId}`
                ); // 디버깅
                showToast("단가 기준을 업데이트 중입니다...", "info");

                try {
                    const response = await fetch(
                        `/connections/api/boq/update-unit-price-type/${currentProjectId}/`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "X-CSRFToken": csrftoken,
                            },
                            body: JSON.stringify({
                                cost_item_ids: itemIdsToUpdate,
                                unit_price_type_id: newTypeId || null, // 빈 문자열이면 null로 전송
                            }),
                        }
                    );
                    const result = await response.json();
                    if (!response.ok)
                        throw new Error(
                            result.message || "단가 기준 업데이트 실패"
                        );

                    showToast(result.message, "success");
                    console.log(
                        `[DEBUG][Event] UnitPriceType update successful. Refreshing BOQ table...`
                    ); // 디버깅
                    // lastSelectedUnitPriceTypeId = newTypeId; // This was causing a bug where all dropdowns would change
                    // 중요: 업데이트 성공 후 BOQ 테이블 전체를 다시 그림
                    await generateBoqReport(true);
                } catch (error) {
                    console.error(
                        "[ERROR][Event] Failed to update UnitPriceType:",
                        error
                    ); // 디버깅
                    showToast(error.message, "error");
                    // 실패 시 원래 값으로 되돌리기 (선택적)
                    const row = selectElement.closest("tr");
                    selectElement.value = row.dataset.currentTypeId || "";
                }
            }
        });
        tbody.dataset.unitPriceChangeListenerAttached = "true"; // 리스너 추가됨 표시
        console.log(
            "[DEBUG] Main BOQ table unit price change listener attached."
        ); // 디버깅
    }

    // ▼▼▼ 수정: 하단 테이블 클릭 리스너 수정 ▼▼▼
    // --- 4. 중앙 하단 '포함된 산출항목' 목록 클릭 시 -> 선택 상태 변경 및 왼쪽/오른쪽 상세 패널 업데이트 ---
    const itemListContainer = document.getElementById(
        "boq-item-list-container"
    );
    if (itemListContainer && !itemListContainer.dataset.clickListenerAttached) {
        // 중복 리스너 방지
        itemListContainer.addEventListener("click", (e) => {
            const itemRow = e.target.closest("tr[data-item-id]");
            const bimButton = e.target.closest(
                "button.select-in-client-btn-detail"
            );

            if (bimButton) {
                // BIM 연동 버튼 클릭 시 (기존 로직 유지)
                const costItemId = bimButton.dataset.costItemId;
                console.log(
                    `[DEBUG][Event] BIM link button clicked for CostItem ID: ${costItemId}`
                ); // 디버깅
                handleBoqSelectInClientFromDetail(costItemId); // 상세 목록용 함수 호출
            } else if (itemRow) {
                // 행의 다른 부분 클릭 시 (상세 정보 표시)
                const itemId = itemRow.dataset.itemId;
                console.log(
                    `[DEBUG][Event] Bottom BOQ item row clicked. Item ID: ${itemId}`
                ); // 디버깅

                // --- 여기가 수정된 핵심 로직 ---
                // a. 이전에 선택된 행의 'selected' 클래스 제거
                //    (★ 'selected-boq-row'가 아니라 '.selected' 사용 확인 ★)
                const currentSelectedRow =
                    itemListContainer.querySelector("tr.selected");
                if (currentSelectedRow) {
                    currentSelectedRow.classList.remove("selected");
                    console.log(
                        `[DEBUG][UI] Removed 'selected' class from previous bottom row.`
                    ); // 디버깅
                }
                // b. 클릭된 행에 'selected' 클래스 추가 (연두색 배경)
                itemRow.classList.add("selected");
                console.log(
                    `[DEBUG][UI] Added 'selected' class to bottom table row ID: ${itemId}`
                ); // 디버깅

                // c. 상세 정보 및 BIM 객체 요약 패널 업데이트 함수 호출
                //    (ID가 변경되었는지 여부와 관계없이 호출하여 항상 최신 상태 반영)
                renderBoqItemProperties(itemId); // 왼쪽 상세 정보 렌더링
                renderBoqBimObjectCostSummary(itemId); // 오른쪽 BIM 객체 요약 렌더링
                // --- 수정된 로직 끝 ---
            } else {
                console.log(
                    "[DEBUG][Event] Click inside bottom panel, but not on a data row or button."
                ); // 디버깅
            }
        });
        itemListContainer.dataset.clickListenerAttached = "true"; // 리스너 추가됨 표시
        console.log("[DEBUG] Bottom BOQ item list click listener attached."); // 디버깅
    }
    // ▲▲▲ 수정 끝 ▲▲▲

    console.log("[DEBUG] BOQ table interactions setup complete."); // 디버깅
}
/**
 * BOQ 하단 상세 목록 테이블의 'BIM 연동' 버튼 클릭 시 호출됩니다.
 * @param {string} costItemId - 클릭된 버튼이 속한 CostItem의 ID
 */
function handleBoqSelectInClientFromDetail(costItemId) {
    console.log(
        `[DEBUG] handleBoqSelectInClientFromDetail called for CostItem ID: ${costItemId}`
    );
    if (!costItemId) return;

    const costItem = loadedCostItems.find((ci) => ci.id === costItemId);
    const member = costItem?.quantity_member_id
        ? loadedQuantityMembers.find(
              (qm) => qm.id === costItem.quantity_member_id
          )
        : null;
    const rawElement = member?.raw_element_id
        ? allRevitData.find((re) => re.id === member.raw_element_id)
        : null;

    if (!rawElement || !rawElement.element_unique_id) {
        showToast("이 항목과 연동된 BIM 객체를 찾을 수 없습니다.", "warning");
        console.warn(
            `[DEBUG] Could not find linked RawElement for CostItem ID: ${costItemId}`
        );
        return;
    }

    const uniqueIdToSend = rawElement.element_unique_id;
    console.log(`[DEBUG] Found Unique ID to send: ${uniqueIdToSend}`);

    const targetGroup =
        currentMode === "revit"
            ? "revit_broadcast_group"
            : "blender_broadcast_group";
    frontendSocket.send(
        JSON.stringify({
            type: "command_to_client",
            payload: {
                command: "select_elements",
                unique_ids: [uniqueIdToSend], // 단일 객체 선택
                target_group: targetGroup,
            },
        })
    );

    const clientName = currentMode === "revit" ? "Revit" : "Blender";
    showToast(
        `연관된 객체 선택 명령을 ${clientName}(으)로 보냈습니다.`,
        "success"
    );
    console.log(
        `[DEBUG] Sent select command for Unique ID ${uniqueIdToSend} to ${clientName}.`
    );
}

/**
 * [수정됨] 중앙 하단 패널에 포함된 산출항목 목록을 테이블로 렌더링하고, 숫자 서식을 적용합니다.
 * @param {Array<String>} itemIds - 표시할 CostItem의 ID 배열
 */
function updateBoqDetailsPanel(itemIds) {
    const listContainer = document.getElementById("boq-item-list-container");
    console.log(
        `[DEBUG][UI] updateBoqDetailsPanel called with ${itemIds?.length} item IDs.`
    );

    // 숫자 포매팅 헬퍼 함수
    const formatNumber = (value, precision = 3) => {
        const num = parseFloat(value);
        if (isNaN(num)) return value; // 숫자가 아니면 원래 값 반환
        return num.toFixed(precision);
    };

    if (!itemIds || itemIds.length === 0) {
        listContainer.innerHTML =
            '<p style="padding: 10px;">이 그룹에 포함된 산출항목이 없습니다.</p>';
        renderBoqItemProperties(null);
        renderBoqBimObjectCostSummary(null);
        return;
    }

    const itemsToRender = (loadedDdCostItems || []).filter((item) =>
        itemIds.includes(item.id)
    );

    if (itemsToRender.length === 0) {
        listContainer.innerHTML =
            '<p style="padding: 10px;">산출항목 데이터를 찾을 수 없습니다.</p>';
        renderBoqItemProperties(null);
        renderBoqBimObjectCostSummary(null);
        return;
    }

    const headers = [
        { id: "cost_code_name", label: "산출항목" },
        { id: "quantity", label: "수량", align: "right" },
        { id: "unit_price_type_name", label: "단가기준" },
        { id: "total_cost_unit", label: "합계단가", align: "right" },
        { id: "material_cost_unit", label: "재료비단가", align: "right" },
        { id: "labor_cost_unit", label: "노무비단가", align: "right" },
        { id: "expense_cost_unit", label: "경비단가", align: "right" },
        { id: "total_cost_total", label: "합계금액", align: "right" },
        { id: "material_cost_total", label: "재료비", align: "right" },
        { id: "labor_cost_total", label: "노무비", align: "right" },
        { id: "expense_cost_total", label: "경비", align: "right" },
        { id: "linked_member_name", label: "연관 부재" },
        { id: "linked_raw_name", label: "BIM 원본 객체" },
        { id: "actions", label: "BIM 연동", align: "center" },
    ];

    let tableHtml = `<table class="boq-item-list-table"><thead><tr>`;
    headers.forEach(
        (h) =>
            (tableHtml += `<th style="text-align: ${h.align || "left"};">${
                h.label
            }</th>`)
    );
    tableHtml += `</tr></thead><tbody>`;

    itemsToRender.forEach((item) => {
        const unitPriceType = loadedUnitPriceTypesForBoq.find(
            (t) => t.id === item.unit_price_type_id
        );

        // 모든 숫자 값에 포매팅 적용
        const values = {
            cost_code_name: item.cost_code_name || "(이름 없는 항목)",
            quantity: formatNumber(item.quantity),
            unit_price_type_name: unitPriceType
                ? unitPriceType.name
                : "(미지정)",
            total_cost_unit: formatNumber(item.total_cost_unit),
            material_cost_unit: formatNumber(item.material_cost_unit),
            labor_cost_unit: formatNumber(item.labor_cost_unit),
            expense_cost_unit: formatNumber(item.expense_cost_unit),
            total_cost_total: formatNumber(item.total_cost_total),
            material_cost_total: formatNumber(item.material_cost_total),
            labor_cost_total: formatNumber(item.labor_cost_total),
            expense_cost_total: formatNumber(item.expense_cost_total),
            linked_member_name: item.quantity_member_name || "(연관 부재 없음)",
            linked_raw_name: item.raw_element_name || "(BIM 원본 없음)",
            actions: item.raw_element_id
                ? `<button class="select-in-client-btn-detail" data-cost-item-id="${item.id}" title="연동 프로그램에서 선택 확인">👁️</button>`
                : "",
        };

        tableHtml += `<tr data-item-id="${item.id}">`;
        headers.forEach((h) => {
            const style = h.align ? `style="text-align: ${h.align};"` : "";
            tableHtml += `<td ${style}>${values[h.id]}</td>`;
        });
        tableHtml += `</tr>`;
    });

    tableHtml += "</tbody></table>";
    listContainer.innerHTML = tableHtml;
    console.log(
        "[DEBUG][UI] CostItem list table rendered in details panel (no initial selection)."
    );

    renderBoqItemProperties(null);
    renderBoqBimObjectCostSummary(null);
}

// ▼▼▼ [수정] 이 함수 전체를 아래 코드로 교체해주세요. ▼▼▼
/**
 * [수정됨] ID에 해당하는 CostItem의 상세 속성을 오른쪽 상세정보 패널에 렌더링합니다.
 * @param {String | null} itemId - 상세 정보를 표시할 CostItem의 ID
 */
function renderBoqItemProperties(itemId) {
    currentBoqDetailItemId = itemId;

    // 중앙 하단 목록에서 현재 선택된 행에 'selected' 클래스 적용
    const listContainer = document.getElementById("boq-item-list-container");
    listContainer.querySelectorAll("tr").forEach((row) => {
        row.classList.toggle("selected", row.dataset.itemId === itemId);
    });

    const memberContainer = document.getElementById(
        "boq-details-member-container"
    );
    const markContainer = document.getElementById("boq-details-mark-container");
    const rawContainer = document.getElementById("boq-details-raw-container");

    // 오른쪽 패널 초기화
    if (!itemId) {
        memberContainer.innerHTML = "<p>항목을 선택하세요.</p>";
        markContainer.innerHTML = "<p>항목을 선택하세요.</p>";
        rawContainer.innerHTML = "<p>항목을 선택하세요.</p>";
        return;
    }

    const costItem = loadedCostItems.find(
        (item) => item.id.toString() === itemId.toString()
    );
    if (!costItem) {
        memberContainer.innerHTML = "<p>항목 정보를 찾을 수 없습니다.</p>";
        markContainer.innerHTML = "";
        rawContainer.innerHTML = "";
        return;
    }

    const member = costItem.quantity_member_id
        ? loadedQuantityMembers.find(
              (m) => m.id.toString() === costItem.quantity_member_id.toString()
          )
        : null;

    // 1. 부재 속성 렌더링
    if (
        member &&
        member.properties &&
        Object.keys(member.properties).length > 0
    ) {
        let tableHtml =
            '<table class="properties-table"><thead><tr><th>속성</th><th>값</th></tr></thead><tbody>';
        Object.keys(member.properties)
            .sort()
            .forEach((key) => {
                tableHtml += `<tr><td>${key}</td><td>${member.properties[key]}</td></tr>`;
            });
        memberContainer.innerHTML = tableHtml + "</tbody></table>";
    } else {
        memberContainer.innerHTML = "<p>연관된 부재 속성이 없습니다.</p>";
    }

    // 2. 일람부호 속성 렌더링 (핵심 수정 부분)
    if (member && member.member_mark_id) {
        const mark = loadedMemberMarks.find(
            (m) => m.id.toString() === member.member_mark_id.toString()
        );
        if (mark) {
            let header = `<h5>${mark.mark} (일람부호 속성)</h5>`;
            let tableHtml =
                '<table class="properties-table"><thead><tr><th>속성</th><th>값</th></tr></thead><tbody>';
            if (mark.properties && Object.keys(mark.properties).length > 0) {
                Object.keys(mark.properties)
                    .sort()
                    .forEach((key) => {
                        tableHtml += `<tr><td>${key}</td><td>${mark.properties[key]}</td></tr>`;
                    });
            } else {
                tableHtml +=
                    '<tr><td colspan="2">정의된 속성이 없습니다.</td></tr>';
            }
            markContainer.innerHTML = header + tableHtml + "</tbody></table>";
        } else {
            markContainer.innerHTML =
                "<p>연결된 일람부호 정보를 찾을 수 없습니다.</p>";
        }
    } else {
        markContainer.innerHTML = "<p>연관된 일람부호가 없습니다.</p>";
    }

    // 3. BIM 원본 데이터 렌더링
    const rawElement = member?.raw_element_id
        ? allRevitData.find(
              (el) => el.id.toString() === member.raw_element_id.toString()
          )
        : null;
    if (rawElement?.raw_data) {
        let header = `<h5>${rawElement.raw_data.Name || "이름 없음"}</h5>`;
        let tableHtml = `<table class="properties-table"><thead><tr><th>속성</th><th>값</th></tr></thead><tbody>`;
        const allKeys = new Set();
        Object.keys(rawElement.raw_data).forEach((k) => allKeys.add(k));
        Object.keys(rawElement.raw_data.Parameters || {}).forEach((k) =>
            allKeys.add(k)
        );
        Object.keys(rawElement.raw_data.TypeParameters || {}).forEach((k) =>
            allKeys.add(k)
        );
        Array.from(allKeys)
            .sort()
            .forEach((key) => {
                const value = getValueForItem(rawElement, key);
                if (value !== undefined && typeof value !== "object") {
                    tableHtml += `<tr><td>${key}</td><td>${value}</td></tr>`;
                }
            });
        rawContainer.innerHTML = header + tableHtml + "</tbody></table>";
    } else {
        rawContainer.innerHTML = "<p>연관된 BIM 원본 데이터가 없습니다.</p>";
    }
}
// ▲▲▲ 여기까지 교체해주세요. ▲▲▲

// =====================================================================
// '집계' 탭 동적 UI 최종 완성본 (리사이저, 접기/펴기, 탭 클릭)
// =====================================================================
/* ▼▼▼ [교체] 기존 initializeBoqUI 함수를 아래의 최종 코드로 교체해주세요. ▼▼▼ */
function initializeBoqUI() {
    const ddTabContainer = document.getElementById("detailed-estimation-dd");
    if (!ddTabContainer) {
        console.warn(
            "[WARN] Detailed Estimation (DD) tab container '#detailed-estimation-dd' not found. UI initialization skipped."
        );
        return;
    }
    console.log(
        "[DEBUG] Initializing UI elements for Detailed Estimation (DD) tab..."
    );

    // UI 요소들 선택
    const leftToggleBtn = ddTabContainer.querySelector(
        "#boq-left-panel-toggle-btn"
    );
    const bottomToggleBtn = ddTabContainer.querySelector(
        "#boq-bottom-panel-toggle-btn"
    );
    const boqContainer = ddTabContainer.querySelector(".boq-container");
    const bottomPanel = ddTabContainer.querySelector(".boq-details-wrapper");
    const boqDetailsPanel = ddTabContainer.querySelector(
        "#boq-item-details-panel"
    ); // 왼쪽 상세 정보 패널

    // --- 1. 왼쪽 패널 접기/펴기 기능 ---
    if (leftToggleBtn && boqContainer) {
        if (!leftToggleBtn.dataset.listenerAttached) {
            leftToggleBtn.addEventListener("click", () => {
                boqContainer.classList.toggle("left-panel-collapsed");
                leftToggleBtn.textContent = boqContainer.classList.contains(
                    "left-panel-collapsed"
                )
                    ? "▶"
                    : "◀";
                console.log(
                    `[DEBUG] Left panel toggled. Collapsed: ${boqContainer.classList.contains(
                        "left-panel-collapsed"
                    )}`
                );
            });
            leftToggleBtn.dataset.listenerAttached = "true";
            console.log("[DEBUG] Left panel toggle listener attached.");
        }
    } else {
        console.warn("[WARN] Left toggle button or BOQ container not found.");
    }

    // --- 2. 하단 패널 접기/펴기 기능 ---
    if (bottomToggleBtn && bottomPanel) {
        if (!bottomToggleBtn.dataset.listenerAttached) {
            bottomToggleBtn.addEventListener("click", () => {
                const isCollapsing =
                    !bottomPanel.classList.contains("collapsed");
                bottomPanel.classList.toggle("collapsed");
                bottomToggleBtn.textContent = isCollapsing ? "▲" : "▼";
                console.log(
                    `[DEBUG] Bottom panel toggled. Collapsed: ${isCollapsing}`
                );
            });
            bottomToggleBtn.dataset.listenerAttached = "true";
            console.log("[DEBUG] Bottom panel toggle listener attached.");
        }
    } else {
        console.warn(
            "[WARN] Bottom toggle button or bottom panel wrapper not found."
        );
    }

    // --- 3. ★★★ 왼쪽 상세 정보 패널 탭 클릭 기능 (여기로 이동) ★★★ ---
    if (boqDetailsPanel) {
        const tabsContainer = boqDetailsPanel.querySelector(
            ".details-panel-tabs"
        );
        if (tabsContainer && !tabsContainer.dataset.listenerAttached) {
            // 중복 방지
            tabsContainer.addEventListener("click", (e) => {
                const clickedButton = e.target.closest(".detail-tab-button");
                if (
                    !clickedButton ||
                    clickedButton.classList.contains("active") ||
                    !clickedButton.closest(".details-panel-tabs")
                ) {
                    console.log(
                        "[DEBUG] DD Detail tab click ignored (not a button, already active, or outside container)."
                    );
                    return;
                }

                const targetTab = clickedButton.dataset.tab; // 클릭된 탭의 data-tab 값 (예: "boq-member-prop")
                console.log(`[DEBUG] DD Detail tab clicked: ${targetTab}`); // 상세 로그 추가

                // 현재 패널 내에서만 active 클래스 관리
                boqDetailsPanel
                    .querySelectorAll(".detail-tab-button.active")
                    .forEach((btn) => btn.classList.remove("active"));
                boqDetailsPanel
                    .querySelectorAll(".detail-tab-content.active")
                    .forEach((content) => content.classList.remove("active"));

                clickedButton.classList.add("active");
                const targetContent = boqDetailsPanel.querySelector(
                    `.detail-tab-content[data-tab="${targetTab}"]`
                );
                if (targetContent) {
                    targetContent.classList.add("active");
                    console.log(
                        `[DEBUG] DD Detail tab content activated: ${targetTab}`
                    );
                } else {
                    console.warn(
                        `[WARN] DD Detail tab content for '${targetTab}' not found.`
                    );
                }
            });
            tabsContainer.dataset.listenerAttached = "true"; // 리스너 추가됨 표시
            console.log(
                "[DEBUG] DD Detail panel tab click listener attached (in initializeBoqUI)."
            );
        } else if (!tabsContainer) {
            console.warn(
                "[WARN] DD Detail panel tabs container not found within #boq-item-details-panel."
            );
        }
    } else {
        console.warn(
            "[WARN] Left detail panel '#boq-item-details-panel' not found."
        );
    }
    // --- ★★★ 탭 리스너 이동 완료 ★★★ ---

    console.log("[DEBUG] Detailed Estimation (DD) UI initialization complete.");
}

function handleBoqSelectInClient() {
    console.log("[DEBUG] '연동 프로그램에서 선택 확인' 버튼 클릭됨");
    const selectedRow = document.querySelector(
        ".boq-table tr.selected-boq-row"
    );
    if (!selectedRow) {
        showToast("먼저 집계표에서 확인할 행을 선택하세요.", "error");
        console.warn("[DEBUG] 집계표에서 선택된 행이 없음.");
        return;
    }

    const itemIds = JSON.parse(selectedRow.dataset.itemIds || "[]");
    if (itemIds.length === 0) {
        showToast("선택된 행에 연관된 산출항목이 없습니다.", "info");
        console.warn("[DEBUG] 선택된 행에 item_ids가 없음.");
        return;
    }
    console.log(`[DEBUG] 선택된 행의 CostItem ID 목록:`, itemIds);

    const rawElementIds = new Set();
    itemIds.forEach((itemId) => {
        const costItem = loadedCostItems.find((ci) => ci.id === itemId);
        if (costItem && costItem.quantity_member_id) {
            const member = loadedQuantityMembers.find(
                (qm) => qm.id === costItem.quantity_member_id
            );
            if (member && member.raw_element_id) {
                rawElementIds.add(member.raw_element_id);
            }
        }
    });

    if (rawElementIds.size === 0) {
        showToast(
            "선택된 항목들은 BIM 객체와 직접 연관되어 있지 않습니다.",
            "info"
        );
        console.warn("[DEBUG] 연관된 BIM 객체를 찾지 못함.");
        return;
    }
    console.log(`[DEBUG] 최종 RawElement ID 목록:`, Array.from(rawElementIds));

    const uniqueIdsToSend = [];
    rawElementIds.forEach((rawId) => {
        const rawElement = allRevitData.find((re) => re.id === rawId);
        if (rawElement) {
            uniqueIdsToSend.push(rawElement.element_unique_id);
        }
    });

    if (uniqueIdsToSend.length > 0) {
        const targetGroup =
            currentMode === "revit"
                ? "revit_broadcast_group"
                : "blender_broadcast_group";
        frontendSocket.send(
            JSON.stringify({
                type: "command_to_client",
                payload: {
                    command: "select_elements",
                    unique_ids: uniqueIdsToSend,
                    target_group: targetGroup,
                },
            })
        );
        const clientName = currentMode === "revit" ? "Revit" : "Blender";
        showToast(
            `${uniqueIdsToSend.length}개 객체의 선택 명령을 ${clientName}(으)로 보냈습니다.`,
            "success"
        );
        console.log(
            `[DEBUG] ${clientName}으로 ${uniqueIdsToSend.length}개 객체 선택 명령 전송:`,
            uniqueIdsToSend
        );
    } else {
        showToast(
            "연동 프로그램으로 보낼 유효한 객체를 찾지 못했습니다.",
            "error"
        );
        console.error("[DEBUG] 전송할 최종 Unique ID를 찾지 못함.");
    }
}

function handleBoqGetFromClient() {
    console.log("[DEBUG] '선택 객체 가져오기 (BOQ)' 버튼 클릭됨");
    const targetGroup =
        currentMode === "revit"
            ? "revit_broadcast_group"
            : "blender_broadcast_group";
    frontendSocket.send(
        JSON.stringify({
            type: "command_to_client",
            payload: {
                command: "get_selection",
                target_group: targetGroup,
            },
        })
    );
    const clientName = currentMode === "revit" ? "Revit" : "Blender";
    showToast(`${clientName}에 선택 정보 가져오기를 요청했습니다.`, "info");
    console.log(`[DEBUG] ${clientName}에 get_selection 명령 전송`);
}
function handleBoqClearFilter() {
    console.log("[DEBUG] '선택 필터 해제 (BOQ)' 버튼 클릭됨");
    // 1. 필터링 ID 목록을 비웁니다.
    boqFilteredRawElementIds.clear();
    console.log("[DEBUG] boqFilteredRawElementIds 초기화 완료.");

    // 2. 버튼을 다시 숨깁니다.
    document.getElementById("boq-clear-selection-filter-btn").style.display =
        "none";

    // 3. 필터 없이 전체 데이터를 기준으로 집계표를 다시 생성합니다.
    generateBoqReport();

    // 4. 사용자에게 알림을 표시합니다.
    showToast("Revit 선택 필터를 해제하고 전체 집계표를 표시합니다.", "info");
}
function resetBoqColumnsAndRegenerate(skipConfirmation = false) {
    console.log("[DEBUG] '열 순서/이름 초기화' 버튼 클릭됨");

    // skipConfirmation이 false일 때만 확인 창을 띄웁니다.
    if (
        !skipConfirmation &&
        !confirm("테이블의 열 순서와 이름을 기본값으로 초기화하시겠습니까?")
    ) {
        console.log("[DEBUG] 초기화 취소됨.");
        return;
    }

    // localStorage에서 설정 제거
    localStorage.removeItem("boqColumnSettings");
    console.log("[DEBUG] BOQ column settings removed from localStorage.");

    // 전역 변수 초기화 (loadBoqColumnSettings가 기본값으로 다시 채울 것임)
    currentBoqColumns = [];
    boqColumnAliases = {};
    console.log(
        "[DEBUG] 열 상태(currentBoqColumns, boqColumnAliases) 초기화됨."
    );

    // 설정 로드 함수를 다시 호출하여 기본값으로 채우고, 테이블 재생성
    loadBoqColumnSettings();
    showToast("열 상태를 초기화하고 집계표를 다시 생성합니다.", "info");
    generateBoqReport();
}

// =====================================================================
// 공간분류(SpaceClassification) 관리 관련 함수들
// =====================================================================

// 현재 활성화된 탭의 상태 객체를 가져오는 헬퍼 함수
function getCurrentViewerState() {
    // 'space-management' 탭에 있을 때도 BIM 데이터 뷰어의 상태를 참조해야 하므로,
    // 현재는 'data-management'를 기본으로 하되, 추후 확장성을 고려하여 구조를 유지합니다.
    // 여기서는 각 탭이 독립적인 상태를 갖도록 구현합니다.
    return viewerStates[
        activeTab === "space-management"
            ? "space-management"
            : "data-management"
    ];
}

// =====================================================================
// 공간분류 생성 룰셋(SpaceClassificationRule) 관리 및 적용 함수들
// =====================================================================

/**
 * '공간분류 생성 룰셋' 테이블의 액션(저장, 수정, 취소, 삭제)을 처리합니다.
 */

// ▼▼▼ [추가] CSV 파일이 선택되었을 때 서버로 전송하는 함수 ▼▼▼
async function handleCsvFileSelect(event) {
    if (!currentProjectId || !currentCsvImportUrl) {
        showToast("프로젝트가 선택되지 않았거나, 잘못된 접근입니다.", "error");
        return;
    }
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("csv_file", file);

    try {
        const response = await fetch(currentCsvImportUrl, {
            method: "POST",
            headers: { "X-CSRFToken": csrftoken },
            body: formData,
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || "파일 업로드에 실패했습니다.");
        }
        showToast(result.message, "success");

        // 현재 활성화된 탭에 따라 올바른 데이터를 다시 로드합니다.
        if (activeTab === "ruleset-management") {
            const activeRulesetContent = document.querySelector(
                ".ruleset-content.active"
            );
            if (activeRulesetContent) {
                const rulesetId = activeRulesetContent.id;
                if (rulesetId === "classification-ruleset")
                    await loadClassificationRules();
                else if (rulesetId === "mapping-ruleset")
                    await loadPropertyMappingRules();
                else if (rulesetId === "costcode-ruleset")
                    await loadCostCodeRules();
                else if (rulesetId === "member-mark-assignment-ruleset")
                    await loadMemberMarkAssignmentRules();
                else if (rulesetId === "cost-code-assignment-ruleset")
                    await loadCostCodeAssignmentRules();
                else if (rulesetId === "space-classification-ruleset")
                    await loadSpaceClassificationRules();
                else if (rulesetId === "space-assignment-ruleset")
                    await loadSpaceAssignmentRules();
            }
        } else if (activeTab === "cost-code-management") {
            await loadCostCodes();
        } else if (activeTab === "member-mark-management") {
            await loadMemberMarks();
        } else if (activeTab === "space-management") {
            // <<< [추가] 이 else if 블록을 추가합니다.
            await loadSpaceClassifications();
        }
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        // 작업 완료 후, 파일 입력과 URL 변수 초기화
        event.target.value = "";
        currentCsvImportUrl = null;
    }
}
// ✅ REPLACE: main.js - function handleCostCodeActions(...)

function debounce(fn, delay = 300) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    };
}

// [추가] 컨텍스트별 디바운스된 렌더
const debouncedRender = (contextPrefix) =>
    debounce(() => {
        const containerId =
            contextPrefix === "data-management"
                ? "data-management-data-table-container"
                : "space-management-data-table-container";
        renderDataTable(containerId, contextPrefix);
    }, 300);

/**
 * [임시] '집계' 탭의 내용을 Excel로 내보내는 기능 (현재는 미구현)
 */
function exportBoqReportToExcel() {
    console.log("[DEBUG] 'Excel 내보내기' 버튼 클릭됨 (현재 미구현).");
    showToast("Excel 내보내기 기능은 현재 준비 중입니다.", "info");
    // TODO: SheetJS 등의 라이브러리를 사용하여 실제 Excel 내보내기 기능 구현
}

/**
 * 6단계의 자동화 프로세스를 순차적으로 실행하는 '일괄 자동 업데이트' 함수입니다.
 */
async function runBatchAutoUpdate() {
    if (!currentProjectId) {
        showToast("먼저 프로젝트를 선택하세요.", "error");
        return;
    }

    if (
        !confirm(
            "정말로 모든 자동화 프로세스를 순차적으로 실행하시겠습니까?\n이 작업은 시간이 다소 소요될 수 있습니다."
        )
    ) {
        return;
    }

    console.log("[DEBUG] --- 일괄 자동 업데이트 시작 ---");

    // Promise를 사용하여 데이터 가져오기 완료를 기다리는 로직
    const waitForDataFetch = () =>
        new Promise((resolve, reject) => {
            // 완료 또는 실패 시 호출될 리스너 함수
            const listener = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === "revit_data_complete") {
                    frontendSocket.removeEventListener("message", listener); // 리스너 정리
                    console.log(
                        "[DEBUG] (1/6) 데이터 가져오기 완료 신호 수신."
                    );
                    resolve();
                }
            };

            // websocket 메시지 리스너 추가
            frontendSocket.addEventListener("message", listener);

            // 데이터 가져오기 시작
            console.log("[DEBUG] (1/6) BIM 원본데이터 가져오기 시작...");
            showToast("1/6: BIM 원본데이터를 가져옵니다...", "info");
            fetchDataFromClient();

            // 타임아웃 설정 (예: 5분)
            setTimeout(() => {
                frontendSocket.removeEventListener("message", listener);
                reject(new Error("데이터 가져오기 시간 초과."));
            }, 300000);
        });
    try {
        // 1. 데이터 가져오기 (완료될 때까지 대기)
        await waitForDataFetch();
        showToast("✅ (1/6) 데이터 가져오기 완료.", "success");
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 다음 단계 전 잠시 대기

        // 2. 룰셋 일괄적용 (확인창 없이 실행)
        console.log("[DEBUG] (2/6) 분류 할당 룰셋 적용 시작...");
        showToast("2/6: 분류 할당 룰셋을 적용합니다...", "info");
        await applyClassificationRules(true); // skipConfirmation = true
        showToast("✅ (2/6) 분류 할당 룰셋 적용 완료.", "success");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 3. 수량산출부재 자동 생성 (확인창 없이 실행)
        console.log("[DEBUG] (3/6) 수량산출부재 자동 생성 시작...");
        showToast("3/6: 수량산출부재를 자동 생성합니다...", "info");
        await createAutoQuantityMembers(true); // skipConfirmation = true
        showToast("✅ (3/6) 수량산출부재 자동 생성 완료.", "success");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 4. 할당 룰셋 일괄 적용 (확인창 없이 실행)
        console.log("[DEBUG] (4/6) 할당 룰셋 일괄 적용 시작...");
        showToast(
            "4/6: 할당 룰셋(일람부호, 공사코드)을 일괄 적용합니다...",
            "info"
        );
        await applyAssignmentRules(true); // skipConfirmation = true
        showToast("✅ (4/6) 할당 룰셋 일괄 적용 완료.", "success");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 5. 산출항목 자동 생성 (확인창 없이 실행)
        console.log("[DEBUG] (5/6) 산출항목 자동 생성 시작...");
        showToast("5/6: 산출항목을 자동 생성합니다...", "info");
        await createAutoCostItems(true); // skipConfirmation = true
        showToast("✅ (5/6) 산출항목 자동 생성 완료.", "success");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // ▼▼▼ [수정] 6번째 단계 - 집계표 생성 전 그룹핑 확인/설정 ▼▼▼
        console.log("[DEBUG] (6/6) 집계표 생성 준비...");
        showToast("6/6: 최종 집계표를 생성합니다...", "info");

        // 상세견적(DD) 탭으로 강제 전환
        // ▼▼▼ [수정] 셀렉터 변경 ▼▼▼
        const ddTabButton = document.querySelector(
            '.main-nav .nav-button[data-primary-tab="detailed-estimation-dd"]'
        );
        // ▲▲▲ 수정 끝 ▲▲▲
        if (ddTabButton && !ddTabButton.classList.contains("active")) {
            console.log(
                "[DEBUG] Switching to Detailed Estimation (DD) tab for report generation..."
            );
            ddTabButton.click(); // 탭 클릭 이벤트 실행 (내부적으로 loadDataForActiveTab 호출됨)
            await new Promise((resolve) => setTimeout(resolve, 1500)); // 데이터 로드 시간 대기
        } else {
            // 이미 해당 탭이면 짧은 지연 시간만 줌
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const boqGroupingControls = document.getElementById(
            "boq-grouping-controls"
        );
        const groupBySelects = boqGroupingControls?.querySelectorAll(
            ".boq-group-by-select"
        );

        // 그룹핑 기준이 하나도 없는 경우, 첫 번째 사용 가능한 필드로 기본 그룹핑 추가
        if (
            boqGroupingControls &&
            (!groupBySelects || groupBySelects.length === 0)
        ) {
            console.log(
                "[DEBUG] No grouping criteria found. Adding default grouping..."
            );
            if (availableBoqFields.length > 0) {
                addBoqGroupingLevel(); // 첫 번째 레벨 추가
                const firstSelect = boqGroupingControls.querySelector(
                    ".boq-group-by-select"
                );
                if (firstSelect && availableBoqFields[0]) {
                    firstSelect.value = availableBoqFields[0].value; // 첫 번째 필드를 기본값으로 설정
                    console.log(
                        `[DEBUG] Default grouping set to: ${availableBoqFields[0].label}`
                    );
                } else {
                    console.warn(
                        "[WARN] Could not set default grouping value automatically."
                    );
                }
            } else {
                console.error(
                    "[ERROR] Cannot add default grouping because availableBoqFields is empty."
                );
                throw new Error(
                    "집계표를 생성하기 위한 그룹핑 필드 정보를 불러올 수 없습니다."
                );
            }
        } else {
            console.log(
                "[DEBUG] Existing grouping criteria found or container not available."
            );
        }

        // 집계표 생성 함수 호출 (함수 이름은 그대로 사용)
        generateBoqReport();
        showToast("✅ (6/6) 상세견적(DD) 집계표 생성 완료.", "success");
        // ▲▲▲ [수정] 여기까지 입니다 ▲▲▲

        showToast("🎉 모든 자동화 프로세스가 완료되었습니다.", "success", 5000);
        console.log("[DEBUG] --- 일괄 자동 업데이트 성공적으로 완료 ---");
    } catch (error) {
        console.error("[ERROR] 일괄 자동 업데이트 중 오류 발생:", error);
        showToast(`오류 발생: ${error.message}`, "error", 5000);
    } finally {
        // 프로세스 종료 후 항상 프로젝트 선택 가능하도록 복원
        const projectSelector = document.getElementById("project-selector");
        if (projectSelector) projectSelector.disabled = false;
    }
}

// ▲▲▲ [추가] 여기까지 ▲▲▲

// ▼▼▼ [추가] 파일 맨 아래에 아래 함수들을 모두 추가 (중복 시 기존 것 유지) ▼▼▼

// --- 유틸리티 함수 ---
function debounce(fn, delay = 300) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}

// --- 공통 CSV 파일 처리 ---
async function handleCsvFileSelect(event) {
    console.log("[DEBUG][handleCsvFileSelect] CSV file selected."); // 디버깅
    if (!currentProjectId || !currentCsvImportUrl) {
        showToast(
            "프로젝트가 선택되지 않았거나, 잘못된 CSV 가져오기 요청입니다.",
            "error"
        );
        console.error(
            "[ERROR][handleCsvFileSelect] Missing project ID or import URL."
        ); // 디버깅
        event.target.value = ""; // Reset file input
        return;
    }
    const file = event.target.files[0];
    if (!file) {
        console.log("[DEBUG][handleCsvFileSelect] File selection cancelled."); // 디버깅
        return;
    }

    const formData = new FormData();
    formData.append("csv_file", file);
    const importUrl = currentCsvImportUrl; // 임시 저장된 URL 사용
    currentCsvImportUrl = null; // 사용 후 초기화

    showToast(`CSV 파일 (${file.name}) 가져오는 중...`, "info");
    console.log(`[DEBUG][handleCsvFileSelect] Uploading CSV to: ${importUrl}`); // 디버깅
    try {
        const response = await fetch(importUrl, {
            method: "POST",
            headers: { "X-CSRFToken": csrftoken },
            body: formData,
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || "파일 업로드/처리 실패");
        }
        showToast(result.message, "success");
        console.log(`[DEBUG][handleCsvFileSelect] CSV import successful.`); // 디버깅

        // 가져오기 성공 후 현재 활성 탭 데이터 새로고침
        console.log(
            `[DEBUG][handleCsvFileSelect] Reloading data for active tab: ${activeTab}`
        ); // 디버깅
        loadDataForActiveTab();
    } catch (error) {
        console.error("[ERROR][handleCsvFileSelect] CSV import failed:", error); // 디버깅
        showToast(`CSV 가져오기 실패: ${error.message}`, "error");
    } finally {
        // 성공/실패 여부와 관계없이 파일 입력 초기화
        event.target.value = "";
    }
}

// --- 룰셋 CSV 버튼 설정 및 핸들러 ---
function setupRulesetCsvButtons() {
    console.log("[DEBUG] Setting up Ruleset CSV import/export buttons...");
    const rulesetActions = {
        classification: {
            importBtn: "import-classification-rules-btn",
            exportBtn: "export-classification-rules-btn",
            path: "classification",
        },
        "property-mapping": {
            importBtn: "import-mapping-rules-btn",
            exportBtn: "export-mapping-rules-btn",
            path: "property-mapping",
        },
        "cost-code": {
            importBtn: "import-costcode-rules-btn",
            exportBtn: "export-costcode-rules-btn",
            path: "cost-code",
        },
        "member-mark-assignment": {
            importBtn: "import-member-mark-assignment-rules-btn",
            exportBtn: "export-member-mark-assignment-rules-btn",
            path: "member-mark-assignment",
        },
        "cost-code-assignment": {
            importBtn: "import-cost-code-assignment-rules-btn",
            exportBtn: "export-cost-code-assignment-rules-btn",
            path: "cost-code-assignment",
        },
        "space-classification": {
            importBtn: "import-space-classification-rules-btn",
            exportBtn: "export-space-classification-rules-btn",
            path: "space-classification",
        },
        "space-assignment": {
            importBtn: "import-space-assignment-rules-btn",
            exportBtn: "export-space-assignment-rules-btn",
            path: "space-assignment",
        },
    };

    for (const key in rulesetActions) {
        const action = rulesetActions[key];
        const importButton = document.getElementById(action.importBtn);
        const exportButton = document.getElementById(action.exportBtn);
        if (importButton) {
            importButton.addEventListener("click", () =>
                triggerRulesetImport(action.path)
            );
        } else {
            console.warn(
                `[WARN] Ruleset Import button not found: ${action.importBtn}`
            );
        }
        if (exportButton) {
            exportButton.addEventListener("click", () =>
                exportRuleset(action.path)
            );
        } else {
            console.warn(
                `[WARN] Ruleset Export button not found: ${action.exportBtn}`
            );
        }
    }
    console.log("[DEBUG] Ruleset CSV buttons setup complete.");
}

function triggerRulesetImport(rulesetPath) {
    console.log(
        `[DEBUG] Triggering CSV import for ruleset path: ${rulesetPath}`
    );
    if (!currentProjectId) {
        showToast("프로젝트를 선택하세요.", "error");
        return;
    }
    // 공통 CSV 파일 입력(`csv-file-input`)을 사용하고, 업로드할 URL을 임시 저장
    currentCsvImportUrl = `/connections/api/rules/${rulesetPath}/${currentProjectId}/import/`;
    document.getElementById("csv-file-input")?.click();
}

function exportRuleset(rulesetPath) {
    console.log(
        `[DEBUG] Triggering CSV export for ruleset path: ${rulesetPath}`
    );
    if (!currentProjectId) {
        showToast("프로젝트를 선택하세요.", "error");
        return;
    }
    window.location.href = `/connections/api/rules/${rulesetPath}/${currentProjectId}/export/`;
}

// --- 공간분류 CSV 핸들러 ---
function exportSpaceClassifications() {
    console.log("[DEBUG] Triggering Space Classifications CSV export.");
    if (!currentProjectId) {
        showToast("프로젝트를 선택하세요.", "error");
        return;
    }
    window.location.href = `/connections/api/space-classifications/${currentProjectId}/export/`;
}
function triggerSpaceClassificationsImport() {
    console.log("[DEBUG] Triggering Space Classifications CSV import.");
    if (!currentProjectId) {
        showToast("프로젝트를 선택하세요.", "error");
        return;
    }
    currentCsvImportUrl = `/connections/api/space-classifications/${currentProjectId}/import/`;
    document.getElementById("csv-file-input")?.click();
}

// --- 할당 룰셋 일괄 적용 ---
async function applyAssignmentRules(skipConfirmation = false) {
    console.log(
        "[DEBUG][applyAssignmentRules] Attempting to apply assignment rules..."
    ); // 디버깅
    if (!currentProjectId) {
        showToast("프로젝트를 선택하세요.", "error");
        return;
    }
    if (
        !skipConfirmation &&
        !confirm(
            "정의된 모든 할당 룰셋(일람부호, 공사코드, 공간)을 전체 부재에 적용하시겠습니까?\n이 작업은 기존 할당 정보를 덮어쓰거나 추가할 수 있습니다."
        )
    ) {
        console.log("[DEBUG][applyAssignmentRules] User cancelled."); // 디버깅
        return;
    }

    showToast("룰셋을 적용하고 있습니다. 잠시만 기다려주세요...", "info", 5000);
    try {
        const response = await fetch(
            `/connections/api/quantity-members/apply-assignment-rules/${currentProjectId}/`,
            {
                method: "POST",
                headers: { "X-CSRFToken": csrftoken },
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "룰셋 적용 실패");

        showToast(result.message, "success");
        console.log(`[DEBUG][applyAssignmentRules] Success: ${result.message}`); // 디버깅

        // 룰셋 적용 후 관련 데이터 및 UI 새로고침
        console.log(
            "[DEBUG][applyAssignmentRules] Reloading related data (CostCodes, MemberMarks, QM, QM UI)..."
        ); // 디버깅
        await loadCostCodes(); // 공사코드 목록 (룰에 의해 새로 생성되었을 수 있음)
        await loadMemberMarks(); // 일람부호 목록 (룰에 의해 새로 생성되었을 수 있음)
        await loadQuantityMembers(); // 부재 목록 (할당 정보 업데이트됨)
        // QM 탭의 오른쪽 상세 정보 패널 업데이트
        renderQmCostCodesList();
        renderQmMemberMarkDetails();
        renderQmSpacesList(); // 공간 정보도 업데이트
    } catch (error) {
        console.error("[ERROR][applyAssignmentRules] Failed:", error); // 디버깅
        showToast(`룰셋 적용 실패: ${error.message}`, "error");
    }
}

// --- BOQ Excel 내보내기 ---
function exportBoqReportToExcel() {
    console.log(
        "[DEBUG][exportBoqReportToExcel] Export to Excel button clicked."
    ); // 디버깅
    showToast("Excel 내보내기 기능은 현재 준비 중입니다.", "info");
    // TODO: SheetJS 등의 라이브러리를 사용하여 실제 Excel 내보내기 기능 구현
}

// --- 커넥터 모드 변경 핸들러 ---
function handleConnectorModeChange(e) {
    currentMode = e.target.value;
    showToast(
        `${currentMode === "revit" ? "Revit" : "Blender"} 모드로 전환합니다.`,
        "info"
    );
    console.log(`[UI] Connector mode changed to: ${currentMode}`); // 디버깅
}

// --- 좌측 패널 탭 클릭 핸들러 (Data Management, Space Management 공통) ---
function handleLeftPanelTabClick(event) {
    const clickedButton = event.target.closest(".left-panel-tab-button");
    if (!clickedButton || clickedButton.classList.contains("active")) {
        return; // 버튼 아니거나 이미 활성이면 무시
    }

    const tabContainer = clickedButton.closest(".left-panel-tab-container");
    const targetTabId = clickedButton.dataset.tab; // 예: "fields", "classification", "bim-properties"
    console.log(
        `[DEBUG][handleLeftPanelTabClick] Clicked left panel tab: ${targetTabId}`
    ); // 디버깅

    // 현재 활성 탭/콘텐츠 비활성화
    tabContainer
        .querySelector(".left-panel-tab-button.active")
        ?.classList.remove("active");
    tabContainer
        .querySelector(".left-panel-tab-content.active")
        ?.classList.remove("active");

    // 클릭된 탭/콘텐츠 활성화
    clickedButton.classList.add("active");
    const targetContent = tabContainer.querySelector(`#${targetTabId}`);
    if (targetContent) {
        targetContent.classList.add("active");
        console.log(
            `[DEBUG][handleLeftPanelTabClick] Activated left panel content: #${targetTabId}`
        ); // 디버깅
    } else {
        console.warn(
            `[WARN][handleLeftPanelTabClick] Left panel content not found for ID: ${targetTabId}`
        ); // 디버깅
    }
}

/**
 * DD 탭 하단 BOQ 테이블 컬럼 목록(currentBoqColumns)을 현재 UI 상태에 맞게 업데이트
 */
function updateDdBoqColumns() {
    console.log("[DEBUG][DD BOQ] Updating DD BOQ column definitions...");
    // 별칭 업데이트 (DD 탭은 별칭 편집 기능 사용)
    boqColumnAliases = {}; // Reset first
    document.querySelectorAll("#boq-table-container thead th").forEach((th) => {
        const colId = th.dataset.columnId;
        const currentText = th.childNodes[0].nodeValue.trim(); // Get only the text node value
        const defaultLabel = currentBoqColumns.find(
            (c) => c.id === colId
        )?.label; // Find default label if columns already exist
        if (colId && defaultLabel && currentText !== defaultLabel) {
            boqColumnAliases[colId] = currentText;
        }
    });
    console.log("[DEBUG][DD BOQ] Updated boqColumnAliases:", boqColumnAliases);

    // 표시 필드 선택 상태 반영
    const selectedDisplayFields = Array.from(
        document.querySelectorAll(".boq-display-field-cb:checked") // DD용 체크박스 사용
    ).map((cb) => ({
        id: cb.value.replace(/__/g, "_"),
        label: cb.parentElement.textContent.trim(),
        isDynamic: true,
    }));

    // DD용 기본 컬럼 + 선택된 동적 컬럼 + 비용 컬럼
    currentBoqColumns = [
        { id: "name", label: "구분", isDynamic: false, align: "left" },
        {
            id: "unit_price_type_id",
            label: "단가기준",
            isDynamic: false,
            align: "center",
            width: "150px",
        }, // DD는 단가기준 포함
        { id: "quantity", label: "수량", isDynamic: false, align: "right" },
        { id: "count", label: "항목 수", isDynamic: false, align: "right" },
        // 추가된 단가 관련 컬럼
        {
            id: "total_cost_unit",
            label: "합계단가",
            isDynamic: true,
            align: "right",
        },
        {
            id: "material_cost_unit",
            label: "재료비단가",
            isDynamic: true,
            align: "right",
        },
        {
            id: "labor_cost_unit",
            label: "노무비단가",
            isDynamic: true,
            align: "right",
        },
        {
            id: "expense_cost_unit",
            label: "경비단가",
            isDynamic: true,
            align: "right",
        },
        ...selectedDisplayFields,
        // 비용 관련 컬럼 (DD)
        {
            id: "total_cost_total",
            label: "합계금액",
            isDynamic: false,
            align: "right",
        },
        {
            id: "material_cost_total",
            label: "재료비",
            isDynamic: false,
            align: "right",
        },
        {
            id: "labor_cost_total",
            label: "노무비",
            isDynamic: false,
            align: "right",
        },
        {
            id: "expense_cost_total",
            label: "경비",
            isDynamic: false,
            align: "right",
        },
    ];
    console.log(
        "[DEBUG][DD BOQ] Updated currentBoqColumns:",
        currentBoqColumns
    );
}

/**
 * BOQ 테이블의 컬럼 순서와 별칭 설정을 localStorage에 저장합니다.
 */
function saveBoqColumnSettings() {
    try {
        const settings = {
            columnOrder: currentBoqColumns.map((col) => col.id),
            columnAliases: boqColumnAliases,
        };
        localStorage.setItem("boqColumnSettings", JSON.stringify(settings));
        console.log("[DEBUG] BOQ column settings saved to localStorage.");
    } catch (e) {
        console.error(
            "[ERROR] Failed to save BOQ column settings to localStorage:",
            e
        );
    }
}

/**
 * localStorage에서 BOQ 테이블의 컬럼 순서와 별칭 설정을 로드합니다.
 * 로드된 설정은 currentBoqColumns와 boqColumnAliases에 적용됩니다.
 */
function loadBoqColumnSettings() {
    try {
        const savedSettings = localStorage.getItem("boqColumnSettings");
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.columnOrder && Array.isArray(settings.columnOrder)) {
                // 기본 컬럼 정의를 기반으로 순서 재구성
                const defaultColumns = [
                    {
                        id: "name",
                        label: "구분",
                        isDynamic: false,
                        align: "left",
                    },
                    {
                        id: "unit_price_type_id",
                        label: "단가기준",
                        isDynamic: false,
                        align: "center",
                        width: "150px",
                    },
                    {
                        id: "quantity",
                        label: "수량",
                        isDynamic: false,
                        align: "right",
                    },
                    {
                        id: "count",
                        label: "항목 수",
                        isDynamic: false,
                        align: "right",
                    },
                    {
                        id: "total_cost_unit",
                        label: "합계단가",
                        isDynamic: true,
                        align: "right",
                    },
                    {
                        id: "material_cost_unit",
                        label: "재료비단가",
                        isDynamic: true,
                        align: "right",
                    },
                    {
                        id: "labor_cost_unit",
                        label: "노무비단가",
                        isDynamic: true,
                        align: "right",
                    },
                    {
                        id: "expense_cost_unit",
                        label: "경비단가",
                        isDynamic: true,
                        align: "right",
                    },
                    {
                        id: "total_cost_total",
                        label: "합계금액",
                        isDynamic: false,
                        align: "right",
                    },
                    {
                        id: "material_cost_total",
                        label: "재료비",
                        isDynamic: false,
                        align: "right",
                    },
                    {
                        id: "labor_cost_total",
                        label: "노무비",
                        isDynamic: false,
                        align: "right",
                    },
                    {
                        id: "expense_cost_total",
                        label: "경비",
                        isDynamic: false,
                        align: "right",
                    },
                ];

                const reorderedColumns = [];
                settings.columnOrder.forEach((colId) => {
                    const found = defaultColumns.find((dc) => dc.id === colId);
                    if (found) {
                        reorderedColumns.push(found);
                    } else {
                        // 동적으로 추가된 필드 (예: BIM 속성) 처리
                        // availableBoqFields에서 찾거나, 임시 객체 생성
                        const dynamicField = availableBoqFields.find(
                            (f) => f.value === colId
                        );
                        if (dynamicField) {
                            reorderedColumns.push({
                                id: dynamicField.value,
                                label: dynamicField.label,
                                isDynamic: true,
                                align: "left",
                            });
                        } else {
                            // 만약 저장된 컬럼이 현재 availableBoqFields에 없으면 기본값으로 추가 (예: 삭제된 필드)
                            reorderedColumns.push({
                                id: colId,
                                label: colId,
                                isDynamic: true,
                                align: "left",
                            });
                        }
                    }
                });
                // 저장된 순서에 없는 기본 컬럼 추가 (새로 추가된 기본 컬럼 등)
                defaultColumns.forEach((defaultCol) => {
                    if (
                        !reorderedColumns.some((rc) => rc.id === defaultCol.id)
                    ) {
                        reorderedColumns.push(defaultCol);
                    }
                });
                currentBoqColumns = reorderedColumns;
            }
            if (settings.columnAliases) {
                boqColumnAliases = settings.columnAliases;
            }
            console.log(
                "[DEBUG] BOQ column settings loaded from localStorage."
            );
        } else {
            console.log(
                "[DEBUG] No BOQ column settings found in localStorage. Using defaults."
            );
            // 기본 컬럼 설정 (초기 로드 시)
            currentBoqColumns = [
                { id: "name", label: "구분", isDynamic: false, align: "left" },
                {
                    id: "unit_price_type_id",
                    label: "단가기준",
                    isDynamic: false,
                    align: "center",
                    width: "150px",
                },
                {
                    id: "quantity",
                    label: "수량",
                    isDynamic: false,
                    align: "right",
                },
                {
                    id: "count",
                    label: "항목 수",
                    isDynamic: false,
                    align: "right",
                },
                {
                    id: "total_cost_unit",
                    label: "합계단가",
                    isDynamic: true,
                    align: "right",
                },
                {
                    id: "material_cost_unit",
                    label: "재료비단가",
                    isDynamic: true,
                    align: "right",
                },
                {
                    id: "labor_cost_unit",
                    label: "노무비단가",
                    isDynamic: true,
                    align: "right",
                },
                {
                    id: "expense_cost_unit",
                    label: "경비단가",
                    isDynamic: true,
                    align: "right",
                },
                {
                    id: "total_cost_total",
                    label: "합계금액",
                    isDynamic: false,
                    align: "right",
                },
                {
                    id: "material_cost_total",
                    label: "재료비",
                    isDynamic: false,
                    align: "right",
                },
                {
                    id: "labor_cost_total",
                    label: "노무비",
                    isDynamic: false,
                    align: "right",
                },
                {
                    id: "expense_cost_total",
                    label: "경비",
                    isDynamic: false,
                    align: "right",
                },
            ];
            boqColumnAliases = {};
        }
    } catch (e) {
        console.error(
            "[ERROR] Failed to load BOQ column settings from localStorage:",
            e
        );
        // 오류 발생 시 기본값으로 초기화
        currentBoqColumns = [
            { id: "name", label: "구분", isDynamic: false, align: "left" },
            {
                id: "unit_price_type_id",
                label: "단가기준",
                isDynamic: false,
                align: "center",
                width: "150px",
            },
            { id: "quantity", label: "수량", isDynamic: false, align: "right" },
            { id: "count", label: "항목 수", isDynamic: false, align: "right" },
            {
                id: "total_cost_unit",
                label: "합계단가",
                isDynamic: true,
                align: "right",
            },
            {
                id: "material_cost_unit",
                label: "재료비단가",
                isDynamic: true,
                align: "right",
            },
            {
                id: "labor_cost_unit",
                label: "노무비단가",
                isDynamic: true,
                align: "right",
            },
            {
                id: "expense_cost_unit",
                label: "경비단가",
                isDynamic: true,
                align: "right",
            },
            {
                id: "total_cost_total",
                label: "합계금액",
                isDynamic: false,
                align: "right",
            },
            {
                id: "material_cost_total",
                label: "재료비",
                isDynamic: false,
                align: "right",
            },
            {
                id: "labor_cost_total",
                label: "노무비",
                isDynamic: false,
                align: "right",
            },
            {
                id: "expense_cost_total",
                label: "경비",
                isDynamic: false,
                align: "right",
            },
        ];
        boqColumnAliases = {};
    }
}

// ▼▼▼ [추가] BOQ 컬럼 설정을 localStorage에 저장하는 함수 ▼▼▼
function saveBoqColumnSettings() {
    if (!currentProjectId) return;
    try {
        const settings = {
            columns: currentBoqColumns,
            aliases: boqColumnAliases,
        };
        localStorage.setItem(
            `boqColumnSettings_${currentProjectId}`,
            JSON.stringify(settings)
        );
        console.log("[DEBUG] Saved BOQ column settings to localStorage.");
    } catch (e) {
        console.error("Failed to save BOQ column settings to localStorage:", e);
        showToast(
            "컬럼 설정을 로컬 저장소에 저장하는데 실패했습니다.",
            "error"
        );
    }
}
