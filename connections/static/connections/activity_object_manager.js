// =====================================================================
// Activity Object Manager
// 액티비티 객체 관리 관련 함수들
// =====================================================================

// 전역 변수
let loadedActivityObjects = [];
window.loadedActivityObjects = [];
let selectedAoIds = new Set();
let aoGroupingLevels = [];
let allAoFields = [];

// =====================================================================
// 이벤트 리스너 설정
// =====================================================================

function setupAoListeners() {
    console.log('[DEBUG] Setting up Activity Object listeners...');

    // 수동 생성 버튼
    document
        .getElementById('create-ao-manual-btn')
        ?.addEventListener('click', createManualActivityObject);

    // 자동 생성 버튼
    document
        .getElementById('create-ao-auto-btn')
        ?.addEventListener('click', createActivityObjectsAuto);

    // BIM 저작도구 연동 버튼들
    document
        .getElementById('ao-get-from-client-btn')
        ?.addEventListener('click', getAoSelectionFromClient);
    document
        .getElementById('ao-select-in-client-btn')
        ?.addEventListener('click', selectAoInClient);

    // 3D 뷰포트 연동 버튼들
    document
        .getElementById('ao-get-from-3d-viewer-btn')
        ?.addEventListener('click', getAoSelectionFrom3DViewer);
    document
        .getElementById('ao-select-in-3d-viewer-btn')
        ?.addEventListener('click', selectAoIn3DViewer);

    // 필드 선택 버튼들
    document
        .getElementById('ao-select-all-fields-btn')
        ?.addEventListener('click', () => toggleAllAoFields(true));
    document
        .getElementById('ao-deselect-all-fields-btn')
        ?.addEventListener('click', () => toggleAllAoFields(false));
    document
        .getElementById('ao-render-table-btn')
        ?.addEventListener('click', applyAoFieldSelection);

    // 그룹핑 적용 버튼
    document
        .getElementById('apply-ao-grouping-btn')
        ?.addEventListener('click', () => renderActivityObjectsTable(window.loadedActivityObjects));

    // 그룹핑 추가 버튼
    document
        .getElementById('add-ao-group-level-btn')
        ?.addEventListener('click', addAoGroupingLevel);

    // 필터 버튼들
    document
        .getElementById('apply-ao-filter-btn')
        ?.addEventListener('click', applyAoFilters);
    document
        .getElementById('clear-ao-filter-btn')
        ?.addEventListener('click', clearAoFilters);

    // 선택 필터 해제 버튼 (사이드바와 footer 모두)
    document
        .getElementById('ao-clear-selection-filter-btn')
        ?.addEventListener('click', clearAoSelectionFilter);
    document
        .getElementById('ao-clear-selection-filter-btn-footer')
        ?.addEventListener('click', clearAoSelectionFilter);

    // 자동 수량계산 버튼
    document
        .getElementById('ao-auto-quantity-calc-btn')
        ?.addEventListener('click', recalculateAllAoQuantities);

    // 수동 수량입력 버튼
    document
        .getElementById('ao-manual-quantity-input-btn')
        ?.addEventListener('click', showManualAoQuantityInputModal);

    // 수동입력 해제 버튼
    document
        .getElementById('ao-reset-manual-btn')
        ?.addEventListener('click', resetManualAoInput);

    // 좌측 패널 탭 전환
    const aoLeftPanelTabs = document.querySelector('#activity-objects .left-panel-tabs');
    if (aoLeftPanelTabs) {
        aoLeftPanelTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('left-panel-tab-button')) {
                const targetTab = e.target.dataset.tab;

                // 모든 탭 버튼 비활성화
                aoLeftPanelTabs.querySelectorAll('.left-panel-tab-button').forEach(btn => {
                    btn.classList.remove('active');
                });

                // 클릭한 탭 버튼 활성화
                e.target.classList.add('active');

                // 모든 탭 콘텐츠 숨기기
                document.querySelectorAll('#activity-objects .left-panel-tab-content').forEach(content => {
                    content.classList.remove('active');
                });

                // 선택한 탭 콘텐츠 표시
                if (targetTab === 'ao-field-selection') {
                    document.getElementById('ao-field-selection-content').classList.add('active');
                } else if (targetTab === 'ao-properties') {
                    document.getElementById('ao-properties-content').classList.add('active');
                    renderAoPropertiesPanel(); // 속성 패널 업데이트
                }

                console.log('[Activity Object Manager] Switched to tab:', targetTab);
            }
        });
    }

    // 스플릿바 초기화
    initAoSplitBar();

    console.log('[DEBUG] Activity Object listeners setup complete.');
}

// =====================================================================
// 데이터 로드
// =====================================================================

async function loadActivityObjects() {
    if (!currentProjectId) {
        renderActivityObjectsTable([]);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/activity-objects/${currentProjectId}/`
        );
        if (!response.ok)
            throw new Error('액티비티 객체 목록을 불러오는데 실패했습니다.');

        const allObjects = await response.json();
        window.loadedActivityObjects = allObjects.filter(ao => ao.is_active !== false);
        console.log(`[Activity Object Manager] Loaded ${window.loadedActivityObjects.length} active ActivityObjects`);

        // 필드 선택 UI 업데이트 후 테이블 렌더링
        populateAoFieldSelection(window.loadedActivityObjects);
        // renderAoFieldCheckboxes()가 window.currentAoColumns를 초기화하고 테이블을 렌더링합니다
    } catch (error) {
        console.error('Error loading activity objects:', error);
        showToast(error.message, 'error');
    }
}

// Window에 노출
window.loadActivityObjects = loadActivityObjects;

// =====================================================================
// 자동 생성 (액티비티코드 기준)
// =====================================================================

async function createActivityObjectsAuto() {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }

    if (!confirm('CostItem에 할당된 Activity를 기준으로 ActivityObject를 자동 생성하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(
            `/connections/api/activity-objects/auto-create/${currentProjectId}/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
            }
        );

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || '자동 생성에 실패했습니다.');

        showToast(result.message, 'success');
        await loadActivityObjects();
    } catch (error) {
        console.error('Error creating activity objects:', error);
        showToast(error.message, 'error');
    }
}

// =====================================================================
// 수동 생성
// =====================================================================

async function createManualActivityObject() {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }

    // Activity 데이터 로드 확인
    if (!window.loadedActivities || window.loadedActivities.length === 0) {
        showToast('액티비티를 먼저 불러오세요.', 'error');
        return;
    }

    // 모달 생성
    const modalHtml = `
        <div class="modal-overlay" id="create-ao-modal">
            <div class="modal-content" style="width: 600px; max-height: 80vh;">
                <h3>액티비티 객체 수동 생성</h3>
                <div style="margin: 20px 0;">
                    <label style="display: block; margin-bottom: 10px;">
                        <strong>액티비티 선택:</strong> <span style="color: red;">*</span>
                        <select id="ao-activity-select" style="width: 100%; padding: 8px; margin-top: 5px;">
                            <option value="">-- 액티비티 선택 --</option>
                            ${window.loadedActivities.map(act =>
                                `<option value="${act.id}">${act.code} - ${act.name}</option>`
                            ).join('')}
                        </select>
                    </label>

                    <label style="display: block; margin-bottom: 10px;">
                        <strong>산출항목 선택 (선택사항):</strong>
                        <select id="ao-cost-item-select" style="width: 100%; padding: 8px; margin-top: 5px;">
                            <option value="">-- 산출항목 선택 안함 --</option>
                            ${window.loadedCostItems && window.loadedCostItems.length > 0
                                ? window.loadedCostItems.map(ci =>
                                    `<option value="${ci.id}">${ci.name || ci.id} (수량: ${ci.quantity || 0})</option>`
                                  ).join('')
                                : ''}
                        </select>
                    </label>

                    <label style="display: block; margin-bottom: 10px;">
                        <strong>수량 (선택사항):</strong>
                        <input type="number" id="ao-quantity-input" placeholder="비워두면 산출항목의 수량 사용" style="width: 100%; padding: 8px; margin-top: 5px;">
                    </label>

                    <label style="display: block; margin-bottom: 10px;">
                        <strong>시작일 (선택사항):</strong>
                        <input type="date" id="ao-start-date-input" style="width: 100%; padding: 8px; margin-top: 5px;">
                    </label>

                    <label style="display: block; margin-bottom: 10px;">
                        <strong>종료일 (선택사항):</strong>
                        <input type="date" id="ao-end-date-input" style="width: 100%; padding: 8px; margin-top: 5px;">
                    </label>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="create-ao-confirm-btn" style="padding: 8px 16px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">생성</button>
                    <button id="create-ao-cancel-btn" style="padding: 8px 16px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">취소</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 이벤트 리스너
    document.getElementById('create-ao-confirm-btn').addEventListener('click', async () => {
        const costItemId = document.getElementById('ao-cost-item-select').value;
        const activityId = document.getElementById('ao-activity-select').value;
        const quantity = document.getElementById('ao-quantity-input').value;
        const startDate = document.getElementById('ao-start-date-input').value;
        const endDate = document.getElementById('ao-end-date-input').value;

        if (!activityId) {
            showToast('액티비티를 선택해주세요.', 'error');
            return;
        }

        try {
            const payload = {
                activity_id: activityId,
                is_manual: true
            };

            if (costItemId) payload.cost_item_id = costItemId;
            if (quantity) payload.quantity = parseFloat(quantity);
            if (startDate) payload.start_date = startDate;
            if (endDate) payload.end_date = endDate;

            const response = await fetch(
                `/connections/api/activity-objects/${currentProjectId}/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken,
                    },
                    body: JSON.stringify(payload),
                }
            );

            const result = await response.json();
            if (!response.ok) throw new Error(result.message || '생성에 실패했습니다.');

            showToast(result.message, 'success');
            document.getElementById('create-ao-modal').remove();
            await loadActivityObjects();
        } catch (error) {
            console.error('Error creating activity object:', error);
            showToast(error.message, 'error');
        }
    });

    document.getElementById('create-ao-cancel-btn').addEventListener('click', () => {
        document.getElementById('create-ao-modal').remove();
    });

    // 모달 외부 클릭 시 닫기
    document.getElementById('create-ao-modal').addEventListener('click', (e) => {
        if (e.target.id === 'create-ao-modal') {
            document.getElementById('create-ao-modal').remove();
        }
    });
}

