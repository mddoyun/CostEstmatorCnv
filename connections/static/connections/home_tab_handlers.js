// =====================================================================
// Home Tab Handlers
// =====================================================================

/**
 * 홈 탭의 프로젝트 목록을 로드하여 표시합니다.
 * 헤더의 #project-selector에서 프로젝트 목록을 가져옵니다.
 */
function loadHomeProjectList() {
    console.log('[DEBUG][loadHomeProjectList] === STARTING loadHomeProjectList ===');
    console.log('[DEBUG][loadHomeProjectList] Current timestamp:', new Date().toISOString());
    console.log('[DEBUG][loadHomeProjectList] Current activeTab:', window.activeTab);
    console.log('[DEBUG][loadHomeProjectList] Current currentProjectId:', window.currentProjectId);

    const projectListContainer = document.getElementById('home-project-list');
    const projectSelector = document.getElementById('project-selector');

    console.log('[DEBUG][loadHomeProjectList] Container found:', !!projectListContainer);
    console.log('[DEBUG][loadHomeProjectList] Container element:', projectListContainer);
    console.log('[DEBUG][loadHomeProjectList] Selector found:', !!projectSelector);
    console.log('[DEBUG][loadHomeProjectList] Selector element:', projectSelector);

    if (!projectListContainer) {
        console.warn('[WARN][loadHomeProjectList] Project list container not found');
        return;
    }

    if (!projectSelector) {
        console.error('[ERROR][loadHomeProjectList] Project selector not found');
        projectListContainer.innerHTML = '<p style="color: #d32f2f; padding: 20px;">프로젝트 선택기를 찾을 수 없습니다.</p>';
        return;
    }

    try {
        // #project-selector의 옵션들에서 프로젝트 목록 가져오기
        const projects = [];
        const options = projectSelector.options;

        console.log('[DEBUG][loadHomeProjectList] Total options:', options.length);

        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            console.log(`[DEBUG][loadHomeProjectList] Option ${i}: value="${option.value}", text="${option.text}"`);
            // 첫 번째 옵션("프로젝트 선택")은 제외
            if (option.value) {
                projects.push({
                    id: option.value,
                    name: option.text
                });
            }
        }

        console.log(`[DEBUG][loadHomeProjectList] Loaded ${projects.length} projects from selector:`, projects);

        if (projects.length === 0) {
            projectListContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">생성된 프로젝트가 없습니다.</p>';
        } else {
            // 프로젝트 목록 렌더링
            renderHomeProjectList(projects);
        }

        // 현재 선택된 프로젝트 정보 업데이트
        updateHomeCurrentProjectInfo();

        console.log('[DEBUG][loadHomeProjectList] === COMPLETED loadHomeProjectList ===');

    } catch (error) {
        console.error('[ERROR][loadHomeProjectList] Failed to load projects:', error);
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
    console.log(`[DEBUG][selectHomeProject] Selected project: ${projectId}`);

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
    const deleteBtn = document.getElementById('home-delete-project-btn');
    const hasProject = currentProjectId != null && currentProjectId !== '';

    if (exportBtn) {
        exportBtn.disabled = !hasProject;
    }
    if (deleteBtn) {
        deleteBtn.disabled = !hasProject;
    }
}


/**
 * 홈 탭의 "새 프로젝트" 버튼 핸들러
 */
async function handleHomeCreateProject() {
    console.log('[DEBUG][handleHomeCreateProject] Create project button clicked');

    const nameInput = document.getElementById('home-new-project-name');
    if (!nameInput) {
        console.error('[ERROR][handleHomeCreateProject] Name input not found');
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
            console.log(`[DEBUG][handleHomeCreateProject] Project created:`, data);

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
        console.error('[ERROR][handleHomeCreateProject] Failed to create project:', error);
        showToast(`프로젝트 생성 실패: ${error.message}`, 'error');
    }
}

/**
 * 홈 탭의 "프로젝트 삭제" 버튼 핸들러
 */
async function handleHomeDeleteProject() {
    console.log('[DEBUG][handleHomeDeleteProject] Delete project button clicked');

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
        console.log(`[DEBUG][handleHomeDeleteProject] Project deleted: ${currentProjectId}`);

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
        console.error('[ERROR][handleHomeDeleteProject] Failed to delete project:', error);
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
        console.warn('[WARN][handleQuickActionCardClick] No target tab specified');
        return;
    }

    console.log(`[DEBUG][handleQuickActionCardClick] Navigating to tab: ${targetTab}`);

    // 탭 이동
    navigateToTab(targetTab);
}

/**
 * 특정 탭으로 이동하는 헬퍼 함수
 */
