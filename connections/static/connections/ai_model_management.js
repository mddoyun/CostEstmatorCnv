// =====================================================================
// [신규] AI 모델 관리 관련 함수들
// =====================================================================

// AI 모델 관리 내부 탭 클릭 핸들러
function handleAiInnerTabClick(event) {
    const clickedButton = event.target.closest('.inner-tab-button');
    if (!clickedButton || clickedButton.classList.contains('active')) return;

    const targetInnerTabId = clickedButton.dataset.innerTab; // "ai-model-list" 또는 "ai-model-training"
    console.log(
        `[DEBUG][handleAiInnerTabClick] Inner tab clicked: ${targetInnerTabId}`
    );

    // 모든 내부 탭 버튼과 컨텐츠 비활성화
    const container = clickedButton.closest('#ai-model-manager'); // 부모 컨텐츠 영역
    container
        .querySelectorAll('.inner-tab-button.active')
        .forEach((btn) => btn.classList.remove('active'));
    container
        .querySelectorAll('.inner-tab-content.active')
        .forEach((content) => content.classList.remove('active'));

    // 클릭된 버튼과 컨텐츠 활성화
    clickedButton.classList.add('active');
    const targetContent = container.querySelector(`#${targetInnerTabId}`); // 내부 컨텐츠 ID
    if (targetContent) {
        targetContent.classList.add('active');
        console.log(
            `[DEBUG][handleAiInnerTabClick] Inner content activated: ${targetInnerTabId}`
        );
        // ★★★ 핵심: 내부 탭 전환 시 필요한 데이터 로드 함수 호출 ★★★
        loadDataForAiInnerTab(targetInnerTabId);
    } else {
        console.warn(
            `[WARN][handleAiInnerTabClick] Inner content element not found for ID: ${targetInnerTabId}`
        );
    }
}

// AI 모델 관리 내부 탭 데이터 로드 함수
function loadDataForAiInnerTab(innerTabId) {
    console.log(
        `[DEBUG][loadDataForAiInnerTab] Loading data for AI inner tab: ${innerTabId}`
    ); // 디버깅
    if (!currentProjectId) {
        console.warn('[WARN][loadDataForAiInnerTab] No project selected.'); // 디버깅
        return;
    }

    if (innerTabId === 'ai-model-list') {
        loadAiModels(); // 모델 목록 로드 API 호출
    } else if (innerTabId === 'ai-model-training') {
        console.log(
            `[DEBUG][loadDataForAiInnerTab] Initializing AI training UI.`
        ); // 디버깅
        resetTrainingUI(); // 학습 UI 초기 상태로 설정
    } else {
        console.warn(
            `[WARN][loadDataForAiInnerTab] Unknown inner tab ID: ${innerTabId}`
        ); // 디버깅
    }
}

