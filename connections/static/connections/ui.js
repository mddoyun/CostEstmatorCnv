// connections/static/connections/ui.js

// BIM 필드명 변환 함수들 (계층적 명명 규칙 적용)

// 내부 필드명을 표시용 계층 이름으로 변환
function getDisplayFieldName(internalField) {
    if (!internalField) return '';

    // BIM.System.* - Cost Estimator 자체 관리 속성
    const systemProps = ['id', 'element_unique_id', 'classification_tags', 'geometry_volume'];
    if (systemProps.includes(internalField)) {
        return `BIM.System.${internalField}`;
    }

    // ▼▼▼ [수정] 동적 평탄화된 필드 감지 (점이 포함된 모든 필드) ▼▼▼
    // BIM 도구에서 보낸 모든 평탄화된 필드를 자동 감지
    // 예: Attributes.Description, PropertySet.Pset_WallCommon__IsExternal
    if (internalField.includes('.')) {
        // 이미 평탄화된 필드는 BIM. 접두어만 추가
        return `BIM.${internalField}`;
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // BIM.TypeParameters.* - 타입 파라미터 (하위 호환성)
    if (internalField.startsWith('TypeParameters.')) {
        const subKey = internalField.substring(15);
        return `BIM.TypeParameters.${subKey}`;
    }

    // BIM.Attributes.* - IFC raw_data 직접 속성 (하위 호환성)
    const ifcAttributeProps = ['Name', 'IfcClass', 'ElementId', 'UniqueId', 'Description',
                                'RelatingType', 'SpatialContainer', 'Aggregates', 'Nests', 'Tag', 'PredefinedType'];
    if (ifcAttributeProps.includes(internalField)) {
        return `BIM.Attributes.${internalField}`;
    }

    // BIM.Parameters.* - 나머지는 모두 Parameters로 간주
    // Revit의 Category, Family 등도 실제로는 Parameters를 통해 접근 가능
    return `BIM.Parameters.${internalField}`;
}

// 표시용 계층 이름을 내부 필드명으로 변환
function getInternalFieldName(displayField) {
    if (!displayField) return '';

    // ▼▼▼ [추가] QM.*, MM.*, SC.*, CI.*, CC.*, AO.*, AC.* 처리 (2025-11-05) ▼▼▼
    // QM.System.* -> 수량산출부재 시스템 속성
    if (displayField.startsWith('QM.System.')) {
        return displayField.substring(10); // 'QM.System.' 제거
    }
    // QM.Properties.* -> 수량산출부재 사용자 정의 속성
    if (displayField.startsWith('QM.Properties.')) {
        return displayField.substring(14); // 'QM.Properties.' 제거
    }

    // MM.System.* -> 일람부호 시스템 속성
    if (displayField.startsWith('MM.System.')) {
        return displayField.substring(10); // 'MM.System.' 제거
    }
    // MM.Properties.* -> 일람부호 사용자 정의 속성
    if (displayField.startsWith('MM.Properties.')) {
        return displayField.substring(14); // 'MM.Properties.' 제거
    }

    // SC.System.* -> 공간분류 시스템 속성
    if (displayField.startsWith('SC.System.')) {
        return displayField.substring(10); // 'SC.System.' 제거
    }

    // CI.System.* -> 코스트아이템 시스템 속성
    if (displayField.startsWith('CI.System.')) {
        return displayField.substring(10); // 'CI.System.' 제거
    }

    // CC.System.* -> 공사코드 시스템 속성
    if (displayField.startsWith('CC.System.')) {
        return displayField.substring(10); // 'CC.System.' 제거
    }

    // AO.System.* -> 액티비티객체 시스템 속성
    if (displayField.startsWith('AO.System.')) {
        return displayField.substring(10); // 'AO.System.' 제거
    }

    // AC.System.* -> 액티비티코드 시스템 속성
    if (displayField.startsWith('AC.System.')) {
        return displayField.substring(10); // 'AC.System.' 제거
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // BIM. 접두어가 없으면 그대로 반환 (하위 호환성)
    if (!displayField.startsWith('BIM.')) {
        return displayField;
    }

    // ▼▼▼ [수정] BIM.Attributes.* 처리 추가 (2025-11-05) ▼▼▼
    // BIM.Attributes.IfcClass -> IfcClass
    if (displayField.startsWith('BIM.Attributes.')) {
        return displayField.substring(4); // 'BIM.' 제거 -> 'Attributes.Category'
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // ▼▼▼ [수정] BIM.System.* 처리 추가 (2025-11-05) ▼▼▼
    // BIM.System.classification_tags -> classification_tags
    // BIM.System.id -> id
    // BIM.System.element_unique_id -> element_unique_id
    // BIM.System.geometry_volume -> geometry_volume
    if (displayField.startsWith('BIM.System.')) {
        return displayField.substring(11); // 'BIM.System.' 제거
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // ▼▼▼ [수정] 동적 평탄화된 필드 역변환 ▼▼▼
    // BIM.Category.Property 형식을 Category.Property로 변환
    // 점이 2개 이상 포함되어 있으면 평탄화된 필드로 간주
    if (displayField.startsWith('BIM.') && displayField.split('.').length >= 3) {
        return displayField.substring(4); // 'BIM.' 제거
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // BIM.TypeParameters.* (하위 호환성)
    if (displayField.startsWith('BIM.TypeParameters.')) {
        const subKey = displayField.substring(19); // 'BIM.TypeParameters.' 제거
        return `TypeParameters.${subKey}`;
    }

    // BIM.Parameters.* (하위 호환성)
    if (displayField.startsWith('BIM.Parameters.')) {
        return displayField.substring(15); // 'BIM.Parameters.' 제거
    }

    return displayField;
}

function getValueForItem(item, field) {
    if (!item || !field) return '';

    // 표시용 계층 이름을 내부 필드명으로 변환
    const internalField = getInternalFieldName(field);

    // ▼▼▼ [디버깅] 필드 변환 확인 (2025-11-05) ▼▼▼
    if (field.includes('IfcClass') || field.includes('Attributes')) {
        console.log('[getValueForItem] field:', field, '-> internalField:', internalField);
    }
    // ▲▲▲ [디버깅] 여기까지 ▲▲▲

    if (internalField === 'classification_tags') {
        // ▼▼▼ [디버깅] classification_tags 데이터 확인 (2025-11-05) ▼▼▼
        console.log('[getValueForItem] classification_tags check for item:', item.id, {
            'classification_tags': item.classification_tags,
            'classification_tags_details': item.classification_tags_details
        });
        // ▲▲▲ [디버깅] 여기까지 ▲▲▲

        // classification_tags_details가 있으면 할당 타입 표시 포함
        if (Array.isArray(item.classification_tags_details) && item.classification_tags_details.length > 0) {
            return item.classification_tags_details.map(detail => {
                const icon = detail.assignment_type === 'ruleset' ? '🤖' : '✋';
                return `${icon}${detail.name}`;
            }).join(', ');
        }
        // 하위 호환성: classification_tags만 있는 경우
        return Array.isArray(item.classification_tags)
            ? item.classification_tags.join(', ')
            : '';
    }
    const raw_data = item.raw_data || {};

    // ▼▼▼ [디버깅] raw_data 전체 구조 확인 (2025-11-05) ▼▼▼
    if (field.includes('Tag') && field.includes('Attributes')) {
        console.log('[getValueForItem] Searching for Tag in item:', {
            'item.Tag': item.Tag,
            'raw_data.Tag': raw_data.Tag,
            'raw_data.Parameters?.Tag': raw_data.Parameters?.Tag,
            'raw_data keys': Object.keys(raw_data),
            'item keys': Object.keys(item).filter(k => k !== 'raw_data')
        });
    }
    // ▲▲▲ [디버깅] 여기까지 ▲▲▲

    if (internalField in item && internalField !== 'raw_data') return item[internalField] ?? '';

    // ▼▼▼ [수정] 평탄화된 키 검사를 중첩 경로 처리보다 먼저 수행 (2025-11-29) ▼▼▼
    // 예: 'Attributes.Category'가 raw_data['Attributes.Category']로 직접 존재하는 경우
    if (internalField in raw_data) {
        if (field.includes('IfcClass') || field.includes('Attributes')) {
            console.log('[getValueForItem] Found flattened key in raw_data:', internalField, '=', raw_data[internalField]);
        }
        return raw_data[internalField] ?? '';
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // ▼▼▼ [수정] 다단계 경로 처리 - 평탄화된 키가 없는 경우에만 중첩 경로로 접근 (2025-11-29) ▼▼▼
    // 경로가 점으로 구분된 경우 (e.g., "Type.Attributes.Name", "PropertySet.Pset_WallCommon__LoadBearing")
    if (internalField.includes('.')) {
        const parts = internalField.split('.');
        let current = raw_data;

        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                current = undefined;
                break;
            }
        }

        if (current !== undefined && current !== null) {
            // 객체인 경우 JSON 문자열로 반환
            if (typeof current === 'object') {
                return JSON.stringify(current);
            }
            return current;
        }
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    if (internalField.startsWith('TypeParameters.')) {
        const subKey = internalField.substring(15);
        return raw_data.TypeParameters
            ? raw_data.TypeParameters[subKey] ?? ''
            : '';
    }
    if (raw_data.Parameters && internalField in raw_data.Parameters)
        return raw_data.Parameters[internalField] ?? '';
    return '';
}

const lowerValueCache = new Map(); // key: `${item.id}::${field}` -> value: string

function getLowerValueForItem(item, field) {
    const key = `${item?.id ?? ''}::${field}`;
    if (lowerValueCache.has(key)) return lowerValueCache.get(key);
    const v = (getValueForItem(item, field) ?? '').toString().toLowerCase();
    lowerValueCache.set(key, v);
    return v;
}

// [도우미] 필터 일치 검사
function matchesFilter(item, filters) {
    // filters: state.columnFilters (소문자 저장됨)
    for (const field in filters) {
        const needle = filters[field];
        if (!needle) continue;
        const hay = getLowerValueForItem(item, field);
        if (!hay.includes(needle) === true) return false;
    }
    return true;
}

function populateFieldSelection() {
    // 1. 수정 전, 현재 탭별로 체크된 필드 값을 미리 저장합니다.
    const getCheckedValues = (contextSelector) =>
        Array.from(
            document.querySelectorAll(
                `${contextSelector} .field-checkbox:checked`
            )
        ).map((cb) => cb.value);

    const dmCheckedFields = getCheckedValues('#data-management');
    const smCheckedFields = getCheckedValues('#space-management');

    // 2. 기존 로직: 컨테이너 탐색 및 키 계산 (이 부분은 동일합니다)
    const dmSystemContainer = document.getElementById('system-field-container');
    const dmRevitContainer = document.getElementById('revit-field-container');
    const smSystemContainer = document.getElementById(
        'sm-system-field-container'
    );
    const smRevitContainer = document.getElementById(
        'sm-revit-field-container'
    );

    if (allRevitData.length === 0) return;

    const systemKeys = ['id', 'element_unique_id', 'geometry_volume', 'classification_tags'];
    const revitKeysSet = new Set();
    allRevitData.forEach((item) => {
        const raw = item.raw_data;
        if (raw) {
            if (raw.Parameters)
                Object.keys(raw.Parameters).forEach((k) => revitKeysSet.add(k));
            if (raw.TypeParameters)
                Object.keys(raw.TypeParameters).forEach((k) =>
                    revitKeysSet.add(`TypeParameters.${k}`)
                );
            Object.keys(raw).forEach((k) => {
                if (k !== 'Parameters' && k !== 'TypeParameters')
                    revitKeysSet.add(k);
            });
        }
    });
    const sortedRevitKeys = Array.from(revitKeysSet).sort();

    // 3. 기존 로직: UI를 다시 그립니다 (innerHTML 덮어쓰기) - 표시명 적용
    const fillContainers = (sysContainer, revContainer) => {
        if (!sysContainer || !revContainer) return;
        sysContainer.innerHTML = systemKeys
            .map((k) => {
                const displayName = getDisplayFieldName(k);
                return `<label><input type="checkbox" class="field-checkbox" value="${displayName}"> ${displayName}</label>`;
            })
            .join('');
        revContainer.innerHTML = sortedRevitKeys
            .map((k) => {
                const displayName = getDisplayFieldName(k);
                return `<label><input type="checkbox" class="field-checkbox" value="${displayName}"> ${displayName}</label>`;
            })
            .join('');
    };

    fillContainers(dmSystemContainer, dmRevitContainer);
    fillContainers(smSystemContainer, smRevitContainer);

    // 4. 추가된 로직: 저장해두었던 값으로 체크 상태를 복원합니다.
    const restoreCheckedState = (contextSelector, checkedValues) => {
        checkedValues.forEach((value) => {
            // CSS.escape()를 사용하여 특수문자가 포함된 값도 안전하게 처리합니다.
            const checkbox = document.querySelector(
                `${contextSelector} .field-checkbox[value="${CSS.escape(
                    value
                )}"]`
            );
            if (checkbox) checkbox.checked = true;
        });
    };

    restoreCheckedState('#data-management', dmCheckedFields);
    restoreCheckedState('#space-management', smCheckedFields);

    // ▼▼▼ [추가] 기본값으로 BIM.System.id 체크 (처음 로드 시에만) ▼▼▼
    if (dmCheckedFields.length === 0 && smCheckedFields.length === 0) {
        // 아무것도 체크되지 않은 경우 (첫 로드)
        const defaultCheckbox = document.querySelector(
            '#data-management .field-checkbox[value="BIM.System.id"]'
        );
        if (defaultCheckbox) {
            defaultCheckbox.checked = true;
        }
    }

    // ▼▼▼ [추가] 체크박스 실시간 변경 이벤트 리스너 ▼▼▼
    const attachCheckboxListeners = (contextSelector, tableContainerId, contextPrefix) => {
        const checkboxes = document.querySelectorAll(`${contextSelector} .field-checkbox`);
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                // 체크박스 변경 시 즉시 테이블 업데이트
                renderDataTable(tableContainerId, contextPrefix);
            });
        });
    };

    attachCheckboxListeners('#data-management', 'data-management-data-table-container', 'data-management');
    attachCheckboxListeners('#space-management', 'space-management-data-table-container', 'space-management');
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // 5. 기존 로직: 모든 그룹핑 드롭다운 메뉴를 업데이트합니다 - 표시명 적용
    const allKeysDisplayNames = [...systemKeys, ...sortedRevitKeys]
        .map(k => getDisplayFieldName(k))
        .sort();
    const allGroupBySelects = document.querySelectorAll('.group-by-select');
    let optionsHtml =
        '<option value="">-- 필드 선택 --</option>' +
        allKeysDisplayNames
            .map((displayName) => `<option value="${displayName}">${displayName}</option>`)
            .join('');
    allGroupBySelects.forEach((select) => {
        const selectedValue = select.value;
        select.innerHTML = optionsHtml;
        select.value = selectedValue;
    });
}

function addGroupingLevel(contextPrefix) {
    const container = document.getElementById(
        `${contextPrefix}-grouping-controls`
    );
    if (!container) return;

    const newIndex = container.children.length + 1;
    const newLevelDiv = document.createElement('div');
    newLevelDiv.className = 'group-level';
    newLevelDiv.innerHTML = `
        <label>${newIndex}차:</label>
        <select class="group-by-select"></select>
        <button class="remove-group-level-btn">-</button>
    `;
    container.appendChild(newLevelDiv);

    populateFieldSelection();

    newLevelDiv
        .querySelector('.remove-group-level-btn')
        .addEventListener('click', function () {
            this.parentElement.remove();
            renderDataTable(
                `${contextPrefix}-data-table-container`,
                contextPrefix
            );
        });
}

function renderDataTable(containerId, contextPrefix) {
    const tableContainer = document.getElementById(containerId);
    if (!tableContainer) return;

    if (allRevitData.length === 0) {
        tableContainer.innerHTML = '표시할 데이터가 없습니다.';
        return;
    }

    const state = viewerStates[contextPrefix];
    if (!state) return;

    const fieldCheckboxSelector =
        contextPrefix === 'data-management'
            ? '#fields .field-checkbox:checked'
            : '#sm-fields .field-checkbox:checked';

    const selectedFields = Array.from(
        document.querySelectorAll(fieldCheckboxSelector)
    ).map((cb) => cb.value);

    if (selectedFields.length === 0) {
        tableContainer.innerHTML = '표시할 필드를 하나 이상 선택하세요.';
        return;
    }

    if (state.activeView === 'raw-data-view') {
        renderRawDataTable(containerId, selectedFields, state);
    } else if (state.activeView === 'classification-view') {
        renderClassificationTable(containerId, selectedFields, state);
    }
}

function renderRawDataTable(containerId, selectedFields, state) {
    const tableContainer = document.getElementById(containerId);
    if (!tableContainer) return;

    const dataToRender = state.isFilterToSelectionActive
        ? allRevitData.filter((item) => state.revitFilteredIds.has(item.id))
        : allRevitData;

    const filteredData = dataToRender.filter((item) =>
        matchesFilter(item, state.columnFilters)
    );

    // 그룹핑 필드 수집
    const contextPrefix = containerId.includes('data-management')
        ? 'data-management'
        : 'schematic-estimation';
    const groupingControlsContainer = document.getElementById(
        `${contextPrefix}-grouping-controls`
    );
    const groupBySelects = groupingControlsContainer
        ? groupingControlsContainer.querySelectorAll('.group-by-select')
        : [];
    const currentGroupByFields = Array.from(groupBySelects)
        .map((s) => s.value)
        .filter(Boolean);

    // 기존처럼 전체 문자열을 만들지 말고, DOM을 점진적으로 구성
    tableContainer.innerHTML = '';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');

    // 머리글 + 필터 입력 상자
    selectedFields.forEach((field) => {
        const th = document.createElement('th');
        const label = document.createElement('div');
        label.textContent = field;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'column-filter';
        input.dataset.field = field;
        input.value = state.columnFilters[field] || '';
        input.placeholder = '필터...';

        th.appendChild(label);
        th.appendChild(input);
        tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    tableContainer.appendChild(table);

    // 그룹핑이 없으면 행만 배치 추가
    if (currentGroupByFields.length === 0) {
        const BATCH = 1000; // 환경에 맞춰 500~1500 사이로 조절
        let i = 0;

        function appendBatch() {
            const frag = document.createDocumentFragment();
            for (let c = 0; c < BATCH && i < filteredData.length; c++, i++) {
                const item = filteredData[i];
                const row = document.createElement('tr');
                row.dataset.dbId = item.id;
                if (state.selectedElementIds.has(item.id))
                    row.classList.add('selected-row');
                row.style.cursor = 'pointer';

                selectedFields.forEach((field) => {
                    const td = document.createElement('td');
                    td.textContent = getValueForItem(item, field);
                    frag.appendChild(td); // <- 실수 방지: td는 row에 붙여야 함
                    row.appendChild(td);
                });
                frag.appendChild(row);
            }
            tbody.appendChild(frag);
            if (i < filteredData.length) {
                requestAnimationFrame(appendBatch);
            }
        }
        requestAnimationFrame(appendBatch);
        return;
    }

    // 그룹핑이 있는 경우: 그룹 헤더/자식도 프레임 분할로 추가
    // 그룹 트리 구성
    function groupItems(items, level) {
        if (level >= currentGroupByFields.length) return { __leaf__: items };
        const field = currentGroupByFields[level];
        const map = {};
        for (const it of items) {
            const key = getValueForItem(it, field) || '(값 없음)';
            (map[key] ??= []).push(it);
        }
        const result = {};
        // 정렬 유지
        Object.keys(map)
            .sort()
            .forEach((k) => {
                result[k] = groupItems(map[k], level + 1);
            });
        return result;
    }

    const root = groupItems(filteredData, 0);
    const tasks = []; // 렌더 작업 큐 (헤더/행 생성 단위)

    function enqueueGroup(node, level, parentPath) {
        if (node['__leaf__']) {
            for (const item of node['__leaf__']) {
                tasks.push(() => {
                    const row = document.createElement('tr');
                    row.dataset.dbId = item.id;
                    if (state.selectedElementIds.has(item.id))
                        row.classList.add('selected-row');
                    row.style.cursor = 'pointer';
                    selectedFields.forEach((field) => {
                        const td = document.createElement('td');
                        td.textContent = getValueForItem(item, field);
                        row.appendChild(td);
                    });
                    tbody.appendChild(row);
                });
            }
            return;
        }

        Object.keys(node).forEach((key) => {
            const groupField = currentGroupByFields[level];
            const currentPath = `${parentPath}|${groupField}:${key}`;
            const isCollapsed = !!state.collapsedGroups[currentPath];

            tasks.push(() => {
                const indentPixels = level * 20;
                const headerRow = document.createElement('tr');
                headerRow.className = `group-header group-level-${level}`;
                headerRow.dataset.groupPath = currentPath;

                const td = document.createElement('td');
                td.colSpan = selectedFields.length;
                td.style.paddingLeft = `${indentPixels}px`;

                const icon = document.createElement('span');
                icon.className = 'toggle-icon';
                icon.textContent = isCollapsed ? '▶' : '▼';

                td.appendChild(icon);
                td.appendChild(
                    document.createTextNode(` ${groupField}: ${key}`)
                );
                headerRow.appendChild(td);
                tbody.appendChild(headerRow);
            });

            if (!isCollapsed) enqueueGroup(node[key], level + 1, currentPath);
        });
    }

    enqueueGroup(root, 0, '');

    // 프레임 분할로 작업 수행
    const STEP = 800; // 한 프레임에 처리할 작업 수 (환경/데이터에 맞춰 조절)
    let idx = 0;
    function runChunk() {
        for (let c = 0; c < STEP && idx < tasks.length; c++, idx++) {
            tasks[idx]();
        }
        if (idx < tasks.length) requestAnimationFrame(runChunk);
    }
    requestAnimationFrame(runChunk);
}

function renderClassificationTable(containerId, selectedFields, state) {
    const tableContainer = document.getElementById(containerId);
    if (!tableContainer) return;

    let dataToRender = state.isFilterToSelectionActive
        ? allRevitData.filter((item) => state.revitFilteredIds.has(item.id))
        : allRevitData;

    const contextPrefix = containerId.includes('data-management')
        ? 'data-management'
        : 'schematic-estimation';
    const groupingControlsContainer = document.getElementById(
        `${contextPrefix}-grouping-controls`
    );
    const groupBySelects = groupingControlsContainer
        ? groupingControlsContainer.querySelectorAll('.group-by-select')
        : [];
    const currentGroupByFields = Array.from(groupBySelects)
        .map((s) => s.value)
        .filter(Boolean);

    const dataByTag = {};
    dataToRender.forEach((item) => {
        const tags = item.classification_tags;
        if (tags && tags.length > 0) {
            tags.forEach((tag) => {
                if (!dataByTag[tag]) dataByTag[tag] = [];
                dataByTag[tag].push(item);
            });
        } else {
            if (!dataByTag['(분류 없음)']) dataByTag['(분류 없음)'] = [];
            dataByTag['(분류 없음)'].push(item);
        }
    });

    let tableHtml = '<table><thead><tr>';
    selectedFields.forEach((field) => {
        tableHtml += `<th>${field}<br><input type="text" class="column-filter" data-field="${field}" value="${
            state.columnFilters[field] || ''
        }" placeholder="필터..."></th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    function renderSubGroup(items, level, parentPath) {
        if (level >= currentGroupByFields.length || items.length === 0) {
            items.forEach((item) => {
                tableHtml += `<tr data-db-id="${item.id}" class="${
                    state.selectedElementIds.has(item.id) ? 'selected-row' : ''
                }" style="cursor: pointer;">`;
                selectedFields.forEach(
                    (field) =>
                        (tableHtml += `<td>${getValueForItem(
                            item,
                            field
                        )}</td>`)
                );
                tableHtml += '</tr>';
            });
            return;
        }

        const groupField = currentGroupByFields[level];
        const grouped = items.reduce((acc, item) => {
            const key = getValueForItem(item, groupField) || '(값 없음)';
            (acc[key] = acc[key] || []).push(item);
            return acc;
        }, {});

        Object.keys(grouped)
            .sort()
            .forEach((key) => {
                const currentPath = `${parentPath}|${groupField}:${key}`;
                const isCollapsed = state.collapsedGroups[currentPath];
                const indentPixels = 20 + level * 20;

                tableHtml += `<tr class="group-header group-level-${
                    level + 1
                }" data-group-path="${currentPath}">
                            <td colspan="${
                                selectedFields.length
                            }" style="padding-left: ${indentPixels}px;">
                                <span class="toggle-icon">${
                                    isCollapsed ? '▶' : '▼'
                                }</span>
                                ${groupField}: ${key} (${grouped[key].length}개)
                            </td>
                          </tr>`;

                if (!isCollapsed) {
                    renderSubGroup(grouped[key], level + 1, currentPath);
                }
            });
    }

    Object.keys(dataByTag)
        .sort()
        .forEach((tag) => {
            const items = dataByTag[tag].filter((item) =>
                matchesFilter(item, state.columnFilters)
            );

            if (items.length === 0) return;

            const groupPath = `tag|${tag}`;
            const isCollapsed = state.collapsedGroups[groupPath];

            tableHtml += `<tr class="group-header group-level-0" data-group-path="${groupPath}">
                        <td colspan="${selectedFields.length}">
                            <span class="toggle-icon">${
                                isCollapsed ? '▶' : '▼'
                            }</span>
                            분류: ${tag} (${items.length}개)
                        </td>
                      </tr>`;

            if (!isCollapsed) {
                renderSubGroup(items, 0, groupPath);
            }
        });

    tableHtml += '</tbody></table>';
    tableContainer.innerHTML = tableHtml;
}

function updateTagLists(tags) {
    const tagListDiv = document.getElementById('tag-list');
    const tagAssignSelect = document.getElementById('tag-assign-select');
    tagListDiv.innerHTML = tags
        .map(
            (tag) => `
        <div>
            <span>${tag.name}</span>
            <div class="tag-actions">
                <button class="rename-tag-btn" data-id="${tag.id}" data-name="${tag.name}">수정</button>
                <button class="delete-tag-btn" data-id="${tag.id}">삭제</button>
            </div>
        </div>
    `
        )
        .join('');
    if (tagAssignSelect) {
        let optionsHtml = '<option value="">-- 적용할 분류 선택 --</option>';
        tags.forEach((tag) => {
            optionsHtml += `<option value="${tag.id}">${tag.name}</option>`;
        });
        tagAssignSelect.innerHTML = optionsHtml;
    }
}

// [수정] 토스트를 상단 상태바로 통합
const statusQueue = [];
let statusTimeout = null;
let previousStatusMessage = '준비됨';
let previousStatusClass = '';

function processStatusQueue() {
    if (statusQueue.length === 0) {
        return;
    }

    const statusData = statusQueue.shift();
    const statusEl = document.getElementById('status');

    if (!statusEl) {
        console.warn('[showToast] Status element not found');
        return;
    }

    // 이전 타임아웃 취소
    if (statusTimeout) {
        clearTimeout(statusTimeout);
        statusTimeout = null;
    }

    // 현재 상태를 이전 상태로 저장 (WebSocket이 업데이트한 내용 유지)
    if (statusQueue.length === 0 || !statusTimeout) {
        previousStatusMessage = statusEl.textContent;
        previousStatusClass = statusEl.className;
    }

    // 상태 메시지 표시
    statusEl.textContent = statusData.message;

    // type에 따라 클래스 추가
    statusEl.className = 'status-' + statusData.type;

    // 지정된 시간 후 다음 메시지 표시 또는 이전 상태로 복원
    statusTimeout = setTimeout(() => {
        if (statusQueue.length > 0) {
            processStatusQueue();
        } else {
            // 큐가 비어있으면 이전 메시지로 복원 (WebSocket 메시지 유지)
            statusEl.textContent = previousStatusMessage;
            statusEl.className = previousStatusClass;
        }
        statusTimeout = null;
    }, statusData.duration);
}

function showToast(message, type = 'info', duration = 3000) {
    // [수정] 상단 상태바에 메시지 표시
    statusQueue.push({ message, type, duration });
    processStatusQueue();
}

function renderClassificationRulesetTable(rules, editingRuleId = null) {
    const container = document.querySelector(
        '#classification-ruleset .ruleset-table-container'
    );
    if (!currentProjectId) {
        container.innerHTML = '<p>프로젝트를 선택하고 규칙을 추가하세요.</p>';
        return;
    }

    const tagOptions = Array.from(
        document.querySelectorAll('#tag-assign-select option')
    )
        .filter((opt) => opt.value)
        .map((opt) => `<option value="${opt.value}">${opt.text}</option>`)
        .join('');

    let tableHtml = `
        <table class="ruleset-table">
            <thead>
                <tr>
                    <th style="width: 25%;">이름</th>
                    <th style="width: 20%;">대상 분류</th>
                    <th style="width: 40%;">적용 조건</th>
                    <th style="width: 15%;">작업</th>
                </tr>
            </thead>
            <tbody>
    `;

    const renderRow = (rule) => {
        if (rule.id === editingRuleId) {
            // 편집 모드
            // 조건 빌더 UI 생성
            const conditions = rule.conditions || [];
            let conditionsHtml = '<div class="conditions-builder" style="max-height: 300px; overflow-y: auto;">';

            conditions.forEach((cond, idx) => {
                conditionsHtml += renderConditionRowForRE(cond, idx);
            });

            conditionsHtml += `
                <button type="button" class="add-condition-btn" style="margin-top: 5px; padding: 5px 10px;">
                    + 조건 추가
                </button>
            </div>`;

            return `<tr class="rule-edit-row" data-rule-id="${rule.id}">
                <td><input type="text" class="rule-description-input" value="${rule.description || ''}" placeholder="룰셋 이름 입력"></td>
                <td><select class="rule-tag-select" style="width: 100%;">${rule.id === 'new' ? '<option value="">-- 분류 선택 --</option>' : ''}${tagOptions}</select></td>
                <td>${conditionsHtml}</td>
                <td>
                    <button class="save-rule-btn">💾 저장</button>
                    <button class="cancel-edit-btn">❌ 취소</button>
                </td>
            </tr>`;
        }

        // 읽기 전용 모드
        let conditionsDisplay = '';
        if (rule.conditions && rule.conditions.length > 0) {
            conditionsDisplay = rule.conditions.map(c =>
                `${c.parameter} ${c.operator} "${c.value}"`
            ).join('<br>');
        } else {
            conditionsDisplay = '<em>조건 없음</em>';
        }

        return `<tr data-rule-id="${rule.id}">
            <td>${rule.description}</td>
            <td>${rule.target_tag_name}</td>
            <td>${conditionsDisplay}</td>
            <td>
                <button class="edit-rule-btn">✏️ 수정</button>
                <button class="delete-rule-btn">🗑️ 삭제</button>
            </td>
        </tr>`;
    };

    // 기존 규칙들을 순회하며 행 생성
    rules.forEach((rule) => {
        tableHtml += renderRow(rule);
    });

    // 새 규칙 추가 행
    if (editingRuleId === 'new') {
        tableHtml += renderRow({ id: 'new', priority: 0, description: '', conditions: [] });
    }

    if (rules.length === 0 && editingRuleId !== 'new') {
        tableHtml +=
            '<tr><td colspan="4">정의된 규칙이 없습니다. 새 규칙을 추가하세요.</td></tr>';
    }

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;

    // 편집 모드일 때, select 요소의 현재 값을 설정
    if (editingRuleId && editingRuleId !== 'new') {
        const rule = rules.find((r) => r.id === editingRuleId);
        if (rule) {
            const selectElement = container.querySelector(
                `tr[data-rule-id="${rule.id}"] .rule-tag-select`
            );
            if (selectElement) selectElement.value = rule.target_tag_id;
        }
    }

    // 조건 빌더 리스너 설정
    setupConditionBuilderListeners();
}

/**
 * '수량산출부재' 데이터를 그룹핑, 필터링, 선택 상태를 반영하여 테이블로 렌더링합니다. (수량산출부재 뷰 전용)
 * @param {Array} members - 렌더링할 전체 수량산출부재 데이터
 * @param {String|null} editingMemberId - 현재 편집 중인 부재의 ID
 */
