// --- 리스너 설정 헬퍼 함수들 (기존 함수들 포함) ---

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

// connections/static/connections/app.js 파일 가장 하단에 추가
// aibim_quantity_takeoff_web/connections/static/connections/app.js

// ... (파일의 다른 부분은 그대로 유지합니다) ...

// app.js

// ▼▼▼ [추가] 파일의 맨 아래에 아래 함수들을 모두 추가해주세요. ▼▼▼

// =====================================================================
// 산출항목(CostItem) 관리 관련 함수들
// =====================================================================

// connections/static/connections/app.js 파일에서 loadCostItems 함수를 찾아 아래 코드로 교체하세요.
// connections/static/connections/app.js 파일에서
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
// ✅ REPLACE: app.js - function handleCostCodeActions(...)

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
                // ▼▼▼ [CRITICAL FIX] fetchDataFromClient는 fetch_progress_complete 전송 ▼▼▼
                if (data.type === "fetch_progress_complete") {
                    frontendSocket.removeEventListener("message", listener); // 리스너 정리
                    console.log(
                        "[DEBUG] (1/6) 데이터 가져오기 완료 신호 수신."
                    );
                    resolve();
                }
                // ▲▲▲ [CRITICAL FIX] 여기까지 ▲▲▲
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
