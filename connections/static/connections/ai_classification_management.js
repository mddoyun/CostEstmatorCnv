// ai_classification_management.js
// AI 기반 자동 분류 시스템 관리

import { getCsrfToken } from './csrf_token.js';

// 전역 상태
window.aiClassificationState = {
    currentProjectId: null,
    trainingStats: null,
    models: [],
    activeModel: null,
    trainingInProgress: false,
};

// ============================================================================
// 1. 학습 데이터 통계 조회
// ============================================================================
export async function loadTrainingDataStats(projectId) {
    try {
        const response = await fetch(`/connections/api/ai-classification/training-data/stats/${projectId}/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load training data stats: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success) {
            window.aiClassificationState.trainingStats = data;
            renderTrainingDataStats(data);
            return data;
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('[AI Classification] Error loading training stats:', error);
        alert(`학습 데이터 통계 로드 실패: ${error.message}`);
        return null;
    }
}

function renderTrainingDataStats(stats) {
    const container = document.getElementById('aiTrainingStatsContainer');
    if (!container) return;

    const html = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">총 학습 데이터</div>
                <div class="stat-value">${stats.total_samples}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">검증된 데이터</div>
                <div class="stat-value">${stats.validated_samples}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">수동 입력</div>
                <div class="stat-value">${stats.by_source.manual}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">룰셋 기반</div>
                <div class="stat-value">${stats.by_source.ruleset}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">AI 수정</div>
                <div class="stat-value">${stats.by_source.ai_corrected}</div>
            </div>
        </div>

        <div class="tag-distribution">
            <h4>분류 태그별 데이터 분포</h4>
            <div class="distribution-chart">
                ${stats.tag_distribution.map(item => `
                    <div class="distribution-item">
                        <span class="tag-name">${item.tag}</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(100, (item.count / stats.total_samples) * 100)}%"></div>
                        </div>
                        <span class="tag-count">${item.count}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================================================
// 2. 학습 데이터 추가 (룰셋 적용 결과를 학습 데이터로 변환)
// ============================================================================
export async function addTrainingDataFromClassification(projectId, rawElementIds, tagNames, dataSource = 'ruleset', isValidated = false) {
    try {
        const response = await fetch(`/connections/api/ai-classification/training-data/${projectId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            body: JSON.stringify({
                raw_element_ids: rawElementIds,
                tag_names: tagNames,
                data_source: dataSource,
                is_validated: isValidated,
            })
        });

        const data = await response.json();
        if (data.success) {
            console.log(`[AI Classification] Added ${data.created_count} training samples`);
            return data;
        } else {
            throw new Error(data.error || 'Failed to add training data');
        }
    } catch (error) {
        console.error('[AI Classification] Error adding training data:', error);
        throw error;
    }
}

// ============================================================================
// 3. 모델 학습
// ============================================================================
export async function startModelTraining(projectId, modelName, description, hyperparameters = {}) {
    try {
        // 기본 하이퍼파라미터
        const defaultHyperparams = {
            iterations: 500,
            depth: 6,
            learning_rate: 0.1,
        };

        const finalHyperparams = { ...defaultHyperparams, ...hyperparameters };

        const response = await fetch(`/connections/api/ai-classification/train/${projectId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            body: JSON.stringify({
                model_name: modelName,
                description: description,
                hyperparameters: finalHyperparams,
                test_size: 0.2,
            })
        });

        const data = await response.json();
        if (data.success) {
            window.aiClassificationState.trainingInProgress = true;
            console.log('[AI Classification] Training started');

            // 학습 진행률 모니터링 시작
            monitorTrainingProgress(projectId);
            return data;
        } else {
            throw new Error(data.error || 'Failed to start training');
        }
    } catch (error) {
        console.error('[AI Classification] Error starting training:', error);
        alert(`모델 학습 시작 실패: ${error.message}`);
        throw error;
    }
}

function monitorTrainingProgress(projectId) {
    const progressModal = document.getElementById('aiTrainingProgressModal');
    const progressBar = document.getElementById('aiTrainingProgressBar');
    const progressText = document.getElementById('aiTrainingProgressText');
    const progressMessage = document.getElementById('aiTrainingProgressMessage');

    if (progressModal) {
        progressModal.style.display = 'flex';
    }

    const intervalId = setInterval(async () => {
        try {
            const response = await fetch(`/connections/api/ai-classification/training-status/${projectId}/`);
            const data = await response.json();

            if (progressBar) {
                progressBar.style.width = `${data.progress}%`;
            }
            if (progressText) {
                progressText.textContent = `${data.progress}%`;
            }
            if (progressMessage) {
                progressMessage.textContent = data.message || '학습 중...';
            }

            if (!data.is_training) {
                clearInterval(intervalId);
                window.aiClassificationState.trainingInProgress = false;

                if (data.error) {
                    if (progressMessage) {
                        progressMessage.textContent = `학습 실패: ${data.error}`;
                        progressMessage.style.color = '#f44336';
                    }
                    setTimeout(() => {
                        if (progressModal) progressModal.style.display = 'none';
                        alert(`학습 실패: ${data.error}`);
                    }, 3000);
                } else {
                    if (progressMessage) {
                        progressMessage.textContent = '학습 완료!';
                        progressMessage.style.color = '#4caf50';
                    }
                    setTimeout(() => {
                        if (progressModal) progressModal.style.display = 'none';
                        // 모델 목록 새로고침
                        loadClassificationModels(projectId);
                        alert('모델 학습이 완료되었습니다!');
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('[AI Classification] Error monitoring training:', error);
            clearInterval(intervalId);
            window.aiClassificationState.trainingInProgress = false;
            if (progressModal) progressModal.style.display = 'none';
        }
    }, 1000); // 1초마다 체크
}

// ============================================================================
// 4. 모델 목록 조회
// ============================================================================
export async function loadClassificationModels(projectId) {
    try {
        const response = await fetch(`/connections/api/ai-classification/models/${projectId}/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();
        if (data.success) {
            window.aiClassificationState.models = data.models;
            window.aiClassificationState.activeModel = data.models.find(m => m.is_active);
            renderModelsList(data.models);
            return data.models;
        } else {
            throw new Error(data.error || 'Failed to load models');
        }
    } catch (error) {
        console.error('[AI Classification] Error loading models:', error);
        alert(`모델 목록 로드 실패: ${error.message}`);
        return [];
    }
}

function renderModelsList(models) {
    const container = document.getElementById('aiModelsListContainer');
    if (!container) return;

    if (models.length === 0) {
        container.innerHTML = '<div class="empty-state">학습된 모델이 없습니다. 먼저 모델을 학습해주세요.</div>';
        return;
    }

    const html = `
        <div class="models-list">
            ${models.map(model => `
                <div class="model-card ${model.is_active ? 'active' : ''}">
                    <div class="model-header">
                        <div class="model-title">
                            <h4>${model.name}</h4>
                            ${model.is_active ? '<span class="badge badge-success">활성</span>' : ''}
                        </div>
                        <div class="model-actions">
                            ${!model.is_active ? `<button class="btn btn-sm btn-primary" onclick="window.aiClassificationManagement.activateModel('${window.currentProjectId}', '${model.id}')">활성화</button>` : ''}
                            <button class="btn btn-sm btn-secondary" onclick="window.aiClassificationManagement.showModelDetails('${model.id}')">상세보기</button>
                        </div>
                    </div>
                    <div class="model-info">
                        <p>${model.description || '설명 없음'}</p>
                        <div class="model-meta">
                            <span>버전: ${model.version}</span>
                            <span>학습 샘플: ${model.training_samples_count}개</span>
                            <span>학습일: ${new Date(model.training_date).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="model-metrics">
                        <div class="metric">
                            <span class="metric-label">F1 Score (Macro)</span>
                            <span class="metric-value">${(model.metrics.f1_macro * 100).toFixed(2)}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">F1 Score (Micro)</span>
                            <span class="metric-value">${(model.metrics.f1_micro * 100).toFixed(2)}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">정밀도</span>
                            <span class="metric-value">${(model.metrics.precision_macro * 100).toFixed(2)}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">재현율</span>
                            <span class="metric-value">${(model.metrics.recall_macro * 100).toFixed(2)}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Hamming Loss</span>
                            <span class="metric-value">${(model.metrics.hamming_loss * 100).toFixed(2)}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">완전 정확도</span>
                            <span class="metric-value">${(model.metrics.subset_accuracy * 100).toFixed(2)}%</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;
}

// ============================================================================
// 5. 모델 상세 정보 조회
// ============================================================================
export async function showModelDetails(modelId) {
    try {
        const projectId = window.currentProjectId;
        const response = await fetch(`/connections/api/ai-classification/models/${projectId}/${modelId}/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();
        if (data.success) {
            renderModelDetailsModal(data.model);
        } else {
            throw new Error(data.error || 'Failed to load model details');
        }
    } catch (error) {
        console.error('[AI Classification] Error loading model details:', error);
        alert(`모델 상세 정보 로드 실패: ${error.message}`);
    }
}

function renderModelDetailsModal(model) {
    const modal = document.getElementById('aiModelDetailsModal');
    const content = document.getElementById('aiModelDetailsContent');

    if (!modal || !content) {
        console.error('[AI Classification] Model details modal not found');
        return;
    }

    const metrics = model.metrics;

    let html = `
        <div class="model-details">
            <h3>${model.name} v${model.version}</h3>
            <p>${model.description || '설명 없음'}</p>

            <div class="details-section">
                <h4>학습 정보</h4>
                <table class="details-table">
                    <tr>
                        <td>학습 샘플 수</td>
                        <td>${model.training_samples_count}개</td>
                    </tr>
                    <tr>
                        <td>학습 일시</td>
                        <td>${new Date(model.training_date).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td>상태</td>
                        <td>${model.is_active ? '<span class="badge badge-success">활성</span>' : '<span class="badge badge-secondary">비활성</span>'}</td>
                    </tr>
                </table>
            </div>

            <div class="details-section">
                <h4>하이퍼파라미터</h4>
                <table class="details-table">
                    ${Object.entries(model.hyperparameters).map(([key, value]) => `
                        <tr>
                            <td>${key}</td>
                            <td>${value}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>

            <div class="details-section">
                <h4>전체 성능 지표</h4>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-label">F1 Score (Macro)</div>
                        <div class="metric-value">${(metrics.f1_macro * 100).toFixed(2)}%</div>
                        <div class="metric-description">각 레이블별 평균 (레이블 불균형 고려)</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">F1 Score (Micro)</div>
                        <div class="metric-value">${(metrics.f1_micro * 100).toFixed(2)}%</div>
                        <div class="metric-description">전체 예측 기준</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">정밀도 (Precision)</div>
                        <div class="metric-value">${(metrics.precision_macro * 100).toFixed(2)}%</div>
                        <div class="metric-description">예측한 것 중 정확한 비율</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">재현율 (Recall)</div>
                        <div class="metric-value">${(metrics.recall_macro * 100).toFixed(2)}%</div>
                        <div class="metric-description">실제 정답 중 찾아낸 비율</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Hamming Loss</div>
                        <div class="metric-value">${(metrics.hamming_loss * 100).toFixed(2)}%</div>
                        <div class="metric-description">잘못 예측된 레이블 비율 (낮을수록 좋음)</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">완전 정확도</div>
                        <div class="metric-value">${(metrics.subset_accuracy * 100).toFixed(2)}%</div>
                        <div class="metric-description">모든 레이블을 정확히 맞춘 비율</div>
                    </div>
                </div>
            </div>
    `;

    // 레이블별 성능
    if (metrics.per_label_metrics) {
        html += `
            <div class="details-section">
                <h4>레이블별 성능</h4>
                <table class="per-label-table">
                    <thead>
                        <tr>
                            <th>분류 태그</th>
                            <th>F1 Score</th>
                            <th>정밀도</th>
                            <th>재현율</th>
                            <th>샘플 수</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(metrics.per_label_metrics).map(([label, m]) => `
                            <tr>
                                <td>${label}</td>
                                <td>${(m.f1 * 100).toFixed(2)}%</td>
                                <td>${(m.precision * 100).toFixed(2)}%</td>
                                <td>${(m.recall * 100).toFixed(2)}%</td>
                                <td>${m.support}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Feature Importance
    if (metrics.feature_importance) {
        const topFeatures = Object.entries(metrics.feature_importance)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        html += `
            <div class="details-section">
                <h4>중요 피처 Top 10</h4>
                <div class="feature-importance-chart">
                    ${topFeatures.map(([feature, importance]) => `
                        <div class="feature-item">
                            <span class="feature-name">${feature}</span>
                            <div class="importance-bar">
                                <div class="importance-fill" style="width: ${(importance / topFeatures[0][1]) * 100}%"></div>
                            </div>
                            <span class="importance-value">${importance.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    html += `</div>`;

    content.innerHTML = html;
    modal.style.display = 'flex';
}

// ============================================================================
// 6. 모델 활성화
// ============================================================================
export async function activateModel(projectId, modelId) {
    try {
        const response = await fetch(`/connections/api/ai-classification/models/${projectId}/${modelId}/activate/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            }
        });

        const data = await response.json();
        if (data.success) {
            console.log('[AI Classification] Model activated');
            alert('모델이 활성화되었습니다.');
            loadClassificationModels(projectId);
        } else {
            throw new Error(data.error || 'Failed to activate model');
        }
    } catch (error) {
        console.error('[AI Classification] Error activating model:', error);
        alert(`모델 활성화 실패: ${error.message}`);
    }
}

// ============================================================================
// 7. 자동 분류 예측 실행
// ============================================================================
export async function predictClassifications(projectId, rawElementIds, threshold = 0.5, autoAssign = false) {
    try {
        const response = await fetch(`/connections/api/ai-classification/predict/${projectId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            body: JSON.stringify({
                raw_element_ids: rawElementIds,
                threshold: threshold,
                auto_assign: autoAssign,
            })
        });

        const data = await response.json();
        if (data.success) {
            console.log(`[AI Classification] Predicted ${data.count} elements`);
            return data.predictions;
        } else {
            throw new Error(data.error || 'Failed to predict classifications');
        }
    } catch (error) {
        console.error('[AI Classification] Error predicting:', error);
        alert(`자동 분류 예측 실패: ${error.message}`);
        throw error;
    }
}

// ============================================================================
// 8. 예측 결과 확인/수정
// ============================================================================
export async function confirmPrediction(projectId, predictionId, correctedTagNames = null, addToTraining = true) {
    try {
        const response = await fetch(`/connections/api/ai-classification/prediction/${projectId}/${predictionId}/confirm/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            body: JSON.stringify({
                corrected_tag_names: correctedTagNames,
                add_to_training: addToTraining,
            })
        });

        const data = await response.json();
        if (data.success) {
            console.log('[AI Classification] Prediction confirmed');
            return data;
        } else {
            throw new Error(data.error || 'Failed to confirm prediction');
        }
    } catch (error) {
        console.error('[AI Classification] Error confirming prediction:', error);
        throw error;
    }
}

// ============================================================================
// UI 초기화
// ============================================================================
export function initAIClassificationManagement(projectId) {
    console.log('[AI Classification] Initializing management UI for project:', projectId);
    window.currentProjectId = projectId;
    window.aiClassificationState.currentProjectId = projectId;

    // 학습 데이터 통계 로드
    loadTrainingDataStats(projectId);

    // 모델 목록 로드
    loadClassificationModels(projectId);
}

// 전역 접근을 위한 export
window.aiClassificationManagement = {
    initAIClassificationManagement,
    loadTrainingDataStats,
    startModelTraining,
    loadClassificationModels,
    showModelDetails,
    activateModel,
    predictClassifications,
    confirmPrediction,
    addTrainingDataFromClassification,
};
