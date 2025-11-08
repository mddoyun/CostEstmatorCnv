// =====================================================================
// Embedding Fine-tuning Handler
// Handles Sentence Transformer fine-tuning for AI v2 object selection
// =====================================================================

// Global variables
let loadedTrainingDataForEmbedding = [];
let currentFinetunedEmbeddingModels = [];
let activeEmbeddingModelPath = null;
let embeddingFinetuningInProgress = false;

// Load training data for display
async function loadTrainingDataForEmbedding() {
    if (!currentProjectId) {
        showToast('프로젝트를 먼저 선택하세요.', 'error');
        return;
    }

    console.log('[Embedding FT] Loading training data...');

    try {
        const response = await fetch(
            `/connections/api/v2/ai/training-data/${currentProjectId}/`
        );

        if (!response.ok) {
            throw new Error('학습 데이터 로딩 실패');
        }

        const data = await response.json();
        loadedTrainingDataForEmbedding = data.training_data || [];

        console.log(`[Embedding FT] Loaded ${loadedTrainingDataForEmbedding.length} training samples`);

        // Update count label
        const countLabel = document.getElementById('training-data-count');
        if (countLabel) {
            countLabel.textContent = `총 ${loadedTrainingDataForEmbedding.length}개 샘플`;
        }

        // Render training data preview
        renderTrainingDataPreview(loadedTrainingDataForEmbedding);

        showToast(`학습 데이터 ${loadedTrainingDataForEmbedding.length}개를 불러왔습니다.`, 'success');
    } catch (error) {
        console.error('[Embedding FT] Error loading training data:', error);
        showToast(error.message, 'error');
    }
}

