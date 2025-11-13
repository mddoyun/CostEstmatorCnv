// =====================================================================
// Navigation and Tab Handling
// =====================================================================

window.handleMainNavClick = function handleMainNavClick(e) {
    const clickedButton = e.currentTarget;
    const primaryTabId = clickedButton.dataset.primaryTab; // 예: "management", "takeoff", "schematic-estimation-sd"
    console.log(
        `[DEBUG][handleMainNavClick] Clicked main tab button: ${primaryTabId}`
    );

    if (clickedButton.classList.contains('active')) {
        console.log(
            `[DEBUG][handleMainNavClick] Tab '${primaryTabId}' is already active.`
        );
        return;
    }

    // ▼▼▼ [추가] 탭 전환 전 상태 저장 (카메라, 선택, 가시성) ▼▼▼
    const previousTab = window.activeTab;
    if (previousTab === 'three-d-viewer') {
        // 3D 뷰어 탭에서 나갈 때 모든 상태를 데이터 관리 뷰어로 동기화
        if (typeof window.syncCameraStateToDataMgmt === 'function') {
            window.syncCameraStateToDataMgmt();
        }
        if (typeof window.syncSelectionToDataMgmt === 'function') {
            window.syncSelectionToDataMgmt();
        }
        if (typeof window.syncVisibilityToDataMgmt === 'function') {
            window.syncVisibilityToDataMgmt();
        }
    } else if (previousTab === 'data-management') {
        // 데이터 관리 탭에서 나갈 때 모든 상태를 메인 뷰어로 동기화
        if (typeof window.syncCameraStateFromDataMgmt === 'function') {
            window.syncCameraStateFromDataMgmt();
        }
        if (typeof window.syncSelectionFromDataMgmt === 'function') {
            window.syncSelectionFromDataMgmt();
        }
        if (typeof window.syncVisibilityFromDataMgmt === 'function') {
            window.syncVisibilityFromDataMgmt();
        }
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // --- UI 상태 변경 ---
    document
        .querySelectorAll('.main-nav .nav-button.active')
        .forEach((btn) => btn.classList.remove('active'));
    document
        .querySelectorAll('.secondary-nav.active')
        .forEach((nav) => nav.classList.remove('active'));
    document
        .querySelectorAll('.main-content > .tab-content.active')
        .forEach((content) => content.classList.remove('active'));

    clickedButton.classList.add('active');
    console.log(
        `[DEBUG][handleMainNavClick] Main button '${primaryTabId}' activated.`
    );

    // --- 해당 주 탭에 맞는 보조 탭 또는 컨텐츠 활성화 ---
    const secondaryNav = document.getElementById(
        `secondary-nav-${primaryTabId}`
    );
    const targetContent = document.getElementById(primaryTabId); // DD, SD 탭은 ID가 동일

    if (secondaryNav) {
        // '관리', '산출' 탭처럼 보조 네비게이션이 있는 경우
        console.log(
            `[DEBUG][handleMainNavClick] Activating secondary nav: secondary-nav-${primaryTabId}`
        );
        secondaryNav.classList.add('active');

        let subNavButtonToClick = secondaryNav.querySelector(
            '.sub-nav-button.active'
        );
        if (!subNavButtonToClick) {
            subNavButtonToClick = secondaryNav.querySelector('.sub-nav-button'); // 첫 번째 버튼
            console.log(
                '[DEBUG][handleMainNavClick] No active sub-tab found, will activate the first one.'
            );
        } else {
            console.log(
                `[DEBUG][handleMainNavClick] Found previously active sub-tab: ${subNavButtonToClick.dataset.tab}`
            );
        }

        if (subNavButtonToClick) {
            console.log(
                `[DEBUG][handleMainNavClick] Programmatically clicking sub-tab: ${subNavButtonToClick.dataset.tab}`
            );
            subNavButtonToClick.click(); // 하위 탭 클릭 핸들러가 컨텐츠 활성화 및 데이터 로드 담당
        } else {
            console.warn(
                `[WARN][handleMainNavClick] No sub-tab buttons found in secondary nav: secondary-nav-${primaryTabId}.`
            );
            // 보조 탭 버튼이 없으면, 해당 ID의 메인 컨텐츠를 직접 활성화 시도 (예외 케이스)
            if (targetContent) {
                console.log(
                    `[DEBUG][handleMainNavClick] Activating content directly as fallback: ${primaryTabId}`
                );
                targetContent.classList.add('active');
                activeTab = primaryTabId;
                loadDataForActiveTab();
            } else {
                activeTab = null;
            }
        }
        // [수정] home 탭은 보조 네비게이션이 없으므로 직접 처리
    } else if (targetContent && primaryTabId === 'home') {
        console.log(
            `[DEBUG][handleMainNavClick] Activating home tab content directly`
        );
        targetContent.classList.add('active');
        activeTab = primaryTabId;
        loadDataForActiveTab();
    } else {
        // 보조 탭 버튼이 없으면, 해당 ID의 메인 컨텐츠를 직접 활성화 시도 (예외 케이스)
        if (targetContent) {
            console.log(
                `[DEBUG][handleMainNavClick] Activating content directly as fallback: ${primaryTabId}`
            );
            targetContent.classList.add('active');
            activeTab = primaryTabId;
            loadDataForActiveTab();
        } else {
            activeTab = null;
        }
    }
    console.log(
        `[DEBUG][handleMainNavClick] Function end. Current activeTab: ${activeTab}`
    );
}

window.handleSubNavClick = function handleSubNavClick(e) {
    const clickedButton = e.currentTarget;
    const targetTabId = clickedButton.dataset.tab; // 클릭된 보조 탭 ID (예: "ruleset-management", "ai-model-manager")
    const targetContent = document.getElementById(targetTabId);
    console.log(
        `[DEBUG][handleSubNavClick] Clicked sub-tab button: ${targetTabId}`
    );

    // --- 이미 활성화된 탭이면 무시 ---
    if (
        activeTab === targetTabId &&
        targetContent &&
        targetContent.classList.contains('active')
    ) {
        console.log(
            `[DEBUG][handleSubNavClick] Tab '${targetTabId}' is already the active tab and content is visible. No action needed.`
        );
        return;
    }

    // --- 탭 UI 활성화/비활성화 처리 ---
    const parentNav = clickedButton.closest('.secondary-nav');
    if (parentNav) {
        parentNav
            .querySelector('.sub-nav-button.active')
            ?.classList.remove('active');
        clickedButton.classList.add('active');
    } else {
        console.warn(
            `[WARN][handleSubNavClick] Could not find parent .secondary-nav for clicked button.`
        );
    }

    // ▼▼▼ [추가] 탭 전환 전 상태 동기화 ▼▼▼
    const previousTab = activeTab;

    // ▼▼▼ [추가] 시뮬레이션 탭에서 나갈 때 레이아웃 복원 ▼▼▼
    if (previousTab === 'three-d-viewer') {
        // 상단 섹션 복원
        const viewerTopSection = document.getElementById('viewer-top-section');
        if (viewerTopSection) {
            viewerTopSection.style.flex = '1';
            viewerTopSection.style.minHeight = '300px';
            viewerTopSection.style.height = '';
            viewerTopSection.style.overflow = '';
        }
        // 첫 번째 스플릿바는 HTML에서 제거됨
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    if (previousTab === 'data-management') {
        // 데이터 관리 탭에서 나갈 때 모든 상태를 메인 뷰어로 동기화
        if (typeof window.syncCameraStateFromDataMgmt === 'function') {
            window.syncCameraStateFromDataMgmt();
        }
        if (typeof window.syncSelectionFromDataMgmt === 'function') {
            window.syncSelectionFromDataMgmt();
        }
        if (typeof window.syncVisibilityFromDataMgmt === 'function') {
            window.syncVisibilityFromDataMgmt();
        }
    } else if (previousTab === 'three-d-viewer' && targetTabId === 'data-management') {
        // 3D 뷰어에서 데이터 관리 탭으로 갈 때 상태를 데이터 관리 뷰어로 동기화
        if (typeof window.syncCameraStateToDataMgmt === 'function') {
            window.syncCameraStateToDataMgmt();
        }
        if (typeof window.syncSelectionToDataMgmt === 'function') {
            window.syncSelectionToDataMgmt();
        }
        if (typeof window.syncVisibilityToDataMgmt === 'function') {
            window.syncVisibilityToDataMgmt();
        }
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    activeTab = targetTabId; // 전역 activeTab 변수 업데이트
    console.log(
        `[DEBUG][handleSubNavClick] Active tab globally set to: ${activeTab}`
    );

    // 모든 메인 컨텐츠 영역 숨기기
    document
        .querySelectorAll('.main-content > .tab-content.active')
        .forEach((c) => c.classList.remove('active'));

    // 클릭된 탭에 해당하는 컨텐츠 영역 보이기
    if (targetContent) {
        targetContent.classList.add('active');
        console.log(
            `[DEBUG][handleSubNavClick] Content element ID '${targetTabId}' activated.`
        );
    } else {
        console.warn(
            `[WARN][handleSubNavClick] Content element with ID '${targetTabId}' not found.`
        );
        loadDataForActiveTab(); // 컨텐츠 없어도 일단 로드 시도
        return;
    }
    // --- 탭 UI 처리 끝 ---

    // ▼▼▼ [추가] 시뮬레이션 탭 진입 시 레이아웃 조정 ▼▼▼
    if (targetTabId === 'three-d-viewer') {
        // 상단 섹션 숨기기
        const viewerTopSection = document.getElementById('viewer-top-section');
        if (viewerTopSection) {
            viewerTopSection.style.flex = '0';
            viewerTopSection.style.minHeight = '0';
            viewerTopSection.style.height = '0';
            viewerTopSection.style.overflow = 'hidden';
        }
        // 첫 번째 스플릿바는 HTML에서 제거됨

        // 공정표 탭 자동 전환
        setTimeout(() => {
            const ganttTabBtn = document.querySelector('.viewer-bottom-tab-btn[data-tab="gantt-chart"]');
            if (ganttTabBtn && !ganttTabBtn.classList.contains('active')) {
                ganttTabBtn.click();
            }
        }, 50);

        // 내역집계표 펼치기
        setTimeout(() => {
            const boqSection = document.getElementById('viewer-boq-section');
            const boqContent = document.getElementById('viewer-boq-content');
            const boqToggleIcon = document.getElementById('viewer-boq-toggle-icon');

            if (boqSection && boqContent) {
                boqSection.style.flex = '1 1 300px';
                boqContent.style.display = 'block';
                if (boqToggleIcon) {
                    boqToggleIcon.textContent = '▲';
                }
            }
        }, 100);
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

    // --- 특정 탭 진입 시 하위 탭/데이터 로드 로직 ---
    if (targetTabId === 'ai-model-manager') {
        // 'AI 모델 관리' 탭 진입 시
        console.log(
            "[DEBUG][handleSubNavClick] Entering 'ai-model-manager' tab. Handling inner tabs..."
        );
        const innerNav = targetContent.querySelector('.inner-tab-nav');
        const innerContentContainer = targetContent.querySelector(
            '.inner-tab-content-container'
        );

        if (innerNav && innerContentContainer) {
            let activeInnerButton = innerNav.querySelector(
                '.inner-tab-button.active'
            );
            let targetInnerTabId = activeInnerButton
                ? activeInnerButton.dataset.innerTab
                : 'ai-model-list'; // 기본값 설정

            // 이전에 활성화된 내부 탭이 없거나, 현재 활성화된 내부 탭이 없다면 'ai-model-list'를 강제로 활성화
            if (!activeInnerButton) {
                console.log(
                    "[DEBUG][handleSubNavClick] No active inner AI tab found, forcing 'ai-model-list'."
                );
                targetInnerTabId = 'ai-model-list';
                // UI 강제 업데이트
                innerNav
                    .querySelector('.inner-tab-button.active')
                    ?.classList.remove('active');
                innerNav
                    .querySelector('[data-inner-tab="ai-model-list"]')
                    ?.classList.add('active');
                innerContentContainer
                    .querySelector('.inner-tab-content.active')
                    ?.classList.remove('active');
                innerContentContainer
                    .querySelector('#ai-model-list')
                    ?.classList.add('active');
                activeInnerButton = innerNav.querySelector(
                    '[data-inner-tab="ai-model-list"]'
                );
            } else {
                // 이미 활성화된 내부 탭이 있으면 해당 ID 사용
                targetInnerTabId = activeInnerButton.dataset.innerTab;
                console.log(
                    `[DEBUG][handleSubNavClick] Found previously active inner AI tab: ${targetInnerTabId}`
                );
            }

            // ★★★ 핵심: 결정된 내부 탭 ID로 데이터 로드 함수 호출 ★★★
            console.log(
                `[DEBUG][handleSubNavClick] Loading data for inner AI tab: ${targetInnerTabId}`
            );
            loadDataForAiInnerTab(targetInnerTabId); // 데이터 로드 호출 보장
        } else {
            console.warn(
                "[WARN][handleSubNavClick] Inner tab navigation or content container not found in 'ai-model-manager'. Loading default data for the tab."
            );
            loadDataForActiveTab();
        }
    } else if (targetTabId === 'ruleset-management') {
        // '룰셋 관리' 탭 진입 시 (기존 로직 유지)
        console.log(
            "[DEBUG][handleSubNavClick] Entering 'ruleset-management' tab. Handling ruleset types..."
        );
        const rulesetNavContainer = targetContent.querySelector('.ruleset-nav');
        if (rulesetNavContainer) {
            let activeRulesetButton = rulesetNavContainer.querySelector(
                '.ruleset-nav-button.active'
            );
            if (!activeRulesetButton) {
                activeRulesetButton = rulesetNavContainer.querySelector(
                    '[data-ruleset="classification-ruleset"]'
                );
                console.log(
                    "[DEBUG][handleSubNavClick] No active ruleset type, activating default 'classification-ruleset'."
                );
            }
            if (activeRulesetButton) {
                console.log(
                    `[DEBUG][handleSubNavClick] Programmatically clicking ruleset type button: ${activeRulesetButton.dataset.ruleset}`
                );
                // 클릭 이벤트는 loadSpecificRuleset을 호출하므로, 데이터 로드가 보장됨
                if (!activeRulesetButton.classList.contains('active')) {
                    // 이미 활성화된 상태가 아니라면 클릭
                    activeRulesetButton.click();
                } else {
                    // 이미 활성화 상태라면 직접 데이터 로드 함수 호출
                    loadSpecificRuleset(activeRulesetButton.dataset.ruleset);
                }
            } else {
                console.warn(
                    "[WARN][handleSubNavClick] Could not find default ruleset type button 'classification-ruleset'."
                );
                loadDataForActiveTab();
            }
        } else {
            console.warn(
                "[WARN][handleSubNavClick] Ruleset navigation container not found in 'ruleset-management'. Loading default data for the tab."
            );
            loadDataForActiveTab();
        }
    } else if (targetTabId === 'activity-management') {
        // '액티비티 관리' 탭 진입 시
        console.log(
            "[DEBUG][handleSubNavClick] Entering 'activity-management' tab. Handling inner tabs..."
        );
        const innerNav = targetContent.querySelector('.inner-tab-nav');
        if (innerNav) {
            let activeInnerButton = innerNav.querySelector(
                '.inner-tab-button.active'
            );
            const innerTabId = activeInnerButton
                ? activeInnerButton.dataset.innerTab
                : 'activity-list';

            console.log(
                `[DEBUG][handleSubNavClick] Loading activity inner tab: ${innerTabId}`
            );

            // 액티비티 목록 또는 선후행 관계 로드
            if (innerTabId === 'activity-list') {
                if (typeof loadActivities === 'function') {
                    loadActivities();
                }
            } else if (innerTabId === 'activity-dependency') {
                if (typeof loadActivityDependencies === 'function') {
                    loadActivityDependencies();
                }
            }
        } else {
            console.warn(
                "[WARN][handleSubNavClick] Inner tab navigation not found in 'activity-management'."
            );
            loadDataForActiveTab();
        }
    } else {
        // 다른 모든 보조 탭들은 바로 데이터 로드
        console.log(
            `[DEBUG][handleSubNavClick] Calling loadDataForActiveTab() directly for tab '${activeTab}'...`
        );
        loadDataForActiveTab();
    }
}

window.loadDataForActiveTab = function loadDataForActiveTab() {
    console.log(
        `[DEBUG][loadDataForActiveTab] Loading data for active tab: ${activeTab}`
    ); // 디버깅

    // --- 홈 탭은 프로젝트 선택 없이도 작동 ---
    if (activeTab === 'home') {
        console.log(
            `[DEBUG][loadDataForActiveTab] Home tab activated. Loading project list.`
        );
        // 홈 탭 프로젝트 목록 로드
        if (typeof loadHomeProjectList === 'function') {
            loadHomeProjectList();
        }
        // 버튼 상태 업데이트
        if (typeof enableHomeProjectButtons === 'function') {
            enableHomeProjectButtons();
        }
        return; // 홈 탭 처리 완료
    }

    // --- 다른 탭들은 프로젝트 선택 필수 ---
    if (!currentProjectId) {
        console.warn(
            '[WARN][loadDataForActiveTab] No project selected. Clearing UI and aborting data load.'
        ); // 디버깅
        clearAllTabData(); // 프로젝트 없으면 모든 UI 클리어
        return;
    }

    // --- 각 탭에 필요한 데이터 로드 로직 ---
    switch (activeTab) {
        case 'ruleset-management':
            // 룰셋 종류 탭(handleRulesetNavClick -> loadSpecificRuleset)에서 실제 로드가 일어나므로 여기서는 패스
            console.log(
                `[DEBUG][loadDataForActiveTab] Ruleset tab activated. Loading active ruleset.`
            );
            // 현재 활성화된 룰셋 타입 확인하고 로드
            const activeRulesetBtn = document.querySelector('.ruleset-nav-button.active');
            if (activeRulesetBtn) {
                const rulesetType = activeRulesetBtn.dataset.ruleset;
                loadSpecificRuleset(rulesetType);
            }
            break;
        case 'cost-code-management':
            loadCostCodes();
            break;
        case 'member-mark-management':
            loadMemberMarks();
            break;
        case 'tag-management':
            console.log(
                `[DEBUG][loadDataForActiveTab] Tags are loaded via WebSocket. Ensuring UI consistency.`
            ); // 디버깅
            updateTagLists(allTags); // 현재 메모리에 있는 태그로 UI 갱신
            break;
        case 'space-management':
            console.log(
                `[DEBUG][loadDataForActiveTab] Loading Space Classifications and initializing UI.`
            ); // 디버깅
            loadSpaceClassifications(); // 공간 트리 로드
            populateFieldSelection(); // 테이블용 필드 목록 채우기
            renderDataTable(
                'space-management-data-table-container',
                'space-management'
            ); // 테이블 초기 렌더링 (데이터 로드 전)
            break;
        case 'unit-price-management':
            console.log(
                `[DEBUG][loadDataForActiveTab] Loading Unit Price data (CostCodes, Types) and initializing UI.`
            ); // 디버깅
            loadCostCodesForUnitPrice(); // 왼쪽 공사코드 목록
            loadUnitPriceTypes(); // 오른쪽 위 단가 구분 목록
            // UI 초기화 (선택된 코드 없음 상태)
            selectedCostCodeIdForUnitPrice = null;
            document.getElementById('add-unit-price-btn').disabled = true;
            document.getElementById('unit-price-list-header').textContent =
                '단가 리스트 (공사코드를 선택하세요)';
            renderUnitPricesTable([]); // 오른쪽 아래 단가 목록 비우기
            break;
        case 'data-management':
            console.log(
                `[DEBUG][loadDataForActiveTab] Initializing Data Management UI. Data loaded via WebSocket.`
            ); // 디버깅
            populateFieldSelection(); // 필드 목록 채우기
            // BIM 데이터(allRevitData)는 WebSocket 'all_elements' 수신 시 채워짐
            renderDataTable(
                'data-management-data-table-container',
                'data-management'
            ); // 테이블 초기 렌더링 (데이터 로드 전)

            // ▼▼▼ [추가] 데이터 관리 탭의 3D 뷰어 초기화 및 상태 동기화 ▼▼▼
            if (typeof window.initDataMgmtThreeDViewer === 'function') {
                setTimeout(() => {
                    window.initDataMgmtThreeDViewer();
                    window.setupDataMgmtViewerSplitBar();

                    // 초기화 후 메인 뷰어의 모든 상태를 가져오기
                    if (typeof window.syncCameraStateToDataMgmt === 'function') {
                        window.syncCameraStateToDataMgmt();
                    }
                    if (typeof window.syncSelectionToDataMgmt === 'function') {
                        window.syncSelectionToDataMgmt();
                    }
                    if (typeof window.syncVisibilityToDataMgmt === 'function') {
                        window.syncVisibilityToDataMgmt();
                    }
                }, 100); // DOM이 완전히 렌더링될 때까지 짧은 지연
            }
            // ▲▲▲ [추가] 여기까지 ▲▲▲
            break;
        case 'quantity-members':
            console.log(
                `[DEBUG][loadDataForActiveTab] Loading QM dependencies (Members, Codes, Marks, Spaces).`
            ); // 디버깅
            loadQuantityMembers(); // 부재 목록 (핵심)
            loadCostCodes(); // 오른쪽 패널 드롭다운용
            loadMemberMarks(); // 오른쪽 패널 드롭다운용
            loadSpaceClassifications(); // 오른쪽 패널 드롭다운용
            break;
        case 'cost-item-management':
            console.log(
                `[DEBUG][loadDataForActiveTab] Loading CI dependencies (Items, Members, Codes, Marks).`
            ); // 디버깅
            loadCostItems(); // 산출 항목 목록 (핵심)
            loadQuantityMembers(); // 오른쪽 패널 상세 정보용
            loadCostCodes(); // 오른쪽 패널 상세 정보용 (필요 시)
            loadMemberMarks(); // 오른쪽 패널 상세 정보용
            break;
        case 'detailed-estimation-dd':
            console.log(
                `[DEBUG][loadDataForActiveTab] Loading DD dependencies (Items, Members, BIM, BOQ Fields, Unit Types).`
            ); // 디버깅
            // BOQ 생성에 필요한 데이터 로드
            loadCostItems(); // BOQ는 CostItem 기반
            loadQuantityMembers(); // CostItem -> QM 참조
            loadMemberMarks(); // CostItem -> QM -> MM 참조
            loadUnitPriceTypes(); // 단가 기준 목록용 (loadedUnitPriceTypesForBoq 아님)
            loadBoqGroupingFields(); // 그룹핑 필드 목록 로드

            // BIM 데이터 확인 및 필요시 요청
            if (
                allRevitData.length === 0 &&
                frontendSocket &&
                frontendSocket.readyState === WebSocket.OPEN
            ) {
                console.log(
                    "[DEBUG][loadDataForActiveTab] Requesting BIM data (all_elements) for DD tab as it's empty."
                ); // 디버깅
                frontendSocket.send(
                    JSON.stringify({
                        type: 'get_all_elements',
                        payload: { project_id: currentProjectId },
                    })
                );
            }
            initializeBoqUI(); // DD 탭 UI 초기화 (토글 버튼, 상세 탭 등)

            // 자동으로 집계표 생성 (데이터 로드 후 실행)
            setTimeout(() => {
                if (typeof window.generateBoqReport === 'function') {
                    window.generateBoqReport();
                } else {
                }
            }, 500); // 데이터 로드를 위한 짧은 지연
            break;
        case 'ai-model-manager': // 'AI 모델 관리' 탭 진입 시
            console.log(
                `[DEBUG][loadDataForActiveTab] Loading AI Models and initializing UI.`
            ); // 디버깅
            // 활성화된 내부 탭 로드 (handleSubNavClick에서 이미 처리되었을 수 있지만 안전하게 다시 호출)
            const activeInnerButton = document.querySelector(
                '#ai-model-manager .inner-tab-button.active'
            );
            const innerTabId = activeInnerButton
                ? activeInnerButton.dataset.innerTab
                : 'ai-model-list'; // 기본값
            loadDataForAiInnerTab(innerTabId);
            break;
        case 'schematic-estimation-sd': // '개산견적(SD)' 탭 진입 시
            console.log(
                `[DEBUG][loadDataForActiveTab] Loading SD dependencies and initializing UI.`
            ); // 디버깅
            // [수정] 데이터 로딩 순서 조정 및 BOQ 관련 호출 추가
            loadAiModelsForSd(); // 상단 AI 모델 드롭다운 채우기 (비동기)
            loadSdCostCodes(); // 입력값 연동용 공사코드 목록+수량 로드 (비동기)
            // loadSdCostItems(); // 하단 테이블 데이터는 generateBoqReport 호출 시 로드됨

            // [추가] BOQ 그룹핑 필드 로드 (SD 탭 하단 테이블용)
            // loadBoqGroupingFields 함수는 내부적으로 availableBoqFields 를 채움
            loadBoqGroupingFields()
                .then(() => {
                    // 그룹핑 필드 로드 완료 후 SD용 그룹핑 컨트롤 초기화
                    console.log(
                        '[DEBUG][loadDataForActiveTab-SD] BOQ grouping fields loaded. Initializing SD grouping controls.'
                    );
                    initializeSdBoqControls(); // SD용 그룹핑/표시 필드 컨트롤 초기화 및 이벤트 리스너 설정

                    // [수정] generateBoqReport 호출하여 하단 테이블 채우기 (AI 필터 적용)
                    // generateBoqReport 함수는 이제 items_detail도 반환하므로 loadSdCostItems 호출 불필요
                    console.log(
                        '[DEBUG][loadDataForActiveTab-SD] Calling generateBoqReport for SD tab table.'
                    );
                    generateSdBoqReport(); // SD 탭 전용 집계 함수 호출
                })
                .catch((error) => {
                    console.error(
                        '[ERROR][loadDataForActiveTab-SD] Failed to load BOQ grouping fields:',
                        error
                    );
                    showToast('하단 테이블 그룹핑 필드 로딩 실패.', 'error');
                    // 필드 로드 실패 시에도 기본 UI 초기화는 진행
                    initializeSdUI();
                    initializeSdBoqControls(); // 컨트롤 영역은 보이도록 초기화
                    clearContainer(
                        'sd-table-container',
                        '<p style="padding: 20px; color: red;">그룹핑 필드 로딩 실패</p>'
                    );
                });

            // SD 상단 UI 초기화 (모델 선택, 입력 필드 등)
            initializeSdUI();
            break;
        case 'gantt-chart': // 간트차트 탭
            console.log(
                `[DEBUG][loadDataForActiveTab] Gantt Chart tab activated. Loading activities and cost items.`
            );
            // 간트차트 로드
            if (typeof window.loadGanttChart === 'function') {
                window.loadGanttChart();
            }
            break;
        case 'three-d-viewer': // 3D 뷰어 탭 (시뮬레이션 탭)
            console.log(
                `[DEBUG][loadDataForActiveTab] 3D Viewer tab activated. Keeping existing BIM data and loading quantity members and cost items with prices.`
            ); // 디버깅
            // 3D 뷰어는 기존 allRevitData를 사용하므로 데이터 클리어하지 않음

            // 3D 뷰어 초기화 (메인 뷰어 - 좌측)
            if (typeof window.initThreeDViewer === 'function') {
                window.initThreeDViewer();
            }

            // ▼▼▼ [추가] 간트차트 데이터 로드 (시뮬레이션을 위해 필요) ▼▼▼
            if (typeof window.loadGanttChart === 'function') {
                window.loadGanttChart();
            }
            // ▲▲▲ [추가] 여기까지 ▲▲▲

            // ▼▼▼ [제거됨] 시뮬레이션 전용 뷰어는 사용하지 않음 - 왼쪽 작업용 뷰포트만 사용 ▼▼▼
            // 간트차트만 오른쪽에 표시
            // ▲▲▲ [제거됨] 여기까지 ▲▲▲

            // ▼▼▼ [추가] 데이터 관리 뷰어의 모든 상태를 가져오기 ▼▼▼
            setTimeout(() => {
                if (typeof window.syncCameraStateFromDataMgmt === 'function') {
                    window.syncCameraStateFromDataMgmt();
                }
                if (typeof window.syncSelectionFromDataMgmt === 'function') {
                    window.syncSelectionFromDataMgmt();
                }
                if (typeof window.syncVisibilityFromDataMgmt === 'function') {
                    window.syncVisibilityFromDataMgmt();
                }
            }, 200); // 3D 뷰어 초기화 완료 후
            // ▲▲▲ [추가] 여기까지 ▲▲▲

            // Load quantity members for the 3D viewer quantity members panel
            if (typeof loadQuantityMembers === 'function') {
                loadQuantityMembers();
            }
            // Load cost items with unit price information from BOQ report API
            if (typeof window.loadCostItemsWithPrices === 'function') {
                window.loadCostItemsWithPrices();
            }
            break;
        case 'activity-management': // 액티비티 관리 탭
            console.log(
                `[DEBUG][loadDataForActiveTab] Activity Management tab activated. Loading activities and dependencies.`
            );
            // 내부 탭 로직은 handleSubNavClick에서 처리되므로 여기서는 기본 로드
            if (typeof loadActivities === 'function') {
                loadActivities();
            }
            break;
        case 'activity-objects': // 액티비티 객체 탭
            console.log(
                `[DEBUG][loadDataForActiveTab] Activity Objects tab activated. Loading activity objects.`
            );
            if (typeof loadActivityObjects === 'function') {
                loadActivityObjects(); // 액티비티 객체 목록 로드
            }
            if (typeof loadActivities === 'function') {
                loadActivities(); // 액티비티 목록 로드 (콤보박스용)
            }
            if (typeof loadCostItems === 'function') {
                loadCostItems(); // 코스트 아이템 목록 로드 (참조용)
            }
            break;
        // 'home' case removed - home tab is now handled before the switch statement
        default:
            console.log(
                `[DEBUG][loadDataForActiveTab] No specific data loading function defined for currently active tab: ${activeTab}`
            ); // 디버깅
            // 정의되지 않은 탭이면 기본 UI 클리어
            clearAllTabData();
    }
    console.log(
        `[DEBUG][loadDataForActiveTab] Finished loading initiation for tab: ${activeTab}`
    ); // 디버깅
}

window.loadSpecificRuleset = async function loadSpecificRuleset(rulesetType) {
    if (!currentProjectId) return; // 프로젝트 ID 없으면 중단

    switch (rulesetType) {
        case 'classification-ruleset':
            await loadClassificationRules();
            break;
        case 'mapping-ruleset':
            await loadPropertyMappingRules();
            break;
        case 'costcode-ruleset':
            await loadCostCodes(); // Load cost codes first for dropdown
            await loadQuantityMembers(); // Load quantity members for field collection

            // BIM 데이터 확인 및 필요시 요청 (조건 빌더에서 BIM.* 속성 사용)
            if (
                allRevitData.length === 0 &&
                frontendSocket &&
                frontendSocket.readyState === WebSocket.OPEN
            ) {
                console.log(
                    "[DEBUG][showRulesetTab] Requesting BIM data for costcode-ruleset as it's empty."
                );
                frontendSocket.send(
                    JSON.stringify({
                        type: 'get_all_elements',
                        payload: { project_id: currentProjectId },
                    })
                );
                // Wait a moment for data to load
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            await loadCostCodeRules();
            break;
        case 'member-mark-assignment-ruleset':
            await loadMemberMarks(); // Load member marks first for dropdown
            await loadMemberMarkAssignmentRules();
            break;
        case 'cost-code-assignment-ruleset':
            await loadCostCodes(); // Load cost codes first for dropdown
            await loadCostCodeAssignmentRules();
            break;
        case 'space-classification-ruleset':
            await loadSpaceClassificationRules();
            break;
        case 'space-assignment-ruleset':
            await loadSpaceAssignmentRules();
            break;
        case 'activity-assignment-ruleset':
            await loadActivities(); // 액티비티 목록 먼저 로드하고 기다림
            await loadActivityAssignmentRules();
            break;
        case 'geometry-relation-ruleset':
            await loadGeometryRelationRules();
            break;
        default:
            console.error(
                `[ERROR][loadSpecificRuleset] Unknown ruleset type: ${rulesetType}`
            );
    }
}

window.clearAllTabData = function clearAllTabData() {
    console.log(
        '[DEBUG][clearAllTabData] Clearing all global data, states, and UI elements.'
    ); // 디버깅

    // --- 전역 데이터 배열 및 객체 초기화 ---
    allRevitData = [];
    allTags = [];
    loadedCostCodes = [];
    loadedMemberMarks = [];
    loadedSpaceClassifications = [];
    loadedQuantityMembers = [];
    loadedCostItems = [];
    loadedUnitPriceTypes = [];
    loadedUnitPrices = [];
    loadedClassificationRules = [];
    loadedPropertyMappingRules = [];
    loadedCostCodeRules = [];
    loadedMemberMarkAssignmentRules = [];
    loadedCostCodeAssignmentRules = [];
    loadedSpaceClassificationRules = [];
    loadedSpaceAssignmentRules = [];
    availableBoqFields = [];
    loadedUnitPriceTypesForBoq = [];
    // AI & SD 데이터 초기화
    loadedAiModels = [];
    currentTrainingTaskId = null;
    currentTrainingStatus = {};
    uploadedCsvFilename = null;
    csvHeaders = [];
    trainedModelTempFilename = null;
    trainedModelMetadata = null;
    sdEnabledCostCodes = [];
    selectedSdModelId = null;
    loadedSdCostItems = [];
    // Activity 데이터 초기화
    if (typeof loadedActivities !== 'undefined') {
        loadedActivities = [];
    }
    if (typeof loadedActivityDependencies !== 'undefined') {
        loadedActivityDependencies = [];
    }
    if (typeof activityAssignmentData !== 'undefined') {
        activityAssignmentData = [];
    }

    // --- 상태 변수 초기화 ---
    Object.keys(viewerStates).forEach((context) => {
        const state = viewerStates[context];
        state.selectedElementIds.clear();
        state.revitFilteredIds.clear();
        state.columnFilters = {};
        state.isFilterToSelectionActive = false;
        state.collapsedGroups = {};
        state.currentGroupByFields = [];
        state.lastSelectedRowIndex = -1;
        state.activeView = 'raw-data-view'; // 기본 뷰로 리셋
    });
    qmColumnFilters = {};
    selectedQmIds.clear();
    qmCollapsedGroups = {};
    currentQmGroupByFields = [];
    lastSelectedQmRowIndex = -1;
    activeQmView = 'quantity-member-view'; // QM 뷰 리셋
    ciColumnFilters = {};
    selectedCiIds.clear();
    ciCollapsedGroups = {};
    currentCiGroupByFields = [];
    lastSelectedCiRowIndex = -1;
    boqFilteredRawElementIds.clear();
    currentBoqColumns = [];
    boqColumnAliases = {};
    lastBoqItemIds = [];
    currentBoqDetailItemId = null;
    sdColumnFilters = {};
    selectedSdItemIds.clear();
    sdCollapsedGroups = {};
    currentSdGroupByFields = [];
    selectedCostCodeIdForUnitPrice = null;
    currentUnitPriceEditState = { id: null, originalData: null };
    spaceMappingState = { active: false, spaceId: null, spaceName: '' };
    currentCsvImportUrl = null;

    // --- 차트 인스턴스 파기 ---
    if (trainingChartInstance) {
        trainingChartInstance.destroy();
        trainingChartInstance = null;
    }
    if (sdPredictionChartInstance) {
        sdPredictionChartInstance.destroy();
        sdPredictionChartInstance = null;
    }

    console.log(
        '[DEBUG][clearAllTabData] Global data and states reset complete.'
    ); // 디버깅

    /**
     * 지정된 ID의 컨테이너 내용을 비우고 메시지를 표시하는 헬퍼 함수
     * @param {string} id - 컨테이너 요소의 ID
     * @param {string} message - 표시할 HTML 메시지 (기본값: '<p>프로젝트를 선택하세요.</p>')
     */

    const clearSelect = (id, defaultOptionText = '-- 선택 --') => {
        const select = document.getElementById(id);
        if (select)
            select.innerHTML = `<option value="">${defaultOptionText}</option>`;
    };

    // 관리 탭 하위
    document
        .querySelectorAll('.ruleset-table-container')
        .forEach((c) => (c.innerHTML = '<p>프로젝트를 선택하세요.</p>'));
    clearContainer('cost-codes-table-container');
    clearContainer('member-marks-table-container');
    clearContainer('tag-list');
    clearSelect('tag-assign-select', '-- 분류 선택 --');
    clearContainer('space-tree-container');
    clearContainer('unit-price-cost-code-list');
    clearContainer('unit-price-type-table-container');
    clearContainer('unit-price-table-container');
    const priceListHeader = document.getElementById('unit-price-list-header');
    if (priceListHeader)
        priceListHeader.textContent = '단가 리스트 (공사코드를 선택하세요)';
    const addPriceBtn = document.getElementById('add-unit-price-btn');
    if (addPriceBtn) addPriceBtn.disabled = true;

    // AI 모델 관리 탭
    clearContainer('ai-model-list-container');
    resetTrainingUI(); // 학습 UI 초기화 함수 호출

    // 산출 탭 하위
    clearContainer(
        'data-management-data-table-container',
        '데이터가 여기에 표시됩니다...'
    );
    clearContainer('system-field-container');
    clearContainer('revit-field-container');
    clearContainer(
        'selected-bim-properties-container',
        '<p>BIM 속성을 보려면 테이블에서 하나의 항목만 선택하세요.</p>'
    );
    clearContainer('selected-tags-list', '항목을 선택하세요.');
    clearContainer(
        'space-management-data-table-container',
        '데이터가 여기에 표시됩니다...'
    );
    clearContainer('sm-system-field-container');
    clearContainer('sm-revit-field-container');
    clearContainer(
        'sm-selected-bim-properties-container',
        '<p>BIM 속성을 보려면 테이블에서 하나의 항목만 선택하세요.</p>'
    );
    // QM 탭
    clearContainer('qm-table-container');
    clearContainer('qm-selected-properties-container', '부재를 하나만 선택하세요.');
    clearContainer(
        'qm-assigned-cost-codes-container',
        '부재를 선택하세요.'
    );
    clearSelect('qm-cost-code-assign-select', '-- 공사코드 선택 --');
    clearContainer(
        'qm-assigned-member-mark-container',
        '부재를 선택하세요.'
    );
    clearSelect('qm-member-mark-assign-select', '-- 일람부호 선택 --');
    clearContainer('qm-assigned-spaces-container', '부재를 선택하세요.');
    clearSelect('qm-space-assign-select', '-- 공간분류 선택 --');
    // CI 탭
    clearContainer('ci-table-container');
    clearContainer(
        'ci-linked-member-info-header',
        '<p>산출항목을 선택하면 정보가 표시됩니다.</p>'
    );
    clearContainer('ci-linked-member-properties-container');
    clearContainer('ci-linked-mark-properties-container');
    clearContainer('ci-linked-raw-element-properties-container');

    // 상세견적(DD) 탭
    clearContainer(
        'boq-table-container',
        '<p style="padding: 20px;">프로젝트를 선택하세요.</p>'
    );
    clearContainer(
        'boq-item-list-container',
        '<p style="padding: 10px;">상단 집계표 행을 선택하세요.</p>'
    );
    clearContainer(
        'boq-bim-object-cost-summary',
        '<p style="padding: 10px;">하단 목록에서 산출항목을 선택하면...</p>'
    );
    clearContainer('boq-details-member-container', '<p>항목을 선택하세요.</p>');
    clearContainer('boq-details-mark-container', '<p>항목을 선택하세요.</p>');
    clearContainer('boq-details-raw-container', '<p>항목을 선택하세요.</p>');
    clearContainer(
        'boq-display-fields-container',
        '<small>프로젝트를 선택하세요.</small>'
    );
    clearContainer('boq-grouping-controls', '');

    // 개산견적(SD) 탭
    initializeSdUI(); // SD 탭 전용 초기화 함수 호출

    // 기타 UI
    document.getElementById('clear-selection-filter-btn').style.display =
        'none';

}

window.clearContainer = function clearContainer(id, message = '<p>프로젝트를 선택하세요.</p>') {
    const container = document.getElementById(id);
    if (container) {
        container.innerHTML = message;
    } else {
    }
}
