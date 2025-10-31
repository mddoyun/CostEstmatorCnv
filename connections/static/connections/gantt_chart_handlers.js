// =====================================================================
// 간트차트 (공정표) 관련 함수들
// =====================================================================

let ganttChart = null;
let ganttData = [];
let projectStartDate = null;
let selectedTaskId = null; // 선택된 태스크 ID
let ganttCostItems = []; // 간트차트용 산출항목 데이터
let selectedCostItemId = null; // 선택된 산출항목 ID
let costCutoffDate = null; // 내역집계 기준일
let ganttActivities = []; // 간트차트용 액티비티 데이터
let ganttUnitPrices = {}; // 단가 정보 (costCodeId: unitPriceData)
let ganttMinDate = null; // 간트차트 최소 날짜
let ganttMaxDate = null; // 간트차트 최대 날짜
let ganttDateArray = []; // 간트차트 날짜 배열
let projectCalendars = []; // 프로젝트 작업 캘린더 목록
let mainCalendar = null; // 메인 캘린더

// ▼▼▼ [추가] 3D 뷰어와 공유하기 위해 전역으로 노출 ▼▼▼
window.ganttData = ganttData;
window.ganttCostItems = ganttCostItems;
// ▲▲▲ [추가] 여기까지 ▲▲▲

/**
 * 프로젝트 작업 캘린더 로드
 */
async function loadProjectCalendars(projectId) {
    if (!projectId) return;

    try {
        const response = await fetch(`/connections/api/projects/${projectId}/work-calendars/`);
        if (!response.ok) {
            console.warn('[Gantt Chart] Failed to load calendars');
            return;
        }

        const data = await response.json();
        projectCalendars = data.calendars || [];

        // 메인 캘린더 찾기
        mainCalendar = projectCalendars.find(cal => cal.is_main) || projectCalendars[0] || null;

        console.log('[Gantt Chart] Calendars loaded:', projectCalendars.length, 'calendars, main:', mainCalendar?.name);
    } catch (error) {
        console.error('[Gantt Chart] Error loading calendars:', error);
    }
}

/**
 * 특정 날짜가 작업일인지 확인
 * @param {Date} date - 확인할 날짜
 * @param {Object} calendar - 캘린더 객체 (없으면 메인 캘린더 사용)
 * @returns {boolean} - 작업일 여부
 */
function isWorkingDay(date, calendar = null) {
    if (!calendar) {
        calendar = mainCalendar;
    }

    if (!calendar) {
        // 캘린더가 없으면 월~일 모두 작업일로 간주
        return true;
    }

    const dateString = formatDateForGantt(date);

    // 특별 휴일 체크
    if (calendar.holidays && calendar.holidays.includes(dateString)) {
        return false;
    }

    // 특별 작업일 체크
    if (calendar.special_working_days && calendar.special_working_days.includes(dateString)) {
        return true;
    }

    // 요일별 작업일 체크
    const dayOfWeek = date.getDay(); // 0=일, 1=월, ..., 6=토
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayName = dayNames[dayOfWeek];

    return calendar.working_days && calendar.working_days[dayName] === true;
}

/**
 * 작업일 기준으로 날짜에 일수 추가
 * @param {Date} startDate - 시작 날짜
 * @param {number} workingDays - 추가할 작업일 수
 * @param {Object} calendar - 캘린더 객체 (없으면 메인 캘린더 사용)
 * @returns {Date} - 결과 날짜
 */
function addWorkingDays(startDate, workingDays, calendar = null) {
    if (!calendar) {
        calendar = mainCalendar;
    }

    // 캘린더가 없거나 작업일이 0이면 일반 날짜 추가
    if (!calendar || workingDays === 0) {
        return addDays(startDate, workingDays);
    }

    let current = new Date(startDate);
    let daysAdded = 0;

    // 시작일이 작업일이면 카운트에 포함
    if (isWorkingDay(current, calendar)) {
        daysAdded = 1;
    }

    while (daysAdded < workingDays) {
        current.setDate(current.getDate() + 1);
        if (isWorkingDay(current, calendar)) {
            daysAdded++;
        }
    }

    return current;
}

/**
 * 간트차트 초기화 및 렌더링
 */
async function loadAndRenderGanttChart() {
    if (!currentProjectId) {
        document.getElementById('gantt-chart-container').innerHTML =
            '<p style="padding: 20px; text-align: center; color: #999;">프로젝트를 선택해주세요.</p>';
        return;
    }

    try {
        // ▼▼▼ [추가] 작업 캘린더 로드 ▼▼▼
        await loadProjectCalendars(currentProjectId);
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        // 프로젝트 시작일 가져오기 (로컬 스토리지에서)
        const savedStartDate = localStorage.getItem(`project_${currentProjectId}_start_date`);
        if (savedStartDate) {
            document.getElementById('project-start-date').value = savedStartDate;
            projectStartDate = new Date(savedStartDate);
        } else {
            // 기본값: 오늘
            projectStartDate = new Date();
            const dateString = projectStartDate.toISOString().split('T')[0];
            document.getElementById('project-start-date').value = dateString;
        }

        // 액티비티가 할당된 산출항목(CostItem) 데이터 가져오기
        const response = await fetch(`/connections/api/cost-items/${currentProjectId}/`);
        if (!response.ok) throw new Error('산출항목 데이터를 불러오는데 실패했습니다.');

        const costItems = await response.json();

        // 액티비티가 할당된 항목만 필터링
        const itemsWithActivities = costItems.filter(item => item.activities && item.activities.length > 0);

        // 전역 변수에 저장 (상세 정보 표시용)
        ganttCostItems = itemsWithActivities;

        if (itemsWithActivities.length === 0) {
            document.getElementById('gantt-chart-container').innerHTML =
                '<p style="padding: 20px; text-align: center; color: #999;">액티비티가 할당된 산출항목이 없습니다. 먼저 액티비티를 할당해주세요.</p>';
            document.getElementById('gantt-detail-container').innerHTML = '';
            return;
        }

        // 액티비티 데이터 가져오기
        const activityResponse = await fetch(`/connections/api/activities/${currentProjectId}/`);
        if (!activityResponse.ok) throw new Error('액티비티 데이터를 불러오는데 실패했습니다.');

        const activities = await activityResponse.json();

        // 전역 변수에 저장
        ganttActivities = activities;

        // 의존성 데이터 가져오기
        const dependencyResponse = await fetch(`/connections/api/activity-dependencies/${currentProjectId}/`);
        const dependencies = dependencyResponse.ok ? await dependencyResponse.json() : [];

        // 간트차트 데이터 생성
        ganttData = generateGanttData(itemsWithActivities, activities, dependencies);
        window.ganttData = ganttData; // ▼▼▼ [추가] 전역으로 노출 ▼▼▼
        window.ganttCostItems = ganttCostItems; // ▼▼▼ [추가] 전역으로 노출 ▼▼▼

        console.log('[Gantt Chart] Generated tasks:', ganttData.length);
        if (ganttData.length > 0) {
            console.log('[Gantt Chart] Sample task:', ganttData[0]);
        }

        // 간트차트 렌더링
        renderGanttChart(ganttData);

    } catch (error) {
        console.error('Error loading gantt chart:', error);
        showToast(error.message, 'error');
        document.getElementById('gantt-chart-container').innerHTML =
            `<p style="padding: 20px; text-align: center; color: #d32f2f;">오류: ${error.message}</p>`;
    }
}

