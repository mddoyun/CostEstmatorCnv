// =====================================================================
// Home Tab Handlers
// =====================================================================

/**
 * 홈 탭의 프로젝트 목록을 로드하여 표시합니다.
 * 헤더의 #project-selector에서 프로젝트 목록을 가져옵니다.
 */
function loadHomeProjectList() {

    const projectListContainer = document.getElementById('home-project-list');
    const projectSelector = document.getElementById('project-selector');


    if (!projectListContainer) {
        return;
    }

    if (!projectSelector) {
        projectListContainer.innerHTML = '<p style="color: #d32f2f; padding: 20px;">프로젝트 선택기를 찾을 수 없습니다.</p>';
        return;
    }

    try {
        // #project-selector의 옵션들에서 프로젝트 목록 가져오기
        const projects = [];
        const options = projectSelector.options;


        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            // 첫 번째 옵션("프로젝트 선택")은 제외
            if (option.value) {
                projects.push({
                    id: option.value,
                    name: option.text
                });
            }
        }


        if (projects.length === 0) {
            projectListContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">생성된 프로젝트가 없습니다.</p>';
        } else {
            // 프로젝트 목록 렌더링
            renderHomeProjectList(projects);
        }

        // 현재 선택된 프로젝트 정보 업데이트
        updateHomeCurrentProjectInfo();


    } catch (error) {
        projectListContainer.innerHTML = '<p style="color: #d32f2f; padding: 20px;">프로젝트 목록을 불러오는데 실패했습니다.</p>';
    }
}

/**
 * 프로젝트 목록을 HTML로 렌더링합니다.
 */