function renderRawQmTable(members, editingMemberId = null) {
    const container = document.getElementById('qm-table-container');
    if (!currentProjectId) {
        container.innerHTML = '<p>프로젝트를 선택하세요.</p>';
        return;
    }

    const getQmValue = (item, field) => {
        if (!field) return '';

        // ▼▼▼ [수정] 새로운 필드명 형식 지원 (BIM_System_id, QM_Properties_xxx 등) (2025-11-05) ▼▼▼
        // ▼▼▼ [수정] 점 표기법과 언더스코어 표기법 모두 지원 (2025-11-05) ▼▼▼
        // QM.System.* 필드
        if (field.startsWith('QM.System.') || field.startsWith('QM_System_')) {
            const fieldName = field.startsWith('QM.System.')
                ? field.substring(10)  // 'QM.System.' 제거
                : field.substring(10); // 'QM_System_' 제거

            // ▼▼▼ [추가] 특별 필드 매핑 (2025-11-13) ▼▼▼
            // classification_tag -> classification_tag_name
            if (fieldName === 'classification_tag') {
                return item.classification_tag_name ?? '';
            }
            // ▲▲▲ [추가] 여기까지 ▲▲▲

            return item[fieldName] ?? '';
        }

        // QM.Properties.* 필드
        if (field.startsWith('QM.Properties.') || field.startsWith('QM_Properties_')) {
            const propName = field.startsWith('QM.Properties.')
                ? field.substring(14)  // 'QM.Properties.' 제거
                : field.substring(14); // 'QM_Properties_' 제거
            return item.properties?.[propName] ?? '';
        }

        // MM.System.* 필드
        if (field.startsWith('MM.System.') || field.startsWith('MM_System_')) {
            const fieldName = field.startsWith('MM.System.')
                ? field.substring(10)  // 'MM.System.' 제거
                : field.substring(10); // 'MM_System_' 제거
            if (fieldName === 'mark') {
                return item.member_mark_mark ?? '';
            }
            return item[`member_mark_${fieldName}`] ?? '';
        }

        // MM.Properties.* 필드
        if (field.startsWith('MM.Properties.') || field.startsWith('MM_Properties_')) {
            const propName = field.startsWith('MM.Properties.')
                ? field.substring(14)  // 'MM.Properties.' 제거
                : field.substring(14); // 'MM_Properties_' 제거
            return item.member_mark_properties?.[propName] ?? '';
        }

        // SC.System.* 필드
        if (field.startsWith('SC.System.') || field.startsWith('SC_System_')) {
            const fieldName = field.startsWith('SC.System.')
                ? field.substring(10)  // 'SC.System.' 제거
                : field.substring(10); // 'SC_System_' 제거
            return item[`space_${fieldName}`] ?? '';
        }

        // BIM 속성 처리 (BIM.System.*, BIM.Attributes.*, BIM.Parameters.*, BIM.TypeParameters.* 및 언더스코어 표기법)
        if (field.startsWith('BIM.') || field.startsWith('BIM_')) {
            // raw_element 객체 가져오기
            const elementId = item.split_element_id || item.raw_element_id;
            if (!elementId) return '';

            const rawElement = allRevitData ? allRevitData.find(el => el.id === elementId) : null;
            if (!rawElement) return '';

            if (field.startsWith('BIM.System.') || field.startsWith('BIM_System_')) {
                const sysName = field.startsWith('BIM.System.')
                    ? field.substring(11)  // 'BIM.System.' 제거
                    : field.substring(11); // 'BIM_System_' 제거
                const value = rawElement[sysName];
                if (Array.isArray(value)) {
                    return value.join(', ');
                }
                return value ?? '';
            } else if (field.startsWith('BIM.Attributes.') || field.startsWith('BIM_Attributes_')) {
                const attrName = field.startsWith('BIM.Attributes.')
                    ? field.substring(15)  // 'BIM.Attributes.' 제거
                    : field.substring(15); // 'BIM_Attributes_' 제거
                return rawElement.raw_data?.[attrName] ?? '';
            } else if (field.startsWith('BIM.Parameters.') || field.startsWith('BIM_Parameters_')) {
                const paramName = field.startsWith('BIM.Parameters.')
                    ? field.substring(15)  // 'BIM.Parameters.' 제거
                    : field.substring(15); // 'BIM_Parameters_' 제거
                return rawElement.raw_data?.Parameters?.[paramName] ?? '';
            } else if (field.startsWith('BIM.TypeParameters.') || field.startsWith('BIM_TypeParameters_')) {
                const tparamName = field.startsWith('BIM.TypeParameters.')
                    ? field.substring(19)  // 'BIM.TypeParameters.' 제거
                    : field.substring(19); // 'BIM_TypeParameters_' 제거
                return rawElement.raw_data?.TypeParameters?.[tparamName] ?? '';
            }
            // ▼▼▼ [수정] QuantitySet, PropertySet 등 처리 (2025-11-05) ▼▼▼
            else if (field.startsWith('BIM.QuantitySet.') || field.startsWith('BIM_QuantitySet_')) {
                const qsName = field.startsWith('BIM.QuantitySet.')
                    ? field.substring(16)  // 'BIM.QuantitySet.' 제거
                    : field.substring(16); // 'BIM_QuantitySet_' 제거
                // raw_data에서 'QuantitySet.XXX' 형태로 저장된 키 찾기
                return rawElement.raw_data?.[`QuantitySet.${qsName}`] ?? '';
            } else if (field.startsWith('BIM.PropertySet.') || field.startsWith('BIM_PropertySet_')) {
                const psName = field.startsWith('BIM.PropertySet.')
                    ? field.substring(16)  // 'BIM.PropertySet.' 제거
                    : field.substring(16); // 'BIM_PropertySet_' 제거
                return rawElement.raw_data?.[`PropertySet.${psName}`] ?? '';
            } else if (field.startsWith('BIM.Spatial_Container.') || field.startsWith('BIM_Spatial_Container_')) {
                const scName = field.startsWith('BIM.Spatial_Container.')
                    ? field.substring(22)  // 'BIM.Spatial_Container.' 제거
                    : field.substring(22); // 'BIM_Spatial_Container_' 제거
                return rawElement.raw_data?.[`Spatial_Container.${scName}`] ?? '';
            } else if (field.startsWith('BIM.Type.') || field.startsWith('BIM_Type_')) {
                const typeName = field.startsWith('BIM.Type.')
                    ? field.substring(9)   // 'BIM.Type.' 제거
                    : field.substring(9);  // 'BIM_Type_' 제거
                return rawElement.raw_data?.[`Type.${typeName}`] ?? '';
            }
            // ▲▲▲ [수정] 여기까지 ▲▲▲
            return '';
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // 레거시 지원
        if (field.startsWith('qm_prop_')) {
            const propName = field.substring(8);
            return item.properties?.[propName] ?? '';
        }

        if (field === 'member_mark_mark') {
            return item.member_mark_mark ?? '';
        }

        if (field.startsWith('mm_prop_')) {
            const propName = field.substring(8);
            return item.member_mark_properties?.[propName] ?? '';
        }

        if (field.startsWith('BIM원본.')) {
            const key = field.substring(6);
            if (item.raw_element_id) {
                const rawElement = allRevitData.find(
                    (el) => el.id === item.raw_element_id
                );
                return rawElement ? getValueForItem(rawElement, key) : '';
            }
            return '';
        }

        if (field.startsWith('일람부호.')) {
            const key = field.substring(5);
            if (item.member_mark_id) {
                const mark = loadedMemberMarks.find(
                    (m) => m.id === item.member_mark_id
                );
                if (mark) {
                    if (key === 'Mark') {
                        return mark.mark;
                    }
                    return mark.properties?.[key] ?? '';
                }
            }
            return '';
        }

        if (field === 'mapping_expression') {
            const value = item[field];
            if (
                value &&
                typeof value === 'object' &&
                Object.keys(value).length > 0
            ) {
                return JSON.stringify(value);
            }
            return '';
        }
        return item[field] ?? '';
    };

    const filteredMembers = members.filter((member) =>
        Object.keys(qmColumnFilters).every((field) => {
            const filterValue = qmColumnFilters[field];
            return (
                !filterValue ||
                getQmValue(member, field)
                    .toString()
                    .toLowerCase()
                    .includes(filterValue)
            );
        })
    );

    currentQmGroupByFields = Array.from(
        document.querySelectorAll('#qm-grouping-controls .group-by-select')
    )
        .map((s) => s.value)
        .filter(Boolean);

    // currentQmColumns에서 표시할 필드 가져오기 (기본값 설정)
    const sortedFields = currentQmColumns && currentQmColumns.length > 0
        ? currentQmColumns
        : ['id', 'name', 'classification_tag_name', 'raw_element_id', 'is_active'];

    // 필드 라벨 가져오기 함수
    const getFieldLabel = (fieldKey) => {
        // ▼▼▼ [수정] 새로운 필드명 형식 지원 (언더스코어를 점으로 변환) (2025-11-05) ▼▼▼
        // 새로운 형식: QM_System_id -> QM.System.id
        if (fieldKey.includes('_')) {
            // BIM_, QM_, MM_, SC_, CI_, CC_ 등으로 시작하는 경우
            if (/^(BIM|QM|MM|SC|CI|CC|AO|AC)_/.test(fieldKey)) {
                return fieldKey.replace(/_/g, '.');
            }
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // 레거시 필드 라벨
        const qmFieldLabels = {
            'id': 'QM.System.id',
            'name': 'QM.System.name',
            'classification_tag_name': 'QM.System.classification_tag',
            'raw_element_id': 'QM.System.raw_element_id',
            'is_active': 'QM.System.is_active',
            'member_mark_name': 'QM.System.member_mark',
            'member_mark_mark': 'MM.System.mark',
            'space_name': 'SC.System.name',
            'properties': 'QM.Properties',
            'cost_codes': 'QM.System.cost_codes'
        };

        if (qmFieldLabels[fieldKey]) {
            return qmFieldLabels[fieldKey];
        }

        // 레거시 지원
        if (fieldKey.startsWith('qm_prop_')) {
            return `QM.Properties.${fieldKey.substring(8)}`;
        }

        if (fieldKey.startsWith('mm_prop_')) {
            return `MM.Properties.${fieldKey.substring(8)}`;
        }

        if (fieldKey.startsWith('bim_attr_')) {
            return `BIM.Attributes.${fieldKey.substring(9)}`;
        } else if (fieldKey.startsWith('bim_param_')) {
            return `BIM.Parameters.${fieldKey.substring(10)}`;
        } else if (fieldKey.startsWith('bim_tparam_')) {
            return `BIM.TypeParameters.${fieldKey.substring(11)}`;
        } else if (fieldKey.startsWith('bim_system_')) {
            return `BIM.System.${fieldKey.substring(11)}`;
        }

        return fieldKey;
    };

    // DOM을 사용한 테이블 생성 (BIM원본데이터 탭 스타일과 동일)
    container.innerHTML = '';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // 헤더 + 필터 입력 상자 생성
    sortedFields.forEach((field) => {
        const th = document.createElement('th');
        const label = document.createElement('div');
        label.textContent = getFieldLabel(field);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'column-filter';
        input.dataset.field = field;
        input.value = qmColumnFilters[field] || '';
        input.placeholder = '필터...';

        th.appendChild(label);
        th.appendChild(input);
        headerRow.appendChild(th);
    });

    // 작업 열 헤더
    const actionTh = document.createElement('th');
    actionTh.textContent = '작업';
    headerRow.appendChild(actionTh);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    container.appendChild(table);

    // 데이터가 없는 경우
    if (filteredMembers.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = sortedFields.length + 1;
        emptyCell.textContent = '표시할 데이터가 없습니다.';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
    }

    // 그룹핑이 없는 경우: 배치 렌더링
    if (currentQmGroupByFields.length === 0) {
        const BATCH = 500;
        let i = 0;

        function appendBatch() {
            const frag = document.createDocumentFragment();
            for (let c = 0; c < BATCH && i < filteredMembers.length; c++, i++) {
                const m = filteredMembers[i];
                const row = createQmRow(m, sortedFields, getQmValue, editingMemberId);
                frag.appendChild(row);
            }
            tbody.appendChild(frag);
            if (i < filteredMembers.length) {
                requestAnimationFrame(appendBatch);
            }
        }
        requestAnimationFrame(appendBatch);
        return;
    }

    // 그룹핑이 있는 경우: 그룹 트리 구성
    function groupItems(items, level) {
        if (level >= currentQmGroupByFields.length) return { __leaf__: items };
        const field = currentQmGroupByFields[level];
        const map = {};
        for (const it of items) {
            const key = getQmValue(it, field) || '(값 없음)';
            (map[key] ??= []).push(it);
        }
        const result = {};
        Object.keys(map)
            .sort()
            .forEach((k) => {
                result[k] = groupItems(map[k], level + 1);
            });
        return result;
    }

    const root = groupItems(filteredMembers, 0);
    const tasks = [];

    function enqueueGroup(node, level, parentPath) {
        if (node['__leaf__']) {
            for (const m of node['__leaf__']) {
                tasks.push(() => {
                    const row = createQmRow(m, sortedFields, getQmValue, editingMemberId);
                    tbody.appendChild(row);
                });
            }
            return;
        }

        Object.keys(node).forEach((key) => {
            const groupField = currentQmGroupByFields[level];
            const currentPath = `${parentPath}|${groupField}:${key}`;
            const isCollapsed = !!qmCollapsedGroups[currentPath];

            tasks.push(() => {
                const indentPixels = level * 20;
                const headerRow = document.createElement('tr');
                headerRow.className = `group-header group-level-${level}`;
                headerRow.dataset.groupPath = currentPath;

                const td = document.createElement('td');
                td.colSpan = sortedFields.length + 1;
                td.style.paddingLeft = `${indentPixels}px`;

                const icon = document.createElement('span');
                icon.className = 'toggle-icon';
                icon.textContent = isCollapsed ? '▶' : '▼';

                td.appendChild(icon);
                td.appendChild(
                    document.createTextNode(` ${groupField}: ${key} (${countItems(node[key])}개)`)
                );
                headerRow.appendChild(td);
                tbody.appendChild(headerRow);
            });

            if (!isCollapsed) enqueueGroup(node[key], level + 1, currentPath);
        });
    }

    // 그룹 내 항목 개수 세기
    function countItems(node) {
        if (node['__leaf__']) return node['__leaf__'].length;
        let count = 0;
        Object.values(node).forEach((child) => {
            count += countItems(child);
        });
        return count;
    }

    enqueueGroup(root, 0, '');

    // 프레임 분할로 작업 수행
    const STEP = 500;
    let idx = 0;
    function runChunk() {
        for (let c = 0; c < STEP && idx < tasks.length; c++, idx++) {
            tasks[idx]();
        }
        if (idx < tasks.length) requestAnimationFrame(runChunk);
    }
    requestAnimationFrame(runChunk);
}

// QM 행 생성 헬퍼 함수
function createQmRow(m, sortedFields, getQmValue, editingMemberId) {
    const row = document.createElement('tr');
    row.dataset.id = m.id;

    if (m.id === editingMemberId) {
        // 편집 모드 행
        row.className = 'qm-edit-row';

        // 편집 가능한 필드들을 생성
        sortedFields.forEach((field) => {
            const td = document.createElement('td');

            if (field === 'name') {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'qm-name-input';
                input.value = m.name || '';
                td.appendChild(input);
            } else if (field === 'classification_tag_name') {
                const select = document.createElement('select');
                select.className = 'qm-tag-select';

                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = '-- 분류 없음 --';
                select.appendChild(emptyOption);

                allTags.forEach((opt) => {
                    const option = document.createElement('option');
                    option.value = opt.id;
                    option.textContent = opt.name;
                    if (opt.id == m.classification_tag_id) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });

                td.appendChild(select);
            } else if (field === 'properties') {
                const container = document.createElement('div');

                // 맵핑식
                const mappingDiv = document.createElement('div');
                mappingDiv.style.marginBottom = '5px';
                const mappingLabel = document.createElement('small');
                mappingLabel.style.fontWeight = 'bold';
                mappingLabel.textContent = '맵핑식 (JSON):';
                const mappingTextarea = document.createElement('textarea');
                mappingTextarea.className = 'qm-mapping-expression-input';
                mappingTextarea.rows = 3;
                mappingTextarea.placeholder = '{}';
                mappingTextarea.value = JSON.stringify(m.mapping_expression || {}, null, 2);
                mappingDiv.appendChild(mappingLabel);
                mappingDiv.appendChild(mappingTextarea);
                container.appendChild(mappingDiv);

                // 일람부호 룰
                const markDiv = document.createElement('div');
                markDiv.style.marginBottom = '5px';
                const markLabel = document.createElement('small');
                markLabel.style.fontWeight = 'bold';
                markLabel.textContent = '개별 일람부호 룰:';
                const markInput = document.createElement('input');
                markInput.type = 'text';
                markInput.className = 'qm-mark-expr-input';
                markInput.value = m.member_mark_expression || '';
                markInput.placeholder = "'C' + {층}";
                markDiv.appendChild(markLabel);
                markDiv.appendChild(markInput);
                container.appendChild(markDiv);

                // 공사코드 룰
                const ccDiv = document.createElement('div');
                const ccLabel = document.createElement('small');
                ccLabel.style.fontWeight = 'bold';
                ccLabel.textContent = '개별 공사코드 룰 (JSON):';
                const ccTextarea = document.createElement('textarea');
                ccTextarea.className = 'qm-cc-expr-input';
                ccTextarea.rows = 3;
                ccTextarea.value = JSON.stringify(m.cost_code_expressions || [], null, 2);
                ccDiv.appendChild(ccLabel);
                ccDiv.appendChild(ccTextarea);
                container.appendChild(ccDiv);

                td.appendChild(container);
            } else {
                td.textContent = getQmValue(m, field);
            }

            row.appendChild(td);
        });

        // 작업 버튼 셀
        const actionTd = document.createElement('td');
        actionTd.style.verticalAlign = 'middle';
        actionTd.style.textAlign = 'center';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-qm-btn';
        saveBtn.dataset.id = m.id;
        saveBtn.textContent = '저장';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-qm-btn';
        cancelBtn.dataset.id = m.id;
        cancelBtn.textContent = '취소';

        actionTd.appendChild(saveBtn);
        actionTd.appendChild(document.createElement('br'));
        actionTd.appendChild(document.createElement('br'));
        actionTd.appendChild(cancelBtn);
        row.appendChild(actionTd);

    } else {
        // 일반 표시 모드 행
        if (selectedQmIds.has(m.id.toString())) {
            row.classList.add('selected-row');
        }
        row.style.cursor = 'pointer';

        sortedFields.forEach((field) => {
            const td = document.createElement('td');
            td.textContent = getQmValue(m, field);
            row.appendChild(td);
        });

        // 작업 버튼 셀
        const actionTd = document.createElement('td');

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-qm-btn';
        editBtn.dataset.id = m.id;
        editBtn.textContent = '수정';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-qm-btn';
        deleteBtn.dataset.id = m.id;
        deleteBtn.textContent = '삭제';

        actionTd.appendChild(editBtn);
        actionTd.appendChild(document.createTextNode(' '));
        actionTd.appendChild(deleteBtn);
        row.appendChild(actionTd);
    }

    return row;
}

/**
 * '공사코드별 뷰' 테이블을 렌더링합니다.
 * @param {Array} members - 렌더링할 전체 수량산출부재 데이터
 */
function renderCostCodeViewTable(members) {
    const container = document.getElementById('qm-table-container');
    if (!currentProjectId) {
        container.innerHTML = '<p>프로젝트를 선택하세요.</p>';
        return;
    }

    // getQmValue 함수 (renderRawQmTable과 동일)
    const getQmValue = (item, field) => {
        if (!field) return '';

        // ▼▼▼ [수정] 점 표기법과 언더스코어 표기법 모두 지원 (2025-11-05) ▼▼▼
        // QM.System.* 필드
        if (field.startsWith('QM.System.') || field.startsWith('QM_System_')) {
            const fieldName = field.startsWith('QM.System.')
                ? field.substring(10)  // 'QM.System.' 제거
                : field.substring(10); // 'QM_System_' 제거

            // ▼▼▼ [추가] 특별 필드 매핑 (2025-11-13) ▼▼▼
            // classification_tag -> classification_tag_name
            if (fieldName === 'classification_tag') {
                return item.classification_tag_name ?? '';
            }
            // ▲▲▲ [추가] 여기까지 ▲▲▲

            return item[fieldName] ?? '';
        }

        // QM.Properties.* 필드
        if (field.startsWith('QM.Properties.') || field.startsWith('QM_Properties_')) {
            const propName = field.startsWith('QM.Properties.')
                ? field.substring(14)  // 'QM.Properties.' 제거
                : field.substring(14); // 'QM_Properties_' 제거
            return item.properties?.[propName] ?? '';
        }

        // MM.System.* 필드
        if (field.startsWith('MM.System.') || field.startsWith('MM_System_')) {
            const fieldName = field.startsWith('MM.System.')
                ? field.substring(10)  // 'MM.System.' 제거
                : field.substring(10); // 'MM_System_' 제거
            if (fieldName === 'mark') {
                return item.member_mark_mark ?? '';
            }
            return item[`member_mark_${fieldName}`] ?? '';
        }

        // MM.Properties.* 필드
        if (field.startsWith('MM.Properties.') || field.startsWith('MM_Properties_')) {
            const propName = field.startsWith('MM.Properties.')
                ? field.substring(14)  // 'MM.Properties.' 제거
                : field.substring(14); // 'MM_Properties_' 제거
            return item.member_mark_properties?.[propName] ?? '';
        }

        // SC.System.* 필드
        if (field.startsWith('SC.System.') || field.startsWith('SC_System_')) {
            const fieldName = field.startsWith('SC.System.')
                ? field.substring(10)  // 'SC.System.' 제거
                : field.substring(10); // 'SC_System_' 제거
            return item[`space_${fieldName}`] ?? '';
        }

        // BIM 속성 처리 (BIM.System.*, BIM.Attributes.*, BIM.Parameters.*, BIM.TypeParameters.* 및 언더스코어 표기법)
        if (field.startsWith('BIM.') || field.startsWith('BIM_')) {
            // raw_element 객체 가져오기
            const elementId = item.split_element_id || item.raw_element_id;
            if (!elementId) return '';

            const rawElement = allRevitData ? allRevitData.find(el => el.id === elementId) : null;
            if (!rawElement) return '';

            if (field.startsWith('BIM.System.') || field.startsWith('BIM_System_')) {
                const sysName = field.startsWith('BIM.System.')
                    ? field.substring(11)  // 'BIM.System.' 제거
                    : field.substring(11); // 'BIM_System_' 제거
                const value = rawElement[sysName];
                if (Array.isArray(value)) {
                    return value.join(', ');
                }
                return value ?? '';
            } else if (field.startsWith('BIM.Attributes.') || field.startsWith('BIM_Attributes_')) {
                const attrName = field.startsWith('BIM.Attributes.')
                    ? field.substring(15)  // 'BIM.Attributes.' 제거
                    : field.substring(15); // 'BIM_Attributes_' 제거
                return rawElement.raw_data?.[attrName] ?? '';
            } else if (field.startsWith('BIM.Parameters.') || field.startsWith('BIM_Parameters_')) {
                const paramName = field.startsWith('BIM.Parameters.')
                    ? field.substring(15)  // 'BIM.Parameters.' 제거
                    : field.substring(15); // 'BIM_Parameters_' 제거
                return rawElement.raw_data?.Parameters?.[paramName] ?? '';
            } else if (field.startsWith('BIM.TypeParameters.') || field.startsWith('BIM_TypeParameters_')) {
                const tparamName = field.startsWith('BIM.TypeParameters.')
                    ? field.substring(19)  // 'BIM.TypeParameters.' 제거
                    : field.substring(19); // 'BIM_TypeParameters_' 제거
                return rawElement.raw_data?.TypeParameters?.[tparamName] ?? '';
            } else if (field.startsWith('BIM.QuantitySet.') || field.startsWith('BIM_QuantitySet_')) {
                const qsName = field.startsWith('BIM.QuantitySet.')
                    ? field.substring(16)  // 'BIM.QuantitySet.' 제거
                    : field.substring(16); // 'BIM_QuantitySet_' 제거
                return rawElement.raw_data?.[`QuantitySet.${qsName}`] ?? '';
            } else if (field.startsWith('BIM.PropertySet.') || field.startsWith('BIM_PropertySet_')) {
                const psName = field.startsWith('BIM.PropertySet.')
                    ? field.substring(16)  // 'BIM.PropertySet.' 제거
                    : field.substring(16); // 'BIM_PropertySet_' 제거
                return rawElement.raw_data?.[`PropertySet.${psName}`] ?? '';
            } else if (field.startsWith('BIM.Spatial_Container.') || field.startsWith('BIM_Spatial_Container_')) {
                const scName = field.startsWith('BIM.Spatial_Container.')
                    ? field.substring(22)  // 'BIM.Spatial_Container.' 제거
                    : field.substring(22); // 'BIM_Spatial_Container_' 제거
                return rawElement.raw_data?.[`Spatial_Container.${scName}`] ?? '';
            } else if (field.startsWith('BIM.Type.') || field.startsWith('BIM_Type_')) {
                const typeName = field.startsWith('BIM.Type.')
                    ? field.substring(9)   // 'BIM.Type.' 제거
                    : field.substring(9);  // 'BIM_Type_' 제거
                return rawElement.raw_data?.[`Type.${typeName}`] ?? '';
            }
            return '';
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // 레거시 지원
        // MM 속성 처리 (mm_prop_*, member_mark_mark)
        if (field === 'member_mark_mark') {
            return item.member_mark_mark ?? '';
        }
        if (field.startsWith('mm_prop_')) {
            const propName = field.substring(8); // 'mm_prop_' 제거
            return item.member_mark_properties?.[propName] ?? '';
        }

        if (field.startsWith('BIM원본.')) {
            const key = field.substring(6);
            const rawElement = item.raw_element_id
                ? allRevitData.find((el) => el.id === item.raw_element_id)
                : null;
            return rawElement ? getValueForItem(rawElement, key) : '';
        }
        if (field.startsWith('일람부호.')) {
            const key = field.substring(5);
            const mark = item.member_mark_id
                ? loadedMemberMarks.find((m) => m.id === item.member_mark_id)
                : null;
            if (mark)
                return key === 'Mark'
                    ? mark.mark
                    : mark.properties?.[key] ?? '';
            return '';
        }
        return item[field] ?? '';
    };

    const dataByCostCode = {};
    members.forEach((member) => {
        const codes = member.cost_code_ids;
        if (codes && codes.length > 0) {
            codes.forEach((codeId) => {
                const costCode = loadedCostCodes.find((c) => c.id === codeId);
                const codeName = costCode
                    ? `${costCode.code} - ${costCode.name}`
                    : `(알 수 없는 코드: ${codeId})`;
                if (!dataByCostCode[codeName]) dataByCostCode[codeName] = [];
                dataByCostCode[codeName].push(member);
            });
        } else {
            if (!dataByCostCode['(공사코드 없음)'])
                dataByCostCode['(공사코드 없음)'] = [];
            dataByCostCode['(공사코드 없음)'].push(member);
        }
    });

    currentQmGroupByFields = Array.from(
        document.querySelectorAll('#qm-grouping-controls .group-by-select')
    )
        .map((s) => s.value)
        .filter(Boolean);
    const displayedFields = [
        'name',
        'classification_tag_name',
        'raw_element_id',
    ]; // 공사코드 뷰에서는 공사코드 정보가 그룹 헤더에 있으므로 테이블에서는 제외

    let tableHtml = '<table><thead><tr>';
    displayedFields.forEach((field) => {
        tableHtml += `<th>${field}<br><input type="text" class="column-filter" data-field="${field}" value="${
            qmColumnFilters[field] || ''
        }" placeholder="필터..."></th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    // 재귀적으로 하위 그룹을 렌더링하는 함수 (renderClassificationTable과 유사)
    function renderSubGroup(items, level, parentPath) {
        if (level >= currentQmGroupByFields.length || items.length === 0) {
            items.forEach((item) => {
                tableHtml += `<tr data-id="${item.id}" class="${
                    selectedQmIds.has(item.id.toString()) ? 'selected-row' : ''
                }" style="cursor: pointer;">`;
                displayedFields.forEach(
                    (field) =>
                        (tableHtml += `<td>${getQmValue(item, field)}</td>`)
                );
                tableHtml += '</tr>';
            });
            return;
        }

        const groupField = currentQmGroupByFields[level];
        const grouped = items.reduce((acc, item) => {
            const key = getQmValue(item, groupField) || '(값 없음)';
            (acc[key] = acc[key] || []).push(item);
            return acc;
        }, {});

        Object.keys(grouped)
            .sort()
            .forEach((key) => {
                const currentPath = `${parentPath}|${groupField}:${key}`;
                const isCollapsed = qmCollapsedGroups[currentPath];
                const indentPixels = 20 + level * 20;

                tableHtml += `<tr class="group-header group-level-${
                    level + 1
                }" data-group-path="${currentPath}">
                            <td colspan="${
                                displayedFields.length
                            }" style="padding-left: ${indentPixels}px;">
                                <span class="toggle-icon">${
                                    isCollapsed ? '▶' : '▼'
                                }</span>
                                ${groupField}: ${key} (${grouped[key].length}개)
                            </td>
                          </tr>`;

                if (!isCollapsed) {
                    renderSubGroup(grouped[key], level + 1, currentPath);
                }
            });
    }

    Object.keys(dataByCostCode)
        .sort()
        .forEach((codeName) => {
            const items = dataByCostCode[codeName].filter((item) =>
                Object.keys(qmColumnFilters).every(
                    (field) =>
                        !qmColumnFilters[field] ||
                        getQmValue(item, field)
                            .toString()
                            .toLowerCase()
                            .includes(qmColumnFilters[field])
                )
            );
            if (items.length === 0) return;

            const groupPath = `costcode|${codeName}`;
            const isCollapsed = qmCollapsedGroups[groupPath];

            tableHtml += `<tr class="group-header group-level-0" data-group-path="${groupPath}">
                        <td colspan="${displayedFields.length}">
                            <span class="toggle-icon">${
                                isCollapsed ? '▶' : '▼'
                            }</span>
                            공사코드: ${codeName} (${items.length}개)
                        </td>
                      </tr>`;

            if (!isCollapsed) {
                renderSubGroup(items, 0, groupPath);
            }
        });

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
}

/**
 * 현재 활성화된 '수량산출부재' 탭의 뷰에 따라 적절한 렌더링 함수를 호출합니다.
 * @param {String|null} editingMemberId - 현재 편집 중인 부재의 ID
 */
function renderActiveQmView(editingMemberId = null) {
    // const editingId = editingMemberId || document.querySelector('#qm-table-container .qm-edit-row')?.dataset.id;

    // 필터링 적용: 선택 필터가 활성화되어 있으면 필터링된 데이터만 렌더링
    let dataToRender = loadedQuantityMembers;
    if (window.isQmFilterToSelectionActive && window.qmFilteredIds.size > 0) {
        dataToRender = loadedQuantityMembers.filter(qm => window.qmFilteredIds.has(qm.id));
    }

    if (activeQmView === 'quantity-member-view') {
        renderRawQmTable(dataToRender, editingMemberId);
    } else if (activeQmView === 'cost-code-view') {
        // 공사코드 뷰에서는 인라인 편집을 지원하지 않으므로 editingId를 무시합니다.
        renderCostCodeViewTable(dataToRender);
    }
}

// ▼▼▼ [수정] 이 함수를 아래 코드로 교체해주세요. ▼▼▼
function toggleQmGroup(groupPath) {
    qmCollapsedGroups[groupPath] = !qmCollapsedGroups[groupPath];
    renderActiveQmView();
}
/**
 * '수량산출부재' 데이터와 연관된 모든 속성을 분석하여 그룹핑 필드 목록을 동적으로 채웁니다.
 * generateQMPropertyOptions()를 사용하여 완전한 속성 상속 체계를 구현합니다.
 * @param {Array} members - 수량산출부재 데이터 배열
 */
function populateQmGroupingFields(members) {
    if (!members || members.length === 0) return;

    // ▼▼▼ [수정] generateQMPropertyOptions()를 사용하여 모든 속성 수집 (2025-11-13) ▼▼▼
    const propertyOptionGroups = generateQMPropertyOptions();
    const allFields = [];

    propertyOptionGroups.forEach(group => {
        group.options.forEach(opt => {
            allFields.push(opt.value);  // QM.System.id, BIM.Parameters.xxx 등
        });
    });

    const sortedFields = allFields.sort();
    const groupBySelects = document.querySelectorAll('.qm-group-by-select');
    let optionsHtml =
        '<option value="">-- 그룹핑 기준 선택 --</option>' +
        sortedFields
            .map((field) => `<option value="${field}">${field}</option>`)
            .join('');

    groupBySelects.forEach((select) => {
        const selectedValue = select.value;
        select.innerHTML = optionsHtml;
        select.value = selectedValue;
    });
    // ▲▲▲ [수정] 여기까지 ▲▲▲
}
/**
 * 선택된 수량산출부재의 속성을 테이블로 렌더링합니다.
 * 편집 모드일 경우, 속성을 직접 수정할 수 있는 UI를 제공합니다.
 * @param {String|null} editingMemberId - 현재 편집 중인 부재의 ID
 */
