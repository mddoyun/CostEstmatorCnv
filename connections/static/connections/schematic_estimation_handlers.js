
// =====================================================================
// [신규] 개산견적 (SD) 관련 함수들
// 이 파일은 main.js에서 분리된 개산견적(Schematic Estimation) 관련 함수들을 포함합니다.
// =====================================================================


function setupSchematicEstimationListeners() {
    // --- 상단 패널 (모델 선택, 입력, 예측) ---
    document
        .getElementById("sd-model-select")
        ?.addEventListener("change", handleSdModelSelection);
    document
        .getElementById("sd-input-fields")
        ?.addEventListener("input", handleSdInputChange);
    document
        .getElementById("sd-predict-btn")
        ?.addEventListener("click", runSdPrediction);

    // --- 하단 패널 (BOQ 테이블 및 컨트롤) ---
    // 그룹핑 추가 버튼
    document
        .getElementById("add-sd-group-level-btn")
        ?.addEventListener("click", addSdGroupingLevel);
    // 그룹핑 레벨 변경/제거 시 테이블 다시 그리기 (이벤트 위임)
    const sdGroupingControls = document.getElementById("sd-grouping-controls");
    if (sdGroupingControls && !sdGroupingControls.dataset.listenerAttached) {
        sdGroupingControls.addEventListener("change", generateSdBoqReport);
        sdGroupingControls.addEventListener("click", (e) => {
            if (e.target.classList.contains("remove-sd-group-level-btn")) {
                // 제거 후에는 자동으로 change 이벤트가 발생하지 않으므로 직접 호출
                generateSdBoqReport();
            }
        });
        sdGroupingControls.dataset.listenerAttached = "true";
    }

    // 표시 필드 선택 변경 시 (리스너는 이제 필요 없음, generateSdBoqReport에서 처리)
    // document.getElementById('sd-display-fields-container')?.addEventListener('change', ...);

    // BIM 연동 버튼 (왼쪽 테이블 헤더)
    document
        .getElementById("sd-select-in-client-btn")
        ?.addEventListener("click", handleSdBoqSelectInClient); // SD용 함수 호출

    // 하단 왼쪽 테이블 자체의 클릭 이벤트 (행 선택 -> 중간 목록 업데이트)
    const sdTableContainer = document.getElementById("sd-table-container");
    if (sdTableContainer && !sdTableContainer.dataset.clickListenerAttached) {
        sdTableContainer.addEventListener("click", handleSdBoqTableClick); // SD용 핸들러 호출
        sdTableContainer.dataset.clickListenerAttached = "true";
    }

    // ▼▼▼ [추가] 하단 중간 목록 클릭 이벤트 리스너 ▼▼▼
    const sdItemListContainer = document.getElementById(
        "sd-item-list-container"
    );
    if (
        sdItemListContainer &&
        !sdItemListContainer.dataset.clickListenerAttached
    ) {
        sdItemListContainer.addEventListener(
            "click",
            handleSdAssociatedItemClick
        ); // 새로 추가된 핸들러 호출
        sdItemListContainer.dataset.clickListenerAttached = "true";
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // ▼▼▼ [추가] 하단 오른쪽 상세 속성 패널 탭 클릭 리스너 ▼▼▼
    const sdDetailsPanel = document.getElementById("sd-item-details-panel");
    if (sdDetailsPanel) {
        const tabsContainer = sdDetailsPanel.querySelector(
            ".details-panel-tabs"
        );
        if (tabsContainer && !tabsContainer.dataset.listenerAttached) {
            tabsContainer.addEventListener("click", (e) => {
                // DD와 동일한 로직 사용
                const clickedButton = e.target.closest(".detail-tab-button");
                if (
                    !clickedButton ||
                    clickedButton.classList.contains("active")
                )
                    return;
                const targetTab = clickedButton.dataset.tab; // 예: "sd-member-prop"
                console.log(`[DEBUG] SD Detail tab clicked: ${targetTab}`);

                sdDetailsPanel
                    .querySelectorAll(".detail-tab-button.active")
                    .forEach((btn) => btn.classList.remove("active"));
                sdDetailsPanel
                    .querySelectorAll(".detail-tab-content.active")
                    .forEach((content) => content.classList.remove("active"));

                clickedButton.classList.add("active");
                const targetContent = sdDetailsPanel.querySelector(
                    `.detail-tab-content[data-tab="${targetTab}"]`
                );
                if (targetContent) targetContent.classList.add("active");
            });
            tabsContainer.dataset.listenerAttached = "true";
        }
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    console.log("[DEBUG] Schematic Estimation (SD) listeners setup complete.");
}
function handleSdAssociatedItemClick(event) {
    const itemRow = event.target.closest("tr[data-item-id]");
    const bimButton = event.target.closest(
        "button.select-in-client-btn-detail"
    );

    if (bimButton) {
        // BIM 연동 버튼 클릭 시 (기존 DD 함수 재사용)
        const costItemId = bimButton.dataset.costItemId;
        console.log(
            `[DEBUG][Event] SD BIM link button clicked for CostItem ID: ${costItemId}`
        );
        handleBoqSelectInClientFromDetail(costItemId); // DD와 동일 함수 사용
    } else if (itemRow) {
        // 행의 다른 부분 클릭 시 (오른쪽 상세 정보 표시)
        const itemId = itemRow.dataset.itemId;
        console.log(
            `[DEBUG][Event] SD associated item row clicked. Item ID: ${itemId}`
        );

        // 오른쪽 상세 속성 패널 업데이트 함수 호출
        renderSdItemProperties(itemId);
    }
}

// SD 탭 진입 시 AI 모델 목록 로드 (드롭다운 채우기)
async function loadAiModelsForSd() {
    console.log(
        "[DEBUG][loadAiModelsForSd] Loading AI models for SD tab dropdown (Forced Refresh)."
    ); // 로그 수정
    const select = document.getElementById("sd-model-select");
    if (!select) {
        console.error(
            "[ERROR][loadAiModelsForSd] SD model select dropdown not found."
        );
        return;
    }
    if (!currentProjectId) {
        console.warn(
            "[WARN][loadAiModelsForSd] No project selected. Clearing dropdown."
        );
        select.innerHTML = '<option value="">-- 프로젝트 선택 --</option>';
        return;
    }

    // --- [수정] 캐싱 로직 제거: 항상 API 호출 ---
    console.log(
        "[DEBUG][loadAiModelsForSd] Fetching AI models list from API..."
    ); // 디버깅
    try {
        const apiUrl = `/connections/api/ai-models/${currentProjectId}/`;
        console.log(`[DEBUG][loadAiModelsForSd] Fetching from: ${apiUrl}`);
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `AI 모델 목록 로딩 실패 (Status: ${response.status}, Response: ${errorText})`
            );
        }
        const fetchedModels = await response.json();
        if (!Array.isArray(fetchedModels)) {
            console.error(
                "[ERROR][loadAiModelsForSd] API response is not an array:",
                fetchedModels
            );
            throw new Error("API로부터 잘못된 형식의 응답을 받았습니다.");
        }
        // [수정] 전역 변수 업데이트는 계속 유지 (다른 곳에서 사용할 수 있으므로)
        loadedAiModels = fetchedModels;
        console.log(
            `[DEBUG][loadAiModelsForSd] Fetched ${loadedAiModels.length} models successfully.`
        );
        populateSdModelSelect(loadedAiModels); // 가져온 데이터로 드롭다운 채우기
    } catch (error) {
        console.error(
            "[ERROR][loadAiModelsForSd] Failed to fetch or process AI models:",
            error
        );
        showToast(`AI 모델 목록 로딩 실패: ${error.message}`, "error");
        select.innerHTML = '<option value="">모델 로딩 실패</option>';
        loadedAiModels = []; // 오류 시 전역 변수 초기화
    }
    // --- [수정] 캐싱 로직 제거 끝 ---
}