function renderHomeProjectList(projects) {
    const projectListContainer = document.getElementById('home-project-list');
    if (!projectListContainer) return;

    if (!projects || projects.length === 0) {
        projectListContainer.innerHTML = '<p style="color: #999;">생성된 프로젝트가 없습니다.</p>';
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';

    projects.forEach(project => {
        const isSelected = currentProjectId === project.id;
        html += `
            <div class="home-project-item ${isSelected ? 'selected' : ''}"
                 data-project-id="${project.id}"
                 style="padding: 15px; background: ${isSelected ? '#e3f2fd' : 'white'};
                        border: 2px solid ${isSelected ? '#1976d2' : '#ddd'};
                        border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin: 0 0 5px 0; color: ${isSelected ? '#1976d2' : '#333'};">
                            ${isSelected ? '✓ ' : ''}${project.name}
                        </h4>
                        <p style="margin: 0; font-size: 12px; color: #666;">
                            ID: ${project.id}
                        </p>
                    </div>
                    ${isSelected ? '<span style="color: #1976d2; font-weight: bold;">현재 선택됨</span>' : ''}
                </div>
            </div>
        `;
    });

    html += '</div>';
    projectListContainer.innerHTML = html;

    // 프로젝트 아이템 클릭 이벤트 리스너 추가
    projectListContainer.querySelectorAll('.home-project-item').forEach(item => {
        item.addEventListener('click', () => {
            const projectId = item.dataset.projectId;
            selectHomeProject(projectId);
        });

        // 호버 효과
        item.addEventListener('mouseenter', (e) => {
            if (!e.currentTarget.classList.contains('selected')) {
                e.currentTarget.style.background = '#f5f5f5';
                e.currentTarget.style.borderColor = '#999';
            }
        });
        item.addEventListener('mouseleave', (e) => {
            if (!e.currentTarget.classList.contains('selected')) {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.borderColor = '#ddd';
            }
        });
    });
}

/**
 * 홈 탭에서 프로젝트를 선택합니다.
 */
function selectHomeProject(projectId) {

    // 프로젝트 셀렉터 업데이트
    const projectSelector = document.getElementById('project-selector');
    if (projectSelector) {
        projectSelector.value = projectId;
        // 변경 이벤트 트리거 (기존 handleProjectChange 함수 호출)
        projectSelector.dispatchEvent(new Event('change'));
    }

    // UI 업데이트
    updateHomeProjectListSelection(projectId);
    updateHomeCurrentProjectInfo();
    enableHomeProjectButtons();

    // 관리 데이터 버튼 상태 업데이트
    if (typeof enableManagementDataButtons === 'function') {
        enableManagementDataButtons();
    }
}

/**
 * 프로젝트 목록의 선택 상태를 업데이트합니다.
 */
function updateHomeProjectListSelection(selectedProjectId) {
    const projectItems = document.querySelectorAll('.home-project-item');
    projectItems.forEach(item => {
        const isSelected = item.dataset.projectId === selectedProjectId;
        item.classList.toggle('selected', isSelected);
        item.style.background = isSelected ? '#e3f2fd' : 'white';
        item.style.borderColor = isSelected ? '#1976d2' : '#ddd';

        // 체크마크 업데이트
        const title = item.querySelector('h4');
        if (title) {
            const text = title.textContent.replace('✓ ', '');
            title.textContent = isSelected ? `✓ ${text}` : text;
            title.style.color = isSelected ? '#1976d2' : '#333';
        }

        // "현재 선택됨" 라벨 업데이트
        let selectedLabel = item.querySelector('span');
        if (isSelected && !selectedLabel) {
            const labelHtml = '<span style="color: #1976d2; font-weight: bold;">현재 선택됨</span>';
            item.querySelector('div').innerHTML += labelHtml;
        } else if (!isSelected && selectedLabel) {
            selectedLabel.remove();
        }
    });
}

/**
 * 현재 선택된 프로젝트 정보를 업데이트합니다.
 */
function updateHomeCurrentProjectInfo() {
    const currentProjectInfo = document.getElementById('home-current-project-info');
    const currentProjectName = document.getElementById('home-current-project-name');

    if (!currentProjectInfo || !currentProjectName) return;

    if (currentProjectId) {
        const projectSelector = document.getElementById('project-selector');
        const selectedOption = projectSelector?.options[projectSelector.selectedIndex];
        const projectName = selectedOption?.text || '알 수 없음';

        currentProjectName.textContent = projectName;
        currentProjectInfo.style.display = 'block';

        // ▼▼▼ [NEW] 대시보드 표시 및 데이터 로드 ▼▼▼
        showHomeDashboard();
        loadHomeDashboardData(currentProjectId);
        // ▲▲▲ [NEW] 여기까지 ▲▲▲
    } else {
        currentProjectInfo.style.display = 'none';

        // ▼▼▼ [NEW] 대시보드 숨기기 ▼▼▼
        hideHomeDashboard();
        // ▲▲▲ [NEW] 여기까지 ▲▲▲
    }
}

/**
 * 프로젝트 관리 버튼들을 활성화합니다.
 */
function enableHomeProjectButtons() {
    const exportBtn = document.getElementById('home-export-project-btn');
    const renameBtn = document.getElementById('home-rename-project-btn');
    const deleteBtn = document.getElementById('home-delete-project-btn');
    const hasProject = currentProjectId != null && currentProjectId !== '';

    if (exportBtn) {
        exportBtn.disabled = !hasProject;
    }
    if (renameBtn) {
        renameBtn.disabled = !hasProject;
    }
    if (deleteBtn) {
        deleteBtn.disabled = !hasProject;
    }
}


/**
 * 홈 탭의 "새 프로젝트" 버튼 핸들러
 */
async function handleHomeCreateProject() {

    const nameInput = document.getElementById('home-new-project-name');
    if (!nameInput) {
        showToast('프로젝트 이름 입력란을 찾을 수 없습니다.', 'error');
        return;
    }

    const projectName = nameInput.value.trim();
    if (!projectName) {
        showToast('프로젝트 이름을 입력하세요.', 'error');
        nameInput.focus();
        return;
    }

    try {
        const response = await fetch('/connections/create-project/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken,
            },
            body: JSON.stringify({ name: projectName })
        });

        const data = await response.json();

        if (data.status === 'success') {
            showToast(`프로젝트 '${data.project_name}' 생성 완료.`, 'success');

            // 입력 필드 초기화
            nameInput.value = '';

            // 프로젝트 셀렉터에 새 프로젝트 추가 (기존 createNewProject와 동일한 방식)
            const projectSelector = document.getElementById('project-selector');
            if (projectSelector) {
                const newOption = new Option(
                    data.project_name,
                    data.project_id,
                    true,
                    true
                );
                projectSelector.add(newOption, projectSelector.options[1]);
                projectSelector.dispatchEvent(new Event('change'));
            }

            // 약간의 지연 후 홈 탭 프로젝트 목록 새로고침
            setTimeout(() => {
                loadHomeProjectList();
            }, 100);
        } else {
            showToast('프로젝트 생성 실패: ' + data.message, 'error');
        }

    } catch (error) {
        showToast(`프로젝트 생성 실패: ${error.message}`, 'error');
    }
}