function renderQmPropertiesTable(editingMemberId = null) {
    const container = document.getElementById('qm-selected-properties-container');
    const actionsContainer = document.getElementById('qm-properties-actions');

    // container가 존재하지 않으면 함수 종료
    if (!container) {
        console.warn('[renderQmPropertiesTable] qm-selected-properties-container element not found');
        return;
    }

    // actionsContainer가 존재하는 경우에만 초기화
    if (actionsContainer) {
        actionsContainer.innerHTML = ''; // 액션 버튼 초기화
    }

    if (selectedQmIds.size !== 1) {
        container.innerHTML =
            '속성을 보려면 위 테이블에서 부재를 하나만 선택하세요.';
        return;
    }

    const selectedId = selectedQmIds.values().next().value;
    const member = loadedQuantityMembers.find(
        (m) => m.id.toString() === selectedId
    );

    if (!member) {
        container.innerHTML = '선택된 부재 정보를 찾을 수 없습니다.';
        return;
    }

    const isEditMode = editingMemberId && editingMemberId === selectedId;
    const properties = member.properties || {};

    let html = '';

    // 편집 모드가 아닐 때는 모든 속성 표시 (QM, MM, BIM 포함)
    if (!isEditMode) {
        // 기본 속성 (QM.)
        html += '<div class="property-section">';
        html += '<h4 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 5px;">📌 기본 속성</h4>';
        html += '<table class="properties-table"><tbody>';
        html += `<tr><td class="prop-name">QM.id</td><td class="prop-value">${member.id || 'N/A'}</td></tr>`;
        if (member.name) html += `<tr><td class="prop-name">QM.name</td><td class="prop-value">${member.name}</td></tr>`;
        if (member.classification_tag_name) html += `<tr><td class="prop-name">QM.classification_tag</td><td class="prop-value">${member.classification_tag_name}</td></tr>`;
        html += `<tr><td class="prop-name">QM.is_active</td><td class="prop-value">${member.is_active ? 'true' : 'false'}</td></tr>`;
        if (member.raw_element_id) html += `<tr><td class="prop-name">QM.raw_element_id</td><td class="prop-value">${member.raw_element_id}</td></tr>`;
        html += '</tbody></table></div>';

        // 부재 속성 (QM.properties.)
        if (Object.keys(properties).length > 0) {
            html += '<div class="property-section">';
            html += '<h4 style="color: #f57c00; border-bottom: 2px solid #f57c00; padding-bottom: 5px;">🔢 부재 속성</h4>';
            html += '<table class="properties-table"><tbody>';
            for (const [key, value] of Object.entries(properties)) {
                if (value !== null && value !== undefined) {
                    const displayValue = typeof value === 'number' ? value.toFixed(3) : value;
                    html += `<tr><td class="prop-name">QM.properties.${key}</td><td class="prop-value">${displayValue}</td></tr>`;
                }
            }
            html += '</tbody></table></div>';
        }

        // 일람부호 (MM.)
        if (member.member_mark_mark || (member.member_mark_properties && Object.keys(member.member_mark_properties).length > 0)) {
            html += '<div class="property-section">';
            html += '<h4 style="color: #7b1fa2; border-bottom: 2px solid #7b1fa2; padding-bottom: 5px;">📋 일람부호</h4>';
            html += '<table class="properties-table"><tbody>';
            if (member.member_mark_mark) html += `<tr><td class="prop-name">MM.mark</td><td class="prop-value">${member.member_mark_mark}</td></tr>`;
            if (member.member_mark_properties) {
                for (const [key, value] of Object.entries(member.member_mark_properties)) {
                    if (value !== null && value !== undefined) {
                        html += `<tr><td class="prop-name">MM.properties.${key}</td><td class="prop-value">${value}</td></tr>`;
                    }
                }
            }
            html += '</tbody></table></div>';
        }

        // BIM 원본 속성 - BIM원본데이터 탭의 renderBimPropertiesTable과 완전히 동일하게 표시
        // split_element_id를 우선적으로 확인하고, 없으면 raw_element_id 사용

        const elementId = member.split_element_id || member.raw_element_id;
        const fullBimObject = elementId && allRevitData ?
            allRevitData.find(item => item.id === elementId) : null;


        if (elementId && allRevitData) {
            // 디버깅: allRevitData에서 실제 ID 목록 출력
            const allIds = allRevitData.map(item => item.id).slice(0, 5);  // 처음 5개만
        }

        if (!fullBimObject) {
            if (elementId && allRevitData) {
                // 유사한 ID가 있는지 확인
                const similarIds = allRevitData.filter(item =>
                    item.id && item.id.toString().includes(elementId.substring(0, 8))
                );
            }
        }

        if (fullBimObject && fullBimObject.raw_data) {
            const rawData = fullBimObject.raw_data;

            // System Properties (Cost Estimator 관리 속성)
            html += '<div class="property-section">';
            html += '<h4>BIM 시스템 속성 (BIM.System.*)</h4>';
            html += '<table class="properties-table"><tbody>';

            const idDisplayName = getDisplayFieldName('id');
            const uniqueIdDisplayName = getDisplayFieldName('element_unique_id');
            const volumeDisplayName = getDisplayFieldName('geometry_volume');

            html += `<tr><td class="prop-name">${idDisplayName}</td><td class="prop-value">${fullBimObject.id || 'N/A'}</td></tr>`;
            html += `<tr><td class="prop-name">${uniqueIdDisplayName}</td><td class="prop-value">${fullBimObject.element_unique_id || 'N/A'}</td></tr>`;
            html += `<tr><td class="prop-name">${volumeDisplayName}</td><td class="prop-value">${fullBimObject.geometry_volume || 'N/A'}</td></tr>`;

            // classification_tags는 배열이므로 특별 처리
            const tagsDisplay = Array.isArray(fullBimObject.classification_tags) && fullBimObject.classification_tags.length > 0
                ? fullBimObject.classification_tags.join(', ')
                : 'N/A';
            html += `<tr><td class="prop-name">${getDisplayFieldName('classification_tags')}</td><td class="prop-value">${tagsDisplay}</td></tr>`;
            html += '</tbody></table>';
            html += '</div>';

            // Basic Information
            html += '<div class="property-section">';
            html += '<h4>BIM 기본 속성 (BIM.Attributes.*)</h4>';
            html += '<table class="properties-table"><tbody>';
            html += `<tr><td class="prop-name">${getDisplayFieldName('Name')}</td><td class="prop-value">${rawData.Name || 'N/A'}</td></tr>`;
            html += `<tr><td class="prop-name">${getDisplayFieldName('IfcClass')}</td><td class="prop-value">${rawData.IfcClass || 'N/A'}</td></tr>`;
            html += `<tr><td class="prop-name">${getDisplayFieldName('ElementId')}</td><td class="prop-value">${rawData.ElementId || 'N/A'}</td></tr>`;
            html += `<tr><td class="prop-name">${getDisplayFieldName('UniqueId')}</td><td class="prop-value">${rawData.UniqueId || 'N/A'}</td></tr>`;
            html += '</tbody></table>';
            html += '</div>';

            // Parameters - with detailed nested rendering
            if (rawData.Parameters && Object.keys(rawData.Parameters).length > 0) {
                html += '<div class="property-section">';
                html += '<h4>BIM 파라메터 (BIM.Parameters.*)</h4>';
                html += '<table class="properties-table"><tbody>';
                for (const [key, value] of Object.entries(rawData.Parameters)) {
                    // Skip Geometry parameter (too large)
                    if (key === 'Geometry') continue;

                    const displayName = getDisplayFieldName(key);
                    html += `<tr><td class="prop-name">${displayName}</td><td class="prop-value">`;
                    html += renderNestedValue(value, 1);
                    html += '</td></tr>';
                }
                html += '</tbody></table>';
                html += '</div>';
            }

            // TypeParameters
            if (rawData.TypeParameters && Object.keys(rawData.TypeParameters).length > 0) {
                html += '<div class="property-section">';
                html += '<h4>BIM 타입 파라메터 (BIM.TypeParameters.*)</h4>';
                html += '<table class="properties-table"><tbody>';
                for (const [key, value] of Object.entries(rawData.TypeParameters)) {
                    const displayName = getDisplayFieldName(`TypeParameters.${key}`);
                    html += `<tr><td class="prop-name">${displayName}</td><td class="prop-value">`;
                    html += renderNestedValue(value, 1);
                    html += '</td></tr>';
                }
                html += '</tbody></table>';
                html += '</div>';
            }

            // Relationships
            html += '<div class="property-section">';
            html += '<h4>Relationships</h4>';
            html += '<table class="properties-table"><tbody>';
            html += `<tr><td class="prop-name">${getDisplayFieldName('RelatingType')}</td><td class="prop-value">${rawData.RelatingType || 'N/A'}</td></tr>`;
            html += `<tr><td class="prop-name">${getDisplayFieldName('SpatialContainer')}</td><td class="prop-value">${rawData.SpatialContainer || 'N/A'}</td></tr>`;
            if (rawData.Aggregates) {
                html += `<tr><td class="prop-name">${getDisplayFieldName('Aggregates')}</td><td class="prop-value">${rawData.Aggregates}</td></tr>`;
            }
            if (rawData.Nests) {
                html += `<tr><td class="prop-name">${getDisplayFieldName('Nests')}</td><td class="prop-value">${rawData.Nests}</td></tr>`;
            }
            html += '</tbody></table>';
            html += '</div>';
        }

        // 공간 (Space)
        if (member.space_name) {
            html += '<div class="property-section">';
            html += '<h4 style="color: #388e3c; border-bottom: 2px solid #388e3c; padding-bottom: 5px;">📍 공간</h4>';
            html += '<table class="properties-table"><tbody>';
            html += `<tr><td class="prop-name">space</td><td class="prop-value">${member.space_name}</td></tr>`;
            html += '</tbody></table></div>';
        }

        // 공사코드 (Cost Codes)
        if (member.cost_codes && member.cost_codes.length > 0) {
            html += '<div class="property-section">';
            html += '<h4 style="color: #0288d1; border-bottom: 2px solid #0288d1; padding-bottom: 5px;">💰 할당된 공사코드</h4>';
            html += '<table class="properties-table"><tbody>';
            member.cost_codes.forEach(code => {
                html += `<tr><td class="prop-name">cost_code</td><td class="prop-value">${code}</td></tr>`;
            });
            html += '</tbody></table></div>';
        }

        container.innerHTML = html;
    } else {
        // 편집 모드: properties만 편집 가능 (기존 동작 유지)
        let tableHtml = `
            <table class="properties-table">
                <thead>
                    <tr>
                        <th>속성 (Property)</th>
                        <th>값 (Value)</th>
                        <th>작업</th>
                    </tr>
                </thead>
                <tbody>
        `;

        Object.keys(properties).sort().forEach((key) => {
            tableHtml += `
                <tr class="property-edit-row">
                    <td><input type="text" class="prop-key-input" value="${key}"></td>
                    <td><input type="text" class="prop-value-input" value="${properties[key]}"></td>
                    <td><button class="delete-prop-btn">삭제</button></td>
                </tr>
            `;
        });

        tableHtml += '</tbody></table>';
        container.innerHTML = tableHtml;

        if (actionsContainer) {
            actionsContainer.innerHTML = '<button id="add-property-btn">속성 추가</button>';
        }
    }
}

/**
 * '산출항목' 데이터를 그룹핑, 필터링, 선택 상태를 반영하여 테이블로 렌더링합니다.
 * @param {Array} items - 렌더링할 전체 산출항목 데이터
 * @param {String|null} editingItemId - 현재 편집 중인 항목의 ID
 */
function renderCostItemsTable(items, editingItemId = null) {
    items.slice(0, 2).forEach((item, idx) => {
        console.log(`  [${idx}]:`, {
            id: item.id,
            'Activity.code': item['Activity.code'],
            'Activity.name': item['Activity.name'],
            name: item.name || 'N/A',
            keys: Object.keys(item).filter(k => k.startsWith('Activity.'))
        });
    });

    const container = document.getElementById('ci-table-container');
    if (!currentProjectId) {
        container.innerHTML = '<p>프로젝트를 선택하세요.</p>';
        return;
    }

    // 필터링 적용: 선택 필터가 활성화되어 있으면 필터링된 데이터만 렌더링
    let dataToRender = items;
    if (window.isCiFilterToSelectionActive && window.ciFilteredIds && window.ciFilteredIds.size > 0) {
        dataToRender = items.filter(ci => window.ciFilteredIds.has(ci.id));
    }

    // [핵심 수정] 복합적인 필드 이름에 대한 값을 찾는 로직
    const getCiValue = (item, field) => {
        if (!field) return '';

        // ▼▼▼ [수정] 새로운 필드명 형식 지원 (언더스코어 형식과 점 형식 모두 지원) (2025-11-05) ▼▼▼
        // CI.System.* 필드 (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('CI.System.') || field.startsWith('CI_System_')) {
            const fieldName = field.startsWith('CI.System.')
                ? field.substring(10)  // 'CI.System.' 제거
                : field.substring(10); // 'CI_System_' 제거
            return item[fieldName] ?? '';
        }

        // QM.System.* 필드 (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('QM.System.') || field.startsWith('QM_System_')) {
            const fieldName = field.startsWith('QM.System.')
                ? field.substring(10)  // 'QM.System.' 제거
                : field.substring(10); // 'QM_System_' 제거
            // quantity_member_ 접두어가 붙은 필드로 접근
            return item[`quantity_member_${fieldName}`] ?? '';
        }

        // QM.Properties.* 필드 (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('QM.Properties.') || field.startsWith('QM_Properties_')) {
            const propName = field.startsWith('QM.Properties.')
                ? field.substring(14)  // 'QM.Properties.' 제거
                : field.substring(14); // 'QM_Properties_' 제거
            return item.quantity_member_properties?.[propName] ?? '';
        }

        // MM.System.* 필드 (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('MM.System.') || field.startsWith('MM_System_')) {
            const fieldName = field.startsWith('MM.System.')
                ? field.substring(10)  // 'MM.System.' 제거
                : field.substring(10); // 'MM_System_' 제거
            if (fieldName === 'mark') {
                return item.member_mark_mark ?? '';
            }
            return item[`member_mark_${fieldName}`] ?? '';
        }

        // MM.Properties.* 필드 (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('MM.Properties.') || field.startsWith('MM_Properties_')) {
            const propName = field.startsWith('MM.Properties.')
                ? field.substring(14)  // 'MM.Properties.' 제거
                : field.substring(14); // 'MM_Properties_' 제거
            return item.member_mark_properties?.[propName] ?? '';
        }

        // BIM.System.* 필드 (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('BIM.System.') || field.startsWith('BIM_System_')) {
            const sysName = field.startsWith('BIM.System.')
                ? field.substring(11)  // 'BIM.System.' 제거
                : field.substring(11); // 'BIM_System_' 제거
            return item[`raw_element_${sysName}`] ?? '';
        }

        // BIM.Attributes.* 필드 (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('BIM.Attributes.') || field.startsWith('BIM_Attributes_')) {
            const attrName = field.startsWith('BIM.Attributes.')
                ? field.substring(15)  // 'BIM.Attributes.' 제거
                : field.substring(15); // 'BIM_Attributes_' 제거
            return item.raw_element_properties?.[attrName] ?? '';
        }

        // BIM.Parameters.* 필드 (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('BIM.Parameters.') || field.startsWith('BIM_Parameters_')) {
            const paramName = field.startsWith('BIM.Parameters.')
                ? field.substring(15)  // 'BIM.Parameters.' 제거
                : field.substring(15); // 'BIM_Parameters_' 제거
            return item.raw_element_properties?.[paramName] ?? '';
        }

        // BIM.TypeParameters.* 필드 (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('BIM.TypeParameters.') || field.startsWith('BIM_TypeParameters_')) {
            const tparamName = field.startsWith('BIM.TypeParameters.')
                ? field.substring(19)  // 'BIM.TypeParameters.' 제거
                : field.substring(19); // 'BIM_TypeParameters_' 제거
            return item.raw_element_properties?.[tparamName] ?? '';
        }

        // ▼▼▼ [추가] BIM.QuantitySet.*, PropertySet.*, Spatial_Container.*, Type.* 지원 (2025-11-05) ▼▼▼
        // BIM.QuantitySet.* 필드 (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('BIM.QuantitySet.') || field.startsWith('BIM_QuantitySet_')) {
            const qsName = field.startsWith('BIM.QuantitySet.')
                ? field.substring(16)  // 'BIM.QuantitySet.' 제거
                : field.substring(16); // 'BIM_QuantitySet_' 제거
            return item.raw_element_properties?.[`QuantitySet.${qsName}`] ?? '';
        }

        // BIM.PropertySet.* 필드 (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('BIM.PropertySet.') || field.startsWith('BIM_PropertySet_')) {
            const psName = field.startsWith('BIM.PropertySet.')
                ? field.substring(16)  // 'BIM.PropertySet.' 제거
                : field.substring(16); // 'BIM_PropertySet_' 제거
            return item.raw_element_properties?.[`PropertySet.${psName}`] ?? '';
        }

        // BIM.Spatial_Container.* 필드 (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('BIM.Spatial_Container.') || field.startsWith('BIM_Spatial_Container_')) {
            const scName = field.startsWith('BIM.Spatial_Container.')
                ? field.substring(22)  // 'BIM.Spatial_Container.' 제거
                : field.substring(22); // 'BIM_Spatial_Container_' 제거
            return item.raw_element_properties?.[`Spatial_Container.${scName}`] ?? '';
        }

        // BIM.Type.* 필드 (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('BIM.Type.') || field.startsWith('BIM_Type_')) {
            const typeName = field.startsWith('BIM.Type.')
                ? field.substring(9)  // 'BIM.Type.' 제거
                : field.substring(9); // 'BIM_Type_' 제거
            return item.raw_element_properties?.[`Type.${typeName}`] ?? '';
        }
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        // CC.System.* 필드 (CostCode) (점 형식과 언더스코어 형식 모두 지원)
        if (field.startsWith('CC.System.') || field.startsWith('CC_System_')) {
            const fieldName = field.startsWith('CC.System.')
                ? field.substring(10)  // 'CC.System.' 제거
                : field.substring(10); // 'CC_System_' 제거
            // ▼▼▼ [수정] 'code' 필드는 'cost_code'에 직접 저장됨 (2025-11-05) ▼▼▼
            if (fieldName === 'code') {
                return item['cost_code'] ?? '';
            }
            // ▲▲▲ [수정] 여기까지 ▲▲▲
            return item[`cost_code_${fieldName}`] ?? '';
        }
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        // Activity.* 필드 (액티비티별 뷰에서 추가된 필드)
        if (field.startsWith('Activity.')) {
            return item[field] ?? '';
        }

        // 기존 필드 처리
        if (field === 'quantity_mapping_expression') {
            const value = item[field];
            return value &&
                typeof value === 'object' &&
                Object.keys(value).length > 0
                ? JSON.stringify(value)
                : '';
        }

        // 일반 필드 (CI, CostCode, QM 기본 필드 등)
        return item[field] ?? '';
    };

    const filteredItems = dataToRender.filter((item) =>
        Object.keys(window.ciColumnFilters || {}).every((field) => {
            const filterValue = window.ciColumnFilters[field];
            return (
                !filterValue ||
                getCiValue(item, field)
                    .toString()
                    .toLowerCase()
                    .includes(filterValue)
            );
        })
    );

    // ciGroupingLevels가 설정되어 있으면 우선 사용 (액티비티별 뷰 등)
    // 그렇지 않으면 DOM에서 읽어옴
    if (window.ciGroupingLevels && window.ciGroupingLevels.length > 0) {
        currentCiGroupByFields = window.ciGroupingLevels;
    } else {
        currentCiGroupByFields = Array.from(
            document.querySelectorAll('#ci-grouping-controls .group-by-select')
        )
            .map((s) => s.value)
            .filter(Boolean);
    }

    // window.currentCiColumns를 사용하거나, 없으면 기본값 사용
    const sortedFields = window.currentCiColumns && window.currentCiColumns.length > 0
        ? window.currentCiColumns
        : [
            'cost_code_name',
            'quantity',
            'quantity_mapping_expression',
            'quantity_member_id',
            'description',
        ];

    let tableHtml = '<table><thead><tr>';
    sortedFields.forEach((field) => {
        // window.allCiFields에서 label 찾기
        const fieldInfo = window.allCiFields?.find(f => f.key === field);
        const displayLabel = fieldInfo?.label || field;

        tableHtml += `<th>${displayLabel}<br><input type="text" class="ci-filter-input" data-field="${field}" value="${
            (window.ciColumnFilters && window.ciColumnFilters[field]) || ''
        }" placeholder="필터..."></th>`;
    });
    tableHtml += `<th>작업</th></tr></thead><tbody>`;

    function renderGroup(groupItems, level, parentPath) {
        if (level >= currentCiGroupByFields.length || groupItems.length === 0) {
            groupItems.forEach((item) => {
                if (item.id === editingItemId) {
                    // 편집 모드: description만 수정 가능 (quantity는 수동수량입력 버튼 사용)
                    const editableFields = ['description'];

                    tableHtml += `<tr class="ci-edit-row" data-id="${item.id}">`;

                    sortedFields.forEach(field => {
                        const value = getCiValue(item, field);

                        if (editableFields.includes(field)) {
                            // 수정 가능한 필드 (description만)
                            if (field === 'description') {
                                tableHtml += `<td><textarea data-field="${field}" rows="2" style="width: 100%;">${value}</textarea></td>`;
                            }
                        } else {
                            // 읽기 전용 필드
                            tableHtml += `<td style="background-color: #f5f5f5;">${value}</td>`;
                        }
                    });

                    tableHtml += `
                        <td>
                            <button class="save-ci-btn" data-id="${item.id}">저장</button>
                            <button class="cancel-ci-btn" data-id="${item.id}">취소</button>
                        </td>
                    </tr>`;
                } else {
                    tableHtml += `
                        <tr data-id="${item.id}" class="${
                        selectedCiIds.has(item.id.toString())
                            ? 'selected-row'
                            : ''
                    }" style="cursor: pointer;">
                            ${sortedFields
                                .map(
                                    (field) =>
                                        `<td>${getCiValue(item, field)}</td>`
                                )
                                .join('')}
                            <td>
                                <button class="edit-ci-btn" data-id="${
                                    item.id
                                }">수정</button>
                                <button class="delete-ci-btn" data-id="${
                                    item.id
                                }">삭제</button>
                                ${item.quantity_mapping_expression &&
                                  (item.quantity_mapping_expression.mode === 'direct' ||
                                   item.quantity_mapping_expression.mode === 'formula')
                                    ? `<button class="reset-manual-quantity-btn" data-id="${item.id}">수동입력 해제</button>`
                                    : ''}
                            </td>
                        </tr>`;
                }
            });
            return;
        }

        const groupField = currentCiGroupByFields[level];
        const grouped = groupItems.reduce((acc, item) => {
            const key = getCiValue(item, groupField) || '(값 없음)';
            (acc[key] = acc[key] || []).push(item);
            return acc;
        }, {});

        Object.keys(grouped)
            .sort()
            .forEach((key) => {
                const currentPath = `${parentPath}|${groupField}:${key}`;
                const isCollapsed = ciCollapsedGroups[currentPath];
                const indentPixels = level * 20;

                // 필드의 label 찾기
                const fieldInfo = window.allCiFields?.find(f => f.key === groupField);
                const displayLabel = fieldInfo?.label || groupField;

                tableHtml += `<tr class="group-header group-level-${level}" data-group-path="${currentPath}">
                            <td colspan="${
                                sortedFields.length + 1
                            }" style="padding-left: ${indentPixels}px;">
                                <span class="toggle-icon">${
                                    isCollapsed ? '▶' : '▼'
                                }</span>
                                ${displayLabel}: ${key} (${grouped[key].length}개)
                            </td>
                          </tr>`;

                if (!isCollapsed)
                    renderGroup(grouped[key], level + 1, currentPath);
            });
    }

    if (filteredItems.length === 0) {
        tableHtml += `<tr><td colspan="${
            sortedFields.length + 1
        }">표시할 데이터가 없습니다.</td></tr>`;
    } else {
        renderGroup(filteredItems, 0, '');
    }

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
}
/**
 * '산출항목' 데이터와 연관된 모든 속성을 분석하여 그룹핑 필드 목록을 동적으로 채웁니다.
 * @param {Array} items - API에서 받은 풍부한 산출항목 데이터 배열
 */
function populateCiFieldSelection(items) {
    if (items.length === 0) return;

    const fieldKeys = new Set([
        // CostItem 자체의 기본 필드
        'cost_code_name',
        'quantity_member_id',
    ]);

    // 데이터 일부만 순회하여 모든 가능한 키를 수집합니다. (성능 최적화)
    const itemsToScan = items.slice(0, 50);
    itemsToScan.forEach((item) => {
        // 수량산출부재 속성 키 추가 (예: '부재속성.면적')
        if (item.quantity_member_properties) {
            Object.keys(item.quantity_member_properties).forEach((key) =>
                fieldKeys.add(`부재속성.${key}`)
            );
        }
        // 일람부호 속성 키 추가 (예: '일람부호.철근')
        if (item.member_mark_properties) {
            Object.keys(item.member_mark_properties).forEach((key) =>
                fieldKeys.add(`일람부호.${key}`)
            );
        }
        // 원본BIM객체 속성 키 추가 (예: 'BIM원본.Name')
        if (item.raw_element_properties) {
            Object.keys(item.raw_element_properties).forEach((key) =>
                fieldKeys.add(`BIM원본.${key}`)
            );
        }
    });

    const sortedKeys = Array.from(fieldKeys).sort();
    const groupBySelects = document.querySelectorAll('.ci-group-by-select');
    let optionsHtml =
        '<option value="">-- 그룹핑 기준 선택 --</option>' +
        sortedKeys
            .map((key) => `<option value="${key}">${key}</option>`)
            .join('');

    groupBySelects.forEach((select) => {
        const selectedValue = select.value; // 기존 선택값 유지
        select.innerHTML = optionsHtml;
        select.value = selectedValue;
    });
}
// ▲▲▲ [추가] 여기까지 입니다. ▲▲▲

// ▼▼▼ [추가] 수량산출룰셋 테이블 렌더링 함수 ▼▼▼
function renderCostCodeRulesetTable(rules, editId = null) {
    const container = document.getElementById(
        'costcode-ruleset-table-container'
    );
    if (!currentProjectId) {
        container.innerHTML = '<p>프로젝트를 선택하세요.</p>';
        return;
    }

    // 공사코드 옵션 생성 (loadedCostCodes가 비어있으면 경고)
    let costCodeOptions = '';
    if (!loadedCostCodes || loadedCostCodes.length === 0) {
        costCodeOptions = '<option value="">공사코드를 먼저 로드하세요</option>';
    } else {
        costCodeOptions = loadedCostCodes
            .map(
                (opt) =>
                    `<option value="${opt.id}">${opt.code} - ${opt.name}</option>`
            )
            .join('');
    }

    let tableHtml = `<table class="ruleset-table" style="min-width: 1800px;"><thead>
        <tr>
            <th style="width: 80px; min-width: 80px;">우선순위</th>
            <th style="width: 200px; min-width: 200px;">이름/설명</th>
            <th style="width: 200px; min-width: 200px;">대상 공사코드</th>
            <th style="width: 400px; min-width: 400px;">적용 조건 (CostItem 속성 기준)</th>
            <th style="width: 400px; min-width: 400px;">수량 계산식</th>
            <th style="width: 400px; min-width: 400px;">2차 수량 계산식</th>
            <th style="width: 120px; min-width: 120px;">작업</th>
        </tr>
    </thead><tbody>`;

    const renderRow = (rule) => {
        if (rule.id === editId) {
            // 조건 빌더 UI 생성
            const conditions = rule.conditions || [];
            let conditionsHtml = '<div class="conditions-builder" style="max-height: 250px; overflow-y: auto;">';

            conditions.forEach((cond, idx) => {
                conditionsHtml += renderConditionRowForCI(cond, idx);
            });

            conditionsHtml += `
                <button type="button" class="add-condition-btn" style="margin-top: 5px; padding: 5px 10px;">
                    + 조건 추가
                </button>
            </div>`;

            // 수량 산식 UI 생성
            const quantityFormula = rule.quantity_formula || '';
            const secondaryQuantityFormula = rule.secondary_quantity_formula || '';

            // CostItem 속성 옵션 생성
            let propertyOptions = '<option value="">-- 속성 선택 --</option>';
            if (typeof window.getAllCiFieldsForConditionBuilder === 'function') {
                const fieldGroups = window.getAllCiFieldsForConditionBuilder();
                fieldGroups.forEach(group => {
                    propertyOptions += `<optgroup label="${group.group}">`;
                    group.options.forEach(opt => {
                        propertyOptions += `<option value="{${opt.label}}">{${opt.label}}</option>`;
                    });
                    propertyOptions += '</optgroup>';
                });
            }

            let quantityFormulaHtml = `
                <div class="quantity-formula-builder" style="display: flex; flex-direction: column; gap: 8px;">
                    <textarea
                        class="quantity-formula-input"
                        placeholder="예: {BIM.Parameters.면적} * {BIM.Parameters.두께} * 0.001"
                        style="width: 100%; min-height: 80px; padding: 8px; font-family: monospace; resize: vertical;"
                    >${quantityFormula}</textarea>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <select class="quantity-formula-property-select" style="flex: 1; padding: 5px;">
                            ${propertyOptions}
                        </select>
                        <button type="button" class="insert-property-btn" style="padding: 6px 12px; background: #007bff; color: white; border: none; cursor: pointer; border-radius: 3px;">
                            속성 삽입
                        </button>
                    </div>
                    <small style="color: #666;">💡 속성을 선택하고 "속성 삽입" 버튼을 클릭하면 수식에 추가됩니다. 수식 예: {BIM.Parameters.면적} * {BIM.Parameters.두께}</small>
                </div>
            `;

            let secondaryQuantityFormulaHtml = `
                <div class="secondary-quantity-formula-builder" style="display: flex; flex-direction: column; gap: 8px;">
                    <textarea
                        class="secondary-quantity-formula-input"
                        placeholder="예: {BIM.Parameters.길이} * {CC.System.factor}"
                        style="width: 100%; min-height: 80px; padding: 8px; font-family: monospace; resize: vertical;"
                    >${secondaryQuantityFormula}</textarea>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <select class="secondary-quantity-formula-property-select" style="flex: 1; padding: 5px;">
                            ${propertyOptions}
                        </select>
                        <button type="button" class="insert-secondary-property-btn" style="padding: 6px 12px; background: #007bff; color: white; border: none; cursor: pointer; border-radius: 3px;">
                            속성 삽입
                        </button>
                    </div>
                    <small style="color: #666;">💡 2차 수량 산식 (선택사항). 예: 철근 길이 계산</small>
                </div>
            `;

            return `
                <tr class="rule-edit-row" data-rule-id="${rule.id}">
                    <td><input type="number" class="rule-priority-input" value="${
                        rule.priority || 0
                    }"></td>
                    <td><input type="text" class="rule-name-input" value="${
                        rule.name || ''
                    }" placeholder="규칙 이름"></td>
                    <td><select class="rule-cost-code-select">${costCodeOptions}</select></td>
                    <td>${conditionsHtml}</td>
                    <td>${quantityFormulaHtml}</td>
                    <td>${secondaryQuantityFormulaHtml}</td>
                    <td>
                        <button class="save-rule-btn">저장</button>
                        <button class="cancel-edit-btn">취소</button>
                    </td>
                </tr>`;
        }

        // 읽기 전용 모드 - 사용자 친화적인 표시
        let conditionsDisplay = '';
        if (rule.conditions && rule.conditions.length > 0) {
            conditionsDisplay = rule.conditions.map(c =>
                `<div style="padding: 2px 0;">${c.property} ${c.operator} "${c.value}"</div>`
            ).join('');
        } else {
            conditionsDisplay = '<em style="color: #999;">조건 없음</em>';
        }

        let quantityFormulaDisplay = '';
        if (rule.quantity_formula) {
            quantityFormulaDisplay = `<div style="padding: 5px; background: #f5f5f5; border-radius: 3px; font-family: monospace; white-space: pre-wrap; word-break: break-all;">${rule.quantity_formula}</div>`;
        } else {
            quantityFormulaDisplay = '<em style="color: #999;">수량 산식 없음</em>';
        }

        let secondaryQuantityFormulaDisplay = '';
        if (rule.secondary_quantity_formula) {
            secondaryQuantityFormulaDisplay = `<div style="padding: 5px; background: #f5f5f5; border-radius: 3px; font-family: monospace; white-space: pre-wrap; word-break: break-all;">${rule.secondary_quantity_formula}</div>`;
        } else {
            secondaryQuantityFormulaDisplay = '<em style="color: #999;">2차 수량 산식 없음</em>';
        }

        return `
            <tr data-rule-id="${rule.id}">
                <td>${rule.priority}</td>
                <td><strong>${rule.name}</strong><br><small>${
            rule.description || ''
        }</small></td>
                <td>${rule.target_cost_code_name}</td>
                <td style="word-wrap: break-word; vertical-align: top;">${conditionsDisplay}</td>
                <td style="word-wrap: break-word; vertical-align: top;">${quantityFormulaDisplay}</td>
                <td style="word-wrap: break-word; vertical-align: top;">${secondaryQuantityFormulaDisplay}</td>
                <td>
                    <button class="edit-rule-btn">수정</button>
                    <button class="delete-rule-btn">삭제</button>
                </td>
            </tr>`;
    };

    rules.forEach((rule) => {
        tableHtml += renderRow(rule);
    });
    if (editId === 'new') {
        tableHtml += renderRow({ id: 'new' });
    }
    if (rules.length === 0 && editId !== 'new') {
        tableHtml +=
            '<tr><td colspan="7">정의된 규칙이 없습니다. 새 규칙을 추가하세요.</td></tr>';
    }
    tableHtml += '</tbody></table>';

    // 스크롤 가능한 래퍼로 테이블 감싸기
    const scrollWrapper = document.createElement('div');
    scrollWrapper.style.overflowX = 'auto';
    scrollWrapper.style.width = '100%';
    scrollWrapper.innerHTML = tableHtml;

    container.innerHTML = '';
    container.appendChild(scrollWrapper);

    if (editId && editId !== 'new') {
        const rule = rules.find((r) => r.id === editId);
        if (rule)
            container.querySelector(
                `tr[data-rule-id="${rule.id}"] .rule-cost-code-select`
            ).value = rule.target_cost_code_id;
    }

    // 조건 빌더 리스너 설정
    setupConditionBuilderListeners();

    // 수량 산식 빌더 리스너 설정
    setupQuantityFormulaBuilderListeners();
}
/**
 * 선택된 CostItem에 연결된 QuantityMember의 정보와
 * 더 나아가 QuantityMember에 연결된 MemberMark 및 RawElement의 속성을 하단에 렌더링합니다.
 */
function renderCiLinkedMemberPropertiesTable() {
    // 1. HTML 요소들의 핸들을 가져옵니다.
    const headerContainer = document.getElementById(
        'ci-linked-member-info-header'
    );
    const memberPropsContainer = document.getElementById(
        'ci-linked-member-properties-container'
    );
    const markPropsContainer = document.getElementById(
        'ci-linked-mark-properties-container'
    );
    const rawElementPropsContainer = document.getElementById(
        'ci-linked-raw-element-properties-container'
    );

    // 모든 컨테이너 초기화
    headerContainer.innerHTML =
        '<p>산출항목을 선택하면 연관된 부재의 정보가 여기에 표시됩니다.</p>';
    memberPropsContainer.innerHTML = '';
    markPropsContainer.innerHTML = '';
    rawElementPropsContainer.innerHTML = '';

    // 2. 항목이 하나만 선택되었는지 확인합니다.
    if (selectedCiIds.size !== 1) {
        return;
    }

    const selectedId = selectedCiIds.values().next().value;
    const costItem = loadedCostItems.find(
        (item) => item.id.toString() === selectedId
    );

    // 3. 선택된 CostItem 객체와 QuantityMember ID가 있는지 확인합니다.
    if (!costItem || !costItem.quantity_member_id) {
        headerContainer.innerHTML =
            '<p>선택된 항목에 연관된 수량산출부재가 없습니다.</p>';
        return;
    }

    // 4. QuantityMember ID를 이용해 전체 부재 목록에서 해당 부재를 찾습니다.
    const member = loadedQuantityMembers.find(
        (m) => m.id.toString() === costItem.quantity_member_id.toString()
    );
    if (!member) {
        headerContainer.innerHTML =
            '<p>연관된 부재 정보를 찾을 수 없습니다.</p>';
        return;
    }

    // 5. 찾은 부재의 이름과 분류를 소제목(header) 영역에 렌더링합니다.
    headerContainer.innerHTML = `
        <h4>${member.name || '이름 없는 부재'}</h4>
        <small>${member.classification_tag_name || '미지정 분류'}</small>
    `;

    // 6. 부재의 속성을 첫 번째 컨테이너에 테이블 형태로 렌더링합니다.
    memberPropsContainer.innerHTML = '<h5>부재 속성</h5>';
    const memberProperties = member.properties || {};
    let memberTableHtml = `<table class="properties-table"><thead><tr><th>속성</th><th>값</th></tr></thead><tbody>`;
    if (Object.keys(memberProperties).length === 0) {
        memberTableHtml +=
            '<tr><td colspan="2">표시할 속성이 없습니다.</td></tr>';
    } else {
        Object.keys(memberProperties)
            .sort()
            .forEach((key) => {
                memberTableHtml += `<tr><td>${key}</td><td>${memberProperties[key]}</td></tr>`;
            });
    }
    memberTableHtml += '</tbody></table>';
    memberPropsContainer.innerHTML += memberTableHtml;

    // ▼▼▼ [핵심 수정] 7번 로직 전체를 아래와 같이 변경합니다. ▼▼▼
    // 7. 부재에 연결된 일람부호를 찾아 두 번째 컨테이너에 이름과 속성을 렌더링합니다.
    const markId = member.member_mark_id; // member_mark_ids -> member_mark_id 로 변경
    if (markId) {
        const mark = loadedMemberMarks.find((m) => m.id === markId);
        if (mark) {
            markPropsContainer.innerHTML = `<h5>${mark.mark} (일람부호 속성)</h5>`;
            const markProperties = mark.properties || {};
            let markTableHtml = `<table class="properties-table"><thead><tr><th>속성</th><th>값</th></tr></thead><tbody>`;
            if (Object.keys(markProperties).length === 0) {
                markTableHtml +=
                    '<tr><td colspan="2">표시할 속성이 없습니다.</td></tr>';
            } else {
                Object.keys(markProperties)
                    .sort()
                    .forEach((key) => {
                        markTableHtml += `<tr><td>${key}</td><td>${markProperties[key]}</td></tr>`;
                    });
            }
            markTableHtml += '</tbody></table>';
            markPropsContainer.innerHTML += markTableHtml;
        } else {
            markPropsContainer.innerHTML =
                '<h5>일람부호 속성</h5><p>연결된 일람부호 정보를 찾을 수 없습니다.</p>';
        }
    } else {
        markPropsContainer.innerHTML =
            '<h5>일람부호 속성</h5><p>연계된 일람부호가 없습니다.</p>';
    }
    // ▲▲▲ [핵심 수정] 여기까지 입니다. ▲▲▲

    // 8. 부재에 연결된 RawElement를 찾아 세 번째 컨테이너에 렌더링합니다.
    const rawElementId = member.raw_element_id;
    if (rawElementId) {
        const rawElement = allRevitData.find((el) => el.id === rawElementId);
        if (rawElement && rawElement.raw_data) {
            rawElementPropsContainer.innerHTML = `<h5>BIM 원본 데이터 (${
                rawElement.raw_data.Name || '이름 없음'
            })</h5>`;
            const rawData = rawElement.raw_data;
            let rawTableHtml = `<table class="properties-table"><thead><tr><th>속성</th><th>값</th></tr></thead><tbody>`;

            const allKeys = new Set(Object.keys(rawData));
            if (rawData.Parameters)
                Object.keys(rawData.Parameters).forEach((k) =>
                    allKeys.add(`Parameters.${k}`)
                );
            if (rawData.TypeParameters)
                Object.keys(rawData.TypeParameters).forEach((k) =>
                    allKeys.add(`TypeParameters.${k}`)
                );

            Array.from(allKeys)
                .sort()
                .forEach((key) => {
                    let value;
                    if (key.startsWith('Parameters.')) {
                        value = rawData.Parameters[key.substring(11)];
                    } else if (key.startsWith('TypeParameters.')) {
                        value = rawData.TypeParameters[key.substring(15)];
                    } else if (
                        key !== 'Parameters' &&
                        key !== 'TypeParameters'
                    ) {
                        value = rawData[key];
                    }

                    if (typeof value !== 'object') {
                        rawTableHtml += `<tr><td>${key}</td><td>${value}</td></tr>`;
                    }
                });

            rawTableHtml += '</tbody></table>';
            rawElementPropsContainer.innerHTML += rawTableHtml;
        } else {
            rawElementPropsContainer.innerHTML =
                '<h5>BIM 원본 데이터</h5><p>연결된 원본 BIM 객체 정보를 찾을 수 없습니다.</p>';
        }
    } else {
        rawElementPropsContainer.innerHTML =
            '<h5>BIM 원본 데이터</h5><p>연계된 원본 BIM 객체가 없습니다. (수동 생성된 부재)</p>';
    }
}