/**
 * 간트차트 데이터 생성
 */
function generateGanttData(costItems, activities, dependencies) {
    const activityMap = new Map();
    const activityDurationMap = new Map(); // activityId별 총 duration 누적

    // Activity ID로 Activity 객체를 빠르게 찾기 위한 Map 생성
    activities.forEach(act => {
        activityMap.set(act.id, act);
    });

    // ▼▼▼ [수정] 같은 액티비티 코드별로 duration 합산 ▼▼▼
    // CostItem별로 duration을 계산하고 activityId별로 누적
    costItems.forEach(item => {
        if (!item.activities || item.activities.length === 0) return;

        item.activities.forEach(activityId => {
            const activity = activityMap.get(activityId);
            if (!activity) return;

            // 실제 소요일수 계산: duration_per_unit * quantity
            const durationDays = Math.max(1, Math.ceil(parseFloat(activity.duration_per_unit || 0) * parseFloat(item.quantity || 0)));

            // 같은 activityId의 duration을 누적
            if (!activityDurationMap.has(activityId)) {
                activityDurationMap.set(activityId, 0);
            }
            activityDurationMap.set(activityId, activityDurationMap.get(activityId) + durationDays);
        });
    });

    // activityId별로 하나의 태스크만 생성 (duration은 합산된 값)
    const tasks = [];
    activityDurationMap.forEach((totalDuration, activityId) => {
        const activity = activityMap.get(activityId);
        if (!activity) return;

        // ▼▼▼ [수정] 액티비티별 캘린더 찾기 (없으면 메인 캘린더 사용) ▼▼▼
        let taskCalendar = mainCalendar;
        if (activity.work_calendar) {
            taskCalendar = projectCalendars.find(cal => cal.id === activity.work_calendar) || mainCalendar;
        }

        // 기본 start/end 설정 (나중에 calculateTaskDates에서 재계산)
        const defaultStart = new Date(projectStartDate);
        const defaultEnd = addWorkingDays(defaultStart, totalDuration, taskCalendar);
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        tasks.push({
            id: activityId, // 이제 activityId만 사용 (그룹화됨)
            name: `${activity.code} - ${activity.name}`,
            start: formatDateForGantt(defaultStart),
            end: formatDateForGantt(defaultEnd),
            activityId: activityId,
            activity: activity,
            durationDays: totalDuration, // 합산된 총 duration
            progress: 0,
            custom_class: `activity-${activity.code}`,
            calendar: taskCalendar, // ▼▼▼ [추가] 캘린더 정보 ▼▼▼
        });
    });
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // 의존성에 따라 시작일/종료일 재계산
    if (dependencies && dependencies.length > 0) {
        calculateTaskDates(tasks, dependencies, activityMap);
    }

    return tasks;
}

/**
 * 태스크의 시작일/종료일 계산 (의존성 고려)
 */
function calculateTaskDates(tasks, dependencies, activityMap) {
    if (!tasks || tasks.length === 0) return;
    if (!dependencies || dependencies.length === 0) return;

    try {
        // Activity ID별로 태스크를 그룹화
        const tasksByActivity = new Map();
        tasks.forEach(task => {
            if (!tasksByActivity.has(task.activityId)) {
                tasksByActivity.set(task.activityId, []);
            }
            tasksByActivity.get(task.activityId).push(task);
        });

        // 시작일 계산을 위한 재귀 함수
        function getEarliestStartDate(activityId, visited = new Set()) {
            if (visited.has(activityId)) {
                // 순환 참조 방지
                return new Date(projectStartDate);
            }
            visited.add(activityId);

            // 선행 의존성 찾기
            const predecessors = dependencies.filter(dep => dep.successor_activity === activityId);

            if (predecessors.length === 0) {
                // 선행 작업이 없으면 프로젝트 시작일
                return new Date(projectStartDate);
            }

            // 모든 선행 작업의 종료일 중 가장 늦은 날짜
            let maxEndDate = new Date(projectStartDate);

            predecessors.forEach(dep => {
                const predTasks = tasksByActivity.get(dep.predecessor_activity) || [];
                if (predTasks.length > 0) {
                    // ▼▼▼ [수정] 선행 작업의 종료일 계산 (작업일 기준) ▼▼▼
                    const predStartDate = getEarliestStartDate(dep.predecessor_activity, new Set(visited));
                    const predDuration = predTasks[0].durationDays || 1;
                    const predCalendar = predTasks[0].calendar || mainCalendar;
                    const predEndDate = addWorkingDays(predStartDate, predDuration, predCalendar);

                    // Lag 적용 (작업일 기준)
                    const lagDays = parseFloat(dep.lag_days || 0);
                    const adjustedDate = addWorkingDays(predEndDate, lagDays, predCalendar);
                    // ▲▲▲ [수정] 여기까지 ▲▲▲

                    if (adjustedDate > maxEndDate) {
                        maxEndDate = adjustedDate;
                    }
                }
            });

            return maxEndDate;
        }

        // 각 태스크의 시작일/종료일 재설정
        tasks.forEach(task => {
            try {
                const startDate = getEarliestStartDate(task.activityId);
                // ▼▼▼ [수정] 작업일 기준으로 종료일 계산 ▼▼▼
                const taskCalendar = task.calendar || mainCalendar;
                const endDate = addWorkingDays(startDate, task.durationDays, taskCalendar);
                // ▲▲▲ [수정] 여기까지 ▲▲▲

                task.start = formatDateForGantt(startDate);
                task.end = formatDateForGantt(endDate);
            } catch (err) {
                console.warn(`[Gantt] Error calculating dates for task ${task.id}:`, err);
            }
        });

        // 의존성 정보를 Frappe Gantt 형식으로 변환
        tasks.forEach(task => {
            try {
                const predecessors = dependencies.filter(dep => dep.successor_activity === task.activityId);
                if (predecessors.length > 0) {
                    const depIds = predecessors.map(dep => {
                        // 같은 predecessor activity를 가진 태스크들 찾기
                        const predTasks = tasks.filter(t => t.activityId === dep.predecessor_activity);
                        return predTasks.map(t => t.id).join(',');
                    }).filter(id => id).join(',');

                    if (depIds) {
                        task.dependencies = depIds;
                    }
                }
            } catch (err) {
                console.warn(`[Gantt] Error setting dependencies for task ${task.id}:`, err);
            }
        });
    } catch (error) {
        console.error('[Gantt] Error in calculateTaskDates:', error);
    }
}