/**
 * 홈 탭의 "프로젝트 삭제" 버튼 핸들러
 */
async function handleHomeDeleteProject() {

    if (!currentProjectId) {
        showToast('삭제할 프로젝트를 먼저 선택하세요.', 'error');
        return;
    }

    const projectSelector = document.getElementById('project-selector');
    const selectedOption = projectSelector?.options[projectSelector.selectedIndex];
    const projectName = selectedOption?.text || '알 수 없음';

    if (!confirm(`정말로 프로젝트 "${projectName}"를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }

    try {
        const response = await fetch(`/connections/delete-project/${currentProjectId}/`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken,
            },
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || '프로젝트 삭제에 실패했습니다.');
        }

        showToast(`프로젝트 "${projectName}"가 삭제되었습니다.`, 'success');

        // 프로젝트 셀렉터에서 제거 (옵션 제거)
        if (selectedOption) {
            selectedOption.remove();
        }

        // 첫 번째 옵션("프로젝트 선택")으로 리셋하고 change 이벤트 발생
        if (projectSelector) {
            projectSelector.selectedIndex = 0;
            projectSelector.dispatchEvent(new Event('change'));
        }

        // 약간의 지연 후 홈 탭 프로젝트 목록 새로고침 (change 이벤트 처리 후)
        setTimeout(() => {
            loadHomeProjectList();
        }, 100);

    } catch (error) {
        showToast(`프로젝트 삭제 실패: ${error.message}`, 'error');
    }
}

/**
 * 빠른 작업 카드 클릭 핸들러
 */
function handleQuickActionCardClick(e) {
    const card = e.currentTarget;
    const targetTab = card.dataset.targetTab;

    if (!targetTab) {
        return;
    }


    // 탭 이동
    navigateToTab(targetTab);
}

/**
 * 특정 탭으로 이동하는 헬퍼 함수
 */
function navigateToTab(tabId) {

    // 탭 매핑 (primary tab과 sub tab)
    const tabMapping = {
        'detailed-estimation-dd': { primary: 'results', sub: 'detailed-estimation-dd' },
        'gantt-chart': { primary: 'results', sub: 'gantt-chart' },
        'three-d-viewer': { primary: 'results', sub: 'three-d-viewer' },
        'schematic-estimation-sd': { primary: 'results', sub: 'schematic-estimation-sd' },
        'ai-cost-prediction': { primary: 'takeoff', sub: 'ai-model-manager' }, // AI 모델 매니저로 이동
    };

    const mapping = tabMapping[tabId];
    if (!mapping) {
        showToast('해당 탭을 찾을 수 없습니다.', 'error');
        return;
    }

    // Primary 탭 버튼 클릭
    const primaryButton = document.querySelector(`.main-nav .nav-button[data-primary-tab="${mapping.primary}"]`);
    if (primaryButton && !primaryButton.classList.contains('active')) {
        primaryButton.click();

        // Primary 탭 전환 후 약간의 지연을 두고 서브 탭 클릭
        setTimeout(() => {
            const subButton = document.querySelector(`.sub-nav-button[data-tab="${mapping.sub}"]`);
            if (subButton) {
                subButton.click();
            }
        }, 100);
    } else if (primaryButton && primaryButton.classList.contains('active')) {
        // 이미 primary 탭이 활성화되어 있으면 서브 탭만 클릭
        const subButton = document.querySelector(`.sub-nav-button[data-tab="${mapping.sub}"]`);
        if (subButton) {
            subButton.click();
        }
    }
}

/**
 * 홈 탭의 "프로젝트 가져오기" 버튼 핸들러
 */
function handleHomeImportProject() {
    const importInput = document.getElementById('project-import-input');

    if (importInput) {
        importInput.click();
    } else {
        showToast('프로젝트 가져오기 기능을 찾을 수 없습니다.', 'error');
    }
}

/**
 * 홈 탭의 "프로젝트 내보내기" 버튼 핸들러
 */
function handleHomeExportProject() {
    if (!currentProjectId) {
        showToast('내보낼 프로젝트를 먼저 선택하세요.', 'error');
        return;
    }
    // 기존 exportCurrentProject 함수 재사용
    if (typeof exportCurrentProject === 'function') {
        exportCurrentProject();
    } else {
        showToast('프로젝트 내보내기 기능을 찾을 수 없습니다.', 'error');
    }
}

/**
 * 홈 탭의 "프로젝트 이름 변경" 버튼 핸들러
 */
async function handleHomeRenameProject() {

    if (!currentProjectId) {
        showToast('이름을 변경할 프로젝트를 먼저 선택하세요.', 'error');
        return;
    }

    const projectSelector = document.getElementById('project-selector');
    const selectedOption = projectSelector?.options[projectSelector.selectedIndex];
    const currentName = selectedOption?.text || '';

    const newName = prompt(`새 프로젝트 이름을 입력하세요:`, currentName);

    if (!newName) {
        return;
    }

    if (newName === currentName) {
        showToast('프로젝트 이름이 변경되지 않았습니다.', 'info');
        return;
    }

    try {
        const response = await fetch(`/connections/rename-project/${currentProjectId}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken,
            },
            body: JSON.stringify({ name: newName }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || '프로젝트 이름 변경에 실패했습니다.');
        }

        showToast(result.message, 'success');

        // 프로젝트 셀렉터 옵션 업데이트
        if (selectedOption) {
            selectedOption.text = newName;
        }

        // 홈 탭 프로젝트 정보 업데이트
        if (typeof updateHomeCurrentProjectInfo === 'function') {
            updateHomeCurrentProjectInfo();
        }

        // 홈 탭 프로젝트 목록 새로고침
        if (typeof loadHomeProjectList === 'function') {
            loadHomeProjectList();
        }
    } catch (error) {
        showToast(`오류: ${error.message}`, 'error');
    }
}

