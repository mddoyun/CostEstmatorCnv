// three_d_viewer_filter.js
// 3D Viewer 필터링 기능 (그룹 기반)

(function() {
    let filterData = null;  // 필터 데이터 캐시
    let availableProperties = [];  // 사용 가능한 속성 목록
    let filterGroups = [];  // 필터 그룹 배열
    let nextGroupId = 1;  // 그룹 ID 카운터

    /**
     * 필터 패널 열기
     */
    window.openFilterPanel = function() {
        const panel = document.getElementById('filter-panel');
        if (!panel) return;

        panel.style.display = 'block';

        // 필터 데이터 로드 (캐시되지 않은 경우)
        if (!filterData) {
            loadFilterProperties();
        }
    };

    /**
     * 필터 패널 닫기
     */
    window.closeFilterPanel = function() {
        const panel = document.getElementById('filter-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    };

    /**
     * 필터 속성 목록 로드
     */
    async function loadFilterProperties() {
        if (!window.currentProjectId) {
            console.error('[Filter] No project selected');
            return;
        }

        try {
            const response = await fetch(`/connections/api/filter/data/${window.currentProjectId}/`);
            const data = await response.json();

            if (data.status === 'success') {
                filterData = data.data;
                availableProperties = extractProperties(filterData);
                console.log('[Filter] Available properties:', availableProperties);
            }
        } catch (error) {
            console.error('[Filter] Error loading filter data:', error);
        }
    }

    /**
     * 데이터에서 사용 가능한 속성 추출
     */
    function extractProperties(data) {
        const props = new Set();

        if (data.length === 0) return [];

        data.forEach(item => {
            // BIM 속성
            if (item.BIM) {
                collectNestedKeys(item.BIM, 'BIM', props);
            }

            // QM 속성
            if (item.QM && item.QM.length > 0) {
                item.QM.forEach(qm => {
                    if (qm.System) {
                        Object.keys(qm.System).forEach(key => {
                            props.add(`QM.System.${key}`);
                        });
                    }
                    if (qm.Properties) {
                        Object.keys(qm.Properties).forEach(key => {
                            props.add(`QM.Properties.${key}`);
                        });
                    }

                    // MM, SC
                    if (qm.MM && qm.MM.System) {
                        Object.keys(qm.MM.System).forEach(key => {
                            props.add(`MM.System.${key}`);
                        });
                    }
                    if (qm.MM && qm.MM.Properties) {
                        Object.keys(qm.MM.Properties).forEach(key => {
                            props.add(`MM.Properties.${key}`);
                        });
                    }
                    if (qm.SC && qm.SC.System) {
                        Object.keys(qm.SC.System).forEach(key => {
                            props.add(`SC.System.${key}`);
                        });
                    }

                    // CI, CC, AO, AC
                    if (qm.CI && qm.CI.length > 0) {
                        qm.CI.forEach(ci => {
                            if (ci.System) {
                                Object.keys(ci.System).forEach(key => {
                                    props.add(`CI.System.${key}`);
                                });
                            }
                            if (ci.CC && ci.CC.System) {
                                Object.keys(ci.CC.System).forEach(key => {
                                    props.add(`CC.System.${key}`);
                                });
                            }
                            if (ci.AO && ci.AO.length > 0) {
                                ci.AO.forEach(ao => {
                                    if (ao.System) {
                                        Object.keys(ao.System).forEach(key => {
                                            props.add(`AO.System.${key}`);
                                        });
                                    }
                                    if (ao.AC && ao.AC.System) {
                                        Object.keys(ao.AC.System).forEach(key => {
                                            props.add(`AC.System.${key}`);
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });

        return Array.from(props).sort();
    }

    function collectNestedKeys(obj, prefix, propsSet, maxDepth = 3, currentDepth = 0) {
        if (!obj || typeof obj !== 'object' || currentDepth >= maxDepth) return;

        Object.keys(obj).forEach(key => {
            const fullKey = `${prefix}.${key}`;
            const value = obj[key];

            if (value && typeof value === 'object' && !Array.isArray(value)) {
                collectNestedKeys(value, fullKey, propsSet, maxDepth, currentDepth + 1);
            } else {
                propsSet.add(fullKey);
            }
        });
    }

    /**
     * 그룹 추가
     */
    window.addFilterGroup = function() {
        const conditionsBuilder = document.getElementById('filter-conditions-builder');
        if (!conditionsBuilder) return;

        const groupId = nextGroupId++;
        const isFirstGroup = filterGroups.length === 0;

        const group = {
            id: groupId,
            conditions: [],
            logic: 'AND'
        };

        filterGroups.push(group);

        const groupElement = createGroupElement(group, isFirstGroup);
        conditionsBuilder.appendChild(groupElement);

        // 첫 번째 조건 자동 추가
        addConditionToGroup(groupId);
    };

    /**
     * 그룹 엘리먼트 생성
     */
    function createGroupElement(group, isFirstGroup) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'filter-group';
        groupDiv.setAttribute('data-group-id', group.id);

        // 그룹 헤더
        const header = document.createElement('div');
        header.className = 'filter-group-header';

        // 그룹 간 로직 선택 (첫 번째 그룹이 아닐 때만)
        if (!isFirstGroup) {
            const groupLogicSelect = document.createElement('select');
            groupLogicSelect.className = 'group-logic-select';
            groupLogicSelect.innerHTML = '<option value="AND">AND</option><option value="OR">OR</option>';
            groupLogicSelect.value = group.logic;
            groupLogicSelect.onchange = function() {
                group.logic = this.value;
            };
            header.appendChild(groupLogicSelect);
        }

        // 그룹 제목
        const title = document.createElement('span');
        title.className = 'group-title';
        title.textContent = `그룹 ${group.id}`;
        header.appendChild(title);

        // 조건 추가 버튼
        const addCondBtn = document.createElement('button');
        addCondBtn.className = 'add-condition-btn';
        addCondBtn.textContent = '+ 조건';
        addCondBtn.onclick = function() {
            addConditionToGroup(group.id);
        };
        header.appendChild(addCondBtn);

        // 그룹 삭제 버튼
        const removeGroupBtn = document.createElement('button');
        removeGroupBtn.className = 'remove-group-btn';
        removeGroupBtn.textContent = '그룹 삭제';
        removeGroupBtn.onclick = function() {
            removeFilterGroup(group.id);
        };
        header.appendChild(removeGroupBtn);

        groupDiv.appendChild(header);

        // 조건 컨테이너
        const conditionsContainer = document.createElement('div');
        conditionsContainer.className = 'group-conditions';
        groupDiv.appendChild(conditionsContainer);

        return groupDiv;
    }

    /**
     * 그룹 삭제
     */
    function removeFilterGroup(groupId) {
        const index = filterGroups.findIndex(g => g.id === groupId);
        if (index !== -1) {
            filterGroups.splice(index, 1);
        }

        const groupElement = document.querySelector(`[data-group-id="${groupId}"]`);
        if (groupElement) {
            groupElement.remove();
        }

        updateGroupLogicSelects();
    }

    /**
     * 그룹 로직 선택 업데이트
     */
    function updateGroupLogicSelects() {
        const groupElements = document.querySelectorAll('.filter-group');
        groupElements.forEach((groupEl, index) => {
            const logicSelect = groupEl.querySelector('.group-logic-select');
            if (index === 0) {
                if (logicSelect) logicSelect.remove();
            } else {
                if (!logicSelect) {
                    const header = groupEl.querySelector('.filter-group-header');
                    const newLogicSelect = document.createElement('select');
                    newLogicSelect.className = 'group-logic-select';
                    newLogicSelect.innerHTML = '<option value="AND">AND</option><option value="OR">OR</option>';
                    header.insertBefore(newLogicSelect, header.firstChild);
                }
            }
        });
    }

    /**
     * 그룹 내 조건 추가
     */
    window.addConditionToGroup = function(groupId) {
        const group = filterGroups.find(g => g.id === groupId);
        if (!group) return;

        const groupElement = document.querySelector(`[data-group-id="${groupId}"]`);
        if (!groupElement) return;

        const conditionsContainer = groupElement.querySelector('.group-conditions');
        const isFirstCondition = conditionsContainer.querySelectorAll('.filter-condition-row').length === 0;

        const conditionRow = createConditionRow(null, isFirstCondition, groupId);
        conditionsContainer.appendChild(conditionRow);
    };

    /**
     * 조건 행 생성
     */
    function createConditionRow(condition = null, isFirstRow = false, groupId = null) {
        const row = document.createElement('div');
        row.className = 'filter-condition-row';
        row.setAttribute('data-group-id', groupId);

        // AND/OR 선택 (첫 번째 조건이 아닐 때만)
        if (!isFirstRow) {
            const logicSelect = document.createElement('select');
            logicSelect.className = 'condition-logic-select';
            logicSelect.innerHTML = '<option value="AND">AND</option><option value="OR">OR</option>';
            if (condition && condition.logic) {
                logicSelect.value = condition.logic;
            }
            row.appendChild(logicSelect);
        }

        // 속성 선택
        const propertySelect = document.createElement('select');
        propertySelect.className = 'filter-property-select';
        propertySelect.innerHTML = '<option value="">속성 선택...</option>';

        availableProperties.forEach(prop => {
            const option = document.createElement('option');
            option.value = prop;
            option.textContent = prop;
            if (condition && condition.property === prop) {
                option.selected = true;
            }
            propertySelect.appendChild(option);
        });

        // 연산자 선택
        const operatorSelect = document.createElement('select');
        operatorSelect.className = 'filter-operator-select';
        const operators = [
            { value: '==', label: '같음 (==)' },
            { value: '!=', label: '같지 않음 (!=)' },
            { value: 'contains', label: '포함 (contains)' },
            { value: 'startsWith', label: '시작 (startsWith)' },
            { value: 'endsWith', label: '끝 (endsWith)' },
            { value: '>', label: '큼 (>)' },
            { value: '<', label: '작음 (<)' },
            { value: '>=', label: '크거나 같음 (>=)' },
            { value: '<=', label: '작거나 같음 (<=)' },
        ];

        operators.forEach(op => {
            const option = document.createElement('option');
            option.value = op.value;
            option.textContent = op.label;
            if (condition && condition.operator === op.value) {
                option.selected = true;
            }
            operatorSelect.appendChild(option);
        });

        // 값 입력
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'filter-value-input';
        valueInput.placeholder = '값 입력...';
        if (condition) {
            valueInput.value = condition.value || '';
        }

        // 삭제 버튼
        const removeBtn = document.createElement('button');
        removeBtn.className = 'filter-remove-btn';
        removeBtn.textContent = '✕';
        removeBtn.onclick = function() {
            row.remove();
            updateConditionLogicSelects(groupId);
        };

        row.appendChild(propertySelect);
        row.appendChild(operatorSelect);
        row.appendChild(valueInput);
        row.appendChild(removeBtn);

        return row;
    }

    /**
     * 조건 로직 선택 업데이트
     */
    function updateConditionLogicSelects(groupId) {
        const groupElement = document.querySelector(`[data-group-id="${groupId}"]`);
        if (!groupElement) return;

        const conditionsContainer = groupElement.querySelector('.group-conditions');
        const rows = conditionsContainer.querySelectorAll('.filter-condition-row');

        rows.forEach((row, index) => {
            const logicSelect = row.querySelector('.condition-logic-select');
            if (index === 0) {
                if (logicSelect) logicSelect.remove();
            } else {
                if (!logicSelect) {
                    const newLogicSelect = document.createElement('select');
                    newLogicSelect.className = 'condition-logic-select';
                    newLogicSelect.innerHTML = '<option value="AND">AND</option><option value="OR">OR</option>';
                    row.insertBefore(newLogicSelect, row.firstChild);
                }
            }
        });
    }

    /**
     * 필터 적용
     */
    window.applyFilter = async function() {
        if (filterGroups.length === 0) {
            alert('필터 그룹을 추가해주세요.');
            return;
        }

        // 그룹별로 조건 수집
        const groupsData = [];

        for (const group of filterGroups) {
            const groupElement = document.querySelector(`[data-group-id="${group.id}"]`);
            if (!groupElement) continue;

            const conditionsContainer = groupElement.querySelector('.group-conditions');
            const rows = conditionsContainer.querySelectorAll('.filter-condition-row');

            const conditions = [];
            rows.forEach((row, index) => {
                const logicSelect = row.querySelector('.condition-logic-select');
                const property = row.querySelector('.filter-property-select').value;
                const operator = row.querySelector('.filter-operator-select').value;
                const value = row.querySelector('.filter-value-input').value;

                if (property && value) {
                    const condition = { property, operator, value };
                    if (index > 0 && logicSelect) {
                        condition.logic = logicSelect.value;
                    }
                    conditions.push(condition);
                }
            });

            if (conditions.length > 0) {
                groupsData.push({
                    id: group.id,
                    logic: group.logic,
                    conditions: conditions
                });
            }
        }

        if (groupsData.length === 0) {
            alert('필터 조건을 추가해주세요.');
            return;
        }

        console.log('[Filter] Applying groups:', groupsData);

        if (!filterData || filterData.length === 0) {
            alert('필터 데이터가 로드되지 않았습니다.');
            return;
        }

        // 프론트엔드에서 필터링
        const matchedRawElementIds = evaluateFilterGroups(filterData, groupsData);

        console.log('[Filter] Matched RawElement IDs:', matchedRawElementIds);

        // 3D 뷰어에 필터 적용
        if (window.viewer && window.viewer.applyFilter) {
            window.viewer.applyFilter(matchedRawElementIds);
        }

        // 결과 표시
        const resultInfo = document.getElementById('filter-result-info');
        const resultText = document.getElementById('filter-result-text');
        if (resultInfo && resultText) {
            resultInfo.style.display = 'block';
            resultText.textContent = `${matchedRawElementIds.length}개 BIM 객체 필터링됨`;
        }
    };

    /**
     * 그룹 기반 필터 평가
     */
    function evaluateFilterGroups(data, groups) {
        const matchedRawElementIds = new Set();

        data.forEach(item => {
            const rawElementId = item.raw_element_id;

            // 각 그룹 평가
            let groupResults = [];

            for (const group of groups) {
                const groupResult = evaluateGroupConditions(item, group.conditions);
                groupResults.push({ result: groupResult, logic: group.logic });
            }

            // 그룹 간 로직 적용
            if (groupResults.length === 0) return;

            let finalResult = groupResults[0].result;

            for (let i = 1; i < groupResults.length; i++) {
                const { result, logic } = groupResults[i];
                if (logic === 'OR') {
                    finalResult = finalResult || result;
                } else { // AND
                    finalResult = finalResult && result;
                }
            }

            if (finalResult) {
                matchedRawElementIds.add(rawElementId);
            }
        });

        return Array.from(matchedRawElementIds);
    }

    /**
     * 그룹 내 조건 평가
     */
    function evaluateGroupConditions(item, conditions) {
        const conditionsByType = groupConditionsByType(conditions);

        // 각 엔티티 타입별로 체크
        let matched = false;

        // BIM
        if (conditionsByType.BIM && conditionsByType.BIM.length > 0) {
            if (checkEntityMatchStrict(item.BIM, 'BIM', conditionsByType.BIM)) {
                matched = true;
            }
        }

        // QM, MM, SC, CI, CC, AO, AC
        if (!matched && item.QM && item.QM.length > 0) {
            for (const qm of item.QM) {
                if (matched) break;

                if (conditionsByType.QM && conditionsByType.QM.length > 0) {
                    if (checkEntityMatchStrict(qm.System, 'QM', conditionsByType.QM)) {
                        matched = true;
                        break;
                    }
                }

                if (conditionsByType.MM && conditionsByType.MM.length > 0) {
                    if (qm.MM && checkEntityMatchStrict(qm.MM.System, 'MM', conditionsByType.MM)) {
                        matched = true;
                        break;
                    }
                }

                if (conditionsByType.SC && conditionsByType.SC.length > 0) {
                    if (qm.SC && checkEntityMatchStrict(qm.SC.System, 'SC', conditionsByType.SC)) {
                        matched = true;
                        break;
                    }
                }

                if (qm.CI && qm.CI.length > 0) {
                    for (const ci of qm.CI) {
                        if (matched) break;

                        if (conditionsByType.CI && conditionsByType.CI.length > 0) {
                            if (checkEntityMatchStrict(ci.System, 'CI', conditionsByType.CI)) {
                                matched = true;
                                break;
                            }
                        }

                        if (conditionsByType.CC && conditionsByType.CC.length > 0) {
                            if (ci.CC && checkEntityMatchStrict(ci.CC.System, 'CC', conditionsByType.CC)) {
                                matched = true;
                                break;
                            }
                        }

                        if (ci.AO && ci.AO.length > 0) {
                            for (const ao of ci.AO) {
                                if (matched) break;

                                if (conditionsByType.AO && conditionsByType.AO.length > 0) {
                                    if (checkEntityMatchStrict(ao.System, 'AO', conditionsByType.AO)) {
                                        matched = true;
                                        break;
                                    }
                                }

                                if (conditionsByType.AC && conditionsByType.AC.length > 0) {
                                    if (ao.AC && checkEntityMatchStrict(ao.AC.System, 'AC', conditionsByType.AC)) {
                                        matched = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return matched;
    }

    /**
     * 조건들을 엔티티 타입별로 그룹화
     */
    function groupConditionsByType(conditions) {
        const grouped = {};
        conditions.forEach(cond => {
            const prefix = cond.property.split('.')[0];
            if (!grouped[prefix]) {
                grouped[prefix] = [];
            }
            grouped[prefix].push(cond);
        });
        return grouped;
    }

    /**
     * 엔티티가 조건에 매칭되는지 확인 (AND/OR 로직 지원)
     */
    function checkEntityMatchStrict(entity, entityPrefix, conditions) {
        if (!entity) return false;
        if (conditions.length === 0) return true;

        // 첫 번째 조건 평가
        let result = evaluateSingleCondition(entity, entityPrefix, conditions[0]);

        // 나머지 조건들을 AND/OR에 따라 평가
        for (let i = 1; i < conditions.length; i++) {
            const cond = conditions[i];
            const condResult = evaluateSingleCondition(entity, entityPrefix, cond);

            if (cond.logic === 'OR') {
                result = result || condResult;
            } else { // AND
                result = result && condResult;
            }
        }

        return result;
    }

    /**
     * 단일 조건 평가
     */
    function evaluateSingleCondition(entity, entityPrefix, cond) {
        let propPath = cond.property.substring(entityPrefix.length + 1);

        // QM, CI, AO는 .System 객체를 전달받으므로 "System." 접두사 제거
        if (['QM', 'CI', 'AO'].includes(entityPrefix) && propPath.startsWith('System.')) {
            propPath = propPath.substring(7);
        }

        const actualValue = getNestedProperty(entity, propPath);
        const result = evaluateCondition(actualValue, cond.operator, cond.value);

        return result;
    }

    /**
     * 중첩 속성 접근
     */
    function getNestedProperty(obj, path) {
        const parts = path.split('.');
        let value = obj;

        for (const part of parts) {
            if (value === null || value === undefined) return undefined;
            value = value[part];
        }

        return value;
    }

    /**
     * 조건 평가
     */
    function evaluateCondition(actualValue, operator, expectedValue) {
        if (actualValue === undefined || actualValue === null) {
            return false;
        }

        const actualStr = String(actualValue);
        const expectedStr = String(expectedValue);

        switch (operator) {
            case '==':
                return actualStr === expectedStr;
            case '!=':
                return actualStr !== expectedStr;
            case 'contains':
                return actualStr.includes(expectedStr);
            case 'startsWith':
                return actualStr.startsWith(expectedStr);
            case 'endsWith':
                return actualStr.endsWith(expectedStr);
            case '>':
                return parseFloat(actualValue) > parseFloat(expectedValue);
            case '<':
                return parseFloat(actualValue) < parseFloat(expectedValue);
            case '>=':
                return parseFloat(actualValue) >= parseFloat(expectedValue);
            case '<=':
                return parseFloat(actualValue) <= parseFloat(expectedValue);
            default:
                return false;
        }
    }

    /**
     * 필터 초기화
     */
    window.clearFilter = function() {
        const conditionsBuilder = document.getElementById('filter-conditions-builder');
        if (conditionsBuilder) {
            conditionsBuilder.innerHTML = '';
        }

        filterGroups = [];
        nextGroupId = 1;

        // 3D 뷰어 필터 해제
        if (window.viewer && window.viewer.clearFilter) {
            window.viewer.clearFilter();
        }

        // 결과 표시 숨기기
        const resultInfo = document.getElementById('filter-result-info');
        if (resultInfo) {
            resultInfo.style.display = 'none';
        }
    };

    console.log('[Filter] 3D Viewer Filter module loaded');
})();