// AI 모델 목록으로 SD 탭 드롭다운 채우기 (헬퍼 함수)
function populateSdModelSelect(models) {
    console.log(
        `[DEBUG][populateSdModelSelect] Populating SD model select with ${
            models ? models.length : 0
        } models.`
    ); // 디버깅
    const select = document.getElementById("sd-model-select");
    if (!select) {
        console.error(
            "[ERROR][populateSdModelSelect] SD model select element not found."
        ); // 디버깅 추가
        return;
    }

    select.innerHTML = '<option value="">-- 모델 선택 --</option>'; // 초기화
    if (!Array.isArray(models) || models.length === 0) {
        console.warn(
            "[WARN][populateSdModelSelect] No models provided to populate."
        ); // 디버깅 추가
        // 모델이 없어도 초기화된 상태로 두면 됨
    } else {
        models.forEach((model) => {
            // 모델 객체와 이름 속성 확인
            if (model && model.id && model.name) {
                const optionText = `${model.name} (${new Date(
                    model.created_at
                ).toLocaleDateString()})`;
                select.add(new Option(optionText, model.id));
                // console.log(`[DEBUG][populateSdModelSelect] Added option: ${optionText} (ID: ${model.id})`); // 너무 많을 수 있음
            } else {
                console.warn(
                    "[WARN][populateSdModelSelect] Invalid model data found:",
                    model
                ); // 디버깅 추가
            }
        });
        console.log(
            `[DEBUG][populateSdModelSelect] Finished adding ${models.length} options.`
        ); // 디버깅
    }

    // 이전에 선택된 모델 복원
    if (
        selectedSdModelId &&
        models &&
        models.some((m) => m && m.id === selectedSdModelId)
    ) {
        select.value = selectedSdModelId;
        console.log(
            `[DEBUG][populateSdModelSelect] Restored SD model selection: ${selectedSdModelId}`
        ); // 디버깅
        // 모델 선택 핸들러 호출하여 입력 필드 렌더링 (주의: 무한 루프 가능성 확인)
        // handleSdModelSelection({ target: select }); // 여기서 호출하면 무한 루프 발생 가능성 있음. 호출 제거.
        // 대신 모델 선택 후 UI 업데이트 로직 확인 필요. loadAiModelsForSd 호출 후 handleSdModelSelection이 다시 호출되는지?
        // loadAiModelsForSd 내부에서 populate 후에는 핸들러를 다시 호출하지 않도록 해야 함.
        // handleProjectChange나 탭 전환 시 초기 로드에서만 복원 로직 실행
        // -> 현재 구조는 populate 후 핸들러 호출 안 함. 정상.
    } else {
        console.log(
            `[DEBUG][populateSdModelSelect] No previous selection or invalid ID (${selectedSdModelId}). Resetting selection.`
        ); // 디버깅
        selectedSdModelId = null; // 유효하지 않으면 초기화
        document.getElementById("sd-input-fields").innerHTML =
            "<p>모델을 선택하면 입력 항목이 표시됩니다.</p>";
        document.getElementById("sd-predict-btn").disabled = true;
    }
    console.log(
        "[DEBUG][populateSdModelSelect] SD model select dropdown population finished."
    ); // 디버깅
}

