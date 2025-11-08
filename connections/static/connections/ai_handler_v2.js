/**
 * AI v2 핸들러 - 학습 기반 시스템
 * - 프롬프트 → 함수 선택 → 객체 선택
 * - 피드백 수집 및 학습 데이터 축적
 */

async function handleAiCommandV2(userPrompt) {
    console.log('[AI v2] ==================== START ====================');
    console.log('[AI v2] User prompt:', userPrompt);

    try {
        // Step 1: 함수 선택 예측
        showToast('AI가 명령을 분석 중...', 'info');
        const functionResult = await predictFunction(userPrompt);

        console.log('[AI v2] Predicted function:', functionResult.function);
        console.log('[AI v2] Confidence:', functionResult.confidence);

        if (functionResult.function === 'select_objects') {
            // Step 2: 객체 선택 예측
            showToast('객체를 선택 중...', 'info');
            const objectsResult = await predictObjects(userPrompt);

            console.log('[AI v2] Predicted objects:', objectsResult.selected_ids.length);

            if (objectsResult.selected_ids.length === 0) {
                showToast('AI가 객체를 찾지 못했습니다. 정답을 알려주세요.', 'info');
                showFeedbackPanel({
                    prompt: userPrompt,
                    function: 'select_objects',
                    aiSelectedIds: [],
                    confidence: objectsResult.confidence
                });
                console.log('[AI v2] ==================== END ====================');
                return;
            }

            // Step 3: 3D 뷰어에서 선택
            if (window.selectObjectsInViewer) {
                window.selectObjectsInViewer(objectsResult.selected_ids);
                showToast(
                    `✓ ${objectsResult.selected_ids.length}개 객체 선택 완료`,
                    'success'
                );
            } else {
                console.error('[AI v2] selectObjectsInViewer function not found');
                showToast('3D 뷰어를 사용할 수 없습니다.', 'error');
            }

            // Step 4: 피드백 UI 표시
            showFeedbackPanel({
                prompt: userPrompt,
                function: 'select_objects',
                aiSelectedIds: objectsResult.selected_ids,
                confidence: objectsResult.confidence
            });

        } else if (functionResult.function === 'calculate_quantity') {
            // TODO: 수량 산출 기능 구현
            showToast('수량 산출 기능은 준비 중입니다.', 'info');

        } else {
            showToast(`알 수 없는 명령: ${functionResult.function}`, 'warning');
        }

        console.log('[AI v2] ==================== END ====================');

    } catch (error) {
        console.error('[AI v2] Error:', error);
        showToast(`오류 발생: ${error.message}`, 'error');
    }
}

/**
 * 함수 선택 예측
 */
async function predictFunction(prompt) {
    const response = await fetch('/connections/api/v2/ai/predict-function/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify({
            prompt: prompt,
            project_id: currentProjectId
        })
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Function prediction failed');
    }

    return {
        function: result.function,
        confidence: result.confidence,
        training_data_count: result.training_data_count
    };
}

/**
 * 객체 선택 예측
 */
async function predictObjects(prompt) {
    const response = await fetch('/connections/api/v2/ai/predict-objects/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify({
            prompt: prompt,
            project_id: currentProjectId,
            threshold: 0.15,  // Lowered from 0.3 to allow stronger filtering with learned weights
            top_k: 100
        })
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Object prediction failed');
    }

    return {
        selected_ids: result.selected_ids,
        confidence: result.confidence,
        total_objects: result.total_objects,
        training_data_count: result.training_data_count
    };
}

/**
 * 피드백 패널 표시
 */