// =====================================================================
// 필드 선택 관련
// =====================================================================

function populateAoFieldSelection(activityObjects) {
    if (!activityObjects || activityObjects.length === 0) {
        allAoFields = [];
        // 빈 배열일 때도 체크박스 렌더링 (빈 테이블 표시를 위해)
        renderAoFieldCheckboxes();
        return;
    }

    const fieldsSet = new Set();

    activityObjects.forEach(ao => {
        // ActivityObject 자체 속성
        fieldsSet.add('AO.id');
        fieldsSet.add('AO.start_date');
        fieldsSet.add('AO.end_date');
        fieldsSet.add('AO.actual_duration');
        fieldsSet.add('AO.quantity');
        fieldsSet.add('AO.is_manual');
        fieldsSet.add('AO.manual_formula');
        fieldsSet.add('AO.progress');

        // Activity 속성
        if (ao.activity) {
            fieldsSet.add('Activity.code');
            fieldsSet.add('Activity.name');
            fieldsSet.add('Activity.duration_per_unit');
            fieldsSet.add('Activity.responsible_person');
        }

        // CostItem 속성
        if (ao.cost_item) {
            fieldsSet.add('CI.quantity');
            if (ao.cost_item.description) fieldsSet.add('CI.description');
        }

        // CostCode 속성
        if (ao.cost_code) {
            fieldsSet.add('CostCode.code');
            fieldsSet.add('CostCode.name');
            if (ao.cost_code.detail_code) fieldsSet.add('CostCode.detail_code');
            if (ao.cost_code.note) fieldsSet.add('CostCode.note');
        }

        // QuantityMember 속성
        if (ao.quantity_member) {
            fieldsSet.add('QM.name');
            if (ao.quantity_member.properties) {
                Object.keys(ao.quantity_member.properties).forEach(key => {
                    fieldsSet.add(`QM.properties.${key}`);
                });
            }
        }

        // MemberMark 속성
        if (ao.member_mark) {
            fieldsSet.add('MM.mark');
            if (ao.member_mark.description) fieldsSet.add('MM.description');
            if (ao.member_mark.properties) {
                Object.keys(ao.member_mark.properties).forEach(key => {
                    fieldsSet.add(`MM.properties.${key}`);
                });
            }
        }

        // BIM 속성
        if (ao.raw_data) {
            Object.keys(ao.raw_data).forEach(key => {
                if (key === 'Parameters') {
                    Object.keys(ao.raw_data.Parameters || {}).forEach(paramKey => {
                        fieldsSet.add(`BIM.Parameters.${paramKey}`);
                    });
                } else if (key === 'TypeParameters') {
                    Object.keys(ao.raw_data.TypeParameters || {}).forEach(paramKey => {
                        fieldsSet.add(`BIM.TypeParameters.${paramKey}`);
                    });
                } else if (typeof ao.raw_data[key] !== 'object') {
                    fieldsSet.add(`BIM.Attributes.${key}`);
                }
            });
        }
    });

    allAoFields = Array.from(fieldsSet).sort();

    renderAoFieldCheckboxes();
}

function renderAoFieldCheckboxes() {
    const container = document.getElementById('ao-field-checkboxes-container');
    if (!container) return;

    // 현재 선택된 컬럼 (없으면 기본값)
    if (!window.currentAoColumns) {
        // 기본으로 AO, Activity, CI 주요 필드만 선택
        window.currentAoColumns = [
            'AO.id', 'AO.start_date', 'AO.end_date', 'AO.quantity',
            'Activity.code', 'Activity.name',
            'CI.description'
        ];
    }

    // 필드를 카테고리별로 분류
    const aoFields = allAoFields.filter(f => f.startsWith('AO.'));
    const activityFields = allAoFields.filter(f => f.startsWith('Activity.'));
    const ciFields = allAoFields.filter(f => f.startsWith('CI.'));
    const costCodeFields = allAoFields.filter(f => f.startsWith('CostCode.'));
    const qmFields = allAoFields.filter(f => f.startsWith('QM.') && !f.startsWith('QM.properties.'));
    const qmPropertiesFields = allAoFields.filter(f => f.startsWith('QM.properties.'));
    const mmFields = allAoFields.filter(f => f.startsWith('MM.') && !f.startsWith('MM.properties.'));
    const mmPropertiesFields = allAoFields.filter(f => f.startsWith('MM.properties.'));
    const bimAttributesFields = allAoFields.filter(f => f.startsWith('BIM.Attributes.'));
    const bimParametersFields = allAoFields.filter(f => f.startsWith('BIM.Parameters.'));
    const bimTypeParametersFields = allAoFields.filter(f => f.startsWith('BIM.TypeParameters.'));

    let html = '';

    // AO 섹션
    if (aoFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #6a1b9a; margin: 10px 0 5px 0; font-size: 14px;">📅 액티비티 객체 속성 (AO)</h4>';
        aoFields.forEach(field => {
            const isChecked = window.currentAoColumns.includes(field) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input type="checkbox" class="ao-field-checkbox" value="${field}" ${isChecked}>
                    ${field}
                </label>
            `;
        });
        html += '</div>';
    }

    // Activity 섹션
    if (activityFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #d84315; margin: 10px 0 5px 0; font-size: 14px;">⚙️ 액티비티 코드 속성 (Activity)</h4>';
        activityFields.forEach(field => {
            const isChecked = window.currentAoColumns.includes(field) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input type="checkbox" class="ao-field-checkbox" value="${field}" ${isChecked}>
                    ${field}
                </label>
            `;
        });
        html += '</div>';
    }

    // CI 섹션 (상속)
    if (ciFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #1976d2; margin: 10px 0 5px 0; font-size: 14px;">📊 산출항목 속성 (CI, 상속)</h4>';
        ciFields.forEach(field => {
            const isChecked = window.currentAoColumns.includes(field) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input type="checkbox" class="ao-field-checkbox" value="${field}" ${isChecked}>
                    ${field}
                </label>
            `;
        });
        html += '</div>';
    }

    // CostCode 섹션 (상속)
    if (costCodeFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #c62828; margin: 10px 0 5px 0; font-size: 14px;">💰 공사코드 속성 (CostCode, 상속)</h4>';
        costCodeFields.forEach(field => {
            const isChecked = window.currentAoColumns.includes(field) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input type="checkbox" class="ao-field-checkbox" value="${field}" ${isChecked}>
                    ${field}
                </label>
            `;
        });
        html += '</div>';
    }

    // QM 기본 필드 섹션 (상속)
    if (qmFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #0288d1; margin: 10px 0 5px 0; font-size: 14px;">📌 수량산출부재 속성 (QM, 상속)</h4>';
        qmFields.forEach(field => {
            const isChecked = window.currentAoColumns.includes(field) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input type="checkbox" class="ao-field-checkbox" value="${field}" ${isChecked}>
                    ${field}
                </label>
            `;
        });
        html += '</div>';
    }

    // QM.properties 섹션 (상속)
    if (qmPropertiesFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #0097a7; margin: 10px 0 5px 0; font-size: 14px;">🔹 수량산출부재 properties (QM, 상속)</h4>';
        qmPropertiesFields.forEach(field => {
            const isChecked = window.currentAoColumns.includes(field) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input type="checkbox" class="ao-field-checkbox" value="${field}" ${isChecked}>
                    ${field}
                </label>
            `;
        });
        html += '</div>';
    }

    // MM 기본 필드 섹션 (상속)
    if (mmFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #7b1fa2; margin: 10px 0 5px 0; font-size: 14px;">🏷️ 일람부호 속성 (MM, 상속)</h4>';
        mmFields.forEach(field => {
            const isChecked = window.currentAoColumns.includes(field) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input type="checkbox" class="ao-field-checkbox" value="${field}" ${isChecked}>
                    ${field}
                </label>
            `;
        });
        html += '</div>';
    }

    // MM.properties 섹션 (상속)
    if (mmPropertiesFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #8e24aa; margin: 10px 0 5px 0; font-size: 14px;">🔸 일람부호 properties (MM, 상속)</h4>';
        mmPropertiesFields.forEach(field => {
            const isChecked = window.currentAoColumns.includes(field) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input type="checkbox" class="ao-field-checkbox" value="${field}" ${isChecked}>
                    ${field}
                </label>
            `;
        });
        html += '</div>';
    }

    // BIM Attributes 섹션 (상속)
    if (bimAttributesFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #00796b; margin: 10px 0 5px 0; font-size: 14px;">🏗️ BIM 기본 속성 (Attributes, 상속)</h4>';
        bimAttributesFields.forEach(field => {
            const isChecked = window.currentAoColumns.includes(field) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input type="checkbox" class="ao-field-checkbox" value="${field}" ${isChecked}>
                    ${field}
                </label>
            `;
        });
        html += '</div>';
    }

    // BIM Parameters 섹션 (상속)
    if (bimParametersFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #00897b; margin: 10px 0 5px 0; font-size: 14px;">🔧 BIM Parameters (상속)</h4>';
        bimParametersFields.forEach(field => {
            const isChecked = window.currentAoColumns.includes(field) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input type="checkbox" class="ao-field-checkbox" value="${field}" ${isChecked}>
                    ${field}
                </label>
            `;
        });
        html += '</div>';
    }

    // BIM TypeParameters 섹션 (상속)
    if (bimTypeParametersFields.length > 0) {
        html += '<div class="field-section"><h4 style="color: #00695c; margin: 10px 0 5px 0; font-size: 14px;">🔩 BIM TypeParameters (상속)</h4>';
        bimTypeParametersFields.forEach(field => {
            const isChecked = window.currentAoColumns.includes(field) ? 'checked' : '';
            html += `
                <label class="field-checkbox-label">
                    <input type="checkbox" class="ao-field-checkbox" value="${field}" ${isChecked}>
                    ${field}
                </label>
            `;
        });
        html += '</div>';
    }

    container.innerHTML = html;

    // 이벤트 리스너 추가
    container.querySelectorAll('.ao-field-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const checkedBoxes = container.querySelectorAll('.ao-field-checkbox:checked');
            window.currentAoColumns = Array.from(checkedBoxes).map(cb => cb.value);
            console.log('[Activity Object Manager] Updated currentAoColumns:', window.currentAoColumns);
            renderActivityObjectsTable(window.loadedActivityObjects);
        });
    });

    // 초기 렌더링: 기본 선택된 컬럼으로 테이블 표시
    // 빈 배열일 때도 테이블 렌더링 (빈 테이블 헤더 표시)
    renderActivityObjectsTable(window.loadedActivityObjects || []);
}