// SD 탭 진입 시 연동 가능한 공사코드+수량 로드
async function loadSdCostCodes() {
    console.log(
        "[DEBUG][loadSdCostCodes] Loading SD-enabled cost codes with quantities..."
    ); // 디버깅
    if (!currentProjectId) {
        sdEnabledCostCodes = [];
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/sd/cost-codes/${currentProjectId}/`
        );
        if (!response.ok) throw new Error("SD용 공사코드 목록 로딩 실패");
        sdEnabledCostCodes = await response.json(); // 전역 변수 업데이트
        console.log(
            `[DEBUG][loadSdCostCodes] Loaded ${sdEnabledCostCodes.length} SD cost codes for linking.`
        ); // 디버깅
        // 로드된 데이터는 입력 필드 렌더링 시 사용됨 (renderSdInputFields)
        // 만약 모델이 이미 선택되어 있다면 입력 필드 다시 렌더링하여 콤보박스 채우기
        if (selectedSdModelId) {
            const selectedModel = loadedAiModels.find(
                (m) => m.id === selectedSdModelId
            );
            if (selectedModel?.metadata?.input_features) {
                renderSdInputFields(selectedModel.metadata.input_features);
                console.log(
                    "[DEBUG][loadSdCostCodes] Refreshed SD input fields with loaded cost codes."
                ); // 디버깅
            }
        }
    } catch (error) {
        console.error("[ERROR][loadSdCostCodes] Failed:", error); // 디버깅
        showToast(error.message, "error");
        sdEnabledCostCodes = [];
    }
}

// SD 탭에서 AI 모델 선택 시 처리
function handleSdModelSelection(event) {
    selectedSdModelId = event.target.value;
    console.log(
        `[DEBUG][handleSdModelSelection] SD AI model selected: ${selectedSdModelId}`
    );
    const predictBtn = document.getElementById("sd-predict-btn");
    const inputFieldsDiv = document.getElementById("sd-input-fields");
    const resultsTableDiv = document.getElementById(
        "sd-prediction-results-table"
    );

    // 결과 영역 초기화
    resultsTableDiv.innerHTML = "<p>예측 결과가 여기에 표시됩니다.</p>";
    if (sdPredictionChartInstance) {
        sdPredictionChartInstance.destroy();
        sdPredictionChartInstance = null;
    }

    if (selectedSdModelId) {
        const selectedModel = loadedAiModels.find(
            (m) => m.id === selectedSdModelId
        );

        // --- [핵심 수정] selectedModel.metadata.input_features 대신 selectedModel.input_features 확인 ---
        if (
            selectedModel?.input_features &&
            Array.isArray(selectedModel.input_features)
        ) {
            console.log(
                "[DEBUG][handleSdModelSelection] Rendering SD input fields based on selected model."
            );
            // input_features를 직접 전달
            renderSdInputFields(selectedModel.input_features);
            predictBtn.disabled = false;
        } else {
            // 경고 메시지 수정: metadata가 아니라 input_features가 없는 경우로 명확화
            console.warn(
                `[WARN][handleSdModelSelection] Input features missing or invalid for model: ${selectedSdModelId}. Model data:`,
                selectedModel
            ); // 모델 데이터 전체 로깅
            inputFieldsDiv.innerHTML =
                '<p style="color: red;">선택된 모델의 입력 피처 정보가 없거나 유효하지 않습니다.</p>'; // 메시지 수정
            predictBtn.disabled = true;
        }
        // --- [핵심 수정] 여기까지 ---
    } else {
        // 모델 선택 해제 시 초기화
        console.log("[DEBUG][handleSdModelSelection] SD Model deselected.");
        inputFieldsDiv.innerHTML =
            "<p>모델을 선택하면 입력 항목이 표시됩니다.</p>";
        predictBtn.disabled = true;
    }
}

// SD 입력 필드 변경 시 처리 (직접 입력 or 공사코드 연동)
function handleSdInputChange(event) {
    const target = event.target;
    // 콤보박스 변경 시: 연결된 숫자 입력 필드 자동 채우기/읽기전용 설정
    if (
        target.tagName === "SELECT" &&
        target.dataset.inputType === "costCodeLink"
    ) {
        const inputId = target.dataset.inputId; // 연결된 숫자 입력 필드 ID
        const selectedCostCodeId = target.value;
        const numberInput = document.getElementById(inputId);
        console.log(
            `[DEBUG][handleSdInputChange] Cost code link changed for input '${inputId}'. Selected code ID: ${selectedCostCodeId}`
        ); // 디버깅

        if (selectedCostCodeId && numberInput) {
            const selectedCodeData = sdEnabledCostCodes.find(
                (c) => c.id === selectedCostCodeId
            );
            if (selectedCodeData) {
                numberInput.value = parseFloat(
                    selectedCodeData.total_quantity || 0
                ).toFixed(4); // 수량 자동 입력 (소수점 4자리)
                numberInput.readOnly = true; // 직접 수정 불가
                console.log(
                    `[DEBUG][handleSdInputChange] Auto-filled quantity: ${numberInput.value}`
                ); // 디버깅
            } else {
                console.warn(
                    `[WARN][handleSdInputChange] Quantity data not found for cost code ID: ${selectedCostCodeId}`
                ); // 디버깅
                numberInput.value = "0.0000"; // 못 찾으면 0
                numberInput.readOnly = false; // 직접 입력 가능
            }
        } else if (numberInput) {
            console.log(
                `[DEBUG][handleSdInputChange] Cost code link cleared for input '${inputId}'. Enabling direct input.`
            ); // 디버깅
            numberInput.readOnly = false; // '-- 직접 입력 --' 시 직접 입력 가능
            numberInput.value = ""; // 값 비우기
        }
    }
    // 숫자 입력 필드 직접 변경 시: 연결된 콤보박스 초기화
    else if (
        target.tagName === "INPUT" &&
        target.type === "number" &&
        !target.readOnly // <<< 읽기 전용 아닐 때만 (직접 입력 시)
    ) {
        const inputId = target.id; // 현재 변경된 input의 ID
        console.log(
            `[DEBUG][handleSdInputChange] Direct numeric input changed for '${inputId}': ${target.value}`
        ); // 디버깅

        // --- [핵심 수정] data-select-id 속성을 사용하여 연결된 select 요소 찾기 ---
        const selectId = target.dataset.selectId; // 이 input과 연결된 select의 ID 가져오기
        if (selectId) {
            const linkedSelect = document.getElementById(selectId);
            if (linkedSelect && linkedSelect.value !== "") {
                linkedSelect.value = ""; // '-- 직접 입력 --'으로 변경
                console.log(
                    `[DEBUG][handleSdInputChange] Cleared linked cost code selection (ID: ${selectId}) due to direct input in '${inputId}'.`
                ); // 디버깅
            } else if (!linkedSelect) {
                console.warn(
                    `[WARN][handleSdInputChange] Could not find linked select element with ID: ${selectId}`
                );
            }
        } else {
            console.warn(
                `[WARN][handleSdInputChange] data-select-id attribute not found on input element: ${inputId}`
            );
        }
        // --- [핵심 수정] 여기까지 ---
    }
}

// SD 예측 실행 API 호출
async function runSdPrediction() {
    console.log("[DEBUG][runSdPrediction] Starting SD prediction API call..."); // 디버깅
    if (!currentProjectId || !selectedSdModelId) {
        showToast("프로젝트와 예측 모델을 선택하세요.", "error");
        console.error(
            "[ERROR][runSdPrediction] Project or Model not selected."
        ); // 디버깅
        return;
    }

    const inputFieldsDiv = document.getElementById("sd-input-fields");
    const numberInputs = inputFieldsDiv.querySelectorAll(
        'input[type="number"]'
    );
    const inputData = {};
    let isValid = true;

    // 입력값 수집 및 유효성 검사
    numberInputs.forEach((input) => {
        const featureName = input.dataset.featureName;
        const valueStr = input.value.trim();
        if (valueStr === "" || isNaN(parseFloat(valueStr))) {
            showToast(
                `입력값 '${featureName}'이(가) 유효하지 않습니다.`,
                "error"
            );
            console.error(
                `[ERROR][runSdPrediction] Invalid input for ${featureName}: '${valueStr}'`
            ); // 디버깅
            isValid = false;
        }
        inputData[featureName] = valueStr; // 문자열로 전달 (백엔드에서 float 변환)
    });

    if (!isValid) {
        console.log(
            "[DEBUG][runSdPrediction] Input validation failed. Aborting."
        ); // 디버깅
        return;
    }

    console.log(
        "[DEBUG][runSdPrediction] Input data for prediction:",
        inputData
    ); // 디버깅
    showToast("AI 모델 예측 중...", "info");
    const predictBtn = document.getElementById("sd-predict-btn");
    predictBtn.disabled = true; // 중복 실행 방지
    console.log("[DEBUG][runSdPrediction] Predict button disabled."); // 디버깅

    try {
        const response = await fetch(
            `/connections/api/sd/predict/${currentProjectId}/${selectedSdModelId}/`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrftoken,
                },
                body: JSON.stringify(inputData),
            }
        );
        const result = await response.json();
        if (!response.ok) {
            // 서버 오류 메시지 우선 사용
            const errorMsg =
                result.message || `예측 실패 (Status: ${response.status})`;
            throw new Error(errorMsg);
        }

        showToast("예측 성공!", "success");
        console.log(
            "[DEBUG][runSdPrediction] Prediction successful. API Response:",
            result
        ); // 디버깅 (API 응답 전체 확인)

        // result.predictions 안에 { feature: { predicted: v, min: v_min, max: v_max } } 구조 확인
        if (result.predictions && typeof result.predictions === "object") {
            console.log(
                "[DEBUG][runSdPrediction] Rendering results table and chart..."
            ); // 디버깅
            renderSdResultsTable(result.predictions); // ui.js 함수 호출 (테이블) - 수정됨
            renderSdPredictionChart(result.predictions); // ui.js 함수 호출 (차트) - 수정됨
        } else {
            console.warn(
                "[WARN][runSdPrediction] Prediction results format is unexpected:",
                result.predictions
            ); // 디버깅
            // 결과 형식이 이상해도 일단 테이블/차트 렌더링 시도 (오류 처리는 각 함수에서)
            renderSdResultsTable({});
            renderSdPredictionChart({});
        }
    } catch (error) {
        console.error("[ERROR][runSdPrediction] Prediction failed:", error); // 디버깅
        showToast(error.message, "error");
        document.getElementById(
            "sd-prediction-results-table"
        ).innerHTML = `<p style="color: red;">예측 오류: ${error.message}</p>`;
        if (sdPredictionChartInstance) {
            sdPredictionChartInstance.destroy();
            sdPredictionChartInstance = null;
            console.log(
                "[DEBUG][runSdPrediction] Prediction chart destroyed due to error."
            ); // 디버깅
        } // 오류 시 차트 제거
    } finally {
        predictBtn.disabled = false; // 버튼 다시 활성화
        console.log("[DEBUG][runSdPrediction] Predict button enabled."); // 디버깅
    }
}

// SD 탭 하단 테이블 데이터 로드 API 호출
async function loadSdCostItems() {
    console.log(
        "[DEBUG][loadSdCostItems] Loading SD cost items for bottom table..."
    ); // 디버깅
    if (!currentProjectId) {
        renderSdCostItemsTable([]); // 빈 테이블
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/sd/cost-items/${currentProjectId}/`
        );
        if (!response.ok) throw new Error("SD 산출항목 목록 로딩 실패");
        loadedSdCostItems = await response.json(); // 전역 변수 업데이트
        console.log(
            `[DEBUG][loadSdCostItems] Loaded ${loadedSdCostItems.length} SD cost items.`
        ); // 디버깅
        renderSdCostItemsTable(loadedSdCostItems); // ui.js 함수 호출하여 테이블 렌더링
        // TODO: SD 테이블 그룹핑 필드 설정 함수 호출 (필요 시)
        // populateSdFieldSelection(loadedSdCostItems);
    } catch (error) {
        console.error("[ERROR][loadSdCostItems] Failed:", error); // 디버깅
        showToast(error.message, "error");
        renderSdCostItemsTable([]); // 오류 시 빈 테이블
    }
}