/**
 * 홈 탭 이벤트 리스너 설정
 */
function setupHomeTabListeners() {

    // 프로젝트 관리 버튼들
    const createBtn = document.getElementById('home-create-project-btn');
    const importBtn = document.getElementById('home-import-project-btn');
    const exportBtn = document.getElementById('home-export-project-btn');
    const renameBtn = document.getElementById('home-rename-project-btn');
    const deleteBtn = document.getElementById('home-delete-project-btn');
    const nameInput = document.getElementById('home-new-project-name');


    if (createBtn) {
        createBtn.addEventListener('click', handleHomeCreateProject);
    }
    if (nameInput) {
        // Enter 키로도 프로젝트 생성 가능
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleHomeCreateProject();
            }
        });
    }
    if (importBtn) {
        importBtn.addEventListener('click', handleHomeImportProject);
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', handleHomeExportProject);
    }
    if (renameBtn) {
        renameBtn.addEventListener('click', handleHomeRenameProject);
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleHomeDeleteProject);
    }

    // 빠른 작업 카드
    const quickActionCards = document.querySelectorAll('.quick-action-card');

    quickActionCards.forEach(card => {
        card.addEventListener('click', handleQuickActionCardClick);

        // 호버 효과
        card.addEventListener('mouseenter', (e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
        });
        card.addEventListener('mouseleave', (e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        });
    });

}

// ▼▼▼ [NEW] 대시보드 함수들 ▼▼▼

/**
 * 대시보드 표시
 */
function showHomeDashboard() {
    const dashboard = document.getElementById('home-dashboard');
    const noProjectMessage = document.getElementById('home-no-project-message');

    if (dashboard) {
        dashboard.style.display = 'block';
    }
    if (noProjectMessage) {
        noProjectMessage.style.display = 'none';
    }
}

