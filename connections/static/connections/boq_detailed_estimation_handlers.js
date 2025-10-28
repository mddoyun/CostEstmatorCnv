// Global variables related to BOQ
let availableBoqFields = [];
let loadedDdCostItems = []; // Detailed Estimation (DD) specific cost items
let loadedUnitPriceTypesForBoq = [];
let boqColumnAliases = {};
let currentBoqColumns = [];
let boqFilteredRawElementIds = new Set(); // For client-side filtering based on Revit selection
let currentBoqDetailItemId = null; // Currently selected item ID in the BOQ details panel

// Helper function to get value for BIM properties (assuming it's defined globally or in a utility file)
// This function needs to be available in this scope. For now, assuming it's global.
// function getValueForItem(rawElement, key) { ... }

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

async function loadBoqGroupingFields() {
    if (!currentProjectId) {
        showToast("먼저 프로젝트를 선택하세요.", "error");
        return;
    }

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

        renderBoqDisplayFieldControls(availableBoqFields);

        if (document.querySelectorAll(".boq-group-level").length === 0) {
            addBoqGroupingLevel();
        } else {
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

    const filterAiChecked = false;
    const filterDdChecked = true;
    console.log(
        "[DEBUG] Detailed Estimation filter fixed to DD-only (AI=false, DD=true)."
    );

    const groupBySelects = document.querySelectorAll(".boq-group-by-select");
    if (groupBySelects.length === 0 && activeTab === "boq") {
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

    params.append("filter_ai", filterAiChecked);
    params.append("filter_dd", filterDdChecked);

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
            loadedDdCostItems = data.items_detail;
            console.log(
                `[DEBUG] loadedDdCostItems 업데이트 완료 (${loadedDdCostItems.length}개 항목).`
            );
        } else {
            console.warn("[WARN] API 응답에 'items_detail' 필드가 없습니다.");
            loadedDdCostItems = [];
        }
        loadedUnitPriceTypesForBoq = data.unit_price_types || [];
        console.log(
            `[DEBUG] ${loadedUnitPriceTypesForBoq.length}개의 단가 기준 목록 수신.`
        );

        if (!preserveColumnOrder) {
            updateDdBoqColumns();
        }

        renderBoqTable(
            data.report,
            data.summary,
            loadedUnitPriceTypesForBoq,
            "boq-table-container"
        );
        setupBoqTableInteractions();
        console.log("[DEBUG] 집계표 렌더링 완료.");

        updateBoqDetailsPanel(null);
    } catch (error) {
        console.error("[DEBUG] 집계표 생성 중 오류 발생:", error);
        tableContainer.innerHTML = `<p style="padding: 20px; color: red;">오류: ${error.message}</p>`;
        showToast(error.message, "error");
    }
}

/**
 * 집계 테이블과 상세 정보 패널의 모든 상호작용을 위한 이벤트 리스너를 설정합니다.
 */
