
function setupUnitPriceManagementListeners() {
    document.getElementById("unit-price-cost-code-search")?.addEventListener(
        "input",
        debounce(() => renderCostCodeListForUnitPrice(loadedCostCodes), 300)
    ); // 공사코드 검색
    document
        .getElementById("unit-price-cost-code-list")
        ?.addEventListener("click", handleCostCodeSelectionForUnitPrice); // 공사코드 선택
    document
        .getElementById("add-unit-price-type-btn")
        ?.addEventListener("click", () =>
            renderUnitPriceTypesTable(loadedUnitPriceTypes, "new")
        ); // 단가 구분 추가
    document
        .getElementById("unit-price-type-table-container")
        ?.addEventListener("click", handleUnitPriceTypeActions); // 단가 구분 수정/삭제/저장/취소
    document
        .getElementById("add-unit-price-btn")
        ?.addEventListener("click", () =>
            renderUnitPricesTable(loadedUnitPrices, "new")
        ); // 단가 추가
    const priceTableContainer = document.getElementById(
        "unit-price-table-container"
    );
    if (priceTableContainer) {
        priceTableContainer.addEventListener("click", handleUnitPriceActions); // 단가 수정/삭제/저장/취소
        priceTableContainer.addEventListener(
            "input",
            handleUnitPriceInputChange
        ); // 단가 입력 시 합계 계산
    }
    console.log("[DEBUG] Unit Price Management listeners setup complete.");
}