/**
 * 선택된 수량산출부재에 할당된 일람부호의 상세 정보(속성 포함)를 화면 우측에 표시합니다.
 */
function renderQmMemberMarkDetails() {
    const container = document.getElementById(
        'qm-assigned-member-mark-container'
    );

    if (!container) {
        console.warn('[renderQmMemberMarkDetails] qm-assigned-member-mark-container element not found');
        return;
    }

    if (selectedQmIds.size !== 1) {
        container.innerHTML = '부재를 하나만 선택하세요.';
        return;
    }

    const selectedId = Array.from(selectedQmIds)[0];
    const member = loadedQuantityMembers.find((m) => m.id === selectedId);

    if (!member || !member.member_mark_id) {
        container.innerHTML = '할당된 일람부호가 없습니다.';
        return;
    }

    const mark = loadedMemberMarks.find((m) => m.id === member.member_mark_id);
    if (!mark) {
        container.innerHTML = '<p>일람부호 정보를 찾을 수 없습니다.</p>';
        return;
    }

    let propertiesHtml = `<h5>${mark.mark} (일람부호 속성)</h5>`;
    const markProperties = mark.properties || {};
    let tableHtml = `<table class="properties-table"><thead><tr><th>속성</th><th>값</th></tr></thead><tbody>`;

    if (Object.keys(markProperties).length === 0) {
        tableHtml += '<tr><td colspan="2">정의된 속성이 없습니다.</td></tr>';
    } else {
        Object.keys(markProperties)
            .sort()
            .forEach((key) => {
                tableHtml += `<tr><td>${key}</td><td>${markProperties[key]}</td></tr>`;
            });
    }
    tableHtml += '</tbody></table>';

    container.innerHTML = propertiesHtml + tableHtml;
}

/**
 * 선택된 QuantityMember에 연결된 RawElement의 속성을 렌더링합니다.
 */
function renderQmLinkedRawElementPropertiesTable() {
    const container = document.getElementById(
        'qm-linked-raw-element-properties-container'
    );

    if (selectedQmIds.size !== 1) {
        container.innerHTML =
            '<p>부재를 하나만 선택하면 원본 데이터가 표시됩니다.</p>';
        return;
    }

    const selectedId = Array.from(selectedQmIds)[0];
    const member = loadedQuantityMembers.find((m) => m.id === selectedId);

    if (!member || !member.raw_element_id) {
        container.innerHTML =
            '<p>연관된 BIM 원본 객체가 없습니다. (수동 생성된 부재)</p>';
        return;
    }

    const rawElement = allRevitData.find(
        (el) => el.id === member.raw_element_id
    );
    if (!rawElement || !rawElement.raw_data) {
        container.innerHTML =
            '<p>연결된 원본 BIM 객체 정보를 찾을 수 없습니다.</p>';
        return;
    }

    const rawData = rawElement.raw_data;
    let headerHtml = `<h5>${rawData.Name || '이름 없음'} (${
        rawData.Category || ''
    })</h5>`;
    let tableHtml = `<table class="properties-table"><thead><tr><th>속성</th><th>값</th></tr></thead><tbody>`;

    const allKeys = new Set(Object.keys(rawData));
    if (rawData.Parameters)
        Object.keys(rawData.Parameters).forEach((k) =>
            allKeys.add(`Parameters.${k}`)
        );
    if (rawData.TypeParameters)
        Object.keys(rawData.TypeParameters).forEach((k) =>
            allKeys.add(`TypeParameters.${k}`)
        );

    Array.from(allKeys)
        .sort()
        .forEach((key) => {
            let value;
            if (key.startsWith('Parameters.')) {
                value = rawData.Parameters[key.substring(11)];
            } else if (key.startsWith('TypeParameters.')) {
                value = rawData.TypeParameters[key.substring(15)];
            } else if (key !== 'Parameters' && key !== 'TypeParameters') {
                value = rawData[key];
            }

            if (value !== undefined && typeof value !== 'object') {
                tableHtml += `<tr><td>${key}</td><td>${value}</td></tr>`;
            }
        });

    tableHtml += '</tbody></table>';
    container.innerHTML = headerHtml + tableHtml;
}

/**
 * '일람부호 할당 룰셋' 데이터를 HTML 테이블 형태로 화면에 그립니다.
 * @param {Array} rules - 서버에서 받아온 룰셋 데이터 배열
 * @param {String} editId - 현재 편집 중인 규칙의 ID (새 규칙은 'new')
 */
function renderMemberMarkAssignmentRulesetTable(rules, editId = null) {
    const container = document.getElementById(
        'member-mark-assignment-ruleset-table-container'
    );
    let tableHtml = `<table class="ruleset-table"><thead>
        <tr>
            <th style="width: 8%;">우선순위</th>
            <th style="width: 15%;">규칙 이름</th>
            <th style="width: 15%;">설명</th>
            <th style="width: 30%;">적용 조건</th>
            <th style="width: 20%;">대상 일람부호</th>
            <th style="width: 12%;">작업</th>
        </tr>
    </thead><tbody>`;

    const renderRow = (rule) => {
        if (rule.id === editId) {
            // 편집 모드
            // 일람부호 드롭다운 생성
            let memberMarkOptions = '<option value="">-- 일람부호 선택 --</option>';
            if (window.loadedMemberMarks && window.loadedMemberMarks.length > 0) {
                const selectedMark = rule.mark_expression || '';
                window.loadedMemberMarks.forEach(mm => {
                    const selected = mm.mark === selectedMark ? 'selected' : '';
                    memberMarkOptions += `<option value="${mm.id}" ${selected}>${mm.mark}</option>`;
                });
            }

            // 조건 빌더 UI 생성
            const conditions = rule.conditions || [];
            let conditionsHtml = '<div class="conditions-builder" style="max-height: 300px; overflow-y: auto;">';

            conditions.forEach((cond, idx) => {
                conditionsHtml += renderConditionRowForQM(cond, idx);
            });

            conditionsHtml += `
                <button type="button" class="add-condition-btn" style="margin-top: 5px; padding: 5px 10px;">
                    + 조건 추가
                </button>
            </div>`;

            return `<tr class="rule-edit-row" data-rule-id="${rule.id}">
                <td><input type="number" class="rule-priority-input" value="${rule.priority || 0}" style="width: 60px;"></td>
                <td><input type="text" class="rule-name-input" value="${rule.name || ''}" placeholder="규칙 이름"></td>
                <td><input type="text" class="rule-description-input" value="${rule.description || ''}" placeholder="설명 (선택사항)"></td>
                <td>${conditionsHtml}</td>
                <td>
                    <select class="rule-member-mark-select" style="width: 100%;">
                        ${memberMarkOptions}
                    </select>
                </td>
                <td>
                    <button class="save-rule-btn">💾 저장</button>
                    <button class="cancel-edit-btn">❌ 취소</button>
                </td>
            </tr>`;
        }

        // 읽기 전용 모드
        let conditionsDisplay = '';
        if (rule.conditions && rule.conditions.length > 0) {
            conditionsDisplay = rule.conditions.map(c =>
                `${c.property || c.parameter} ${c.operator} "${c.value}"`
            ).join('<br>');
        } else {
            conditionsDisplay = '<em>조건 없음</em>';
        }

        return `<tr data-rule-id="${rule.id}">
            <td>${rule.priority}</td>
            <td>${rule.name}</td>
            <td>${rule.description || ''}</td>
            <td>${conditionsDisplay}</td>
            <td>${rule.mark_expression || ''}</td>
            <td>
                <button class="edit-rule-btn">✏️ 수정</button>
                <button class="delete-rule-btn">🗑️ 삭제</button>
            </td>
        </tr>`;
    };

    rules.forEach((rule) => {
        tableHtml += renderRow(rule);
    });
    if (editId === 'new') tableHtml += renderRow({ id: 'new' });
    if (rules.length === 0 && editId !== 'new')
        tableHtml += '<tr><td colspan="6">정의된 규칙이 없습니다.</td></tr>';

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;

    // ▼▼▼ [추가] 조건 빌더 리스너 설정 (2025-11-05) ▼▼▼
    if (editId) {
        setupConditionBuilderListeners();
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲
}

/**
 * '공사코드 할당 룰셋' 데이터를 HTML 테이블 형태로 화면에 그립니다.
 */
function renderCostCodeAssignmentRulesetTable(rules, editId = null) {
    const container = document.getElementById(
        'cost-code-assignment-ruleset-table-container'
    );
    let tableHtml = `<table class="ruleset-table"><thead>
        <tr>
            <th style="width: 8%;">우선순위</th>
            <th style="width: 15%;">규칙 이름</th>
            <th style="width: 15%;">설명</th>
            <th style="width: 30%;">적용 조건</th>
            <th style="width: 20%;">대상 공사코드</th>
            <th style="width: 12%;">작업</th>
        </tr>
    </thead><tbody>`;

    const renderRow = (rule) => {
        if (rule.id === editId) {
            // 편집 모드
            // 공사코드 드롭다운 생성
            let costCodeOptions = '<option value="">-- 공사코드 선택 --</option>';
            if (window.loadedCostCodes && window.loadedCostCodes.length > 0) {
                // cost_code_expressions에서 code 추출
                const selectedCode = rule.cost_code_expressions?.code || '';
                window.loadedCostCodes.forEach(cc => {
                    const selected = cc.code === selectedCode ? 'selected' : '';
                    costCodeOptions += `<option value="${cc.id}" ${selected}>${cc.code} - ${cc.name}</option>`;
                });
            }

            // 조건 빌더 UI 생성
            const conditions = rule.conditions || [];
            let conditionsHtml = '<div class="conditions-builder" style="max-height: 300px; overflow-y: auto;">';

            conditions.forEach((cond, idx) => {
                conditionsHtml += renderConditionRowForQM(cond, idx);
            });

            conditionsHtml += `
                <button type="button" class="add-condition-btn" style="margin-top: 5px; padding: 5px 10px;">
                    + 조건 추가
                </button>
            </div>`;

            return `<tr class="rule-edit-row" data-rule-id="${rule.id}">
                <td><input type="number" class="rule-priority-input" value="${
                    rule.priority || 0
                }" style="width: 60px;"></td>
                <td><input type="text" class="rule-name-input" value="${
                    rule.name || ''
                }" placeholder="규칙 이름" style="width: 100%;"></td>
                <td><input type="text" class="rule-description-input" value="${
                    rule.description || ''
                }" placeholder="설명 (선택)" style="width: 100%;"></td>
                <td>${conditionsHtml}</td>
                <td><select class="rule-cost-code-select" style="width: 100%;">${costCodeOptions}</select></td>
                <td>
                    <button class="save-rule-btn">저장</button>
                    <button class="cancel-edit-btn">취소</button>
                </td>
            </tr>`;
        }
        // 읽기 전용 모드
        const conditionsDisplay = rule.conditions && rule.conditions.length > 0
            ? rule.conditions.map(c => `${c.property || c.parameter} ${c.operator} "${c.value}"`).join('<br>')
            : '조건 없음';

        const costCodeDisplay = rule.cost_code_expressions
            ? `${rule.cost_code_expressions.code || ''} - ${rule.cost_code_expressions.name || ''}`
            : '';

        return `<tr data-rule-id="${rule.id}">
            <td>${rule.priority}</td>
            <td>${rule.name}</td>
            <td>${rule.description || ''}</td>
            <td style="font-size: 0.9em;">${conditionsDisplay}</td>
            <td>${costCodeDisplay}</td>
            <td><button class="edit-rule-btn">수정</button> <button class="delete-rule-btn">삭제</button></td>
        </tr>`;
    };

    rules.forEach((rule) => {
        tableHtml += renderRow(rule);
    });
    if (editId === 'new') tableHtml += renderRow({ id: 'new', conditions: [] });
    if (rules.length === 0 && editId !== 'new')
        tableHtml += '<tr><td colspan="6">정의된 규칙이 없습니다.</td></tr>';

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;

    // 조건 추가/삭제 이벤트 리스너
    setupConditionBuilderListeners();
}

/**
 * 액티비티 할당 룰셋 테이블 렌더링 (조건 빌더 UI 포함)
 */
function renderActivityAssignmentRulesetTable(rules, editId = null) {
    const container = document.getElementById(
        'activity-assignment-ruleset-table-container'
    );
    let tableHtml = `<table class="ruleset-table"><thead>
        <tr>
            <th style="width: 8%;">우선순위</th>
            <th style="width: 15%;">규칙 이름</th>
            <th style="width: 15%;">설명</th>
            <th style="width: 30%;">적용 조건</th>
            <th style="width: 20%;">대상 액티비티</th>
            <th style="width: 12%;">작업</th>
        </tr>
    </thead><tbody>`;

    const renderRow = (rule) => {
        if (rule.id === editId) {
            // 편집 모드
            // 액티비티 드롭다운 생성
            let activityOptions = '<option value="">-- 액티비티 선택 --</option>';
            if (window.loadedActivities && window.loadedActivities.length > 0) {
                window.loadedActivities.forEach(activity => {
                    const selected = rule.target_activity_id === activity.id ? 'selected' : '';
                    activityOptions += `<option value="${activity.id}" ${selected}>${activity.code} - ${activity.name}</option>`;
                });
            }

            // 조건 빌더 UI 생성
            const conditions = rule.conditions || [];
            let conditionsHtml = '<div class="conditions-builder" style="max-height: 300px; overflow-y: auto;">';

            conditions.forEach((cond, idx) => {
                conditionsHtml += renderConditionRow(cond, idx);
            });

            conditionsHtml += `
                <button type="button" class="add-condition-btn" style="margin-top: 5px; padding: 5px 10px;">
                    + 조건 추가
                </button>
            </div>`;

            return `<tr class="rule-edit-row" data-rule-id="${rule.id}">
                <td><input type="number" class="rule-priority-input" value="${
                    rule.priority || 0
                }" style="width: 60px;"></td>
                <td><input type="text" class="rule-name-input" value="${
                    rule.name || ''
                }" placeholder="규칙 이름" style="width: 100%;"></td>
                <td><input type="text" class="rule-description-input" value="${
                    rule.description || ''
                }" placeholder="설명 (선택)" style="width: 100%;"></td>
                <td>${conditionsHtml}</td>
                <td><select class="rule-activity-select" style="width: 100%;">${activityOptions}</select></td>
                <td>
                    <button class="save-rule-btn">저장</button>
                    <button class="cancel-edit-btn">취소</button>
                </td>
            </tr>`;
        }
        // 읽기 전용 모드
        const conditionsDisplay = rule.conditions && rule.conditions.length > 0
            ? rule.conditions.map(c => `${c.property} <strong>${c.operator}</strong> "${c.value}"`).join('<br>')
            : '조건 없음';

        return `<tr data-rule-id="${rule.id}">
            <td>${rule.priority}</td>
            <td>${rule.name}</td>
            <td>${rule.description || ''}</td>
            <td style="font-size: 0.9em;">${conditionsDisplay}</td>
            <td>${rule.target_activity_code || ''} - ${rule.target_activity_name || ''}</td>
            <td><button class="edit-rule-btn">수정</button> <button class="delete-rule-btn">삭제</button></td>
        </tr>`;
    };

    rules.forEach((rule) => {
        tableHtml += renderRow(rule);
    });
    if (editId === 'new') tableHtml += renderRow({ id: 'new', conditions: [] });
    if (rules.length === 0 && editId !== 'new')
        tableHtml += '<tr><td colspan="6">정의된 규칙이 없습니다.</td></tr>';

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;

    // 조건 추가/삭제 이벤트 리스너
    setupConditionBuilderListeners();
}

/**
 * Operator를 사람이 읽기 쉬운 형태로 변환
 */
function getOperatorDisplayText(operator) {
    const operatorMap = {
        'equals': '같음',
        'not_equals': '같지 않음',
        'contains': '포함',
        'not_contains': '포함하지 않음',
        'starts_with': '~로 시작',
        'ends_with': '~로 끝남',
        'greater_than': '크다 (>)',
        'less_than': '작다 (<)',
        'greater_or_equal': '크거나 같다 (>=)',
        'less_or_equal': '작거나 같다 (<=)'
    };
    return operatorMap[operator] || operator;
}

/**
 * 조건 빌더 단일 행 렌더링
 */
function renderConditionRow(condition, index) {
    const property = condition.property || '';
    const operator = condition.operator || 'equals';
    const value = condition.value || '';

    // 속성 옵션 생성 - CostItem의 allCiFields 사용
    let propertyOptions = [];

    if (window.allCiFields && window.allCiFields.length > 0) {
        // allCiFields가 있으면 동적으로 그룹화
        const groupedFields = {};
        window.allCiFields.forEach(field => {
            // field는 { key: '...', label: '...' } 형태의 객체
            const fieldKey = field.key || field;
            const fieldLabel = field.label || fieldKey;

            let groupName = 'CostItem 속성 (CI)';

            if (fieldKey.startsWith('CostCode.')) {
                groupName = 'CostCode 속성';
            } else if (fieldKey.startsWith('QM.')) {
                groupName = 'QuantityMember 속성 (QM)';
            } else if (fieldKey.startsWith('BIM.Attributes.')) {
                groupName = 'BIM Attributes';
            } else if (fieldKey.startsWith('BIM.Parameters.')) {
                groupName = 'BIM Parameters';
            } else if (fieldKey.startsWith('BIM.TypeParameters.')) {
                groupName = 'BIM TypeParameters';
            } else if (fieldKey.startsWith('CI.')) {
                groupName = 'CostItem 속성 (CI)';
            }

            if (!groupedFields[groupName]) {
                groupedFields[groupName] = [];
            }
            groupedFields[groupName].push({ value: fieldKey, label: fieldLabel });
        });

        // 그룹별로 정리
        Object.keys(groupedFields).forEach(groupName => {
            propertyOptions.push({
                group: groupName,
                options: groupedFields[groupName]
            });
        });
    } else {
        // fallback: 기본 옵션 (allCiFields가 없을 때)
        propertyOptions = [
            { group: 'CostItem 속성 (CI)', options: [
                { value: 'CI.quantity', label: 'CI.quantity (수량)' },
                { value: 'CI.description', label: 'CI.description (설명)' },
                { value: 'CI.group_name', label: 'CI.group_name (그룹명)' }
            ]},
            { group: 'CostCode 속성', options: [
                { value: 'CostCode.code', label: 'CostCode.code (공사코드)' },
                { value: 'CostCode.name', label: 'CostCode.name (공사명)' },
                { value: 'CostCode.detail_code', label: 'CostCode.detail_code (세부코드)' },
                { value: 'CostCode.note', label: 'CostCode.note (비고)' }
            ]},
            { group: 'QuantityMember 속성 (QM)', options: [
                { value: 'QM.name', label: 'QM.name (부재명)' },
                { value: 'QM.classification_tag', label: 'QM.classification_tag (분류태그)' }
            ]},
            { group: 'BIM Attributes', options: [
                { value: 'BIM.Attributes.Category', label: 'BIM.Attributes.Category (카테고리)' },
                { value: 'BIM.Attributes.Family', label: 'BIM.Attributes.Family (패밀리)' },
                { value: 'BIM.Attributes.Type', label: 'BIM.Attributes.Type (타입)' }
            ]},
            { group: 'BIM Parameters', options: [
                { value: 'BIM.Parameters.참조 레벨', label: 'BIM.Parameters.참조 레벨' },
                { value: 'BIM.Parameters.구조용도', label: 'BIM.Parameters.구조용도' }
            ]},
            { group: 'BIM TypeParameters', options: [
                { value: 'BIM.TypeParameters.구조용도', label: 'BIM.TypeParameters.구조용도' }
            ]}
        ];
    }

    let propertySelectHtml = '<select class="condition-property" style="width: 100%; margin-bottom: 3px;">';
    propertySelectHtml += '<option value="">-- 속성 선택 --</option>';
    propertyOptions.forEach(group => {
        propertySelectHtml += `<optgroup label="${group.group}">`;
        group.options.forEach(opt => {
            const selected = opt.value === property ? 'selected' : '';
            propertySelectHtml += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
        });
        propertySelectHtml += '</optgroup>';
    });
    propertySelectHtml += '</select>';

    // 연산자 옵션 (백엔드 형식에 맞춤)
    const operators = [
        { value: 'equals', label: '같음 (equals)' },
        { value: 'not_equals', label: '같지 않음 (not_equals)' },
        { value: 'contains', label: '포함 (contains)' },
        { value: 'not_contains', label: '포함하지 않음 (not_contains)' },
        { value: 'starts_with', label: '~로 시작 (starts_with)' },
        { value: 'ends_with', label: '~로 끝남 (ends_with)' },
        { value: 'greater_than', label: '크다 (>)' },
        { value: 'less_than', label: '작다 (<)' },
        { value: 'greater_or_equal', label: '크거나 같다 (>=)' },
        { value: 'less_or_equal', label: '작거나 같다 (<=)' }
    ];

    let operatorSelectHtml = '<select class="condition-operator" style="width: 100%; margin-bottom: 3px;">';
    operators.forEach(op => {
        const selected = op.value === operator ? 'selected' : '';
        operatorSelectHtml += `<option value="${op.value}" ${selected}>${op.label}</option>`;
    });
    operatorSelectHtml += '</select>';

    return `
        <div class="condition-row" data-index="${index}" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 8px; background: #f9f9f9; border-radius: 4px;">
            <div style="display: flex; flex-direction: column; gap: 5px;">
                <div style="display: flex; flex-direction: column; gap: 3px;">
                    <label style="font-size: 11px; font-weight: bold; color: #555;">속성:</label>
                    ${propertySelectHtml}
                </div>
                <div style="display: flex; flex-direction: column; gap: 3px;">
                    <label style="font-size: 11px; font-weight: bold; color: #555;">연산자:</label>
                    ${operatorSelectHtml}
                </div>
                <div style="display: flex; flex-direction: column; gap: 3px;">
                    <label style="font-size: 11px; font-weight: bold; color: #555;">값:</label>
                    <input type="text" class="condition-value" value="${value}" placeholder="값 입력" style="width: 100%; padding: 5px;">
                </div>
                <button type="button" class="remove-condition-btn" style="background: #dc3545; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 3px; margin-top: 5px;">
                    🗑️ 삭제
                </button>
            </div>
        </div>
    `;
}

/**
 * QuantityMember용 조건 빌더 단일 행 렌더링
 */
function renderConditionRowForQM(condition, index) {
    const property = condition.property || condition.parameter || '';
    let operator = condition.operator || 'equals';
    const value = condition.value || '';

    // 기존 룰셋의 연산자 형식 변환 (하위 호환성)
    const operatorMap = {
        '==': 'equals',
        '!=': 'not_equals',
        '>': 'greater_than',
        '<': 'less_than',
        '>=': 'greater_or_equal',
        '<=': 'less_or_equal'
    };
    if (operatorMap[operator]) {
        operator = operatorMap[operator];
    }

    // QuantityMember 속성 옵션 생성 - 동적으로 수집된 필드 사용
    let propertyOptions = [];
    if (typeof window.getAllQmFieldsForConditionBuilder === 'function') {
        try {
            propertyOptions = window.getAllQmFieldsForConditionBuilder();
        } catch (error) {
            // 폴백: 기본 옵션 사용
            propertyOptions = [
                { group: 'QuantityMember 속성', options: [
                    { value: 'name', label: 'QM.name (부재명)' },
                    { value: 'classification_tag', label: 'QM.classification_tag (분류 태그)' }
                ]}
            ];
        }
    } else {
        // 폴백: 기본 옵션 사용
        propertyOptions = [
            { group: 'QuantityMember 속성', options: [
                { value: 'name', label: 'QM.name (부재명)' },
                { value: 'classification_tag', label: 'QM.classification_tag (분류 태그)' }
            ]}
        ];
    }

    let propertySelectHtml = '<select class="condition-property" style="width: 100%; padding: 5px;">';
    propertySelectHtml += '<option value="">-- 속성 선택 --</option>';
    propertyOptions.forEach(group => {
        propertySelectHtml += `<optgroup label="${group.group}">`;
        group.options.forEach(opt => {
            const selected = opt.value === property ? 'selected' : '';
            propertySelectHtml += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
        });
        propertySelectHtml += '</optgroup>';
    });
    propertySelectHtml += '</select>';

    // 연산자 옵션 (분류할당룰셋과 동일한 형식)
    const operators = [
        { value: 'equals', label: '같음 (equals)' },
        { value: 'not_equals', label: '같지 않음 (not_equals)' },
        { value: 'contains', label: '포함 (contains)' },
        { value: 'startswith', label: '시작 (startswith)' },
        { value: 'endswith', label: '끝 (endswith)' }
    ];

    let operatorSelectHtml = '<select class="condition-operator" style="width: 100%; padding: 5px;">';
    operators.forEach(op => {
        const selected = op.value === operator ? 'selected' : '';
        operatorSelectHtml += `<option value="${op.value}" ${selected}>${op.label}</option>`;
    });
    operatorSelectHtml += '</select>';

    return `
        <div class="condition-row" data-index="${index}" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 8px; background: #f9f9f9; border-radius: 4px;">
            <div style="margin-bottom: 5px;">
                <label style="display: block; font-weight: bold; margin-bottom: 3px; font-size: 12px; color: #555;">속성</label>
                ${propertySelectHtml}
            </div>
            <div style="margin-bottom: 5px;">
                <label style="display: block; font-weight: bold; margin-bottom: 3px; font-size: 12px; color: #555;">조건</label>
                ${operatorSelectHtml}
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: block; font-weight: bold; margin-bottom: 3px; font-size: 12px; color: #555;">값</label>
                <input type="text" class="condition-value" value="${value}" placeholder="값 입력" style="width: 100%; padding: 5px;">
            </div>
            <button type="button" class="remove-condition-btn" style="background: #dc3545; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 3px; width: 100%;">
                삭제
            </button>
        </div>
    `;
}

/**
 * allRevitData로부터 BIM 속성 옵션을 동적으로 생성합니다.
 * 계층적 명명 규칙을 적용하여 그룹화된 옵션 배열을 반환합니다.
 *
 * ▼▼▼ [수정] QuantitySet, PropertySet 등 모든 BIM 속성 동적 수집 (2025-11-05) ▼▼▼
 */
function generateBIMPropertyOptions() {
    if (!allRevitData || allRevitData.length === 0) {
        return [];
    }

    // 각 카테고리별로 필드 수집
    const systemProps = new Set();
    const attributeProps = new Set();
    const instanceParams = new Set();
    const typeParams = new Set();
    const quantitySetProps = new Set();
    const propertySetProps = new Set();
    const spatialContainerProps = new Set();
    const typeInfoProps = new Set();
    const typeAttributeProps = new Set(); // Type.Attributes.* 추가
    const typePropertySetProps = new Set(); // Type.PropertySet.* 추가
    const otherProps = new Set();

    // 시스템 속성 (Cost Estimator 관리)
    const systemKeys = ['id', 'element_unique_id', 'geometry_volume', 'classification_tags'];
    systemKeys.forEach(k => systemProps.add(k));

    // IFC Attributes 속성
    const ifcAttributeKeys = ['Name', 'IfcClass', 'ElementId', 'UniqueId', 'Description',
                              'RelatingType', 'SpatialContainer', 'Aggregates', 'Nests'];

    // allRevitData에서 모든 필드 수집
    allRevitData.forEach((item) => {
        const raw = item.raw_data;
        if (raw) {
            // TypeParameters 수집
            if (raw.TypeParameters) {
                Object.keys(raw.TypeParameters).forEach((k) => {
                    typeParams.add(`TypeParameters.${k}`);
                });
            }
            // Parameters 수집
            if (raw.Parameters) {
                Object.keys(raw.Parameters).forEach((k) => {
                    instanceParams.add(k);
                });
            }
            // ▼▼▼ [추가] QuantitySet 객체 내부 속성 수집 (2025-11-06) ▼▼▼
            if (raw.QuantitySet && typeof raw.QuantitySet === 'object') {
                Object.keys(raw.QuantitySet).forEach((k) => {
                    quantitySetProps.add(`QuantitySet.${k}`);
                });
            }
            // ▲▲▲ [추가] 여기까지 ▲▲▲
            // raw_data의 모든 top-level 키 수집
            Object.keys(raw).forEach((k) => {
                // Parameters, TypeParameters, QuantitySet는 이미 처리했으므로 제외
                if (k === 'Parameters' || k === 'TypeParameters' || k === 'QuantitySet') {
                    return;
                }

                // QuantitySet.* 형태의 속성 (키 이름이 QuantitySet.XXX인 경우)
                if (k.startsWith('QuantitySet.')) {
                    quantitySetProps.add(k);
                }
                // PropertySet.* 형태의 속성
                else if (k.startsWith('PropertySet.')) {
                    propertySetProps.add(k);
                }
                // Spatial_Container.* 형태의 속성
                else if (k.startsWith('Spatial_Container.')) {
                    spatialContainerProps.add(k);
                }
                // Type.Attributes.* 형태의 속성 (세부 타입 속성)
                else if (k.startsWith('Type.Attributes.')) {
                    typeAttributeProps.add(k);
                }
                // Type.PropertySet.* 형태의 속성 (타입 PropertySet)
                else if (k.startsWith('Type.PropertySet.')) {
                    typePropertySetProps.add(k);
                }
                // Type.* 형태의 속성 (기본 타입 정보)
                else if (k.startsWith('Type.')) {
                    typeInfoProps.add(k);
                }
                // Attributes.* 형태의 속성
                else if (k.startsWith('Attributes.')) {
                    attributeProps.add(k.substring(11)); // "Attributes." 제거
                }
                // 하드코딩된 IFC Attributes
                else if (ifcAttributeKeys.includes(k)) {
                    attributeProps.add(k);
                }
                // 그 외 모든 속성
                else {
                    otherProps.add(k);
                }
            });
        }
    });

    // 각 그룹을 정렬하고 표시명으로 변환
    const propertyOptions = [];

    // BIM.System.* 그룹
    if (systemProps.size > 0) {
        const options = Array.from(systemProps).sort().map(prop => {
            const displayName = getDisplayFieldName(prop);
            return { value: displayName, label: displayName };
        });
        propertyOptions.push({
            group: 'BIM 시스템 속성 (Cost Estimator 관리)',
            options: options
        });
    }

    // BIM.Attributes.* 그룹 (IFC 전용)
    if (attributeProps.size > 0) {
        const options = Array.from(attributeProps).sort().map(prop => {
            const displayName = getDisplayFieldName(prop);
            return { value: displayName, label: displayName };
        });
        propertyOptions.push({
            group: 'BIM Attributes (IFC 속성)',
            options: options
        });
    }

    // BIM.QuantitySet.* 그룹 (새로 추가!)
    if (quantitySetProps.size > 0) {
        const options = Array.from(quantitySetProps).sort().map(prop => {
            // QuantitySet.XXX -> BIM.QuantitySet.XXX 형태로 표시
            const displayName = `BIM.${prop}`;
            return { value: displayName, label: displayName };
        });
        propertyOptions.push({
            group: 'BIM QuantitySet (수량 속성)',
            options: options
        });
    }

    // BIM.PropertySet.* 그룹 (새로 추가!)
    if (propertySetProps.size > 0) {
        const options = Array.from(propertySetProps).sort().map(prop => {
            // PropertySet.XXX -> BIM.PropertySet.XXX 형태로 표시
            const displayName = `BIM.${prop}`;
            return { value: displayName, label: displayName };
        });
        propertyOptions.push({
            group: 'BIM PropertySet (속성 세트)',
            options: options
        });
    }

    // BIM.Spatial_Container.* 그룹 (새로 추가!)
    if (spatialContainerProps.size > 0) {
        const options = Array.from(spatialContainerProps).sort().map(prop => {
            // Spatial_Container.XXX -> BIM.Spatial_Container.XXX 형태로 표시
            const displayName = `BIM.${prop}`;
            return { value: displayName, label: displayName };
        });
        propertyOptions.push({
            group: 'BIM Spatial Container (공간 컨테이너)',
            options: options
        });
    }

    // BIM.Type.* 그룹 (기본 타입 정보)
    if (typeInfoProps.size > 0) {
        const options = Array.from(typeInfoProps).sort().map(prop => {
            // Type.XXX -> BIM.Type.XXX 형태로 표시
            const displayName = `BIM.${prop}`;
            return { value: displayName, label: displayName };
        });
        propertyOptions.push({
            group: 'BIM Type Info (타입 정보)',
            options: options
        });
    }

    // BIM.Type.Attributes.* 그룹 (타입 세부 속성 - 2025-11-06 추가)
    if (typeAttributeProps.size > 0) {
        const options = Array.from(typeAttributeProps).sort().map(prop => {
            // Type.Attributes.XXX -> BIM.Type.Attributes.XXX 형태로 표시
            const displayName = `BIM.${prop}`;
            return { value: displayName, label: displayName };
        });
        propertyOptions.push({
            group: 'BIM Type Attributes (타입 세부 속성)',
            options: options
        });
    }

    // BIM.Type.PropertySet.* 그룹 (타입 PropertySet - 2025-11-06 추가)
    if (typePropertySetProps.size > 0) {
        const options = Array.from(typePropertySetProps).sort().map(prop => {
            // Type.PropertySet.XXX -> BIM.Type.PropertySet.XXX 형태로 표시
            const displayName = `BIM.${prop}`;
            return { value: displayName, label: displayName };
        });
        propertyOptions.push({
            group: 'BIM Type PropertySet (타입 속성 세트)',
            options: options
        });
    }

    // BIM.Parameters.* 그룹
    if (instanceParams.size > 0) {
        const options = Array.from(instanceParams).sort().map(prop => {
            const displayName = getDisplayFieldName(prop);
            return { value: displayName, label: displayName };
        });
        propertyOptions.push({
            group: 'BIM Parameters (인스턴스 속성)',
            options: options
        });
    }

    // BIM.TypeParameters.* 그룹
    if (typeParams.size > 0) {
        const options = Array.from(typeParams).sort().map(prop => {
            const displayName = getDisplayFieldName(prop);
            return { value: displayName, label: displayName };
        });
        propertyOptions.push({
            group: 'BIM TypeParameters (타입 속성)',
            options: options
        });
    }

    // 기타 속성들 (분류되지 않은 것들)
    if (otherProps.size > 0) {
        const options = Array.from(otherProps).sort().map(prop => {
            const displayName = getDisplayFieldName(prop);
            return { value: displayName, label: displayName };
        });
        propertyOptions.push({
            group: 'BIM 기타 속성',
            options: options
        });
    }

    return propertyOptions;
}
// ▲▲▲ [수정] 여기까지 ▲▲▲

/**
 * 수량산출부재(QuantityMember)용 속성 옵션 생성
 * BIM.* + QM.* + MM.* + SC.* 속성을 모두 포함합니다.
 */
function generateQMPropertyOptions() {
    const propertyOptions = [];

    // 1. BIM 속성 (RawElement로부터 상속)
    const bimOptions = generateBIMPropertyOptions();
    propertyOptions.push(...bimOptions);

    // 2. QM.* - 수량산출부재 자체 속성
    const qmFields = [
        { value: 'QM.System.id', label: 'QM.System.id' },
        { value: 'QM.System.name', label: 'QM.System.name' },
        { value: 'QM.System.quantity', label: 'QM.System.quantity' },
        { value: 'QM.System.is_manual_quantity', label: 'QM.System.is_manual_quantity' },
        { value: 'QM.System.note', label: 'QM.System.note' },
        { value: 'QM.System.classification_tag', label: 'QM.System.classification_tag' }
    ];
    propertyOptions.push({
        group: 'QM 시스템 속성 (수량산출부재 자체)',
        options: qmFields
    });

    // 3. QM.Properties.* - 사용자 정의 속성 (동적으로 수집 필요)
    // 현재 로드된 QuantityMember 데이터에서 properties 수집
    const qmPropertiesSet = new Set();
    const qmSources = [window.currentQuantityMembers, window.loadedQuantityMembers];

    qmSources.forEach(qmList => {
        if (qmList && qmList.length > 0) {
            qmList.forEach(qm => {
                if (qm.properties && typeof qm.properties === 'object') {
                    Object.keys(qm.properties).forEach(key => {
                        qmPropertiesSet.add(key);
                    });
                }
            });
        }
    });

    if (qmPropertiesSet.size > 0) {
        const qmPropOptions = Array.from(qmPropertiesSet).sort().map(prop => {
            return { value: `QM.Properties.${prop}`, label: `QM.Properties.${prop}` };
        });
        propertyOptions.push({
            group: 'QM Properties (사용자 정의 속성)',
            options: qmPropOptions
        });
    }

    // 4. MM.* - 일람부호 속성 (MemberMark)
    const mmFields = [
        { value: 'MM.System.id', label: 'MM.System.id' },
        { value: 'MM.System.mark', label: 'MM.System.mark' },
        { value: 'MM.System.description', label: 'MM.System.description' }
    ];

    // MM.Properties.* 동적 수집
    // ▼▼▼ [수정] window.loadedMemberMarks도 확인하여 더 많은 속성 수집 ▼▼▼
    const mmPropertiesSet = new Set();
    const mmSources = [window.currentMemberMarks, window.loadedMemberMarks];

    mmSources.forEach(mmList => {
        if (mmList && mmList.length > 0) {
            mmList.forEach(mm => {
                if (mm.properties && typeof mm.properties === 'object') {
                    Object.keys(mm.properties).forEach(key => {
                        mmPropertiesSet.add(key);
                    });
                }
            });
        }
    });

    if (mmPropertiesSet.size > 0) {
        mmPropertiesSet.forEach(prop => {
            mmFields.push({ value: `MM.Properties.${prop}`, label: `MM.Properties.${prop}` });
        });
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    propertyOptions.push({
        group: 'MM 일람부호 속성',
        options: mmFields
    });

    // 5. SC.* - 공간분류 속성 (SpaceClassification)
    const scFields = [
        { value: 'SC.System.id', label: 'SC.System.id' },
        { value: 'SC.System.name', label: 'SC.System.name' },
        { value: 'SC.System.level', label: 'SC.System.level' },
        { value: 'SC.System.parent_id', label: 'SC.System.parent_id' }
    ];

    propertyOptions.push({
        group: 'SC 공간분류 속성',
        options: scFields
    });

    return propertyOptions;
}

/**
 * 코스트아이템(CostItem)용 속성 옵션 생성
 * BIM.* + QM.* + MM.* + SC.* + CI.* + CC.* 속성을 모두 포함합니다.
 */
function generateCIPropertyOptions() {
    const propertyOptions = [];

    // 1~5. 수량산출부재로부터 상속된 모든 속성
    const qmOptions = generateQMPropertyOptions();
    propertyOptions.push(...qmOptions);

    // 6. CI.* - 코스트아이템 자체 속성
    const ciFields = [
        { value: 'CI.System.id', label: 'CI.System.id' },
        { value: 'CI.System.name', label: 'CI.System.name' },
        { value: 'CI.System.quantity', label: 'CI.System.quantity' },
        { value: 'CI.System.is_manual_quantity', label: 'CI.System.is_manual_quantity' },
        // ▼▼▼ [추가] 2차 수량 필드 (2025-11-14) ▼▼▼
        { value: 'CI.System.secondary_quantity', label: 'CI.System.secondary_quantity (2차 수량)' },
        { value: 'CI.System.is_manual_secondary_quantity', label: 'CI.System.is_manual_secondary_quantity' },
        // ▲▲▲ [추가] 여기까지 ▲▲▲
        { value: 'CI.System.group', label: 'CI.System.group' },
        { value: 'CI.System.note', label: 'CI.System.note' }
    ];
    propertyOptions.push({
        group: 'CI 시스템 속성 (코스트아이템 자체)',
        options: ciFields
    });

    // 7. CC.* - 공사코드 속성 (CostCode)
    const ccFields = [
        { value: 'CC.System.id', label: 'CC.System.id' },
        { value: 'CC.System.code', label: 'CC.System.code' },
        { value: 'CC.System.name', label: 'CC.System.name' },
        { value: 'CC.System.description', label: 'CC.System.description' },
        { value: 'CC.System.detail_code', label: 'CC.System.detail_code' },
        { value: 'CC.System.product_name', label: 'CC.System.product_name (품명)' },
        { value: 'CC.System.note', label: 'CC.System.note (비고)' },
        { value: 'CC.System.spec', label: 'CC.System.spec (규격)' },
        { value: 'CC.System.unit', label: 'CC.System.unit (단위)' },
        // ▼▼▼ [추가] 2차 필드 (2025-11-14) ▼▼▼
        { value: 'CC.System.secondary_name', label: 'CC.System.secondary_name (2차 품명)' },
        { value: 'CC.System.secondary_spec', label: 'CC.System.secondary_spec (2차 규격)' },
        { value: 'CC.System.secondary_unit', label: 'CC.System.secondary_unit (2차 단위)' },
        { value: 'CC.System.secondary_detail_code', label: 'CC.System.secondary_detail_code (2차 내역코드)' },
        // ▲▲▲ [추가] 여기까지 ▲▲▲
        { value: 'CC.System.category', label: 'CC.System.category' },
        { value: 'CC.System.ai_sd_enabled', label: 'CC.System.ai_sd_enabled' },
        { value: 'CC.System.dd_enabled', label: 'CC.System.dd_enabled' }
    ];

    propertyOptions.push({
        group: 'CC 공사코드 속성',
        options: ccFields
    });

    return propertyOptions;
}

/**
 * 액티비티객체(ActivityObject)용 속성 옵션 생성
 * BIM.* + QM.* + MM.* + SC.* + CI.* + CC.* + AO.* + AC.* 속성을 모두 포함합니다.
 */
function generateAOPropertyOptions() {
    const propertyOptions = [];

    // 1~7. 코스트아이템으로부터 상속된 모든 속성
    const ciOptions = generateCIPropertyOptions();
    propertyOptions.push(...ciOptions);

    // 8. AO.* - 액티비티객체 자체 속성
    const aoFields = [
        { value: 'AO.System.id', label: 'AO.System.id' },
        { value: 'AO.System.name', label: 'AO.System.name' },
        { value: 'AO.System.quantity', label: 'AO.System.quantity' },
        { value: 'AO.System.is_manual_quantity', label: 'AO.System.is_manual_quantity' },
        { value: 'AO.System.note', label: 'AO.System.note' }
    ];
    propertyOptions.push({
        group: 'AO 시스템 속성 (액티비티객체 자체)',
        options: aoFields
    });

    // 9. AC.* - 액티비티코드 속성 (Activity)
    const acFields = [
        { value: 'AC.System.id', label: 'AC.System.id' },
        { value: 'AC.System.code', label: 'AC.System.code' },
        { value: 'AC.System.name', label: 'AC.System.name' },
        { value: 'AC.System.description', label: 'AC.System.description' },
        { value: 'AC.System.start_date', label: 'AC.System.start_date' },
        { value: 'AC.System.end_date', label: 'AC.System.end_date' },
        { value: 'AC.System.duration_days', label: 'AC.System.duration_days' },
        { value: 'AC.System.predecessor_codes', label: 'AC.System.predecessor_codes' }
    ];

    propertyOptions.push({
        group: 'AC 액티비티코드 속성',
        options: acFields
    });

    return propertyOptions;
}

/**
 * 첫 번째 접두어 추출 (BIM.System.id -> BIM)
 */
function getFirstPrefix(label) {
    if (!label || !label.includes('.')) return label;
    return label.split('.')[0];
}

/**
 * 통일된 섹션 정의 (첫 번째 접두어 기준)
 * 모든 탭에서 동일하게 사용
 */
function getSectionDefinitions() {
    return [
        { key: 'BIM', title: '🏗️ BIM 속성', color: '#1976d2' },
        { key: 'QM', title: '📌 수량산출부재 속성', color: '#388e3c' },
        { key: 'MM', title: '📋 일람부호 속성', color: '#7b1fa2' },
        { key: 'SC', title: '🏢 공간분류 속성', color: '#00796b' },
        { key: 'CI', title: '💰 코스트아이템 속성', color: '#ff6f00' },
        { key: 'CC', title: '📋 공사코드 속성', color: '#d32f2f' },
        { key: 'AO', title: '📅 액티비티객체 속성', color: '#303f9f' },
        { key: 'AC', title: '📆 액티비티코드 속성', color: '#c2185b' }
    ];
}

/**
 * 필드들을 첫 번째 접두어 기준으로 그룹화
 * @param {Array} fields - 필드 배열 (각 필드는 label 속성을 가짐)
 * @returns {Object} 섹션별로 그룹화된 필드 맵
 */
function groupFieldsByPrefix(fields) {
    const sectionMap = {};
    fields.forEach(field => {
        const prefix = getFirstPrefix(field.label);
        if (!sectionMap[prefix]) {
            sectionMap[prefix] = [];
        }
        sectionMap[prefix].push(field);
    });
    return sectionMap;
}

/**
 * RawElement용 조건 빌더 단일 행 렌더링 (Classification Rules용)
 */
function renderConditionRowForRE(condition, index) {
    const parameter = condition.parameter || condition.property || '';
    const operator = condition.operator || '==';
    const value = condition.value || '';

    // RawElement 속성 옵션 동적 생성
    const propertyOptions = generateBIMPropertyOptions();

    let propertySelectHtml = '<select class="condition-parameter" style="width: 100%; padding: 5px;">';
    propertySelectHtml += '<option value="">-- 속성 선택 --</option>';
    propertyOptions.forEach(group => {
        propertySelectHtml += `<optgroup label="${group.group}">`;
        group.options.forEach(opt => {
            const selected = opt.value === parameter ? 'selected' : '';
            propertySelectHtml += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
        });
        propertySelectHtml += '</optgroup>';
    });
    propertySelectHtml += '</select>';

    // 연산자 옵션
    const operators = [
        { value: 'equals', label: '같음 (equals)' },
        { value: 'not_equals', label: '같지 않음 (not_equals)' },
        { value: 'contains', label: '포함 (contains)' },
        { value: 'startswith', label: '시작 (startswith)' },
        { value: 'endswith', label: '끝 (endswith)' }
    ];

    let operatorSelectHtml = '<select class="condition-operator" style="width: 100%; padding: 5px;">';
    operators.forEach(op => {
        const selected = op.value === operator ? 'selected' : '';
        operatorSelectHtml += `<option value="${op.value}" ${selected}>${op.label}</option>`;
    });
    operatorSelectHtml += '</select>';

    return `
        <div class="condition-row" data-index="${index}" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 8px; background: #f9f9f9; border-radius: 4px;">
            <div style="margin-bottom: 5px;">
                <label style="display: block; font-weight: bold; margin-bottom: 3px; font-size: 12px; color: #555;">속성</label>
                ${propertySelectHtml}
            </div>
            <div style="margin-bottom: 5px;">
                <label style="display: block; font-weight: bold; margin-bottom: 3px; font-size: 12px; color: #555;">조건</label>
                ${operatorSelectHtml}
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: block; font-weight: bold; margin-bottom: 3px; font-size: 12px; color: #555;">값</label>
                <input type="text" class="condition-value" value="${value}" placeholder="값 입력" style="width: 100%; padding: 5px;">
            </div>
            <button type="button" class="remove-condition-btn" style="background: #dc3545; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 3px; width: 100%;">
                🗑️ 삭제
            </button>
        </div>
    `;
}

/**
 * 맵핑 스크립트의 개별 맵핑 행을 렌더링합니다.
 * @param {String} key - 속성 이름 (예: "체적")
 * @param {String} value - 표현식 또는 값 (예: "{Volume}", "{Area} * 2")
 * @param {Number} index - 행 번호
 */
function renderMappingRow(key = '', value = '', index = 0) {
    // 객체 조건과 동일한 속성 목록 사용
    const propertyOptionGroups = generateBIMPropertyOptions();

    let propertyOptionsHtml = '<option value="">-- 속성 선택하여 추가 --</option>';
    propertyOptionGroups.forEach(group => {
        propertyOptionsHtml += `<optgroup label="${group.group}">`;
        group.options.forEach(opt => {
            propertyOptionsHtml += `<option value="${opt.value}">${opt.label}</option>`;
        });
        propertyOptionsHtml += '</optgroup>';
    });

    return `
        <div class="mapping-row" style="display: flex; gap: 5px; margin-bottom: 8px; align-items: flex-start;">
            <input type="text"
                   class="mapping-key-input"
                   value="${key}"
                   placeholder="속성 이름 (예: 체적)"
                   style="flex: 1; padding: 5px;">
            <div style="flex: 2; display: flex; flex-direction: column; gap: 5px;">
                <input type="text"
                       class="mapping-value-input"
                       value="${value}"
                       placeholder="표현식 (예: {BIM.Parameters.Volume}, {BIM.Parameters.Area} * 2)"
                       style="width: 100%; padding: 5px;">
                <select class="mapping-property-select"
                        style="width: 100%; padding: 5px; font-size: 11px;"
                        title="속성을 선택하면 입력란에 {속성명} 형태로 추가됩니다">
                    ${propertyOptionsHtml}
                </select>
            </div>
            <button type="button" class="remove-mapping-btn" style="padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; flex-shrink: 0;">
                🗑️
            </button>
        </div>
    `;
}

/**
 * 조건 빌더 이벤트 리스너 설정
 */
function setupConditionBuilderListeners() {
    // 조건 추가 버튼
    document.querySelectorAll('.add-condition-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const conditionsBuilder = e.target.closest('.conditions-builder');
            const editRow = conditionsBuilder.closest('.rule-edit-row');
            const newIndex = conditionsBuilder.querySelectorAll('.condition-row').length;

            // 어떤 테이블인지 확인
            let newConditionHtml;
            const isQuantityCalcRule = editRow.closest('#costcode-ruleset-table-container');  // 수량산출룰셋
            const isCostCodeRule = editRow.closest('#cost-code-assignment-ruleset-table-container');
            const isMemberMarkRule = editRow.closest('#member-mark-assignment-ruleset-table-container');
            const isClassificationRule = editRow.closest('#classification-ruleset');
            const isSpaceAssignmentRule = editRow.closest('#space-assignment-ruleset-table-container');
            const isSpaceClassificationRule = editRow.closest('#space-classification-ruleset-table-container');
            const isPropertyMappingRule = editRow.closest('#mapping-ruleset-table-container');

            if (isQuantityCalcRule) {
                // CostItem 속성 기반 조건 빌더 (수량산출룰셋)
                newConditionHtml = renderConditionRowForCI({}, newIndex);
            } else if (isCostCodeRule || isMemberMarkRule || isSpaceAssignmentRule) {
                // QuantityMember 속성 기반 조건 빌더
                newConditionHtml = renderConditionRowForQM({}, newIndex);
            } else if (isClassificationRule || isSpaceClassificationRule || isPropertyMappingRule) {
                // RawElement 속성 기반 조건 빌더
                newConditionHtml = renderConditionRowForRE({}, newIndex);
            } else {
                // Activity 기반 조건 빌더
                newConditionHtml = renderConditionRow({}, newIndex);
            }

            // 버튼 바로 위에 추가
            e.target.insertAdjacentHTML('beforebegin', newConditionHtml);

            // 새로 추가된 행의 삭제 버튼에도 이벤트 추가
            setupConditionBuilderListeners();
        });
    });

    // 조건 삭제 버튼
    document.querySelectorAll('.remove-condition-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.condition-row').remove();
        });
    });

    // 맵핑 추가 버튼
    document.querySelectorAll('.add-mapping-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mappingsBuilder = e.target.closest('.mappings-builder');
            const newIndex = mappingsBuilder.querySelectorAll('.mapping-row').length;
            const newMappingHtml = renderMappingRow('', '', newIndex);

            // 버튼 바로 위에 추가
            e.target.insertAdjacentHTML('beforebegin', newMappingHtml);

            // 새로 추가된 행의 삭제 버튼에도 이벤트 추가
            setupConditionBuilderListeners();
        });
    });

    // 맵핑 삭제 버튼
    document.querySelectorAll('.remove-mapping-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.mapping-row').remove();
        });
    });

    // 맵핑 속성 콤보박스 선택 시 입력란에 추가
    document.querySelectorAll('.mapping-property-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const selectedProperty = e.target.value;
            if (!selectedProperty) return;

            const mappingRow = e.target.closest('.mapping-row');
            const valueInput = mappingRow.querySelector('.mapping-value-input');

            // 커서 위치에 {속성명} 추가
            const cursorPos = valueInput.selectionStart;
            const currentValue = valueInput.value;
            const beforeCursor = currentValue.substring(0, cursorPos);
            const afterCursor = currentValue.substring(cursorPos);

            valueInput.value = beforeCursor + `{${selectedProperty}}` + afterCursor;

            // 커서를 추가된 텍스트 뒤로 이동
            const newCursorPos = cursorPos + selectedProperty.length + 2;
            valueInput.setSelectionRange(newCursorPos, newCursorPos);
            valueInput.focus();

            // 콤보박스 초기화
            e.target.value = '';
        });
    });
}