// AI 모델 목록 로드 API 호출
async function loadAiModels() {
    console.log('[DEBUG][loadAiModels] Loading AI models list...'); // 디버깅
    if (!currentProjectId) {
        renderAiModelsTable([]); // 빈 테이블 렌더링 (ui.js 함수)
        console.warn('[WARN][loadAiModels] No project selected.'); // 디버깅
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/ai-models/${window.currentProjectId}/`
        );
        if (!response.ok) throw new Error('AI 모델 목록 로딩 실패');
        loadedAiModels = await response.json(); // 전역 변수 업데이트
        console.log(
            `[DEBUG][loadAiModels] Loaded ${loadedAiModels.length} models.`
        ); // 디버깅
        renderAiModelsTable(loadedAiModels); // ui.js 함수 호출하여 테이블 렌더링
        // SD 탭 모델 드롭다운도 갱신 (선택 사항 - 필요 시 호출)
        // populateSdModelSelect(loadedAiModels);
    } catch (error) {
        console.error('[ERROR][loadAiModels] Failed:', error); // 디버깅
        showToast(error.message, 'error');
        renderAiModelsTable([]); // 오류 시 빈 테이블
    }
}

// AI 모델 파일 선택 트리거
function triggerAiFileUpload() {
    console.log(
        '[DEBUG][triggerAiFileUpload] Triggering file inputs for AI model upload (.h5 and .json).' // <<< 수정: 백틱으로 감싸서 줄바꿈 처리
    );
    document.getElementById('ai-model-h5-input')?.click();
    document.getElementById('ai-model-json-input')?.click(); // 메타데이터 파일도 같이 선택 유도
}

// 파일 선택 시 버튼 텍스트 변경 (헬퍼 함수 - 이전 코드에 이미 있음, 디버깅 강화)
function displaySelectedFileName(inputId, buttonId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    let fileNames = '';
    if (input && input.files.length > 0) {
        fileNames = Array.from(input.files)
            .map((f) => f.name)
            .join(', ');
        console.log(
            `[DEBUG][displaySelectedFileName] File selected for ${inputId}: ${fileNames}`
        ); // 디버깅
    } else {
        console.log(
            `[DEBUG][displaySelectedFileName] No file selected or selection cleared for ${inputId}.`
        ); // 디버깅
    }

    // 버튼 텍스트 업데이트 로직 (여러 파일 입력을 하나의 버튼에 표시)
    if (button) {
        let baseText = '';
        if (buttonId === 'upload-ai-model-files-btn') baseText = '파일 선택';
        else if (buttonId === 'upload-csv-btn') baseText = 'CSV 업로드 및 분석';
        else baseText = button.textContent.split('(')[0].trim(); // 기본 텍스트 추출

        const h5File = 
            document.getElementById('ai-model-h5-input')?.files[0]?.name;
        const jsonFile = document.getElementById('ai-model-json-input')
            ?.files[0]?.name;
        const csvFile = 
            document.getElementById('training-csv-input')?.files[0]?.name;

        let displayFiles = [];
        if (buttonId === 'upload-ai-model-files-btn') {
            if (h5File) displayFiles.push(h5File);
            if (jsonFile) displayFiles.push(jsonFile);
        } else if (buttonId === 'upload-csv-btn' && csvFile) {
            displayFiles.push(csvFile);
        }

        if (displayFiles.length > 0) {
            button.textContent = `${baseText} (${displayFiles.join(', ')})`;
        } else {
            button.textContent = baseText; // 파일 선택 없으면 기본 텍스트
        }
    }
}

// AI 모델 업로드 API 호출
async function uploadAiModel() {
    console.log(
        '[DEBUG][uploadAiModel] Attempting to upload AI model via API.'
    ); // 디버깅
    if (!currentProjectId) {
        showToast('프로젝트를 선택하세요.', 'error');
        return;
    }

    const nameInput = document.getElementById('new-ai-model-name');
    const h5Input = document.getElementById('ai-model-h5-input');
    const jsonInput = document.getElementById('ai-model-json-input');
    const metadataManualInput = document.getElementById(
        'ai-model-metadata-manual'
    );

    const name = nameInput.value.trim();
    const h5File = h5Input.files[0];
    const jsonFile = jsonInput.files[0];
    const metadataManual = metadataManualInput.value.trim();

    if (!name || !h5File) {
        showToast('모델 이름과 .h5 파일은 필수입니다.', 'error');
        console.log('[DEBUG][uploadAiModel] Missing required name or h5 file.'); // 디버깅
        return;
    }
    // 이름 중복 검사 (선택 사항 - 클라이언트 측)
    if (loadedAiModels.some((m) => m.name === name)) {
        showToast('이미 사용 중인 모델 이름입니다.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('h5_file', h5File);
    if (jsonFile) {
        formData.append('json_file', jsonFile);
        console.log('[DEBUG][uploadAiModel] Using metadata from json_file.'); // 디버깅
    } else if (metadataManual) {
        formData.append('metadata_manual', metadataManual);
        console.log('[DEBUG][uploadAiModel] Using metadata from manual input.'); // 디버깅
    } else {
        console.log(
            '[WARN][uploadAiModel] No metadata file or manual input provided. Default metadata will be used.'
        ); // 디버깅
    }
    // description 필드 추가 (선택 사항)
    // formData.append('description', '...');

    showToast('AI 모델 업로드 중...', 'info');
    try {
        const response = await fetch(
            `/connections/api/ai-models/${window.currentProjectId}/`,
            {
                method: 'POST',
                headers: { 'X-CSRFToken': window.csrftoken },
                body: formData,
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || '업로드 실패');

        showToast(result.message, 'success');
        console.log(
            `[DEBUG][uploadAiModel] Upload successful. New model ID: ${result.model_id}`
        ); // 디버깅
        loadAiModels(); // 목록 새로고침

        // 입력 필드 초기화
        nameInput.value = '';
        h5Input.value = '';
        jsonInput.value = '';
        metadataManualInput.value = '';
        displaySelectedFileName(
            'ai-model-h5-input',
            'upload-ai-model-files-btn'
        ); // 버튼 텍스트 초기화
    } catch (error) {
        console.error('[ERROR][uploadAiModel] Upload failed:', error); // 디버깅
        showToast(error.message, 'error');
    }
}

// AI 모델 목록 테이블 액션 처리 (수정, 삭제, 다운로드)
async function handleAiModelListActions(event) {
    const target = event.target;
    const modelRow = target.closest('tr[data-model-id]');
    if (!modelRow) return;
    const modelId = modelRow.dataset.modelId;

    if (target.classList.contains('edit-ai-model-btn')) {
        console.log(
            `[DEBUG][handleAiModelListActions] Edit button clicked for model ID: ${modelId}`
        ); // 디버깅
        // TODO: 수정 UI 구현 (예: 모달 팝업 또는 인라인 편집)
        showToast('모델 정보 수정 기능은 아직 구현되지 않았습니다.', 'info');
    } else if (target.classList.contains('delete-ai-model-btn')) {
        console.log(
            `[DEBUG][handleAiModelListActions] Delete button clicked for model ID: ${modelId}`
        ); // 디버깅
        const modelName = modelRow.cells[0].textContent; // 테이블에서 이름 가져오기
        if (confirm(`AI 모델 '${modelName}'을(를) 삭제하시겠습니까?`)) {
            console.log(
                `[DEBUG][handleAiModelListActions] Sending DELETE request for model ID: ${modelId}`
            ); // 디버깅
            try {
                const response = await fetch(
                    `/connections/api/ai-models/${window.currentProjectId}/${modelId}/`,
                    {
                        method: 'DELETE',
                        headers: { 'X-CSRFToken': window.csrftoken },
                    }
                );
                const result = await response.json();
                if (!response.ok)
                    throw new Error(result.message || '삭제 실패');
                showToast(result.message, 'success');
                console.log(
                    `[DEBUG][handleAiModelListActions] Model deleted successfully.`
                ); // 디버깅
                loadAiModels(); // 목록 새로고침
            } catch (error) {
                console.error(
                    '[ERROR][handleAiModelListActions] Delete failed:',
                    error
                ); // 디버깅
                showToast(error.message, 'error');
            }
        } else {
            console.log('[DEBUG][handleAiModelListActions] Delete cancelled.'); // 디버깅
        }
    } else if (target.classList.contains('download-ai-model-h5-btn')) {
        console.log(
            `[DEBUG][handleAiModelListActions] Download H5 button clicked for model ID: ${modelId}`
        ); // 디버깅
        window.location.href = `/connections/api/ai-models/${currentProjectId}/${modelId}/download/?type=h5`;
    } else if (target.classList.contains('download-ai-model-json-btn')) {
        console.log(
            `[DEBUG][handleAiModelListActions] Download JSON button clicked for model ID: ${modelId}`
        ); // 디버깅
        window.location.href = `/connections/api/ai-models/${currentProjectId}/${modelId}/download/?type=json`;
    }
}

// =====================================================================
// [신규] AI 모델 학습 관련 함수들
// =====================================================================

// CSV 업로드 및 분석 API 호출
async function uploadAndAnalyzeCsv() {
    console.log(
        '[DEBUG][uploadAndAnalyzeCsv] Attempting to upload and analyze CSV for training.'
    ); // 디버깅
    if (!currentProjectId) {
        showToast('프로젝트를 선택하세요.', 'error');
        return;
    }
    const csvInput = document.getElementById('training-csv-input');
    if (csvInput.files.length === 0) {
        showToast('학습용 CSV 파일을 선택하세요.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('training_csv', csvInput.files[0]);

    showToast('CSV 파일 업로드 및 분석 중...', 'info');
    try {
        const response = await fetch(
            `/connections/api/ai-training/${window.currentProjectId}/upload-csv/`,
            {
                method: 'POST',
                headers: { 'X-CSRFToken': window.csrftoken },
                body: formData,
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'CSV 분석 실패');

        showToast(result.message, 'success');
        console.log(
            `[DEBUG][uploadAndAnalyzeCsv] CSV analyzed. Headers: ${result.headers.length}, Temp file: ${result.temp_filename}`
        ); // 디버깅
        uploadedCsvFilename = result.temp_filename; // 임시 파일명 저장
        csvHeaders = result.headers; // 헤더 목록 저장

        // UI 업데이트: 1단계 숨기고 2단계 표시, 피처 목록 채우기
        document.getElementById('training-step-1').style.display = 'none';
        document.getElementById('training-step-2').style.display = 'block';
        document.getElementById('training-step-3').style.display = 'none'; // 3단계 숨김
        renderFeatureSelectionLists(csvHeaders); // ui.js 함수 호출
    } catch (error) {
        console.error('[ERROR][uploadAndAnalyzeCsv] Failed:', error); // 디버깅
        showToast(error.message, 'error');
        resetTrainingUI(); // 오류 시 UI 초기화
    }
}

// 입력/출력 피처 선택 처리 (체크박스 변경 시)
function handleFeatureSelection(event) {
    if (event.target.type === 'checkbox') {
        const featureName = event.target.value;
        const isInputList = event.currentTarget.id === 'input-feature-list';
        // 선택 시 다른 목록에서 자동 해제 (Input과 Output은 중복 불가)
        const otherListId = isInputList
            ? 'output-feature-list'
            : 'input-feature-list';
        const escapedFeatureName =
            typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
                ? CSS.escape(featureName)
                : featureName.replace(/["\\]/g, '\\$&'); // <<< 수정: "와 \를 이스케이프 처리
        const otherCheckbox = document.querySelector(
            `#${otherListId} input[value="${escapedFeatureName}"]`
        );
        if (event.target.checked && otherCheckbox && otherCheckbox.checked) {
            otherCheckbox.checked = false;
            console.log(
                `[DEBUG][handleFeatureSelection] Feature '${featureName}' deselected from ${ 
                    isInputList ? 'Output' : 'Input'
                } list due to selection in ${ 
                    isInputList ? 'Input' : 'Output'
                } list.`
            ); // 디버깅
        }
        console.log(
            `[DEBUG][handleFeatureSelection] Feature '${featureName}' selection changed in ${ 
                isInputList ? 'Input' : 'Output'
            } list. Checked: ${event.target.checked}`
        ); // 디버깅
    }
}