// SD 테이블 클릭 처리 (행 선택)
function handleSdTableClick(event) {
    const row = event.target.closest("tr[data-id]");
    if (!row) return; // 데이터 행이 아니면 무시

    // TODO: 그룹 헤더 토글 기능 추가 시 여기에 분기

    const itemId = row.dataset.id;
    if (itemId) {
        console.log(
            `[DEBUG][handleSdTableClick] Row clicked. SD Item ID: ${itemId}`
        ); // 디버깅
        // 단일 선택 처리 (Ctrl/Shift 키 조합은 필요 시 추가)
        selectedSdItemIds.clear();
        selectedSdItemIds.add(itemId);
        console.log(
            `[DEBUG][handleSdTableClick] Selected SD Item ID set to: ${itemId}`
        ); // 디버깅
        renderSdCostItemsTable(loadedSdCostItems); // 선택 상태 반영하여 다시 렌더링
    }
}

// SD 테이블 선택 항목 BIM 연동 실행
function selectSdItemsInClient() {
    console.log(
        `[DEBUG][selectSdItemsInClient] Attempting to select ${selectedSdItemIds.size} SD items in ${currentMode}...`
    ); // 디버깅
    if (selectedSdItemIds.size === 0) {
        showToast("테이블에서 연동할 산출항목을 선택하세요.", "error");
        return;
    }

    const uniqueIdsToSend = [];
    selectedSdItemIds.forEach((itemId) => {
        const item = loadedSdCostItems.find((i) => i.id === itemId);
        // raw_element_unique_id 가 있는지 확인
        if (item?.raw_element_unique_id) {
            uniqueIdsToSend.push(item.raw_element_unique_id);
        } else {
            console.warn(
                `[WARN][selectSdItemsInClient] BIM Unique ID not found for SD item ID: ${itemId}. Skipping.`
            ); // 디버깅
        }
    });

    if (uniqueIdsToSend.length === 0) {
        showToast("선택된 항목 중 연동 가능한 BIM 객체가 없습니다.", "warning");
        console.log(
            "[DEBUG][selectSdItemsInClient] No valid Unique IDs found to send."
        ); // 디버깅
        return;
    }

    const targetGroup =
        currentMode === "revit"
            ? "revit_broadcast_group"
            : "blender_broadcast_group";
    console.log(
        `[DEBUG][selectSdItemsInClient] Sending 'select_elements' command to group ${targetGroup} with ${uniqueIdsToSend.length} IDs.`
    ); // 디버깅
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
    showToast(`${uniqueIdsToSend.length}개 객체 선택 명령 전송.`, "info");
}