// connections/static/connections/ui.js

// ... (기존 함수들 유지) ...

/**
 * [수정됨] 서버 데이터를 기반으로 동적인 BOQ 테이블을 특정 컨테이너에 렌더링합니다.
 * @param {Array} reportData - 중첩된 구조의 집계 데이터 배열
 * @param {Object} summaryData - 전체 합계 데이터
 * @param {Array} unitPriceTypes - 프로젝트의 단가 기준 목록
 * @param {String} targetContainerId - 테이블을 렌더링할 컨테이너 요소의 ID (예: 'boq-table-container' 또는 'sd-table-container')
 */
function renderBoqTable(
    reportData,
    summaryData,
    unitPriceTypes,
    targetContainerId
) {
    const container = document.getElementById(targetContainerId);
    console.log(
        `[DEBUG][Render] renderBoqTable called for container #${targetContainerId}.`
    );

    if (!container) {
        console.error(
            `[ERROR][Render] Target container #${targetContainerId} not found.`
        );
        showToast(
            `테이블을 표시할 영역(${targetContainerId})을 찾을 수 없습니다.`,
            'error'
        );
        return;
    }

    if (!reportData || reportData.length === 0) {
        container.innerHTML =
            '<p style="padding: 20px;">집계할 데이터가 없습니다.</p>';
        return;
    }

    // --- 1. 컬럼 정의 (DD/SD 구분) ---
    const isSdTab = targetContainerId === 'sd-table-container'; // SD 탭 여부 확인
    const columnsToUse = isSdTab ? currentSdBoqColumns : currentBoqColumns;
    const aliasesToUse = isSdTab ? sdBoqColumnAliases : boqColumnAliases;

    // ▼▼▼ [수정] SD 탭일 경우 특정 컬럼 제외 ▼▼▼
    const columnsToRender = columnsToUse.filter((col) => {
        if (isSdTab) {
            // SD 탭에서는 '합계금액', '단가기준' 등 제외
            return ![
                'total_cost_total',
                'material_cost_total',
                'labor_cost_total',
                'expense_cost_total',
                'unit_price_type_id',
            ].includes(col.id);
        }
        return true; // DD 탭은 모든 컬럼 포함
    });
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    if (columnsToRender.length === 0) {
        console.warn(
            `[WARN][Render] Column definitions are empty for ${targetContainerId}.`
        );
        container.innerHTML =
            '<p style="padding: 20px; color: orange;">테이블 컬럼 정보가 초기화되지 않았습니다.</p>';
        return;
    }

    // --- 2. 테이블 헤더 생성 ---
    let tableHtml = `<table class="boq-table" data-table-data='${JSON.stringify(
        {
            report: reportData,
            summary: summaryData,
            unitPriceTypes: unitPriceTypes,
        }
    )}'>
        <thead>
            <tr>`;
    columnsToRender.forEach((column) => {
        const displayName = aliasesToUse[column.id] || column.label;
        const thStyle = column.width ? `style="width: ${column.width};"` : '';
        const canEditName =
            !isSdTab &&
            (column.isDynamic ||
                ['name', 'unit_price_type_id'].includes(column.id)); // SD 탭은 편집 불가
        tableHtml += `<th draggable="${!isSdTab}" data-column-id="${
            column.id
        }" ${thStyle}>
                        ${displayName}
                        ${canEditName ? '<i class="col-edit-btn">✏️</i>' : ''}
                      </th>`;
    });
    tableHtml += `</tr></thead><tbody>`;

    // --- 3. 단가 기준 드롭다운 옵션 HTML 생성 (DD용) ---
    let unitPriceTypeOptionsHtml = '<option value="">-- 기준 선택 --</option>';
    if (!isSdTab && unitPriceTypes && unitPriceTypes.length > 0) {
        // SD 탭에서는 생성 안 함
        unitPriceTypes.forEach((type) => {
            unitPriceTypeOptionsHtml += `<option value="${type.id}">${type.name}</option>`;
        });
    }
    const variousOptionHtml =
        '<option value="various" disabled>-- 다양함 --</option>';

    // --- 4. 재귀적으로 그룹 행 렌더링 ---
    let nodeCount = 0;
    function renderGroupNode(node) {
        const indent = node.level * 25;
        let rowTds = '';
        let rowHasMissingPrice = node.has_missing_price;

        if (node.level === 0) {
        }

        // ▼▼▼ [DEBUG] 첫 번째 노드의 display_values 확인 ▼▼▼
        if (nodeCount === 0) {
        }
        nodeCount++;
        // ▲▲▲ [DEBUG] 여기까지 ▲▲▲

        columnsToRender.forEach((column) => {
            let cellValue = '';
            let cellStyle = column.align ? `text-align: ${column.align};` : '';

            // --- [수정] 단가 기준 열 렌더링 로직 (DD 전용) ---
            if (column.id === 'unit_price_type_id' && !isSdTab) {
                // DD 탭에서만
                let optionsHtmlForSelect = '';
                // Determine the selected value, prioritizing node.unit_price_type_id, then lastSelectedUnitPriceTypeId
                const effectiveUnitPriceTypeId = node.unit_price_type_id === undefined ? lastSelectedUnitPriceTypeId : node.unit_price_type_id;

                if (effectiveUnitPriceTypeId === 'various') {
                    optionsHtmlForSelect += `<option value="various" disabled selected>-- 다양함 --</option>`;
                } else {
                    optionsHtmlForSelect += '<option value="">-- 기준 선택 --</option>'; // Default empty option
                }

                if (!isSdTab && unitPriceTypes && unitPriceTypes.length > 0) {
                    unitPriceTypes.forEach((type) => {
                        const isSelected = type.id === effectiveUnitPriceTypeId;
                        optionsHtmlForSelect += `<option value="${type.id}" ${isSelected ? 'selected' : ''}>${type.name}</option>`;
                    });
                }

                const titleAttr = rowHasMissingPrice
                    ? 'title="주의: 일부 하위 항목의 단가 정보가 누락되어 합계가 부정확할 수 있습니다."'
                    : '';
                const warningClass = rowHasMissingPrice
                    ? 'missing-price-warning'
                    : '';

                cellValue = `<td style="${cellStyle}" class="${warningClass}" ${titleAttr}>
                                 <select class="unit-price-type-select" data-item-ids='${JSON.stringify(
                                     node.item_ids
                                 )}'>
                                     ${optionsHtmlForSelect}
                                 </select>
                              </td>`;
            }
            // --- 다른 컬럼 값 렌더링 (DD/SD 공통 처리) ---
            else {
                let displayValue = '';
                switch (column.id) {
                    case 'name':
                        displayValue = `<span style="padding-left: ${
                            indent + 10
                        }px;">${node.name}</span>`;
                        break;
                    case 'quantity':
                    case 'count':
                        displayValue = node[column.id];
                        break; // 숫자
                    // 비용 관련 컬럼들 (SD에서는 필터링됨)
                    case 'material_cost_unit':
                    case 'material_cost_total':
                    case 'labor_cost_unit':
                    case 'labor_cost_total':
                    case 'expense_cost_unit':
                    case 'expense_cost_total':
                    case 'total_cost_unit':
                    case 'total_cost_total':
                        displayValue = node[column.id] || '0.0000';
                        break;
                    // 동적 표시 필드
                    default:
                        // ▼▼▼ [수정] 서버에서 __ → _ 변환하므로 동일하게 변환 ▼▼▼
                        const displayKey = column.id.replace(/__/g, '_');
                        displayValue = node.display_values[displayKey] || '';

                        // ▼▼▼ [DEBUG] 값을 못 찾는 경우 로그 출력 ▼▼▼
                        if (nodeCount === 1 && !displayValue && column.isDynamic) {
                        }
                        // ▲▲▲ [DEBUG] 여기까지 ▲▲▲
                        // ▲▲▲ [수정] 여기까지 ▲▲▲
                        break;
                }
                const warningClass =
                    rowHasMissingPrice && column.id.includes('_cost_')
                        ? 'missing-price-warning-value'
                        : '';
                cellValue = `<td style="${cellStyle}" class="${warningClass}">${displayValue}</td>`;
            }
            rowTds += cellValue;
        });

        tableHtml += `<tr class="boq-group-header group-level-${
            node.level
        }" data-item-ids='${JSON.stringify(
            node.item_ids
        )}' data-current-type-id="${node.unit_price_type_id || ''}">
                        ${rowTds}
                      </tr>`;

        if (node.children && node.children.length > 0) {
            node.children.forEach(renderGroupNode);
        }
    }

    reportData.forEach(renderGroupNode);

    // --- 5. 테이블 푸터 (총계) 생성 ---
    let footerTds = '';
    columnsToRender.forEach((column) => {
        let cellValue = '';
        let cellStyle = column.align ? `text-align: ${column.align};` : '';
        switch (column.id) {
            case 'name':
                cellValue = '총계';
                break;
            case 'quantity':
                cellValue = summaryData.total_quantity;
                break;
            case 'count':
                cellValue = summaryData.total_count;
                break;
            // 비용 관련 (SD 탭에서는 필터링 됨)
            case 'material_cost_total':
                cellValue = summaryData.total_material_cost;
                break;
            case 'labor_cost_total':
                cellValue = summaryData.total_labor_cost;
                break;
            case 'expense_cost_total':
                cellValue = summaryData.total_expense_cost;
                break;
            case 'total_cost_total':
                cellValue = summaryData.total_total_cost;
                break;
            default:
                cellValue = '';
        }
        footerTds += `<td style="${cellStyle}">${cellValue}</td>`;
    });

    tableHtml += `</tbody>
            <tfoot>
                <tr class="boq-summary-row">${footerTds}</tr>
            </tfoot>
        </table>`;

    container.innerHTML = tableHtml;
    console.log(
        `[DEBUG][Render] Table HTML generated for #${targetContainerId}.`
    );

    // --- 6. 드롭다운 초기 값 설정 (DD 탭에서만 실행) ---
    if (!isSdTab) {
        // DD 탭에서만
        container
            .querySelectorAll('.unit-price-type-select')
            .forEach((select) => {
                const row = select.closest('tr');
                const currentTypeId = row.dataset.currentTypeId;
                if (currentTypeId) {
                    select.value = currentTypeId;
                }
            });
    }

    // ▼▼▼ [추가] SortableJS를 초기화하여 컬럼 순서 변경을 활성화합니다. ▼▼▼
    // isSdTab이 false일 때만 (즉, DD 탭에서만) 컬럼 순서 변경을 활성화합니다.
    if (!isSdTab) {
        const table = container.querySelector('table.boq-table');
        if (table) {
            const headerRow = table.querySelector('thead tr');
            if (headerRow) {
                Sortable.create(headerRow, {
                    animation: 150,
                    onEnd: function (evt) {
                        // 순서가 변경된 컬럼 ID들을 가져옵니다.
                        const newOrder = Array.from(evt.target.children).map(
                            (th) => th.dataset.columnId
                        );

                        // currentBoqColumns 배열을 새 순서에 맞게 재정렬합니다.
                        currentBoqColumns.sort((a, b) => {
                            return newOrder.indexOf(a.id) - newOrder.indexOf(b.id);
                        });

                        // 변경된 순서를 저장하고 테이블을 다시 생성합니다.
                        saveBoqColumnSettings(); // app.js에 정의될 함수
                        generateBoqReport(true); // 테이블을 다시 그려서 변경사항을 완전히 적용
                        showToast('컬럼 순서가 저장되었습니다.', 'info');
                    },
                });
            }
        }
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲
}
// ▲▲▲ [교체] 여기까지 입니다 ▲▲▲

// ▼▼▼ [수정] updateBoqDetailsPanel 함수 전체를 아래 코드로 교체해주세요 ▼▼▼
/**
 * [수정됨] 중앙 하단 패널에 포함된 산출항목 목록 테이블 (비용 정보 포함)을 렌더링하고,
 * 첫 항목의 상세 정보 및 BIM 객체 비용 요약을 표시합니다.
 * @param {Array<String>} itemIds - 표시할 CostItem의 ID 배열
 */
function updateBoqDetailsPanel(itemIds) {
    const listContainer = document.getElementById('boq-item-list-container');
    // 디버깅 로그 추가
    console.log(
        `[DEBUG][UI] updateBoqDetailsPanel called with ${itemIds?.length} item IDs. Initial rendering without selection.`
    );

    if (!itemIds || itemIds.length === 0) {
        listContainer.innerHTML =
            '<p style="padding: 10px;">이 그룹에 포함된 산출항목이 없습니다.</p>';
        // 초기 상태: 상세/요약 패널도 초기화
        renderBoqItemProperties(null);
        renderBoqBimObjectCostSummary(null);
        return;
    }

    // loadedCostItems에서 ID가 일치하는 항목들을 찾음 (items_detail에서 온 데이터)
    const itemsToRender = loadedCostItems.filter((item) =>
        itemIds.includes(item.id)
    );
    if (itemsToRender.length === 0) {
        listContainer.innerHTML =
            '<p style="padding: 10px;">산출항목 데이터를 찾을 수 없습니다.</p>';
        // 초기 상태: 상세/요약 패널도 초기화
        renderBoqItemProperties(null);
        renderBoqBimObjectCostSummary(null);
        return;
    }

    // --- 테이블 헤더 정의 (기존 3열 + 비용 + BIM 연동 버튼) ---
    const headers = [
        { id: 'cost_code_name', label: '산출항목' },
        { id: 'quantity', label: '수량', align: 'right' },
        { id: 'unit_price_type_name', label: '단가기준' },
        { id: 'material_cost_unit', label: '재료비단가', align: 'right' },
        { id: 'labor_cost_unit', label: '노무비단가', align: 'right' },
        { id: 'expense_cost_unit', label: '경비단가', align: 'right' },
        { id: 'total_cost_unit', label: '합계단가', align: 'right' },
        { id: 'total_cost_total', label: '합계금액', align: 'right' },
        { id: 'material_cost_total', label: '재료비', align: 'right' },
        { id: 'labor_cost_total', label: '노무비', align: 'right' },
        { id: 'expense_cost_total', label: '경비', align: 'right' },
        { id: 'linked_member_name', label: '연관 부재' }, // 연관 부재 이름 열 추가
        { id: 'linked_raw_name', label: 'BIM 원본 객체' }, // BIM 원본 이름 열 추가
        { id: 'actions', label: 'BIM 연동', align: 'center' },
    ];

    // --- 테이블 HTML 생성 ---
    let tableHtml = `<table class="boq-item-list-table"><thead><tr>`;
    headers.forEach(
        (h) =>
            (tableHtml += `<th style="text-align: ${h.align || 'left'};">${
                h.label
            }</th>`)
    );
    tableHtml += `</tr></thead><tbody>`;

    // --- 각 CostItem 행 생성 ---
    itemsToRender.forEach((item) => {
        // --- 이름 및 비용 정보 조회 로직 ---
        const costItemName = item.cost_code_name || '(이름 없는 항목)';
        const qtyStr = item.quantity || '0.0000'; // 백엔드에서 문자열로 옴

        // 연관 부재 정보 찾기
        const member = item.quantity_member_id
            ? loadedQuantityMembers.find(
                  (m) => m.id === item.quantity_member_id
              )
            : null;
        const memberName = member
            ? member.name || '(이름 없는 부재)'
            : '(연관 부재 없음)';

        // BIM 원본 객체 정보 찾기
        const rawElement = member?.raw_element_id
            ? allRevitData.find((el) => el.id === member.raw_element_id)
            : null;
        const rawElementName = rawElement
            ? rawElement.raw_data?.Name || '(이름 없는 원본)'
            : '(BIM 원본 없음)';

        // 단가 기준 이름 찾기
        const unitPriceType = loadedUnitPriceTypesForBoq.find(
            (t) => t.id === item.unit_price_type_id
        ); // loadedUnitPriceTypesForBoq 사용
        const unitPriceTypeName = unitPriceType
            ? unitPriceType.name
            : '(미지정)';

        // 비용 정보 (loadedCostItems에 이미 문자열로 포함되어 있음)
        const matUnit = item.material_cost_unit || '0.0000';
        const labUnit = item.labor_cost_unit || '0.0000';
        const expUnit = item.expense_cost_unit || '0.0000';
        const totalUnit = item.total_cost_unit || '0.0000';
        const totalAmount = item.total_cost_total || '0.0000';
        const matAmount = item.material_cost_total || '0.0000';
        const labAmount = item.labor_cost_total || '0.0000';
        const expAmount = item.expense_cost_total || '0.0000';

        // BIM 객체 연동 버튼
        let bimButtonHtml = '';
        if (rawElement) {
            // rawElement가 있을 때만 버튼 생성
            bimButtonHtml = `<button class="select-in-client-btn-detail" data-cost-item-id="${item.id}" title="연동 프로그램에서 선택 확인">👁️</button>`;
        }

        // ▼▼▼ 수정: selected 클래스를 초기 렌더링 시 제거 ▼▼▼
        tableHtml += `<tr data-item-id="${item.id}">`; // selected 클래스 제거
        // ▲▲▲ 수정 끝 ▲▲▲
        headers.forEach((h) => {
            let value = '';
            let style = h.align ? `style="text-align: ${h.align};"` : '';
            switch (h.id) {
                case 'cost_code_name':
                    value = costItemName;
                    break;
                case 'quantity':
                    value = qtyStr;
                    break; // 문자열 그대로 사용
                case 'unit_price_type_name':
                    value = unitPriceTypeName;
                    break;
                case 'material_cost_unit':
                    value = matUnit;
                    break;
                case 'labor_cost_unit':
                    value = labUnit;
                    break;
                case 'expense_cost_unit':
                    value = expUnit;
                    break;
                case 'total_cost_unit':
                    value = totalUnit;
                    break;
                case 'total_cost_total':
                    value = totalAmount;
                    break;
                case 'material_cost_total':
                    value = matAmount;
                    break;
                case 'labor_cost_total':
                    value = labAmount;
                    break;
                case 'expense_cost_total':
                    value = expAmount;
                    break;
                case 'linked_member_name':
                    value = memberName;
                    break; // 추가된 열
                case 'linked_raw_name':
                    value = rawElementName;
                    break; // 추가된 열
                case 'actions':
                    value = bimButtonHtml;
                    style = `style="text-align: center;"`;
                    break;
                default:
                    value = item[h.id] || '';
            }
            tableHtml += `<td ${style}>${value}</td>`;
        });
        tableHtml += `</tr>`;
    });

    tableHtml += '</tbody></table>';
    listContainer.innerHTML = tableHtml;
    console.log(
        '[DEBUG][UI] CostItem list table rendered in details panel (no initial selection).'
    );

    // ▼▼▼ 수정: 첫 번째 항목 자동 선택 및 상세/요약 렌더링 호출 제거 ▼▼▼
    // const firstItemId = itemsToRender[0].id; // 제거
    // renderBoqItemProperties(firstItemId);    // 제거
    // renderBoqBimObjectCostSummary(firstItemId); // 제거

    // ▼▼▼ 추가: 대신 초기 상태로 상세/요약 패널 렌더링 호출 ▼▼▼
    renderBoqItemProperties(null);
    renderBoqBimObjectCostSummary(null);
    // ▲▲▲ 추가 끝 ▲▲▲
}
// ▲▲▲ [수정] 여기까지 입니다 ▲▲▲

/**
 * [수정됨] 선택된 CostItem과 연관된 BIM 객체(RawElement)를 찾고,
 * 해당 BIM 객체에 연결된 모든 CostItem들의 비용을 합산하여 표시합니다.
 * @param {String | null} selectedCostItemId - 현재 중앙 하단 목록에서 선택된 CostItem의 ID
 */
function renderBoqBimObjectCostSummary(selectedCostItemId) {
    const container = document.getElementById('boq-bim-object-cost-summary');
    const header = document.getElementById('boq-bim-object-summary-header');
    // 디버깅 로그 추가
    console.log(
        `[DEBUG][UI] renderBoqBimObjectCostSummary called for CostItem ID: ${selectedCostItemId}`
    );

    // ▼▼▼ 수정: itemId가 null일 경우 초기 메시지 명확화 ▼▼▼
    if (!selectedCostItemId) {
        header.textContent = 'BIM 객체 비용 요약';
        container.innerHTML =
            '<p style="padding: 10px;">하단 목록에서 산출항목을 선택하면 연관된 BIM 객체의 비용 요약이 여기에 표시됩니다.</p>'; // 메시지 수정
        console.log(
            '[DEBUG][UI] Cleared BIM object cost summary panel as no item is selected.'
        ); // 디버깅
        return;
    }
    // ▲▲▲ 수정 끝 ▲▲▲

    // [수정] loadedCostItems 대신 loadedDdCostItems 사용
    const selectedCostItem = loadedDdCostItems.find(
        (item) => item.id === selectedCostItemId
    );
    const member = selectedCostItem?.quantity_member_id
        ? loadedQuantityMembers.find(
              (m) => m.id === selectedCostItem.quantity_member_id
          )
        : null;
    const rawElement = member?.raw_element_id
        ? allRevitData.find((el) => el.id === member.raw_element_id)
        : null;

    if (!rawElement) {
        header.textContent = 'BIM 객체 비용 요약';
        container.innerHTML =
            '<p style="padding: 10px;">선택된 항목과 연관된 BIM 객체가 없습니다.</p>';
        return;
    }

    const rawElementId = rawElement.id;
    const rawElementName =
        rawElement.raw_data?.Name || `(ID: ${rawElement.element_unique_id})`;
    header.textContent = `[${rawElementName}] 비용 요약`;
    console.log(
        `[DEBUG][UI] Found linked BIM object: ${rawElementName} (ID: ${rawElementId})`
    ); // 디버깅

    // 이 BIM 객체(rawElementId)에 연결된 모든 QuantityMember를 찾습니다.
    const linkedMemberIds = loadedQuantityMembers
        .filter((qm) => qm.raw_element_id === rawElementId)
        .map((qm) => qm.id);

    // 이 QuantityMember들에 연결된 모든 CostItem을 찾습니다.
    // [수정] loadedCostItems 대신 loadedDdCostItems 사용
    const relatedCostItems = loadedDdCostItems.filter((ci) =>
        linkedMemberIds.includes(ci.quantity_member_id)
    );
    console.log(
        `[DEBUG][UI] Found ${relatedCostItems.length} related CostItems for this BIM object.`
    ); // 디버깅

    // --- 상세 로깅: 비용 합산 전 데이터 확인 ---

    if (relatedCostItems.length === 0) {
        container.innerHTML =
            '<p style="padding: 10px;">이 BIM 객체와 연관된 산출항목이 없습니다.</p>';
        return;
    }

    // 비용 합계 계산 (parseFloat 사용 유지, || '0'으로 NaN 방지)
    let totalMat = 0;
    let totalLab = 0;
    let totalExp = 0;
    let totalTot = 0;
    let tableHtml = `<table class="boq-item-list-table">
        <thead>
            <tr>
                <th>공사코드</th>
                <th>이름</th>
                <th style="text-align: right;">수량</th>
                <th style="text-align: right;">합계금액</th>
                <th style="text-align: right;">재료비</th>
                <th style="text-align: right;">노무비</th>
                <th style="text-align: right;">경비</th>
            </tr>
        </thead>
        <tbody>`;

    relatedCostItems.forEach((item) => {
        // 백엔드에서 문자열로 받은 값을 parseFloat로 변환, 없으면 0으로 처리
        const mat = parseFloat(item.material_cost_total || '0');
        const lab = parseFloat(item.labor_cost_total || '0');
        const exp = parseFloat(item.expense_cost_total || '0');
        const tot = parseFloat(item.total_cost_total || '0');

        totalMat += mat;
        totalLab += lab;
        totalExp += exp;
        totalTot += tot;

        // ▼▼▼ 수정: cost_code 정보 조회 로직 보강 ▼▼▼
        let code = '?';
        let name = item.cost_code_name || '?'; // cost_code_name 필드 활용
        const costCode = loadedCostCodes.find(
            (cc) => cc.id === item.cost_code_id
        );
        if (costCode) {
            code = costCode.code;
            // name = costCode.name; // cost_code_name이 있으므로 덮어쓰지 않아도 됨
        }
        // ▲▲▲ 수정 끝 ▲▲▲

        // quantity도 문자열로 오므로 parseFloat 후 toFixed 사용
        const qty = parseFloat(item.quantity || 0).toFixed(4);

        tableHtml += `
            <tr>
                <td>${escapeHtml(code)}</td>
                <td>${escapeHtml(name)}</td>
                <td style="text-align: right;">${qty}</td>
                <td style="text-align: right;">${tot.toFixed(4)}</td>
                <td style="text-align: right;">${mat.toFixed(4)}</td>
                <td style="text-align: right;">${lab.toFixed(4)}</td>
                <td style="text-align: right;">${exp.toFixed(4)}</td>
            </tr>`;
    });

    tableHtml += `
        </tbody>
        <tfoot>
            <tr class="boq-summary-row">
                <td colspan="3" style="text-align: center; font-weight: bold;">합계</td>
                <td style="text-align: right;">${totalTot.toFixed(4)}</td>
                <td style="text-align: right;">${totalMat.toFixed(4)}</td>
                <td style="text-align: right;">${totalLab.toFixed(4)}</td>
                <td style="text-align: right;">${totalExp.toFixed(4)}</td>
            </tr>
        </tfoot>
        </table>`;

    container.innerHTML = tableHtml;
}
// ▲▲▲ [신규] 여기까지 입니다 ▲▲▲

// ▼▼▼ [수정] renderBoqItemProperties 함수 수정 ▼▼▼
/**
 * [수정됨] ID에 해당하는 CostItem의 상세 속성을 **왼쪽 상세정보 패널**에 렌더링합니다.
 * @param {String | null} itemId - 상세 정보를 표시할 CostItem의 ID
 */
function renderBoqItemProperties(itemId) {
    currentBoqDetailItemId = itemId; // 현재 선택된 아이템 ID 업데이트
    // 디버깅 로그 추가
    console.log(
        `[DEBUG][UI] renderBoqItemProperties called for Item ID: ${itemId}. Rendering left details panel ONLY.`
    );

    // ▼▼▼ 제거: 하단 테이블 선택 상태 업데이트 로직 제거 ▼▼▼
    // const listContainer = document.getElementById('boq-item-list-container');
    // listContainer.querySelectorAll('tr[data-item-id]').forEach((row) => {
    //     row.classList.toggle('selected', row.dataset.itemId === String(itemId));
    // });
    // ▲▲▲ 제거 끝 ▲▲▲

    // 왼쪽 상세 패널의 컨테이너들
    const memberContainer = document.getElementById(
        'boq-details-member-container'
    );
    const markContainer = document.getElementById('boq-details-mark-container');
    const rawContainer = document.getElementById('boq-details-raw-container');

    // 패널 초기화 (itemId가 null일 경우)
    if (!itemId) {
        const initialMsg = '<p>하단 목록에서 항목을 선택하세요.</p>'; // 초기 메시지 변경
        memberContainer.innerHTML = initialMsg;
        markContainer.innerHTML = initialMsg;
        rawContainer.innerHTML = initialMsg;
        console.log(
            '[DEBUG][UI] Cleared left details panel as no item is selected.'
        ); // 디버깅
        return;
    }

    const costItem = loadedCostItems.find(
        (item) => item.id.toString() === itemId.toString()
    );
    if (!costItem) {
        memberContainer.innerHTML = '<p>항목 정보를 찾을 수 없습니다.</p>';
        markContainer.innerHTML = '';
        rawContainer.innerHTML = '';
        return;
    }

    const member = costItem.quantity_member_id
        ? loadedQuantityMembers.find(
              (m) => m.id.toString() === costItem.quantity_member_id.toString()
          )
        : null;

    // 1. 부재 속성 렌더링
    renderPropertyTable(memberContainer, member?.properties, '부재 속성');

    // 2. 일람부호 속성 렌더링
    const mark = member?.member_mark_id
        ? loadedMemberMarks.find(
              (m) => m.id.toString() === member.member_mark_id.toString()
          )
        : null;
    renderPropertyTable(
        markContainer,
        mark?.properties,
        mark ? `${mark.mark} (일람부호 속성)` : '연관된 일람부호 없음'
    );

    // 3. BIM 원본 데이터 렌더링 (단순화된 키-값)
    const rawElement = member?.raw_element_id
        ? allRevitData.find(
              (el) => el.id.toString() === member.raw_element_id.toString()
          )
        : null;
    const rawProperties = {};
    if (rawElement?.raw_data) {
        // costItems_api에서 만든 raw_element_properties 구조를 활용하거나 유사하게 재구성
        const rawData = rawElement.raw_data;
        for (const key in rawData) {
            if (
                !['Parameters', 'TypeParameters'].includes(key) &&
                typeof rawData[key] !== 'object'
            ) {
                rawProperties[key] = rawData[key];
            }
        }
        for (const key in rawData.TypeParameters || {})
            rawProperties[`Type.${key}`] = rawData.TypeParameters[key];
        for (const key in rawData.Parameters || {})
            rawProperties[key] = rawData.Parameters[key];
    }
    renderPropertyTable(
        rawContainer,
        rawProperties,
        rawElement
            ? `${rawElement.raw_data?.Name || '원본 객체'} (BIM 원본)`
            : '연관된 BIM 원본 없음'
    );
    console.log(
        `[DEBUG][UI] Left details panel rendered for Item ID: ${itemId}`
    ); // 디버깅
}

/**
 * 속성 객체를 받아 테이블 HTML을 생성하고 컨테이너에 렌더링하는 헬퍼 함수
 * @param {HTMLElement} container - 테이블을 표시할 DOM 요소
 * @param {Object|null} properties - 표시할 속성 객체
 * @param {String} title - 테이블 제목
 */
function renderPropertyTable(container, properties, title) {
    let headerHtml = `<h5>${title}</h5>`;
    if (!properties || Object.keys(properties).length === 0) {
        container.innerHTML = headerHtml + '<p>표시할 속성이 없습니다.</p>';
        return;
    }

    let tableHtml = `<table class="properties-table"><thead><tr><th>속성</th><th>값</th></tr></thead><tbody>`;
    Object.keys(properties)
        .sort()
        .forEach((key) => {
            tableHtml += `<tr><td>${key}</td><td>${properties[key]}</td></tr>`;
        });
    tableHtml += '</tbody></table>';
    container.innerHTML = headerHtml + tableHtml;
}
// ▲▲▲ [수정] 여기까지 입니다 ▲▲▲

// ... (파일의 나머지 부분은 그대로 유지) ...
/**
 * 서버로부터 받은 집계 데이터를 기반으로 동적인 BOQ 테이블을 렌더링합니다.
 * @param {Array} reportData - 중첩된 구조의 집계 데이터 배열
 * @param {Object} summaryData - 전체 합계 데이터
 */

// ▼▼▼ [제거됨] renderBoqDisplayFieldControls 함수는 boq_detailed_estimation_handlers.js에 있습니다 ▼▼▼
// 이 함수가 중복 정의되어 있어서 체크박스가 언체크 상태로 렌더링되는 문제를 일으켰습니다.
// boq_detailed_estimation_handlers.js의 함수를 사용하도록 이 중복 함수를 제거합니다.


// ▼▼▼ [교체] 기존 renderBimPropertiesTable 함수 전체를 아래 코드로 교체 ▼▼▼
/**
 * [수정됨] 현재 활성화된 탭 컨텍스트('data-management' 또는 'space-management')에 따라
 * 올바른 위치에 선택된 단일 BIM 객체의 속성 테이블을 렌더링합니다.
 * @param {string} contextPrefix - 'data-management' 또는 'space-management'
 */
function renderBimPropertiesTable(contextPrefix) {
    console.log(
        `[DEBUG][Render] Rendering BIM Properties table for context: ${contextPrefix}`
    );

    const containerId =
        contextPrefix === 'space-management'
            ? 'sm-selected-bim-properties-container'
            : 'selected-bim-properties-container';
    const container = document.getElementById(containerId);
    const state = viewerStates[contextPrefix];

    if (!container) {
        console.warn(
            `[WARN][Render] BIM Properties container not found for ID: ${containerId}`
        );
        return;
    }
    if (!state) {
        console.warn(
            `[WARN][Render] Viewer state not found for context: ${contextPrefix}`
        );
        container.innerHTML = '<p>뷰 상태 정보를 찾을 수 없습니다.</p>';
        return;
    }

    if (state.selectedElementIds.size !== 1) {
        container.innerHTML =
            '<p>BIM 속성을 보려면 테이블에서 하나의 항목만 선택하세요.</p>';
        return;
    }

    const selectedId = state.selectedElementIds.values().next().value;
    const fullBimObject = allRevitData.find((item) => item.id === selectedId);
    console.log(
        `[DEBUG][Render] BIM Properties: Rendering for element ID: ${selectedId}`
    );

    if (!fullBimObject || !fullBimObject.raw_data) {
        container.innerHTML =
            '<p>선택된 항목의 BIM 원본 데이터를 찾을 수 없습니다.</p>';
        console.warn(
            `[WARN][Render] Raw data not found for selected element ID: ${selectedId}`
        );
        return;
    }

    const rawData = fullBimObject.raw_data;
    let html = '';

    // System Properties (Cost Estimator 관리 속성)
    html += '<div class="property-section">';
    html += '<h4>BIM 시스템 속성 (BIM.System.*)</h4>';
    html += '<table class="properties-table"><tbody>';
    html += `<tr><td class="prop-name">${getDisplayFieldName('id')}</td><td class="prop-value">${fullBimObject.id || 'N/A'}</td></tr>`;
    html += `<tr><td class="prop-name">${getDisplayFieldName('element_unique_id')}</td><td class="prop-value">${fullBimObject.element_unique_id || 'N/A'}</td></tr>`;
    html += `<tr><td class="prop-name">${getDisplayFieldName('geometry_volume')}</td><td class="prop-value">${fullBimObject.geometry_volume || 'N/A'}</td></tr>`;

    // classification_tags는 배열이므로 특별 처리
    const tagsDisplay = Array.isArray(fullBimObject.classification_tags) && fullBimObject.classification_tags.length > 0
        ? fullBimObject.classification_tags.join(', ')
        : 'N/A';
    html += `<tr><td class="prop-name">${getDisplayFieldName('classification_tags')}</td><td class="prop-value">${tagsDisplay}</td></tr>`;
    html += '</tbody></table>';
    html += '</div>';

    // ▼▼▼ [제거] "기본 정보" 섹션 제거 - Attributes에 통합됨 ▼▼▼
    // Name, IfcClass, ElementId, UniqueId는 이제 Attributes.* 로 평탄화되어 표시됨
    // ▲▲▲ [제거] 여기까지 ▲▲▲

    // ▼▼▼ [수정] 동적 카테고리 감지 - BIM 도구에서 보낸 모든 평탄화된 필드를 자동 그룹화 ▼▼▼
    const FIXED_FIELDS = ['Name', 'IfcClass', 'ElementId', 'UniqueId', 'Parameters', 'TypeParameters', 'System'];
    const dynamicCategories = {}; // 카테고리명 -> [{key, value}]

    // 모든 raw_data 필드를 순회하면서 동적으로 카테고리 추출
    for (const [key, value] of Object.entries(rawData)) {
        // 고정 필드는 스킵 (이미 위에서 또는 아래에서 표시)
        if (FIXED_FIELDS.includes(key)) {
            continue;
        }

        // 평탄화된 필드 감지 (점이 포함된 필드명: "CategoryName.PropertyName")
        if (key.includes('.')) {
            const category = key.split('.')[0]; // 첫 번째 점 앞의 카테고리명 추출
            if (!dynamicCategories[category]) {
                dynamicCategories[category] = [];
            }
            dynamicCategories[category].push({ key, value });
        }
    }

    // 각 동적 카테고리별로 섹션 표시
    for (const [category, fields] of Object.entries(dynamicCategories)) {
        if (fields.length > 0) {
            html += '<div class="property-section">';
            html += `<h4>${category.replace(/_/g, ' ')}</h4>`;
            html += '<table class="properties-table"><tbody>';
            for (const { key, value } of fields) {
                const displayName = getDisplayFieldName(key);
                html += `<tr><td class="prop-name">${displayName}</td><td class="prop-value">`;
                html += renderNestedValue(value, 1);
                html += '</td></tr>';
            }
            html += '</tbody></table>';
            html += '</div>';
        }
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // Parameters (기존 Revit 데이터와 호환성 유지)
    if (rawData.Parameters && Object.keys(rawData.Parameters).length > 0) {
        html += '<div class="property-section">';
        html += '<h4>BIM 파라메터 (BIM.Parameters.*)</h4>';
        html += '<table class="properties-table"><tbody>';
        for (const [key, value] of Object.entries(rawData.Parameters)) {
            // Skip Geometry parameter (too large)
            if (key === 'Geometry') continue;

            const displayName = getDisplayFieldName(key);
            html += `<tr><td class="prop-name">${displayName}</td><td class="prop-value">`;
            html += renderNestedValue(value, 1);
            html += '</td></tr>';
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    // TypeParameters (기존 Revit 데이터와 호환성 유지)
    if (rawData.TypeParameters && Object.keys(rawData.TypeParameters).length > 0) {
        html += '<div class="property-section">';
        html += '<h4>BIM 타입 파라메터 (BIM.TypeParameters.*)</h4>';
        html += '<table class="properties-table"><tbody>';
        for (const [key, value] of Object.entries(rawData.TypeParameters)) {
            const displayName = getDisplayFieldName(`TypeParameters.${key}`);
            html += `<tr><td class="prop-name">${displayName}</td><td class="prop-value">`;
            html += renderNestedValue(value, 1);
            html += '</td></tr>';
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    // System (Geometry 등)
    if (rawData.System && Object.keys(rawData.System).length > 0) {
        html += '<div class="property-section">';
        html += '<h4>시스템 (BIM.System.*)</h4>';
        html += '<table class="properties-table"><tbody>';
        for (const [key, value] of Object.entries(rawData.System)) {
            // Skip Geometry parameter (too large)
            if (key === 'Geometry') continue;

            const displayName = getDisplayFieldName(`System.${key}`);
            html += `<tr><td class="prop-name">${displayName}</td><td class="prop-value">`;
            html += renderNestedValue(value, 1);
            html += '</td></tr>';
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    container.innerHTML = html;
    console.log(
        `[DEBUG][Render] BIM Properties table rendered successfully in #${containerId}.`
    );
}

// Helper function to render nested values (copied from three_d_viewer.js)
function renderNestedValue(value, depth = 0) {
    if (value === null || value === undefined) {
        return '<span class="property-value">N/A</span>';
    }

    // For arrays
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '<span class="property-value">[]</span>';
        }

        // If array is too long, show count
        if (value.length > 20) {
            return `<span class="property-value">[Array with ${value.length} items]</span>`;
        }

        let html = '<div class="nested-array" style="margin-left: ' + (depth * 15) + 'px;">';
        value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
                html += `<div class="property-row"><span class="property-label">[${index}]:</span>`;
                html += renderNestedValue(item, depth + 1);
                html += '</div>';
            } else {
                html += `<div class="property-row"><span class="property-label">[${index}]:</span><span class="property-value">${item}</span></div>`;
            }
        });
        html += '</div>';
        return html;
    }

    // For objects
    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) {
            return '<span class="property-value">{}</span>';
        }

        let html = '<div class="nested-object" style="margin-left: ' + (depth * 15) + 'px;">';
        for (const [key, val] of Object.entries(value)) {
            html += `<div class="property-row"><span class="property-label">${key}:</span>`;
            html += renderNestedValue(val, depth + 1);
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    // For primitive values
    return `<span class="property-value">${value}</span>`;
}
// ▲▲▲ [교체] 여기까지 ▲▲▲

function renderAssignedTagsTable(contextPrefix) {
    const listContainer = document.getElementById('selected-tags-list');
    const state = viewerStates[contextPrefix];

    if (!listContainer || !state) return;

    if (state.selectedElementIds.size === 0) {
        listContainer.innerHTML = '항목을 선택하세요.';
        return;
    }

    const selectedItems = allRevitData.filter((item) =>
        state.selectedElementIds.has(item.id)
    );
    const assignedTags = new Set();
    selectedItems.forEach((item) => {
        if (item.classification_tags)
            item.classification_tags.forEach((tag) => assignedTags.add(tag));
    });

    if (assignedTags.size === 0) {
        listContainer.innerHTML = '할당된 분류가 없습니다.';
        return;
    }

    listContainer.innerHTML = Array.from(assignedTags)
        .sort()
        .map((tag) => `<div>${tag}</div>`)
        .join('');
}
/**
 * [수정] '선택항목 분류' 탭의 내용을 렌더링하는 범용 함수
 * @param {string} contextPrefix
 */
function renderAssignedTagsTable(contextPrefix) {
    const listContainer = document.getElementById('selected-tags-list');
    const state = viewerStates[contextPrefix];

    if (!listContainer || !state) return;

    if (state.selectedElementIds.size === 0) {
        listContainer.innerHTML = '항목을 선택하세요.';
        return;
    }

    const selectedItems = allRevitData.filter((item) =>
        state.selectedElementIds.has(item.id)
    );
    const assignedTags = new Set();
    selectedItems.forEach((item) => {
        if (item.classification_tags)
            item.classification_tags.forEach((tag) => assignedTags.add(tag));
    });

    if (assignedTags.size === 0) {
        listContainer.innerHTML = '할당된 분류가 없습니다.';
        return;
    }

    listContainer.innerHTML = Array.from(assignedTags)
        .sort()
        .map((tag) => `<div>${tag}</div>`)
        .join('');
}
/**
 * 서버에서 받은 공간분류 데이터를 위계적인 HTML 트리로 렌더링합니다.
 * @param {Array} spaces - 프로젝트의 모든 공간분류 데이터 배열
 */
function renderSpaceClassificationTree(spaces) {
    const container = document.getElementById('space-tree-container');
    if (!currentProjectId) {
        container.innerHTML = '<p>프로젝트를 선택하세요.</p>';
        return;
    }
    if (spaces.length === 0) {
        container.innerHTML =
            "<p>정의된 공간분류가 없습니다. '최상위 공간 추가' 버튼으로 시작하세요.</p>";
        return;
    }

    const spaceMap = {};
    const roots = [];
    spaces.forEach((space) => {
        spaceMap[space.id] = { ...space, children: [] };
    });

    Object.values(spaceMap).forEach((space) => {
        if (space.parent_id && spaceMap[space.parent_id]) {
            spaceMap[space.parent_id].children.push(space);
        } else {
            roots.push(space);
        }
    });

    function buildTreeHtml(nodes) {
        if (nodes.length === 0) return '';
        let html = '<ul>';
        nodes.forEach((node) => {
            const count = node.mapped_elements_count || 0;
            // ▼▼▼ [핵심 수정] span 태그에 view-assigned-btn 클래스를 추가합니다. ▼▼▼
            const countBadge =
                count > 0
                    ? `<span class="element-count-badge view-assigned-btn" title="할당된 객체 보기">${count}</span>`
                    : '';

            html += `
                <li data-id="${node.id}" data-name="${node.name}">
                    <div class="space-tree-item">
                        <span class="item-name">
                            <strong>${node.name}</strong>
                            ${countBadge}
                        </span>
                        <div class="item-actions">
                            <button class="assign-elements-btn" title="BIM 객체 할당">객체 할당</button>
                            <button class="add-child-space-btn" title="하위 공간 추가">+</button>
                            <button class="rename-space-btn" title="이름 수정">수정</button>
                            <button class="delete-space-btn" title="삭제">삭제</button>
                        </div>
                    </div>
                    ${buildTreeHtml(node.children)}
                </li>
            `;
        });
        html += '</ul>';
        return html;
    }

    container.innerHTML = buildTreeHtml(roots);
}
/**
 * 할당된 객체 목록을 모든 속성을 포함하는 2열(속성-값) 테이블로 모달창에 렌더링합니다.
 * @param {Array} elements - 할당된 객체 데이터 배열
 * @param {string} spaceName - 현재 공간의 이름
 */
function renderAssignedElementsModal(elements, spaceName) {
    const title = document.getElementById('assigned-elements-modal-title');
    const container = document.getElementById(
        'assigned-elements-table-container'
    );

    title.textContent = `'${spaceName}'에 할당된 BIM 객체 (${elements.length}개)`;

    if (elements.length === 0) {
        container.innerHTML =
            '<p style="padding: 20px;">할당된 객체가 없습니다.</p>';
        return;
    }

    // 2열 테이블 구조를 생성합니다.
    let tableHtml = `<table class="properties-table">
        <thead>
            <tr>
                <th style="width: 5%;"><input type="checkbox" id="unassign-select-all" title="전체 선택/해제"></th>
                <th style="width: 40%;">속성 (Property)</th>
                <th>값 (Value)</th>
            </tr>
        </thead>
        <tbody>`;

    // 각 객체별로 속성을 나열합니다.
    elements.forEach((item) => {
        const elementName =
            getValueForItem(item, 'Name') || `객체 (ID: ${item.id})`;

        // 각 객체를 구분하기 위한 헤더 행을 추가합니다.
        tableHtml += `
            <tr class="group-header" data-element-id="${item.id}">
                <td style="text-align: center;"><input type="checkbox" class="unassign-checkbox" value="${item.id}"></td>
                <td colspan="2"><strong>${elementName}</strong></td>
            </tr>
        `;

        // 해당 객체의 모든 속성을 수집합니다.
        const properties = [];
        const systemKeys = ['id', 'element_unique_id', 'geometry_volume', 'classification_tags'];
        const revitKeysSet = new Set();
        const raw = item.raw_data;

        if (raw) {
            if (raw.Parameters)
                Object.keys(raw.Parameters).forEach((k) => revitKeysSet.add(k));
            if (raw.TypeParameters)
                Object.keys(raw.TypeParameters).forEach((k) =>
                    revitKeysSet.add(`TypeParameters.${k}`)
                );
            Object.keys(raw).forEach((k) => {
                if (k !== 'Parameters' && k !== 'TypeParameters')
                    revitKeysSet.add(k);
            });
        }

        const allKeys = [...systemKeys, ...Array.from(revitKeysSet).sort()];

        // 속성 이름과 값을 테이블 행으로 추가합니다.
        allKeys.forEach((key) => {
            const value = getValueForItem(item, key);
            // 값이 있는 속성만 표시합니다.
            if (value !== '' && value !== null && value !== undefined) {
                tableHtml += `
                    <tr>
                        <td></td> 
                        <td>${key}</td>
                        <td>${value}</td>
                    </tr>
                `;
            }
        });
    });

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
}

/**
 * '공간분류 생성 룰셋' 데이터를 HTML 테이블 형태로 화면에 그립니다.
 * @param {Array} rules - 서버에서 받아온 룰셋 데이터 배열
 * @param {String} editId - 현재 편집 중인 규칙의 ID (새 규칙은 'new')
 */
function renderSpaceClassificationRulesetTable(rules, editId = null) {
    const container = document.getElementById(
        'space-classification-ruleset-table-container'
    );

    let tableHtml = `<table class="ruleset-table">
        <thead>
            <tr>
                <th style="width: 5%;">레벨</th>
                <th style="width: 12%;">위계 이름</th>
                <th style="width: 28%;">BIM 객체 필터</th>
                <th style="width: 13%;">이름 속성</th>
                <th style="width: 13%;">상위 연결 속성</th>
                <th style="width: 13%;">하위 연결 속성</th>
                <th style="width: 16%;">작업</th>
            </tr>
        </thead>
        <tbody>`;

    const renderRow = (rule) => {
        if (rule.id === editId) {
            // 편집 모드
            // BIM 객체 필터를 조건 배열로 변환
            let filterConditions = [];
            if (rule.bim_object_filter && typeof rule.bim_object_filter === 'object') {
                // 단일 조건 객체를 배열로 변환
                if (rule.bim_object_filter.parameter || rule.bim_object_filter.property) {
                    filterConditions = [rule.bim_object_filter];
                }
            }

            // 조건 빌더 UI 생성
            let conditionsHtml = '<div class="conditions-builder" style="max-height: 250px; overflow-y: auto;">';

            filterConditions.forEach((cond, idx) => {
                conditionsHtml += renderConditionRowForRE(cond, idx);
            });

            conditionsHtml += `
                <button type="button" class="add-condition-btn" style="margin-top: 5px; padding: 5px 10px;">
                    + 조건 추가
                </button>
            </div>`;

            return `<tr class="rule-edit-row" data-rule-id="${rule.id}">
                <td><input type="number" class="rule-level-depth-input" value="${rule.level_depth || 0}" style="width: 50px;"></td>
                <td><input type="text" class="rule-level-name-input" value="${rule.level_name || ''}" placeholder="예: Building"></td>
                <td>${conditionsHtml}</td>
                <td><input type="text" class="rule-name-source-input" value="${rule.name_source_param || ''}" placeholder="예: Name"></td>
                <td><input type="text" class="rule-parent-join-input" value="${rule.parent_join_param || ''}" placeholder="예: GlobalId"></td>
                <td><input type="text" class="rule-child-join-input" value="${rule.child_join_param || ''}" placeholder="예: SiteGlobalId"></td>
                <td>
                    <button class="save-rule-btn">💾 저장</button>
                    <button class="cancel-edit-btn">❌ 취소</button>
                </td>
            </tr>`;
        }

        // 읽기 전용 모드
        let filterDisplay = '';
        if (rule.bim_object_filter && typeof rule.bim_object_filter === 'object') {
            const filter = rule.bim_object_filter;
            if (filter.parameter || filter.property) {
                const param = filter.parameter || filter.property;
                const op = filter.operator || '==';
                const val = filter.value || '';
                filterDisplay = `${param} ${op} "${val}"`;
            } else {
                filterDisplay = '<em>필터 없음</em>';
            }
        } else {
            filterDisplay = '<em>필터 없음</em>';
        }

        return `<tr data-rule-id="${rule.id}">
            <td>${rule.level_depth}</td>
            <td>${rule.level_name}</td>
            <td>${filterDisplay}</td>
            <td>${rule.name_source_param}</td>
            <td>${rule.parent_join_param || ''}</td>
            <td>${rule.child_join_param || ''}</td>
            <td>
                <button class="edit-rule-btn">✏️ 수정</button>
                <button class="delete-rule-btn">🗑️ 삭제</button>
            </td>
        </tr>`;
    };

    rules.sort((a, b) => a.level_depth - b.level_depth); // 레벨 순으로 정렬

    rules.forEach((rule) => {
        tableHtml += renderRow(rule);
    });

    if (editId === 'new') {
        const newLevel =
            rules.length > 0
                ? Math.max(...rules.map((r) => r.level_depth)) + 1
                : 0;
        tableHtml += renderRow({ id: 'new', level_depth: newLevel });
    }

    if (rules.length === 0 && editId !== 'new') {
        tableHtml += '<tr><td colspan="7">정의된 규칙이 없습니다.</td></tr>';
    }

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;

    // 조건 빌더 리스너 설정
    setupConditionBuilderListeners();
}

// ▼▼▼ [추가] 공간분류 할당 룰셋 테이블 렌더링 함수 ▼▼▼
function renderSpaceAssignmentRulesetTable(rules, editId = null) {
    const container = document.getElementById(
        'space-assignment-ruleset-table-container'
    );
    if (!currentProjectId) {
        container.innerHTML = '<p>프로젝트를 선택하세요.</p>';
        return;
    }

    let tableHtml = `<table class="ruleset-table"><thead>
        <tr>
            <th style="width: 8%;">우선순위</th>
            <th style="width: 15%;">규칙 이름</th>
            <th style="width: 30%;">부재 필터 조건</th>
            <th style="width: 20%;">부재 연결 속성</th>
            <th style="width: 15%;">공간 연결 속성</th>
            <th style="width: 12%;">작업</th>
        </tr>
    </thead><tbody>`;

    const renderRow = (rule) => {
        if (rule.id === editId) {
            // 편집 모드
            // 조건 빌더 UI 생성
            const conditions = rule.member_filter_conditions || [];
            let conditionsHtml = '<div class="conditions-builder" style="max-height: 300px; overflow-y: auto;">';

            conditions.forEach((cond, idx) => {
                conditionsHtml += renderConditionRowForQM(cond, idx);
            });

            conditionsHtml += `
                <button type="button" class="add-condition-btn" style="margin-top: 5px; padding: 5px 10px;">
                    + 조건 추가
                </button>
            </div>`;

            return `<tr class="rule-edit-row" data-rule-id="${rule.id}">
                <td><input type="number" class="rule-priority-input" value="${rule.priority || 0}" style="width: 60px;"></td>
                <td><input type="text" class="rule-name-input" value="${rule.name || ''}" placeholder="규칙 이름"></td>
                <td>${conditionsHtml}</td>
                <td><input type="text" class="rule-member-join-input" value="${rule.member_join_property || ''}" placeholder="예: RE.참조 레벨"></td>
                <td><input type="text" class="rule-space-join-input" value="${rule.space_join_property || ''}" placeholder="예: Name"></td>
                <td>
                    <button class="save-rule-btn">💾 저장</button>
                    <button class="cancel-edit-btn">❌ 취소</button>
                </td>
            </tr>`;
        }

        // 읽기 전용 모드
        let conditionsDisplay = '';
        if (rule.member_filter_conditions && rule.member_filter_conditions.length > 0) {
            conditionsDisplay = rule.member_filter_conditions.map(c =>
                `${c.property || c.parameter} ${c.operator} "${c.value}"`
            ).join('<br>');
        } else {
            conditionsDisplay = '<em>필터 조건 없음</em>';
        }

        return `<tr data-rule-id="${rule.id}">
            <td>${rule.priority}</td>
            <td>${rule.name}</td>
            <td>${conditionsDisplay}</td>
            <td><code>${rule.member_join_property}</code></td>
            <td><code>${rule.space_join_property}</code></td>
            <td>
                <button class="edit-rule-btn">✏️ 수정</button>
                <button class="delete-rule-btn">🗑️ 삭제</button>
            </td>
        </tr>`;
    };

    rules.forEach((rule) => {
        tableHtml += renderRow(rule);
    });
    if (editId === 'new') tableHtml += renderRow({ id: 'new' });
    if (rules.length === 0 && editId !== 'new')
        tableHtml += '<tr><td colspan="6">정의된 규칙이 없습니다.</td></tr>';

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;

    // 조건 빌더 리스너 설정
    setupConditionBuilderListeners();
}

function renderCostCodeListForUnitPrice(costCodes) {
    const container = document.getElementById('unit-price-cost-code-list');
    const searchInput = document.getElementById('unit-price-cost-code-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    if (!container) {
        console.error(
            '[ERROR][Render] Cost code list container #unit-price-cost-code-list not found.'
        );
        return;
    }

    let filteredCodes = costCodes || []; // Ensure costCodes is an array

    if (searchTerm) {
        filteredCodes = filteredCodes.filter(
            (code) =>
                (code.code && code.code.toLowerCase().includes(searchTerm)) ||
                (code.name && code.name.toLowerCase().includes(searchTerm))
        );
        console.log(
            `[DEBUG][Render] Applied search term '${searchTerm}', found ${filteredCodes.length} codes.`
        );
    }

    if (filteredCodes.length === 0) {
        container.innerHTML = `<p style="padding: 10px;">${
            searchTerm ? '검색 결과가 없습니다.' : '표시할 공사코드가 없습니다.'
        }</p>`;
        return;
    }

    let listHtml = '';
    filteredCodes.forEach((code) => {
        const isSelected = code.id === selectedCostCodeIdForUnitPrice;
        listHtml += `
            <div class="cost-code-item ${
                isSelected ? 'selected' : ''
            }" data-id="${code.id}">
                <span class="item-code" title="${code.code}">${code.code}</span>
                <span class="item-category" title="${code.category || ''}">${
            code.category || '-'
        }</span>
                <span class="item-name" title="${code.name}">${code.name}</span>
                <span class="item-spec" title="${code.spec || ''}">${
            code.spec || '-'
        }</span>
                <span class="item-unit">${code.unit || '-'}</span>
            </div>
        `;
    });

    container.innerHTML = listHtml;
    console.log(
        `[DEBUG][Render] renderCostCodeListForUnitPrice - Rendered ${filteredCodes.length} items.`
    );
}

function renderUnitPriceTypesTable(types, editId = null) {
    console.log(
        `[DEBUG][Render] renderUnitPriceTypesTable - Start (editId: ${editId})`
    );
    const container = document.getElementById(
        'unit-price-type-table-container'
    );
    if (!container) {
        console.error(
            '[ERROR][Render] Unit price type table container #unit-price-type-table-container not found.'
        );
        return;
    }

    let tableHtml = `
        <table>
            <thead>
                <tr>
                    <th style="width: 35%;">구분 이름</th>
                    <th style="width: 45%;">설명</th>
                    <th style="width: 20%;">작업</th>
                </tr>
            </thead>
            <tbody>
    `;

    const renderRow = (type) => {
        const isEditMode = type.id === editId;
        console.log(
            `[DEBUG][Render] Rendering row for type ID: ${type.id}, Edit mode: ${isEditMode}`
        );
        if (isEditMode) {
            return `
                <tr class="editable-row" data-id="${type.id}">
                    <td><input type="text" class="type-name-input" value="${
                        type.name || ''
                    }" placeholder="예: 표준단가"></td>
                    <td><input type="text" class="type-description-input" value="${
                        type.description || ''
                    }" placeholder="선택 사항"></td>
                    <td>
                        <button class="save-type-btn" title="저장">💾</button>
                        <button class="cancel-type-btn" title="취소">❌</button>
                    </td>
                </tr>`;
        } else {
            return `
                <tr data-id="${type.id}">
                    <td>${type.name}</td>
                    <td>${type.description || ''}</td>
                    <td>
                        <button class="edit-type-btn" title="수정">✏️</button>
                        <button class="delete-type-btn" title="삭제">🗑️</button>
                    </td>
                </tr>`;
        }
    };

    let hasRows = false;
    if (editId === 'new') {
        tableHtml += renderRow({ id: 'new' });
        hasRows = true;
    }

    (types || []).forEach((type) => {
        // Ensure types is an array
        // Avoid rendering the item being edited in view mode if editId is set
        if (editId !== type.id) {
            tableHtml += renderRow(type);
            hasRows = true;
        } else if (editId && editId !== 'new') {
            // Render the item being edited in edit mode
            tableHtml += renderRow(types.find((t) => t.id === editId));
            hasRows = true;
        }
    });

    if (!hasRows) {
        tableHtml +=
            '<tr><td colspan="3" style="text-align: center; padding: 15px;">정의된 단가 구분이 없습니다. "새 구분 추가" 버튼으로 시작하세요.</td></tr>';
    }

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
}
function renderUnitPricesTable(prices, editId = null) {
    console.log(
        `[DEBUG][Render] renderUnitPricesTable - Start (editId: ${editId})`
    );
    const container = document.getElementById('unit-price-table-container');
    if (!container) {
        console.error(
            '[ERROR][Render] Unit price table container #unit-price-table-container not found.'
        );
        return;
    }

    // 단가 구분 드롭다운 옵션 준비
    let typeOptionsHtml = '<option value="">-- 구분 선택 --</option>';
    (loadedUnitPriceTypes || []).forEach((type) => {
        // Ensure loadedUnitPriceTypes is an array
        typeOptionsHtml += `<option value="${type.id}">${type.name}</option>`;
    });

    let tableHtml = `
        <table>
            <thead>
                <tr>
                    <th style="width: 20%;">구분</th>
                    <th style="width: 15%;">재료비</th>
                    <th style="width: 15%;">노무비</th>
                    <th style="width: 15%;">경비</th>
                    <th style="width: 15%;">합계</th>
                    <th style="width: 20%;">작업</th>
                </tr>
            </thead>
            <tbody>
    `;

    const renderRow = (price) => {
        const isEditMode = price.id === editId;
        // Decimal 문자열을 숫자로 변환 (실패 시 0)
        const mat = parseFloat(price.material_cost || '0');
        const lab = parseFloat(price.labor_cost || '0');
        const exp = parseFloat(price.expense_cost || '0');
        const tot = parseFloat(price.total_cost || '0'); // DB에 저장된 total 값
        const calculatedTotal = mat + lab + exp; // M+L+E 계산 값

        // 표시할 합계 결정: M/L/E 합이 0보다 크면 계산값, 아니면 DB의 total 값 사용
        const displayTotal =
            mat > 0 || lab > 0 || exp > 0 ? calculatedTotal : tot;

        console.log(
            `[DEBUG][Render] Rendering row for price ID: ${price.id}, Edit mode: ${isEditMode}`
        );
        console.log(
            `  Values: M=${mat}, L=${lab}, E=${exp}, T_DB=${tot}, T_Calc=${calculatedTotal}, T_Display=${displayTotal}`
        );

        if (isEditMode) {
            // 현재 가격의 type ID를 selected로 설정
            const currentTypeOptions = (loadedUnitPriceTypes || [])
                .map(
                    (type) =>
                        `<option value="${type.id}" ${
                            type.id == price.unit_price_type_id
                                ? 'selected'
                                : ''
                        }>${type.name}</option>`
                )
                .join('');

            return `
                <tr class="editable-row" data-id="${price.id}">
                    <td><select class="price-type-select"><option value="">-- 구분 선택 --</option>${currentTypeOptions}</select></td>
                    <td><input type="number" step="any" class="price-material-input" value="${mat.toFixed(
                        4
                    )}"></td>
                    <td><input type="number" step="any" class="price-labor-input" value="${lab.toFixed(
                        4
                    )}"></td>
                    <td><input type="number" step="any" class="price-expense-input" value="${exp.toFixed(
                        4
                    )}"></td>
                    <td><input type="number" step="any" class="price-total-input" value="${displayTotal.toFixed(
                        4
                    )}"></td>
                    <td>
                        <button class="save-price-btn" title="저장">💾</button>
                        <button class="cancel-price-btn" title="취소">❌</button>
                    </td>
                </tr>`;
        } else {
            // 보기 모드 행
            return `
                <tr data-id="${price.id}">
                    <td>${price.unit_price_type_name || '?'}</td>
                    <td>${mat.toFixed(4)}</td>
                    <td>${lab.toFixed(4)}</td>
                    <td>${exp.toFixed(4)}</td>
                    <td>${displayTotal.toFixed(4)}</td> 
                    <td>
                        <button class="edit-price-btn" title="수정">✏️</button>
                        <button class="delete-price-btn" title="삭제">🗑️</button>
                    </td>
                </tr>`;
        }
    };

    let hasRows = false;
    if (editId === 'new') {
        tableHtml += renderRow({
            id: 'new',
            material_cost: '0.0',
            labor_cost: '0.0',
            expense_cost: '0.0',
            total_cost: '0.0',
        });
        hasRows = true;
    }

    (prices || []).forEach((price) => {
        // Ensure prices is an array
        if (editId !== price.id) {
            tableHtml += renderRow(price);
            hasRows = true;
        } else if (editId && editId !== 'new') {
            tableHtml += renderRow(prices.find((p) => p.id === editId));
            hasRows = true;
        }
    });

    if (!hasRows) {
        tableHtml += `<tr><td colspan="6" style="text-align: center; padding: 15px;">이 공사코드에 등록된 단가가 없습니다. "새 단가 추가" 버튼으로 시작하세요.</td></tr>`;
        console.log(
            '[DEBUG][Render] No unit prices to display for this cost code.'
        );
    }

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
}
/**
 * 상세견적(DD) 탭의 UI 요소들(패널 토글 버튼, 상세 정보 탭)에 이벤트 리스너를 설정합니다.
 */
function initializeBoqUI() {
    // 상세견적(DD) 탭의 메인 컨테이너 찾기
    const ddTabContainer = document.getElementById('detailed-estimation-dd');
    if (!ddTabContainer) {
        console.warn(
            "[WARN] Detailed Estimation (DD) tab container '#detailed-estimation-dd' not found. UI initialization skipped."
        );
        return; // 탭 컨테이너가 없으면 함수 종료
    }
    console.log(
        '[DEBUG] Initializing UI elements for Detailed Estimation (DD) tab...'
    );

    // UI 요소들 선택 (탭 컨테이너 내부에서 찾음)
    const leftToggleBtn = ddTabContainer.querySelector(
        '#boq-left-panel-toggle-btn'
    );
    const bottomToggleBtn = ddTabContainer.querySelector(
        '#boq-bottom-panel-toggle-btn'
    );
    const boqContainer = ddTabContainer.querySelector('.boq-container'); // 내부 클래스는 그대로 사용
    const bottomPanel = ddTabContainer.querySelector('.boq-details-wrapper'); // 내부 클래스는 그대로 사용
    const boqDetailsPanel = ddTabContainer.querySelector(
        '#boq-item-details-panel'
    ); // 왼쪽 상세 정보 패널 (탭 포함)

    // --- 1. 왼쪽 패널 접기/펴기 기능 ---
    if (leftToggleBtn && boqContainer) {
        // 이벤트 리스너 중복 방지
        if (!leftToggleBtn.dataset.listenerAttached) {
            leftToggleBtn.addEventListener('click', () => {
                boqContainer.classList.toggle('left-panel-collapsed');
                // 버튼 아이콘 변경
                leftToggleBtn.textContent = boqContainer.classList.contains(
                    'left-panel-collapsed'
                )
                    ? '▶'
                    : '◀';
                console.log(
                    `[DEBUG] Left panel toggled. Collapsed: ${boqContainer.classList.contains(
                        'left-panel-collapsed'
                    )}`
                );
            });
            leftToggleBtn.dataset.listenerAttached = 'true'; // 리스너 추가됨 표시
        }
    } else {
    }

    // --- 2. 하단 패널 접기/펴기 기능 ---
    if (bottomToggleBtn && bottomPanel) {
        // 이벤트 리스너 중복 방지
        if (!bottomToggleBtn.dataset.listenerAttached) {
            bottomToggleBtn.addEventListener('click', () => {
                const isCollapsing =
                    !bottomPanel.classList.contains('collapsed');
                bottomPanel.classList.toggle('collapsed');
                // 버튼 아이콘 변경
                bottomToggleBtn.textContent = isCollapsing ? '▲' : '▼';
                console.log(
                    `[DEBUG] Bottom panel toggled. Collapsed: ${isCollapsing}`
                );
            });
            bottomToggleBtn.dataset.listenerAttached = 'true';
        }
    } else {
        console.warn(
            '[WARN] Bottom toggle button or bottom panel wrapper not found.'
        );
    }

    // --- 3. 왼쪽 상세 정보 패널 탭 클릭 기능 ---
    if (boqDetailsPanel) {
        const tabsContainer = boqDetailsPanel.querySelector(
            '.details-panel-tabs'
        );
        if (tabsContainer && !tabsContainer.dataset.listenerAttached) {
            tabsContainer.addEventListener('click', (e) => {
                const clickedButton = e.target.closest('.detail-tab-button');
                // 클릭된 요소가 탭 버튼이고, 이미 활성화된 상태가 아니며, 탭 버튼 컨테이너(.details-panel-tabs) 안에 있는지 확인
                if (
                    !clickedButton ||
                    clickedButton.classList.contains('active')
                ) {
                    return;
                }

                const targetTab = clickedButton.dataset.tab; // 클릭된 탭의 data-tab 값 (예: "boq-member-prop")

                // 모든 탭 버튼과 컨텐츠에서 'active' 클래스 제거 (현재 패널 내에서만)
                boqDetailsPanel
                    .querySelectorAll('.detail-tab-button.active')
                    .forEach((btn) => btn.classList.remove('active'));
                boqDetailsPanel
                    .querySelectorAll('.detail-tab-content.active')
                    .forEach((content) => content.classList.remove('active'));

                // 클릭된 버튼과 그에 맞는 컨텐츠에 'active' 클래스 추가
                clickedButton.classList.add('active');
                const targetContent = boqDetailsPanel.querySelector(
                    `.detail-tab-content[data-tab="${targetTab}"]`
                );
                if (targetContent) {
                    targetContent.classList.add('active');
                    console.log(
                        `[DEBUG] Detail tab content activated: ${targetTab}`
                    );
                } else {
                    console.warn(
                        `[WARN] Detail tab content for '${targetTab}' not found.`
                    );
                }
            });
            tabsContainer.dataset.listenerAttached = 'true'; // 탭 컨테이너에 리스너 추가됨 표시
        } else if (!tabsContainer) {
            console.warn(
                '[WARN] Detail panel tabs container not found within #boq-item-details-panel.'
            );
        }
    } else {
        console.warn(
            "[WARN] Left detail panel '#boq-item-details-panel' not found."
        );
    }

}
// ▼▼▼ [추가] ui.js 파일 맨 아래에 아래 함수들을 모두 추가 ▼▼▼

// =====================================================================
// [신규] AI 모델 관리 UI 렌더링 함수들
// =====================================================================

/**
 * AI 모델 목록을 테이블 형태로 렌더링합니다.
 * @param {Array} models - 서버에서 받아온 AI 모델 데이터 배열 [{id, name, description, metadata: {input_features, output_features, performance}, created_at}, ...]
 */
function renderAiModelsTable(models) {
    console.log(
        `[DEBUG][Render] Rendering AI Models table with ${models.length} items.`
    ); // 디버깅
    const container = document.getElementById('ai-model-list-container');
    if (!container) {
        console.error(
            "[ERROR][Render] AI Model list container '#ai-model-list-container' not found."
        );
        return;
    }
    if (!currentProjectId) {
        // 프로젝트 미선택 시
        container.innerHTML = '<p>프로젝트를 선택하세요.</p>';
        return;
    }
    if (!Array.isArray(models) || models.length === 0) {
        // 모델 없을 시
        container.innerHTML =
            '<p>등록된 AI 모델이 없습니다. 새 모델을 업로드하세요.</p>';
        return;
    }

    let tableHtml = `
        <table class="ruleset-table"> <thead>
                <tr>
                    <th style="width: 20%;">이름</th>
                    <th style="width: 25%;">설명</th>
                    <th>입력 피처</th>
                    <th>출력 피처</th>
                    <th style="width: 10%;">성능 (Loss)</th>
                    <th style="width: 10%;">생성일</th>
                    <th style="width: 15%;">작업</th>
                </tr>
            </thead>
            <tbody>
    `;

    // 날짜 포맷 함수 (간단 버전)
    const formatDate = (isoString) =>
        isoString ? new Date(isoString).toLocaleDateString() : 'N/A';

    models.forEach((model) => {
        // [확인] 아래 필드들이 models 배열의 각 객체에 직접 접근하는지 확인
        const inputFeatures = Array.isArray(model.input_features)
            ? model.input_features.join(', ')
            : 'N/A';
        const outputFeatures = Array.isArray(model.output_features)
            ? model.output_features.join(', ')
            : 'N/A';
        const performanceMetric =
            model.performance?.final_validation_loss?.toFixed(4) ?? 'N/A'; // model.performance 직접 접근
        const createdAt = formatDate(model.created_at);

        tableHtml += `
            <tr data-model-id="${model.id}">
                <td>${model.name || 'N/A'}</td>
                <td>${model.description || ''}</td>
                
                <td title="${inputFeatures}">${inputFeatures.substring(0, 30)}${
            inputFeatures.length > 30 ? '...' : ''
        }</td>
                <td title="${outputFeatures}">${outputFeatures.substring(
            0,
            30
        )}${outputFeatures.length > 30 ? '...' : ''}</td>
                
                <td>${performanceMetric}</td>
                <td>${createdAt}</td>
                <td>
                </td>
            </tr>
        `;
    });

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
}

/**
 * 학습 완료 후 Test Set 평가 결과를 HTML 테이블로 렌더링합니다.
 * @param {Object} evaluationData - 백엔드에서 받은 test_set_evaluation 데이터
 */
function renderTestSetEvaluationResults(evaluationData) {
    const container = document.getElementById('test-set-evaluation-results');
    if (!container) return;

    container.innerHTML = '<h4>Test Set 평가 결과</h4>'; // 제목 초기화

    if (
        !evaluationData ||
        typeof evaluationData !== 'object' ||
        Object.keys(evaluationData).length === 0
    ) {
        container.innerHTML += '<p>Test Set 평가 결과 데이터가 없습니다.</p>';
        return;
    }

    let tableHtml = `<table class="ruleset-table" style="font-size: 13px;">
        <thead>
            <tr>
                <th>출력 항목</th>
                <th style="text-align: right;">MAE</th>
                <th style="text-align: right;">RMSE</th>
                <th style="text-align: right; background-color: #fffbe0;">평균 오차율(MAPE %)</th>
                <th style="text-align: right;">오차율 StdDev (%)</th>
                <th style="text-align: right;">최대 오차율 (%)</th>
                <th style="text-align: right;">최소 오차율 (%)</th>
            </tr>
        </thead>
        <tbody>`;

    const formatMetric = (value, digits = 4) =>
        typeof value === 'number' ? value.toFixed(digits) : 'N/A';
    const formatPercent = (value) =>
        typeof value === 'number' ? value.toFixed(2) + '%' : 'N/A';

    // 개별 출력 항목 결과 렌더링
    for (const outputName in evaluationData) {
        if (outputName === 'overall') continue; // 전체 평균은 마지막에

        const metrics = evaluationData[outputName];
        tableHtml += `
            <tr>
                <td>${escapeHtml(outputName)}</td>
                <td style="text-align: right;">${formatMetric(metrics.mae)}</td>
                <td style="text-align: right;">${formatMetric(
                    metrics.rmse
                )}</td>
                <td style="text-align: right; background-color: #fffbe0;">${formatPercent(
                    metrics.mean_ape_percent
                )}</td>
                <td style="text-align: right;">${formatPercent(
                    metrics.std_dev_ape_percent
                )}</td>
                <td style="text-align: right;">${formatPercent(
                    metrics.max_ape_percent
                )}</td>
                <td style="text-align: right;">${formatPercent(
                    metrics.min_ape_percent
                )}</td>
            </tr>
        `;
    }

    // 전체 평균 결과 렌더링 (있을 경우)
    if (evaluationData.overall) {
        const overallMetrics = evaluationData.overall;
        tableHtml += `
            <tr style="font-weight: bold; border-top: 2px solid #ccc;">
                <td>전체 평균 (Overall)</td>
                <td style="text-align: right;">${formatMetric(
                    overallMetrics.mae
                )}</td>
                <td style="text-align: right;">${formatMetric(
                    overallMetrics.rmse
                )}</td>
                <td style="text-align: right; background-color: #fffbe0;">${formatPercent(
                    overallMetrics.mean_ape_percent
                )}</td>
                <td style="text-align: right;">${formatPercent(
                    overallMetrics.std_dev_ape_percent
                )}</td>
                <td style="text-align: right;">${formatPercent(
                    overallMetrics.max_ape_percent
                )}</td>
                <td style="text-align: right;">${formatPercent(
                    overallMetrics.min_ape_percent
                )}</td>
            </tr>
        `;
    }

    tableHtml += '</tbody></table>';
    container.innerHTML += tableHtml;
}

/**
 * 학습용 CSV 헤더를 기반으로 입력/출력 피처 선택 체크박스 리스트를 렌더링합니다.
 * @param {Array<string>} headers - CSV 파일의 헤더(컬럼명) 배열
 */
function renderFeatureSelectionLists(headers) {
    console.log(
        '[DEBUG][Render] Rendering feature selection lists for AI training.'
    ); // 디버깅
    const inputListDiv = document.getElementById('input-feature-list');
    const outputListDiv = document.getElementById('output-feature-list');
    if (!inputListDiv || !outputListDiv) {
        return;
    }
    inputListDiv.innerHTML = ''; // 초기화
    outputListDiv.innerHTML = ''; // 초기화

    if (!Array.isArray(headers) || headers.length === 0) {
        const message = '<small>CSV 헤더 정보를 읽을 수 없습니다.</small>';
        inputListDiv.innerHTML = message;
        outputListDiv.innerHTML = message;
        console.warn(
            '[WARN][Render] Cannot render feature lists, headers array is invalid or empty.'
        ); // 디버깅
        return;
    }

    headers.forEach((header) => {
        // XSS 방지: header 문자열을 textContent로 설정
        const inputLabel = document.createElement('label');
        const inputCheckbox = document.createElement('input');
        inputCheckbox.type = 'checkbox';
        inputCheckbox.name = 'input_feature';
        inputCheckbox.value = header;
        inputLabel.appendChild(inputCheckbox);
        inputLabel.appendChild(document.createTextNode(` ${header}`)); // 텍스트 노드로 추가
        inputListDiv.appendChild(inputLabel);

        const outputLabel = document.createElement('label');
        const outputCheckbox = document.createElement('input');
        outputCheckbox.type = 'checkbox';
        outputCheckbox.name = 'output_feature';
        outputCheckbox.value = header;
        outputLabel.appendChild(outputCheckbox);
        outputLabel.appendChild(document.createTextNode(` ${header}`)); // 텍스트 노드로 추가
        outputListDiv.appendChild(outputLabel);
    });
    console.log(
        `[DEBUG][Render] ${headers.length} feature selection checkboxes rendered.`
    ); // 디버깅
}

function addHiddenLayerRow() {
    const container = document.getElementById('hidden-layers-config');
    if (!container) return;
    const layerIndex = container.children.length; // 0부터 시작
    const newRow = document.createElement('div');
    newRow.className = 'layer-config-row';
    newRow.dataset.layerIndex = layerIndex;
    newRow.innerHTML = `
        <span>Layer ${layerIndex + 1}:</span>
        <input type="number" class="nodes-input" value="64" min="1" title="노드 수">
        <select class="activation-select" title="활성화 함수">
            <option value="relu" selected>relu</option>
            <option value="sigmoid">sigmoid</option>
            <option value="tanh">tanh</option>
            <option value="elu">elu</option>
            <option value="selu">selu</option>
            <option value="swish">swish</option>
            </select>
        <button class="remove-layer-btn" style="padding: 2px 5px; font-size: 10px;">-</button>
    `;
    container.appendChild(newRow);

    // 새로 추가된 제거 버튼에 이벤트 리스너 추가
    newRow
        .querySelector('.remove-layer-btn')
        .addEventListener('click', removeHiddenLayerRow);
}

/**
 * 특정 은닉층 설정 행을 제거하고 레이블을 업데이트합니다.
 * @param {Event} event - 클릭 이벤트 객체
 */
function removeHiddenLayerRow(event) {
    const rowToRemove = event.target.closest('.layer-config-row');
    const container = document.getElementById('hidden-layers-config');
    if (!rowToRemove || !container) return;

    // 최소 1개의 레이어는 유지
    if (container.children.length <= 1) {
        showToast('최소 1개의 은닉층이 필요합니다.', 'warning');
        return;
    }

    rowToRemove.remove();

    // 레이어 번호 재정렬
    Array.from(container.children).forEach((row, index) => {
        row.dataset.layerIndex = index;
        const span = row.querySelector('span');
        if (span) span.textContent = `Layer ${index + 1}:`;
    });
}

/**
 * 은닉층 설정을 초기 상태(1개 레이어)로 리셋합니다.
 */
function resetHiddenLayersConfig() {
    const container = document.getElementById('hidden-layers-config');
    if (!container) return;
    container.innerHTML = ''; // 기존 행 모두 제거
    addHiddenLayerRow(); // 첫 번째 행 추가
}

// =====================================================================
// [신규] 개산견적 (SD) UI 렌더링 함수들
// =====================================================================

/**
 * 선택된 AI 모델의 입력 피처에 따라 SD 탭의 입력 필드를 동적으로 생성합니다.
 * @param {Array<string>} inputFeatures - 모델 메타데이터의 입력 피처 이름 배열
 */
function renderSdInputFields(inputFeatures) {
    console.log(
        '[DEBUG][Render] Rendering SD input fields based on selected AI model (ensuring unique IDs).'
    ); // 디버깅
    const container = document.getElementById('sd-input-fields');
    if (!container) {
        console.error(
            "[ERROR][Render] SD input fields container '#sd-input-fields' not found."
        );
        return;
    }
    container.innerHTML = ''; // 기존 필드 초기화

    if (!Array.isArray(inputFeatures) || inputFeatures.length === 0) {
        container.innerHTML =
            '<p>선택된 모델에 필요한 입력 정보가 없습니다.</p>';
        return;
    }

    // 연동 가능한 공사코드 옵션 HTML 생성 (sdEnabledCostCodes 전역 변수 사용)
    let costCodeOptionsHtml = '<option value="">-- 직접 입력 --</option>';
    if (Array.isArray(sdEnabledCostCodes)) {
        sdEnabledCostCodes.forEach((code) => {
            const quantityDisplay = parseFloat(
                code.total_quantity || 0
            ).toFixed(4); // 소수점 4자리
            const codeText = escapeHtml(code.code);
            const nameText = escapeHtml(code.name);
            const unitText = escapeHtml(code.unit || '');
            const optionText = `${codeText} ${nameText} (${quantityDisplay} ${unitText})`;
            costCodeOptionsHtml += `<option value="${escapeHtml(
                code.id
            )}">${optionText}</option>`;
        });
    } else {
        console.warn(
            '[WARN][Render] sdEnabledCostCodes is not an array, cannot populate cost code options.'
        ); // 디버깅
    }

    // --- [핵심 수정] forEach 루프에 index 추가 ---
    inputFeatures.forEach((feature, index) => {
        // <<< index 추가
        // --- [핵심 수정] ID 생성 시 index 포함하여 고유성 보장 ---
        const featureIdPart =
            feature.replace(/[^a-zA-Z0-9]/g, '-') + `-${index}`; // <<< index 추가
        const inputId = `sd-input-${featureIdPart}`;
        const selectId = `sd-select-${featureIdPart}`;
        // --- [핵심 수정] 여기까지 ---

        const groupDiv = document.createElement('div');
        groupDiv.className = 'input-group';

        const label = document.createElement('label');
        label.htmlFor = inputId;
        label.textContent = `${feature}:`;

        const numberInput = document.createElement('input');
        numberInput.type = 'number';
        numberInput.id = inputId; // 고유 ID 적용
        numberInput.dataset.featureName = feature;
        numberInput.placeholder = '값 입력...';
        numberInput.step = 'any';
        numberInput.dataset.selectId = selectId; // 연결된 고유 select ID 저장

        const select = document.createElement('select');
        select.id = selectId; // 고유 ID 적용
        select.dataset.inputId = inputId; // 연결된 고유 input ID 저장
        select.dataset.inputType = 'costCodeLink';
        select.title = '연동할 공사코드 선택 (선택 시 수량 자동 입력)';
        select.innerHTML = costCodeOptionsHtml;

        groupDiv.appendChild(label);
        groupDiv.appendChild(numberInput);
        groupDiv.appendChild(select);
        container.appendChild(groupDiv);
    });
    console.log(
        `[DEBUG][Render] Rendered ${inputFeatures.length} SD input fields with unique IDs.`
    ); // 디버깅
}

// HTML 문자열 이스케이프 헬퍼 함수
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * SD 예측 결과를 테이블 형태로 렌더링합니다.
 * @param {Object} predictions - 예측 결과 객체 (Key: 출력 피처 이름, Value: 예측값)
 */
function renderSdResultsTable(predictions) {
    console.log(
        '[DEBUG][Render] Rendering SD prediction results table (with range).'
    ); // 디버깅
    const container = document.getElementById('sd-prediction-results-table');
    if (!container) {
        console.error(
            '[ERROR][Render] SD prediction results table container not found.'
        );
        return;
    }
    if (
        !predictions ||
        typeof predictions !== 'object' ||
        Object.keys(predictions).length === 0
    ) {
        container.innerHTML = '<p>예측 결과가 없습니다.</p>';
        console.log(
            '[DEBUG][Render] No SD prediction data to render in table.'
        ); // 디버깅
        return;
    }

    let tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>항목 (Output Feature)</th>
                    <th style="text-align: right;">최소 예측값</th>
                    <th style="text-align: right;">평균 예측값</th>
                    <th style="text-align: right;">최대 예측값</th>
                </tr>
            </thead>
            <tbody>
    `;
    for (const feature in predictions) {
        const result = predictions[feature];
        // 결과 객체 구조 확인 및 기본값 설정
        const predValue =
            typeof result?.predicted === 'number' ? result.predicted : 0;
        const minValue =
            typeof result?.min === 'number' ? result.min : predValue; // min 없으면 predicted 사용
        const maxValue =
            typeof result?.max === 'number' ? result.max : predValue; // max 없으면 predicted 사용
        const lossUsed =
            typeof result?.loss_used === 'number'
                ? result.loss_used.toFixed(4)
                : 'N/A'; // 계산에 사용된 loss

        // 숫자 포맷팅 (지역화, 소수점 2자리)
        const formatNumber = (num) =>
            typeof num === 'number'
                ? num.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                  })
                : 'N/A';

        tableHtml += `
            <tr title="Loss used for range: ${lossUsed}">
                <td>${escapeHtml(feature)}</td>
                <td style="text-align: right;">${formatNumber(minValue)}</td>
                <td style="text-align: right; font-weight: bold;">${formatNumber(
                    predValue
                )}</td>
                <td style="text-align: right;">${formatNumber(maxValue)}</td>
            </tr>
        `;
    }
    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
    console.log(
        '[DEBUG][Render] SD prediction results table (with range) rendered successfully.'
    ); // 디버깅
}

/**
 * SD 예측 결과를 Chart.js를 사용하여 막대 그래프로 렌더링합니다.
 * @param {Object} predictions - 예측 결과 객체
 */
function renderSdPredictionChart(predictions) {
    const canvas = document.getElementById('sd-prediction-chart');
    if (!canvas) {
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error(
            '[ERROR][Render] Failed to get 2D context for SD prediction chart.'
        );
        return;
    }

    const hasPredictionData =
        predictions &&
        typeof predictions === 'object' &&
        Object.keys(predictions).length > 0;

    if (!hasPredictionData) {
        if (sdPredictionChartInstance) {
            sdPredictionChartInstance.destroy();
            sdPredictionChartInstance = null;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    if (sdPredictionChartInstance) {
        sdPredictionChartInstance.destroy();
        sdPredictionChartInstance = null;
    }

    const featureKeys = Object.keys(predictions);
    const palette = [
        '#2F80ED',
        '#BB6BD9',
        '#27AE60',
        '#F2994A',
        '#EB5757',
        '#9B51E0',
        '#219653',
        '#F2C94C',
    ];

    const normalPdf = (x, mean, stdDev) => {
        if (!isFinite(stdDev) || stdDev <= 0) return 0;
        const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
        return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
    };

    const hexToRgba = (hex, alpha) => {
        const sanitized = hex.replace('#', '');
        if (sanitized.length !== 6) return `rgba(47, 128, 237, ${alpha})`;
        const bigint = parseInt(sanitized, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const datasets = [];
    const annotations = {};
    let globalMinX = Number.POSITIVE_INFINITY;
    let globalMaxX = Number.NEGATIVE_INFINITY;
    let globalMaxY = 0;

    featureKeys.forEach((feature, index) => {
        const result = predictions[feature] || {};
        const predictedRaw = Number(result?.predicted);
        const mean = Number.isFinite(predictedRaw) ? predictedRaw : 0;
        const minRaw = Number(result?.min);
        const minVal = Number.isFinite(minRaw) ? minRaw : mean;
        const maxRaw = Number(result?.max);
        const maxVal = Number.isFinite(maxRaw) ? maxRaw : mean;
        const rangeSpan = maxVal - minVal;
        const lowerDelta = Math.abs(mean - minVal);
        const upperDelta = Math.abs(maxVal - mean);
        const positiveDeltas = [lowerDelta, upperDelta].filter((delta) => delta > 0);

        let stdDev;
        if (positiveDeltas.length === 0) {
            stdDev = Math.max(Math.abs(mean) * 0.001, 0.05);
        } else if (positiveDeltas.length === 1) {
            stdDev = positiveDeltas[0] / 2;
        } else {
            stdDev = (positiveDeltas[0] + positiveDeltas[1]) / 4;
        }
        if (!isFinite(stdDev) || stdDev <= 0) {
            stdDev = Math.max(Math.abs(mean) * 0.001, 0.05);
        }

        let sampleStart;
        let sampleEnd;
        if (rangeSpan > 0) {
            sampleStart = minVal;
            sampleEnd = maxVal;
        } else {
            sampleStart = mean - stdDev;
            sampleEnd = mean + stdDev;
        }

        if (!isFinite(sampleStart) || !isFinite(sampleEnd) || sampleStart === sampleEnd) {
            sampleStart = mean - Math.max(stdDev, 0.05);
            sampleEnd = mean + Math.max(stdDev, 0.05);
        }

        const paddingBase = sampleEnd - sampleStart;
        const padding =
            Math.max(paddingBase * 0.05, stdDev * 0.1, 0.05);
        sampleStart -= padding;
        sampleEnd += padding;

        const sampleCount = 120;
        const step = sampleCount > 1 ? (sampleEnd - sampleStart) / (sampleCount - 1) : 1;

        const curveData = [];
        for (let i = 0; i < sampleCount; i += 1) {
            const x = sampleStart + step * i;
            const y = normalPdf(x, mean, stdDev);
            curveData.push({ x, y });
            if (x < globalMinX) globalMinX = x;
            if (x > globalMaxX) globalMaxX = x;
            if (y > globalMaxY) globalMaxY = y;
        }

        [minVal, mean, maxVal].forEach((anchorX) => {
            if (!Number.isFinite(anchorX)) return;
            const existing = curveData.find((point) => Math.abs(point.x - anchorX) < step / 2);
            if (!existing) {
                const y = normalPdf(anchorX, mean, stdDev);
                curveData.push({ x: anchorX, y });
                if (anchorX < globalMinX) globalMinX = anchorX;
                if (anchorX > globalMaxX) globalMaxX = anchorX;
                if (y > globalMaxY) globalMaxY = y;
            }
        });
        curveData.sort((a, b) => a.x - b.x);

        const color = palette[index % palette.length];
        datasets.push({
            label: feature,
            data: curveData,
            parsing: false,
            showLine: true,
            fill: true,
            tension: 0.35,
            borderColor: color,
            backgroundColor: hexToRgba(color, 0.28),
            pointRadius: 0,
            pointHoverRadius: 3,
        });

        const addAnnotationLine = (id, value, borderColor, borderDash, labelText, labelBgAlpha = 0.85) => {
            annotations[id] = {
                type: 'line',
                scaleID: 'x',
                value,
                borderColor,
                borderWidth: id.includes('mean') ? 2 : 1,
                borderDash,
                label: {
                    content: labelText,
                    enabled: true,
                    position: 'start',
                    yAdjust: -6,
                    backgroundColor: hexToRgba(borderColor, labelBgAlpha),
                    color: '#000',
                    font: { size: 10 },
                },
            };
        };

        addAnnotationLine(
            `sd-mean-${index}`,
            mean,
            color,
            [],
            `${feature} \u03bc`
        );
        addAnnotationLine(`sd-min-${index}`, minVal, color, [6, 6], `${feature} min`);
        addAnnotationLine(`sd-max-${index}`, maxVal, color, [6, 6], `${feature} max`);
    });

    if (!Number.isFinite(globalMinX) || !Number.isFinite(globalMaxX)) {
        globalMinX = 0;
        globalMaxX = 1;
    }
    if (!Number.isFinite(globalMaxY) || globalMaxY <= 0) {
        globalMaxY = 1;
    }


    try {
        sdPredictionChartInstance = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: {
                        display: datasets.length > 1,
                        position: 'bottom',
                    },
                    title: {
                        display: true,
                        text: 'AI 예측 분포 (정규분포 근사)',
                    },
                    tooltip: {
                        mode: 'nearest',
                        intersect: false,
                        callbacks: {
                            label(context) {
                                const { dataset, parsed } = context;
                                if (!dataset || !parsed) return '';
                                const feature = dataset.label || '';
                                const prediction = predictions[feature] || {};
                                const mean = prediction.predicted;
                                const min = prediction.min;
                                const max = prediction.max;
                                const metricName = prediction.metric_used_for_range;
                                const metricValue = prediction.metric_value;
                                const formattedMetricValue =
                                    typeof metricValue === 'number'
                                        ? metricValue.toLocaleString(undefined, {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                          })
                                        : metricValue;
                                const metricDisplay =
                                    metricName && formattedMetricValue != null && formattedMetricValue !== ''
                                        ? `${metricName}: ${formattedMetricValue}`
                                        : '';

                                return [
                                    feature,
                                    `x: ${parsed.x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                    `밀도: ${parsed.y.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`,
                                    `예상값(μ): ${mean?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                    `범위: ${min?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ~ ${max?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                    metricDisplay,
                                ].filter(Boolean);
                            },
                        },
                    },
                    annotation: { annotations },
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: '예측 값',
                        },
                        suggestedMin: globalMinX,
                        suggestedMax: globalMaxX,
                    },
                    y: {
                        title: {
                            display: true,
                            text: '상대 확률 밀도',
                        },
                        suggestedMin: 0,
                        suggestedMax: globalMaxY * 1.05,
                        ticks: {
                            callback(value) {
                                return Number(value).toFixed(3);
                            },
                        },
                    },
                },
            },
        });
    } catch (error) {
        showToast('Failed to render SD prediction chart.', 'error');
    }
}