async function loadCostCodesForUnitPrice() {
    console.log("[DEBUG][loadCostCodesForUnitPrice] Start");
    if (!currentProjectId) {
        console.log(
            "[INFO][loadCostCodesForUnitPrice] No project selected. Skipping load."
        );
        renderCostCodeListForUnitPrice([]);
        return;
    }
    try {
        console.log(
            `[DEBUG][loadCostCodesForUnitPrice] Fetching cost codes for project ${currentProjectId}...`
        );
        const response = await fetch(
            `/connections/api/cost-codes/${currentProjectId}/`
        );
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Failed to load cost codes: ${response.status} ${errorText}`
            );
        }
        loadedCostCodes = await response.json();
        console.log(
            `[DEBUG][loadCostCodesForUnitPrice] Successfully loaded ${loadedCostCodes.length} cost codes.`
        );
        renderCostCodeListForUnitPrice(loadedCostCodes);
    } catch (error) {
        console.error("[ERROR][loadCostCodesForUnitPrice] Failed:", error);
        showToast(`공사코드 목록 로딩 실패: ${error.message}`, "error");
        renderCostCodeListForUnitPrice([]);
    }
}
function handleCostCodeSelectionForUnitPrice(event) {
    console.log("[DEBUG][handleCostCodeSelectionForUnitPrice] Start");
    const targetItem = event.target.closest(".cost-code-item");
    if (!targetItem) {
        console.log(
            "[DEBUG][handleCostCodeSelectionForUnitPrice] Clicked outside a cost code item."
        );
        return;
    }

    const costCodeId = targetItem.dataset.id;
    if (!costCodeId) {
        console.warn(
            "[WARN][handleCostCodeSelectionForUnitPrice] Clicked item has no data-id."
        );
        return;
    }

    if (costCodeId === selectedCostCodeIdForUnitPrice) {
        console.log(
            `[DEBUG][handleCostCodeSelectionForUnitPrice] Cost code ${costCodeId} is already selected.`
        );
        return; // 이미 선택된 항목이면 무시
    }

    // 다른 항목 편집 중이면 경고 후 중단
    const isEditingPrice = document.querySelector(
        "#unit-price-table-container .editable-row"
    );
    if (isEditingPrice) {
        showToast(
            "편집 중인 단가가 있습니다. 먼저 저장하거나 취소하세요.",
            "warning"
        );
        console.log(
            "[WARN][handleCostCodeSelectionForUnitPrice] Aborted due to ongoing price edit."
        );
        return;
    }

    selectedCostCodeIdForUnitPrice = costCodeId;
    console.log(
        `[DEBUG][handleCostCodeSelectionForUnitPrice] Selected cost code ID set to: ${selectedCostCodeIdForUnitPrice}`
    );

    // UI 업데이트
    const container = document.getElementById("unit-price-cost-code-list");
    container
        .querySelector(".cost-code-item.selected")
        ?.classList.remove("selected");
    targetItem.classList.add("selected");
    console.log(
        `[DEBUG][handleCostCodeSelectionForUnitPrice] Item ${costCodeId} highlighted.`
    );

    const selectedCode = loadedCostCodes.find((c) => c.id === costCodeId);
    const header = document.getElementById("unit-price-list-header");
    if (header && selectedCode) {
        header.textContent = `단가 리스트 (${selectedCode.code} - ${selectedCode.name})`;
        console.log(
            `[DEBUG][handleCostCodeSelectionForUnitPrice] Price list header updated.`
        );
    }
    document.getElementById("add-unit-price-btn").disabled = false;
    console.log(
        `[DEBUG][handleCostCodeSelectionForUnitPrice] 'Add Unit Price' button enabled.`
    );

    // 단가 목록 로드
    loadUnitPrices(costCodeId);
    console.log("[DEBUG][handleCostCodeSelectionForUnitPrice] End");
}
async function loadUnitPriceTypes() {
    console.log("[DEBUG][loadUnitPriceTypes] Start");
    if (!currentProjectId) {
        console.log(
            "[INFO][loadUnitPriceTypes] No project selected. Skipping load."
        );
        renderUnitPriceTypesTable([]);
        return;
    }
    try {
        console.log(
            `[DEBUG][loadUnitPriceTypes] Fetching unit price types for project ${currentProjectId}...`
        );
        const response = await fetch(
            `/connections/api/unit-price-types/${currentProjectId}/`
        );
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Failed to load unit price types: ${response.status} ${errorText}`
            );
        }
        loadedUnitPriceTypes = await response.json();
        console.log(
            `[DEBUG][loadUnitPriceTypes] Successfully loaded ${loadedUnitPriceTypes.length} unit price types.`
        );
        renderUnitPriceTypesTable(loadedUnitPriceTypes);
    } catch (error) {
        console.error("[ERROR][loadUnitPriceTypes] Failed:", error);
        showToast(`단가 구분 목록 로딩 실패: ${error.message}`, "error");
        renderUnitPriceTypesTable([]);
    }
}
async function handleUnitPriceTypeActions(event) {
    console.log("[DEBUG][handleUnitPriceTypeActions] Start");
    const target = event.target;
    const actionRow = target.closest("tr");
    if (!actionRow) return;

    const typeId = actionRow.dataset.id;
    const isEditRow = document.querySelector(
        "#unit-price-type-table-container .editable-row"
    ); // 현재 편집 중인 행 (자신 포함)

    console.log(
        `[DEBUG][handleUnitPriceTypeActions] Clicked target: ${target.tagName}.${target.className}, Row ID: ${typeId}`
    );

    // 현재 수정/추가 중인 행이 있고, 클릭된 버튼이 해당 행의 버튼이 아니면 경고
    if (isEditRow && isEditRow !== actionRow && target.tagName === "BUTTON") {
        showToast(
            "편집 중인 단가 구분이 있습니다. 먼저 저장하거나 취소하세요.",
            "warning"
        );
        console.log(
            "[WARN][handleUnitPriceTypeActions] Aborted due to ongoing edit in another row."
        );
        return;
    }

    if (target.classList.contains("edit-type-btn")) {
        console.log(
            `[DEBUG][handleUnitPriceTypeActions] Edit button clicked for ID: ${typeId}`
        );
        renderUnitPriceTypesTable(loadedUnitPriceTypes, typeId);
    } else if (target.classList.contains("delete-type-btn")) {
        console.log(
            `[DEBUG][handleUnitPriceTypeActions] Delete button clicked for ID: ${typeId}`
        );
        const typeToDelete = loadedUnitPriceTypes.find((t) => t.id === typeId);
        if (
            confirm(
                `'${
                    typeToDelete?.name || typeId
                }' 단가 구분을 삭제하시겠습니까? (사용 중이면 삭제되지 않습니다)`
            )
        ) {
            await deleteUnitPriceType(typeId);
        } else {
            console.log(
                "[DEBUG][handleUnitPriceTypeActions] Delete cancelled by user."
            );
        }
    } else if (target.classList.contains("save-type-btn")) {
        console.log(
            `[DEBUG][handleUnitPriceTypeActions] Save button clicked for ID: ${typeId}`
        );
        const nameInput = actionRow.querySelector(".type-name-input");
        const descInput = actionRow.querySelector(".type-description-input");
        const typeData = {
            id: typeId === "new" ? null : typeId,
            name: nameInput.value.trim(),
            description: descInput.value.trim(),
        };
        if (!typeData.name) {
            showToast("단가 구분 이름은 필수입니다.", "error");
            return;
        }
        console.log(
            "[DEBUG][handleUnitPriceTypeActions] Calling saveUnitPriceType with data:",
            typeData
        );
        await saveUnitPriceType(typeData);
    } else if (target.classList.contains("cancel-type-btn")) {
        console.log(
            `[DEBUG][handleUnitPriceTypeActions] Cancel button clicked for ID: ${typeId}`
        );
        renderUnitPriceTypesTable(loadedUnitPriceTypes);
    }
    console.log("[DEBUG][handleUnitPriceTypeActions] End");
}
async function saveUnitPriceType(typeData) {
    console.log("[DEBUG][saveUnitPriceType] Start, Data:", typeData);
    if (!currentProjectId) {
        console.error("[ERROR][saveUnitPriceType] Project ID is missing.");
        return;
    }

    const isNew = !typeData.id;
    const url = isNew
        ? `/connections/api/unit-price-types/${currentProjectId}/`
        : `/connections/api/unit-price-types/${currentProjectId}/${typeData.id}/`;
    const method = isNew ? "POST" : "PUT";

    try {
        console.log(
            `[DEBUG][saveUnitPriceType] Sending request: ${method} ${url}`
        );
        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrftoken,
            },
            body: JSON.stringify({
                name: typeData.name,
                description: typeData.description,
            }),
        });
        const result = await response.json();
        console.log("[DEBUG][saveUnitPriceType] Server response:", result);

        if (!response.ok)
            throw new Error(
                result.message || (isNew ? "생성 실패" : "수정 실패")
            );

        showToast(result.message, "success");
        await loadUnitPriceTypes(); // 목록 새로고침
    } catch (error) {
        console.error("[ERROR][saveUnitPriceType] Failed:", error);
        showToast(error.message, "error");
        renderUnitPriceTypesTable(loadedUnitPriceTypes); // 실패 시 편집 상태 해제
    }
}
async function deleteUnitPriceType(typeId) {
    console.log(`[DEBUG][deleteUnitPriceType] Start, ID: ${typeId}`);
    if (!currentProjectId) {
        console.error("[ERROR][deleteUnitPriceType] Project ID is missing.");
        return;
    }

    try {
        const url = `/connections/api/unit-price-types/${currentProjectId}/${typeId}/`;
        console.log(
            `[DEBUG][deleteUnitPriceType] Sending request: DELETE ${url}`
        );
        const response = await fetch(url, {
            method: "DELETE",
            headers: { "X-CSRFToken": csrftoken },
        });
        const result = await response.json();
        console.log("[DEBUG][deleteUnitPriceType] Server response:", result);

        if (!response.ok) throw new Error(result.message || "삭제 실패");

        showToast(result.message, "success");
        await loadUnitPriceTypes(); // 목록 새로고침
    } catch (error) {
        console.error("[ERROR][deleteUnitPriceType] Failed:", error);
        showToast(error.message, "error");
        // 삭제 실패해도 목록은 다시 그림 (보호된 경우 등 메시지 표시 후 상태 복귀)
        renderUnitPriceTypesTable(loadedUnitPriceTypes);
    }
}
async function loadUnitPrices(costCodeId) {
    console.log(`[DEBUG][loadUnitPrices] Start, CostCode ID: ${costCodeId}`);
    if (!currentProjectId) {
        console.log(
            "[INFO][loadUnitPrices] No project selected. Skipping load."
        );
        renderUnitPricesTable([]);
        return;
    }
    if (!costCodeId) {
        console.warn(
            "[WARN][loadUnitPrices] CostCode ID is missing. Clearing table."
        );
        renderUnitPricesTable([]);
        return;
    }
    try {
        console.log(
            `[DEBUG][loadUnitPrices] Fetching unit prices for project ${currentProjectId}, cost code ${costCodeId}...`
        );
        const url = `/connections/api/unit-prices/${currentProjectId}/${costCodeId}/`;
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Failed to load unit prices: ${response.status} ${errorText}`
            );
        }
        loadedUnitPrices = await response.json();
        console.log(
            `[DEBUG][loadUnitPrices] Successfully loaded ${loadedUnitPrices.length} unit prices.`
        );
        renderUnitPricesTable(loadedUnitPrices);
    } catch (error) {
        console.error("[ERROR][loadUnitPrices] Failed:", error);
        showToast(`단가 목록 로딩 실패: ${error.message}`, "error");
        renderUnitPricesTable([]);
    }
}

async function handleUnitPriceActions(event) {
    console.log("[DEBUG][handleUnitPriceActions] Start");
    const target = event.target;
    const actionRow = target.closest("tr");
    if (!actionRow) return;

    const priceId = actionRow.dataset.id;
    const isEditRow = document.querySelector(
        "#unit-price-table-container .editable-row"
    );

    console.log(
        `[DEBUG][handleUnitPriceActions] Clicked target: ${target.tagName}.${target.className}, Row ID: ${priceId}`
    );

    // 현재 수정/추가 중인 행이 있고, 클릭된 버튼이 해당 행의 버튼이 아니면 경고
    if (isEditRow && isEditRow !== actionRow && target.tagName === "BUTTON") {
        showToast(
            "편집 중인 단가가 있습니다. 먼저 저장하거나 취소하세요.",
            "warning"
        );
        console.log(
            "[WARN][handleUnitPriceActions] Aborted due to ongoing edit in another row."
        );
        return;
    }

    if (target.classList.contains("edit-price-btn")) {
        console.log(
            `[DEBUG][handleUnitPriceActions] Edit button clicked for ID: ${priceId}`
        );
        // 수정 시작 시 원본 데이터 저장
        currentUnitPriceEditState.id = priceId;
        currentUnitPriceEditState.originalData = loadedUnitPrices.find(
            (p) => p.id === priceId
        );
        renderUnitPricesTable(loadedUnitPrices, priceId);
    } else if (target.classList.contains("delete-price-btn")) {
        console.log(
            `[DEBUG][handleUnitPriceActions] Delete button clicked for ID: ${priceId}`
        );
        const priceToDelete = loadedUnitPrices.find((p) => p.id === priceId);
        if (
            confirm(
                `'${
                    priceToDelete?.unit_price_type_name || priceId
                }' 단가를 삭제하시겠습니까?`
            )
        ) {
            await deleteUnitPrice(priceId);
        } else {
            console.log(
                "[DEBUG][handleUnitPriceActions] Delete cancelled by user."
            );
        }
    } else if (target.classList.contains("save-price-btn")) {
        console.log(
            `[DEBUG][handleUnitPriceActions] Save button clicked for ID: ${priceId}`
        );
        const typeSelect = actionRow.querySelector(".price-type-select");
        const materialInput = actionRow.querySelector(".price-material-input");
        const laborInput = actionRow.querySelector(".price-labor-input");
        const expenseInput = actionRow.querySelector(".price-expense-input");
        // ▼▼▼ [추가] 합계 입력 필드 가져오기 ▼▼▼
        const totalInput = actionRow.querySelector(".price-total-input"); // 합계 필드 추가 가정 (ui.js 수정 필요)

        // 합계 직접 입력 가능 여부 확인 (M, L, E 필드가 모두 비어있거나 0인지)
        const isTotalDirectInput =
            (!materialInput.value || parseFloat(materialInput.value) === 0) &&
            (!laborInput.value || parseFloat(laborInput.value) === 0) &&
            (!expenseInput.value || parseFloat(expenseInput.value) === 0) &&
            totalInput &&
            totalInput.value &&
            parseFloat(totalInput.value) > 0;

        const priceData = {
            id: priceId === "new" ? null : priceId,
            unit_price_type_id: typeSelect.value,
            material_cost: materialInput.value, // 문자열로 전달 (백엔드에서 Decimal 변환)
            labor_cost: laborInput.value,
            expense_cost: expenseInput.value,
            // ▼▼▼ [수정] 합계 필드 값도 전달 ▼▼▼
            total_cost: totalInput ? totalInput.value : "0.0", // 합계 필드가 있으면 그 값을 전달
        };

        console.log(
            "[DEBUG][handleUnitPriceActions] Price data to save:",
            priceData
        );

        if (!priceData.unit_price_type_id) {
            showToast("단가 구분을 선택하세요.", "error");
            return;
        }

        // 입력값 유효성 검사 (숫자인지)
        const costs = [
            priceData.material_cost,
            priceData.labor_cost,
            priceData.expense_cost,
            priceData.total_cost,
        ];
        if (costs.some((cost) => cost && isNaN(parseFloat(cost)))) {
            showToast("단가 값은 유효한 숫자로 입력해야 합니다.", "error");
            console.error(
                "[ERROR][handleUnitPriceActions] Invalid number input detected."
            );
            return;
        }

        await saveUnitPrice(priceData);
        currentUnitPriceEditState = { id: null, originalData: null }; // 저장 후 상태 초기화
    } else if (target.classList.contains("cancel-price-btn")) {
        console.log(
            `[DEBUG][handleUnitPriceActions] Cancel button clicked for ID: ${priceId}`
        );
        currentUnitPriceEditState = { id: null, originalData: null }; // 취소 시 상태 초기화
        renderUnitPricesTable(loadedUnitPrices);
    }
    console.log("[DEBUG][handleUnitPriceActions] End");
}