// SD 탭 UI 초기화 함수
function initializeSdUI() {
    console.log(
        "[DEBUG][initializeSdUI] Initializing Schematic Estimation (SD) UI elements."
    ); // 디버깅
    // 모델 선택 드롭다운
    const modelSelect = document.getElementById("sd-model-select");
    if (modelSelect)
        modelSelect.innerHTML = '<option value="">-- 모델 선택 --</option>';
    // 입력 필드
    const inputFields = document.getElementById("sd-input-fields");
    if (inputFields)
        inputFields.innerHTML =
            "<p>모델을 선택하면 입력 항목이 표시됩니다.</p>";
    // 예측 버튼
    const predictBtn = document.getElementById("sd-predict-btn");
    if (predictBtn) predictBtn.disabled = true;
    // 결과 테이블
    const resultsTable = document.getElementById("sd-prediction-results-table");
    if (resultsTable)
        resultsTable.innerHTML = "<p>예측 결과가 여기에 표시됩니다.</p>";
    // 결과 차트
    if (sdPredictionChartInstance) {
        sdPredictionChartInstance.destroy();
        sdPredictionChartInstance = null;
    }
    // 하단 테이블
    const itemTable = document.getElementById("sd-cost-item-table-container");
    if (itemTable) itemTable.innerHTML = "<p>프로젝트를 선택하세요.</p>";
    // 관련 전역 변수 초기화 (필요 시 더 추가)
    selectedSdModelId = null;
    selectedSdItemIds.clear();
    console.log("[DEBUG][initializeSdUI] SD UI elements reset."); // 디버깅
}

// =====================================================================
// [신규] 개산견적 (SD) 탭 - 하단 BOQ 테이블 관련 함수들
// =====================================================================

// --- 전역 변수 (SD BOQ 테이블 상태 관리용) ---
let currentSdBoqColumns = []; // SD 테이블의 현재 컬럼 목록
let sdBoqColumnAliases = {}; // SD 테이블 컬럼 별칭

/**
 * SD 탭 하단의 BOQ 컨트롤 (그룹핑, 표시 필드) UI를 초기화하고 이벤트 리스너 설정
 */