/**
 * 개산견적(SD) 탭 하단 테이블에 CostItem 목록을 렌더링합니다.
 * @param {Array} items - 서버에서 받아온 SD용 CostItem 데이터 배열 [{id, quantity, cost_code_name, cost_code_unit, quantity_member_name, ...}, ...]
 */
function renderSdCostItemsTable(items) {
    console.log(
        `[DEBUG][Render] Rendering SD Cost Items table with ${items.length} items.`
    ); // 디버깅
    const container = document.getElementById('sd-cost-item-table-container');
    if (!container) {
        console.error(
            '[ERROR][Render] SD Cost Item table container not found.'
        );
        return;
    }
    if (!currentProjectId) {
        container.innerHTML = '<p>프로젝트를 선택하세요.</p>';
        return;
    }
    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = '<p>개산견적(SD) 대상 산출항목이 없습니다.</p>';
        return;
    }

    // TODO: 그룹핑 기능 추가 시 그룹핑 로직 구현 필요

    // 기본 테이블 렌더링 (그룹핑 미구현 상태)
    const columns = [
        // 표시할 컬럼 정의
        { id: 'cost_code_name', label: '산출항목 (공사코드)' },
        { id: 'quantity', label: '수량', align: 'right' },
        { id: 'cost_code_unit', label: '단위' },
        { id: 'quantity_member_name', label: '연관 부재' },
        { id: 'classification_tag_name', label: '부재 분류' },
        { id: 'member_mark_name', label: '일람부호' },
        { id: 'raw_element_unique_id', label: 'BIM Unique ID' }, // BIM 연동 위해 추가
    ];

    let tableHtml = `<table class="ruleset-table"><thead><tr>`; // ruleset-table 스타일 재사용
    columns.forEach(
        (col) =>
            (tableHtml += `<th style="text-align: ${
                col.align || 'left'
            }">${escapeHtml(col.label)}</th>`)
    );
    tableHtml += `</tr></thead><tbody>`;

    items.forEach((item) => {
        // 선택된 행 강조
        const isSelected = selectedSdItemIds.has(item.id);
        tableHtml += `<tr data-id="${item.id}" class="${
            isSelected ? 'selected-row' : ''
        }" style="cursor: pointer;">`; // 선택 가능하도록 cursor 추가
        columns.forEach((col) => {
            let value = item[col.id] ?? ''; // null/undefined 방지
            if (col.id === 'quantity' && typeof value === 'number') {
                value = value.toFixed(4); // 소수점 4자리
            }
            tableHtml += `<td style="text-align: ${
                col.align || 'left'
            }">${escapeHtml(value)}</td>`; // 값 이스케이프
        });
        tableHtml += `</tr>`;
    });

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
}