/**
 * 단가 저장 API 호출
 */
async function saveUnitPrice(priceData) {
    console.log("[DEBUG][saveUnitPrice] Start, Data:", priceData);
    if (!currentProjectId || !selectedCostCodeIdForUnitPrice) {
        console.error(
            "[ERROR][saveUnitPrice] Project ID or selected Cost Code ID is missing."
        );
        return;
    }

    const isNew = !priceData.id;
    const url = isNew
        ? `/connections/api/unit-prices/${currentProjectId}/${selectedCostCodeIdForUnitPrice}/`
        : `/connections/api/unit-prices/${currentProjectId}/${selectedCostCodeIdForUnitPrice}/${priceData.id}/`;
    const method = isNew ? "POST" : "PUT";

    // 백엔드로 보낼 데이터 준비 (Decimal 변환은 백엔드에서)
    const payload = {
        unit_price_type_id: priceData.unit_price_type_id,
        material_cost: priceData.material_cost || "0.0", // 빈 문자열 대신 '0.0'
        labor_cost: priceData.labor_cost || "0.0",
        expense_cost: priceData.expense_cost || "0.0",
        total_cost: priceData.total_cost || "0.0", // 합계도 전달
    };
    console.log(
        `[DEBUG][saveUnitPrice] Payload for ${method} ${url}:`,
        payload
    );

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrftoken,
            },
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        console.log("[DEBUG][saveUnitPrice] Server response:", result);

        if (!response.ok)
            throw new Error(
                result.message || (isNew ? "추가 실패" : "수정 실패")
            );

        showToast(result.message, "success");
        await loadUnitPrices(selectedCostCodeIdForUnitPrice); // 목록 새로고침
    } catch (error) {
        console.error("[ERROR][saveUnitPrice] Failed:", error);
        showToast(error.message, "error");
        // 실패 시 편집 상태 유지 또는 해제 결정 필요 (현재는 해제)
        renderUnitPricesTable(loadedUnitPrices);
    }
}