function initializeSdBoqControls() {
    console.log("[DEBUG][SD BOQ] Initializing SD BOQ controls.");
    // 그룹핑 컨트롤 초기화
    const sdGroupingContainer = document.getElementById("sd-grouping-controls");
    if (sdGroupingContainer) sdGroupingContainer.innerHTML = ""; // 기존 레벨 제거

    // 표시 필드 컨트롤 초기화 (availableBoqFields 사용)
    const sdDisplayFieldsContainer = document.getElementById(
        "sd-display-fields-container"
    );
    if (sdDisplayFieldsContainer) {
        if (!availableBoqFields || availableBoqFields.length === 0) {
            sdDisplayFieldsContainer.innerHTML =
                "<small>표시 필드 로딩 실패</small>";
            console.warn(
                "[WARN][SD BOQ] Cannot initialize SD display fields: availableBoqFields is empty."
            );
        } else {
            // '수량', '항목 수' 제외
            const creatableFields = availableBoqFields.filter(
                (f) => f.value !== "quantity" && f.value !== "count"
            );
            sdDisplayFieldsContainer.innerHTML = creatableFields
                .map(
                    (field) => `
                <label>
                    <input type="checkbox" class="sd-display-field-cb" value="${field.value}">
                    ${field.label}
                </label>
            `
                )
                .join("");
            console.log(
                `[DEBUG][SD BOQ] Initialized ${creatableFields.length} SD display field checkboxes.`
            );
        }
    } else {
        console.warn("[WARN][SD BOQ] SD display fields container not found.");
    }

    // 그룹핑 레벨 추가 (최소 1개) - 필드가 로드된 후 호출되어야 함
    if (
        sdGroupingContainer &&
        sdGroupingContainer.children.length === 0 &&
        availableBoqFields.length > 0
    ) {
        console.log(
            "[DEBUG][SD BOQ] Adding initial grouping level for SD BOQ."
        );
        addSdGroupingLevel();
    }
}

/**
 * SD 탭 하단 BOQ 테이블에 그룹핑 레벨 추가
 */
function addSdGroupingLevel() {
    console.log("[DEBUG][SD BOQ] Adding grouping level for SD BOQ.");
    const container = document.getElementById("sd-grouping-controls");
    if (!container) {
        console.warn(
            "[WARN][SD BOQ] SD grouping controls container not found."
        );
        return;
    }
    const newIndex = container.children.length;

    if (!availableBoqFields || availableBoqFields.length === 0) {
        showToast("그룹핑 필드 정보를 먼저 불러와야 합니다.", "info");
        console.warn(
            "[WARN][SD BOQ] availableBoqFields is empty, cannot add grouping level."
        );
        return;
    }

    const newLevelDiv = document.createElement("div");
    newLevelDiv.className = "sd-group-level"; // 클래스 이름 변경

    let optionsHtml = availableBoqFields
        .map(
            (field) => `<option value="${field.value}">${field.label}</option>`
        )
        .join("");

    newLevelDiv.innerHTML = `
        <label>${newIndex + 1}차:</label>
        <select class="sd-group-by-select">${optionsHtml}</select> 
        <button class="remove-sd-group-level-btn" style="padding: 2px 6px; font-size: 12px;">-</button> 
    `;
    container.appendChild(newLevelDiv);
    console.log(`[DEBUG][SD BOQ] ${newIndex + 1}차 SD grouping level added.`);

    // 제거 버튼 리스너 (이벤트 위임 대신 직접 추가)
    newLevelDiv
        .querySelector(".remove-sd-group-level-btn")
        .addEventListener("click", function () {
            console.log("[DEBUG][SD BOQ] Removing SD grouping level.");
            this.parentElement.remove();
            // 레벨 번호 재정렬
            container
                .querySelectorAll(".sd-group-level label")
                .forEach((label, index) => {
                    label.textContent = `${index + 1}차:`;
                });
            // 제거 후 바로 테이블 다시 그리기 (generateSdBoqReport에서 처리)
            // generateSdBoqReport(); // setup listener에서 처리
        });
}

/**
 * SD 탭 하단 BOQ 테이블 컬럼 목록(currentSdBoqColumns)을 현재 UI 상태에 맞게 업데이트
 */
function updateSdBoqColumns() {
    console.log("[DEBUG][SD BOQ] Updating SD BOQ column definitions...");
    sdBoqColumnAliases = {}; // 별칭 초기화 (SD는 별칭 편집 기능 없음)

    const selectedDisplayFields = Array.from(
        document.querySelectorAll(".sd-display-field-cb:checked") // SD용 체크박스 사용
    ).map((cb) => ({
        id: cb.value.replace(/__/g, "_"),
        label: cb.parentElement.textContent.trim(),
        isDynamic: true,
    }));

    // SD용 기본 컬럼 + 선택된 동적 컬럼 + 비용 컬럼 (DD와 동일 구조)
    currentSdBoqColumns = [
        { id: "name", label: "구분", isDynamic: false, align: "left" },
        // SD에서는 단가 기준 선택 기능 제외
        // { id: 'unit_price_type_id', label: '단가기준', isDynamic: false, align: 'center', width: '150px'},
        { id: "quantity", label: "수량", isDynamic: false, align: "right" },
        { id: "count", label: "항목 수", isDynamic: false, align: "right" },
        ...selectedDisplayFields,
        // 비용 관련 컬럼 (SD는 예측값이므로 '단가'는 의미 없을 수 있음 - 일단 DD와 동일하게 유지)
        {
            id: "total_cost_total",
            label: "합계금액 (예측)",
            isDynamic: false,
            align: "right",
        },
        // SD에서는 재료비/노무비/경비 구분 예측 안 할 수 있음 - 일단 주석 처리
        // { id: 'material_cost_total', label: '재료비 (예측)', isDynamic: false, align: 'right' },
        // { id: 'labor_cost_total', label: '노무비 (예측)', isDynamic: false, align: 'right' },
        // { id: 'expense_cost_total', label: '경비 (예측)', isDynamic: false, align: 'right' },
    ];
    console.log(
        "[DEBUG][SD BOQ] Updated currentSdBoqColumns:",
        currentSdBoqColumns
    );
}

