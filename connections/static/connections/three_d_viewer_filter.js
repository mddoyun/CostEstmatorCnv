// three_d_viewer_filter.js
// 3D Viewer 필터링 기능

(function() {
    let filterData = null;  // 필터 데이터 캐시
    let currentConditions = [];  // 현재 필터 조건들
    let availableProperties = [];  // 사용 가능한 속성 목록

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
            const response = await fetch(`/api/filter/data/${window.currentProjectId}/`);
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

        const sample = data[0];

        // BIM 속성
        if (sample.BIM) {
            Object.keys(sample.BIM).forEach(key => {
                props.add(`BIM.${key}`);
            });
        }

        // QM 속성
        if (sample.QM && sample.QM.length > 0) {
            const qm = sample.QM[0];
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

            // CI 속성
            if (qm.CI && qm.CI.length > 0) {
                const ci = qm.CI[0];
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

                // AO 속성
                if (ci.AO && ci.AO.length > 0) {
                    const ao = ci.AO[0];
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
                }
            }
        }

        return Array.from(props).sort();
    }

    /**
     * 조건 추가
     */
    window.addFilterCondition = function() {
        const conditionsBuilder = document.getElementById('filter-conditions-builder');
        if (!conditionsBuilder) return;

        const conditionRow = createConditionRow();
        conditionsBuilder.appendChild(conditionRow);
    };

    /**
     * 조건 행 생성
     */
    function createConditionRow(condition = null) {
        const row = document.createElement('div');
        row.className = 'filter-condition-row';

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
        };

        row.appendChild(propertySelect);
        row.appendChild(operatorSelect);
        row.appendChild(valueInput);
        row.appendChild(removeBtn);

        return row;
    }

    /**
     * 필터 적용
     */
    window.applyFilter = async function() {
        const conditionsBuilder = document.getElementById('filter-conditions-builder');
        if (!conditionsBuilder) return;

        // 조건 수집
        const rows = conditionsBuilder.querySelectorAll('.filter-condition-row');
        const conditions = [];

        rows.forEach(row => {
            const property = row.querySelector('.filter-property-select').value;
            const operator = row.querySelector('.filter-operator-select').value;
            const value = row.querySelector('.filter-value-input').value;

            if (property && value) {
                conditions.push({ property, operator, value });
            }
        });

        if (conditions.length === 0) {
            alert('필터 조건을 추가해주세요.');
            return;
        }

        currentConditions = conditions;

        try {
            const response = await fetch(`/api/filter/apply/${window.currentProjectId}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify({ conditions })
            });

            const data = await response.json();

            if (data.status === 'success') {
                console.log('[Filter] Matched IDs:', data.matched_ids);

                // 3D 뷰어에 필터 적용
                if (window.viewer && window.viewer.applyFilter) {
                    window.viewer.applyFilter(data.matched_ids);
                }

                // 결과 표시
                const resultInfo = document.getElementById('filter-result-info');
                const resultText = document.getElementById('filter-result-text');
                if (resultInfo && resultText) {
                    resultInfo.style.display = 'block';
                    resultText.textContent = `${data.total_count}개 객체 필터링됨`;
                }
            } else {
                alert('필터 적용 실패: ' + (data.message || '알 수 없는 오류'));
            }
        } catch (error) {
            console.error('[Filter] Error applying filter:', error);
            alert('필터 적용 중 오류가 발생했습니다.');
        }
    };

    /**
     * 필터 초기화
     */
    window.clearFilter = function() {
        const conditionsBuilder = document.getElementById('filter-conditions-builder');
        if (conditionsBuilder) {
            conditionsBuilder.innerHTML = '';
        }

        currentConditions = [];

        // 3D 뷰어 필터 제거
        if (window.viewer && window.viewer.clearFilter) {
            window.viewer.clearFilter();
        }

        // 결과 정보 숨기기
        const resultInfo = document.getElementById('filter-result-info');
        if (resultInfo) {
            resultInfo.style.display = 'none';
        }
    };

    /**
     * CSRF 토큰 가져오기
     */
    function getCSRFToken() {
        const tokenElement = document.querySelector('[name=csrfmiddlewaretoken]');
        return tokenElement ? tokenElement.value : '';
    }

    // 이벤트 리스너 등록
    document.addEventListener('DOMContentLoaded', function() {
        // 필터 패널 열기 버튼
        const openBtn = document.getElementById('open-filter-panel-btn');
        if (openBtn) {
            openBtn.addEventListener('click', openFilterPanel);
        }

        // 필터 패널 닫기 버튼
        const closeBtn = document.getElementById('close-filter-panel-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeFilterPanel);
        }

        // 조건 추가 버튼
        const addCondBtn = document.getElementById('add-filter-condition-btn');
        if (addCondBtn) {
            addCondBtn.addEventListener('click', addFilterCondition);
        }

        // 필터 적용 버튼
        const applyBtn = document.getElementById('apply-filter-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', applyFilter);
        }

        // 필터 초기화 버튼
        const clearBtn = document.getElementById('clear-filter-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', clearFilter);
        }
    });

    console.log('[Filter] 3D Viewer Filter module loaded');
})();