/**
 * 단가 삭제 API 호출
 */
async function deleteUnitPrice(priceId) {
    console.log(`[DEBUG][deleteUnitPrice] Start, ID: ${priceId}`);
    if (!currentProjectId || !selectedCostCodeIdForUnitPrice) {
        console.error(
            "[ERROR][deleteUnitPrice] Project ID or selected Cost Code ID is missing."
        );
        return;
    }

    try {
        const url = `/connections/api/unit-prices/${currentProjectId}/${selectedCostCodeIdForUnitPrice}/${priceId}/`;
        console.log(`[DEBUG][deleteUnitPrice] Sending request: DELETE ${url}`);
        const response = await fetch(url, {
            method: "DELETE",
            headers: { "X-CSRFToken": csrftoken },
        });
        const result = await response.json();
        console.log("[DEBUG][deleteUnitPrice] Server response:", result);

        if (!response.ok) throw new Error(result.message || "삭제 실패");

        showToast(result.message, "success");
        await loadUnitPrices(selectedCostCodeIdForUnitPrice); // 목록 새로고침
    } catch (error) {
        console.error("[ERROR][deleteUnitPrice] Failed:", error);
        showToast(error.message, "error");
        // 실패해도 목록 다시 그림
        renderUnitPricesTable(loadedUnitPrices);
    }
}