// Render training data preview
function renderTrainingDataPreview(trainingData) {
    const container = document.getElementById('training-data-preview');
    if (!container) return;

    if (trainingData.length === 0) {
        container.innerHTML = '<p style="color: #999;">학습 데이터가 없습니다. AI v2 기능을 사용하여 피드백 데이터를 생성하세요.</p>';
        return;
    }

    // Group by prompt
    const groupedData = {};
    trainingData.forEach(td => {
        const prompt = td.prompt;
        if (!groupedData[prompt]) {
            groupedData[prompt] = {
                prompt: prompt,
                count: 0,
                correct_count: 0,
                samples: []
            };
        }
        groupedData[prompt].count++;
        groupedData[prompt].correct_count += (td.correct_ids || []).length;
        groupedData[prompt].samples.push(td);
    });

    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';

    for (const [prompt, data] of Object.entries(groupedData)) {
        html += `
            <div style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; background: #fff;">
                <div style="font-weight: bold; margin-bottom: 5px;">${escapeHtml(prompt)}</div>
                <div style="font-size: 12px; color: #666;">
                    샘플 수: ${data.count}개 | 정답 객체: 평균 ${(data.correct_count / data.count).toFixed(1)}개
                </div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

// Start embedding fine-tuning
async function startEmbeddingFinetuning() {
    if (!currentProjectId) {
        showToast('프로젝트를 먼저 선택하세요.', 'error');
        return;
    }

    if (embeddingFinetuningInProgress) {
        showToast('이미 파인튜닝이 진행 중입니다.', 'warning');
        return;
    }

    // Get configuration
    const baseModel = document.getElementById('embedding-base-model')?.value || 'paraphrase-multilingual-MiniLM-L12-v2';
    const modelName = document.getElementById('embedding-model-name')?.value.trim();
    const epochs = parseInt(document.getElementById('embedding-epochs')?.value) || 3;
    const batchSize = parseInt(document.getElementById('embedding-batch-size')?.value) || 16;

    // Validate
    if (!modelName) {
        showToast('모델 이름을 입력하세요.', 'error');
        return;
    }

    if (loadedTrainingDataForEmbedding.length < 10) {
        showToast('최소 10개 이상의 학습 데이터가 필요합니다. 현재: ' + loadedTrainingDataForEmbedding.length + '개', 'error');
        return;
    }

    console.log('[Embedding FT] Starting fine-tuning...', {
        baseModel, modelName, epochs, batchSize,
        trainingDataCount: loadedTrainingDataForEmbedding.length
    });

    // Show progress UI
    const progressDiv = document.getElementById('embedding-finetuning-progress');
    const resultDiv = document.getElementById('embedding-finetuning-result');
    if (progressDiv) progressDiv.style.display = 'block';
    if (resultDiv) resultDiv.style.display = 'none';

    updateEmbeddingProgress('파인튜닝 시작 중...', 0);

    embeddingFinetuningInProgress = true;

    try {
        const response = await fetch(
            `/connections/api/v2/ai/finetune-model/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': window.csrftoken
                },
                body: JSON.stringify({
                    project_id: currentProjectId,
                    base_model_name: baseModel,
                    model_name: modelName,
                    epochs: epochs,
                    batch_size: batchSize
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || '파인튜닝 시작 실패');
        }

        console.log('[Embedding FT] Fine-tuning result:', result);

        // Update progress to 100%
        updateEmbeddingProgress('파인튜닝 완료!', 100);

        // Hide progress, show result
        if (progressDiv) {
            setTimeout(() => {
                progressDiv.style.display = 'none';
            }, 1000);
        }

        // Show result
        if (resultDiv) {
            const detailsDiv = document.getElementById('embedding-result-details');
            if (detailsDiv) {
                detailsDiv.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 10px;">
                        <div><strong>모델 경로:</strong> ${escapeHtml(result.model_path)}</div>
                        <div><strong>베이스 모델:</strong> ${escapeHtml(result.stats.base_model)}</div>
                        <div><strong>학습 샘플:</strong> ${result.stats.training_samples}개</div>
                        <div><strong>학습 예시:</strong> ${result.stats.training_examples}개</div>
                        <div><strong>에포크:</strong> ${result.stats.epochs}</div>
                        <div><strong>배치 크기:</strong> ${result.stats.batch_size}</div>
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        생성일: ${new Date(result.stats.timestamp).toLocaleString('ko-KR')}
                    </div>
                `;
            }
            resultDiv.style.display = 'block';

            // Store model path for activation
            resultDiv.dataset.modelPath = result.model_path;
        }

        showToast('파인튜닝이 완료되었습니다!', 'success');

        // Refresh models list
        await refreshEmbeddingModels();

    } catch (error) {
        console.error('[Embedding FT] Error:', error);
        showToast(error.message, 'error');

        updateEmbeddingProgress('오류: ' + error.message, 0);

        if (progressDiv) {
            setTimeout(() => {
                progressDiv.style.display = 'none';
            }, 2000);
        }
    } finally {
        embeddingFinetuningInProgress = false;
    }
}

// Update embedding fine-tuning progress
function updateEmbeddingProgress(text, percentage) {
    const textElem = document.getElementById('embedding-progress-text');
    const barElem = document.getElementById('embedding-progress-bar');
    const detailsElem = document.getElementById('embedding-progress-details');

    if (textElem) textElem.textContent = text;
    if (barElem) barElem.style.width = percentage + '%';
    if (detailsElem) {
        const timestamp = new Date().toLocaleTimeString('ko-KR');
        detailsElem.innerHTML += `[${timestamp}] ${escapeHtml(text)}<br>`;
        detailsElem.scrollTop = detailsElem.scrollHeight;
    }
}

// Refresh embedding models list
async function refreshEmbeddingModels() {
    console.log('[Embedding FT] Refreshing models list...');

    try {
        const response = await fetch(
            `/connections/api/v2/ai/list-models/`
        );

        if (!response.ok) {
            throw new Error('모델 목록 조회 실패');
        }

        const data = await response.json();
        currentFinetunedEmbeddingModels = data.models || [];

        console.log(`[Embedding FT] Found ${currentFinetunedEmbeddingModels.length} models`);

        // Get active model info
        if (data.active_model) {
            activeEmbeddingModelPath = data.active_model;
            const activeModelName = document.getElementById('active-embedding-model-name');
            if (activeModelName) {
                activeModelName.textContent = data.active_model;
            }
        }

        // Render table
        renderEmbeddingModelsTable(currentFinetunedEmbeddingModels);

        showToast(`${currentFinetunedEmbeddingModels.length}개의 모델을 찾았습니다.`, 'success');

    } catch (error) {
        console.error('[Embedding FT] Error refreshing models:', error);
        showToast(error.message, 'error');
    }
}

// Render embedding models table
function renderEmbeddingModelsTable(models) {
    const tbody = document.getElementById('embedding-models-tbody');
    if (!tbody) return;

    if (models.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="padding: 20px; text-align: center; color: #999;">
                    파인튜닝된 모델이 없습니다. 3단계에서 파인튜닝을 진행하세요.
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    models.forEach(model => {
        const isActive = model.path === activeEmbeddingModelPath;
        const timestamp = new Date(model.timestamp).toLocaleDateString('ko-KR');

        html += `
            <tr data-model-path="${escapeHtml(model.path)}">
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(model.name)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 11px;">${escapeHtml(model.base_model)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${model.training_samples}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${model.training_examples}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${model.epochs}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${timestamp}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
                    ${isActive ? '<span style="color: #4caf50; font-weight: bold;">✓</span>' : '-'}
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
                    ${!isActive ? `<button class="activate-embedding-model-btn" data-model-path="${escapeHtml(model.path)}">활성화</button>` : ''}
                    <button class="delete-embedding-model-btn" data-model-path="${escapeHtml(model.path)}">삭제</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// Activate fine-tuned embedding model
async function activateEmbeddingModel(modelPath) {
    if (!modelPath) {
        // Get from result div
        const resultDiv = document.getElementById('embedding-finetuning-result');
        if (resultDiv && resultDiv.dataset.modelPath) {
            modelPath = resultDiv.dataset.modelPath;
        } else {
            showToast('활성화할 모델 경로를 찾을 수 없습니다.', 'error');
            return;
        }
    }

    console.log('[Embedding FT] Activating model:', modelPath);

    try {
        const response = await fetch(
            `/connections/api/v2/ai/use-model/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': window.csrftoken
                },
                body: JSON.stringify({
                    model_path: modelPath
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || '모델 활성화 실패');
        }

        console.log('[Embedding FT] Model activated:', result);

        activeEmbeddingModelPath = modelPath;

        // Update UI
        const activeModelName = document.getElementById('active-embedding-model-name');
        if (activeModelName) {
            activeModelName.textContent = modelPath;
        }

        showToast('모델이 활성화되었습니다. 이제 AI v2 쿼리에서 사용됩니다.', 'success');

        // Refresh table
        await refreshEmbeddingModels();

    } catch (error) {
        console.error('[Embedding FT] Error activating model:', error);
        showToast(error.message, 'error');
    }
}

// Delete embedding model
async function deleteEmbeddingModel(modelPath) {
    if (!confirm(`모델 '${modelPath}'를 삭제하시겠습니까?`)) {
        return;
    }

    console.log('[Embedding FT] Deleting model:', modelPath);

    try {
        const response = await fetch(
            `/connections/api/v2/ai/delete-model/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': window.csrftoken
                },
                body: JSON.stringify({
                    model_path: modelPath
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || '모델 삭제 실패');
        }

        console.log('[Embedding FT] Model deleted:', result);

        showToast('모델이 삭제되었습니다.', 'success');

        // Refresh table
        await refreshEmbeddingModels();

    } catch (error) {
        console.error('[Embedding FT] Error deleting model:', error);
        showToast(error.message, 'error');
    }
}

// Reset embedding fine-tuning UI
function resetEmbeddingFinetuningUI() {
    document.getElementById('embedding-model-name').value = '';
    document.getElementById('embedding-epochs').value = '3';
    document.getElementById('embedding-batch-size').value = '16';
    document.getElementById('embedding-base-model').value = 'paraphrase-multilingual-MiniLM-L12-v2';

    const progressDiv = document.getElementById('embedding-finetuning-progress');
    const resultDiv = document.getElementById('embedding-finetuning-result');

    if (progressDiv) progressDiv.style.display = 'none';
    if (resultDiv) resultDiv.style.display = 'none';

    const detailsElem = document.getElementById('embedding-progress-details');
    if (detailsElem) detailsElem.innerHTML = '';

    const barElem = document.getElementById('embedding-progress-bar');
    if (barElem) barElem.style.width = '0%';

    embeddingFinetuningInProgress = false;

    console.log('[Embedding FT] UI reset');
}

// Handle table actions
function handleEmbeddingModelsTableActions(event) {
    const target = event.target;

    if (target.classList.contains('activate-embedding-model-btn')) {
        const modelPath = target.dataset.modelPath;
        activateEmbeddingModel(modelPath);
    } else if (target.classList.contains('delete-embedding-model-btn')) {
        const modelPath = target.dataset.modelPath;
        deleteEmbeddingModel(modelPath);
    }
}

// Escape HTML for safe rendering
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