// ▲▲▲ [추가] 여기까지 ▲▲▲
// connections/static/connections/ui.js

// ▼▼▼ [교체] 기존 initializeSdUI 함수 전체를 아래 코드로 교체 ▼▼▼
function initializeSdUI() {
    console.log(
        '[DEBUG][initializeSdUI] Initializing Schematic Estimation (SD) UI elements.'
    ); // 디버깅
    // --- 상단 패널 초기화 ---
    const modelSelect = document.getElementById('sd-model-select');
    if (modelSelect)
        modelSelect.innerHTML = '<option value="">-- 모델 선택 --</option>';
    const inputFields = document.getElementById('sd-input-fields');
    if (inputFields)
        inputFields.innerHTML =
            '<p>모델을 선택하면 입력 항목이 표시됩니다.</p>';
    const predictBtn = document.getElementById('sd-predict-btn');
    if (predictBtn) predictBtn.disabled = true;
    const resultsTable = document.getElementById('sd-prediction-results-table');
    if (resultsTable)
        resultsTable.innerHTML = '<p>예측 결과가 여기에 표시됩니다.</p>';

    // --- 결과 차트 초기화 ---
    if (sdPredictionChartInstance) {
        sdPredictionChartInstance.destroy();
        sdPredictionChartInstance = null;
    }
    const canvas = document.getElementById('sd-prediction-chart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); // 캔버스 내용 지우기
    }

    // --- 하단 패널 BOQ 테이블 컨테이너 초기화 ---
    // [수정] 하단 테이블 컨테이너 초기화 (renderBoqTable 호출 전 상태)
    clearContainer(
        'sd-table-container',
        '<p>프로젝트를 선택하고 그룹핑 기준을 설정하세요.</p>'
    );

    // [수정] 하단 패널 BOQ 컨트롤 초기화 (initializeSdBoqControls 호출은 loadDataForActiveTab에서)
    const sdGroupingContainer = document.getElementById('sd-grouping-controls');
    if (sdGroupingContainer) sdGroupingContainer.innerHTML = '';
    const sdDisplayFieldsContainer = document.getElementById(
        'sd-display-fields-container'
    );
    if (sdDisplayFieldsContainer)
        sdDisplayFieldsContainer.innerHTML = '<small>필드 로딩 중...</small>';

    // 관련 전역 변수 초기화
    selectedSdModelId = null;
    // selectedSdItemIds.clear(); // BOQ 테이블 선택 상태는 유지할 수도 있음 (선택적)
    // currentSdBoqColumns = []; // 컬럼 상태는 generateSdBoqReport에서 관리
    // sdBoqColumnAliases = {};

}
// ▲▲▲ [교체] 여기까지 ▲▲▲