// 학습 시작 API 호출
async function startTraining() {
    console.log(
        '[DEBUG][startTraining] Validating inputs and preparing to start AI training...'
    );
    if (!currentProjectId || !uploadedCsvFilename) {
        showToast('프로젝트 선택 및 CSV 파일 업로드가 필요합니다.', 'error');
        return;
    }

    // 선택된 입력/출력 피처 가져오기
    const inputFeatures = Array.from(
        document.querySelectorAll('#input-feature-list input:checked')
    ).map((cb) => cb.value);
    const outputFeatures = Array.from(
        document.querySelectorAll('#output-feature-list input:checked')
    ).map((cb) => cb.value);
    const modelName = document
        .getElementById('training-model-name')
        .value.trim();

    // 유효성 검사
    if (inputFeatures.length === 0 || outputFeatures.length === 0) {
        showToast('입력 및 출력 피처를 하나 이상 선택하세요.', 'error');
        return;
    }
    if (!modelName) {
        showToast('학습된 모델의 이름을 입력하세요.', 'error');
        return;
    }
    if (loadedAiModels.some((m) => m.name === modelName)) {
        showToast(
            '이미 사용 중인 모델 이름입니다. 다른 이름을 사용하세요.',
            'error'
        );
        return;
    }

    // --- 새로운 설정값 수집 ---
    // 동적 레이어 설정 수집 (JavaScript 변수: hiddenLayersConfig - 카멜케이스)
    const hiddenLayersConfig = []; // <<< 변수 정의 (카멜케이스)
    document
        .querySelectorAll('#hidden-layers-config .layer-config-row')
        .forEach((row) => {
            const nodes =
                parseInt(row.querySelector('.nodes-input').value) || 64;
            const activation =
                row.querySelector('.activation-select').value || 'relu';
            hiddenLayersConfig.push({ nodes, activation }); // <<< 변수 사용 (카멜케이스)
        });
    if (hiddenLayersConfig.length === 0) {
        // <<< 변수 사용 (카멜케이스)
        showToast('최소 1개 이상의 은닉층을 설정해야 합니다.', 'error');
        return;
    }

    // 하이퍼파라미터 수집
    const loss_function = document.getElementById('loss-function').value;
    const optimizer = document.getElementById('optimizer').value;
    const metricsSelect = document.getElementById('metrics');
    const metrics = metricsSelect
        ? Array.from(metricsSelect.selectedOptions).map(
              (option) => option.value
          )
        : ['mae'];
    const learning_rate =
        parseFloat(document.getElementById('learning-rate').value) || 0.001;
    const epochs = parseInt(document.getElementById('epochs').value) || 10;
    const normalize_inputs =
        document.getElementById('normalize-inputs').checked;

    // 데이터 분할 설정 수집
    const train_ratio =
        parseInt(document.getElementById('train-ratio').value) || 70;
    const val_ratio =
        parseInt(document.getElementById('val-ratio').value) || 15;
    if (train_ratio + val_ratio >= 100 || train_ratio <= 0 || val_ratio <= 0) {
        showToast(
            'Train과 Validation 비율의 합은 100 미만이어야 하며, 각각 0보다 커야 합니다.',
            'error'
        );
        return;
    }
    const use_random_seed = document.getElementById('use-random-seed').checked;
    const random_seed_value =
        parseInt(document.getElementById('random-seed-value').value) || 42;
    // --- 설정값 수집 끝 ---

    // config 객체 생성 (백엔드로 보낼 JSON 데이터)
    const config = {
        temp_filename: uploadedCsvFilename,
        model_name: modelName,
        input_features: inputFeatures,
        output_features: outputFeatures,
        // ▼▼▼ 속성 이름은 스네이크케이스, 값은 JavaScript 변수(카멜케이스) ▼▼▼
        hidden_layers_config: hiddenLayersConfig, // <<< JavaScript 변수(hiddenLayersConfig)를 사용
        loss_function: loss_function,
        optimizer: optimizer,
        metrics: metrics,
        learning_rate: learning_rate,
        epochs: epochs,
        normalize_inputs: normalize_inputs,
        train_ratio: train_ratio,
        val_ratio: val_ratio,
        use_random_seed: use_random_seed,
        random_seed_value: random_seed_value,
        // ▲▲▲ 여기까지 ▲▲▲
    };
    // 오류가 발생한 라인
    console.log(
        '[DEBUG][startTraining] Training configuration prepared:',
        config
    );

    // --- UI 업데이트 및 API 호출 (이하 동일) ---
    document.getElementById('training-step-1').style.display = 'none';
    document.getElementById('training-step-2').style.display = 'none';
    document.getElementById('training-step-3').style.display = 'block';
    document.getElementById('training-progress-info').textContent =
        '학습 시작 요청 중...';
    document.getElementById('training-results').innerHTML = '';
    document.getElementById('test-set-evaluation-results').innerHTML = '';
    document.getElementById('training-actions').style.display = 'none';
    if (trainingChartInstance) trainingChartInstance.destroy();
    const ctx = document
        .getElementById('training-progress-chart')
        .getContext('2d');
    trainingChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Loss', data: [], borderColor: 'red', fill: false },
                {
                    label: 'Validation Loss',
                    data: [],
                    borderColor: 'blue',
                    fill: false,
                },
            ],
        },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: 'Epoch' } },
                y: { title: { display: true, text: 'Loss' } },
            },
        },
    });
    console.log(
        '[DEBUG][startTraining] Training UI updated to Step 3 (Progress). Chart initialized.'
    );

    showToast('AI 모델 학습 시작 요청...', 'info');
    try {
        const response = await fetch(
            `/connections/api/ai-training/${currentProjectId}/start/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': window.csrftoken,
                },
                body: JSON.stringify(config), // 생성된 config 객체 전송
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || '학습 시작 실패');

        showToast(result.message, 'success');
        currentTrainingTaskId = result.task_id;
        currentTrainingStatus = {
            status: 'queued',
            message: '학습 대기 중...',
        };
        console.log(
            `[DEBUG][startTraining] Training start request successful. Task ID: ${currentTrainingTaskId}`
        );
    } catch (error) {
        console.error(
            '[ERROR][startTraining] Failed to start training:',
            error
        );
        showToast(error.message, 'error');
        document.getElementById(
            'training-progress-info'
        ).textContent = `오류: ${error.message}`;
        resetTrainingUI();
    }
}

// WebSocket 으로 학습 진행률 업데이트 처리 (websocket.js 에서 호출됨)
function handleTrainingProgressUpdate(data) {
    // 요청한 작업 ID와 일치하는지, 그리고 현재 학습 UI가 보이는지 확인
    if (
        data.task_id !== currentTrainingTaskId ||
        activeTab !== 'ai-model-manager' ||
        document.getElementById('ai-model-training')?.style.display === 'none'
    ) {
        // console.log(`[DEBUG][handleTrainingProgressUpdate] Received progress for irrelevant task (${data.task_id}) or tab, ignoring.`); // 너무 빈번할 수 있음
        return;
    }

    currentTrainingStatus = data.progress; // 최신 상태 저장
    console.log(
        '[DEBUG][handleTrainingProgressUpdate] Received progress update:',
        currentTrainingStatus
    ); // 디버깅

    const progressInfo = document.getElementById('training-progress-info');
    const resultsDiv = document.getElementById('training-results');
    const actionsDiv = document.getElementById('training-actions');
    const evaluationContainer = document.getElementById(
        'test-set-evaluation-results'
    );
    const chart = trainingChartInstance;

    // 진행률 메시지 업데이트
    if (currentTrainingStatus.status === 'running') {
        progressInfo.textContent = `Epoch ${ 
            currentTrainingStatus.current_epoch || '-' 
        }/${ 
            currentTrainingStatus.total_epochs || '-' 
        } 진행 중... Loss: ${ 
            currentTrainingStatus.loss?.toFixed(4) ?? 'N/A'
        }, Val Loss: ${ 
            currentTrainingStatus.val_loss?.toFixed(4) ?? 'N/A'
        }`;
    } else {
        progressInfo.textContent =
            currentTrainingStatus.message || '상태 업데이트 중...';
    }

    // 차트 업데이트 (epoch_history 데이터 사용)
    if (
        chart &&
        currentTrainingStatus.epoch_history &&
        currentTrainingStatus.epoch_history.length > 0
    ) {
        const history = currentTrainingStatus.epoch_history;
        chart.data.labels = history.map((h) => h.epoch);
        chart.data.datasets[0].data = history.map((h) => h.loss); // Loss
        chart.data.datasets[1].data = history.map((h) => h.val_loss); // Validation Loss
        try {
            chart.update();
        } catch (e) {
            console.warn('Chart update error:', e);
        } // 차트 업데이트 오류 방지
    }

    // 상태에 따른 UI 처리 (완료 또는 오류)
    // 상태에 따른 UI 처리 (완료 또는 오류)
    if (currentTrainingStatus.status === 'completed') {
        progressInfo.textContent = `✅ 학습 완료! ${currentTrainingStatus.message}`;
        // Validation 결과 표시 (기존)
        resultsDiv.innerHTML = `<ul><li>최종 검증 손실(Final Validation Loss): ${ 
            currentTrainingStatus.final_val_loss?.toFixed(4) ?? 'N/A'
        }</li></ul>`;

        // ▼▼▼ [추가] Test Set 평가 결과 렌더링 호출 ▼▼▼
        if (currentTrainingStatus.metadata?.test_set_evaluation) {
            renderTestSetEvaluationResults(
                currentTrainingStatus.metadata.test_set_evaluation
            );
        } else {
            evaluationContainer.innerHTML =
                '<h4>Test Set 평가 결과</h4><p>Test Set 평가 결과 데이터가 없습니다.</p>';
        }
        // ▲▲▲ [추가] 여기까지 ▲▲▲

        actionsDiv.style.display = 'block'; // 완료 후 버튼 표시
        trainedModelTempFilename = currentTrainingStatus.trained_model_filename;
        trainedModelMetadata = currentTrainingStatus.metadata;
        console.log(
            `[DEBUG][handleTrainingProgressUpdate] Training completed. Temp file: ${trainedModelTempFilename}`
        ); // 디버깅
    } else if (currentTrainingStatus.status === 'error') {
        progressInfo.textContent = `❌ 오류: ${currentTrainingStatus.message}`;
        resultsDiv.innerHTML = '';
        evaluationContainer.innerHTML = ''; // 오류 시 평가 결과 영역도 비움
        actionsDiv.style.display = 'none';
        console.error(
            `[ERROR][handleTrainingProgressUpdate] Training failed: ${currentTrainingStatus.message}`
        );
        currentTrainingTaskId = null;
    } else {
        // 학습 진행 중이면 결과/액션 숨김
        resultsDiv.innerHTML = '';
        evaluationContainer.innerHTML = ''; // 진행 중 평가 결과 영역 비움
        actionsDiv.style.display = 'none';
    }
}

// 학습된 모델 저장 API 호출 (DB에)
async function saveTrainedModel() {
    console.log(
        '[DEBUG][saveTrainedModel] Attempting to save trained model to database via API.'
    ); // 디버깅
    const modelName =
        currentTrainingStatus?.metadata?.training_config?.model_name; // 학습 설정에서 이름 가져오기

    if (
        !currentProjectId ||
        !trainedModelTempFilename ||
        !trainedModelMetadata ||
        !modelName
    ) {
        showToast(
            '학습이 완료되지 않았거나 저장할 모델 정보가 없습니다.',
            'error'
        );
        console.error(
            '[ERROR][saveTrainedModel] Missing required data (project, temp_filename, metadata, model_name).'
        ); // 디버깅
        return;
    }
    // 모델 이름 중복 다시 확인 (저장 직전)
    if (loadedAiModels.some((m) => m.name === modelName)) {
        showToast(
            `모델 이름 '${modelName}'이(가) 이미 존재합니다. 학습 시 다른 이름을 사용했어야 합니다.`, // <<< 수정: 백틱으로 감싸서 줄바꿈 처리
            'error'
        );
        return;
    }

    showToast(`모델 '${modelName}' 저장 요청 중...`, 'info');
    try {
        // 백엔드에 임시 파일명과 메타데이터를 보내 DB 저장을 요청하는 새 API 호출
        const response = await fetch(
            `/connections/api/ai-models/${currentProjectId}/save-trained/`, // << 백엔드에 이 URL 구현 필요
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': window.csrftoken,
                },                body: JSON.stringify({
                    temp_h5_filename: trainedModelTempFilename, // 임시 h5 파일 이름
                    name: modelName,
                    metadata: trainedModelMetadata,
                    description: `Trained on ${new Date().toLocaleDateString()}`, // 간단한 설명
                }),
            }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || '모델 저장 실패');

        showToast(result.message, 'success');
        console.log(
            `[DEBUG][saveTrainedModel] Model saved successfully to database. New ID: ${result.model_id}`
        ); // 디버깅
        loadAiModels(); // 모델 목록 새로고침 ('목록/업로드' 탭으로 자동 전환은 X)

        // 저장 후 임시 정보 초기화 (선택적)
        // trainedModelTempFilename = null;
        // trainedModelMetadata = null;
        // 버튼 비활성화 등 추가 처리 가능
        document.getElementById('save-trained-model-btn').disabled = true; // 저장 버튼 비활성화
    } catch (error) {
        console.error('[ERROR][saveTrainedModel] Failed:', error); // 디버깅
        showToast(error.message, 'error');
    }
}

// 학습된 모델 파일 다운로드 (.h5 또는 .json)
function downloadTrainedModelFile(type) {
    // type: 'h5' or 'json'
    console.log(
        `[DEBUG][downloadTrainedModelFile] Requesting download for trained model file. Type: ${type}`
    ); // 디버깅
    const modelName =
        currentTrainingStatus?.metadata?.training_config?.model_name;

    if (
        !currentProjectId ||
        !trainedModelTempFilename ||
        !trainedModelMetadata ||
        !modelName
    ) {
        showToast('다운로드할 학습된 모델 정보가 없습니다.', 'error');
        console.error(
            '[ERROR][downloadTrainedModelFile] Missing required data (project, temp_filename, metadata, model_name).'
        ); // 디버깅
        return;
    }

    if (type === 'h5') {
        // 백엔드에 임시 h5 파일 다운로드 API 요청 (새 API 엔드포인트 필요)
        console.log(
            `[DEBUG][downloadTrainedModelFile] Triggering H5 download for temp file: ${trainedModelTempFilename}`
        ); // 디버깅
        // 백엔드에 임시 파일명과 원하는 다운로드 파일명을 전달
        window.location.href = `/connections/api/ai-training/download-temp/${window.currentProjectId}/?filename=${trainedModelTempFilename}&type=h5&download_name=${encodeURIComponent(
            modelName
        )}.h5`; // << 백엔드에 이 URL 구현 필요
    } else if (type === 'json') {
        // 메타데이터는 프론트엔드에 있으므로 직접 Blob 생성하여 다운로드
        console.log(
            `[DEBUG][downloadTrainedModelFile] Generating JSON metadata file for download.`
        ); // 디버깅
        const metadataString = JSON.stringify(trainedModelMetadata, null, 2);
        const blob = new Blob([metadataString], {
            type: 'application/json;charset=utf-8', // UTF-8 명시
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${modelName}_metadata.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(
            `[DEBUG][downloadTrainedModelFile] JSON metadata download initiated.`
        ); // 디버깅
    } else {
        console.error(
            `[ERROR][downloadTrainedModelFile] Invalid download type specified: ${type}`
        ); // 디버깅
    }
}
/**
 * 학습 UI를 초기 상태로 리셋합니다.
 * @param {boolean} fullReset - true이면 CSV 업로드 상태까지 완전히 초기화, false이면 설정값만 초기화 (기본값: true)
 */
function resetTrainingUI(fullReset = true) {
    console.log(
        `[DEBUG][resetTrainingUI] Resetting AI training UI. Full reset: ${fullReset}`
    );

    if (fullReset) {
        // 1단계(CSV 업로드) 표시, 나머지 숨김
        document.getElementById('training-step-1').style.display = 'block';
        document.getElementById('training-step-2').style.display = 'none';
        document.getElementById('training-step-3').style.display = 'none';

        // CSV 관련 UI 및 변수 초기화
        const csvInput = document.getElementById('training-csv-input');
        if (csvInput) csvInput.value = '';
        displaySelectedFileName('training-csv-input', 'upload-csv-btn');
        document.getElementById('csv-info').innerHTML = '';
        uploadedCsvFilename = null;
        csvHeaders = [];
    } else {
        // 설정값만 리셋하는 경우 (2단계 표시 유지)
        document.getElementById('training-step-1').style.display = 'none';
        document.getElementById('training-step-2').style.display = 'block';
        document.getElementById('training-step-3').style.display = 'none';
    }

    // --- 공통 초기화 로직 (설정값, 진행상태, 결과, 차트, 관련 변수) ---
    document.getElementById('input-feature-list').innerHTML = '';
    document.getElementById('output-feature-list').innerHTML = '';
    document.getElementById('training-model-name').value = '';

    // 모델 구조 리셋
    resetHiddenLayersConfig();
    // 하이퍼파라미터 리셋
    document.getElementById('loss-function').value = 'mse';
    document.getElementById('optimizer').value = 'adam';
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
        'Test 비율(%): 15';
    document.getElementById('use-random-seed').checked = false;
    document.getElementById('random-seed-value').value = 42;
    document.getElementById('random-seed-value').style.display = 'none';

    // 진행률/결과/액션 초기화
    document.getElementById('training-progress-info').textContent =
        '학습 대기 중...';
    document.getElementById('training-results').innerHTML = '';
    document.getElementById('test-set-evaluation-results').innerHTML = '';
    document.getElementById('training-actions').style.display = 'none';
    document.getElementById('save-trained-model-btn').disabled = false;
    // 차트 초기화
    if (trainingChartInstance) {
        trainingChartInstance.destroy();
        trainingChartInstance = null;
    }
    // 관련 전역 변수 초기화 (task ID, status 등)
    currentTrainingTaskId = null;
    currentTrainingStatus = {};
    trainedModelTempFilename = null;
    trainedModelMetadata = null;
    // --- 공통 초기화 로직 끝 ---

    console.log(
        '[DEBUG][resetTrainingUI] Training UI and relevant state variables reset.'
    );
}