/**
 * SD 탭 하단 BOQ 테이블 데이터를 서버에 요청하고 렌더링 (DD와 유사하나 필터 고정)
 */
async function generateSdBoqReport() {
    console.log("[DEBUG][SD BOQ] Generating BOQ report for SD tab...");

    if (!currentProjectId) {
        showToast("먼저 프로젝트를 선택하세요.", "error");
        console.error("[ERROR][SD BOQ] Project not selected.");
        return;
    }

    const groupBySelects = document.querySelectorAll(".sd-group-by-select"); // SD용 셀렉터 사용
    if (groupBySelects.length === 0) {
        // 그룹핑 필드가 로드되기 전일 수 있으므로 에러 대신 정보 메시지 표시
        showToast("그룹핑 기준을 추가하세요 (필드 로딩 중일 수 있음).", "info");
        console.warn(
            "[WARN][SD BOQ] No grouping criteria selected for SD BOQ."
        );
        // 테이블 초기화
        clearContainer(
            "sd-table-container",
            '<p style="padding: 20px;">그룹핑 기준을 설정해주세요.</p>'
        );
        return; // 집계 중단
    }

    const params = new URLSearchParams();
    groupBySelects.forEach((select) => params.append("group_by", select.value));
    console.log(
        "[DEBUG][SD BOQ] Grouping criteria:",
        params.getAll("group_by")
    );

    const displayByCheckboxes = document.querySelectorAll(
        ".sd-display-field-cb:checked"
    ); // SD용 체크박스 사용
    displayByCheckboxes.forEach((cb) => params.append("display_by", cb.value));
    console.log("[DEBUG][SD BOQ] Display fields:", params.getAll("display_by"));

    // SD 필터 고정
    params.append("filter_ai", "true");
    params.append("filter_dd", "false");
    console.log("[DEBUG][SD BOQ] Filters: filter_ai=true, filter_dd=false");

    // Revit 필터링 ID는 SD 하단 테이블에는 적용하지 않음 (선택 사항)
    // if (boqFilteredRawElementIds.size > 0) { ... }

    const tableContainer = document.getElementById("sd-table-container"); // SD용 컨테이너 ID
    if (!tableContainer) {
        console.error(
            "[ERROR][SD BOQ] SD table container '#sd-table-container' not found."
        );
        return;
    }
    tableContainer.innerHTML =
        '<p style="padding: 20px;">집계 데이터를 생성 중입니다...</p>';
    showToast("개산견적(SD) 집계표 생성 중...", "info");
    console.log(
        `[DEBUG][SD BOQ] Requesting BOQ report data from server... /connections/api/boq/report/${currentProjectId}/?${params.toString()}`
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
        console.log("[DEBUG][SD BOQ] Received BOQ report data:", data);

        // 전역 변수 업데이트 (SD 탭에서도 상세 정보 확인 위해)
        if (data.items_detail) {
            loadedSdCostItems = data.items_detail; // SD용 데이터 저장
            console.log(
                `[DEBUG][SD BOQ] loadedSdCostItems updated (${loadedSdCostItems.length} items).`
            );
            // SD에서는 단가 타입 정보는 불필요할 수 있으나, renderBoqTable 호환성을 위해 유지
            loadedUnitPriceTypesForBoq = data.unit_price_types || [];
        } else {
            console.warn("[WARN][SD BOQ] API response missing 'items_detail'.");
            loadedSdCostItems = [];
        }

        // SD용 컬럼 상태 업데이트
        updateSdBoqColumns();

        // renderBoqTable 함수 재사용 (컨테이너 ID 전달)
        renderBoqTable(
            data.report,
            data.summary,
            loadedUnitPriceTypesForBoq,
            "sd-table-container"
        );
        setupSdBoqTableInteractions(); // SD 테이블 상호작용 설정 함수 호출
        console.log("[DEBUG][SD BOQ] SD BOQ table rendered.");
    } catch (error) {
        console.error(
            "[ERROR][SD BOQ] Failed to generate SD BOQ report:",
            error
        );
        tableContainer.innerHTML = `<p style="padding: 20px; color: red;">오류: ${error.message}</p>`;
        showToast(`SD 집계표 생성 실패: ${error.message}`, "error");
    }
}

/**
 * SD 탭 하단 BOQ 테이블 상호작용 설정 (DD와 유사하나 일부 기능 제외/수정)
 */
function setupSdBoqTableInteractions() {
    console.log("[DEBUG][SD BOQ] Setting up interactions for SD BOQ table.");
    const tableContainer = document.getElementById("sd-table-container");
    const table = tableContainer.querySelector(".boq-table"); // renderBoqTable이 생성한 테이블
    if (!table) {
        console.warn(
            "[WARN][SD BOQ] SD BOQ table element not found for setting up interactions."
        );
        return;
    }

    // --- 1. 테이블 '행' 클릭 시 처리 (선택 효과만) ---
    const tbody = table.querySelector("tbody");
    if (tbody && !tbody.dataset.clickListenerAttached) {
        // 중복 리스너 방지
        tbody.addEventListener("click", (e) => {
            const row = e.target.closest("tr.boq-group-header"); // 그룹 헤더 행
            if (row && !e.target.matches("select, button, i")) {
                // 이전에 선택된 행 해제
                const currentSelected = table.querySelector(
                    "tr.selected-sd-boq-row"
                ); // SD용 클래스 사용
                if (currentSelected)
                    currentSelected.classList.remove("selected-sd-boq-row");
                // 현재 행 선택
                row.classList.add("selected-sd-boq-row"); // SD용 클래스 사용
                console.log(
                    `[DEBUG][SD BOQ] Row selected in SD BOQ table. Item IDs: ${row.dataset.itemIds}`
                );
                // SD에서는 행 선택 시 하단 상세 패널 업데이트 없음
                // updateBoqDetailsPanel(itemIds);
            }
        });
        tbody.dataset.clickListenerAttached = "true";
        console.log(
            "[DEBUG][SD BOQ] Row click listener attached to SD BOQ table body."
        );
    } else if (!tbody) {
        console.warn("[WARN][SD BOQ] SD BOQ table body not found.");
    }

    // --- 2. 단가 기준 드롭다운 없음 ---
    // DD 탭의 단가 기준 변경 로직은 SD 탭에는 필요 없음

    // --- 3. 컬럼 이름 변경/순서 변경 기능 없음 ---
    // DD 탭의 헤더 드래그앤드롭 및 이름 변경 로직은 SD 탭에는 적용하지 않음
}