function navigateToTab(tabId) {
    console.log(`[DEBUG][navigateToTab] Navigating to: ${tabId}`);

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
        console.error(`[ERROR][navigateToTab] Unknown tab: ${tabId}`);
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
    console.log('[DEBUG][handleHomeImportProject] Import project button clicked');
    const importInput = document.getElementById('project-import-input');
    if (importInput) {
        importInput.click();
    } else {
        console.error('[ERROR][handleHomeImportProject] Project import input not found');
        showToast('프로젝트 가져오기 기능을 찾을 수 없습니다.', 'error');
    }
}

/**
 * 홈 탭의 "프로젝트 내보내기" 버튼 핸들러
 */
function handleHomeExportProject() {
    console.log('[DEBUG][handleHomeExportProject] Export project button clicked');
    if (!currentProjectId) {
        showToast('내보낼 프로젝트를 먼저 선택하세요.', 'error');
        return;
    }
    // 기존 exportCurrentProject 함수 재사용
    if (typeof exportCurrentProject === 'function') {
        exportCurrentProject();
    } else {
        console.error('[ERROR][handleHomeExportProject] exportCurrentProject function not found');
        showToast('프로젝트 내보내기 기능을 찾을 수 없습니다.', 'error');
    }
}

/**
 * 홈 탭 이벤트 리스너 설정
 */
function setupHomeTabListeners() {
    console.log('[DEBUG][setupHomeTabListeners] === STARTING setupHomeTabListeners ===');
    console.log('[DEBUG][setupHomeTabListeners] Current timestamp:', new Date().toISOString());

    // 프로젝트 관리 버튼들
    const createBtn = document.getElementById('home-create-project-btn');
    const importBtn = document.getElementById('home-import-project-btn');
    const exportBtn = document.getElementById('home-export-project-btn');
    const deleteBtn = document.getElementById('home-delete-project-btn');
    const nameInput = document.getElementById('home-new-project-name');

    console.log('[DEBUG][setupHomeTabListeners] Create button found:', !!createBtn);
    console.log('[DEBUG][setupHomeTabListeners] Import button found:', !!importBtn);
    console.log('[DEBUG][setupHomeTabListeners] Export button found:', !!exportBtn);
    console.log('[DEBUG][setupHomeTabListeners] Delete button found:', !!deleteBtn);

    if (createBtn) {
        createBtn.addEventListener('click', handleHomeCreateProject);
        console.log('[DEBUG][setupHomeTabListeners] Create button listener attached');
    }
    if (nameInput) {
        // Enter 키로도 프로젝트 생성 가능
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleHomeCreateProject();
            }
        });
        console.log('[DEBUG][setupHomeTabListeners] Name input Enter key listener attached');
    }
    if (importBtn) {
        importBtn.addEventListener('click', handleHomeImportProject);
        console.log('[DEBUG][setupHomeTabListeners] Import button listener attached');
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', handleHomeExportProject);
        console.log('[DEBUG][setupHomeTabListeners] Export button listener attached');
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleHomeDeleteProject);
        console.log('[DEBUG][setupHomeTabListeners] Delete button listener attached');
    }

    // 빠른 작업 카드
    const quickActionCards = document.querySelectorAll('.quick-action-card');
    console.log('[DEBUG][setupHomeTabListeners] Quick action cards found:', quickActionCards.length);

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

    console.log('[DEBUG][setupHomeTabListeners] === COMPLETED setupHomeTabListeners ===');
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
 */
async function loadHomeDashboardData(projectId) {
    console.log('[Dashboard] Loading dashboard data for project:', projectId);

    if (!projectId) {
        console.warn('[Dashboard] No project ID provided');
        return;
    }

    try {
        const response = await fetch(`/connections/api/dashboard/${projectId}/`);
        const result = await response.json();

        console.log('[Dashboard] Dashboard data loaded:', result);

        if (result.success && result.data) {
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
 * 대시보드 UI 업데이트
 */
function updateDashboardUI(data) {
    console.log('[Dashboard] Updating dashboard UI with data:', data);

    // 1. 총 공사비 업데이트
    const totalCostElement = document.getElementById('dashboard-total-cost');
    if (totalCostElement) {
        if (data.total_cost > 0) {
            totalCostElement.textContent = data.total_cost_formatted + '원';
        } else {
            totalCostElement.textContent = '데이터 없음';
            totalCostElement.style.fontSize = '18px';
        }
    }

    // 2. 공정 기간 업데이트
    const startDateElement = document.getElementById('dashboard-start-date');
    const endDateElement = document.getElementById('dashboard-end-date');
    const totalDaysElement = document.getElementById('dashboard-total-days');

    if (data.schedule) {
        if (startDateElement) {
            startDateElement.textContent = data.schedule.start_date || '-';
        }
        if (endDateElement) {
            endDateElement.textContent = data.schedule.end_date || '-';
        }
        if (totalDaysElement) {
            if (data.schedule.total_days > 0) {
                totalDaysElement.textContent = data.schedule.total_days.toLocaleString();
            } else {
                totalDaysElement.textContent = '-';
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
window.updateDashboardUI = updateDashboardUI;  // NEW