function toggleAllAoFields(checked) {
    const container = document.getElementById('ao-field-checkboxes-container');
    if (!container) return;

    const checkboxes = container.querySelectorAll('.ao-field-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);

    // window.currentAoColumns 업데이트
    if (checked) {
        window.currentAoColumns = Array.from(checkboxes).map(cb => cb.value);
    } else {
        window.currentAoColumns = [];
    }

    console.log('[Activity Object Manager] Toggled all fields:', checked, window.currentAoColumns);
    renderActivityObjectsTable(window.loadedActivityObjects);
}

function applyAoFieldSelection() {
    // 이미 체크박스 변경 시 자동으로 업데이트되지만, 명시적으로 재렌더링
    renderActivityObjectsTable(window.loadedActivityObjects);
    showToast('선택한 필드로 테이블을 업데이트했습니다.', 'success');
}

// =====================================================================
// 테이블 렌더링 (기본)
// =====================================================================

function renderActivityObjectsTable(activityObjects) {
    const container = document.getElementById('ao-table-container');
    if (!container) return;

    // window.currentAoColumns 사용
    const selectedFields = window.currentAoColumns || [];
    if (selectedFields.length === 0) {
        container.innerHTML = '<p>표시할 필드를 선택하세요.</p>';
        return;
    }

    // 빈 배열일 때: 테이블 헤더는 표시하고 빈 메시지 표시
    if (!activityObjects || activityObjects.length === 0) {
        // Clear property panel
        const propertyPanel = document.getElementById('ao-properties-content');
        if (propertyPanel) {
            propertyPanel.innerHTML = '<p>선택된 액티비티 객체가 없습니다.</p>';
        }

        // Clear selection state
        selectedAoIds.clear();

        console.log('[DEBUG][renderActivityObjectsTable] Cleared property panel and selection state due to empty array');

        // 테이블 헤더는 표시하되 빈 메시지 표시 (다른 탭들과 일관성 유지)
        const table = document.createElement('table');
        table.className = 'data-table';

        // 헤더
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        // 선택 체크박스 컬럼
        const checkboxTh = document.createElement('th');
        checkboxTh.style.width = '40px';
        checkboxTh.textContent = '';
        headerRow.appendChild(checkboxTh);

        // 선택된 필드 헤더들
        selectedFields.forEach(fieldPath => {
            const th = document.createElement('th');
            th.textContent = fieldPath;
            headerRow.appendChild(th);
        });

        // 삭제 버튼 컬럼
        const deleteTh = document.createElement('th');
        deleteTh.style.width = '80px';
        deleteTh.textContent = '작업';
        headerRow.appendChild(deleteTh);

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // 빈 tbody with message
        const tbody = document.createElement('tbody');
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = selectedFields.length + 2; // +2 for checkbox and delete columns
        emptyCell.style.textAlign = 'center';
        emptyCell.style.padding = '20px';
        emptyCell.textContent = '액티비티 객체가 없습니다.';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        table.appendChild(tbody);

        container.innerHTML = '';
        container.appendChild(table);
        return;
    }

    // 선택 필터 적용 (3D 뷰포트나 BIM 저작도구에서 선택한 객체만 표시)
    let filteredObjects = activityObjects;
    if (window.isAoFilterToSelectionActive && window.aoFilteredIds && window.aoFilteredIds.size > 0) {
        filteredObjects = activityObjects.filter(ao => window.aoFilteredIds.has(ao.id));
        console.log(`[DEBUG][AO] Applying selection filter: ${filteredObjects.length}/${activityObjects.length} objects`);
    }

    // 그룹핑 적용
    let displayData = applyAoGrouping(filteredObjects);

    // 기본 테이블 생성
    const table = document.createElement('table');
    table.className = 'data-table';

    // 헤더
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // 선택 체크박스 컬럼
    const checkboxTh = document.createElement('th');
    checkboxTh.style.width = '40px';
    const headerCheckbox = document.createElement('input');
    headerCheckbox.type = 'checkbox';
    headerCheckbox.addEventListener('change', (e) => {
        const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const aoId = cb.dataset.aoId;
            if (e.target.checked) {
                selectedAoIds.add(aoId);
            } else {
                selectedAoIds.delete(aoId);
            }
        });
    });
    checkboxTh.appendChild(headerCheckbox);
    headerRow.appendChild(checkboxTh);

    // 필드 헤더 (필터 입력 포함)
    selectedFields.forEach(field => {
        const th = document.createElement('th');
        th.style.minWidth = '120px';

        // 필드명
        const label = document.createElement('div');
        label.textContent = field;
        label.style.marginBottom = '4px';
        th.appendChild(label);

        // 필터 입력
        const filterInput = document.createElement('input');
        filterInput.type = 'text';
        filterInput.className = 'ao-filter-input';
        filterInput.dataset.field = field;
        filterInput.placeholder = '필터...';
        filterInput.style.width = '100%';
        filterInput.style.padding = '2px 4px';
        filterInput.style.fontSize = '12px';
        filterInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyAoFilter();
            }
        });
        th.appendChild(filterInput);

        headerRow.appendChild(th);
    });

    // 액션 컬럼
    const actionTh = document.createElement('th');
    actionTh.textContent = '액션';
    actionTh.style.width = '200px';
    headerRow.appendChild(actionTh);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 바디
    const tbody = document.createElement('tbody');

    // 재귀적으로 그룹과 행 렌더링
    function renderGroupOrRows(items, level = 0) {
        items.forEach(item => {
            if (item.isGroup) {
                // 그룹 헤더 행
                const groupRow = document.createElement('tr');
                groupRow.className = `group-header-row group-level-${item.groupLevel || level}`;
                groupRow.dataset.groupLevel = item.groupLevel || level;

                const groupTd = document.createElement('td');
                groupTd.colSpan = selectedFields.length + 2;

                // 들여쓰기
                const indent = '&nbsp;&nbsp;'.repeat(item.groupLevel || level);
                groupTd.innerHTML = `${indent}▼ ${item.groupKey}: ${item.groupValue} (${countAoItems(item.items)}개)`;

                groupTd.style.fontWeight = 'bold';
                groupTd.style.padding = '8px';
                groupTd.style.cursor = 'pointer';

                groupTd.addEventListener('click', function() {
                    toggleAoGroupRows(groupRow);
                });

                groupRow.appendChild(groupTd);
                tbody.appendChild(groupRow);

                // 그룹 아이템들 (재귀적으로)
                renderGroupOrRows(item.items, (item.groupLevel || level) + 1);
            } else {
                tbody.appendChild(createAoRow(item, selectedFields));
            }
        });
    }

    renderGroupOrRows(displayData);

    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
}

// 그룹 내 실제 아이템 개수 세기
function countAoItems(items) {
    let count = 0;
    items.forEach(item => {
        if (item.isGroup) {
            count += countAoItems(item.items);
        } else {
            count++;
        }
    });
    return count;
}

// 그룹 행 토글
function toggleAoGroupRows(groupRow) {
    const groupLevel = parseInt(groupRow.dataset.groupLevel || '0');
    const groupTd = groupRow.querySelector('td');
    const isCollapsed = groupTd.innerHTML.includes('▶');

    let sibling = groupRow.nextElementSibling;
    while (sibling) {
        // 같은 레벨 또는 더 낮은 레벨의 그룹을 만나면 중단
        if (sibling.classList.contains('group-header-row')) {
            const siblingLevel = parseInt(sibling.dataset.groupLevel || '0');
            if (siblingLevel <= groupLevel) {
                break;
            }
        }

        // 표시/숨김 토글
        sibling.style.display = isCollapsed ? '' : 'none';
        sibling = sibling.nextElementSibling;
    }

    // 아이콘 변경
    groupTd.innerHTML = isCollapsed
        ? groupTd.innerHTML.replace('▶', '▼')
        : groupTd.innerHTML.replace('▼', '▶');
}

function createAoRow(ao, selectedFields) {
    const row = document.createElement('tr');
    row.dataset.aoId = ao.id;

    // 선택된 행 하이라이트
    if (selectedAoIds.has(ao.id)) {
        row.classList.add('selected-row');
    }

    // 체크박스
    const checkboxTd = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.aoId = ao.id;
    checkbox.checked = selectedAoIds.has(ao.id);
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            selectedAoIds.add(ao.id);
            row.classList.add('selected-row');
        } else {
            selectedAoIds.delete(ao.id);
            row.classList.remove('selected-row');
        }
        renderAoPropertiesPanel();
    });
    checkboxTd.appendChild(checkbox);
    row.appendChild(checkboxTd);

    // 필드 값들
    selectedFields.forEach(field => {
        const td = document.createElement('td');
        td.textContent = getAoFieldValue(ao, field);
        row.appendChild(td);
    });

    // 액션 버튼들
    const actionTd = document.createElement('td');
    actionTd.style.whiteSpace = 'nowrap';

    if (ao.is_manual) {
        const clearManualBtn = document.createElement('button');
        clearManualBtn.textContent = '수동입력 해제';
        clearManualBtn.className = 'small-button';
        clearManualBtn.style.fontSize = '11px';
        clearManualBtn.style.padding = '4px 8px';
        clearManualBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 행 클릭 이벤트 방지
            clearManualInput(ao.id);
        });
        actionTd.appendChild(clearManualBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '삭제';
    deleteBtn.className = 'small-button danger-button';
    deleteBtn.style.fontSize = '11px';
    deleteBtn.style.padding = '4px 8px';
    deleteBtn.style.marginLeft = '4px';
    deleteBtn.addEventListener('click', (e) => {
        console.log('[DEBUG][renderActivityObjectsTable] Delete button clicked for AO:', ao.id);
        e.stopPropagation(); // 행 클릭 이벤트 방지
        deleteActivityObject(ao.id);
    });
    actionTd.appendChild(deleteBtn);

    row.appendChild(actionTd);

    // 행에 pointer cursor 추가
    row.style.cursor = 'pointer';

    // 행 클릭 시 체크박스 토글 및 속성 패널 표시
    row.addEventListener('click', (e) => {
        // 체크박스나 버튼 클릭 시에는 무시
        if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON') {
            return;
        }

        // 체크박스 토글
        checkbox.checked = !checkbox.checked;
        if (checkbox.checked) {
            selectedAoIds.add(ao.id);
            row.classList.add('selected-row');
        } else {
            selectedAoIds.delete(ao.id);
            row.classList.remove('selected-row');
        }
        renderAoPropertiesPanel();
    });

    return row;
}