/**
 * 대시보드 숨기기
 */
function hideHomeDashboard() {
    const dashboard = document.getElementById('home-dashboard');
    const noProjectMessage = document.getElementById('home-no-project-message');

    if (dashboard) {
        dashboard.style.display = 'none';
    }
    if (noProjectMessage) {
        noProjectMessage.style.display = 'block';
    }
}

/**
 * 대시보드 데이터 로드
 * 간트 차트와 동일한 방식으로 공정 기간 계산
 */
async function loadHomeDashboardData(projectId) {
    console.log('[Dashboard] Loading dashboard data for project:', projectId);

    if (!projectId) {
        console.warn('[Dashboard] No project ID provided');
        return;
    }

    try {
        // 1. ActivityObjects를 먼저 로드 (공정 기간 계산에 필요)
        if (!window.loadedActivityObjects || window.loadedActivityObjects.length === 0) {
            console.log('[Dashboard] Loading activity objects first...');
            const aoResponse = await fetch(`/connections/api/activity-objects/${projectId}/`);
            const aoData = await aoResponse.json();
            if (aoData && Array.isArray(aoData)) {
                window.loadedActivityObjects = aoData;
                console.log('[Dashboard] Loaded', aoData.length, 'activity objects');
            }
        }

        // 2. 비용 데이터는 API에서 가져오기
        const response = await fetch(`/connections/api/dashboard/${projectId}/`);
        const result = await response.json();

        console.log('[Dashboard] Dashboard data loaded:', result);

        if (result.success && result.data) {
            // 3. 공정 기간은 간트 차트와 동일한 방식으로 프론트엔드에서 계산
            const scheduleData = calculateScheduleDatesFromGantt();

            // 기존 data에 계산된 schedule 데이터를 덮어쓰기
            result.data.schedule = scheduleData;

            updateDashboardUI(result.data);
        } else {
            console.error('[Dashboard] Failed to load dashboard data:', result.error);
            showToast('대시보드 데이터를 불러오지 못했습니다.', 'error');
        }
    } catch (error) {
        console.error('[Dashboard] Error loading dashboard data:', error);
        showToast('대시보드 데이터 로드 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 간트 차트와 동일한 방식으로 공정 기간 계산
 * 간트 차트 탭의 "프로젝트 기간" 표시 로직 재사용
 */
function calculateScheduleDatesFromGantt() {
    console.log('[Dashboard] Calculating schedule dates from gantt chart logic...');

    // window.ganttMinDate, ganttMaxDate가 있으면 사용 (간트 차트 이미 렌더링됨)
    if (window.ganttMinDate && window.ganttMaxDate) {
        console.log('[Dashboard] Using existing gantt dates:', window.ganttMinDate, window.ganttMaxDate);

        // 간트 차트와 동일한 계산 방식 (Math.ceil만 사용, +1 안함)
        const totalDays = Math.ceil((window.ganttMaxDate - window.ganttMinDate) / (1000 * 60 * 60 * 24));

        return {
            start_date_formatted: window.ganttMinDate.toLocaleDateString('ko-KR'),
            end_date_formatted: window.ganttMaxDate.toLocaleDateString('ko-KR'),
            total_days: totalDays
        };
    }

    // 간트 차트가 아직 렌더링 안됐으면 간트차트 로직을 직접 실행하여 계산
    // 간트차트 handlers의 정확한 날짜 계산 로직 재사용
    if (!window.loadedActivityObjects || window.loadedActivityObjects.length === 0) {
        console.log('[Dashboard] No activity objects available');
        return {
            start_date_formatted: null,
            end_date_formatted: null,
            total_days: 0
        };
    }

    console.log('[Dashboard] Calculating from activity objects using gantt logic:', window.loadedActivityObjects.length);

    // 간트차트와 동일한 방식으로 데이터 준비
    try {
        // 1. CostItem별로 ActivityObject 그룹핑
        const costItemMap = new Map();
        window.loadedActivityObjects.forEach(ao => {
            if (!ao.cost_item || !ao.activity) return;

            const ciId = ao.cost_item.id;
            if (!costItemMap.has(ciId)) {
                costItemMap.set(ciId, {
                    ...ao.cost_item,
                    activityObjects: []
                });
            }
            costItemMap.get(ciId).activityObjects.push(ao);
        });

        const costItems = Array.from(costItemMap.values());

        // 2. Activity와 Dependency 데이터 추출
        const activities = [];
        const dependencies = [];
        const activityIdSet = new Set();
        const activityMap = new Map();

        window.loadedActivityObjects.forEach(ao => {
            if (ao.activity && !activityIdSet.has(ao.activity.id)) {
                activities.push(ao.activity);
                activityIdSet.add(ao.activity.id);
                activityMap.set(ao.activity.id, ao.activity);

                // Dependency 추출
                if (ao.activity.predecessors && Array.isArray(ao.activity.predecessors)) {
                    ao.activity.predecessors.forEach(pred => {
                        dependencies.push({
                            predecessor_id: pred.id,
                            successor_id: ao.activity.id,
                            lag: pred.lag || 0,
                            lag_type: pred.lag_type || 'days'
                        });
                    });
                }
            }
        });

        // 3. 간트차트 핸들러의 generateGanttData 함수 호출 (전역으로 노출되어 있다면)
        if (typeof window.generateGanttData === 'function' && typeof window.calculateTaskDates === 'function') {
            // 프로젝트 시작일 가져오기 (localStorage에서 - 간트차트와 동일한 방식)
            const savedStartDate = localStorage.getItem(`project_${window.currentProjectId}_start_date`);
            let projectStartDate;
            if (savedStartDate) {
                projectStartDate = new Date(savedStartDate);
            } else {
                // 기본값: 오늘
                projectStartDate = new Date();
            }

            console.log('[Dashboard] Using project start date:', projectStartDate.toISOString().split('T')[0]);

            // 간트차트 핸들러가 사용하는 전역 변수 설정
            if (typeof window.setProjectStartDate === 'function') {
                window.setProjectStartDate(projectStartDate);
            } else {
                // setProjectStartDate 함수가 없으면 직접 설정
                window.projectStartDate = projectStartDate;
            }

            const ganttTasks = window.generateGanttData(costItems, activities, dependencies, window.loadedActivityObjects);

            if (ganttTasks && ganttTasks.length > 0) {
                // calculateTaskDates 호출하여 정확한 날짜 계산
                window.calculateTaskDates(ganttTasks, dependencies, activityMap);

                const allDates = ganttTasks.flatMap(t => [new Date(t.start), new Date(t.end)]);
                const minDate = new Date(Math.min(...allDates));
                const maxDate = new Date(Math.max(...allDates));
                const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));

                console.log('[Dashboard] Calculated dates using gantt logic:', minDate, maxDate, totalDays);

                return {
                    start_date_formatted: minDate.toLocaleDateString('ko-KR'),
                    end_date_formatted: maxDate.toLocaleDateString('ko-KR'),
                    total_days: totalDays
                };
            }
        }

        // generateGanttData가 없거나 실패한 경우 간단한 계산으로 폴백
        console.log('[Dashboard] Gantt data generation not available, using simple calculation');

        const activityDurationMap = new Map();
        const activityMap = new Map();

        window.loadedActivityObjects.forEach(ao => {
            if (!ao.activity || !ao.actual_duration) return;

            const activityId = ao.activity.id;
            const duration = parseFloat(ao.actual_duration) || 0;

            if (!activityMap.has(activityId)) {
                activityMap.set(activityId, ao.activity);
            }

            const currentDuration = activityDurationMap.get(activityId) || 0;
            activityDurationMap.set(activityId, currentDuration + duration);
        });

        if (activityDurationMap.size === 0) {
            console.log('[Dashboard] No valid activity durations');
            return {
                start_date_formatted: null,
                end_date_formatted: null,
                total_days: 0
            };
        }

        // 프로젝트 시작일 가져오기 (localStorage에서)
        const savedStartDate = localStorage.getItem(`project_${window.currentProjectId}_start_date`);
        const projectStartDate = savedStartDate ? new Date(savedStartDate) : new Date();
        const allDates = [];

        activityDurationMap.forEach((totalDuration, activityId) => {
            const activity = activityMap.get(activityId);
            if (!activity) return;

            const startDate = activity.manual_start_date ? new Date(activity.manual_start_date) : new Date(projectStartDate);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + Math.ceil(totalDuration));

            allDates.push(startDate);
            allDates.push(endDate);
        });

        if (allDates.length === 0) {
            console.log('[Dashboard] No valid dates calculated');
            return {
                start_date_formatted: null,
                end_date_formatted: null,
                total_days: 0
            };
        }

        const minDate = new Date(Math.min(...allDates));
        const maxDate = new Date(Math.max(...allDates));
        const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));

        console.log('[Dashboard] Calculated dates (fallback):', minDate, maxDate, totalDays);

        return {
            start_date_formatted: minDate.toLocaleDateString('ko-KR'),
            end_date_formatted: maxDate.toLocaleDateString('ko-KR'),
            total_days: totalDays
        };
    } catch (error) {
        console.error('[Dashboard] Error calculating schedule dates:', error);
        return {
            start_date_formatted: null,
            end_date_formatted: null,
            total_days: 0
        };
    }
}