function setupBoqTableInteractions() {
    console.log("[DEBUG] Setting up BOQ table interactions...");
    const tableContainer = document.getElementById("boq-table-container");
    const table = tableContainer?.querySelector(".boq-table");
    if (!table) {
        console.log("[DEBUG] BOQ table not yet rendered (no data or still loading).");
        return;
    }

    // --- 1. 메인 BOQ 테이블 상호작용 (열 이름 변경, 드래그앤드롭 등) ---
    const thead = table.querySelector("thead");
    if (thead && !thead.dataset.interactionsAttached) {
        thead.addEventListener("click", (e) => {
            if (e.target.classList.contains("col-edit-btn")) {
                const th = e.target.closest("th");
                if (th.querySelector("input")) return;

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

        thead.dataset.interactionsAttached = "true";
        console.log(
            "[DEBUG] BOQ table header interactions (drag/drop, edit) attached."
        );
    }

    // --- 2. 메인 BOQ 테이블 '행' 클릭 시 -> 중앙 하단 목록 업데이트 ---
    const tbody = table.querySelector("tbody");
    console.log('[DEBUG] Found tbody element:', tbody);
    console.log('[DEBUG] tbody has rowClickListenerAttached:', tbody?.dataset.rowClickListenerAttached);

    if (tbody && !tbody.dataset.rowClickListenerAttached) {
        tbody.addEventListener("click", (e) => {
            console.log('[DEBUG] tbody click event triggered', e.target);
            // Find either boq-group-header or boq-item-row
            const row = e.target.closest("tr.boq-group-header, tr.boq-item-row");
            console.log('[DEBUG] Closest BOQ row:', row);
            console.log('[DEBUG] Row classes:', row?.className);

            // Ignore clicks on select, button, or icon elements
            if (row && !e.target.matches("select, button, i")) {
                const currentSelected = table.querySelector(
                    "tr.selected-boq-row"
                );
                if (currentSelected)
                    currentSelected.classList.remove("selected-boq-row");
                row.classList.add("selected-boq-row");

                const itemIds = JSON.parse(row.dataset.itemIds || "[]");
                console.log(
                    `[DEBUG][Event] Main BOQ table row clicked. Item IDs:`, itemIds
                );
                updateBoqDetailsPanel(itemIds);
            }
        });
        tbody.dataset.rowClickListenerAttached = "true";
        console.log("[DEBUG] Main BOQ table row click listener attached.");
    } else if (tbody) {
        console.warn('[WARN] tbody already has rowClickListenerAttached, skipping...');
    } else {
        console.error('[ERROR] tbody not found!');
    }

    // --- 3. 메인 BOQ 테이블 '단가기준' 드롭다운 변경 시 ---
    if (tbody && !tbody.dataset.unitPriceChangeListenerAttached) {
        tbody.addEventListener("change", async (e) => {
            if (e.target.classList.contains("unit-price-type-select")) {
                const selectElement = e.target;
                const newTypeId = selectElement.value;
                const itemIdsToUpdate = JSON.parse(
                    selectElement.dataset.itemIds || "[]"
                );

                if (itemIdsToUpdate.length === 0) return;

                console.log(
                    `[DEBUG][Event] UnitPriceType changed for ${itemIdsToUpdate.length} items. New Type ID: ${newTypeId}`
                );
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
                                unit_price_type_id: newTypeId || null,
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
                    );
                    await generateBoqReport(true);
                } catch (error) {
                    console.error(
                        "[ERROR][Event] Failed to update UnitPriceType:",
                        error
                    );
                    showToast(error.message, "error");
                    const row = selectElement.closest("tr");
                    selectElement.value = row.dataset.currentTypeId || "";
                }
            }
        });
        tbody.dataset.unitPriceChangeListenerAttached = "true";
        console.log(
            "[DEBUG] Main BOQ table unit price change listener attached."
        );
    }

    // --- 4. 중앙 하단 '포함된 산출항목' 목록 클릭 시 -> 선택 상태 변경 및 왼쪽/오른쪽 상세 패널 업데이트 ---
    const itemListContainer = document.getElementById(
        "boq-item-list-container"
    );
    if (itemListContainer && !itemListContainer.dataset.clickListenerAttached) {
        itemListContainer.addEventListener("click", (e) => {
            const itemRow = e.target.closest("tr[data-item-id]");
            const bimButton = e.target.closest(
                "button.select-in-client-btn-detail"
            );

            if (bimButton) {
                const costItemId = bimButton.dataset.costItemId;
                console.log(
                    `[DEBUG][Event] BIM link button clicked for CostItem ID: ${costItemId}`
                );
                handleBoqSelectInClientFromDetail(costItemId);
            } else if (itemRow) {
                const itemId = itemRow.dataset.itemId;
                console.log(
                    `[DEBUG][Event] Bottom BOQ item row clicked. Item ID: ${itemId}`
                );

                const currentSelectedRow =
                    itemListContainer.querySelector("tr.selected");
                if (currentSelectedRow) {
                    currentSelectedRow.classList.remove("selected");
                    console.log(
                        `[DEBUG][UI] Removed 'selected' class from previous bottom row.`
                    );
                }
                itemRow.classList.add("selected");
                console.log(
                    `[DEBUG][UI] Added 'selected' class to bottom table row ID: ${itemId}`
                );

                renderBoqItemProperties(itemId);
                renderBoqBimObjectCostSummary(itemId);
            } else {
                console.log(
                    "[DEBUG][Event] Click inside bottom panel, but not on a data row or button."
                );
            }
        });
        itemListContainer.dataset.clickListenerAttached = "true";
        console.log("[DEBUG] Bottom BOQ item list click listener attached.");
    }
    console.log("[DEBUG] BOQ table interactions setup complete.");
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
 * 중앙 하단 패널에 포함된 산출항목 목록을 테이블로 렌더링하고, 숫자 서식을 적용합니다.
 * @param {Array<String>} itemIds - 표시할 CostItem의 ID 배열
 */
function updateBoqDetailsPanel(itemIds) {
    const listContainer = document.getElementById("boq-item-list-container");

    // 숫자 포매팅 헬퍼 함수
    const formatNumber = (value, precision = 3) => {
        const num = parseFloat(value);
        if (isNaN(num)) return value; // 숫자가 아니면 원래 값 반환
        return num.toFixed(precision);
    };

    if (!itemIds || itemIds.length === 0) {
        console.log("[DEBUG][UI] updateBoqDetailsPanel called with no items (expected when no data selected).");
        listContainer.innerHTML =
            '<p style="padding: 10px;">이 그룹에 포함된 산출항목이 없습니다.</p>';
        renderBoqItemProperties(null);
        renderBoqBimObjectCostSummary(null);
        return;
    }

    console.log(`[DEBUG][UI] updateBoqDetailsPanel rendering ${itemIds.length} items.`);

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
        { id: "unit_price_type_name", label: "단가기준", align: "center" },
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

        // Find quantity member name
        const quantityMember = item.quantity_member_id
            ? loadedQuantityMembers.find(
                  (m) => m.id.toString() === item.quantity_member_id.toString()
              )
            : null;
        const linkedMemberName = quantityMember
            ? quantityMember.name || "(이름 없는 부재)"
            : "(연관 부재 없음)";

        // Find raw element name
        const rawElement = quantityMember?.raw_element_id
            ? allRevitData.find(
                  (re) => re.id.toString() === quantityMember.raw_element_id.toString()
              )
            : null;
        const linkedRawName = rawElement
            ? rawElement.raw_data?.Name || "(이름 없는 BIM 객체)"
            : "(BIM 원본 없음)";

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
            linked_member_name: linkedMemberName,
            linked_raw_name: linkedRawName,
            actions: rawElement
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

/**
 * ID에 해당하는 CostItem의 상세 속성을 오른쪽 상세정보 패널에 렌더링합니다.
 * @param {String | null} itemId - 상세 정보를 표시할 CostItem의 ID
 */
function renderBoqItemProperties(itemId) {
    currentBoqDetailItemId = itemId;

    const listContainer = document.getElementById("boq-item-list-container");
    listContainer.querySelectorAll("tr").forEach((row) => {
        row.classList.toggle("selected", row.dataset.itemId === itemId);
    });

    const memberContainer = document.getElementById(
        "boq-details-member-container"
    );
    const markContainer = document.getElementById("boq-details-mark-container");
    const rawContainer = document.getElementById("boq-details-raw-container");

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

    // 2. 일람부호 속성 렌더링
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

// =====================================================================
// '집계' 탭 동적 UI 최종 완성본 (리사이저, 접기/펴기, 탭 클릭)
// =====================================================================
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
    );

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

    // --- 3. 왼쪽 상세 정보 패널 탭 클릭 기능 ---
    if (boqDetailsPanel) {
        const tabsContainer = boqDetailsPanel.querySelector(
            ".details-panel-tabs"
        );
        if (tabsContainer && !tabsContainer.dataset.listenerAttached) {
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

                const targetTab = clickedButton.dataset.tab;
                console.log(`[DEBUG] DD Detail tab clicked: ${targetTab}`);

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
            tabsContainer.dataset.listenerAttached = "true";
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
    boqFilteredRawElementIds.clear();
    console.log("[DEBUG] boqFilteredRawElementIds 초기화 완료.");

    document.getElementById("boq-clear-selection-filter-btn").style.display =
        "none";

    generateBoqReport();

    showToast("Revit 선택 필터를 해제하고 전체 집계표를 표시합니다.", "info");
}
function resetBoqColumnsAndRegenerate(skipConfirmation = false) {
    console.log("[DEBUG] '열 순서/이름 초기화' 버튼 클릭됨");

    if (
        !skipConfirmation &&
        !confirm("테이블의 열 순서와 이름을 기본값으로 초기화하시겠습니까?")
    ) {
        console.log("[DEBUG] 초기화 취소됨.");
        return;
    }

    localStorage.removeItem("boqColumnSettings");
    console.log("[DEBUG] BOQ column settings removed from localStorage.");

    currentBoqColumns = [];
    boqColumnAliases = {};
    console.log(
        "[DEBUG] 열 상태(currentBoqColumns, boqColumnAliases) 초기화됨."
    );

    loadBoqColumnSettings();
    showToast("열 상태를 초기화하고 집계표를 다시 생성합니다.", "info");
    generateBoqReport();
}

/**
 * DD 탭 하단 BOQ 테이블 컬럼 목록(currentBoqColumns)을 현재 UI 상태에 맞게 업데이트
 */
function updateDdBoqColumns() {
    console.log("[DEBUG][DD BOQ] Updating DD BOQ column definitions...");
    boqColumnAliases = {};
    document.querySelectorAll("#boq-table-container thead th").forEach((th) => {
        const colId = th.dataset.columnId;
        const currentText = th.childNodes[0].nodeValue.trim();
        const defaultLabel = currentBoqColumns.find(
            (c) => c.id === colId
        )?.label;
        if (colId && defaultLabel && currentText !== defaultLabel) {
            boqColumnAliases[colId] = currentText;
        }
    });
    console.log("[DEBUG][DD BOQ] Updated boqColumnAliases:", boqColumnAliases);

    const selectedDisplayFields = Array.from(
        document.querySelectorAll(".boq-display-field-cb:checked")
    ).map((cb) => ({
        id: cb.value.replace(/__/g, "_"),
        label: cb.parentElement.textContent.trim(),
        isDynamic: true,
    }));

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
        ...selectedDisplayFields,
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

/**
 * localStorage에서 BOQ 테이블의 컬럼 순서와 별칭 설정을 로드합니다.
 * 로드된 설정은 currentBoqColumns와 boqColumnAliases에 적용됩니다.
 */
function loadBoqColumnSettings() {
    if (!currentProjectId) return;
    try {
        const savedSettings = localStorage.getItem(
            `boqColumnSettings_${currentProjectId}`
        );
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            currentBoqColumns = settings.columns || [];
            boqColumnAliases = settings.aliases || {};
            console.log(
                "[DEBUG] Loaded BOQ column settings from localStorage."
            );
        } else {
            console.log(
                "[DEBUG] No BOQ column settings found in localStorage for this project. Using defaults."
            );
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
            "Failed to load BOQ column settings from localStorage:",
            e
        );
        showToast(
            "컬럼 설정을 로컬 저장소에서 불러오는데 실패했습니다.",
            "error"
        );
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

// --- BOQ BIM 객체 비용 요약 렌더링 함수 ---
function renderBoqBimObjectCostSummary(itemId) {
    const summaryContainer = document.getElementById(
        "boq-bim-object-cost-summary"
    );
    if (!itemId) {
        summaryContainer.innerHTML =
            '<p style="padding: 10px;">하단 목록에서 산출항목을 선택하면 연관된 BIM 객체의 비용 요약이 표시됩니다.</p>';
        document.getElementById("boq-bim-object-summary-header").textContent =
            "BIM 객체 비용 요약";
        return;
    }

    const costItem = loadedCostItems.find(
        (item) => item.id.toString() === itemId.toString()
    );
    if (!costItem || !costItem.quantity_member_id) {
        summaryContainer.innerHTML =
            '<p style="padding: 10px;">연관된 BIM 객체 정보가 없습니다.</p>';
        document.getElementById("boq-bim-object-summary-header").textContent =
            "BIM 객체 비용 요약";
        return;
    }

    const member = loadedQuantityMembers.find(
        (m) => m.id.toString() === costItem.quantity_member_id.toString()
    );
    if (!member || !member.raw_element_id) {
        summaryContainer.innerHTML =
            '<p style="padding: 10px;">연관된 BIM 객체 정보가 없습니다.</p>';
        document.getElementById("boq-bim-object-summary-header").textContent =
            "BIM 객체 비용 요약";
        return;
    }

    const rawElement = allRevitData.find(
        (re) => re.id.toString() === member.raw_element_id.toString()
    );
    if (!rawElement || !rawElement.cost_summary) {
        summaryContainer.innerHTML =
            '<p style="padding: 10px;">연관된 BIM 객체 비용 요약이 없습니다.</p>';
        document.getElementById("boq-bim-object-summary-header").textContent =
            "BIM 객체 비용 요약";
        return;
    }

    document.getElementById(
        "boq-bim-object-summary-header"
    ).textContent = `BIM 객체 비용 요약: ${
        rawElement.raw_data?.Name || "이름 없음"
    }`;

    const summary = rawElement.cost_summary;
    let html = `<table class="properties-table"><tbody>`;

    const formatCurrency = (value) => {
        if (typeof value !== "number") return value;
        return value.toLocaleString("ko-KR", {
            style: "currency",
            currency: "KRW",
        });
    };

    html += `<tr><td>총 합계 금액</td><td>${formatCurrency(
        summary.total_cost
    )}</td></tr>`;
    html += `<tr><td>재료비</td><td>${formatCurrency(
        summary.material_cost
    )}</td></tr>`;
    html += `<tr><td>노무비</td><td>${formatCurrency(
        summary.labor_cost
    )}</td></tr>`;
    html += `<tr><td>경비</td><td>${formatCurrency(
        summary.expense_cost
    )}</td></tr>`;
    html += `</tbody></table>`;

    summaryContainer.innerHTML = html;
}

// --- BOQ 표시 필드 컨트롤 렌더링 함수 ---
function renderBoqDisplayFieldControls(fields) {
    const container = document.getElementById("boq-display-fields-container");
    if (!container) return;

    if (fields.length === 0) {
        container.innerHTML = "<small>표시할 필드가 없습니다.</small>";
        return;
    }

    let html = "";
    fields.forEach((field) => {
        html += `
            <label style="display: block; margin-bottom: 5px;">
                <input type="checkbox" class="boq-display-field-cb" value="${field.value}" checked>
                ${field.label}
            </label>
        `;
    });
    container.innerHTML = html;

    container.querySelectorAll(".boq-display-field-cb").forEach((checkbox) => {
        checkbox.addEventListener("change", () => generateBoqReport());
    });
}

// --- BOQ 테이블 렌더링 함수 ---
function renderBoqTable(reportData, summaryData, unitPriceTypes, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID ${containerId} not found.`);
        return;
    }

    if (!reportData || reportData.length === 0) {
        container.innerHTML =
            "<p style='padding: 20px;'>표시할 데이터가 없습니다.</p>";
        return;
    }

    loadBoqColumnSettings();

    const dynamicDisplayFields = Array.from(
        document.querySelectorAll(".boq-display-field-cb:checked")
    ).map((cb) => ({
        id: cb.value.replace(/__/g, "_"),
        label: cb.parentElement.textContent.trim(),
        isDynamic: true,
    }));

    let finalColumns = [
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
        ...dynamicDisplayFields,
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

    if (currentBoqColumns.length > 0) {
        const reordered = [];
        currentBoqColumns.forEach((col) => {
            const found = finalColumns.find((fc) => fc.id === col.id);
            if (found) {
                reordered.push({
                    ...found,
                    label: boqColumnAliases[col.id] || found.label,
                });
            } else if (col.isDynamic) {
                const dynamicFieldExists = availableBoqFields.some(
                    (f) => f.value === col.id
                );
                if (dynamicFieldExists) {
                    reordered.push({
                        ...col,
                        label: boqColumnAliases[col.id] || col.label,
                    });
                }
            }
        });
        finalColumns.forEach((col) => {
            if (!reordered.some((rc) => rc.id === col.id)) {
                reordered.push(col);
            }
        });
        finalColumns = reordered;
    }

    const unitPriceOptions = [
        `<option value="">-- 미지정 --</option>`,
        ...unitPriceTypes.map(
            (type) => `<option value="${type.id}">${type.name}</option>`
        ),
    ].join("");

    let tableHtml = `<table class="boq-table"><thead><tr>`;
    finalColumns.forEach((col) => {
        const currentLabel = boqColumnAliases[col.id] || col.label;
        tableHtml += `
            <th data-column-id="${col.id}" style="text-align: ${
            col.align || "left"
        }; width: ${col.width || "auto"};">
                ${currentLabel}
                <button class="col-edit-btn" title="열 이름 변경">✏️</button>
            </th>
        `;
    });
    tableHtml += `</tr></thead><tbody>`;

    function renderRows(items, level = 0) {
        items.forEach((item) => {
            const isGroup = item.children && item.children.length > 0;
            const rowClass = isGroup ? "boq-group-header" : "boq-item-row";

            // Determine item IDs to use
            let itemIds;
            if (item.item_ids && Array.isArray(item.item_ids)) {
                // Use item_ids if available (grouped or aggregated rows)
                itemIds = JSON.stringify(item.item_ids);
            } else if (item.id) {
                // Use single item.id for individual items
                itemIds = JSON.stringify([item.id]);
            } else {
                // Fallback to empty array
                itemIds = JSON.stringify([]);
                console.warn('[WARN] Row has no item_ids or id:', item);
            }

            const currentUnitPriceTypeId = item.unit_price_type_id || "";

            tableHtml += `
                <tr class="${rowClass}" data-item-ids='${itemIds}' data-current-type-id="${currentUnitPriceTypeId}">
            `;

            finalColumns.forEach((col) => {
                let cellContent = item[col.id];
                let cellStyle = `text-align: ${col.align || "left"};`;

                if (col.id === "name") {
                    const padding = level * 20;
                    const toggleIcon = isGroup
                        ? `<i class="fas fa-chevron-right group-toggle-icon" style="margin-right: 5px;"></i>`
                        : "";
                    cellContent = `<span style="padding-left: ${padding}px;">${toggleIcon}${cellContent}</span>`;
                } else if (col.id === "unit_price_type_id" && !isGroup) {
                    cellContent = `
                        <select class="unit-price-type-select" data-item-ids='${itemIds}'>
                            ${unitPriceOptions.replace(
                                `value="${currentUnitPriceTypeId}"`,
                                `value="${currentUnitPriceTypeId}" selected`
                            )}
                        </select>
                    `;
                } else if (
                    typeof cellContent === "number" &&
                    col.id !== "count"
                ) {
                    cellContent = cellContent.toLocaleString("ko-KR");
                } else if (cellContent === undefined || cellContent === null) {
                    cellContent = "-";
                }

                tableHtml += `<td style="${cellStyle}">${cellContent}</td>`;
            });
            tableHtml += `</tr>`;

            if (isGroup && item.children.length > 0) {
                renderRows(item.children, level + 1);
            }
        });
    }

    renderRows(reportData);

    if (summaryData) {
        tableHtml += `<tr class="boq-summary-row">`;
        finalColumns.forEach((col) => {
            let cellContent = summaryData[col.id];
            let cellStyle = `text-align: ${
                col.align || "left"
            }; font-weight: bold;`;
            if (col.id === "name") {
                cellContent = "총계";
            } else if (typeof cellContent === "number" && col.id !== "count") {
                cellContent = cellContent.toLocaleString("ko-KR");
            } else if (cellContent === undefined || cellContent === null) {
                cellContent = "-";
            }
            tableHtml += `<td style="${cellStyle}">${cellContent}</td>`;
        });
        tableHtml += `</tr>`;
    }

    tableHtml += `</tbody></table>`;
    container.innerHTML = tableHtml;

    const theadRow = container.querySelector("thead tr");
    if (theadRow) {
        Sortable.create(theadRow, {
            animation: 150,
            onEnd: function (evt) {
                const oldIndex = evt.oldIndex;
                const newIndex = evt.newIndex;

                const [movedColumn] = currentBoqColumns.splice(oldIndex, 1);
                currentBoqColumns.splice(newIndex, 0, movedColumn);

                saveBoqColumnSettings();
                generateBoqReport(true);
            },
        });
    }
}
