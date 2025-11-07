/**
 * LLM Fine-tuning Handler
 * Ollama 기반 LLM 파인튜닝 관리
 */

(function() {
    console.log('[LLM Finetuning] Initializing handler...');

    let feedbackData = [];
    let currentModelfile = '';

    // ===== 1단계: 피드백 데이터 로드 =====

    /**
     * 피드백 데이터 불러오기
     */
    async function loadFeedbackData() {
        console.log('[LLM Finetuning] Loading feedback data...');

        if (!window.currentProjectId) {
            showToast('프로젝트를 먼저 선택해주세요.', 'warning');
            return;
        }

        try {
            const response = await fetch(`/connections/api/ai-feedback/list/${window.currentProjectId}/`);
            const data = await response.json();

            if (data.success) {
                feedbackData = data.feedbacks || [];
                console.log(`[LLM Finetuning] Loaded ${feedbackData.length} feedback items`);

                // UI 업데이트
                updateFeedbackUI();
            } else {
                showToast(`피드백 로드 실패: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('[LLM Finetuning] Error loading feedback:', error);
            showToast(`피드백 로드 중 오류: ${error.message}`, 'error');
        }
    }

    /**
     * 피드백 UI 업데이트
     */
    function updateFeedbackUI() {
        const container = document.getElementById('feedback-data-container');
        const countLabel = document.getElementById('feedback-count-label');

        if (!container || !countLabel) return;

        countLabel.textContent = `총 ${feedbackData.length}개의 학습 데이터`;

        if (feedbackData.length === 0) {
            container.innerHTML = '<p style="color: #999;">피드백 데이터가 없습니다. AI 선택 기능을 사용하고 피드백을 저장하세요.</p>';
            return;
        }

        // 피드백 데이터 테이블 렌더링
        let html = '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        html += '<thead><tr style="background: #f0f0f0; border-bottom: 2px solid #ddd;">';
        html += '<th style="padding: 8px; text-align: left;">번호</th>';
        html += '<th style="padding: 8px; text-align: left;">쿼리</th>';
        html += '<th style="padding: 8px; text-align: left;">선택된 객체</th>';
        html += '<th style="padding: 8px; text-align: left;">생성 시간</th>';
        html += '</tr></thead><tbody>';

        feedbackData.forEach((feedback, index) => {
            const selectedIds = feedback.user_corrected_ids || feedback.ai_selected_ids || [];
            html += '<tr style="border-bottom: 1px solid #eee;">';
            html += `<td style="padding: 8px;">${index + 1}</td>`;
            html += `<td style="padding: 8px; font-weight: bold;">${escapeHtml(feedback.user_query)}</td>`;
            html += `<td style="padding: 8px;">${selectedIds.length}개</td>`;
            html += `<td style="padding: 8px; color: #666; font-size: 11px;">${formatTimestamp(feedback.timestamp)}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        // Modelfile 생성 버튼 활성화
        const generateBtn = document.getElementById('generate-modelfile-btn');
        if (generateBtn) {
            generateBtn.disabled = false;
        }
    }

    // ===== 2단계: Modelfile 생성 =====

    /**
     * Modelfile 생성
     */
    function generateModelfile() {
        console.log('[LLM Finetuning] Generating Modelfile...');

        if (feedbackData.length === 0) {
            showToast('피드백 데이터를 먼저 불러와주세요.', 'warning');
            return;
        }

        const baseModel = document.getElementById('base-model-select').value;
        const newModelName = document.getElementById('new-model-name-input').value.trim();
        const systemPrompt = document.getElementById('system-prompt-input').value.trim();

        if (!newModelName) {
            showToast('새 모델 이름을 입력해주세요.', 'warning');
            return;
        }

        // Modelfile 구성
        let modelfile = `# Modelfile for ${newModelName}\n`;
        modelfile += `# Generated from ${feedbackData.length} feedback examples\n\n`;
        modelfile += `FROM ${baseModel}\n\n`;

        // 시스템 프롬프트
        if (systemPrompt) {
            modelfile += `SYSTEM """\n${systemPrompt}\n"""\n\n`;
        } else {
            modelfile += `SYSTEM """\n`;
            modelfile += `You are a BIM object selection assistant. Your task is to understand user queries about selecting objects in a 3D building model and identify the correct objects.\n`;
            modelfile += `When given a query, analyze the intent and respond with the object types that should be selected.\n`;
            modelfile += `"""\n\n`;
        }

        // Few-shot 예제 추가 (최대 20개)
        const exampleCount = Math.min(feedbackData.length, 20);
        modelfile += `# Training examples (${exampleCount} samples)\n`;

        for (let i = 0; i < exampleCount; i++) {
            const feedback = feedbackData[i];
            const selectedIds = feedback.user_corrected_ids || feedback.ai_selected_ids || [];

            // 객체 정보 가져오기
            let objectTypes = [];
            if (window.allRevitData) {
                selectedIds.forEach(id => {
                    const obj = window.allRevitData.find(o => o.id === id);
                    if (obj && obj.raw_data) {
                        const type = obj.raw_data.IfcClass || obj.raw_data.Category || 'Unknown';
                        if (!objectTypes.includes(type)) {
                            objectTypes.push(type);
                        }
                    }
                });
            }

            const objectTypesStr = objectTypes.join(', ') || 'objects';
            const objectCount = selectedIds.length;

            modelfile += `\nMESSAGE user "${escapeForModelfile(feedback.user_query)}"\n`;
            modelfile += `MESSAGE assistant "선택된 객체: ${objectTypesStr} (총 ${objectCount}개)"\n`;
        }

        // 파라미터 설정
        modelfile += `\n# Model parameters\n`;
        modelfile += `PARAMETER temperature 0.7\n`;
        modelfile += `PARAMETER top_p 0.9\n`;
        modelfile += `PARAMETER top_k 40\n`;

        currentModelfile = modelfile;

        // 미리보기 업데이트
        const preview = document.getElementById('modelfile-preview');
        if (preview) {
            preview.value = modelfile;
        }

        // 파인튜닝 버튼 활성화
        const startBtn = document.getElementById('start-finetuning-btn');
        if (startBtn) {
            startBtn.disabled = false;
        }

        showToast('Modelfile 생성 완료!', 'success');
        console.log('[LLM Finetuning] Modelfile generated successfully');
    }

    // ===== 3단계: 파인튜닝 실행 =====

    /**
     * 파인튜닝 시작
     */
    async function startFinetuning() {
        console.log('[LLM Finetuning] Starting fine-tuning...');

        const newModelName = document.getElementById('new-model-name-input').value.trim();

        if (!newModelName || !currentModelfile) {
            showToast('Modelfile을 먼저 생성해주세요.', 'warning');
            return;
        }

        // UI 업데이트
        const progressContainer = document.getElementById('finetuning-progress-container');
        const resultContainer = document.getElementById('finetuning-result-container');
        const startBtn = document.getElementById('start-finetuning-btn');
        const cancelBtn = document.getElementById('cancel-finetuning-btn');
        const logDiv = document.getElementById('finetuning-log');

        if (progressContainer) progressContainer.style.display = 'block';
        if (resultContainer) resultContainer.style.display = 'none';
        if (startBtn) startBtn.disabled = true;
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
        if (logDiv) logDiv.innerHTML = '';

        updateProgress(0, 'Modelfile을 Ollama에 전송 중...');

        try {
            // Django API를 통해 Ollama create 실행
            const response = await fetch(`/connections/api/ollama-finetuning/create/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({
                    model_name: newModelName,
                    modelfile: currentModelfile
                })
            });

            const data = await response.json();

            if (data.success) {
                updateProgress(100, '파인튜닝 완료!');
                appendLog('✅ 모델 생성 완료: ' + newModelName);

                // 결과 표시
                if (resultContainer) {
                    resultContainer.style.display = 'block';
                    const resultModelName = document.getElementById('result-model-name');
                    if (resultModelName) {
                        resultModelName.textContent = newModelName;
                    }
                }

                showToast('파인튜닝 완료!', 'success');
            } else {
                throw new Error(data.error || '파인튜닝 실패');
            }
        } catch (error) {
            console.error('[LLM Finetuning] Error during fine-tuning:', error);
            appendLog('❌ 오류: ' + error.message);
            showToast(`파인튜닝 실패: ${error.message}`, 'error');
            updateProgress(0, '실패');
        } finally {
            if (startBtn) startBtn.disabled = false;
            if (cancelBtn) cancelBtn.style.display = 'none';
        }
    }

    /**
     * 진행 상황 업데이트
     */
    function updateProgress(percent, message) {
        const progressBar = document.getElementById('finetuning-progress-bar');
        const progressText = document.getElementById('finetuning-progress-text');

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        if (progressText) {
            progressText.textContent = message;
        }
    }

    /**
     * 로그 추가
     */
    function appendLog(message) {
        const logDiv = document.getElementById('finetuning-log');
        if (!logDiv) return;

        const timestamp = new Date().toLocaleTimeString();
        const logLine = document.createElement('div');
        logLine.textContent = `[${timestamp}] ${message}`;
        logDiv.appendChild(logLine);
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    // ===== 4단계: 모델 관리 =====

    /**
     * Ollama 모델 목록 조회
     */
    async function listFinetunedModels() {
        console.log('[LLM Finetuning] Listing Ollama models...');

        const container = document.getElementById('finetuned-models-container');
        if (!container) return;

        container.innerHTML = '<p style="color: #999;">모델 목록 불러오는 중...</p>';

        try {
            const response = await fetch('/connections/api/ollama-finetuning/list/');
            const data = await response.json();

            if (data.success && data.models) {
                let html = '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
                html += '<thead><tr style="background: #f0f0f0; border-bottom: 2px solid #ddd;">';
                html += '<th style="padding: 8px; text-align: left;">모델 이름</th>';
                html += '<th style="padding: 8px; text-align: left;">크기</th>';
                html += '<th style="padding: 8px; text-align: left;">수정 시간</th>';
                html += '<th style="padding: 8px; text-align: left;">작업</th>';
                html += '</tr></thead><tbody>';

                data.models.forEach(model => {
                    html += '<tr style="border-bottom: 1px solid #eee;">';
                    html += `<td style="padding: 8px; font-weight: bold;">${escapeHtml(model.name)}</td>`;
                    html += `<td style="padding: 8px;">${formatBytes(model.size)}</td>`;
                    html += `<td style="padding: 8px; color: #666; font-size: 11px;">${formatTimestamp(model.modified_at)}</td>`;
                    html += `<td style="padding: 8px;">`;
                    html += `<button class="delete-model-btn" data-model="${escapeHtml(model.name)}" style="padding: 4px 8px; font-size: 11px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">삭제</button>`;
                    html += `</td>`;
                    html += '</tr>';
                });

                html += '</tbody></table>';
                container.innerHTML = html;

                // 삭제 버튼 이벤트 리스너
                container.querySelectorAll('.delete-model-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const modelName = e.target.getAttribute('data-model');
                        if (confirm(`"${modelName}" 모델을 삭제하시겠습니까?`)) {
                            await deleteModel(modelName);
                            listFinetunedModels(); // 목록 새로고침
                        }
                    });
                });

            } else {
                container.innerHTML = '<p style="color: #999;">모델 목록을 불러올 수 없습니다.</p>';
            }
        } catch (error) {
            console.error('[LLM Finetuning] Error listing models:', error);
            container.innerHTML = `<p style="color: #d32f2f;">오류: ${error.message}</p>`;
        }
    }

    /**
     * 모델 삭제
     */
    async function deleteModel(modelName) {
        try {
            const response = await fetch('/connections/api/ollama-finetuning/delete/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({ model_name: modelName })
            });

            const data = await response.json();

            if (data.success) {
                showToast(`모델 "${modelName}" 삭제 완료`, 'success');
            } else {
                throw new Error(data.error || '삭제 실패');
            }
        } catch (error) {
            console.error('[LLM Finetuning] Error deleting model:', error);
            showToast(`모델 삭제 실패: ${error.message}`, 'error');
        }
    }

    // ===== 유틸리티 함수 =====

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeForModelfile(text) {
        // Modelfile에서 특수문자 이스케이프
        return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function formatTimestamp(timestamp) {
        if (!timestamp) return '-';
        try {
            const date = new Date(timestamp);
            return date.toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return timestamp;
        }
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function getCsrfToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    }

    // ===== 이벤트 리스너 설정 =====

    setTimeout(() => {
        console.log('[LLM Finetuning] Setting up event listeners...');

        // Step 1: 피드백 데이터 로드
        const loadFeedbackBtn = document.getElementById('load-feedback-data-btn');
        if (loadFeedbackBtn) {
            loadFeedbackBtn.addEventListener('click', loadFeedbackData);
        }

        // Step 2: Modelfile 생성
        const generateModelfileBtn = document.getElementById('generate-modelfile-btn');
        if (generateModelfileBtn) {
            generateModelfileBtn.addEventListener('click', generateModelfile);
        }

        // Step 3: 파인튜닝 시작
        const startFinetuningBtn = document.getElementById('start-finetuning-btn');
        if (startFinetuningBtn) {
            startFinetuningBtn.addEventListener('click', startFinetuning);
        }

        // Step 4: 모델 목록 조회
        const listModelsBtn = document.getElementById('list-finetuned-models-btn');
        if (listModelsBtn) {
            listModelsBtn.addEventListener('click', listFinetunedModels);
        }

        console.log('[LLM Finetuning] Event listeners attached successfully');
    }, 1000);

})();
