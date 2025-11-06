// =====================================================================
// 간트차트 (공정표) 관련 함수들
// =====================================================================

let ganttChart = null;
let ganttData = [];
let projectStartDate = null;
let selectedTaskId = null; // 선택된 태스크 ID
let ganttCostItems = []; // 간트차트용 산출항목 데이터
let selectedActivityObjectId = null; // 선택된 액티비티 객체 ID
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
// 대시보드에서 프로젝트 시작일 설정을 위해 전역으로 노출
Object.defineProperty(window, 'projectStartDate', {
    get: () => projectStartDate,
    set: (value) => { projectStartDate = value; }
});
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

    // ▼▼▼ [수정] 캘린더가 없으면 일반 날짜 추가 (2025-11-06) ▼▼▼
    if (!calendar) {
        return addDays(startDate, workingDays);
    }

    // ▼▼▼ [수정] Lag=0인 경우: 다음 작업일 반환 (2025-11-06) ▼▼▼
    if (workingDays === 0) {
        // 0일 추가 = startDate 다음 작업일 찾기
        let current = new Date(startDate);
        current.setDate(current.getDate() + 1); // 다음 날부터 시작

        while (!isWorkingDay(current, calendar)) {
            current.setDate(current.getDate() + 1);
        }

        console.log(`[DEBUG][addWorkingDays] Lag=0: ${startDate.toISOString().split('T')[0]} → ${current.toISOString().split('T')[0]}`);
        return current;
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // ▼▼▼ [핵심 수정] startDate를 1일차로 포함하여 N일차 계산 (2025-11-06) ▼▼▼
    // 예: 11월 6일(목) 시작, 14일 소요 = 11월 6일이 1일차, 11월 25일이 14일차
    let current = new Date(startDate);
    let daysAdded = 0;

    // startDate가 작업일이면 1일차로 카운트
    if (isWorkingDay(current, calendar)) {
        daysAdded = 1;
        console.log(`[DEBUG][addWorkingDays] Day ${daysAdded}: ${current.toISOString().split('T')[0]}`);
    }

    // 나머지 일수만큼 작업일 카운트
    while (daysAdded < workingDays) {
        current.setDate(current.getDate() + 1);
        if (isWorkingDay(current, calendar)) {
            daysAdded++;
            console.log(`[DEBUG][addWorkingDays] Day ${daysAdded}: ${current.toISOString().split('T')[0]}`);
        }
    }

    console.log(`[DEBUG][addWorkingDays] RESULT: ${startDate.toISOString().split('T')[0]} 시작, ${workingDays}일 소요 = ${current.toISOString().split('T')[0]} 종료`);
    // ▲▲▲ [수정] 여기까지 ▲▲▲

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

        // ActivityObject 데이터 가져오기 (새로운 방식)
        const aoResponse = await fetch(`/connections/api/activity-objects/${currentProjectId}/`);
        if (!aoResponse.ok) throw new Error('액티비티 객체 데이터를 불러오는데 실패했습니다.');

        const activityObjects = await aoResponse.json();

        if (activityObjects.length === 0) {
            document.getElementById('gantt-chart-container').innerHTML =
                '<p style="padding: 20px; text-align: center; color: #999;">액티비티 객체가 없습니다. 먼저 액티비티 객체를 생성해주세요.</p>';
            document.getElementById('gantt-detail-container').innerHTML = '';
            ganttData = [];
            window.ganttData = [];
            return;
        }

        console.log('[Gantt Chart] Loaded activity objects:', activityObjects.length);

        // ActivityObject를 CostItem으로 그룹핑 (기존 로직 호환성 유지)
        const costItemMap = new Map();
        activityObjects.forEach(ao => {
            if (!ao.cost_item || !ao.activity) return;

            const ciId = ao.cost_item.id;
            if (!costItemMap.has(ciId)) {
                costItemMap.set(ciId, {
                    ...ao.cost_item,
                    activities: [],
                    activity_objects: []
                });
            }
            const ci = costItemMap.get(ciId);
            ci.activities.push(ao.activity.id);  // Activity ID를 push (generateGanttData가 ID를 기대함)
            ci.activity_objects.push(ao);
        });

        console.log('[Gantt Chart] Grouped into', costItemMap.size, 'cost items');
        if (costItemMap.size > 0) {
            const firstCi = Array.from(costItemMap.values())[0];
            console.log('[Gantt Chart] Sample grouped CI:', firstCi.id, 'activities:', firstCi.activities);
        }

        const itemsWithActivities = Array.from(costItemMap.values());

        // 전역 변수에 저장 (상세 정보 표시용)
        ganttCostItems = itemsWithActivities;

        // 액티비티 데이터 가져오기
        const activityResponse = await fetch(`/connections/api/activities/${currentProjectId}/`);
        if (!activityResponse.ok) throw new Error('액티비티 데이터를 불러오는데 실패했습니다.');

        const activities = await activityResponse.json();

        // 전역 변수에 저장
        ganttActivities = activities;
        window.loadedActivityObjects = activityObjects; // 3D 뷰어용

        // 의존성 데이터 가져오기
        const dependencyResponse = await fetch(`/connections/api/activity-dependencies/${currentProjectId}/`);
        const dependencies = dependencyResponse.ok ? await dependencyResponse.json() : [];

        // 간트차트 데이터 생성
        ganttData = generateGanttData(itemsWithActivities, activities, dependencies, activityObjects);
        window.ganttData = ganttData; // ▼▼▼ [추가] 전역으로 노출 ▼▼▼
        window.ganttCostItems = ganttCostItems; // ▼▼▼ [추가] 전역으로 노출 ▼▼▼

        console.log('[Gantt Chart] Generated tasks:', ganttData.length);
        if (ganttData.length > 0) {
            console.log('[Gantt Chart] Sample task:', ganttData[0]);
        }

        // 간트차트 렌더링
        renderGanttChart(ganttData);

        // 간트차트 로드 후 대시보드 업데이트 (홈 탭의 공정계획 카드 업데이트)
        if (typeof window.loadHomeDashboardData === 'function') {
            console.log('[Gantt Chart] Triggering dashboard update after gantt load');
            window.loadHomeDashboardData(currentProjectId, true); // skipGanttLoad=true (무한 루프 방지)
        }

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
function generateGanttData(costItems, activities, dependencies, activityObjects) {
    const activityMap = new Map();
    const activityDurationMap = new Map(); // activityId별 총 duration 누적

    // Activity ID로 Activity 객체를 빠르게 찾기 위한 Map 생성
    activities.forEach(act => {
        activityMap.set(act.id, act);
    });

    // ▼▼▼ [수정] ActivityObject의 actual_duration을 사용하여 액티비티별 duration 합산 ▼▼▼
    if (activityObjects && activityObjects.length > 0) {
        // ActivityObject를 사용하여 duration 계산
        activityObjects.forEach(ao => {
            if (!ao.activity || !ao.activity.id) return;

            const activityId = ao.activity.id;
            const activity = activityMap.get(activityId);
            if (!activity) return;

            // ▼▼▼ [수정] 올림 처리 제거 - 먼저 합산 후 나중에 올림 (2025-11-06) ▼▼▼
            // AO.actual_duration 사용 (없으면 자동 계산 값 사용)
            const durationDays = parseFloat(ao.actual_duration) ||
                (parseFloat(activity.duration_per_unit || 0) * parseFloat(ao.quantity || 0));

            // 같은 activityId의 duration을 누적 (소수점 포함)
            if (!activityDurationMap.has(activityId)) {
                activityDurationMap.set(activityId, 0);
            }
            activityDurationMap.set(activityId, activityDurationMap.get(activityId) + durationDays);
            // ▲▲▲ [수정] 여기까지 ▲▲▲
        });
    } else {
        // Fallback: ActivityObject가 없으면 기존 방식 (CostItem 기반) 사용
        costItems.forEach(item => {
            if (!item.activities || item.activities.length === 0) return;

            item.activities.forEach(activityId => {
                const activity = activityMap.get(activityId);
                if (!activity) return;

                // ▼▼▼ [수정] 올림 처리 제거 - 먼저 합산 후 나중에 올림 (2025-11-06) ▼▼▼
                // 실제 소요일수 계산: duration_per_unit * quantity
                const durationDays = parseFloat(activity.duration_per_unit || 0) * parseFloat(item.quantity || 0);

                // 같은 activityId의 duration을 누적 (소수점 포함)
                if (!activityDurationMap.has(activityId)) {
                    activityDurationMap.set(activityId, 0);
                }
                activityDurationMap.set(activityId, activityDurationMap.get(activityId) + durationDays);
                // ▲▲▲ [수정] 여기까지 ▲▲▲
            });
        });
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // activityId별로 하나의 태스크만 생성 (duration은 합산된 값)
    const tasks = [];
    activityDurationMap.forEach((totalDuration, activityId) => {
        const activity = activityMap.get(activityId);
        if (!activity) return;

        // ▼▼▼ [NEW] 올림 제거 - 소수점 그대로 사용 (2025-11-06) ▼▼▼
        // 최소값은 0.25일 (1/4일)
        const actualDuration = Math.max(0.25, totalDuration);
        // ▲▲▲ [NEW] 여기까지 ▲▲▲

        // ▼▼▼ [수정] 액티비티별 캘린더 찾기 (없으면 메인 캘린더 사용) ▼▼▼
        let taskCalendar = mainCalendar;
        if (activity.work_calendar) {
            taskCalendar = projectCalendars.find(cal => cal.id === activity.work_calendar) || mainCalendar;
        }

        // 기본 start/end 설정 (나중에 calculateTaskDates에서 재계산)
        // NOTE: addWorkingDays는 정수만 처리하므로 여기서는 임시로 올림
        const defaultStart = new Date(projectStartDate);
        const tempDuration = Math.ceil(actualDuration);
        const defaultEnd = addWorkingDays(defaultStart, tempDuration, taskCalendar);
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        tasks.push({
            id: activityId,
            name: `${activity.code} - ${activity.name}`,
            start: formatDateForGantt(defaultStart),
            end: formatDateForGantt(defaultEnd),
            activityId: activityId,
            activity: activity,
            durationDays: actualDuration, // ▼▼▼ [NEW] 소수점 포함 실제 일수 ▼▼▼
            progress: 0,
            custom_class: `activity-${activity.code}`,
            calendar: taskCalendar, // ▼▼▼ [추가] 캘린더 정보 ▼▼▼
            startOffset: 0, // ▼▼▼ [NEW] 시작 오프셋 (0~1, 하루의 일부) ▼▼▼
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

    // ▼▼▼ [디버깅] 의존성 데이터 출력 (2025-11-06) ▼▼▼
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[DEBUG] calculateTaskDates 시작');
    console.log('[DEBUG] 총 태스크 수:', tasks.length);
    console.log('[DEBUG] 총 의존성 수:', dependencies.length);
    console.log('[DEBUG] 의존성 데이터:', dependencies.map(dep => ({
        선행: activityMap.get(dep.predecessor_activity)?.code || dep.predecessor_activity,
        후행: activityMap.get(dep.successor_activity)?.code || dep.successor_activity,
        lag: dep.lag_days,
        type: dep.dependency_type
    })));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    // ▲▲▲ [디버깅] 여기까지 ▲▲▲

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
                return {
                    date: new Date(projectStartDate),
                    offset: 0
                };
            }
            visited.add(activityId);

            // 선행 의존성 찾기
            const predecessors = dependencies.filter(dep => dep.successor_activity === activityId);

            if (predecessors.length === 0) {
                // 선행 작업이 없으면 프로젝트 시작일 (오프셋 0)
                return {
                    date: new Date(projectStartDate),
                    offset: 0
                };
            }

            // 모든 선행 작업의 종료일 중 가장 늦은 날짜 (오프셋 포함)
            let maxEndDate = {
                date: new Date(projectStartDate),
                offset: 0
            };

            predecessors.forEach(dep => {
                console.log(`[DEBUG][getEarliestStartDate] Processing predecessor:`, dep.predecessor_activity);
                const predTasks = tasksByActivity.get(dep.predecessor_activity) || [];
                console.log(`[DEBUG][getEarliestStartDate] Found predTasks:`, predTasks.length);

                if (predTasks.length > 0) {
                    const predTask = predTasks[0];

                    // ▼▼▼ [추가] 선행 작업의 수동 시작일 확인 ▼▼▼
                    let predStartDate;
                    if (predTask.activity && predTask.activity.manual_start_date) {
                        // 선행 작업에 수동 시작일이 있으면 사용
                        predStartDate = new Date(predTask.activity.manual_start_date);
                        console.log(`[DEBUG][getEarliestStartDate] Using manual start date:`, predStartDate);
                    } else {
                        // 없으면 재귀적으로 계산
                        console.log(`[DEBUG][getEarliestStartDate] Recursively calculating for:`, dep.predecessor_activity);
                        const predResult = getEarliestStartDate(dep.predecessor_activity, new Set(visited));
                        console.log(`[DEBUG][getEarliestStartDate] Recursive result:`, predResult);
                        predStartDate = predResult.date || predResult;
                    }
                    // ▲▲▲ [추가] 여기까지 ▲▲▲

                    // ▼▼▼ [수정] 선행 작업의 종료일 계산 (작업일 기준) ▼▼▼
                    const predDuration = predTask.durationDays || 1;
                    const predCalendar = predTask.calendar || mainCalendar;

                    // 선행 작업의 종료 오프셋 계산
                    const predEndOffset = predDuration % 1; // 소수점 부분

                    // 종료일 계산
                    // addWorkingDays는 시작일을 Day 1로 카운트함
                    // 예: 13.57일 작업 → Math.ceil(13.57) = 14 → 14일째 날을 반환
                    //     → 그 날의 57% 지점에서 끝남
                    // 하지만 우리는 Math.floor를 써야 하고, 그 다음 날을 가리켜야 함
                    // 예: 13.57일 → Math.floor(13.57) = 13 → 13일 후 날짜 = 11/24
                    //     하지만 실제로는 14일째 날(11/25)의 57% 지점
                    const predCeiledDays = Math.ceil(predDuration);
                    const predEndDate = addWorkingDays(predStartDate, predCeiledDays, predCalendar);
                    // ▲▲▲ [수정] 여기까지 ▲▲▲

                    // ▼▼▼ [NEW] Lag 적용 로직 완전 재작성 ▼▼▼
                    const lagDays = parseFloat(dep.lag_days || 0);

                    let successorStartDate;
                    let successorStartOffset;

                    if (lagDays === 0) {
                        // Lag = 0: 선행 종료 직후 시작
                        if (predEndOffset === 0) {
                            // 선행이 정확히 끝난 경우 → 다음 작업일
                            successorStartDate = addWorkingDays(predEndDate, 0, predCalendar);
                            successorStartOffset = 0;
                        } else {
                            // 선행이 하루 중간에 끝난 경우 → 같은 날 이어서 시작
                            successorStartDate = predEndDate;
                            successorStartOffset = predEndOffset;
                        }
                    } else if (lagDays > 0) {
                        // Lag > 0: N 작업일 후 시작 (오프셋 유지!)
                        // 예: 선행이 11/25 57% 끝, Lag=1
                        //     → 1 작업일 후 = 11/26의 57% 시작
                        const wholeLagDays = Math.floor(lagDays);
                        if (predEndOffset === 0) {
                            // 선행이 정확히 끝난 경우 → N 작업일 후, 오프셋 0
                            successorStartDate = addWorkingDays(predEndDate, wholeLagDays, predCalendar);
                            successorStartOffset = 0;
                        } else {
                            // 선행이 중간에 끝난 경우 → N+1 작업일 후의 같은 오프셋
                            successorStartDate = addWorkingDays(predEndDate, wholeLagDays + 1, predCalendar);
                            successorStartOffset = predEndOffset;
                        }
                    } else {
                        // Lag < 0: 음수 lag (선행 종료 전에 시작)
                        const wholeLagDays = Math.floor(lagDays);
                        successorStartDate = addWorkingDays(predEndDate, wholeLagDays, predCalendar);
                        successorStartOffset = 0;
                    }

                    const adjustedDate = successorStartDate;
                    // ▲▲▲ [NEW] 여기까지 ▲▲▲

                    // maxEndDate 업데이트 시 오프셋도 함께 전달
                    if (adjustedDate > maxEndDate.date ||
                        (adjustedDate.getTime() === maxEndDate.date?.getTime() && successorStartOffset > maxEndDate.offset)) {
                        maxEndDate = {
                            date: adjustedDate,
                            offset: successorStartOffset
                        };
                    }
                    // ▲▲▲ [NEW] 여기까지 ▲▲▲
                    // ▲▲▲ [SIMPLIFIED] 여기까지 ▲▲▲

                    // ▼▼▼ [디버깅] 선행 작업 계산 상세 정보 (2025-11-06) ▼▼▼
                    console.log(`[DEBUG] 의존성 계산:`, {
                        선행작업: predTask.activity?.code || predTask.name,
                        선행시작일: predStartDate.toISOString().split('T')[0],
                        선행일수: predDuration,
                        선행종료일: predEndDate.toISOString().split('T')[0],
                        선행종료오프셋: predEndOffset.toFixed(2),
                        Lag원본: dep.lag_days,
                        Lag값: lagDays,
                        후행시작일: successorStartDate.toISOString().split('T')[0],
                        후행시작오프셋: successorStartOffset.toFixed(2),
                        캘린더: predCalendar?.name || '메인'
                    });
                    // ▲▲▲ [디버깅] 여기까지 ▲▲▲
                }
            });

            return maxEndDate;
        }

        // 각 태스크의 시작일/종료일 재설정
        tasks.forEach(task => {
            try {
                // ▼▼▼ [추가] 수동 시작일이 설정된 경우 해당 날짜 사용 ▼▼▼
                let startDate;
                let startOffset = 0;
                if (task.activity && task.activity.manual_start_date) {
                    // 수동 시작일이 있으면 해당 날짜를 사용 (의존성 무시)
                    startDate = new Date(task.activity.manual_start_date);
                    console.log(`[Gantt] Activity ${task.activity.code} using manual start date: ${task.activity.manual_start_date}`);
                } else {
                    // 수동 시작일이 없으면 의존성 기반으로 계산
                    const result = getEarliestStartDate(task.activityId);
                    if (result.date) {
                        // 새로운 형식 (오프셋 포함)
                        startDate = result.date;
                        startOffset = result.offset || 0;
                    } else {
                        // 이전 형식 (Date 객체만)
                        startDate = result;
                        startOffset = 0;
                    }
                }
                task.startOffset = startOffset; // 태스크에 오프셋 저장
                // ▲▲▲ [추가] 여기까지 ▲▲▲

                // ▼▼▼ [수정] 작업일 기준으로 종료일 계산 ▼▼▼
                const taskCalendar = task.calendar || mainCalendar;
                const endDate = addWorkingDays(startDate, task.durationDays, taskCalendar);
                // ▲▲▲ [수정] 여기까지 ▲▲▲

                // ▼▼▼ [디버깅] 최종 날짜 설정 정보 (2025-11-06) ▼▼▼
                console.log(`[DEBUG] 최종 날짜 설정:`, {
                    액티비티: task.activity?.code || task.name,
                    시작일: startDate.toISOString().split('T')[0],
                    일수: task.durationDays,
                    종료일: endDate.toISOString().split('T')[0],
                    수동시작일: task.activity?.manual_start_date || '없음',
                    캘린더: taskCalendar?.name || '메인'
                });
                // ▲▲▲ [디버깅] 여기까지 ▲▲▲

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
 * @param {Array} tasks - 간트차트 작업 목록
 * @param {string} containerId - 렌더링할 컨테이너 ID (기본값: 'gantt-chart-container')
 */
function renderGanttChart(tasks, containerId = 'gantt-chart-container') {
    const chartContainer = document.getElementById(containerId);

    if (!chartContainer) {
        console.error('[Gantt Chart] Container element not found:', containerId);
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

    // 표시 모드 가져오기
    const viewModeSelect = document.getElementById('gantt-view-mode');
    const viewMode = viewModeSelect ? viewModeSelect.value : 'Week';
    console.log('[Gantt Chart] Rendering', validTasks.length, 'valid tasks in', viewMode, 'mode');

    try {
        // 날짜 범위 계산
        const allDates = validTasks.flatMap(t => [new Date(t.start), new Date(t.end)]);
        const minDate = new Date(Math.min(...allDates));
        const maxDate = new Date(Math.max(...allDates));
        const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));

        // 전역 변수에 저장 (대시보드에서도 접근 가능하도록 window에 노출)
        ganttMinDate = minDate;
        ganttMaxDate = maxDate;
        window.ganttMinDate = minDate;
        window.ganttMaxDate = maxDate;

        // 요일 한글 변환
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

        // ▼▼▼ 표시 모드에 따라 날짜 배열 및 그룹화 생성 ▼▼▼
        let dateArray = [];
        let headerGroups = [];
        let cellData = [];

        if (viewMode === 'Day') {
            // 일 단위: 기존 방식
            const monthGroups = [];
            let currentMonth = null;
            let monthDayCount = 0;

            for (let i = 0; i <= totalDays; i++) {
                const date = new Date(minDate);
                date.setDate(date.getDate() + i);
                dateArray.push(date);

                const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
                if (currentMonth !== monthKey) {
                    if (currentMonth !== null) {
                        monthGroups.push({ month: currentMonth, count: monthDayCount });
                    }
                    currentMonth = monthKey;
                    monthDayCount = 1;
                } else {
                    monthDayCount++;
                }
            }
            if (currentMonth !== null) {
                monthGroups.push({ month: currentMonth, count: monthDayCount });
            }
            headerGroups = monthGroups;
            cellData = dateArray;

        } else if (viewMode === 'Week') {
            // 주 단위
            const weekGroups = [];
            let weekStart = new Date(minDate);
            let weekIndex = 0;

            while (weekStart <= maxDate) {
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);

                weekGroups.push({
                    index: weekIndex++,
                    start: new Date(weekStart),
                    end: weekEnd > maxDate ? new Date(maxDate) : weekEnd,
                    days: Math.min(7, Math.ceil((Math.min(weekEnd, maxDate) - weekStart) / (1000 * 60 * 60 * 24)) + 1)
                });

                weekStart.setDate(weekStart.getDate() + 7);
            }

            headerGroups = weekGroups;
            cellData = weekGroups;

        } else if (viewMode === 'Month') {
            // 월 단위
            const monthGroups = [];
            let currentDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);

            while (currentDate <= maxDate) {
                const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                const actualEnd = monthEnd > maxDate ? maxDate : monthEnd;
                const daysInMonth = Math.ceil((actualEnd - Math.max(currentDate, minDate)) / (1000 * 60 * 60 * 24)) + 1;

                monthGroups.push({
                    year: currentDate.getFullYear(),
                    month: currentDate.getMonth() + 1,
                    start: new Date(Math.max(currentDate, minDate)),
                    end: actualEnd,
                    days: daysInMonth
                });

                currentDate.setMonth(currentDate.getMonth() + 1);
            }

            headerGroups = monthGroups;
            cellData = monthGroups;
        }

        // 전역 변수에 저장
        ganttDateArray = dateArray;
        // ▲▲▲ 표시 모드 처리 끝 ▲▲▲

        // HTML 헤더 생성 (viewMode에 따라 다르게)
        let headerHtml = '';

        if (viewMode === 'Day') {
            headerHtml = `
                <!-- 첫 번째 헤더 행: 월 표시 -->
                <tr style="background: #e8e8e8; border-bottom: 1px solid #ccc;">
                    <th rowspan="2" style="padding: 10px; text-align: left; min-width: 250px; position: sticky; left: 0; background: #e8e8e8; z-index: 11; border-right: 2px solid #ccc;">태스크명</th>
                    <th rowspan="2" style="padding: 10px; text-align: center; min-width: 150px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">작업 캘린더</th>
                    <th rowspan="2" style="padding: 10px; text-align: center; min-width: 80px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">기간(일)</th>
                    <th rowspan="2" style="padding: 10px; text-align: center; min-width: 100px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">시작일</th>
                    <th rowspan="2" style="padding: 10px; text-align: center; min-width: 100px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">종료일</th>
                    ${headerGroups.map(mg => {
                        const [year, month] = mg.month.split('-');
                        return `<th colspan="${mg.count}" style="padding: 5px; text-align: center; background: #d0d0d0; border-right: 1px solid #999;">${year}년 ${month}월</th>`;
                    }).join('')}
                </tr>
                <!-- 두 번째 헤더 행: 일/요일 표시 -->
                <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                    ${cellData.map((date, idx) => {
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
                </tr>`;
        } else if (viewMode === 'Week') {
            headerHtml = `
                <tr style="background: #e8e8e8; border-bottom: 2px solid #ddd;">
                    <th style="padding: 10px; text-align: left; min-width: 250px; position: sticky; left: 0; background: #e8e8e8; z-index: 11; border-right: 2px solid #ccc;">태스크명</th>
                    <th style="padding: 10px; text-align: center; min-width: 150px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">작업 캘린더</th>
                    <th style="padding: 10px; text-align: center; min-width: 80px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">기간(일)</th>
                    <th style="padding: 10px; text-align: center; min-width: 100px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">시작일</th>
                    <th style="padding: 10px; text-align: center; min-width: 100px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">종료일</th>
                    ${cellData.map((week, idx) => {
                        const startStr = `${week.start.getMonth()+1}/${week.start.getDate()}`;
                        const endStr = `${week.end.getMonth()+1}/${week.end.getDate()}`;
                        const weekEndDate = week.end.toISOString().split('T')[0];
                        const isSelectedDate = costCutoffDate && weekEndDate === costCutoffDate.toISOString().split('T')[0];
                        const bgColor = isSelectedDate ? '#ffd700' : '#d0d0d0';
                        return `<th class="gantt-date-cell" data-date="${weekEndDate}" style="padding: 5px; text-align: center; min-width: 60px; background: ${bgColor}; border-right: 1px solid #999; font-size: 11px; cursor: pointer;">
                            <div>W${idx+1}</div>
                            <div style="font-size: 10px; font-weight: normal;">${startStr}~${endStr}</div>
                        </th>`;
                    }).join('')}
                </tr>`;
        } else if (viewMode === 'Month') {
            headerHtml = `
                <tr style="background: #e8e8e8; border-bottom: 2px solid #ddd;">
                    <th style="padding: 10px; text-align: left; min-width: 250px; position: sticky; left: 0; background: #e8e8e8; z-index: 11; border-right: 2px solid #ccc;">태스크명</th>
                    <th style="padding: 10px; text-align: center; min-width: 150px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">작업 캘린더</th>
                    <th style="padding: 10px; text-align: center; min-width: 80px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">기간(일)</th>
                    <th style="padding: 10px; text-align: center; min-width: 100px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">시작일</th>
                    <th style="padding: 10px; text-align: center; min-width: 100px; background: #e8e8e8; z-index: 10; border-right: 2px solid #ccc;">종료일</th>
                    ${cellData.map(month => {
                        const monthEndDate = month.end.toISOString().split('T')[0];
                        const isSelectedDate = costCutoffDate && monthEndDate === costCutoffDate.toISOString().split('T')[0];
                        const bgColor = isSelectedDate ? '#ffd700' : '#d0d0d0';
                        return `<th class="gantt-date-cell" data-date="${monthEndDate}" style="padding: 5px; text-align: center; min-width: 80px; background: ${bgColor}; border-right: 1px solid #999; cursor: pointer;">
                            ${month.year}년 ${month.month}월
                        </th>`;
                    }).join('')}
                </tr>`;
        }

        // HTML 생성
        let html = `
            <div style="overflow-x: auto; background: white; border-radius: 8px; padding: 20px;">
                <table class="gantt-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        ${headerHtml}
                    </thead>
                    <tbody>
        `;

        validTasks.forEach((task, index) => {
            const startDate = new Date(task.start);
            const endDate = new Date(task.end);
            // ▼▼▼ [수정] 간트차트 셀 범위 계산 - 시작일과 종료일을 달력상 날짜로 계산 (2025-11-06) ▼▼▼
            // 달력상 날짜 차이로 계산 (작업일이 아닌 모든 날짜 포함)
            const taskStartDay = Math.floor((startDate - minDate) / (1000 * 60 * 60 * 24));
            const taskEndDay = Math.floor((endDate - minDate) / (1000 * 60 * 60 * 24)) + 1; // 종료일 포함

            console.log(`[DEBUG][Gantt Render] ${task.name}: start=${task.start} (Day ${taskStartDay}), end=${task.end} (Day ${taskEndDay - 1}), span=${taskEndDay - taskStartDay} days`);
            // ▲▲▲ [수정] 여기까지 ▲▲▲

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

            // 날짜/주/월별 셀 생성 및 태스크 바 표시 (viewMode에 따라 다름)
            if (viewMode === 'Day') {
                // Day 모드: 일 단위 셀
                cellData.forEach((date, dayIndex) => {
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
                        const isFirstDay = dayIndex === taskStartDay;
                        const isLastDay = dayIndex === taskEndDay - 1;
                        const taskCalendar = task.calendar || mainCalendar;
                        const isWorkDay = isWorkingDay(date, taskCalendar);

                        // 프로그레스 바 형태로 소수점 표현
                        // 각 날짜에서 얼마나 채울지 계산 (0% ~ 100%)
                        let fillPercentage = 100; // 기본값: 전체 칠함
                        let fillStart = 0; // 채우기 시작 위치 (기본: 0%)

                        if (isFirstDay && isLastDay) {
                            // 첫날이자 마지막날 (duration < 1)
                            fillStart = (task.startOffset || 0) * 100;
                            fillPercentage = task.durationDays * 100;
                        } else if (isFirstDay) {
                            // 첫날: startOffset부터 시작해서 끝까지
                            fillStart = (task.startOffset || 0) * 100;
                            fillPercentage = 100 - fillStart;
                        } else if (isLastDay) {
                            // 마지막날: 처음부터 남은 duration만큼 채움
                            // 예: 시작 11/26 오프셋 0.57, 6.93일 작업
                            //     → 첫날 0.43일 소진, 남은 6.50일
                            //     → 12/4에서 0.50만큼 채워짐

                            // CRITICAL: Count working days, not calendar days
                            let daysFromStart = 0;
                            let current = new Date(startDate);
                            const taskCalendar = task.calendar || mainCalendar;
                            while (current < date) {
                                if (isWorkingDay(current, taskCalendar)) {
                                    daysFromStart++;
                                }
                                current.setDate(current.getDate() + 1);
                            }

                            // 첫날 오프셋 고려: 첫날에는 (1 - startOffset)만큼만 작업
                            const startOffset = task.startOffset || 0;
                            const effectiveDaysFromStart = startOffset > 0
                                ? daysFromStart - startOffset  // 첫날 오프셋만큼 차감
                                : daysFromStart;

                            const remainingDuration = task.durationDays - effectiveDaysFromStart;
                            fillPercentage = Math.min(100, remainingDuration * 100);  // 100% 초과 방지
                            fillStart = 0; // 처음부터 시작

                            console.log(`[DEBUG][LastDay] ${task.name} Day ${dayIndex}: workingDays=${daysFromStart}, startOffset=${startOffset.toFixed(2)}, effectiveDays=${effectiveDaysFromStart.toFixed(2)}, remainingDuration=${remainingDuration.toFixed(2)}, fillPercentage=${fillPercentage.toFixed(1)}%`);
                        }
                        // 중간날: fillStart=0, fillPercentage=100 (전체)

                        // 라운딩 처리
                        let borderRadius = '';
                        if (isFirstDay && isLastDay) {
                            borderRadius = 'border-radius: 4px;';
                        } else if (isFirstDay) {
                            borderRadius = 'border-radius: 4px 0 0 4px;';
                        } else if (isLastDay) {
                            borderRadius = 'border-radius: 0 4px 4px 0;';
                        }

                        // 프로그레스 바 스타일
                        let barStyle;
                        if (isWorkDay) {
                            // 작업일: 실제 색상으로 채움
                            barStyle = `
                                background: linear-gradient(to right,
                                    rgba(0,0,0,0.05) 0%,
                                    rgba(0,0,0,0.05) ${fillStart}%,
                                    ${barColor} ${fillStart}%,
                                    ${barColor} ${fillStart + fillPercentage}%,
                                    rgba(0,0,0,0.05) ${fillStart + fillPercentage}%,
                                    rgba(0,0,0,0.05) 100%);
                                height: 30px;
                                margin: 5px 0;
                                ${borderRadius}
                            `;
                        } else {
                            // 휴일: 테두리만 표시
                            barStyle = `
                                background: linear-gradient(to right,
                                    transparent 0%,
                                    transparent ${fillStart}%,
                                    white ${fillStart}%,
                                    white ${fillStart + fillPercentage}%,
                                    transparent ${fillStart + fillPercentage}%,
                                    transparent 100%);
                                border: 2px solid ${barColor};
                                height: 26px;
                                margin: 5px 0;
                                box-sizing: border-box;
                                ${borderRadius}
                            `;
                        }

                        const middleDay = Math.floor((taskStartDay + taskEndDay) / 2);
                        const showDuration = dayIndex === middleDay && task.durationDays >= 3;
                        const holidayMark = !isWorkDay ? '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 10px; color: #999; z-index: 10;">휴</div>' : '';

                        cellContent = `
                            <div style="${barStyle}"
                                 title="액티비티: ${activity.code} - ${activity.name}
총 작업기간: ${task.durationDays}일
단위수량당 소요일수: ${activity.duration_per_unit || 0}일
이 날 채움: ${fillStart.toFixed(1)}% ~ ${(fillStart + fillPercentage).toFixed(1)}%
시작 오프셋: ${(task.startOffset || 0).toFixed(2)}
${!isWorkDay ? '※ 캘린더상 휴일' : ''}
${activity.responsible_person ? '담당자: ' + activity.responsible_person : ''}">
                            </div>
                            ${holidayMark}
                            ${showDuration ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: ${isWorkDay ? 'white' : barColor}; font-size: 11px; font-weight: bold; z-index: 10;">${task.durationDays}일</div>` : ''}
                        `;
                    }

                    html += `<td class="gantt-date-cell" data-date="${dateString}" style="${cellStyle}">${cellContent}</td>`;
                });

            } else if (viewMode === 'Week') {
                // Week 모드: 주 단위 셀
                cellData.forEach((week, weekIndex) => {
                    const weekStart = week.start;
                    const weekEnd = week.end;

                    // 태스크가 이 주에 걸쳐있는지 확인
                    const taskOverlapsWeek = !(endDate < weekStart || startDate > weekEnd);

                    let cellBgColor = isSelected ? '#e3f2fd' : bgColor;
                    let cellContent = '';
                    let cellStyle = `padding: 5px; text-align: center; min-width: 60px; background: ${cellBgColor}; border-right: 1px solid #ddd; position: relative;`;

                    if (taskOverlapsWeek) {
                        let barStyle = `background: ${barColor}; height: 30px; margin: 5px; border-radius: 4px;`;
                        cellContent = `<div style="${barStyle}" title="액티비티: ${activity.code} - ${activity.name}"></div>`;
                    }

                    html += `<td style="${cellStyle}">${cellContent}</td>`;
                });

            } else if (viewMode === 'Month') {
                // Month 모드: 월 단위 셀
                cellData.forEach((month, monthIndex) => {
                    const monthStart = month.start;
                    const monthEnd = month.end;

                    // 태스크가 이 월에 걸쳐있는지 확인
                    const taskOverlapsMonth = !(endDate < monthStart || startDate > monthEnd);

                    let cellBgColor = isSelected ? '#e3f2fd' : bgColor;
                    let cellContent = '';
                    let cellStyle = `padding: 5px; text-align: center; min-width: 80px; background: ${cellBgColor}; border-right: 1px solid #ddd; position: relative;`;

                    if (taskOverlapsMonth) {
                        let barStyle = `background: ${barColor}; height: 30px; margin: 5px; border-radius: 4px;`;
                        cellContent = `<div style="${barStyle}" title="액티비티: ${activity.code} - ${activity.name}"></div>`;
                    }

                    html += `<td style="${cellStyle}">${cellContent}</td>`;
                });
            }

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

    // 상단 Activity 단위 3D 연동 컨트롤 표시
    const activityTask = ganttData.find(t => t.id === taskId);
    const controlsDiv = document.getElementById('gantt-activity-3d-controls');
    const activityNameSpan = document.getElementById('selected-activity-name');

    if (controlsDiv && activityTask && activityTask.activity) {
        controlsDiv.style.display = 'block';
        if (activityNameSpan) {
            const displayName = activityTask.activity.code
                ? `${activityTask.activity.code} - ${activityTask.activity.name || ''}`
                : activityTask.activity.name || `Activity ID: ${activityTask.activity.id}`;
            activityNameSpan.textContent = displayName;
        }
    } else if (controlsDiv) {
        // 선택 해제 시 숨김
        controlsDiv.style.display = 'none';
    }
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

    // ▼▼▼ [수정] 스크롤 위치 저장 ▼▼▼
    const chartContainer = document.getElementById('gantt-chart-container');
    let scrollLeft = 0;
    let scrollTop = 0;

    if (chartContainer) {
        const scrollableDiv = chartContainer.querySelector('div[style*="overflow"]');
        if (scrollableDiv) {
            scrollLeft = scrollableDiv.scrollLeft;
            scrollTop = scrollableDiv.scrollTop;
        }
    }
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // 간트차트 다시 렌더링 (선택된 날짜 하이라이트)
    renderGanttChart(ganttData);

    // ▼▼▼ [추가] 스크롤 위치 복원 ▼▼▼
    if (chartContainer) {
        const scrollableDiv = chartContainer.querySelector('div[style*="overflow"]');
        if (scrollableDiv) {
            scrollableDiv.scrollLeft = scrollLeft;
            scrollableDiv.scrollTop = scrollTop;
        }
    }
    // ▲▲▲ [추가] 여기까지 ▲▲▲

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
        selectedActivityObjectId = null;
        return;
    }

    // 선택된 태스크 찾기
    const selectedTask = ganttData.find(t => t.id === taskId);
    if (!selectedTask) {
        detailContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">선택된 태스크를 찾을 수 없습니다.</p>';
        return;
    }

    // 해당 액티비티에 할당된 모든 ActivityObject 찾기
    const relatedActivityObjects = window.loadedActivityObjects?.filter(ao =>
        ao.activity && ao.activity.id === taskId
    ) || [];

    if (relatedActivityObjects.length === 0) {
        detailContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">할당된 액티비티 객체가 없습니다.</p>';
        selectedActivityObjectId = null;
        return;
    }

    const activity = selectedTask.activity;

    // 기본적으로 첫 번째 항목 선택 (이전에 선택된 항목이 없으면)
    if (!selectedActivityObjectId || !relatedActivityObjects.find(ao => ao.id === selectedActivityObjectId)) {
        selectedActivityObjectId = relatedActivityObjects[0].id;
    }

    // 좌우 분할 레이아웃
    let html = `
        <div style="background: white; border-radius: 8px; padding: 20px; height: 100%; display: flex; flex-direction: column;">
            <h3 style="margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #6a1b9a; color: #6a1b9a; flex-shrink: 0;">
                ${activity.code} - ${activity.name} (액티비티 객체 상세)
            </h3>
            <!-- ActivityObject 단위 3D 연동 버튼 -->
            <div id="gantt-ao-3d-controls" style="margin-bottom: 15px; padding: 10px; background: #f3e5f5; border-radius: 4px; border: 1px solid #9c27b0; flex-shrink: 0;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px;">
                    <span style="font-weight: bold; color: #6a1b9a;">선택한 객체:</span>
                    <span id="selected-ao-name" style="color: #6a1b9a;">없음</span>
                    <div style="margin-left: auto; display: flex; gap: 6px;">
                        <button id="gantt-ao-select-in-client-btn" style="padding: 5px 10px; background: #9c27b0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;" disabled>BIM 저작도구에서 확인</button>
                        <button id="gantt-ao-select-in-3d-btn" style="padding: 5px 10px; background: #673ab7; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;" disabled>3D 뷰포트에서 확인</button>
                    </div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 350px 1fr; gap: 20px; flex: 1; min-height: 0;">
                <!-- 좌측: 액티비티 객체 목록 -->
                <div style="border-right: 2px solid #e0e0e0; padding-right: 20px; overflow: hidden; display: flex; flex-direction: column;">
                    <h4 style="margin: 0 0 10px 0; color: #666; font-size: 14px; flex-shrink: 0;">액티비티 객체 목록 (${relatedActivityObjects.length}개)</h4>
                    <div id="activity-object-list" style="overflow-y: scroll; overflow-x: hidden; flex: 1; min-height: 0;">
    `;

    // 좌측 액티비티 객체 리스트
    relatedActivityObjects.forEach((ao, index) => {
        const isSelected = ao.id === selectedActivityObjectId;
        const bgColor = isSelected ? '#f3e5f5' : (index % 2 === 0 ? '#ffffff' : '#f9f9f9');
        const borderColor = isSelected ? '#6a1b9a' : '#e0e0e0';
        // ▼▼▼ [수정] 개별 AO의 일수는 올림하지 않고 표시 (2025-11-06) ▼▼▼
        const durationDays = (ao.actual_duration || (parseFloat(activity.duration_per_unit || 0) * parseFloat(ao.quantity || 0))).toFixed(2);
        // ▲▲▲ [수정] 여기까지 ▲▲▲

        html += `
            <div class="activity-object-card" data-ao-id="${ao.id}"
                 style="padding: 12px; margin-bottom: 8px; background: ${bgColor}; border: 2px solid ${borderColor}; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                <div style="font-weight: bold; color: #6a1b9a; margin-bottom: 4px; font-size: 13px;">
                    ${ao.cost_code?.code || '-'}
                    ${ao.cost_code?.detail_code ? ' / ' + ao.cost_code.detail_code : ''}
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                    ${ao.cost_code?.name || '-'}
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #999; margin-bottom: 4px;">
                    <span>수량: ${ao.quantity ? parseFloat(ao.quantity).toFixed(2) : '-'}</span>
                    <span style="font-weight: bold; color: #6a1b9a;">${durationDays}일</span>
                </div>
                <div style="font-size: 10px; color: #999;">
                    ${ao.start_date || '-'} ~ ${ao.end_date || '-'}
                </div>
            </div>
        `;
    });

    html += `
                    </div>
                </div>
                <!-- 우측: 선택된 액티비티 객체의 상세 정보 -->
                <div style="padding-left: 10px; overflow: hidden; display: flex; flex-direction: column;">
                    <div id="activity-object-detail" style="overflow-y: scroll; overflow-x: hidden; flex: 1; min-height: 0;">
    `;

    // 우측 상세 정보
    html += renderActivityObjectDetail(selectedActivityObjectId);

    html += `
                    </div>
                </div>
            </div>
        </div>
    `;

    detailContainer.innerHTML = html;

    // 액티비티 객체 카드 클릭 이벤트 등록
    document.querySelectorAll('.activity-object-card').forEach(card => {
        card.addEventListener('click', function() {
            const aoId = this.getAttribute('data-ao-id');
            selectActivityObject(aoId);
        });

        // 호버 효과
        card.addEventListener('mouseenter', function() {
            if (this.getAttribute('data-ao-id') !== selectedActivityObjectId) {
                this.style.background = '#f5f5f5';
            }
        });

        card.addEventListener('mouseleave', function() {
            if (this.getAttribute('data-ao-id') !== selectedActivityObjectId) {
                const index = Array.from(this.parentNode.children).indexOf(this);
                this.style.background = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
            }
        });
    });
}

/**
 * 액티비티 객체 선택
 */
function selectActivityObject(aoId) {
    selectedActivityObjectId = aoId;
    // 상세 정보만 다시 렌더링
    renderTaskDetail(selectedTaskId);

    // 하단 ActivityObject 단위 3D 연동 버튼 활성화 및 이름 표시
    const ao = window.loadedActivityObjects?.find(obj => obj.id === aoId);
    const aoNameSpan = document.getElementById('selected-ao-name');
    const clientBtn = document.getElementById('gantt-ao-select-in-client-btn');
    const viewer3dBtn = document.getElementById('gantt-ao-select-in-3d-btn');

    if (ao && aoNameSpan) {
        const displayName = ao.cost_code?.code
            ? `${ao.cost_code.code} - ${ao.cost_code.name || ''}`
            : `AO ID: ${aoId}`;
        aoNameSpan.textContent = displayName;
    }

    // 버튼 활성화
    if (clientBtn) clientBtn.disabled = false;
    if (viewer3dBtn) viewer3dBtn.disabled = false;
}

/**
 * 액티비티 객체 상세 정보 렌더링 (Activity Object 탭과 동일한 형식)
 */
function renderActivityObjectDetail(aoId) {
    if (!aoId) {
        return '<p style="padding: 20px; text-align: center; color: #999;">액티비티 객체를 선택해주세요.</p>';
    }

    const ao = window.loadedActivityObjects?.find(obj => obj.id === aoId);
    if (!ao) {
        return '<p style="padding: 20px; text-align: center; color: #999;">액티비티 객체를 찾을 수 없습니다.</p>';
    }

    let html = '';

    // ============ 1. AO 기본 속성 ============
    html += '<div class="property-section" style="margin-bottom: 20px;">';
    html += '<h4 style="color: #6a1b9a; border-bottom: 2px solid #6a1b9a; padding-bottom: 5px; margin-bottom: 10px;">📅 액티비티 객체 기본 속성</h4>';
    html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><tbody>';
    html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold; width: 40%;">AO.id</td><td style="padding: 8px;">${ao.id || 'N/A'}</td></tr>`;
    html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">AO.start_date</td><td style="padding: 8px;">${ao.start_date || 'N/A'}</td></tr>`;
    html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">AO.end_date</td><td style="padding: 8px;">${ao.end_date || 'N/A'}</td></tr>`;
    html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">AO.actual_duration</td><td style="padding: 8px;">${ao.actual_duration || 'N/A'}</td></tr>`;
    html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">AO.quantity</td><td style="padding: 8px;">${ao.quantity}</td></tr>`;
    html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">AO.is_manual</td><td style="padding: 8px;">${ao.is_manual ? 'true' : 'false'}</td></tr>`;
    if (ao.manual_formula) {
        html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">AO.manual_formula</td><td style="padding: 8px;">${ao.manual_formula}</td></tr>`;
    }
    html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">AO.progress</td><td style="padding: 8px;">${ao.progress}%</td></tr>`;
    html += '</tbody></table>';
    html += '</div>';

    // ============ 2. Activity 속성 ============
    if (ao.activity) {
        html += '<div class="property-section" style="margin-bottom: 20px;">';
        html += '<h4 style="color: #d84315; border-bottom: 2px solid #d84315; padding-bottom: 5px; margin-bottom: 10px;">⚙️ 액티비티 코드 속성</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><tbody>';
        html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold; width: 40%;">Activity.code</td><td style="padding: 8px;">${ao.activity.code || 'N/A'}</td></tr>`;
        html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">Activity.name</td><td style="padding: 8px;">${ao.activity.name || 'N/A'}</td></tr>`;
        if (ao.activity.duration_per_unit !== null && ao.activity.duration_per_unit !== undefined) {
            html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">Activity.duration_per_unit</td><td style="padding: 8px;">${ao.activity.duration_per_unit}</td></tr>`;
        }
        if (ao.activity.responsible_person) {
            html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">Activity.responsible_person</td><td style="padding: 8px;">${ao.activity.responsible_person}</td></tr>`;
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    // ============ 3. CI 속성 (상속) ============
    if (ao.cost_item) {
        html += '<div class="property-section" style="margin-bottom: 20px;">';
        html += '<h4 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 5px; margin-bottom: 10px;">📊 산출항목 속성 (상속 from CI)</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><tbody>';
        html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold; width: 40%;">CI.id</td><td style="padding: 8px;">${ao.cost_item.id || 'N/A'}</td></tr>`;
        if (ao.cost_item.quantity !== undefined) {
            html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">CI.quantity</td><td style="padding: 8px;">${ao.cost_item.quantity}</td></tr>`;
        }
        if (ao.cost_item.description) {
            html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">CI.description</td><td style="padding: 8px;">${ao.cost_item.description}</td></tr>`;
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    // ============ 4. CostCode 속성 (상속) ============
    if (ao.cost_code) {
        html += '<div class="property-section" style="margin-bottom: 20px;">';
        html += '<h4 style="color: #c62828; border-bottom: 2px solid #c62828; padding-bottom: 5px; margin-bottom: 10px;">💰 공사코드 속성 (상속 from CostCode)</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><tbody>';
        html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold; width: 40%;">CostCode.code</td><td style="padding: 8px;">${ao.cost_code.code || 'N/A'}</td></tr>`;
        html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">CostCode.name</td><td style="padding: 8px;">${ao.cost_code.name || 'N/A'}</td></tr>`;
        if (ao.cost_code.detail_code) {
            html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">CostCode.detail_code</td><td style="padding: 8px;">${ao.cost_code.detail_code}</td></tr>`;
        }
        if (ao.cost_code.note) {
            html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">CostCode.note</td><td style="padding: 8px;">${ao.cost_code.note}</td></tr>`;
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    // ============ 5. QM 속성 (상속) ============
    if (ao.quantity_member) {
        html += '<div class="property-section" style="margin-bottom: 20px;">';
        html += '<h4 style="color: #0288d1; border-bottom: 2px solid #0288d1; padding-bottom: 5px; margin-bottom: 10px;">📌 수량산출부재 기본 속성 (상속 from QM)</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><tbody>';
        html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold; width: 40%;">QM.id</td><td style="padding: 8px;">${ao.quantity_member.id || 'N/A'}</td></tr>`;
        if (ao.quantity_member.name) {
            html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold;">QM.name</td><td style="padding: 8px;">${ao.quantity_member.name}</td></tr>`;
        }
        html += '</tbody></table>';
        html += '</div>';

        // QM properties
        if (ao.quantity_member.properties && Object.keys(ao.quantity_member.properties).length > 0) {
            html += '<div class="property-section" style="margin-bottom: 20px;">';
            html += '<h4 style="color: #f57c00; border-bottom: 2px solid #f57c00; padding-bottom: 5px; margin-bottom: 10px;">🔢 부재 속성 (상속 from QM)</h4>';
            html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><tbody>';
            for (const [key, value] of Object.entries(ao.quantity_member.properties)) {
                if (value !== null && value !== undefined) {
                    const displayValue = typeof value === 'number' ? value.toFixed(3) : value;
                    html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold; width: 40%;">QM.properties.${key}</td><td style="padding: 8px;">${displayValue}</td></tr>`;
                }
            }
            html += '</tbody></table>';
            html += '</div>';
        }
    }

    // ============ 6. MM 속성 (상속) ============
    if (ao.member_mark) {
        html += '<div class="property-section" style="margin-bottom: 20px;">';
        html += '<h4 style="color: #7b1fa2; border-bottom: 2px solid #7b1fa2; padding-bottom: 5px; margin-bottom: 10px;">📋 일람부호 (상속 from MM)</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><tbody>';
        if (ao.member_mark.mark) {
            html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold; width: 40%;">MM.mark</td><td style="padding: 8px;">${ao.member_mark.mark}</td></tr>`;
        }
        if (ao.member_mark.properties && Object.keys(ao.member_mark.properties).length > 0) {
            for (const [key, value] of Object.entries(ao.member_mark.properties)) {
                if (value !== null && value !== undefined) {
                    html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold; width: 40%;">MM.properties.${key}</td><td style="padding: 8px;">${value}</td></tr>`;
                }
            }
        }
        html += '</tbody></table>';
        html += '</div>';
    }

    // ============ 7. BIM 속성 (상속) - 축약 버전 ============
    if (ao.raw_data) {
        // BIM 시스템 속성
        html += '<div class="property-section" style="margin-bottom: 20px;">';
        html += '<h4 style="color: #00796b; border-bottom: 2px solid #00796b; padding-bottom: 5px; margin-bottom: 10px;">🏗️ BIM 시스템 속성 (상속 from BIM)</h4>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><tbody>';

        const basicAttrs = ['Name', 'IfcClass', 'ElementId', 'UniqueId'];
        basicAttrs.forEach(attr => {
            if (ao.raw_data[attr] !== undefined && ao.raw_data[attr] !== null) {
                html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold; width: 40%;">BIM.Attributes.${attr}</td><td style="padding: 8px;">${ao.raw_data[attr]}</td></tr>`;
            }
        });
        html += '</tbody></table>';
        html += '</div>';

        // BIM Parameters (최대 10개만 표시)
        if (ao.raw_data.Parameters && typeof ao.raw_data.Parameters === 'object' && Object.keys(ao.raw_data.Parameters).length > 0) {
            html += '<div class="property-section" style="margin-bottom: 20px;">';
            html += '<h4 style="color: #00897b; border-bottom: 2px solid #00897b; padding-bottom: 5px; margin-bottom: 10px;">🔧 BIM 파라메터 (상속, 최대 10개)</h4>';
            html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><tbody>';
            const params = Object.entries(ao.raw_data.Parameters).slice(0, 10);
            for (const [key, value] of params) {
                if (key === 'Geometry') continue;
                if (value !== null && value !== undefined) {
                    const displayValue = (typeof value === 'object')
                        ? JSON.stringify(value).substring(0, 50)
                        : String(value).substring(0, 100);
                    html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; background: #f5f5f5; font-weight: bold; width: 40%;">BIM.Parameters.${key}</td><td style="padding: 8px; word-break: break-all;">${displayValue}</td></tr>`;
                }
            }
            html += '</tbody></table>';
            html += '</div>';
        }
    }

    return html;
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

    // ▼▼▼ 공정표 3D 연동 버튼 이벤트 리스너 ▼▼▼
    // 상단: Activity 단위 연동
    document.getElementById('gantt-activity-select-in-client-btn')?.addEventListener('click', ganttActivitySelectInClient);
    document.getElementById('gantt-activity-select-in-3d-btn')?.addEventListener('click', ganttActivitySelectIn3D);

    // 하단: ActivityObject 단위 연동 (delegated events - renderTaskDetail에서 동적 생성되므로)
    document.addEventListener('click', function(e) {
        if (e.target.id === 'gantt-ao-select-in-client-btn') {
            ganttAoSelectInClient();
        } else if (e.target.id === 'gantt-ao-select-in-3d-btn') {
            ganttAoSelectIn3D();
        }
    });
    // ▲▲▲ 공정표 3D 연동 버튼 이벤트 리스너 끝 ▲▲▲

    // ▼▼▼ 공정표 스플릿바 드래그 기능 ▼▼▼
    const ganttTopSection = document.getElementById('gantt-top-section');
    const ganttBottomSection = document.getElementById('gantt-bottom-section');
    const ganttResizeHandle = document.getElementById('gantt-resize-handle');

    if (ganttResizeHandle && ganttTopSection && ganttBottomSection) {
        let isResizing = false;
        let startY = 0;
        let startTopHeight = 0;
        let startBottomHeight = 0;

        ganttResizeHandle.addEventListener('mousedown', function(e) {
            // 하단이 접혀있으면 드래그 불가
            const ganttBottomContent = document.getElementById('gantt-bottom-content');
            if (!ganttBottomContent || ganttBottomContent.style.display === 'none') {
                return;
            }

            isResizing = true;
            startY = e.clientY;
            startTopHeight = ganttTopSection.offsetHeight;
            startBottomHeight = ganttBottomSection.offsetHeight;
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
            if (!isResizing) return;

            const deltaY = e.clientY - startY;
            let newTopHeight = startTopHeight + deltaY;
            let newBottomHeight = startBottomHeight - deltaY;

            // 최소 높이 제한
            if (newTopHeight < 200) newTopHeight = 200;
            if (newBottomHeight < 100) newBottomHeight = 100;

            // 최소 높이를 만족하면 크기 조정
            if (newTopHeight >= 200 && newBottomHeight >= 100) {
                ganttTopSection.style.flex = `1 1 ${newTopHeight}px`;
                ganttBottomSection.style.flex = `0 0 ${newBottomHeight}px`;
            }
        });

        document.addEventListener('mouseup', function() {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
    // ▲▲▲ 공정표 스플릿바 드래그 기능 끝 ▲▲▲

    // ▼▼▼ 공정표 하단 섹션 토글 기능 ▼▼▼
    const ganttBottomToggleHeader = document.getElementById('gantt-bottom-toggle-header');
    const ganttBottomContent = document.getElementById('gantt-bottom-content');
    const ganttBottomToggleIcon = document.getElementById('gantt-bottom-toggle-icon');

    if (ganttBottomToggleHeader && ganttBottomContent && ganttBottomToggleIcon && ganttTopSection && ganttBottomSection) {
        ganttBottomToggleHeader.addEventListener('click', function() {
            const isCurrentlyOpen = ganttBottomContent.style.display !== 'none';

            if (isCurrentlyOpen) {
                // 접기
                ganttBottomContent.style.display = 'none';
                ganttBottomToggleIcon.textContent = '▼';
                ganttBottomSection.style.flex = '0 0 50px';
                ganttTopSection.style.flex = '1 1 auto';
            } else {
                // 펼치기 - 전체 높이의 40% 정도로 설정
                const ganttContainer = ganttTopSection.parentElement;
                const totalHeight = ganttContainer.offsetHeight;
                const bottomHeight = Math.max(300, Math.floor(totalHeight * 0.4)); // 최소 300px

                ganttBottomContent.style.display = 'flex';
                ganttBottomToggleIcon.textContent = '▲';
                ganttBottomSection.style.flex = `0 0 ${bottomHeight}px`;
                ganttTopSection.style.flex = '1 1 auto';
            }
        });
    }
    // ▲▲▲ 공정표 하단 섹션 토글 기능 끝 ▲▲▲

    console.log('[Gantt Chart] Event listeners registered');
});

// navigation.js에서 탭 전환 시 간트차트 로드하도록 전역 함수 제공
window.loadGanttChart = loadAndRenderGanttChart;
// 시뮬레이션 탭에서 캘린더 기반 작업일 체크를 위해 전역 노출
window.isWorkingDay = isWorkingDay;
// mainCalendar를 전역으로 노출 (시뮬레이션 탭에서 접근 가능하도록)
Object.defineProperty(window, 'mainCalendar', {
    get: () => mainCalendar,
    set: (value) => { mainCalendar = value; }
});
// 대시보드에서 간트차트 날짜 계산 로직 재사용을 위해 전역 노출
window.generateGanttData = generateGanttData;
window.calculateTaskDates = calculateTaskDates;
window.loadProjectCalendars = loadProjectCalendars;

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

        // ▼▼▼ [수정] 서버에서 enriched cost items 로드 (2025-11-05) ▼▼▼
        // 액티비티에 연결된 산출항목 수집
        const activityIds = new Set(activeActivities.map(a => a.activityId));

        // 서버에서 enriched cost items 가져오기 (CostCode 필드 포함)
        const response = await fetch(`/connections/api/cost-items/${currentProjectId}/`);
        if (!response.ok) throw new Error('산출항목 데이터를 불러오는데 실패했습니다.');

        const allEnrichedCostItems = await response.json();
        console.log('[BOQ Summary] Loaded enriched cost items:', allEnrichedCostItems.length);

        // ganttCostItems에서 활동 ID 정보 가져오기
        const costItemActivitiesMap = new Map();
        ganttCostItems.forEach(item => {
            if (item.activities) {
                costItemActivitiesMap.set(item.id, item.activities);
            }
        });

        // enriched cost items에 활동 정보 추가하고 필터링
        const relevantCostItems = allEnrichedCostItems
            .map(item => ({
                ...item,
                activities: costItemActivitiesMap.get(item.id) || []
            }))
            .filter(item =>
                item.activities.some(actId => activityIds.has(actId))
            );
        // ▲▲▲ [수정] 여기까지 ▲▲▲

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

    // ▼▼▼ [수정] CostItem 자체에 있는 공사코드 정보 사용 (2025-11-05) ▼▼▼
    costItems.forEach(item => {
        console.log('[Gantt BOQ] Item:', item.name, 'CostItem fields:', {
            cost_code_code: item.cost_code_code,
            cost_code_detail_code: item.cost_code_detail_code,
            cost_code_category: item.cost_code_category,
            cost_code_product_name: item.cost_code_product_name,
            cost_code_spec: item.cost_code_spec,
            unit: item.unit
        });

        const key = item.cost_code_code || item.cost_code || 'UNKNOWN';

        if (!aggregated[key]) {
            aggregated[key] = {
                cost_code: item.cost_code_code || key,
                detail_code: item.cost_code_detail_code || '',
                category: item.cost_code_category || '',
                product_name: item.cost_code_product_name || '',
                spec: item.cost_code_spec || '',
                name: item.cost_code_name || '',
                unit: item.unit || '',
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
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // ▼▼▼ [수정] 단가 정보 적용 및 금액 계산 (2025-11-05) ▼▼▼
    Object.values(aggregated).forEach(agg => {
        // cost_code를 키로 사용하여 단가 정보 찾기
        const costCodeKey = agg.cost_code;
        if (costCodeKey && ganttUnitPrices[costCodeKey]) {
            const unitPriceList = ganttUnitPrices[costCodeKey];
            if (unitPriceList && unitPriceList.length > 0) {
                const up = unitPriceList[0];
                agg.material_cost = parseFloat(up.material_cost || 0);
                agg.labor_cost = parseFloat(up.labor_cost || 0);
                agg.expense_cost = parseFloat(up.expense_cost || 0);
                agg.total_cost = parseFloat(up.total_cost || 0);

                console.log(`[BOQ] Unit price found for ${costCodeKey}:`, up);
            } else {
                console.warn(`[BOQ] No unit price found for cost code: ${costCodeKey}`);
            }
        } else {
            console.warn(`[BOQ] Cost code not found or no unit prices: ${costCodeKey}`);
        }

        // 금액 계산
        agg.material_amount = agg.material_cost * agg.quantity;
        agg.labor_amount = agg.labor_cost * agg.quantity;
        agg.expense_amount = agg.expense_cost * agg.quantity;
        agg.total_amount = agg.total_cost * agg.quantity;

        console.log(`[BOQ] Aggregated ${agg.cost_code}: qty=${agg.quantity.toFixed(2)}, total_cost=${agg.total_cost}, total_amount=${agg.total_amount.toFixed(0)}`);
    });
    // ▲▲▲ [수정] 여기까지 ▲▲▲

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

    // ▼▼▼ [수정] 헤더에서 CostCode. 제거 (2025-11-05) ▼▼▼
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
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">공종</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">품명</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">규격</th>
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
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${row.detail_code || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${row.category || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.product_name || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.spec || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${row.unit || '-'}</td>
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
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    // 합계 행
    html += `
                        <tr style="background: #e3f2fd; font-weight: bold;">
                            <td colspan="5" style="padding: 12px; border: 1px solid #ddd; text-align: center;">합계</td>
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
    // ▲▲▲ [수정] 여기까지 ▲▲▲

    boqContainer.innerHTML = html;
}

// =====================================================================
// 공정표 3D 연동 핸들러 함수들
// =====================================================================

// ▼▼▼ Activity 단위 (상단 공정표) 3D 연동 ▼▼▼

/**
 * Activity 단위: 선택한 Activity의 모든 ActivityObject를 BIM 저작도구에서 선택
 */
function ganttActivitySelectInClient() {
    if (!selectedTaskId) {
        showToast('공정표에서 액티비티를 먼저 선택하세요.', 'warning');
        return;
    }

    // 선택된 Activity의 모든 ActivityObject 찾기
    const relatedActivityObjects = window.loadedActivityObjects?.filter(ao =>
        ao.activity && ao.activity.id === selectedTaskId
    ) || [];

    if (relatedActivityObjects.length === 0) {
        showToast('선택한 액티비티에 연결된 액티비티 객체가 없습니다.', 'warning');
        return;
    }

    // ActivityObject들의 element_unique_id를 수집
    const uniqueIdsToSend = [];
    relatedActivityObjects.forEach(ao => {
        if (ao.quantity_member && ao.quantity_member.id) {
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
        showToast('선택한 액티비티에 연결된 BIM 요소가 없습니다.', 'warning');
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


/**
 * Activity 단위: 선택한 Activity의 모든 ActivityObject를 3D 뷰어에서 선택
 */
function ganttActivitySelectIn3D() {
    if (!selectedTaskId) {
        showToast('공정표에서 액티비티를 먼저 선택하세요.', 'warning');
        return;
    }

    if (typeof window.selectObjectsIn3DViewer !== 'function') {
        showToast('3D 뷰어 기능을 사용할 수 없습니다.', 'error');
        return;
    }

    // 선택된 Activity의 모든 ActivityObject 찾기
    const relatedActivityObjects = window.loadedActivityObjects?.filter(ao =>
        ao.activity && ao.activity.id === selectedTaskId
    ) || [];

    if (relatedActivityObjects.length === 0) {
        showToast('선택한 액티비티에 연결된 액티비티 객체가 없습니다.', 'warning');
        return;
    }

    // ActivityObject들의 raw_element_id를 수집
    const bimIdsToSelect = [];
    relatedActivityObjects.forEach(ao => {
        if (ao.quantity_member && ao.quantity_member.id) {
            const qm = window.loadedQuantityMembers?.find(q => q.id === ao.quantity_member.id);
            if (qm) {
                const elementId = qm.split_element_id || qm.raw_element_id;
                if (elementId) {
                    bimIdsToSelect.push(elementId);
                }
            }
        }
    });

    if (bimIdsToSelect.length === 0) {
        showToast('선택한 액티비티에 연결된 BIM 요소가 없습니다.', 'warning');
        return;
    }

    window.selectObjectsIn3DViewer(bimIdsToSelect);
    showToast(`3D 뷰포트에서 ${bimIdsToSelect.length}개 객체를 선택했습니다.`, 'success');
}

// ▼▼▼ ActivityObject 단위 (하단 상세정보) 3D 연동 ▼▼▼


/**
 * ActivityObject 단위: 선택한 ActivityObject를 BIM 저작도구에서 선택
 */
function ganttAoSelectInClient() {
    if (!selectedActivityObjectId) {
        showToast('상세정보에서 액티비티 객체를 먼저 선택하세요.', 'warning');
        return;
    }

    const ao = window.loadedActivityObjects?.find(obj => obj.id === selectedActivityObjectId);
    if (!ao) {
        showToast('선택한 액티비티 객체를 찾을 수 없습니다.', 'error');
        return;
    }

    const uniqueIdsToSend = [];
    if (ao.quantity_member && ao.quantity_member.id) {
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


/**
 * ActivityObject 단위: 선택한 ActivityObject를 3D 뷰어에서 선택
 */
function ganttAoSelectIn3D() {
    if (!selectedActivityObjectId) {
        showToast('상세정보에서 액티비티 객체를 먼저 선택하세요.', 'warning');
        return;
    }

    if (typeof window.selectObjectsIn3DViewer !== 'function') {
        showToast('3D 뷰어 기능을 사용할 수 없습니다.', 'error');
        return;
    }

    const ao = window.loadedActivityObjects?.find(obj => obj.id === selectedActivityObjectId);
    if (!ao) {
        showToast('선택한 액티비티 객체를 찾을 수 없습니다.', 'error');
        return;
    }

    const bimIdsToSelect = [];
    if (ao.quantity_member && ao.quantity_member.id) {
        const qm = window.loadedQuantityMembers?.find(q => q.id === ao.quantity_member.id);
        if (qm) {
            const elementId = qm.split_element_id || qm.raw_element_id;
            if (elementId) {
                bimIdsToSelect.push(elementId);
            }
        }
    }

    if (bimIdsToSelect.length === 0) {
        showToast('선택한 액티비티 객체에 연결된 BIM 요소가 없습니다.', 'warning');
        return;
    }

    window.selectObjectsIn3DViewer(bimIdsToSelect);
    showToast(`3D 뷰포트에서 ${bimIdsToSelect.length}개 객체를 선택했습니다.`, 'success');
}

// ▼▼▼ [추가] 전역으로 노출 (시뮬레이션 탭에서 사용) ▼▼▼
window.renderGanttChart = renderGanttChart;
// ▲▲▲ [추가] 여기까지 ▲▲▲
