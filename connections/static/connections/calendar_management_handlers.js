// calendar_management_handlers.js
// 작업 캘린더 관리 기능 (여러 캘린더 지원)

console.log('[Calendar Management] Module loaded');

// 현재 선택된 캘린더 ID
let selectedCalendarId = null;

// 현재 편집 중인 캘린더 데이터
let currentCalendarData = {
    name: '',
    is_main: false,
    working_days: {
        mon: true,
        tue: true,
        wed: true,
        thu: true,
        fri: true,
        sat: true,
        sun: false
    },
    holidays: [],
    special_working_days: []
};

/**
 * 캘린더 관리 탭 초기화
 */
function initializeCalendarManagement() {
    console.log('[Calendar Management] Initializing calendar management');

    // 새 캘린더 추가 버튼
    const addBtn = document.getElementById('add-calendar-btn');
    if (addBtn) {
        addBtn.addEventListener('click', handleAddCalendar);
    }

    // 저장 버튼
    const saveBtn = document.getElementById('save-calendar-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', handleSaveCalendar);
    }

    // 메인으로 설정 버튼
    const setMainBtn = document.getElementById('set-main-calendar-btn');
    if (setMainBtn) {
        setMainBtn.addEventListener('click', handleSetMainCalendar);
    }

    // 삭제 버튼
    const deleteBtn = document.getElementById('delete-calendar-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteCalendar);
    }

    console.log('[Calendar Management] Initialization complete');
}

/**
 * 프로젝트의 모든 캘린더 로드
 */