function getAoFieldValue(ao, field) {
    const parts = field.split('.');

    if (parts[0] === 'AO') {
        return ao[parts[1]] || '';
    } else if (parts[0] === 'Activity') {
        return ao.activity?.[parts[1]] || '';
    } else if (parts[0] === 'CI') {
        return ao.cost_item?.[parts[1]] || '';
    } else if (parts[0] === 'CostCode') {
        return ao.cost_code?.[parts[1]] || '';
    } else if (parts[0] === 'QM') {
        if (parts[1] === 'properties' && parts[2]) {
            return ao.quantity_member?.properties?.[parts[2]] || '';
        }
        return ao.quantity_member?.[parts[1]] || '';
    } else if (parts[0] === 'MM') {
        if (parts[1] === 'properties' && parts[2]) {
            return ao.member_mark?.properties?.[parts[2]] || '';
        }
        return ao.member_mark?.[parts[1]] || '';
    } else if (parts[0] === 'BIM') {
        if (parts[1] === 'Parameters') {
            return ao.raw_data?.Parameters?.[parts.slice(2).join('.')] || '';
        } else if (parts[1] === 'TypeParameters') {
            return ao.raw_data?.TypeParameters?.[parts.slice(2).join('.')] || '';
        } else if (parts[1] === 'Attributes') {
            return ao.raw_data?.[parts[2]] || '';
        }
    }

    return '';
}

// =====================================================================
// 그룹핑
// =====================================================================

function applyAoGrouping(activityObjects) {
    // 동적으로 그룹핑 레벨 읽기
    updateAoGroupingLevels();

    if (aoGroupingLevels.length === 0) {
        return activityObjects;
    }

    // 재귀적 다단계 그룹핑
    return groupAoByLevels(activityObjects, aoGroupingLevels, 0);
}

function groupAoByLevels(items, groupFields, currentLevel) {
    if (currentLevel >= groupFields.length || groupFields.length === 0) {
        return items;
    }

    const currentField = groupFields[currentLevel];
    const groups = {};

    items.forEach(item => {
        const value = getAoFieldValue(item, currentField) || '(비어있음)';
        if (!groups[value]) {
            groups[value] = [];
        }
        groups[value].push(item);
    });

    const result = [];
    Object.entries(groups).forEach(([value, groupItems]) => {
        // 다음 레벨이 있으면 재귀적으로 그룹핑
        const subItems = currentLevel + 1 < groupFields.length
            ? groupAoByLevels(groupItems, groupFields, currentLevel + 1)
            : groupItems;

        result.push({
            isGroup: true,
            groupKey: currentField,
            groupValue: value,
            groupLevel: currentLevel,
            items: subItems
        });
    });

    return result;
}