/**
 * 날짜에 일수 추가
 */
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * 날짜를 Frappe Gantt 형식으로 변환 (YYYY-MM-DD)
 */
function formatDateForGantt(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * HTML/CSS 기반 간트차트 렌더링
 */
function renderGanttChart(tasks) {
    const chartContainer = document.getElementById('gantt-chart-container');

    if (!chartContainer) {
        console.error('[Gantt Chart] Container element not found');
        return;
    }

    if (!tasks || tasks.length === 0) {
        chartContainer.innerHTML =
            '<p style="padding: 20px; text-align: center; color: #999;">표시할 태스크가 없습니다.</p>';
        return;
    }

    // 데이터 검증
    const validTasks = tasks.filter(task => {
        if (!task.id || !task.name || !task.start || !task.end) {
            console.warn('[Gantt Chart] Invalid task detected:', task);
            return false;
        }
        return true;
    });

    if (validTasks.length === 0) {
        chartContainer.innerHTML =
            '<p style="padding: 20px; text-align: center; color: #d32f2f;">유효한 태스크가 없습니다.</p>';
        return;
    }

    console.log('[Gantt Chart] Rendering', validTasks.length, 'valid tasks');

    try {
        // 날짜 범위 계산
        const allDates = validTasks.flatMap(t => [new Date(t.start), new Date(t.end)]);
        const minDate = new Date(Math.min(...allDates));
        const maxDate = new Date(Math.max(...allDates));
        const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));

        // 전역 변수에 저장
        ganttMinDate = minDate;
        ganttMaxDate = maxDate;

        // ▼▼▼ [추가] 날짜 배열 생성 및 월별 그룹화 ▼▼▼
        const dateArray = [];
        const monthGroups = [];
        let currentMonth = null;
        let monthDayCount = 0;

        for (let i = 0; i < totalDays; i++) {
            const date = new Date(minDate);
            date.setDate(date.getDate() + i);
            dateArray.push(date);

            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            if (currentMonth !== monthKey) {
                if (currentMonth !== null) {
                    monthGroups.push({ month: currentMonth, days: monthDayCount });
                }
                currentMonth = monthKey;
                monthDayCount = 1;
            } else {
                monthDayCount++;
            }
        }
        // 마지막 월 추가
        if (currentMonth !== null) {
            monthGroups.push({ month: currentMonth, days: monthDayCount });
        }

        // 전역 변수에 저장
        ganttDateArray = dateArray;

        // 요일 한글 변환
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        // HTML 생성
        let html = `
            <div style="overflow-x: auto; background: white; border-radius: 8px; padding: 20px;">
                <table class="gantt-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <!-- 첫 번째 헤더 행: 월 표시 -->
                        <tr style="background: #e8e8e8; border-bottom: 1px solid #ccc;">
                            <th rowspan="2" style="padding: 10px; text-align: left; min-width: 250px; position: sticky; left: 0; background: #e8e8e8; z-index: 11; border-right: 2px solid #ccc;">태스크명</th>
                            <th rowspan="2" style="padding: 10px; text-align: center; min-width: 150px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">작업 캘린더</th>
                            <th rowspan="2" style="padding: 10px; text-align: center; min-width: 80px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">기간(일)</th>
                            <th rowspan="2" style="padding: 10px; text-align: center; min-width: 100px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">시작일</th>
                            <th rowspan="2" style="padding: 10px; text-align: center; min-width: 100px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">종료일</th>
                            ${monthGroups.map(mg => {
                                const [year, month] = mg.month.split('-');
                                return `<th colspan="${mg.days}" style="padding: 5px; text-align: center; background: #d0d0d0; border-right: 1px solid #999;">${year}년 ${month}월</th>`;
                            }).join('')}
                        </tr>
                        <!-- 두 번째 헤더 행: 일/요일 표시 -->
                        <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                            ${dateArray.map((date, idx) => {
                                const day = date.getDate();
                                const dayOfWeek = dayNames[date.getDay()];
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                const dateString = date.toISOString().split('T')[0];
                                const isSelectedDate = costCutoffDate && dateString === costCutoffDate.toISOString().split('T')[0];
                                let bgColor = isWeekend ? '#ffe0e0' : '#f5f5f5';
                                if (isSelectedDate) bgColor = '#ffd700';
                                const textColor = isWeekend ? '#d32f2f' : '#333';
                                return `<th class="gantt-date-cell" data-date="${dateString}" style="padding: 5px 2px; text-align: center; min-width: 30px; max-width: 40px; font-size: 11px; background: ${bgColor}; color: ${textColor}; border-right: 1px solid #ddd; cursor: pointer;">
                                    <div>${day}</div>
                                    <div style="font-size: 10px; font-weight: normal;">${dayOfWeek}</div>
                                </th>`;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        validTasks.forEach((task, index) => {
            const startDate = new Date(task.start);
            const endDate = new Date(task.end);
            const taskStartDay = Math.ceil((startDate - minDate) / (1000 * 60 * 60 * 24));
            const taskEndDay = Math.ceil((endDate - minDate) / (1000 * 60 * 60 * 24));

            const activity = task.activity || {};
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
            const barColor = `hsl(${(index * 137.5) % 360}, 70%, 60%)`;
            const isSelected = selectedTaskId === task.id;
            const rowBgColor = isSelected ? '#e3f2fd' : bgColor;

            // ▼▼▼ [추가] 캘린더 드롭다운 생성 ▼▼▼
            const taskCalendar = task.calendar || mainCalendar;
            const currentCalendarId = activity.work_calendar || (mainCalendar ? mainCalendar.id : '');
            let calendarOptions = '<option value="">메인 캘린더</option>';
            projectCalendars.forEach(cal => {
                const selected = cal.id === currentCalendarId ? 'selected' : '';
                const mainBadge = cal.is_main ? ' ⭐' : '';
                calendarOptions += `<option value="${cal.id}" ${selected}>${cal.name}${mainBadge}</option>`;
            });
            const calendarDropdown = `<select class="calendar-select" data-activity-id="${task.activityId}" style="padding: 5px; font-size: 12px; border: 1px solid #ddd; border-radius: 4px; background: white;">${calendarOptions}</select>`;
            // ▲▲▲ [추가] 여기까지 ▲▲▲

            html += `
                <tr class="gantt-task-row" data-task-id="${task.id}" style="background: ${rowBgColor}; border-bottom: 1px solid #eee; cursor: pointer;">
                    <td style="padding: 10px; position: sticky; left: 0; background: ${rowBgColor}; z-index: 5; font-weight: 500; border-right: 2px solid #ccc;" title="${task.name}">
                        ${task.name}
                    </td>
                    <td style="padding: 8px; text-align: center; background: ${rowBgColor}; border-right: 2px solid #ccc;" onclick="event.stopPropagation();">${calendarDropdown}</td>
                    <td style="padding: 10px; text-align: center; background: ${rowBgColor}; border-right: 2px solid #ccc;">${task.durationDays}일</td>
                    <td style="padding: 10px; text-align: center; font-size: 12px; background: ${rowBgColor}; border-right: 2px solid #ccc;">${task.start}</td>
                    <td style="padding: 10px; text-align: center; font-size: 12px; background: ${rowBgColor}; border-right: 2px solid #ccc;">${task.end}</td>
            `;

            // ▼▼▼ [수정] 날짜별 셀 생성 및 태스크 바 표시 ▼▼▼
            dateArray.forEach((date, dayIndex) => {
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const dateString = date.toISOString().split('T')[0];
                const isSelectedDate = costCutoffDate && dateString === costCutoffDate.toISOString().split('T')[0];

                let cellBgColor;
                if (isSelectedDate) {
                    cellBgColor = '#ffd700';
                } else if (isSelected) {
                    cellBgColor = isWeekend ? '#d1e7fd' : '#e3f2fd';
                } else {
                    cellBgColor = isWeekend ? '#fff5f5' : bgColor;
                }
                const isTaskDay = dayIndex >= taskStartDay && dayIndex < taskEndDay;

                let cellContent = '';
                let cellStyle = `padding: 5px 2px; text-align: center; min-width: 30px; max-width: 40px; background: ${cellBgColor}; border-right: 1px solid #ddd; position: relative; cursor: pointer;`;

                if (isTaskDay) {
                    // 태스크 기간에 포함되는 날짜
                    const isFirstDay = dayIndex === taskStartDay;
                    const isLastDay = dayIndex === taskEndDay - 1;

                    // ▼▼▼ [추가] 캘린더 기준 작업일 확인 ▼▼▼
                    const taskCalendar = task.calendar || mainCalendar;
                    const isWorkDay = isWorkingDay(date, taskCalendar);
                    // ▲▲▲ [추가] 여기까지 ▲▲▲

                    let barStyle;
                    if (isWorkDay) {
                        // 작업일: 배경색 채우기
                        barStyle = `background: ${barColor}; height: 30px; margin: 5px 0;`;
                    } else {
                        // 휴일: 테두리만 색상, 배경은 흰색
                        barStyle = `background: white; border: 2px solid ${barColor}; height: 26px; margin: 5px 0; box-sizing: border-box;`;
                    }

                    // 첫날과 마지막날에만 둥근 모서리
                    if (isFirstDay && isLastDay) {
                        barStyle += ' border-radius: 4px;';
                    } else if (isFirstDay) {
                        barStyle += ' border-radius: 4px 0 0 4px;';
                    } else if (isLastDay) {
                        barStyle += ' border-radius: 0 4px 4px 0;';
                    }

                    // 중간에 일수 표시 (태스크 중간 날짜에만)
                    const middleDay = Math.floor((taskStartDay + taskEndDay) / 2);
                    const showDuration = dayIndex === middleDay && task.durationDays >= 3;

                    // 휴일 표시 추가
                    const holidayMark = !isWorkDay ? '<div style="font-size: 10px; color: #999;">휴</div>' : '';

                    cellContent = `<div style="${barStyle}" title="액티비티: ${activity.code} - ${activity.name}
총 작업기간: ${task.durationDays}일
단위수량당 소요일수: ${activity.duration_per_unit || 0}일
${!isWorkDay ? '※ 캘린더상 휴일' : ''}
${activity.responsible_person ? '담당자: ' + activity.responsible_person : ''}">
                        ${showDuration ? `<span style="color: ${isWorkDay ? 'white' : barColor}; font-size: 11px; font-weight: bold;">${task.durationDays}일</span>` : ''}
                        ${!showDuration && !isWorkDay ? holidayMark : ''}
                    </div>`;
                }

                html += `<td class="gantt-date-cell" data-date="${dateString}" style="${cellStyle}">${cellContent}</td>`;
            });
            // ▲▲▲ [수정] 여기까지 ▲▲▲

            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
                <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 4px;">
                    <p style="margin: 0; font-size: 12px; color: #666;">
                        <strong>프로젝트 기간:</strong> ${minDate.toLocaleDateString('ko-KR')} ~ ${maxDate.toLocaleDateString('ko-KR')} (${totalDays}일)
                        &nbsp;&nbsp;|&nbsp;&nbsp;
                        <strong>총 태스크:</strong> ${validTasks.length}개
                    </p>
                </div>
            </div>
        `;

        chartContainer.innerHTML = html;
        console.log('[Gantt Chart] Rendered successfully with', validTasks.length, 'tasks');

        // ▼▼▼ [추가] 캘린더 선택 이벤트 리스너 등록 ▼▼▼
        document.querySelectorAll('.calendar-select').forEach(select => {
            select.addEventListener('change', async function(e) {
                e.stopPropagation();
                const activityId = this.getAttribute('data-activity-id');
                const calendarId = this.value || null;

                console.log('[Gantt Chart] Changing calendar for activity:', activityId, 'to calendar:', calendarId);

                try {
                    // Update activity's work_calendar via API
                    const response = await fetch(`/connections/api/activities/detail/${activityId}/`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCSRFToken()
                        },
                        body: JSON.stringify({
                            work_calendar: calendarId
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to update activity calendar');
                    }

                    showToast('캘린더가 변경되었습니다. 간트차트를 새로고침합니다.', 'success');

                    // Reload gantt chart to reflect changes
                    await loadAndRenderGanttChart();
                } catch (error) {
                    console.error('[Gantt Chart] Error updating calendar:', error);
                    showToast('캘린더 변경에 실패했습니다.', 'error');
                }
            });
        });
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        // ▼▼▼ [추가] 행 클릭 이벤트 리스너 등록 및 호버 효과 ▼▼▼
        document.querySelectorAll('.gantt-task-row').forEach(row => {
            row.addEventListener('click', function() {
                const taskId = this.getAttribute('data-task-id');
                selectGanttTask(taskId);
            });

            // 호버 효과
            row.addEventListener('mouseenter', function() {
                if (this.getAttribute('data-task-id') !== selectedTaskId) {
                    this.style.background = '#f0f0f0';
                    // 모든 td 배경색도 업데이트 (선택된 날짜는 제외)
                    this.querySelectorAll('td').forEach(td => {
                        const isSelectedDate = td.style.background && td.style.background.includes('rgb(255, 215, 0)');
                        const isWeekend = td.style.background && td.style.background.includes('#fff5f5');
                        if (!isSelectedDate && !isWeekend) {
                            td.style.background = '#f0f0f0';
                        }
                    });
                }
            });

            row.addEventListener('mouseleave', function() {
                if (this.getAttribute('data-task-id') !== selectedTaskId) {
                    // 원래 배경색으로 복원
                    const index = Array.from(this.parentNode.children).indexOf(this);
                    const originalBg = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
                    this.style.background = originalBg;
                    this.querySelectorAll('td').forEach(td => {
                        const isSelectedDate = td.style.background && td.style.background.includes('rgb(255, 215, 0)');
                        const isWeekend = td.style.background && td.style.background.includes('#fff5f5');
                        if (!isSelectedDate && !isWeekend) {
                            td.style.background = originalBg;
                        }
                    });
                }
            });
        });

        // ▼▼▼ [추가] 날짜 셀 클릭 이벤트 리스너 등록 ▼▼▼
        document.querySelectorAll('.gantt-date-cell').forEach(cell => {
            cell.addEventListener('click', function(e) {
                e.stopPropagation();
                const dateString = this.getAttribute('data-date');
                if (dateString) {
                    selectGanttDate(dateString);
                }
            });
        });
        // ▲▲▲ [추가] 여기까지 ▲▲▲
    } catch (error) {
        console.error('[Gantt Chart] Rendering error:', error);
        chartContainer.innerHTML =
            `<p style="padding: 20px; text-align: center; color: #d32f2f;">간트차트 렌더링 중 오류가 발생했습니다: ${error.message}</p>`;
        showToast('간트차트 렌더링 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 간트차트 태스크 선택
 */
function selectGanttTask(taskId) {
    selectedTaskId = taskId;

    // 간트차트 다시 렌더링 (선택 상태 반영)
    renderGanttChart(ganttData);

    // 상세 정보 표시
    renderTaskDetail(taskId);
}

/**
 * 간트차트 날짜 선택
 */
function selectGanttDate(dateString) {
    costCutoffDate = new Date(dateString);

    // 입력 필드 업데이트
    const dateInput = document.getElementById('cost-cutoff-date');
    if (dateInput) {
        dateInput.value = dateString;
    }

    // 간트차트 다시 렌더링 (선택된 날짜 하이라이트)
    renderGanttChart(ganttData);

    // 내역집계표 자동 업데이트
    const activeTab = document.querySelector('.gantt-bottom-tab-btn.active');
    if (activeTab && activeTab.getAttribute('data-tab') === 'boq') {
        renderBoqSummary();
    }

    console.log('[Gantt Chart] Date selected:', dateString);
}

/**
 * 선택된 태스크의 상세 정보 렌더링 (좌우 분할)
 */
function renderTaskDetail(taskId) {
    const detailContainer = document.getElementById('gantt-detail-container');

    if (!detailContainer) {
        console.error('[Gantt Detail] Detail container not found');
        return;
    }

    if (!taskId) {
        detailContainer.innerHTML = '';
        selectedCostItemId = null;
        return;
    }

    // 선택된 태스크 찾기
    const selectedTask = ganttData.find(t => t.id === taskId);
    if (!selectedTask) {
        detailContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">선택된 태스크를 찾을 수 없습니다.</p>';
        return;
    }

    // 해당 액티비티에 할당된 모든 CostItem 찾기
    const relatedItems = ganttCostItems.filter(item =>
        item.activities && item.activities.includes(taskId)
    );

    if (relatedItems.length === 0) {
        detailContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">할당된 산출항목이 없습니다.</p>';
        selectedCostItemId = null;
        return;
    }

    const activity = selectedTask.activity;

    // 기본적으로 첫 번째 항목 선택 (이전에 선택된 항목이 없으면)
    if (!selectedCostItemId || !relatedItems.find(item => item.id === selectedCostItemId)) {
        selectedCostItemId = relatedItems[0].id;
    }

    // ▼▼▼ [수정] 좌우 분할 레이아웃 ▼▼▼
    let html = `
        <div style="background: white; border-radius: 8px; padding: 20px; height: 100%; display: flex; flex-direction: column;">
            <h3 style="margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #1976d2; color: #1976d2; flex-shrink: 0;">
                ${activity.code} - ${activity.name} (상세 정보)
            </h3>
            <div style="display: grid; grid-template-columns: 350px 1fr; gap: 20px; flex: 1; min-height: 0;">
                <!-- 좌측: 산출항목 목록 -->
                <div style="border-right: 2px solid #e0e0e0; padding-right: 20px; overflow: hidden; display: flex; flex-direction: column;">
                    <h4 style="margin: 0 0 10px 0; color: #666; font-size: 14px; flex-shrink: 0;">산출항목 목록 (${relatedItems.length}개)</h4>
                    <div id="cost-item-list" style="overflow-y: scroll; overflow-x: hidden; flex: 1; min-height: 0;">
    `;

    // 좌측 산출항목 리스트
    relatedItems.forEach((item, index) => {
        const isSelected = item.id === selectedCostItemId;
        const bgColor = isSelected ? '#e3f2fd' : (index % 2 === 0 ? '#ffffff' : '#f9f9f9');
        const borderColor = isSelected ? '#1976d2' : '#e0e0e0';
        const durationDays = Math.max(1, Math.ceil(parseFloat(activity.duration_per_unit || 0) * parseFloat(item.quantity || 0)));

        html += `
            <div class="cost-item-card" data-item-id="${item.id}"
                 style="padding: 12px; margin-bottom: 8px; background: ${bgColor}; border: 2px solid ${borderColor}; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                <div style="font-weight: bold; color: #1976d2; margin-bottom: 4px; font-size: 13px;">
                    ${item.cost_code || '-'}
                    ${item.cost_code_detail_code ? ' / ' + item.cost_code_detail_code : ''}
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                    ${item.cost_code_name || '-'}
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #999;">
                    <span>${item.quantity ? parseFloat(item.quantity).toFixed(2) : '-'} ${item.cost_code_unit || ''}</span>
                    <span style="font-weight: bold; color: #1976d2;">${durationDays}일</span>
                </div>
            </div>
        `;
    });

    html += `
                    </div>
                </div>
                <!-- 우측: 선택된 산출항목의 상세 정보 -->
                <div style="padding-left: 10px; overflow: hidden; display: flex; flex-direction: column;">
                    <div id="cost-item-detail" style="overflow-y: scroll; overflow-x: hidden; flex: 1; min-height: 0;">
    `;

    // 우측 상세 정보
    html += renderCostItemDetail(selectedCostItemId, activity);

    html += `
                    </div>
                </div>
            </div>
        </div>
    `;
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    detailContainer.innerHTML = html;

    // 산출항목 카드 클릭 이벤트 등록
    document.querySelectorAll('.cost-item-card').forEach(card => {
        card.addEventListener('click', function() {
            const itemId = this.getAttribute('data-item-id');
            selectCostItem(itemId);
        });

        // 호버 효과
        card.addEventListener('mouseenter', function() {
            if (this.getAttribute('data-item-id') !== selectedCostItemId) {
                this.style.background = '#f5f5f5';
            }
        });

        card.addEventListener('mouseleave', function() {
            if (this.getAttribute('data-item-id') !== selectedCostItemId) {
                const index = Array.from(this.parentNode.children).indexOf(this);
                this.style.background = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
            }
        });
    });

    // 탭 전환 이벤트 등록
    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            // 모든 탭 버튼 비활성화
            document.querySelectorAll('.detail-tab-btn').forEach(b => {
                b.style.background = '#f5f5f5';
                b.style.color = '#666';
                b.classList.remove('active');
            });

            // 클릭된 탭 버튼 활성화
            this.style.background = '#1976d2';
            this.style.color = 'white';
            this.classList.add('active');

            // 모든 탭 콘텐츠 숨기기
            document.querySelectorAll('.detail-tab-content').forEach(content => {
                content.style.display = 'none';
            });

            // 선택된 탭 콘텐츠 표시
            const targetContent = document.querySelector(`.detail-tab-content[data-tab="${targetTab}"]`);
            if (targetContent) {
                targetContent.style.display = 'block';
            }
        });
    });
}

/**
 * 산출항목 선택
 */
function selectCostItem(itemId) {
    selectedCostItemId = itemId;
    // 상세 정보만 다시 렌더링
    renderTaskDetail(selectedTaskId);
}

/**
 * 산출항목 상세 정보 렌더링 (탭 형태)
 */
function renderCostItemDetail(itemId, activity) {
    if (!itemId) {
        return '<p style="padding: 20px; text-align: center; color: #999;">산출항목을 선택해주세요.</p>';
    }

    const item = ganttCostItems.find(i => i.id === itemId);
    if (!item) {
        return '<p style="padding: 20px; text-align: center; color: #999;">산출항목을 찾을 수 없습니다.</p>';
    }

    const durationDays = Math.max(1, Math.ceil(parseFloat(activity.duration_per_unit || 0) * parseFloat(item.quantity || 0)));

    return `
        <div style="display: flex; flex-direction: column; height: 100%;">
            <!-- 탭 헤더 -->
            <div style="display: flex; border-bottom: 2px solid #ddd; margin-bottom: 15px; flex-shrink: 0;">
                <button class="detail-tab-btn active" data-tab="cost-item" style="padding: 10px 20px; border: none; background: #1976d2; color: white; cursor: pointer; font-size: 13px; font-weight: bold; border-radius: 4px 4px 0 0; margin-right: 2px;">
                    산출항목 정보
                </button>
                <button class="detail-tab-btn" data-tab="quantity-member" style="padding: 10px 20px; border: none; background: #f5f5f5; color: #666; cursor: pointer; font-size: 13px; border-radius: 4px 4px 0 0; margin-right: 2px;">
                    수량산출부재 정보
                </button>
                <button class="detail-tab-btn" data-tab="raw-element" style="padding: 10px 20px; border: none; background: #f5f5f5; color: #666; cursor: pointer; font-size: 13px; border-radius: 4px 4px 0 0;">
                    BIM 원본객체 정보
                </button>
            </div>

            <!-- 탭 내용 -->
            <div style="flex: 1; overflow-y: auto; min-height: 0;">
                ${renderCostItemTab(item, activity, durationDays)}
                ${renderQuantityMemberTab(item)}
                ${renderRawElementTab(item)}
            </div>
        </div>
    `;
}

/**
 * 산출항목 정보 탭
 */
function renderCostItemTab(item, activity, durationDays) {
    return `
        <div class="detail-tab-content active" data-tab="cost-item">
            <h4 style="margin: 0 0 15px 0; color: #666; font-size: 14px;">산출항목 상세 정보</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
                <tbody>
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 12px; background: #f5f5f5; font-weight: bold; width: 200px;">ID</td>
                        <td style="padding: 12px;">${item.id || '-'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 12px; background: #f5f5f5; font-weight: bold;">공사코드</td>
                        <td style="padding: 12px;">${item.cost_code || '-'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 12px; background: #f5f5f5; font-weight: bold;">세부코드</td>
                        <td style="padding: 12px;">${item.cost_code_detail_code || '-'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 12px; background: #f5f5f5; font-weight: bold;">이름</td>
                        <td style="padding: 12px;">${item.cost_code_name || '-'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 12px; background: #f5f5f5; font-weight: bold;">수량</td>
                        <td style="padding: 12px;">${item.quantity ? parseFloat(item.quantity).toFixed(2) : '-'} ${item.cost_code_unit || ''}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 12px; background: #f5f5f5; font-weight: bold;">단위</td>
                        <td style="padding: 12px;">${item.cost_code_unit || '-'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 12px; background: #f5f5f5; font-weight: bold;">활성 상태</td>
                        <td style="padding: 12px;">${item.is_active ? '활성' : '비활성'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 12px; background: #f5f5f5; font-weight: bold;">설명</td>
                        <td style="padding: 12px;">${item.description || '-'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 12px; background: #f5f5f5; font-weight: bold;">단위수량당 소요일수</td>
                        <td style="padding: 12px;">${activity.duration_per_unit || 0}일</td>
                    </tr>
                    <tr style="border-bottom: 2px solid #1976d2; background: #e3f2fd;">
                        <td style="padding: 12px; font-weight: bold; color: #1976d2;">총 소요일수</td>
                        <td style="padding: 12px; font-weight: bold; color: #1976d2; font-size: 16px;">${durationDays}일</td>
                    </tr>
                </tbody>
            </table>
            <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 4px; font-size: 12px; color: #666;">
                <p style="margin: 0 0 5px 0;"><strong>액티비티 정보:</strong></p>
                <p style="margin: 0 0 5px 0;">• 액티비티 코드: ${activity.code}</p>
                <p style="margin: 0 0 5px 0;">• 액티비티 이름: ${activity.name}</p>
                <p style="margin: 0; margin-bottom: 20px;">• 담당자: ${activity.responsible_person || '미지정'}</p>
            </div>
        </div>
    `;
}

/**
 * 수량산출부재 정보 탭
 */
function renderQuantityMemberTab(item) {
    const qmProps = item.quantity_member_properties || {};
    const mmProps = item.member_mark_properties || {};

    return `
        <div class="detail-tab-content" data-tab="quantity-member" style="display: none;">
            <h4 style="margin: 0 0 15px 0; color: #666; font-size: 14px;">수량산출부재 속성</h4>
            ${Object.keys(qmProps).length > 0 ? `
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
                    <tbody>
                        ${Object.entries(qmProps).map(([key, value]) => `
                            <tr style="border-bottom: 1px solid #e0e0e0;">
                                <td style="padding: 12px; background: #f5f5f5; font-weight: bold; width: 200px;">${key}</td>
                                <td style="padding: 12px;">${typeof value === 'object' ? JSON.stringify(value, null, 2) : (value || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p style="padding: 20px; text-align: center; color: #999;">수량산출부재 속성이 없습니다.</p>'}

            ${Object.keys(mmProps).length > 0 ? `
                <h4 style="margin: 20px 0 15px 0; color: #666; font-size: 14px;">부재마크 속성</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
                    <tbody>
                        ${Object.entries(mmProps).map(([key, value]) => `
                            <tr style="border-bottom: 1px solid #e0e0e0;">
                                <td style="padding: 12px; background: #f5f5f5; font-weight: bold; width: 200px;">${key}</td>
                                <td style="padding: 12px;">${typeof value === 'object' ? JSON.stringify(value, null, 2) : (value || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : ''}
        </div>
    `;
}

/**
 * BIM 원본객체 정보 탭
 */
function renderRawElementTab(item) {
    const rawProps = item.raw_element_properties || {};

    return `
        <div class="detail-tab-content" data-tab="raw-element" style="display: none;">
            <h4 style="margin: 0 0 15px 0; color: #666; font-size: 14px;">BIM 원본객체 속성</h4>
            ${Object.keys(rawProps).length > 0 ? `
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
                    <tbody>
                        ${Object.entries(rawProps).map(([key, value]) => `
                            <tr style="border-bottom: 1px solid #e0e0e0;">
                                <td style="padding: 12px; background: #f5f5f5; font-weight: bold; width: 200px;">${key}</td>
                                <td style="padding: 12px; word-break: break-all;">${typeof value === 'object' ? JSON.stringify(value, null, 2) : (value || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p style="padding: 20px; text-align: center; color: #999;">BIM 원본객체 속성이 없습니다.</p>'}
        </div>
    `;
}

/**
 * 이벤트 리스너 등록
 */
document.addEventListener('DOMContentLoaded', function() {
    // 프로젝트 시작일 변경 이벤트
    document.getElementById('project-start-date')?.addEventListener('change', function() {
        const dateValue = this.value;
        if (currentProjectId && dateValue) {
            localStorage.setItem(`project_${currentProjectId}_start_date`, dateValue);
            projectStartDate = new Date(dateValue);
            loadAndRenderGanttChart();
        }
    });

    // 내역집계 기준일 변경 이벤트
    document.getElementById('cost-cutoff-date')?.addEventListener('change', function() {
        const dateValue = this.value;
        if (dateValue) {
            costCutoffDate = new Date(dateValue);
            renderBoqSummary();
        }
    });

    // 새로고침 버튼
    document.getElementById('refresh-gantt-btn')?.addEventListener('click', function() {
        loadAndRenderGanttChart();
    });

    // 표시 모드 변경 (HTML 기반 간트차트이므로 새로고침)
    document.getElementById('gantt-view-mode')?.addEventListener('change', function() {
        loadAndRenderGanttChart();
    });

    // 하단 탭 전환 이벤트
    document.querySelectorAll('.gantt-bottom-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            // 모든 탭 버튼 비활성화
            document.querySelectorAll('.gantt-bottom-tab-btn').forEach(b => {
                b.style.background = '#f5f5f5';
                b.style.color = '#666';
                b.classList.remove('active');
            });

            // 클릭된 탭 버튼 활성화
            this.style.background = '#1976d2';
            this.style.color = 'white';
            this.classList.add('active');

            // 모든 탭 콘텐츠 숨기기
            document.querySelectorAll('.gantt-bottom-tab-content').forEach(content => {
                content.style.display = 'none';
            });

            // 선택된 탭 콘텐츠 표시
            const targetContent = document.querySelector(`.gantt-bottom-tab-content[data-tab="${targetTab}"]`);
            if (targetContent) {
                targetContent.style.display = 'block';
            }

            // 내역집계표 탭으로 전환 시 렌더링
            if (targetTab === 'boq' && costCutoffDate) {
                renderBoqSummary();
            }
        });
    });

    console.log('[Gantt Chart] Event listeners registered');
});

// navigation.js에서 탭 전환 시 간트차트 로드하도록 전역 함수 제공
window.loadGanttChart = loadAndRenderGanttChart;

/**
 * 내역집계표 렌더링
 */
async function renderBoqSummary() {
    const boqContainer = document.getElementById('gantt-boq-container');

    if (!boqContainer) {
        console.error('[BOQ Summary] Container not found');
        return;
    }

    if (!costCutoffDate) {
        boqContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">기준일을 선택하면 해당 일자까지의 내역집계표가 표시됩니다.</p>';
        return;
    }

    if (!currentProjectId || ganttData.length === 0) {
        boqContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">간트차트 데이터를 먼저 로드해주세요.</p>';
        return;
    }

    boqContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">집계 중...</p>';

    try {
        // 기준일까지 진행 중인 액티비티 필터링
        const activeActivities = ganttData.filter(task => {
            const startDate = new Date(task.start);
            const endDate = new Date(task.end);
            // 기준일이 액티비티 기간 내에 있거나, 액티비티가 기준일 이전에 완료된 경우
            return startDate <= costCutoffDate;
        });

        console.log('[BOQ Summary] Active activities:', activeActivities.length);

        if (activeActivities.length === 0) {
            boqContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">선택한 기준일까지 진행 중인 액티비티가 없습니다.</p>';
            return;
        }

        // 액티비티에 연결된 산출항목 수집
        const activityIds = new Set(activeActivities.map(a => a.activityId));
        const relevantCostItems = ganttCostItems.filter(item =>
            item.activities && item.activities.some(actId => activityIds.has(actId))
        );

        console.log('[BOQ Summary] Relevant cost items:', relevantCostItems.length);

        if (relevantCostItems.length === 0) {
            boqContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">해당 액티비티에 연결된 산출항목이 없습니다.</p>';
            return;
        }

        // 단가 정보 가져오기
        await loadGanttUnitPrices();

        // CostCode별로 그룹화 및 집계
        const boqData = aggregateGanttByCostCode(relevantCostItems);

        // 렌더링
        renderGanttBoqTable(boqData);

    } catch (error) {
        console.error('[BOQ Summary] Error:', error);
        boqContainer.innerHTML = `<p style="padding: 20px; text-align: center; color: #d32f2f;">오류: ${error.message}</p>`;
    }
}

/**
 * 간트차트용 단가 정보 로드
 */
async function loadGanttUnitPrices() {
    if (!currentProjectId) return;

    try {
        const response = await fetch(`/connections/api/all-unit-prices/${currentProjectId}/`);
        if (!response.ok) {
            console.warn('[Gantt BOQ Summary] Failed to load unit prices');
            return;
        }

        const unitPrices = await response.json();

        // costCode를 키로 하는 맵으로 변환
        ganttUnitPrices = {};
        unitPrices.forEach(up => {
            const key = up.cost_code;
            if (!ganttUnitPrices[key]) {
                ganttUnitPrices[key] = [];
            }
            ganttUnitPrices[key].push(up);
        });

        console.log('[Gantt BOQ Summary] Unit prices loaded:', Object.keys(ganttUnitPrices).length, 'cost codes');

    } catch (error) {
        console.error('[Gantt BOQ Summary] Error loading unit prices:', error);
    }
}

/**
 * 간트차트용 CostCode별로 집계
 */
function aggregateGanttByCostCode(costItems) {
    const aggregated = {};

    costItems.forEach(item => {
        const key = item.cost_code || 'UNKNOWN';

        if (!aggregated[key]) {
            aggregated[key] = {
                cost_code: item.cost_code,
                cost_code_detail_code: item.cost_code_detail_code,
                cost_code_name: item.cost_code_name,
                cost_code_unit: item.cost_code_unit,
                quantity: 0,
                material_cost: 0,
                material_amount: 0,
                labor_cost: 0,
                labor_amount: 0,
                expense_cost: 0,
                expense_amount: 0,
                total_cost: 0,
                total_amount: 0,
                items: []
            };
        }

        aggregated[key].quantity += parseFloat(item.quantity || 0);
        aggregated[key].items.push(item);
    });

    // 단가 정보 적용 및 금액 계산
    Object.values(aggregated).forEach(agg => {
        // 단가 정보 찾기 (첫 번째 항목 기준)
        const firstItem = agg.items[0];
        if (firstItem && firstItem.id) {
            // 간단히 첫 번째 UnitPrice 사용 (실제로는 UnitPriceType에 따라 선택해야 함)
            const unitPriceList = ganttUnitPrices[firstItem.cost_code];
            if (unitPriceList && unitPriceList.length > 0) {
                const up = unitPriceList[0];
                agg.material_cost = parseFloat(up.material_cost || 0);
                agg.labor_cost = parseFloat(up.labor_cost || 0);
                agg.expense_cost = parseFloat(up.expense_cost || 0);
                agg.total_cost = parseFloat(up.total_cost || 0);
            }
        }

        // 금액 계산
        agg.material_amount = agg.material_cost * agg.quantity;
        agg.labor_amount = agg.labor_cost * agg.quantity;
        agg.expense_amount = agg.expense_cost * agg.quantity;
        agg.total_amount = agg.total_cost * agg.quantity;
    });

    return Object.values(aggregated);
}

/**
 * 간트차트용 내역집계표 테이블 렌더링
 */
function renderGanttBoqTable(boqData) {
    const boqContainer = document.getElementById('gantt-boq-container');

    if (!boqContainer) return;

    // 합계 계산
    const totals = boqData.reduce((acc, row) => {
        acc.quantity += row.quantity;
        acc.material_amount += row.material_amount;
        acc.labor_amount += row.labor_amount;
        acc.expense_amount += row.expense_amount;
        acc.total_amount += row.total_amount;
        return acc;
    }, {
        quantity: 0,
        material_amount: 0,
        labor_amount: 0,
        expense_amount: 0,
        total_amount: 0
    });

    let html = `
        <div style="background: white; border-radius: 8px; padding: 20px; height: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #1976d2;">내역집계표 (기준일: ${costCutoffDate.toLocaleDateString('ko-KR')})</h3>
                <div style="font-size: 18px; font-weight: bold; color: #d32f2f;">
                    총 공사비: ${totals.total_amount.toLocaleString('ko-KR')}원
                </div>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #1976d2; color: white;">
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">내역코드</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">세부코드</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">품명</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">단위</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">수량</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">재료비단가</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">재료비</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">노무비단가</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">노무비</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">경비단가</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">경비</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">합계단가</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">합계금액</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    boqData.forEach((row, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
        html += `
            <tr style="background: ${bgColor};">
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${row.cost_code || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${row.cost_code_detail_code || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.cost_code_name || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${row.cost_code_unit || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${row.quantity.toFixed(2)}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${row.material_cost.toLocaleString('ko-KR')}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${Math.round(row.material_amount).toLocaleString('ko-KR')}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${row.labor_cost.toLocaleString('ko-KR')}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${Math.round(row.labor_amount).toLocaleString('ko-KR')}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${row.expense_cost.toLocaleString('ko-KR')}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${Math.round(row.expense_amount).toLocaleString('ko-KR')}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${row.total_cost.toLocaleString('ko-KR')}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${Math.round(row.total_amount).toLocaleString('ko-KR')}</td>
            </tr>
        `;
    });

    // 합계 행
    html += `
                        <tr style="background: #e3f2fd; font-weight: bold;">
                            <td colspan="4" style="padding: 12px; border: 1px solid #ddd; text-align: center;">합계</td>
                            <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${totals.quantity.toFixed(2)}</td>
                            <td style="padding: 12px; border: 1px solid #ddd;"></td>
                            <td style="padding: 12px; border: 1px solid #ddd; text-align: right; color: #1976d2;">${Math.round(totals.material_amount).toLocaleString('ko-KR')}</td>
                            <td style="padding: 12px; border: 1px solid #ddd;"></td>
                            <td style="padding: 12px; border: 1px solid #ddd; text-align: right; color: #1976d2;">${Math.round(totals.labor_amount).toLocaleString('ko-KR')}</td>
                            <td style="padding: 12px; border: 1px solid #ddd;"></td>
                            <td style="padding: 12px; border: 1px solid #ddd; text-align: right; color: #1976d2;">${Math.round(totals.expense_amount).toLocaleString('ko-KR')}</td>
                            <td style="padding: 12px; border: 1px solid #ddd;"></td>
                            <td style="padding: 12px; border: 1px solid #ddd; text-align: right; color: #d32f2f; font-size: 16px;">${Math.round(totals.total_amount).toLocaleString('ko-KR')}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 4px; font-size: 12px; color: #666;">
                <p style="margin: 0 0 5px 0;"><strong>집계 정보:</strong></p>
                <p style="margin: 0 0 5px 0;">• 집계 항목 수: ${boqData.length}개</p>
                <p style="margin: 0;">• 기준일까지 진행 중인 액티비티 수: ${ganttData.filter(t => new Date(t.start) <= costCutoffDate).length}개</p>
            </div>
        </div>
    `;

    boqContainer.innerHTML = html;
}