function showFeedbackPanel(data) {
    // 기존 패널이 있다면 제거
    const existingPanel = document.getElementById('ai-feedback-panel-v2');
    if (existingPanel) {
        existingPanel.remove();
    }

    // 마지막 AI 선택 저장
    window.lastAiSelectionV2 = data;

    // 피드백 패널 생성
    const panel = document.createElement('div');
    panel.id = 'ai-feedback-panel-v2';
    panel.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        border: 2px solid #1976d2;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        min-width: 300px;
        font-family: Arial, sans-serif;
        animation: slideIn 0.3s ease-out;
    `;

    const selectedCount = data.aiSelectedIds.length;

    panel.innerHTML = `
        <style>
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            #ai-feedback-panel-v2 .title {
                font-weight: bold;
                font-size: 16px;
                color: #1976d2;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #ai-feedback-panel-v2 .info {
                font-size: 14px;
                color: #666;
                margin-bottom: 16px;
            }
            #ai-feedback-panel-v2 .stats {
                font-size: 12px;
                color: #999;
                margin-bottom: 12px;
                padding: 8px;
                background: #f5f5f5;
                border-radius: 4px;
            }
            #ai-feedback-panel-v2 .button-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            #ai-feedback-panel-v2 button {
                padding: 10px 16px;
                border: none;
                border-radius: 4px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
            }
            #ai-feedback-panel-v2 button:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            #ai-feedback-panel-v2 .btn-correct {
                background: #4CAF50;
                color: white;
            }
            #ai-feedback-panel-v2 .btn-correct:hover {
                background: #45a049;
            }
            #ai-feedback-panel-v2 .btn-fix {
                background: #ff9800;
                color: white;
            }
            #ai-feedback-panel-v2 .btn-fix:hover {
                background: #fb8c00;
            }
            #ai-feedback-panel-v2 .btn-close {
                background: #f44336;
                color: white;
            }
            #ai-feedback-panel-v2 .btn-close:hover {
                background: #da190b;
            }
        </style>
        <div class="title">
            🤖 AI v2 선택 결과 확인
        </div>
        <div class="info">
            ${selectedCount}개 객체가 선택되었습니다.<br>
            결과가 정확한가요?
        </div>
        <div class="stats">
            신뢰도: ${(data.confidence * 100).toFixed(0)}%
        </div>
        <div class="button-group">
            <button class="btn-correct" onclick="window.confirmAiSelectionCorrectV2()">
                ✓ 정확합니다
            </button>
            <button class="btn-fix" onclick="window.startAiSelectionCorrectionV2()">
                ✗ 수정하겠습니다
            </button>
            <button class="btn-close" onclick="window.closeAiFeedbackPanelV2()">
                × 닫기
            </button>
        </div>
    `;

    document.body.appendChild(panel);
    console.log('[AI v2] Feedback panel shown');
}

/**
 * 피드백 패널 닫기
 */
window.closeAiFeedbackPanelV2 = function() {
    const panel = document.getElementById('ai-feedback-panel-v2');
    if (panel) {
        panel.remove();
        console.log('[AI v2] Panel closed');
    }
};

/**
 * 정확함 확인
 */
window.confirmAiSelectionCorrectV2 = async function() {
    console.log('[AI v2] User confirmed selection is correct');

    if (!window.lastAiSelectionV2) {
        showToast('이전 선택 기록이 없습니다.', 'error');
        window.closeAiFeedbackPanelV2();
        return;
    }

    const { prompt, function: functionName, aiSelectedIds, confidence } = window.lastAiSelectionV2;

    // 피드백 저장
    await saveFeedback({
        prompt,
        function_name: functionName,
        ai_selected_ids: aiSelectedIds,
        correct_ids: aiSelectedIds, // 정확하므로 AI 선택과 동일
        confidence
    });

    showToast('✓ 피드백 감사합니다! 학습에 반영됩니다.', 'success');
    window.closeAiFeedbackPanelV2();
    window.lastAiSelectionV2 = null;
};

/**
 * 수정 시작
 */
window.startAiSelectionCorrectionV2 = function() {
    console.log('[AI v2] User wants to correct selection');

    const panel = document.getElementById('ai-feedback-panel-v2');
    if (!panel) return;

    panel.innerHTML = `
        <style>
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            #ai-feedback-panel-v2 .title {
                font-weight: bold;
                font-size: 16px;
                color: #ff9800;
                margin-bottom: 12px;
            }
            #ai-feedback-panel-v2 .info {
                font-size: 14px;
                color: #666;
                margin-bottom: 16px;
                line-height: 1.6;
            }
            #ai-feedback-panel-v2 .instruction {
                background: #fff3cd;
                border-left: 4px solid #ff9800;
                padding: 12px;
                margin-bottom: 16px;
                font-size: 13px;
                line-height: 1.5;
            }
            #ai-feedback-panel-v2 .button-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            #ai-feedback-panel-v2 button {
                padding: 10px 16px;
                border: none;
                border-radius: 4px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
            }
            #ai-feedback-panel-v2 .btn-save {
                background: #4CAF50;
                color: white;
            }
            #ai-feedback-panel-v2 .btn-save:hover {
                background: #45a049;
            }
            #ai-feedback-panel-v2 .btn-cancel {
                background: #9e9e9e;
                color: white;
            }
            #ai-feedback-panel-v2 .btn-cancel:hover {
                background: #757575;
            }
        </style>
        <div class="title">
            ✏️ 정답 선택 중...
        </div>
        <div class="instruction">
            <strong>안내:</strong><br>
            1. 뷰포트에서 정확한 객체를 선택하세요<br>
            2. Ctrl+클릭으로 여러 객체 선택 가능<br>
            3. 선택 완료 후 아래 버튼을 눌러주세요
        </div>
        <div class="info" id="current-selection-info-v2">
            현재 선택: <span id="selection-count-v2">0</span>개
        </div>
        <div class="button-group">
            <button class="btn-save" onclick="window.saveCorrectedSelectionV2()">
                💾 이 선택이 정답입니다
            </button>
            <button class="btn-cancel" onclick="window.closeAiFeedbackPanelV2()">
                취소
            </button>
        </div>
    `;

    // 선택 개수 실시간 업데이트
    const updateSelectionCount = setInterval(() => {
        const countSpan = document.getElementById('selection-count-v2');
        if (!countSpan) {
            clearInterval(updateSelectionCount);
            return;
        }
        const selectedIds = window.getSelectedObjectIds ? window.getSelectedObjectIds() : [];
        countSpan.textContent = selectedIds.length;
    }, 500);

    showToast('뷰포트에서 정확한 객체를 선택해주세요', 'info');
};

/**
 * 수정된 선택 저장
 */
window.saveCorrectedSelectionV2 = async function() {
    if (!window.lastAiSelectionV2) {
        showToast('이전 선택 기록이 없습니다.', 'error');
        window.closeAiFeedbackPanelV2();
        return;
    }

    const userCorrectedIds = window.getSelectedObjectIds ? window.getSelectedObjectIds() : [];

    if (userCorrectedIds.length === 0) {
        showToast('선택된 객체가 없습니다. 정확한 객체를 선택해주세요.', 'warning');
        return;
    }

    const { prompt, function: functionName, aiSelectedIds, confidence } = window.lastAiSelectionV2;

    // 차이 분석
    const aiSet = new Set(aiSelectedIds);
    const userSet = new Set(userCorrectedIds);

    const falsePositives = aiSelectedIds.filter(id => !userSet.has(id));
    const falseNegatives = userCorrectedIds.filter(id => !aiSet.has(id));

    console.log('[AI v2] Correction analysis:', {
        aiCount: aiSelectedIds.length,
        userCount: userCorrectedIds.length,
        falsePositives: falsePositives.length,
        falseNegatives: falseNegatives.length
    });

    // 피드백 저장
    await saveFeedback({
        prompt,
        function_name: functionName,
        ai_selected_ids: aiSelectedIds,
        correct_ids: userCorrectedIds,
        confidence
    });

    showToast(
        `✓ 정답이 저장되었습니다!\nAI: ${aiSelectedIds.length}개 → 정답: ${userCorrectedIds.length}개`,
        'success'
    );

    window.closeAiFeedbackPanelV2();
    window.lastAiSelectionV2 = null;
};

/**
 * 피드백 저장 API 호출
 */
async function saveFeedback(data) {
    try {
        const response = await fetch('/connections/api/v2/ai/save-feedback/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({
                project_id: currentProjectId,
                prompt: data.prompt,
                function_name: data.function_name,
                ai_selected_ids: data.ai_selected_ids,
                correct_ids: data.correct_ids,
                confidence: data.confidence
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to save feedback');
        }

        console.log('[AI v2] Feedback saved:', result.training_data_id);
        console.log('[AI v2] Total training data:', result.total_training_data);

        return result;

    } catch (error) {
        console.error('[AI v2] Error saving feedback:', error);
        showToast(`피드백 저장 실패: ${error.message}`, 'error');
        throw error;
    }
}

// 전역 함수 노출
window.handleAiCommandV2 = handleAiCommandV2;

console.log('[AI v2] AI handler v2 loaded successfully');