/**
 * 대시보드 UI 업데이트
 */
function updateDashboardUI(data) {
    console.log('[Dashboard] Updating dashboard UI with data:', data);

    // 1. 비용 항목별 업데이트 (표 형식)
    if (data.costs) {
        // 재료비
        const materialCostElement = document.getElementById('dashboard-material-cost');
        if (materialCostElement) {
            materialCostElement.textContent = data.costs.material_formatted + '원';
        }

        // 노무비
        const laborCostElement = document.getElementById('dashboard-labor-cost');
        if (laborCostElement) {
            laborCostElement.textContent = data.costs.labor_formatted + '원';
        }

        // 경비
        const expenseCostElement = document.getElementById('dashboard-expense-cost');
        if (expenseCostElement) {
            expenseCostElement.textContent = data.costs.expense_formatted + '원';
        }

        // 합계금액
        const totalCostElement = document.getElementById('dashboard-total-cost');
        if (totalCostElement) {
            totalCostElement.textContent = data.costs.total_formatted + '원';
        }
    }

    // 2. 공정 기간 업데이트 (프로젝트 기간 형식)
    if (data.schedule) {
        const scheduleDatesElement = document.getElementById('dashboard-schedule-dates');
        if (scheduleDatesElement) {
            if (data.schedule.start_date_formatted && data.schedule.end_date_formatted && data.schedule.total_days > 0) {
                // 형식: "2025. 1. 1. ~ 2025. 12. 31. (365일)"
                scheduleDatesElement.textContent = `${data.schedule.start_date_formatted} ~ ${data.schedule.end_date_formatted} (${data.schedule.total_days}일)`;
            } else {
                scheduleDatesElement.textContent = '데이터 없음';
            }
        }
    }

    console.log('[Dashboard] Dashboard UI updated successfully');
}

// ▲▲▲ [NEW] 대시보드 함수들 끝 ▲▲▲

// Export functions to window for global access
window.loadHomeProjectList = loadHomeProjectList;
window.updateHomeProjectListSelection = updateHomeProjectListSelection;
window.updateHomeCurrentProjectInfo = updateHomeCurrentProjectInfo;
window.enableHomeProjectButtons = enableHomeProjectButtons;
window.handleHomeCreateProject = handleHomeCreateProject;
window.handleHomeDeleteProject = handleHomeDeleteProject;
window.setupHomeTabListeners = setupHomeTabListeners;
window.navigateToTab = navigateToTab;
window.showHomeDashboard = showHomeDashboard;  // NEW
window.hideHomeDashboard = hideHomeDashboard;  // NEW
window.loadHomeDashboardData = loadHomeDashboardData;  // NEW
window.calculateScheduleDatesFromGantt = calculateScheduleDatesFromGantt;  // NEW
window.updateDashboardUI = updateDashboardUI;  // NEW