async function loadCalendarsList(projectId) {
    if (!projectId) {
        console.warn('[Calendar Management] No project ID provided');
        return;
    }

    console.log(`[Calendar Management] Loading calendars for project: ${projectId}`);

    try {
        const response = await fetch(`/connections/api/projects/${projectId}/work-calendars/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('[Calendar Management] Calendars loaded:', data.calendars);
            renderCalendarsList(data.calendars);
        } else {
            console.error('[Calendar Management] Failed to load calendars');
            document.getElementById('calendars-list-container').innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">캘린더를 불러오지 못했습니다.</p>';
        }
    } catch (error) {
        console.error('[Calendar Management] Error loading calendars:', error);
        document.getElementById('calendars-list-container').innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">오류가 발생했습니다.</p>';
    }
}

/**
 * 캘린더 리스트 렌더링
 */
function renderCalendarsList(calendars) {
    const container = document.getElementById('calendars-list-container');
    if (!container) return;

    if (calendars.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">등록된 캘린더가 없습니다.</p>';
        return;
    }

    let html = '<div class="calendars-list">';
    calendars.forEach(calendar => {
        const isSelected = selectedCalendarId === calendar.id;
        const mainBadge = calendar.is_main ? '<span style="color: #f59e0b; font-weight: bold;">⭐ 메인</span>' : '';

        html += `
            <div class="calendar-list-item ${isSelected ? 'selected' : ''}"
                 data-calendar-id="${calendar.id}"
                 onclick="selectCalendar('${calendar.id}')"
                 style="padding: 12px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: ${isSelected ? '#e3f2fd' : 'white'};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: bold; font-size: 14px;">${calendar.name}</div>
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">${mainBadge}</div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

/**
 * 캘린더 선택
 */
async function selectCalendar(calendarId) {
    console.log(`[Calendar Management] Selecting calendar: ${calendarId}`);
    selectedCalendarId = calendarId;

    // 리스트 UI 업데이트
    document.querySelectorAll('.calendar-list-item').forEach(item => {
        if (item.dataset.calendarId === calendarId) {
            item.classList.add('selected');
            item.style.background = '#e3f2fd';
        } else {
            item.classList.remove('selected');
            item.style.background = 'white';
        }
    });

    // 캘린더 상세 정보 로드
    await loadCalendarDetail(calendarId);
}

/**
 * 캘린더 상세 정보 로드
 */
async function loadCalendarDetail(calendarId) {
    if (!currentProjectId) return;

    try {
        const response = await fetch(`/connections/api/projects/${currentProjectId}/work-calendars/${calendarId}/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentCalendarData = data.calendar;
            renderCalendarDetail();
        }
    } catch (error) {
        console.error('[Calendar Management] Error loading calendar detail:', error);
    }
}

/**
 * 캘린더 상세 뷰 렌더링
 */
function renderCalendarDetail() {
    const container = document.getElementById('calendar-detail-container');
    const titleEl = document.getElementById('calendar-detail-title');

    if (!container) return;

    // 버튼 표시
    document.getElementById('save-calendar-btn').style.display = 'block';
    document.getElementById('delete-calendar-btn').style.display = currentCalendarData.is_main ? 'none' : 'block';
    document.getElementById('set-main-calendar-btn').style.display = currentCalendarData.is_main ? 'none' : 'block';

    titleEl.textContent = currentCalendarData.name || '새 캘린더';

    let html = `
        <!-- 캘린더 이름 -->
        <div class="calendar-settings-group">
            <h4>캘린더 이름</h4>
            <input type="text" id="calendar-name-input" class="control-element"
                   value="${currentCalendarData.name}" placeholder="캘린더 이름을 입력하세요"
                   style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>

        <!-- 작업 요일 설정 -->
        <div class="calendar-settings-group">
            <h4>작업 요일 설정</h4>
            <p class="settings-description">체크된 요일에만 작업이 진행됩니다.</p>
            <div class="working-days-checkboxes">
                <label class="checkbox-label">
                    <input type="checkbox" id="working-day-mon" value="mon" ${currentCalendarData.working_days.mon ? 'checked' : ''}>
                    <span>월요일</span>
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" id="working-day-tue" value="tue" ${currentCalendarData.working_days.tue ? 'checked' : ''}>
                    <span>화요일</span>
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" id="working-day-wed" value="wed" ${currentCalendarData.working_days.wed ? 'checked' : ''}>
                    <span>수요일</span>
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" id="working-day-thu" value="thu" ${currentCalendarData.working_days.thu ? 'checked' : ''}>
                    <span>목요일</span>
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" id="working-day-fri" value="fri" ${currentCalendarData.working_days.fri ? 'checked' : ''}>
                    <span>금요일</span>
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" id="working-day-sat" value="sat" ${currentCalendarData.working_days.sat ? 'checked' : ''}>
                    <span>토요일</span>
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" id="working-day-sun" value="sun" ${currentCalendarData.working_days.sun ? 'checked' : ''}>
                    <span>일요일</span>
                </label>
            </div>
        </div>

        <!-- 휴일 설정 -->
        <div class="calendar-settings-group">
            <h4>휴일 설정</h4>
            <p class="settings-description">작업이 진행되지 않는 특정 날짜를 지정합니다.</p>
            <div class="date-input-row">
                <input type="date" id="holiday-date-input" class="control-element">
                <button id="add-holiday-btn" class="secondary-button" onclick="handleAddHoliday()">추가</button>
            </div>
            <div id="holidays-list" class="date-list"></div>
        </div>

        <!-- 특별 작업일 설정 -->
        <div class="calendar-settings-group">
            <h4>특별 작업일 설정</h4>
            <p class="settings-description">휴일이지만 작업이 진행되는 특정 날짜를 지정합니다.</p>
            <div class="date-input-row">
                <input type="date" id="special-working-date-input" class="control-element">
                <button id="add-special-working-day-btn" class="secondary-button" onclick="handleAddSpecialWorkingDay()">추가</button>
            </div>
            <div id="special-working-days-list" class="date-list"></div>
        </div>
    `;

    container.innerHTML = html;

    // 이벤트 리스너 추가
    setupCalendarDetailListeners();

    // 리스트 업데이트
    updateHolidaysList();
    updateSpecialWorkingDaysList();
}

/**
 * 캘린더 상세 뷰 이벤트 리스너 설정
 */
function setupCalendarDetailListeners() {
    // 이름 변경
    const nameInput = document.getElementById('calendar-name-input');
    if (nameInput) {
        nameInput.addEventListener('change', () => {
            currentCalendarData.name = nameInput.value;
        });
    }

    // 작업 요일 체크박스
    const workingDayCheckboxes = document.querySelectorAll('.working-days-checkboxes input[type="checkbox"]');
    workingDayCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const day = checkbox.value;
            currentCalendarData.working_days[day] = checkbox.checked;
        });
    });
}

/**
 * 새 캘린더 추가
 */
function handleAddCalendar() {
    console.log('[Calendar Management] Adding new calendar');

    selectedCalendarId = null;

    // ▼▼▼ [수정] 타임스탬프를 추가하여 고유한 이름 생성 ▼▼▼
    const timestamp = new Date().toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).replace(/\. /g, '-').replace(/\./g, '').replace(':', '');

    currentCalendarData = {
        name: `새 캘린더 ${timestamp}`,
        is_main: false,
        working_days: {
            mon: true,
            tue: true,
            wed: true,
            thu: true,
            fri: true,
            sat: true,
            sun: false
        },
        holidays: [],
        special_working_days: []
    };
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // 리스트에서 선택 해제
    document.querySelectorAll('.calendar-list-item').forEach(item => {
        item.classList.remove('selected');
        item.style.background = 'white';
    });

    renderCalendarDetail();
}

/**
 * 휴일 추가
 */
function handleAddHoliday() {
    const input = document.getElementById('holiday-date-input');
    if (!input || !input.value) {
        alert('날짜를 선택해주세요.');
        return;
    }

    const date = input.value;
    if (currentCalendarData.holidays.includes(date)) {
        alert('이미 등록된 휴일입니다.');
        return;
    }

    currentCalendarData.holidays.push(date);
    updateHolidaysList();
    input.value = '';
}

/**
 * 특별 작업일 추가
 */
function handleAddSpecialWorkingDay() {
    const input = document.getElementById('special-working-date-input');
    if (!input || !input.value) {
        alert('날짜를 선택해주세요.');
        return;
    }

    const date = input.value;
    if (currentCalendarData.special_working_days.includes(date)) {
        alert('이미 등록된 특별 작업일입니다.');
        return;
    }

    currentCalendarData.special_working_days.push(date);
    updateSpecialWorkingDaysList();
    input.value = '';
}

/**
 * 휴일 목록 업데이트
 */
function updateHolidaysList() {
    const container = document.getElementById('holidays-list');
    if (!container) return;

    if (currentCalendarData.holidays.length === 0) {
        container.innerHTML = '<p class="empty-message">등록된 휴일이 없습니다.</p>';
        return;
    }

    const sortedHolidays = [...currentCalendarData.holidays].sort();
    container.innerHTML = sortedHolidays.map(date => `
        <div class="date-item">
            <span class="date-text">${date}</span>
            <button class="remove-date-btn" onclick="removeHoliday('${date}')">삭제</button>
        </div>
    `).join('');
}

/**
 * 특별 작업일 목록 업데이트
 */
function updateSpecialWorkingDaysList() {
    const container = document.getElementById('special-working-days-list');
    if (!container) return;

    if (currentCalendarData.special_working_days.length === 0) {
        container.innerHTML = '<p class="empty-message">등록된 특별 작업일이 없습니다.</p>';
        return;
    }

    const sortedDays = [...currentCalendarData.special_working_days].sort();
    container.innerHTML = sortedDays.map(date => `
        <div class="date-item">
            <span class="date-text">${date}</span>
            <button class="remove-date-btn" onclick="removeSpecialWorkingDay('${date}')">삭제</button>
        </div>
    `).join('');
}

/**
 * 휴일 삭제
 */
function removeHoliday(date) {
    const index = currentCalendarData.holidays.indexOf(date);
    if (index > -1) {
        currentCalendarData.holidays.splice(index, 1);
        updateHolidaysList();
    }
}

/**
 * 특별 작업일 삭제
 */
function removeSpecialWorkingDay(date) {
    const index = currentCalendarData.special_working_days.indexOf(date);
    if (index > -1) {
        currentCalendarData.special_working_days.splice(index, 1);
        updateSpecialWorkingDaysList();
    }
}

/**
 * 캘린더 저장
 */
async function handleSaveCalendar() {
    if (!currentProjectId) {
        alert('프로젝트를 먼저 선택해주세요.');
        return;
    }

    if (!currentCalendarData.name || currentCalendarData.name.trim() === '') {
        alert('캘린더 이름을 입력해주세요.');
        return;
    }

    console.log('[Calendar Management] Saving calendar:', currentCalendarData);

    try {
        const isNew = !selectedCalendarId;
        const url = isNew
            ? `/connections/api/projects/${currentProjectId}/work-calendars/`
            : `/connections/api/projects/${currentProjectId}/work-calendars/${selectedCalendarId}/`;

        const method = isNew ? 'POST' : 'PUT';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(currentCalendarData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('[Calendar Management] Calendar saved successfully:', result);
            alert(isNew ? '캘린더가 생성되었습니다.' : '캘린더가 수정되었습니다.');

            // 새로 생성된 경우 ID 저장
            if (isNew && result.calendar) {
                selectedCalendarId = result.calendar.id;
            }

            // 리스트 다시 로드
            await loadCalendarsList(currentProjectId);

            // 방금 저장한 캘린더 선택
            if (selectedCalendarId) {
                await selectCalendar(selectedCalendarId);
            }
        } else {
            const errorData = await response.json();
            console.error('[Calendar Management] Failed to save calendar:', errorData);
            alert('캘린더 저장에 실패했습니다: ' + (errorData.error || '알 수 없는 오류'));
        }
    } catch (error) {
        console.error('[Calendar Management] Error saving calendar:', error);
        alert('캘린더 저장 중 오류가 발생했습니다.');
    }
}

/**
 * 메인 캘린더로 설정
 */
async function handleSetMainCalendar() {
    if (!selectedCalendarId) return;

    currentCalendarData.is_main = true;
    await handleSaveCalendar();
}

/**
 * 캘린더 삭제
 */
async function handleDeleteCalendar() {
    if (!selectedCalendarId) return;

    if (!confirm('정말로 이 캘린더를 삭제하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(`/connections/api/projects/${currentProjectId}/work-calendars/${selectedCalendarId}/`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (response.ok) {
            alert('캘린더가 삭제되었습니다.');
            selectedCalendarId = null;

            // 상세 뷰 초기화
            document.getElementById('calendar-detail-container').innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">캘린더를 선택하거나 새로 만들어주세요.</p>';
            document.getElementById('save-calendar-btn').style.display = 'none';
            document.getElementById('delete-calendar-btn').style.display = 'none';
            document.getElementById('set-main-calendar-btn').style.display = 'none';

            // 리스트 다시 로드
            await loadCalendarsList(currentProjectId);
        } else {
            const errorData = await response.json();
            alert('삭제 실패: ' + (errorData.error || '알 수 없는 오류'));
        }
    } catch (error) {
        console.error('[Calendar Management] Error deleting calendar:', error);
        alert('캘린더 삭제 중 오류가 발생했습니다.');
    }
}

/**
 * 프로젝트 변경 시 캘린더 로드
 */
function onProjectChangedForCalendar(projectId) {
    if (projectId) {
        loadCalendarsList(projectId);
    } else {
        document.getElementById('calendars-list-container').innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">프로젝트를 선택하면 캘린더 목록이 표시됩니다.</p>';
        document.getElementById('calendar-detail-container').innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">캘린더를 선택하거나 새로 만들어주세요.</p>';
    }
}

// 전역 스코프에 함수 노출
window.selectCalendar = selectCalendar;
window.removeHoliday = removeHoliday;
window.removeSpecialWorkingDay = removeSpecialWorkingDay;
window.handleAddHoliday = handleAddHoliday;
window.handleAddSpecialWorkingDay = handleAddSpecialWorkingDay;

// DOM이 로드되면 초기화
document.addEventListener('DOMContentLoaded', function () {
    console.log('[Calendar Management] DOM loaded, initializing...');
    initializeCalendarManagement();

    // 프로젝트 변경 이벤트 감지
    document.addEventListener('projectChanged', function(event) {
        console.log('[Calendar Management] Project changed:', event.detail);
        if (event.detail && event.detail.projectId) {
            onProjectChangedForCalendar(event.detail.projectId);
        }
    });
});

console.log('[Calendar Management] Module ready');