// ▼▼▼ [수정] resetTrainingUI 함수 내부 수정 ▼▼▼
// 학습 UI 초기화 (CSV 업로드 단계로)
function resetTrainingUI() {
    console.log(
        '[DEBUG][resetTrainingUI] Resetting AI training UI to Step 1 (CSV Upload).'
    );
    // 단계 표시 초기화
    document.getElementById('training-step-1').style.display = 'block';
    document.getElementById('training-step-2').style.display = 'none';
    document.getElementById('training-step-3').style.display = 'none';
    // 입력 값 초기화 (기존)
    const csvInput = document.getElementById('training-csv-input');
    if (csvInput) csvInput.value = '';
    displaySelectedFileName('training-csv-input', 'upload-csv-btn');
    document.getElementById('csv-info').innerHTML = '';
    document.getElementById('input-feature-list').innerHTML = '';
    document.getElementById('output-feature-list').innerHTML = '';
    document.getElementById('training-model-name').value = '';

    // ▼▼▼ [추가] 새로운 UI 요소 초기화 ▼▼▼
    // 모델 구조 리셋
    resetHiddenLayersConfig();
    // 하이퍼파라미터 리셋 (기본값으로)
    document.getElementById('loss-function').value = 'mse';
    document.getElementById('optimizer').value = 'adam';
    // Metrics 다중 선택 초기화 (첫 번째 옵션만 선택)
    const metricsSelect = document.getElementById('metrics');
    if (metricsSelect) {
        Array.from(metricsSelect.options).forEach((option, index) => {
            option.selected = index === 0;
        });
    }
    document.getElementById('learning-rate').value = 0.001;
    document.getElementById('epochs').value = 50;
    document.getElementById('normalize-inputs').checked = true;
    // 데이터 분할 리셋
    document.getElementById('train-ratio').value = 70;
    document.getElementById('val-ratio').value = 15;
    document.getElementById('test-ratio-display').textContent =
        'Test 비율(%): 15'; // 초기값
    document.getElementById('use-random-seed').checked = false;
    document.getElementById('random-seed-value').value = 42;
    document.getElementById('random-seed-value').style.display = 'none'; // 숨김
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // 진행률/결과/액션 초기화 (기존)
    document.getElementById('training-progress-info').textContent =
        '학습 대기 중...';
    document.getElementById('training-results').innerHTML = '';
    // ▼▼▼ [추가] 평가 결과 영역 초기화 ▼▼▼
    document.getElementById('test-set-evaluation-results').innerHTML = '';
    // ▲▲▲ [추가] 여기까지 ▲▲▲
    document.getElementById('training-actions').style.display = 'none';
    document.getElementById('save-trained-model-btn').disabled = false;
    // 차트 초기화 (기존)
    if (trainingChartInstance) {
        trainingChartInstance.destroy();
        trainingChartInstance = null;
    }
    // 전역 변수 초기화 (기존)
    uploadedCsvFilename = null;
    csvHeaders = [];
    currentTrainingTaskId = null;
    currentTrainingStatus = {};
    trainedModelTempFilename = null;
    trainedModelMetadata = null;
    console.log(
        '[DEBUG][resetTrainingUI] Training UI and state variables reset.'
    );
}
// connections/static/connections/ui.js

// ... (다른 함수들 유지) ...

// ▼▼▼ [추가] SD 연관 항목 목록 렌더링 함수 ▼▼▼
/**
 * SD 탭 중간 패널에 연관된 산출항목 목록 테이블을 렌더링합니다.
 * @param {Array<string>} itemIds - 표시할 CostItem ID 목록
 */
function renderSdAssociatedItemsTable(itemIds) {
    const container = document.getElementById('sd-item-list-container');
    console.log(
        `[DEBUG][Render] Rendering SD associated items list for ${itemIds?.length} IDs.`
    );

    if (!container) {
        console.error(
            '[ERROR][Render] SD item list container #sd-item-list-container not found.'
        );
        return;
    }
    if (!itemIds || itemIds.length === 0) {
        container.innerHTML =
            '<p style="padding: 15px;">왼쪽 테이블에서 그룹 행을 선택하세요.</p>';
        // 상세 속성 패널도 초기화
        renderSdItemProperties(null);
        return;
    }

    // loadedSdCostItems 전역 변수에서 필요한 데이터 필터링
    const itemsToRender = (loadedSdCostItems || []).filter((item) =>
        itemIds.includes(item.id)
    );
    if (itemsToRender.length === 0) {
        container.innerHTML =
            '<p style="padding: 15px;">선택된 그룹에 포함된 산출항목 데이터를 찾을 수 없습니다.</p>';
        renderSdItemProperties(null);
        return;
    }

    // 표시할 컬럼 정의 (요청사항 반영)
    const headers = [
        { id: 'cost_code_name', label: '산출항목' },
        { id: 'quantity', label: '수량', align: 'right' },
        { id: 'linked_member_name', label: '연관 부재' },
        { id: 'linked_raw_name', label: 'BIM 원본 객체' },
        { id: 'actions', label: 'BIM 연동', align: 'center' },
    ];

    let tableHtml = `<table class="boq-item-list-table"><thead><tr>`; // DD와 동일한 클래스 사용
    headers.forEach(
        (h) =>
            (tableHtml += `<th style="text-align: ${h.align || 'left'};">${
                h.label
            }</th>`)
    );
    tableHtml += `</tr></thead><tbody>`;

    itemsToRender.forEach((item) => {
        // 데이터 조회 (DD 테이블 렌더링 로직 재활용)
        const costItemName = item.cost_code_name || '(이름 없는 항목)';
        const qtyStr = parseFloat(item.quantity || 0).toFixed(4); // 숫자 변환 후 포맷팅

        const member = item.quantity_member_id
            ? loadedQuantityMembers.find(
                  (m) => m.id === item.quantity_member_id
              )
            : null;
        const memberName = member
            ? member.name || '(이름 없는 부재)'
            : '(연관 부재 없음)';

        const rawElement = member?.raw_element_id
            ? allRevitData.find((el) => el.id === member.raw_element_id)
            : null;
        const rawElementName = rawElement
            ? rawElement.raw_data?.Name || '(이름 없는 원본)'
            : '(BIM 원본 없음)';

        let bimButtonHtml = '';
        if (rawElement) {
            bimButtonHtml = `<button class="select-in-client-btn-detail" data-cost-item-id="${item.id}" title="연동 프로그램에서 선택 확인">👁️</button>`;
        }

        tableHtml += `<tr data-item-id="${item.id}">`; // 행 선택 가능하도록 data-item-id 추가
        headers.forEach((h) => {
            let value = '';
            let style = h.align ? `style="text-align: ${h.align};"` : '';
            switch (h.id) {
                case 'cost_code_name':
                    value = costItemName;
                    break;
                case 'quantity':
                    value = qtyStr;
                    break;
                case 'linked_member_name':
                    value = memberName;
                    break;
                case 'linked_raw_name':
                    value = rawElementName;
                    break;
                case 'actions':
                    value = bimButtonHtml;
                    style = `style="text-align: center;"`;
                    break;
                default:
                    value = item[h.id] || '';
            }
            tableHtml += `<td ${style}>${escapeHtml(value)}</td>`;
        });
        tableHtml += `</tr>`;
    });

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
    console.log(
        `[DEBUG][Render] SD associated items list rendered (${itemsToRender.length} items).`
    );

    // 첫 번째 항목의 상세 정보 표시 (선택사항) 또는 초기화
    renderSdItemProperties(null); // 초기에는 상세 정보 비움
}
// ▲▲▲ [추가] 여기까지 ▲▲▲
// connections/static/connections/ui.js

// ... (다른 함수들 유지) ...

// ▼▼▼ [추가] SD 상세 속성 렌더링 함수 ▼▼▼
/**
 * SD 탭 오른쪽 패널에 선택된 항목의 상세 속성(부재, 일람부호, BIM 원본)을 렌더링합니다.
 * DD의 renderBoqItemProperties 로직을 재사용하되, 대상 컨테이너 ID만 다릅니다.
 * @param {String | null} itemId - 상세 정보를 표시할 CostItem의 ID
 */
function renderSdItemProperties(itemId) {
    console.log(
        `[DEBUG][Render] Rendering SD item properties for Item ID: ${itemId}`
    );

    // 중간 목록에서 현재 선택된 행 강조 (선택 사항)
    const listContainer = document.getElementById('sd-item-list-container');
    if (listContainer) {
        listContainer.querySelectorAll('tr[data-item-id]').forEach((row) => {
            row.classList.toggle('selected', row.dataset.itemId === itemId);
        });
    }

    // 오른쪽 상세 패널의 컨테이너들
    const memberContainer = document.getElementById(
        'sd-details-member-container'
    );
    const markContainer = document.getElementById('sd-details-mark-container');
    const rawContainer = document.getElementById('sd-details-raw-container');

    // 패널 초기화 (itemId가 null일 경우)
    if (!itemId) {
        const initialMsg = '<p>중간 목록에서 항목을 선택하세요.</p>';
        if (memberContainer) memberContainer.innerHTML = initialMsg;
        if (markContainer) markContainer.innerHTML = initialMsg;
        if (rawContainer) rawContainer.innerHTML = initialMsg;
        return;
    }

    // [수정] loadedCostItems 대신 loadedSdCostItems 사용
    const costItem = (loadedSdCostItems || []).find(
        (item) => item.id.toString() === itemId.toString()
    );
    if (!costItem) {
        const errorMsg = '<p>항목 정보를 찾을 수 없습니다.</p>';
        if (memberContainer) memberContainer.innerHTML = errorMsg;
        if (markContainer) markContainer.innerHTML = '';
        if (rawContainer) rawContainer.innerHTML = '';
        console.warn(
            `[WARN][Render] SD CostItem data not found for ID: ${itemId}`
        );
        return;
    }

    const member = costItem.quantity_member_id
        ? (loadedQuantityMembers || []).find(
              (m) => m.id.toString() === costItem.quantity_member_id.toString()
          )
        : null;

    // 1. 부재 속성 렌더링 (renderPropertyTable 헬퍼 사용 - ui.js에 있어야 함)
    if (memberContainer) {
        renderPropertyTable(memberContainer, member?.properties, '부재 속성');
    }

    // 2. 일람부호 속성 렌더링
    const mark = member?.member_mark_id
        ? (loadedMemberMarks || []).find(
              (m) => m.id.toString() === member.member_mark_id.toString()
          )
        : null;
    if (markContainer) {
        renderPropertyTable(
            markContainer,
            mark?.properties,
            mark ? `${mark.mark} (일람부호 속성)` : '연관된 일람부호 없음'
        );
    }

    // 3. BIM 원본 데이터 렌더링
    const rawElement = member?.raw_element_id
        ? (allRevitData || []).find(
              (el) => el.id.toString() === member.raw_element_id.toString()
          )
        : null;
    const rawProperties = {};
    if (rawElement?.raw_data) {
        const rawData = rawElement.raw_data;
        for (const key in rawData) {
            if (
                !['Parameters', 'TypeParameters'].includes(key) &&
                typeof rawData[key] !== 'object'
            ) {
                rawProperties[key] = rawData[key];
            }
        }
        for (const key in rawData.TypeParameters || {})
            rawProperties[`Type.${key}`] = rawData.TypeParameters[key];
        for (const key in rawData.Parameters || {})
            rawProperties[key] = rawData.Parameters[key];
    }
    if (rawContainer) {
        renderPropertyTable(
            rawContainer,
            rawProperties,
            rawElement
                ? `${rawElement.raw_data?.Name || '원본 객체'} (BIM 원본)`
                : '연관된 BIM 원본 없음'
        );
    }

    console.log(
        `[DEBUG][Render] SD details panel rendered for Item ID: ${itemId}`
    );
}
// ▲▲▲ [추가] 여기까지 ▲▲▲

// =====================================================================
// CostItem용 조건 빌더 함수들 (수량산출룰셋용)
// =====================================================================

/**
 * CostItem에서 접근 가능한 모든 필드를 조건 빌더용으로 반환
 * (상속 흐름: BIM → QM → CI)
 * 필드 선택 탭의 키값과 정확히 일치하도록 구성
 */
window.getAllCiFieldsForConditionBuilder = function() {

    const groups = [];

    // 1. CostItem 기본 속성
    groups.push({
        group: 'CostItem 속성 (CI)',
        options: [
            { value: 'CI.id', label: 'CI.id (산출항목 ID)' },
            { value: 'CI.name', label: 'CI.name (이름)' },
            { value: 'CI.quantity', label: 'CI.quantity (수량)' },
            { value: 'CI.unit', label: 'CI.unit (단위)' },
            { value: 'CI.grouping_info', label: 'CI.grouping_info (그룹 정보)' },
            { value: 'CI.item_index', label: 'CI.item_index (항목 번호)' }
        ]
    });

    // 공사코드 필드 추가 (코스트아이템에 공사코드가 있을 경우)
    if (window.loadedCostCodes && window.loadedCostCodes.length > 0) {
        groups[0].options.push({ value: 'CI.cost_code', label: 'CI.cost_code (공사코드)' });
    }

    // 2. QuantityMember 기본 속성 (상속)
    groups.push({
        group: 'QuantityMember 속성 (QM, 상속)',
        options: [
            { value: 'QM.id', label: 'QM.id (부재 ID)' },
            { value: 'QM.name', label: 'QM.name (부재명)' },
            { value: 'QM.classification_tag', label: 'QM.classification_tag (분류 태그)' }
        ]
    });

    // 3. QM.properties.* 속성 수집 (상속)
    const qmPropertyKeys = new Set();
    if (window.loadedQuantityMembers) {
        window.loadedQuantityMembers.forEach(member => {
            if (member.properties && typeof member.properties === 'object') {
                Object.keys(member.properties).forEach(key => qmPropertyKeys.add(key));
            }
        });
    }
    if (qmPropertyKeys.size > 0) {
        const qmPropOptions = Array.from(qmPropertyKeys).sort().map(key => ({
            value: `QM.properties.${key}`,
            label: `QM.properties.${key}`
        }));
        groups.push({
            group: 'QM 속성 (QM.properties, 상속)',
            options: qmPropOptions
        });
    }

    // 4. BIM.System.* 속성 (상속)
    const systemProps = ['id', 'element_unique_id', 'geometry_volume', 'classification_tags'];
    const systemOptions = systemProps.map(prop => ({
        value: `BIM.System.${prop}`,
        label: `BIM.System.${prop}`
    }));
    if (systemOptions.length > 0) {
        groups.push({
            group: 'BIM 시스템 속성 (BIM.System, 상속)',
            options: systemOptions
        });
    }

    // 5. BIM.Attributes.* 속성 (상속)
    const attributeFields = new Set();
    if (allRevitData && allRevitData.length > 0) {
        allRevitData.forEach(item => {
            const rawData = item.raw_data;
            if (rawData) {
                Object.keys(rawData).forEach(k => {
                    if (k !== 'Parameters' && k !== 'TypeParameters' && typeof rawData[k] !== 'object') {
                        attributeFields.add(k);
                    }
                });
            }
        });
    }
    if (attributeFields.size > 0) {
        const attrOptions = Array.from(attributeFields).sort().map(attr => ({
            value: `BIM.Attributes.${attr}`,
            label: `BIM.Attributes.${attr}`
        }));
        groups.push({
            group: 'BIM 기본 속성 (BIM.Attributes, 상속)',
            options: attrOptions
        });
    }

    // 6. BIM.Parameters.* 속성 (상속)
    const parameterFields = new Set();
    if (allRevitData && allRevitData.length > 0) {
        allRevitData.forEach(item => {
            const rawData = item.raw_data;
            if (rawData && rawData.Parameters) {
                Object.keys(rawData.Parameters).forEach(key => {
                    if (key !== 'Geometry') {
                        parameterFields.add(key);
                    }
                });
            }
        });
    }
    if (parameterFields.size > 0) {
        const paramOptions = Array.from(parameterFields).sort().map(param => ({
            value: `BIM.Parameters.${param}`,
            label: `BIM.Parameters.${param}`
        }));
        groups.push({
            group: 'BIM 파라미터 (BIM.Parameters, 상속)',
            options: paramOptions
        });
    }

    // 7. BIM.TypeParameters.* 속성 (상속)
    const typeParameterFields = new Set();
    if (allRevitData && allRevitData.length > 0) {
        allRevitData.forEach(item => {
            const rawData = item.raw_data;
            if (rawData && rawData.TypeParameters) {
                Object.keys(rawData.TypeParameters).forEach(key => {
                    typeParameterFields.add(key);
                });
            }
        });
    }
    if (typeParameterFields.size > 0) {
        const tparamOptions = Array.from(typeParameterFields).sort().map(tparam => ({
            value: `BIM.TypeParameters.${tparam}`,
            label: `BIM.TypeParameters.${tparam}`
        }));
        groups.push({
            group: 'BIM 타입 파라미터 (BIM.TypeParameters, 상속)',
            options: tparamOptions
        });
    }

    // 8. MM.properties.* 속성 (상속)
    const mmPropertyKeys = new Set();
    let hasMemberMark = false;
    if (window.loadedQuantityMembers) {
        window.loadedQuantityMembers.forEach(member => {
            if (member.member_mark_mark) {
                hasMemberMark = true;
            }
            if (member.member_mark_properties && typeof member.member_mark_properties === 'object') {
                Object.keys(member.member_mark_properties).forEach(key => mmPropertyKeys.add(key));
            }
        });
    }

    const mmOptions = [];
    if (hasMemberMark) {
        mmOptions.push({ value: 'MM.mark', label: 'MM.mark (일람부호)' });
    }
    if (mmPropertyKeys.size > 0) {
        const mmPropOptions = Array.from(mmPropertyKeys).sort().map(key => ({
            value: `MM.properties.${key}`,
            label: `MM.properties.${key}`
        }));
        mmOptions.push(...mmPropOptions);
    }
    if (mmOptions.length > 0) {
        groups.push({
            group: '일람부호 속성 (MM, 상속)',
            options: mmOptions
        });
    }

    // 9. Space 속성 (상속)
    let hasSpace = false;
    if (window.loadedQuantityMembers) {
        hasSpace = window.loadedQuantityMembers.some(member => member.space_name);
    }
    if (hasSpace) {
        groups.push({
            group: '공간분류 (Space, 상속)',
            options: [
                { value: 'Space.name', label: 'Space.name (공간명)' }
            ]
        });
    }

    groups.forEach((g, idx) => {
    });

    return groups;
};

/**
 * 수량 산식 빌더 리스너 설정
 */
function setupQuantityFormulaBuilderListeners() {
    // "속성 삽입" 버튼 클릭 리스너 (1차 수량)
    document.querySelectorAll('.insert-property-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const builder = e.target.closest('.quantity-formula-builder');
            if (!builder) return;

            const textarea = builder.querySelector('.quantity-formula-input');
            const select = builder.querySelector('.quantity-formula-property-select');
            const selectedValue = select.value;

            if (!selectedValue) {
                alert('속성을 선택하세요.');
                return;
            }

            // 커서 위치에 속성 삽입
            const startPos = textarea.selectionStart;
            const endPos = textarea.selectionEnd;
            const currentValue = textarea.value;

            const newValue = currentValue.substring(0, startPos) + selectedValue + currentValue.substring(endPos);
            textarea.value = newValue;

            // 커서를 삽입된 텍스트 끝으로 이동
            const newCursorPos = startPos + selectedValue.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();

            // 선택 초기화
            select.selectedIndex = 0;
        });
    });

    // ▼▼▼ [추가] "속성 삽입" 버튼 클릭 리스너 (2차 수량) (2025-11-14) ▼▼▼
    document.querySelectorAll('.insert-secondary-property-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const builder = e.target.closest('.secondary-quantity-formula-builder');
            if (!builder) return;

            const textarea = builder.querySelector('.secondary-quantity-formula-input');
            const select = builder.querySelector('.secondary-quantity-formula-property-select');
            const selectedValue = select.value;

            if (!selectedValue) {
                alert('속성을 선택하세요.');
                return;
            }

            // 커서 위치에 속성 삽입
            const startPos = textarea.selectionStart;
            const endPos = textarea.selectionEnd;
            const currentValue = textarea.value;

            const newValue = currentValue.substring(0, startPos) + selectedValue + currentValue.substring(endPos);
            textarea.value = newValue;

            // 커서를 삽입된 텍스트 끝으로 이동
            const newCursorPos = startPos + selectedValue.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();

            // 선택 초기화
            select.selectedIndex = 0;
        });
    });
    // ▲▲▲ [추가] 여기까지 ▲▲▲
}

/**
 * CostItem용 조건 행 렌더링 함수
 */
function renderConditionRowForCI(condition, index) {
    const property = condition.property || condition.parameter || '';
    let operator = condition.operator || 'equals';
    const value = condition.value || '';

    // 기존 룰셋의 연산자 형식 변환 (하위 호환성)
    const operatorMap = {
        '==': 'equals',
        '!=': 'not_equals',
        '>': 'greater_than',
        '<': 'less_than',
        '>=': 'greater_or_equal',
        '<=': 'less_or_equal'
    };
    if (operatorMap[operator]) {
        operator = operatorMap[operator];
    }

    // CostItem 속성 옵션 생성 - 동적으로 수집된 필드 사용
    let propertyOptions = [];
    if (typeof window.getAllCiFieldsForConditionBuilder === 'function') {
        try {
            propertyOptions = window.getAllCiFieldsForConditionBuilder();
        } catch (error) {
            // 폴백: 기본 옵션 사용
            propertyOptions = [
                { group: 'CostItem 속성 (CI)', options: [
                    { value: 'name', label: 'CI.name (이름)' },
                    { value: 'cost_code_code', label: 'CI.cost_code (공사코드)' }
                ]}
            ];
        }
    } else {
        // 폴백: 기본 옵션 사용
        propertyOptions = [
            { group: 'CostItem 속성 (CI)', options: [
                { value: 'name', label: 'CI.name (이름)' },
                { value: 'cost_code_code', label: 'CI.cost_code (공사코드)' }
            ]}
        ];
    }

    let propertySelectHtml = '<select class="condition-property ci-condition-property" style="width: 100%; padding: 5px; font-size: 13px; max-height: 300px;">';
    propertySelectHtml += '<option value="">-- 속성 선택 --</option>';

    if (propertyOptions.length === 0) {
        propertySelectHtml += '<option value="" disabled>속성을 불러오는 중...</option>';
    } else {
        propertyOptions.forEach(group => {
            propertySelectHtml += `<optgroup label="${group.group}" style="font-weight: bold; color: #333;">`;
            group.options.forEach(opt => {
                // value도 label과 동일하게 표시명 사용 (필드키 대신)
                const selected = (opt.value === property || opt.label === property) ? 'selected' : '';
                // 옵션 텍스트를 title 속성에도 추가하여 호버 시 전체 텍스트 표시
                propertySelectHtml += `<option value="${opt.value}" ${selected} title="${opt.label}" style="padding: 4px;">${opt.label}</option>`;
            });
            propertySelectHtml += '</optgroup>';
        });
    }
    propertySelectHtml += '</select>';

    // 연산자 옵션
    const operators = [
        { value: 'equals', label: '같음 (equals)' },
        { value: 'not_equals', label: '같지 않음 (not_equals)' },
        { value: 'contains', label: '포함 (contains)' },
        { value: 'startswith', label: '시작 (startswith)' },
        { value: 'endswith', label: '끝 (endswith)' }
    ];

    let operatorSelectHtml = '<select class="condition-operator" style="width: 100%; padding: 5px;">';
    operators.forEach(op => {
        const selected = op.value === operator ? 'selected' : '';
        operatorSelectHtml += `<option value="${op.value}" ${selected}>${op.label}</option>`;
    });
    operatorSelectHtml += '</select>';

    return `
        <div class="condition-row" data-index="${index}" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 8px; background: #f9f9f9; border-radius: 4px;">
            <div style="margin-bottom: 5px;">
                <label style="display: block; font-weight: bold; margin-bottom: 3px; font-size: 12px; color: #555;">속성</label>
                ${propertySelectHtml}
            </div>
            <div style="margin-bottom: 5px;">
                <label style="display: block; font-weight: bold; margin-bottom: 3px; font-size: 12px; color: #555;">조건</label>
                ${operatorSelectHtml}
            </div>
            <div style="margin-bottom: 8px;">
                <label style="display: block; font-weight: bold; margin-bottom: 3px; font-size: 12px; color: #555;">값</label>
                <input type="text" class="condition-value" value="${value}" placeholder="값 입력" style="width: 100%; padding: 5px;">
            </div>
            <button type="button" class="remove-condition-btn" style="background: #dc3545; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 3px; width: 100%;">
                삭제
            </button>
        </div>
    `;
}