/**
 * SD 탭 하단 BOQ 테이블 클릭 이벤트 핸들러 (그룹 토글 및 행 선택)
 */
function handleSdBoqTableClick(event) {
    const row = event.target.closest("tr"); // 클릭된 행 (헤더 또는 데이터)
    if (!row) return;

    const tableContainer = document.getElementById("sd-table-container");
    const tableDataStr =
        tableContainer.querySelector("table")?.dataset.tableData;
    if (!tableDataStr) return; // 테이블 데이터 없으면 중단

    // 그룹 헤더 클릭 시 (토글 기능은 아직 미구현)
    if (row.classList.contains("boq-group-header")) {
        // TODO: 그룹 토글 로직 추가 (DD와 유사하게 상태 관리 필요)
        const itemIds = JSON.parse(row.dataset.itemIds || "[]");
        console.log(
            `[DEBUG][SD BOQ Click] Group header clicked. Item IDs: ${itemIds.length}`
        );

        // 행 선택 효과 적용
        const currentSelected = row
            .closest("tbody")
            .querySelector("tr.selected-sd-boq-row");
        if (currentSelected)
            currentSelected.classList.remove("selected-sd-boq-row");
        row.classList.add("selected-sd-boq-row");

        // ★★★ 중간 목록 업데이트 함수 호출 ★★★
        renderSdAssociatedItemsTable(itemIds);
    }
    // 데이터 행 클릭 시 (SD에서는 데이터 행 클릭 시 동작 없음 - 그룹 단위로만 처리)
    // else if (row.dataset.itemIds) { ... }
}

/**
 * SD 탭 하단 BOQ 테이블에서 선택된 항목과 연관된 BIM 객체를 연동 프로그램에서 선택
 */
function handleSdBoqSelectInClient() {
    console.log(
        "[DEBUG][SD BOQ SelectInClient] '연동 프로그램에서 선택 확인' button clicked for SD."
    );
    const selectedRow = document.querySelector(
        "#sd-table-container tr.selected-sd-boq-row"
    ); // SD 테이블에서 선택된 행
    if (!selectedRow) {
        showToast("먼저 SD 집계표에서 확인할 행을 선택하세요.", "error");
        console.warn(
            "[WARN][SD BOQ SelectInClient] No row selected in SD BOQ table."
        );
        return;
    }

    const itemIds = JSON.parse(selectedRow.dataset.itemIds || "[]");
    if (itemIds.length === 0) {
        showToast("선택된 행에 연관된 산출항목이 없습니다.", "info");
        console.warn(
            "[WARN][SD BOQ SelectInClient] Selected row has no item_ids."
        );
        return;
    }
    console.log(
        `[DEBUG][SD BOQ SelectInClient] Selected row Item IDs:`,
        itemIds
    );

    // loadedSdCostItems (또는 generateBoqReport에서 반환된 items_detail) 사용
    const rawElementIds = new Set();
    const itemsToProcess = loadedSdCostItems || []; // items_detail 데이터 사용

    itemIds.forEach((itemId) => {
        // items_detail에서 해당 CostItem 찾기
        const costItem = itemsToProcess.find((ci) => ci.id === itemId);
        if (costItem && costItem.quantity_member_id) {
            // loadedQuantityMembers에서 QuantityMember 찾기
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
        console.warn(
            "[WARN][SD BOQ SelectInClient] No linked RawElement IDs found."
        );
        return;
    }
    console.log(
        `[DEBUG][SD BOQ SelectInClient] Found RawElement IDs:`,
        Array.from(rawElementIds)
    );

    // RawElement ID를 Unique ID로 변환
    const uniqueIdsToSend = [];
    rawElementIds.forEach((rawId) => {
        const rawElement = allRevitData.find((re) => re.id === rawId);
        if (rawElement && rawElement.element_unique_id) {
            uniqueIdsToSend.push(rawElement.element_unique_id);
        } else {
            console.warn(
                `[WARN][SD BOQ SelectInClient] Could not find Unique ID for RawElement ID: ${rawId}`
            );
        }
    });

    if (uniqueIdsToSend.length > 0) {
        const targetGroup =
            currentMode === "revit"
                ? "revit_broadcast_group"
                : "blender_broadcast_group";
        console.log(
            `[DEBUG][SD BOQ SelectInClient] Sending 'select_elements' command to ${targetGroup} with ${uniqueIdsToSend.length} Unique IDs:`,
            uniqueIdsToSend
        );
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
        showToast(
            `${uniqueIdsToSend.length}개 객체 선택 명령 전송 완료.`,
            "success"
        );
    } else {
        showToast(
            "연동 프로그램으로 보낼 유효한 객체를 찾지 못했습니다.",
            "error"
        );
        console.error(
            "[ERROR][SD BOQ SelectInClient] No valid Unique IDs found to send."
        );
    }
}