function addAoGroupingLevel() {
    const container = document.getElementById('ao-grouping-controls');
    if (!container) return;

    const newLevelDiv = document.createElement('div');
    newLevelDiv.className = 'group-level';

    const select = document.createElement('select');
    select.className = 'group-by-select';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- 필드 선택 --';
    select.appendChild(defaultOption);

    allAoFields.forEach(field => {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = field;
        select.appendChild(option);
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-group-level-btn';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', function() {
        newLevelDiv.remove();
        updateAoGroupingLevels();
    });

    newLevelDiv.appendChild(select);
    newLevelDiv.appendChild(removeBtn);
    container.appendChild(newLevelDiv);
}

function updateAoGroupingLevels() {
    const container = document.getElementById('ao-grouping-controls');
    if (!container) return;

    const selects = container.querySelectorAll('.group-by-select');
    aoGroupingLevels = Array.from(selects).map(s => s.value).filter(v => v);
}

// =====================================================================
// 필터
// =====================================================================

// 필터 상태 저장
if (typeof window.aoColumnFilters === 'undefined') {
    window.aoColumnFilters = {};
}

function applyAoFilter() {
    // 모든 필터 입력에서 값 수집
    const filterInputs = document.querySelectorAll('.ao-filter-input');
    window.aoColumnFilters = {};

    filterInputs.forEach(input => {
        const field = input.dataset.field;
        const value = input.value.trim();
        if (value) {
            window.aoColumnFilters[field] = value.toLowerCase();
        }
    });

    // 필터링 적용
    const filtered = applyAoColumnFilters(window.loadedActivityObjects);
    renderActivityObjectsTable(filtered);
    showToast('필터가 적용되었습니다.', 'success');
}

function applyAoFilters() {
    applyAoFilter();
}

function clearAoFilters() {
    window.aoColumnFilters = {};
    // 필터 입력 필드 초기화
    const filterInputs = document.querySelectorAll('.ao-filter-input');
    filterInputs.forEach(input => {
        input.value = '';
    });
    renderActivityObjectsTable(window.loadedActivityObjects);
    showToast('필터가 초기화되었습니다.', 'success');
}

function applyAoColumnFilters(activityObjects) {
    if (!window.aoColumnFilters || Object.keys(window.aoColumnFilters).length === 0) {
        return activityObjects;
    }

    return activityObjects.filter(ao => {
        for (const field in window.aoColumnFilters) {
            const filterValue = window.aoColumnFilters[field];
            const aoValue = String(getAoFieldValue(ao, field) || '').toLowerCase();
            if (!aoValue.includes(filterValue)) {
                return false;
            }
        }
        return true;
    });
}

function clearAoSelectionFilter() {
    console.log('[DEBUG][AO] Clearing selection filter');

    // 필터 비활성화
    window.isAoFilterToSelectionActive = false;
    if (window.aoFilteredIds) {
        window.aoFilteredIds.clear();
    }

    // 버튼 숨기기 (사이드바 버튼과 테이블 하단 버튼 모두)
    const clearBtnSidebar = document.getElementById('ao-clear-selection-filter-btn');
    const clearBtnFooter = document.getElementById('ao-clear-selection-filter-btn-footer');

    if (clearBtnSidebar) {
        clearBtnSidebar.style.display = 'none';
    }
    if (clearBtnFooter) {
        clearBtnFooter.style.display = 'none';
    }

    // 테이블 다시 렌더링 (필터 없이)
    renderActivityObjectsTable(window.loadedActivityObjects);

    showToast('선택 필터가 해제되었습니다.', 'success');
}

// =====================================================================
// 속성 패널
// =====================================================================

function renderAoPropertiesPanel() {
    const container = document.getElementById('ao-selected-properties-container');
    if (!container) return;

    if (selectedAoIds.size !== 1) {
        container.innerHTML = '<p>액티비티 객체를 하나만 선택하세요.</p>';
        return;
    }

    const aoId = Array.from(selectedAoIds)[0];
    const ao = window.loadedActivityObjects.find(obj => obj.id === aoId);
    if (!ao) {
        container.innerHTML = '<p>선택한 객체를 찾을 수 없습니다.</p>';
        return;
    }

    let html = '';

    // ============ 1. AO 기본 속성 ============
    html += '<div class="property-section">';
    html += '<h4 style="color: #6a1b9a; border-bottom: 2px solid #6a1b9a; padding-bottom: 5px;">📅 액티비티 객체 기본 속성</h4>';
    html += '<table class="properties-table"><tbody>';
    html += `<tr><td class="prop-name">AO.id</td><td class="prop-value">${ao.id || 'N/A'}</td></tr>`;
    html += `<tr><td class="prop-name">AO.start_date</td><td class="prop-value">${ao.start_date || 'N/A'}</td></tr>`;
    html += `<tr><td class="prop-name">AO.end_date</td><td class="prop-value">${ao.end_date || 'N/A'}</td></tr>`;
    html += `<tr><td class="prop-name">AO.actual_duration</td><td class="prop-value">${ao.actual_duration || 'N/A'}</td></tr>`;
    html += `<tr><td class="prop-name">AO.quantity</td><td class="prop-value">${ao.quantity}</td></tr>`;
    html += `<tr><td class="prop-name">AO.is_manual</td><td class="prop-value">${ao.is_manual ? 'true' : 'false'}</td></tr>`;
    if (ao.manual_formula) {
        html += `<tr><td class="prop-name">AO.manual_formula</td><td class="prop-value">${ao.manual_formula}</td></tr>`;
    }
    html += `<tr><td class="prop-name">AO.progress</td><td class="prop-value">${ao.progress}%</td></tr>`;
    html += '</tbody></table>';
    html += '</div>';

    // ============ 2. Activity 속성 ============
    if (ao.activity) {
        html += '<div class="property-section">';
        html += '<h4 style="color: #d84315; border-bottom: 2px solid #d84315; padding-bottom: 5px;">⚙️ 액티비티 코드 속성</h4>';
        html += '<table class="properties-table"><tbody>';
        html += `<tr><td class="prop-name">Activity.code</td><td class="prop-value">${ao.activity.code || 'N/A'}</td></tr>`;
        html += `<tr><td class="prop-name">Activity.name</td><td class="prop-value">${ao.activity.name || 'N/A'}</td></tr>`;
        if (ao.activity.duration_per_unit !== null && ao.activity.duration_per_unit !== undefined) {
            html += `<tr><td class="prop-name">Activity.duration_per_unit</td><td class="prop-value">${ao.activity.duration_per_unit}</td></tr>`;
        }
        if (ao.activity.responsible_person) {
            html += `<tr><td class="prop-name">Activity.responsible_person</td><td class="prop-value">${ao.activity.responsible_person}</td></tr>`;
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    // ============ 3. CI 속성 (상속) ============
    if (ao.cost_item) {
        html += '<div class="property-section">';
        html += '<h4 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 5px;">📊 산출항목 속성 (상속 from CI)</h4>';
        html += '<table class="properties-table"><tbody>';
        html += `<tr><td class="prop-name">CI.id</td><td class="prop-value">${ao.cost_item.id || 'N/A'}</td></tr>`;
        if (ao.cost_item.quantity !== undefined) {
            html += `<tr><td class="prop-name">CI.quantity</td><td class="prop-value">${ao.cost_item.quantity}</td></tr>`;
        }
        if (ao.cost_item.description) {
            html += `<tr><td class="prop-name">CI.description</td><td class="prop-value">${ao.cost_item.description}</td></tr>`;
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    // ============ 4. CostCode 속성 (상속) ============
    if (ao.cost_code) {
        html += '<div class="property-section">';
        html += '<h4 style="color: #c62828; border-bottom: 2px solid #c62828; padding-bottom: 5px;">💰 공사코드 속성 (상속 from CostCode)</h4>';
        html += '<table class="properties-table"><tbody>';
        html += `<tr><td class="prop-name">CostCode.code</td><td class="prop-value">${ao.cost_code.code || 'N/A'}</td></tr>`;
        html += `<tr><td class="prop-name">CostCode.name</td><td class="prop-value">${ao.cost_code.name || 'N/A'}</td></tr>`;
        if (ao.cost_code.detail_code) {
            html += `<tr><td class="prop-name">CostCode.detail_code</td><td class="prop-value">${ao.cost_code.detail_code}</td></tr>`;
        }
        if (ao.cost_code.note) {
            html += `<tr><td class="prop-name">CostCode.note</td><td class="prop-value">${ao.cost_code.note}</td></tr>`;
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    // ============ 5. QM 속성 (상속) ============
    if (ao.quantity_member) {
        html += '<div class="property-section">';
        html += '<h4 style="color: #0288d1; border-bottom: 2px solid #0288d1; padding-bottom: 5px;">📌 수량산출부재 기본 속성 (상속 from QM)</h4>';
        html += '<table class="properties-table"><tbody>';
        html += `<tr><td class="prop-name">QM.id</td><td class="prop-value">${ao.quantity_member.id || 'N/A'}</td></tr>`;
        if (ao.quantity_member.name) {
            html += `<tr><td class="prop-name">QM.name</td><td class="prop-value">${ao.quantity_member.name}</td></tr>`;
        }
        html += '</tbody></table>';
        html += '</div>';

        // QM properties
        if (ao.quantity_member.properties && Object.keys(ao.quantity_member.properties).length > 0) {
            html += '<div class="property-section">';
            html += '<h4 style="color: #f57c00; border-bottom: 2px solid #f57c00; padding-bottom: 5px;">🔢 부재 속성 (상속 from QM)</h4>';
            html += '<table class="properties-table"><tbody>';
            for (const [key, value] of Object.entries(ao.quantity_member.properties)) {
                if (value !== null && value !== undefined) {
                    const displayValue = typeof value === 'number' ? value.toFixed(3) : value;
                    html += `<tr><td class="prop-name">QM.properties.${key}</td><td class="prop-value">${displayValue}</td></tr>`;
                }
            }
            html += '</tbody></table>';
            html += '</div>';
        }
    }

    // ============ 6. MM 속성 (상속) ============
    if (ao.member_mark) {
        html += '<div class="property-section">';
        html += '<h4 style="color: #7b1fa2; border-bottom: 2px solid #7b1fa2; padding-bottom: 5px;">📋 일람부호 (상속 from MM)</h4>';
        html += '<table class="properties-table"><tbody>';
        if (ao.member_mark.mark) {
            html += `<tr><td class="prop-name">MM.mark</td><td class="prop-value">${ao.member_mark.mark}</td></tr>`;
        }
        if (ao.member_mark.properties && Object.keys(ao.member_mark.properties).length > 0) {
            for (const [key, value] of Object.entries(ao.member_mark.properties)) {
                if (value !== null && value !== undefined) {
                    html += `<tr><td class="prop-name">MM.properties.${key}</td><td class="prop-value">${value}</td></tr>`;
                }
            }
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    // ============ 7. BIM 속성 (상속) ============
    if (ao.raw_data) {
        // BIM 시스템 속성
        html += '<div class="property-section">';
        html += '<h4 style="color: #00796b; border-bottom: 2px solid #00796b; padding-bottom: 5px;">🏗️ BIM 시스템 속성 (상속 from BIM)</h4>';
        html += '<table class="properties-table"><tbody>';

        const basicAttrs = ['Name', 'IfcClass', 'ElementId', 'UniqueId'];
        basicAttrs.forEach(attr => {
            if (ao.raw_data[attr] !== undefined && ao.raw_data[attr] !== null) {
                html += `<tr><td class="prop-name">BIM.Attributes.${attr}</td><td class="prop-value">${ao.raw_data[attr]}</td></tr>`;
            }
        });
        html += '</tbody></table>';
        html += '</div>';

        // BIM Parameters
        if (ao.raw_data.Parameters && typeof ao.raw_data.Parameters === 'object' && Object.keys(ao.raw_data.Parameters).length > 0) {
            html += '<div class="property-section">';
            html += '<h4 style="color: #00897b; border-bottom: 2px solid #00897b; padding-bottom: 5px;">🔧 BIM 파라메터 (상속)</h4>';
            html += '<table class="properties-table"><tbody>';
            const params = Object.entries(ao.raw_data.Parameters).slice(0, 20); // 최대 20개만 표시
            for (const [key, value] of params) {
                if (key === 'Geometry') continue;
                if (value !== null && value !== undefined) {
                    const displayValue = (typeof value === 'object')
                        ? JSON.stringify(value).substring(0, 100)
                        : String(value).substring(0, 200);
                    html += `<tr><td class="prop-name">BIM.Parameters.${key}</td><td class="prop-value">${displayValue}</td></tr>`;
                }
            }
            html += '</tbody></table>';
            html += '</div>';
        }

        // BIM TypeParameters
        if (ao.raw_data.TypeParameters && typeof ao.raw_data.TypeParameters === 'object' && Object.keys(ao.raw_data.TypeParameters).length > 0) {
            html += '<div class="property-section">';
            html += '<h4 style="color: #00695c; border-bottom: 2px solid #00695c; padding-bottom: 5px;">🔩 BIM 타입 파라메터 (상속)</h4>';
            html += '<table class="properties-table"><tbody>';
            const typeParams = Object.entries(ao.raw_data.TypeParameters).slice(0, 20); // 최대 20개만 표시
            for (const [key, value] of typeParams) {
                if (value !== null && value !== undefined) {
                    const displayValue = (typeof value === 'object')
                        ? JSON.stringify(value).substring(0, 100)
                        : String(value).substring(0, 200);
                    html += `<tr><td class="prop-name">BIM.TypeParameters.${key}</td><td class="prop-value">${displayValue}</td></tr>`;
                }
            }
            html += '</tbody></table>';
            html += '</div>';
        }
    }

    container.innerHTML = html;
}

// =====================================================================
// 수동 수량입력
// =====================================================================

function showManualAoQuantityInputModal() {
    const selectedActivityObjects = Array.from(selectedAoIds || []);
    if (!selectedActivityObjects || selectedActivityObjects.length === 0) {
        showToast('항목을 먼저 선택하세요.', 'error');
        return;
    }

    const selectedItems = window.loadedActivityObjects.filter(item => selectedActivityObjects.includes(item.id));
    console.log('[DEBUG][showManualAoQuantityInputModal] Selected items:', selectedItems);

    // 이전에 저장된 quantity_expression 확인
    let previousExpression = null;
    let previousMode = 'direct';
    let previousValue = '';
    let previousFormula = '';

    // 첫 번째 선택 항목의 표현식 확인 (여러 항목이 선택된 경우 첫 번째 것 사용)
    if (selectedItems.length > 0 && selectedItems[0].quantity_expression) {
        previousExpression = selectedItems[0].quantity_expression;
        if (previousExpression.mode === 'direct') {
            previousMode = 'direct';
            previousValue = previousExpression.value || '';
        } else if (previousExpression.mode === 'formula') {
            previousMode = 'formula';
            previousFormula = previousExpression.formula || '';
        }
        console.log('[DEBUG][showManualAoQuantityInputModal] Previous expression:', previousExpression);
    }

    // 모달 HTML 생성
    const modal = document.createElement('div');
    modal.id = 'manual-ao-quantity-input-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

    // 속성 옵션 생성 - 첫 번째 선택된 항목의 컨텍스트에서 동적으로 생성
    let propertyOptions = '<option value="">-- 속성 선택 --</option>';

    if (selectedItems.length > 0) {
        const sampleContext = buildActivityObjectContext(selectedItems[0]);
        const grouped = {};

        // Context 키를 그룹별로 분류
        Object.keys(sampleContext).forEach(key => {
            const parts = key.split('.');
            const group = parts[0]; // AO, Activity, CI, QM, MM, BIM 등

            if (!grouped[group]) grouped[group] = [];
            grouped[group].push(key);
        });

        // 그룹명 한글 매핑
        const groupNames = {
            'AO': 'ActivityObject 속성',
            'Activity': 'Activity 속성',
            'CI': 'CostItem 속성',
            'CostCode': 'CostCode 속성',
            'QM': 'QuantityMember 속성',
            'MM': 'MemberMark 속성',
            'BIM': 'BIM 속성'
        };

        // 각 그룹별로 옵션 생성
        Object.keys(grouped).sort().forEach(group => {
            propertyOptions += `<optgroup label="${groupNames[group] || group}">`;
            grouped[group].sort().forEach(key => {
                propertyOptions += `<option value="{${key}}">{${key}}</option>`;
            });
            propertyOptions += '</optgroup>';
        });
    } else {
        // 기본 옵션 (선택 항목 없을 때)
        propertyOptions += '<optgroup label="ActivityObject 속성">';
        propertyOptions += '<option value="{AO.quantity}">{AO.quantity}</option>';
        propertyOptions += '<option value="{AO.actual_duration}">{AO.actual_duration}</option>';
        propertyOptions += '</optgroup>';
    }

    modal.innerHTML = `
        <div style="background: white; border-radius: 8px; padding: 24px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #333;">수동 수량입력</h3>
            <p style="margin: 0 0 16px 0; font-size: 13px; color: #666;">선택된 ${selectedItems.length}개 항목의 수량을 입력합니다.</p>

            <div style="margin-bottom: 20px; padding: 12px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold; color: #495057;">입력 방식 선택</h4>
                <div style="display: flex; gap: 12px; margin-bottom: 12px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="input-mode" value="direct" ${previousMode === 'direct' ? 'checked' : ''} style="margin-right: 6px;">
                        <span style="font-size: 13px;">직접 입력</span>
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="input-mode" value="formula" ${previousMode === 'formula' ? 'checked' : ''} style="margin-right: 6px;">
                        <span style="font-size: 13px;">산식 입력</span>
                    </label>
                </div>

                <!-- 직접 입력 모드 -->
                <div id="direct-input-mode" style="display: ${previousMode === 'direct' ? 'block' : 'none'};">
                    <label style="display: block; margin-bottom: 4px; font-size: 13px; font-weight: 500; color: #495057;">수량 값</label>
                    <input type="number" id="direct-quantity-input" step="0.0001" placeholder="예: 100.5" value="${previousValue}"
                           style="width: 100%; padding: 8px; font-size: 13px; border: 1px solid #ced4da; border-radius: 4px;">
                    <small style="display: block; margin-top: 4px; font-size: 12px; color: #6c757d;">모든 선택 항목에 동일한 수량이 적용됩니다.</small>
                </div>

                <!-- 산식 입력 모드 -->
                <div id="formula-input-mode" style="display: ${previousMode === 'formula' ? 'block' : 'none'};">
                    <label style="display: block; margin-bottom: 4px; font-size: 13px; font-weight: 500; color: #495057;">수량 산식</label>
                    <textarea id="formula-quantity-input" placeholder="예: {CI.quantity} * 2.5 + {QM.volume} * 0.1"
                              style="width: 100%; min-height: 80px; padding: 8px; font-size: 13px; font-family: 'Courier New', monospace; border: 1px solid #ced4da; border-radius: 4px; resize: vertical;">${previousFormula}</textarea>
                    <div style="display: flex; gap: 8px; margin-top: 8px; align-items: center;">
                        <select id="formula-property-select" style="flex: 1; padding: 8px; font-size: 13px; border: 1px solid #ced4da; border-radius: 4px;">
                            ${propertyOptions}
                        </select>
                        <button type="button" id="insert-formula-property-btn" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; white-space: nowrap;">
                            속성 삽입
                        </button>
                    </div>
                    <small style="display: block; margin-top: 8px; font-size: 12px; color: #6c757d;">각 항목의 속성값을 기반으로 개별 계산됩니다.</small>
                </div>
            </div>

            <div style="margin-bottom: 20px; max-height: 200px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 4px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead style="background: #f8f9fa; position: sticky; top: 0;">
                        <tr>
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dee2e6;">Activity Code</th>
                            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #dee2e6;">현재 수량</th>
                            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #dee2e6;">기간</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${selectedItems.map(item => `
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${item.activity?.code || '-'}</td>
                                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #f0f0f0;">${item.quantity || 0}</td>
                                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #f0f0f0;">${item.actual_duration || 0}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button id="manual-ao-quantity-cancel-btn" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    취소
                </button>
                <button id="manual-ao-quantity-apply-btn" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">
                    적용
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 입력 모드 전환 이벤트
    const directMode = modal.querySelector('#direct-input-mode');
    const formulaMode = modal.querySelector('#formula-input-mode');
    modal.querySelectorAll('input[name="input-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'direct') {
                directMode.style.display = 'block';
                formulaMode.style.display = 'none';
            } else {
                directMode.style.display = 'none';
                formulaMode.style.display = 'block';
            }
        });
    });

    // 속성 삽입 버튼
    modal.querySelector('#insert-formula-property-btn')?.addEventListener('click', () => {
        const textarea = modal.querySelector('#formula-quantity-input');
        const select = modal.querySelector('#formula-property-select');
        const selectedValue = select.value;

        if (selectedValue) {
            const startPos = textarea.selectionStart;
            const endPos = textarea.selectionEnd;
            const currentValue = textarea.value;
            const newValue = currentValue.substring(0, startPos) + selectedValue + currentValue.substring(endPos);
            textarea.value = newValue;

            // 커서 위치 업데이트
            const newCursorPos = startPos + selectedValue.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();

            // 선택 초기화
            select.selectedIndex = 0;
        }
    });

    // 취소 버튼
    modal.querySelector('#manual-ao-quantity-cancel-btn')?.addEventListener('click', () => {
        modal.remove();
    });

    // 적용 버튼
    modal.querySelector('#manual-ao-quantity-apply-btn')?.addEventListener('click', async () => {
        const inputMode = modal.querySelector('input[name="input-mode"]:checked').value;

        try {
            let updatedCount = 0;

            if (inputMode === 'direct') {
                // 직접 입력 모드
                const directValue = parseFloat(modal.querySelector('#direct-quantity-input').value);

                if (isNaN(directValue)) {
                    showToast('유효한 숫자를 입력하세요.', 'error');
                    return;
                }

                console.log(`[DEBUG][Manual AO Quantity] Direct mode: ${directValue}`);

                for (const item of selectedItems) {
                    const updateData = {
                        quantity: directValue,
                        actual_duration: directValue,  // actual_duration도 함께 업데이트
                        is_manual: true,
                        manual_formula: '',  // null 대신 빈 문자열
                        quantity_expression: {
                            mode: 'direct',
                            value: directValue
                        }
                    };

                    const saveResponse = await fetch(`/connections/api/activity-objects/${currentProjectId}/${item.id}/`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrftoken,
                        },
                        body: JSON.stringify(updateData),
                    });

                    if (saveResponse.ok) {
                        updatedCount++;
                    } else {
                        const errorText = await saveResponse.text();
                        console.warn('[WARN] Failed to save item:', item.id, errorText);
                    }
                }
            } else {
                // 산식 입력 모드
                const formula = modal.querySelector('#formula-quantity-input').value.trim();

                if (!formula) {
                    showToast('수량 산식을 입력하세요.', 'error');
                    return;
                }

                console.log(`[DEBUG][Manual AO Quantity] Formula mode: ${formula}`);

                for (const item of selectedItems) {
                    const aoContext = buildActivityObjectContext(item);
                    const calculatedQuantity = evaluateQuantityFormula(formula, aoContext);

                    if (calculatedQuantity !== null && !isNaN(calculatedQuantity)) {
                        const updateData = {
                            quantity: calculatedQuantity,
                            actual_duration: calculatedQuantity,  // actual_duration도 함께 업데이트
                            is_manual: true,
                            manual_formula: formula,
                            quantity_expression: {
                                mode: 'formula',
                                formula: formula
                            }
                        };

                        const saveResponse = await fetch(`/connections/api/activity-objects/${currentProjectId}/${item.id}/`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': csrftoken,
                            },
                            body: JSON.stringify(updateData),
                        });

                        if (saveResponse.ok) {
                            updatedCount++;
                        } else {
                            const errorText = await saveResponse.text();
                            console.warn('[WARN] Failed to save item:', item.id, errorText);
                        }
                    } else {
                        console.warn('[WARN] Formula evaluation failed for item:', aoContext['Activity.code']);
                    }
                }
            }

            // 테이블 갱신
            await loadActivityObjects();
            showToast(`${updatedCount}개 항목의 수량이 업데이트되었습니다.`, 'success');
            modal.remove();

        } catch (error) {
            console.error('[ERROR][Manual AO Quantity Input]', error);
            showToast('수량 입력 중 오류가 발생했습니다.', 'error');
        }
    });

    // 모달 배경 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

async function clearManualInput(aoId) {
    console.log('[DEBUG][clearManualInput] Called with aoId:', aoId);

    if (!aoId) {
        showToast('액티비티 객체 ID가 없습니다.', 'error');
        return;
    }

    try {
        // 현재 객체 정보 가져오기
        const ao = window.loadedActivityObjects.find(item => item.id === aoId);
        if (!ao) {
            showToast('액티비티 객체를 찾을 수 없습니다.', 'error');
            return;
        }

        // 자동 계산 값 계산
        const durationPerUnit = ao.activity?.duration_per_unit || 0;
        const ciQuantity = ao.cost_item?.quantity || 0;
        const autoQuantity = durationPerUnit * ciQuantity;

        console.log('[DEBUG][clearManualInput] Calculated auto quantity:', autoQuantity);
        console.log('[DEBUG][clearManualInput] From: duration_per_unit =', durationPerUnit, ', ci_quantity =', ciQuantity);

        // 자동 계산 모드로 변경하는 데이터
        const updateData = {
            quantity: autoQuantity,
            actual_duration: autoQuantity,
            is_manual: false,
            manual_formula: '',
            quantity_expression: null
        };

        console.log('[DEBUG][clearManualInput] Update data:', updateData);

        // API 요청
        const response = await fetch(`/connections/api/activity-objects/${currentProjectId}/${aoId}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[ERROR][clearManualInput] Failed to update:', response.status, errorText);
            showToast('수동입력 해제 실패: ' + response.status, 'error');
            return;
        }

        const updatedAo = await response.json();
        console.log('[DEBUG][clearManualInput] Updated AO:', updatedAo);

        // 전역 데이터 업데이트
        const index = window.loadedActivityObjects.findIndex(item => item.id === aoId);
        if (index !== -1) {
            window.loadedActivityObjects[index] = updatedAo;
        }

        // UI 리프레시
        await loadActivityObjects();

        showToast('수동입력이 해제되었습니다.', 'success');
        console.log('[DEBUG][clearManualInput] Manual input cleared successfully');

    } catch (error) {
        console.error('[ERROR][clearManualInput] Exception:', error);
        showToast('수동입력 해제 중 오류 발생', 'error');
    }
}

// =====================================================================
// 삭제
// =====================================================================

async function deleteActivityObject(aoId) {
    console.log('[DEBUG][deleteActivityObject] Called with aoId:', aoId);
    console.log('[DEBUG][deleteActivityObject] Current loadedActivityObjects count:', window.loadedActivityObjects?.length);

    if (!confirm('이 액티비티 객체를 삭제하시겠습니까?')) {
        console.log('[DEBUG][deleteActivityObject] User cancelled deletion');
        return;
    }

    try {
        console.log('[DEBUG][deleteActivityObject] Sending DELETE request...');
        const response = await fetch(
            `/connections/api/activity-objects/${currentProjectId}/${aoId}/`,
            {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': csrftoken,
                },
            }
        );

        console.log('[DEBUG][deleteActivityObject] Response status:', response.status);
        const result = await response.json();
        console.log('[DEBUG][deleteActivityObject] Response result:', result);

        if (!response.ok) throw new Error(result.message || '삭제에 실패했습니다.');

        showToast(result.message, 'success');
        console.log('[DEBUG][deleteActivityObject] Reloading activity objects...');
        await loadActivityObjects();
        console.log('[DEBUG][deleteActivityObject] Reload complete');
    } catch (error) {
        console.error('[ERROR][deleteActivityObject] Error deleting activity object:', error);
        showToast(error.message, 'error');
    }
}

// =====================================================================
// BIM 저작도구 / 3D 뷰포트 연동
// =====================================================================

// BIM 저작도구에서 선택 정보 가져오기
function getAoSelectionFromClient() {
    const targetGroup = currentMode === 'revit' ? 'revit_broadcast_group' : 'blender_broadcast_group';
    frontendSocket.send(JSON.stringify({
        type: 'command_to_client',
        payload: {
            command: 'get_selection',
            target_group: targetGroup,
        },
    }));
    showToast(`${currentMode === 'revit' ? 'Revit' : 'Blender'}에 선택 정보 가져오기를 요청했습니다.`, 'info');
}

// 테이블에서 선택한 객체를 BIM 저작도구에서 선택
function selectAoInClient() {
    if (selectedAoIds.size === 0) {
        showToast(`테이블에서 ${currentMode === 'revit' ? 'Revit' : 'Blender'}으로 보낼 항목을 먼저 선택하세요.`, 'error');
        return;
    }

    // 선택된 ActivityObject들의 element_unique_id를 수집
    const uniqueIdsToSend = [];
    window.loadedActivityObjects
        .filter(ao => selectedAoIds.has(ao.id))
        .forEach(ao => {
            // ActivityObject → CostItem → QuantityMember → RawElement 체인
            if (ao.quantity_member && ao.quantity_member.id) {
                // QuantityMember ID로 raw_element_id 찾기
                const qm = window.loadedQuantityMembers?.find(q => q.id === ao.quantity_member.id);
                if (qm) {
                    const elementId = qm.split_element_id || qm.raw_element_id;
                    if (elementId) {
                        const rawElement = allRevitData.find(item => item.id === elementId);
                        if (rawElement && rawElement.element_unique_id) {
                            uniqueIdsToSend.push(rawElement.element_unique_id);
                        }
                    }
                }
            }
        });

    if (uniqueIdsToSend.length === 0) {
        showToast('선택한 액티비티 객체에 연결된 BIM 요소가 없습니다.', 'warning');
        return;
    }

    const targetGroup = currentMode === 'revit' ? 'revit_broadcast_group' : 'blender_broadcast_group';
    frontendSocket.send(JSON.stringify({
        type: 'command_to_client',
        payload: {
            command: 'select_elements',
            unique_ids: uniqueIdsToSend,
            target_group: targetGroup,
        },
    }));
    showToast(`${currentMode === 'revit' ? 'Revit' : 'Blender'}에서 ${uniqueIdsToSend.length}개 요소를 선택하도록 요청했습니다.`, 'success');
}

// 3D 뷰포트에서 선택한 객체를 테이블에서 선택
function getAoSelectionFrom3DViewer() {
    console.log('[DEBUG][AO] Getting selection from 3D viewer');

    if (typeof window.getSelectedObjectsFrom3DViewer !== 'function') {
        showToast('3D 뷰어 기능을 사용할 수 없습니다.', 'error');
        return;
    }

    const selected3DObjects = window.getSelectedObjectsFrom3DViewer();
    if (!selected3DObjects || selected3DObjects.length === 0) {
        showToast('3D 뷰포트에서 선택된 객체가 없습니다.', 'warning');
        return;
    }

    console.log(`[DEBUG][AO] Found ${selected3DObjects.length} selected objects in 3D viewer`);

    // 3D에서 선택된 객체의 BIM ID 수집
    const selectedBimIds = new Set();
    selected3DObjects.forEach(obj => {
        const bimObjectId = obj.userData.bimObjectId || obj.userData.rawElementId;
        if (bimObjectId) {
            selectedBimIds.add(bimObjectId);
        }
    });

    console.log(`[DEBUG][AO] Selected BIM IDs:`, Array.from(selectedBimIds));
    console.log(`[DEBUG][AO] window.loadedQuantityMembers:`, window.loadedQuantityMembers?.length || 'undefined');
    console.log(`[DEBUG][AO] window.loadedCostItems:`, window.loadedCostItems?.length || 'undefined');
    console.log(`[DEBUG][AO] window.loadedActivityObjects:`, window.loadedActivityObjects?.length || 'undefined');

    // 기존 선택 및 필터 초기화
    selectedAoIds.clear();
    window.aoFilteredIds = window.aoFilteredIds || new Set();
    window.aoFilteredIds.clear();

    // BIM ID → QuantityMember ID 매핑
    const qmIds = new Set();
    if (window.loadedQuantityMembers && window.loadedQuantityMembers.length > 0) {
        window.loadedQuantityMembers.forEach(qm => {
            const elementId = qm.split_element_id || qm.raw_element_id;
            if (elementId && selectedBimIds.has(elementId)) {
                qmIds.add(qm.id);
                console.log(`[DEBUG][AO] Matched QM: ${qm.id}, element: ${elementId}`);
            }
        });
    } else {
        console.warn('[WARN][AO] loadedQuantityMembers가 비어있습니다. 수량산출부재 탭을 먼저 로드하세요.');
    }

    console.log(`[DEBUG][AO] Matched QM IDs:`, Array.from(qmIds));

    // QuantityMember ID → CostItem ID 매핑
    const ciIds = new Set();
    if (window.loadedCostItems && window.loadedCostItems.length > 0) {
        window.loadedCostItems.forEach(ci => {
            // quantity_member는 객체일 수도 있고 ID 문자열일 수도 있음
            let qmId = null;
            if (ci.quantity_member) {
                if (typeof ci.quantity_member === 'object' && ci.quantity_member.id) {
                    qmId = ci.quantity_member.id;
                } else if (typeof ci.quantity_member === 'string') {
                    qmId = ci.quantity_member;
                }
            } else if (ci.quantity_member_id) {
                qmId = ci.quantity_member_id;
            }

            if (qmId && qmIds.has(qmId)) {
                ciIds.add(ci.id);
            }
        });
    } else {
        console.warn('[WARN][AO] loadedCostItems가 비어있습니다. 산출항목 탭을 먼저 로드하세요.');
    }

    console.log(`[DEBUG][AO] Matched CI IDs:`, Array.from(ciIds));

    // CostItem ID → ActivityObject 매핑
    window.loadedActivityObjects.forEach(ao => {
        if (ao.cost_item && ao.cost_item.id && ciIds.has(ao.cost_item.id)) {
            selectedAoIds.add(ao.id);
            window.aoFilteredIds.add(ao.id);
            console.log(`[DEBUG][AO] Matched AO: ${ao.id}, CI: ${ao.cost_item.id}`);
        }
    });

    console.log(`[DEBUG][AO] Selected ${selectedAoIds.size} activity objects from 3D viewer`);

    // 데이터가 없을 경우 경고
    if (!window.loadedQuantityMembers || window.loadedQuantityMembers.length === 0 ||
        !window.loadedCostItems || window.loadedCostItems.length === 0) {
        showToast('수량산출부재 또는 산출항목 데이터가 없습니다. 해당 탭을 먼저 로드하세요.', 'warning');
        return;
    }

    // 필터 활성화 및 버튼 표시
    window.isAoFilterToSelectionActive = true;
    const clearBtnSidebar = document.getElementById('ao-clear-selection-filter-btn');
    const clearBtnFooter = document.getElementById('ao-clear-selection-filter-btn-footer');

    if (clearBtnSidebar) {
        clearBtnSidebar.style.display = 'inline-block';
    }
    if (clearBtnFooter) {
        clearBtnFooter.style.display = 'inline-block';
    }

    // 테이블 재렌더링
    renderActivityObjectsTable(window.loadedActivityObjects);

    if (selectedAoIds.size > 0) {
        showToast(`3D 뷰포트에서 ${selectedAoIds.size}개 액티비티 객체를 선택했습니다.`, 'success');
    } else {
        showToast('3D 뷰포트에서 선택한 객체와 매칭되는 액티비티 객체가 없습니다.', 'warning');
    }
}

// 테이블에서 선택한 객체를 3D 뷰포트에서 선택
function selectAoIn3DViewer() {
    console.log('[DEBUG][AO] Selecting objects in 3D viewer');
    console.log('[DEBUG][AO] selectedAoIds:', Array.from(selectedAoIds));

    if (selectedAoIds.size === 0) {
        showToast('테이블에서 먼저 항목을 선택하세요.', 'warning');
        return;
    }

    if (typeof window.selectObjectsIn3DViewer !== 'function') {
        showToast('3D 뷰어 기능을 사용할 수 없습니다.', 'error');
        return;
    }

    // 선택된 ActivityObject들의 raw_element_id를 수집
    const bimIdsToSelect = [];
    const selectedAOs = window.loadedActivityObjects.filter(ao => selectedAoIds.has(ao.id));
    console.log('[DEBUG][AO] Found matching AOs:', selectedAOs.length);

    selectedAOs.forEach(ao => {
        if (ao.quantity_member && ao.quantity_member.id) {
            // QuantityMember ID로 raw_element_id 찾기
            const qm = window.loadedQuantityMembers?.find(q => q.id === ao.quantity_member.id);
            if (qm) {
                const elementId = qm.split_element_id || qm.raw_element_id;
                console.log('[DEBUG][AO] AO:', ao.id, 'QM:', qm.id, 'raw_element_id:', qm.raw_element_id, 'split_element_id:', qm.split_element_id, 'using:', elementId);
                if (elementId) {
                    bimIdsToSelect.push(elementId);
                }
            }
        }
    });

    console.log('[DEBUG][AO] BIM IDs to select:', bimIdsToSelect);

    if (bimIdsToSelect.length === 0) {
        showToast('선택한 액티비티 객체에 연결된 BIM 요소가 없습니다.', 'warning');
        return;
    }

    console.log(`[DEBUG][AO] Calling window.selectObjectsIn3DViewer with ${bimIdsToSelect.length} IDs`);
    window.selectObjectsIn3DViewer(bimIdsToSelect);

    showToast(`3D 뷰포트에서 ${bimIdsToSelect.length}개 객체를 선택했습니다.`, 'success');
}

// =====================================================================
// 스플릿바
// =====================================================================

function initAoSplitBar() {
    const container = document.querySelector('#activity-objects .split-layout-container');
    const leftPanel = document.querySelector('#activity-objects .left-panel');
    const splitBar = document.querySelector('#activity-objects .ao-split-bar');
    const rightPanel = document.querySelector('#activity-objects .right-panel');

    if (!container || !leftPanel || !splitBar || !rightPanel) {
        console.log('[Activity Object Manager] Split bar elements not found:', {
            container: !!container,
            leftPanel: !!leftPanel,
            splitBar: !!splitBar,
            rightPanel: !!rightPanel
        });
        return;
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    splitBar.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = leftPanel.offsetWidth;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const newWidth = startWidth + deltaX;
        const minWidth = 200;
        const maxWidth = 600;

        if (newWidth >= minWidth && newWidth <= maxWidth) {
            leftPanel.style.flexBasis = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }
    });

    console.log('[Activity Object Manager] Split bar initialized successfully');
}

// =====================================================================
// 자동 수량계산
// =====================================================================

/**
 * 모든 액티비티 객체의 수량을 자동 재계산
 * - 자동 계산: Activity.duration_per_unit * CI.quantity
 * - 수동 직접입력: 값 유지
 * - 수동 산식입력: 산식 재평가
 */
async function recalculateAllAoQuantities() {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }

    if (!confirm('모든 액티비티 객체의 수량을 재계산하시겠습니까?\n(수동 직접입력 값은 유지되고, 산식은 재평가됩니다.)')) {
        return;
    }

    try {
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        const allAos = window.loadedActivityObjects || [];

        for (const ao of allAos) {
            try {
                let newQuantity = null;

                if (ao.is_manual && !ao.manual_formula) {
                    // 케이스 2: 수동 직접입력 - 값 유지
                    console.log(`[DEBUG][Auto Calc] Skipping AO ${ao.id} (manual direct input)`);
                    skippedCount++;
                    continue;

                } else if (ao.is_manual && ao.manual_formula) {
                    // 케이스 3: 수동 산식입력 - 산식 재평가
                    const aoContext = buildActivityObjectContext(ao);
                    newQuantity = evaluateQuantityFormula(ao.manual_formula, aoContext);
                    console.log(`[DEBUG][Auto Calc] Evaluating formula for AO ${ao.id}: ${ao.manual_formula} = ${newQuantity}`);

                    if (newQuantity === null || isNaN(newQuantity)) {
                        console.warn(`[WARN][Auto Calc] Formula evaluation failed for AO ${ao.id}`);
                        errorCount++;
                        continue;
                    }

                } else {
                    // 케이스 1: 자동 계산 - Activity.duration_per_unit * CI.quantity
                    const durationPerUnit = ao.activity?.duration_per_unit || 0;
                    const ciQuantity = ao.cost_item?.quantity || 0;
                    newQuantity = durationPerUnit * ciQuantity;
                    console.log(`[DEBUG][Auto Calc] Auto calculating for AO ${ao.id}: ${durationPerUnit} * ${ciQuantity} = ${newQuantity}`);
                }

                // 서버에 저장
                const updateData = {
                    quantity: newQuantity,
                    actual_duration: newQuantity  // actual_duration도 함께 업데이트
                };

                const saveResponse = await fetch(`/connections/api/activity-objects/${currentProjectId}/${ao.id}/`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken,
                    },
                    body: JSON.stringify(updateData),
                });

                if (saveResponse.ok) {
                    updatedCount++;
                } else {
                    const errorText = await saveResponse.text();
                    console.warn(`[WARN][Auto Calc] Failed to save AO ${ao.id}:`, errorText);
                    errorCount++;
                }

            } catch (itemError) {
                console.error(`[ERROR][Auto Calc] Error processing AO ${ao.id}:`, itemError);
                errorCount++;
            }
        }

        // 테이블 갱신
        await loadActivityObjects();

        let message = `${updatedCount}개 항목이 재계산되었습니다.`;
        if (skippedCount > 0) message += ` (${skippedCount}개 수동입력 유지)`;
        if (errorCount > 0) message += ` (${errorCount}개 오류)`;

        showToast(message, updatedCount > 0 ? 'success' : 'info');

    } catch (error) {
        console.error('[ERROR][Auto Calc]', error);
        showToast('수량 재계산 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 선택된 ActivityObject의 수동 입력 모드를 해제하고 자동 계산 모드로 전환
 */
async function resetManualAoInput() {
    const selectedIds = Array.from(selectedAoIds || []);

    if (!selectedIds || selectedIds.length === 0) {
        showToast('항목을 먼저 선택하세요.', 'error');
        return;
    }

    if (!confirm(`선택된 ${selectedIds.length}개 항목의 수동입력을 해제하고 자동 계산 모드로 전환하시겠습니까?`)) {
        return;
    }

    console.log(`[DEBUG][resetManualAoInput] Resetting ${selectedIds.length} items`);

    try {
        let successCount = 0;
        let errorCount = 0;

        for (const aoId of selectedIds) {
            const ao = window.loadedActivityObjects.find(item => item.id === aoId);
            if (!ao) {
                errorCount++;
                continue;
            }

            // 자동 계산 값 산출
            const durationPerUnit = ao.activity?.duration_per_unit || 0;
            const ciQuantity = ao.cost_item?.quantity || 0;
            const autoQuantity = durationPerUnit * ciQuantity;

            const updateData = {
                quantity: autoQuantity,
                actual_duration: autoQuantity,
                is_manual: false,
                manual_formula: '',
                quantity_expression: null
            };

            const response = await fetch(`/connections/api/activity-objects/${currentProjectId}/${aoId}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify(updateData),
            });

            if (response.ok) {
                successCount++;
            } else {
                const errorText = await response.text();
                console.warn(`[WARN][resetManualAoInput] Failed to reset AO ${aoId}:`, errorText);
                errorCount++;
            }
        }

        await loadActivityObjects();

        let message = `${successCount}개 항목이 자동 계산 모드로 전환되었습니다.`;
        if (errorCount > 0) message += ` (${errorCount}개 오류)`;

        showToast(message, successCount > 0 ? 'success' : 'error');

    } catch (error) {
        console.error('[ERROR][resetManualAoInput]', error);
        showToast('수동입력 해제 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * ActivityObject의 컨텍스트를 빌드 (산식 평가용)
 */
function buildActivityObjectContext(ao) {
    const context = {};

    // ActivityObject 속성
    context['AO.id'] = ao.id;
    context['AO.quantity'] = ao.quantity || 0;
    context['AO.actual_duration'] = ao.actual_duration || 0;
    context['AO.start_date'] = ao.start_date || null;
    context['AO.end_date'] = ao.end_date || null;
    context['AO.progress'] = ao.progress || 0;
    context['AO.is_manual'] = ao.is_manual || false;

    // Activity 속성
    if (ao.activity) {
        context['Activity.code'] = ao.activity.code || '';
        context['Activity.name'] = ao.activity.name || '';
        context['Activity.duration_per_unit'] = ao.activity.duration_per_unit || 0;
        context['Activity.responsible_person'] = ao.activity.responsible_person || '';
    }

    // CostItem 속성
    if (ao.cost_item) {
        context['CI.id'] = ao.cost_item.id;
        context['CI.name'] = ao.cost_item.name || '';
        context['CI.quantity'] = ao.cost_item.quantity || 0;
        context['CI.unit'] = ao.cost_item.unit || '';
        context['CI.description'] = ao.cost_item.description || '';
    }

    // CostCode 속성
    if (ao.cost_code) {
        context['CostCode.code'] = ao.cost_code.code || '';
        context['CostCode.name'] = ao.cost_code.name || '';
        context['CostCode.detail_code'] = ao.cost_code.detail_code || '';
        context['CostCode.note'] = ao.cost_code.note || '';
    }

    // QuantityMember 속성
    if (ao.quantity_member) {
        const qm = ao.quantity_member;
        context['QM.id'] = qm.id;
        context['QM.name'] = qm.name || '';
        context['QM.volume'] = qm.volume || 0;
        context['QM.area'] = qm.area || 0;
        context['QM.length'] = qm.length || 0;
        context['QM.count'] = qm.count || 0;

        // QM properties
        if (qm.properties) {
            Object.keys(qm.properties).forEach(key => {
                context[`QM.properties.${key}`] = qm.properties[key];
            });
        }
    }

    // MemberMark 속성
    if (ao.member_mark) {
        const mm = ao.member_mark;
        context['MM.mark'] = mm.mark || '';
        context['MM.description'] = mm.description || '';

        // MM properties
        if (mm.properties) {
            Object.keys(mm.properties).forEach(key => {
                context[`MM.properties.${key}`] = mm.properties[key];
            });
        }
    }

    // BIM Raw Data 속성
    if (ao.raw_data) {
        // System properties
        Object.keys(ao.raw_data).forEach(key => {
            if (key === 'Parameters' || key === 'TypeParameters') return;
            if (typeof ao.raw_data[key] !== 'object') {
                context[`BIM.Attributes.${key}`] = ao.raw_data[key];
            }
        });

        // Parameters
        if (ao.raw_data.Parameters) {
            Object.keys(ao.raw_data.Parameters).forEach(key => {
                context[`BIM.Parameters.${key}`] = ao.raw_data.Parameters[key];
            });
        }

        // TypeParameters
        if (ao.raw_data.TypeParameters) {
            Object.keys(ao.raw_data.TypeParameters).forEach(key => {
                context[`BIM.TypeParameters.${key}`] = ao.raw_data.TypeParameters[key];
            });
        }
    }

    return context;
}

// Window에 함수 노출
window.setupAoListeners = setupAoListeners;
window.initAoSplitBar = initAoSplitBar;
window.recalculateAllAoQuantities = recalculateAllAoQuantities;