/**
 * [수정] 단가 입력 필드 변경 시 합계 자동 계산 + 합계 직접 입력 가능 로직
 */
function handleUnitPriceInputChange(event) {
    const input = event.target;
    const row = input.closest("tr.editable-row");
    if (!row) return; // 편집 중인 행이 아니면 무시

    console.log(
        `[DEBUG][handleUnitPriceInputChange] Input changed in row ${row.dataset.id}, field: ${input.className}`
    );

    const materialInput = row.querySelector(".price-material-input");
    const laborInput = row.querySelector(".price-labor-input");
    const expenseInput = row.querySelector(".price-expense-input");
    const totalInput = row.querySelector(".price-total-input"); // 합계 'input' 가정
    const totalOutput = row.querySelector(".price-total-output"); // 보기 모드 합계 'td'

    // 입력된 필드가 M, L, E 중 하나인지 확인
    const isComponentInput =
        input === materialInput ||
        input === laborInput ||
        input === expenseInput;
    // 입력된 필드가 T 인지 확인
    const isTotalInput = input === totalInput;

    let material = parseFloat(materialInput?.value) || 0;
    let labor = parseFloat(laborInput?.value) || 0;
    let expense = parseFloat(expenseInput?.value) || 0;
    let total = parseFloat(totalInput?.value) || 0; // 현재 합계 필드 값

    if (isComponentInput) {
        // M, L, E 중 하나라도 값이 입력되면 합계를 자동으로 계산하고 업데이트
        const calculatedTotal = material + labor + expense;
        console.log(
            `[DEBUG][handleUnitPriceInputChange] Component input changed. Calculated total: ${calculatedTotal}`
        );
        if (totalInput) {
            totalInput.value = calculatedTotal.toFixed(4); // 합계 input 업데이트
            // 합계 필드를 읽기 전용으로 만들거나 비활성화하여 직접 수정을 막을 수도 있음
            // totalInput.readOnly = true;
        }
        if (totalOutput) {
            // 보기 모드에서도 업데이트 (현재 구조상 필요 없을 수 있음)
            totalOutput.textContent = calculatedTotal.toFixed(4);
        }
    } else if (isTotalInput) {
        // 합계 필드가 직접 수정되면 M, L, E 값을 0으로 설정하거나 비활성화
        console.log(
            `[DEBUG][handleUnitPriceInputChange] Total input changed directly to: ${total}`
        );
        if (total > 0) {
            // 합계가 0보다 클 때만
            if (materialInput) materialInput.value = "0.0000";
            if (laborInput) laborInput.value = "0.0000";
            if (expenseInput) expenseInput.value = "0.0000";
            console.log(
                "[DEBUG][handleUnitPriceInputChange] Component inputs cleared because total was entered directly."
            );
            // M, L, E 필드를 읽기 전용/비활성화 할 수도 있음
            // materialInput.readOnly = true; laborInput.readOnly = true; expenseInput.readOnly = true;
        } else {
            // 합계가 0이면 M, L, E 입력 가능하게 복원 (필요 시)
            // materialInput.readOnly = false; laborInput.readOnly = false; expenseInput.readOnly = false;
        }
        if (totalOutput) {
            // 보기 모드 업데이트
            totalOutput.textContent = total.toFixed(4);
        }
    }
}
