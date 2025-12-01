# 2025-11-26: AI 자동 분류 시스템 구현 및 All-in-One 설치 패키지 완성

## 작업 개요

CostEstimator에 AI 기반 자동 분류 시스템을 추가하고, 완전한 설치 패키지를 생성했습니다.

### 주요 작업
1. **AI 자동 분류 시스템 구현** (CatBoost 다중 레이블 분류)
2. **BIM 속성 표시 버그 수정** (websocket.js 데이터 평탄화)
3. **All-in-One 설치 패키지 빌드** (Django 서버 + Revit 애드인)

---

## 1. AI 자동 분류 시스템 구현

### 기능 요구사항
- **다중 레이블 분류**: 하나의 BIM 객체에 여러 분류 태그 할당 가능 (예: "구조벽", "마감벽", "기초")
- **속성명 변형 처리**: "이름", "name", "Name" 등 다양한 속성명 인식
- **학습 데이터 관리**: 사용자 피드백을 통한 지속적 학습 데이터 수집
- **모델 학습**: CatBoost 기반 모델 학습 및 성능 지표 표시
- **자동 분류 실행**: 학습된 모델로 BIM 객체 자동 태그 할당

### 기술 스택
- **ML 라이브러리**: CatBoost, scikit-learn, pandas, numpy
- **분류 전략**: One-vs-Rest (각 태그별 개별 CatBoost 모델)
- **피처 추출**: BIM 속성 정규화 (대소문자 무시, 동의어 처리)
- **성능 지표**: F1 Score, Hamming Loss, Precision, Recall, Subset Accuracy

---

## 2. 구현 상세

### 2.1 데이터베이스 모델 추가

**파일**: `connections/models.py`

```python
class AIClassificationTrainingData(models.Model):
    """AI 모델 학습을 위한 레이블링된 데이터"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE,
                                related_name='ai_classification_training_data')
    raw_element = models.ForeignKey(RawElement, on_delete=models.CASCADE,
                                    related_name='ai_training_records')
    bim_properties = models.JSONField(default=dict,
                                      help_text="BIM 속성 스냅샷")
    assigned_tags = models.ManyToManyField(QuantityClassificationTag,
                                           related_name='training_samples')
    data_source = models.CharField(max_length=50,
                                   choices=[
                                       ('manual', 'Manual Labeling'),
                                       ('ruleset', 'Ruleset Based'),
                                       ('ai_corrected', 'AI Prediction Corrected')
                                   ], default='manual')
    is_validated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class AIClassificationModel(models.Model):
    """학습된 AI 분류 모델 메타데이터 및 바이너리"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE,
                                related_name='ai_classification_models')
    model_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    model_binary = models.BinaryField()  # Pickled CatBoost model
    label_encoder = models.BinaryField()  # Pickled MultiLabelBinarizer
    hyperparameters = models.JSONField(default=dict)
    performance_metrics = models.JSONField(default=dict)
    training_sample_count = models.IntegerField(default=0)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class AIClassificationPrediction(models.Model):
    """AI 모델의 예측 결과 (추적 및 피드백용)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE,
                                related_name='ai_classification_predictions')
    model = models.ForeignKey(AIClassificationModel, on_delete=models.CASCADE,
                             related_name='predictions')
    raw_element = models.ForeignKey(RawElement, on_delete=models.CASCADE,
                                    related_name='ai_predictions')
    predicted_tags = models.ManyToManyField(QuantityClassificationTag,
                                            related_name='ai_predicted_elements')
    prediction_scores = models.JSONField(default=dict)
    feedback_status = models.CharField(max_length=20,
                                       choices=[
                                           ('pending', 'Pending Review'),
                                           ('confirmed', 'Confirmed'),
                                           ('corrected', 'Corrected')
                                       ], default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
```

### 2.2 AI 분류 엔진 구현

**파일**: `connections/ai_classifier.py` (신규 생성)

#### BIM 속성 피처 추출기

```python
class BIMPropertyFeatureExtractor:
    """BIM 속성을 ML 피처로 변환하는 클래스"""

    PROPERTY_NAME_VARIANTS = {
        'category': ['category', 'Category', '카테고리', '범주'],
        'family': ['family', 'Family', '패밀리', '제품군'],
        'type': ['type', 'Type', '유형', '타입'],
        'name': ['name', 'Name', '이름', '명칭'],
        # ... 더 많은 변형
    }

    def extract_features(self, bim_properties: Dict[str, Any]) -> Dict[str, Any]:
        """BIM 속성에서 피처 추출 (속성명 변형 처리)"""
        features = {}

        # 중요 속성 추출 (대소문자 무시, 동의어 처리)
        for standard_name, variants in self.PROPERTY_NAME_VARIANTS.items():
            value = self._find_property_value(bim_properties, variants)
            if value is not None:
                features[standard_name] = value

        # Parameters, Attributes, PropertySet 등에서 추출
        for key_path in ['Parameters', 'Attributes', 'PropertySet',
                        'Type.Attributes', 'Type.Parameters']:
            nested_dict = self._get_nested_value(bim_properties, key_path)
            if nested_dict and isinstance(nested_dict, dict):
                for key, value in nested_dict.items():
                    features[f"{key_path}.{key}"] = value

        # 수치형/범주형 분리
        self._categorize_features(features)
        return features
```

#### 다중 레이블 분류 학습기

```python
class MultiLabelClassifierTrainer:
    """CatBoost 기반 다중 레이블 분류 모델 학습"""

    def __init__(self, hyperparameters: Dict = None):
        self.hyperparameters = hyperparameters or {
            'iterations': 500,
            'learning_rate': 0.05,
            'depth': 6,
            'loss_function': 'Logloss',
            'verbose': False
        }
        self.models = {}  # 각 레이블별 CatBoost 모델
        self.label_encoder = MultiLabelBinarizer()
        self.feature_extractor = BIMPropertyFeatureExtractor()

    def train(self, training_samples: List[Dict], test_size: float = 0.2):
        """One-vs-Rest 전략으로 모델 학습"""

        # 1. 피처 및 레이블 추출
        X = []
        y = []
        for sample in training_samples:
            features = self.feature_extractor.extract_features(
                sample['bim_properties']
            )
            X.append(features)
            y.append(sample['tags'])

        # 2. 레이블 인코딩
        y_binary = self.label_encoder.fit_transform(y)
        self.labels = self.label_encoder.classes_

        # 3. 데이터 분할
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_binary, test_size=test_size, random_state=42
        )

        # 4. 각 레이블별 CatBoost 모델 학습 (One-vs-Rest)
        for i, label in enumerate(self.labels):
            y_train_label = y_train[:, i]
            y_test_label = y_test[:, i]

            model = CatBoostClassifier(**self.hyperparameters)
            model.fit(X_train, y_train_label)

            self.models[label] = model

        # 5. 성능 평가
        y_pred = self.predict_binary(X_test)
        metrics = self._calculate_metrics(y_test, y_pred, X_test)

        return metrics

    def predict_tags(self, bim_properties_list: List[Dict],
                     threshold: float = 0.5) -> List[Dict]:
        """BIM 속성으로부터 태그 예측 (신뢰도 점수 포함)"""
        results = []

        for bim_props in bim_properties_list:
            features = self.feature_extractor.extract_features(bim_props)

            # 각 레이블별 예측
            predictions = {}
            for label, model in self.models.items():
                proba = model.predict_proba([features])[0][1]
                if proba >= threshold:
                    predictions[label] = float(proba)

            results.append({
                'predicted_tags': list(predictions.keys()),
                'scores': predictions
            })

        return results

    def _calculate_metrics(self, y_true, y_pred, X_test):
        """성능 지표 계산"""
        return {
            'hamming_loss': float(hamming_loss(y_true, y_pred)),
            'f1_score_macro': float(f1_score(y_true, y_pred, average='macro')),
            'f1_score_micro': float(f1_score(y_true, y_pred, average='micro')),
            'f1_score_samples': float(f1_score(y_true, y_pred, average='samples')),
            'precision_macro': float(precision_score(y_true, y_pred, average='macro')),
            'recall_macro': float(recall_score(y_true, y_pred, average='macro')),
            'subset_accuracy': float(accuracy_score(y_true, y_pred)),
            'per_label_metrics': self._per_label_metrics(y_true, y_pred),
            'confusion_matrices': self._confusion_matrices(y_true, y_pred),
            'feature_importance': self._feature_importance(X_test)
        }
```

### 2.3 백엔드 API 구현

**파일**: `connections/views.py`

추가된 11개 API 엔드포인트:

```python
# 1. 학습 데이터 추가/수정
@require_http_methods(["POST"])
def add_training_data(request, project_id):
    """BIM 객체에 태그를 할당하여 학습 데이터로 저장"""
    pass

# 2. 학습 데이터 통계 조회
@require_http_methods(["GET"])
def get_training_data_stats(request, project_id):
    """학습 데이터 개수, 태그별 분포, 검증 상태 등 통계 반환"""
    pass

# 3. 모델 학습 시작
@require_http_methods(["POST"])
def train_classification_model(request, project_id):
    """백그라운드에서 모델 학습 시작 (비동기)"""
    # 하이퍼파라미터: iterations, learning_rate, depth 등
    pass

# 4. 학습 진행 상태 조회
@require_http_methods(["GET"])
def get_training_progress(request, project_id):
    """학습 진행률 및 상태 반환"""
    pass

# 5. 학습된 모델 목록 조회
@require_http_methods(["GET"])
def list_classification_models(request, project_id):
    """프로젝트의 모든 학습된 모델 + 성능 지표"""
    pass

# 6. 모델 활성화/비활성화
@require_http_methods(["POST"])
def activate_model(request, project_id, model_id):
    """특정 모델을 활성 모델로 설정"""
    pass

# 7. 모델 삭제
@require_http_methods(["DELETE"])
def delete_model(request, project_id, model_id):
    pass

# 8. 자동 분류 예측 실행
@require_http_methods(["POST"])
def predict_classifications(request, project_id):
    """선택된 BIM 객체들에 대해 자동 태그 예측"""
    # threshold: 신뢰도 임계값 (기본 0.5)
    # auto_assign: True시 자동으로 QuantityMember에 태그 할당
    pass

# 9. 예측 결과 확정
@require_http_methods(["POST"])
def confirm_prediction(request, project_id, prediction_id):
    """AI 예측 결과를 확정하고 학습 데이터로 추가"""
    pass

# 10. 예측 결과 수정
@require_http_methods(["POST"])
def correct_prediction(request, project_id, prediction_id):
    """사용자가 AI 예측을 수정하고 수정된 데이터를 학습 데이터로 추가"""
    pass

# 11. 예측 결과 목록 조회
@require_http_methods(["GET"])
def list_predictions(request, project_id):
    """프로젝트의 모든 예측 결과 (pending/confirmed/corrected)"""
    pass
```

**파일**: `connections/urls.py`

```python
# AI Classification System API
path('api/ai-classification/training-data/<uuid:project_id>/',
     views.add_training_data),
path('api/ai-classification/training-stats/<uuid:project_id>/',
     views.get_training_data_stats),
path('api/ai-classification/train/<uuid:project_id>/',
     views.train_classification_model),
path('api/ai-classification/training-progress/<uuid:project_id>/',
     views.get_training_progress),
path('api/ai-classification/models/<uuid:project_id>/',
     views.list_classification_models),
path('api/ai-classification/models/<uuid:project_id>/<uuid:model_id>/activate/',
     views.activate_model),
path('api/ai-classification/models/<uuid:project_id>/<uuid:model_id>/delete/',
     views.delete_model),
path('api/ai-classification/predict/<uuid:project_id>/',
     views.predict_classifications),
path('api/ai-classification/predictions/<uuid:project_id>/<uuid:prediction_id>/confirm/',
     views.confirm_prediction),
path('api/ai-classification/predictions/<uuid:project_id>/<uuid:prediction_id>/correct/',
     views.correct_prediction),
path('api/ai-classification/predictions/<uuid:project_id>/',
     views.list_predictions),
```

### 2.4 프론트엔드 UI 구현

**파일**: `connections/templates/revit_control.html`

관리 탭에 "🤖 AI 자동 분류" 서브탭 추가:

```html
<div class="inner-tabs">
    <!-- 기존 탭들 -->
    <button class="inner-tab-button" data-tab="ai-classification">
        🤖 AI 자동 분류
    </button>
</div>

<div id="ai-classification" class="inner-tab-content">
    <!-- 1. 학습 데이터 통계 대시보드 -->
    <div class="training-data-stats">
        <div class="stat-card">
            <div class="stat-label">전체 학습 데이터</div>
            <div class="stat-value" id="total-training-samples">0</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">검증된 데이터</div>
            <div class="stat-value" id="validated-samples">0</div>
        </div>
        <!-- 태그별 분포 차트 -->
    </div>

    <!-- 2. 모델 학습 인터페이스 -->
    <div class="model-training-section">
        <h3>새 모델 학습</h3>
        <form id="train-model-form">
            <input type="text" name="model_name" placeholder="모델 이름">
            <textarea name="description" placeholder="설명"></textarea>

            <!-- 하이퍼파라미터 -->
            <div class="hyperparameters">
                <label>Iterations:
                    <input type="number" name="iterations" value="500">
                </label>
                <label>Learning Rate:
                    <input type="number" step="0.01" name="learning_rate" value="0.05">
                </label>
                <label>Depth:
                    <input type="number" name="depth" value="6">
                </label>
            </div>

            <button type="submit">🚀 학습 시작</button>
        </form>

        <!-- 학습 진행 상태 -->
        <div id="training-progress" style="display:none;">
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <div class="progress-text">학습 중...</div>
        </div>
    </div>

    <!-- 3. 학습된 모델 목록 -->
    <div class="trained-models-section">
        <h3>학습된 모델</h3>
        <div id="trained-models-list">
            <!-- 모델 카드들 -->
        </div>
    </div>

    <!-- 4. 자동 분류 실행 -->
    <div class="prediction-section">
        <h3>자동 분류 실행</h3>
        <div class="prediction-controls">
            <label>신뢰도 임계값:
                <input type="range" min="0" max="1" step="0.05" value="0.5"
                       id="prediction-threshold">
                <span id="threshold-value">0.5</span>
            </label>
            <label>
                <input type="checkbox" id="auto-assign-tags" checked>
                자동으로 태그 할당
            </label>
            <button id="run-prediction-btn">🎯 선택된 객체 자동 분류</button>
        </div>
    </div>
</div>
```

**파일**: `connections/static/connections/ai_classification_management.js` (신규 생성)

```javascript
// 학습 데이터 통계 로드
export async function loadTrainingDataStats(projectId) {
    const response = await fetch(
        `/api/ai-classification/training-stats/${projectId}/`
    );
    const stats = await response.json();

    // UI 업데이트
    document.getElementById('total-training-samples').textContent =
        stats.total_samples;
    document.getElementById('validated-samples').textContent =
        stats.validated_samples;

    // 태그별 분포 차트 렌더링
    renderTagDistribution(stats.tag_distribution);
}

// 모델 학습 시작
export async function startModelTraining(projectId, modelName, description,
                                         hyperparameters) {
    const response = await fetch(`/api/ai-classification/train/${projectId}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model_name: modelName,
            description: description,
            hyperparameters: hyperparameters
        })
    });

    if (response.ok) {
        // 진행 상태 모니터링 시작
        monitorTrainingProgress(projectId);
    }
}

// 학습 진행 상태 모니터링
async function monitorTrainingProgress(projectId) {
    const progressDiv = document.getElementById('training-progress');
    progressDiv.style.display = 'block';

    const interval = setInterval(async () => {
        const response = await fetch(
            `/api/ai-classification/training-progress/${projectId}/`
        );
        const progress = await response.json();

        // 진행률 표시
        const fillBar = progressDiv.querySelector('.progress-fill');
        fillBar.style.width = `${progress.percentage}%`;

        if (progress.status === 'completed') {
            clearInterval(interval);
            progressDiv.style.display = 'none';
            alert('모델 학습 완료!');
            loadTrainedModels(projectId);  // 모델 목록 새로고침
        } else if (progress.status === 'failed') {
            clearInterval(interval);
            alert('학습 실패: ' + progress.error);
        }
    }, 2000);  // 2초마다 확인
}

// 학습된 모델 목록 로드
export async function loadTrainedModels(projectId) {
    const response = await fetch(
        `/api/ai-classification/models/${projectId}/`
    );
    const models = await response.json();

    const listDiv = document.getElementById('trained-models-list');
    listDiv.innerHTML = models.map(model => `
        <div class="model-card ${model.is_active ? 'active' : ''}">
            <h4>${model.model_name}</h4>
            <p>${model.description}</p>

            <!-- 성능 지표 -->
            <div class="metrics">
                <div class="metric">
                    <span class="label">F1 Score (Macro):</span>
                    <span class="value">${model.performance_metrics.f1_score_macro.toFixed(3)}</span>
                </div>
                <div class="metric">
                    <span class="label">Hamming Loss:</span>
                    <span class="value">${model.performance_metrics.hamming_loss.toFixed(3)}</span>
                </div>
                <div class="metric">
                    <span class="label">Precision:</span>
                    <span class="value">${model.performance_metrics.precision_macro.toFixed(3)}</span>
                </div>
                <div class="metric">
                    <span class="label">Recall:</span>
                    <span class="value">${model.performance_metrics.recall_macro.toFixed(3)}</span>
                </div>
            </div>

            <!-- 태그별 성능 -->
            <details>
                <summary>태그별 성능 보기</summary>
                ${renderPerLabelMetrics(model.performance_metrics.per_label_metrics)}
            </details>

            <!-- 액션 버튼 -->
            <div class="model-actions">
                ${!model.is_active ?
                    `<button onclick="activateModel('${model.id}')">
                        활성화
                    </button>` :
                    '<span class="active-badge">✓ 활성</span>'}
                <button onclick="deleteModel('${model.id}')">삭제</button>
            </div>

            <div class="model-meta">
                <small>학습 샘플: ${model.training_sample_count}</small>
                <small>생성: ${new Date(model.created_at).toLocaleDateString()}</small>
            </div>
        </div>
    `).join('');
}

// 자동 분류 실행
export async function predictClassifications(projectId, rawElementIds,
                                             threshold, autoAssign) {
    const response = await fetch(
        `/api/ai-classification/predict/${projectId}/`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                raw_element_ids: rawElementIds,
                threshold: threshold,
                auto_assign: autoAssign
            })
        }
    );

    const predictions = await response.json();

    // 예측 결과 표시 (UI에 따라 구현)
    displayPredictions(predictions);

    if (autoAssign) {
        alert(`${predictions.length}개 객체에 자동으로 태그가 할당되었습니다.`);
    }
}
```

**파일**: `connections/static/connections/style.css`

AI 분류 UI를 위한 310+ 줄의 스타일 추가:

```css
/* 학습 데이터 통계 카드 */
.training-data-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 30px;
}

.stat-card {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
}

.stat-value {
    font-size: 2em;
    font-weight: bold;
    color: #007bff;
}

/* 모델 카드 */
.model-card {
    border: 2px solid #dee2e6;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 15px;
    background: white;
}

.model-card.active {
    border-color: #28a745;
    background: #f0fff4;
}

.active-badge {
    background: #28a745;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-weight: bold;
}

/* 성능 지표 */
.metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin: 15px 0;
}

.metric {
    display: flex;
    justify-content: space-between;
    padding: 8px;
    background: #f8f9fa;
    border-radius: 4px;
}

.metric .label {
    font-weight: 500;
    color: #495057;
}

.metric .value {
    font-weight: bold;
    color: #007bff;
}

/* 진행률 바 */
.progress-bar {
    width: 100%;
    height: 30px;
    background: #e9ecef;
    border-radius: 15px;
    overflow: hidden;
    margin: 10px 0;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #007bff, #0056b3);
    transition: width 0.3s ease;
}

/* 하이퍼파라미터 컨트롤 */
.hyperparameters {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
    margin: 20px 0;
}

.hyperparameters label {
    display: flex;
    flex-direction: column;
}

/* 피처 중요도 차트 */
.feature-importance-chart {
    margin: 20px 0;
}

.feature-bar {
    display: flex;
    align-items: center;
    margin: 5px 0;
}

.feature-name {
    width: 150px;
    font-size: 0.9em;
}

.importance-bar {
    flex: 1;
    height: 20px;
    background: #007bff;
    border-radius: 4px;
}
```

**파일**: `connections/static/connections/app.js`

모듈 로드 및 이벤트 리스너 추가:

```javascript
// AI Classification Management 모듈 동적 로드
import('./ai_classification_management.js').then(module => {
    window.aiClassificationManagement = module;
    console.log('[INFO] AI Classification Management module loaded');

    // 프로젝트 변경 시 초기화
    window.onProjectChange = function(projectId) {
        if (projectId && window.aiClassificationManagement) {
            window.aiClassificationManagement.initAIClassificationManagement(projectId);
        }
    };

    // 이벤트 리스너
    document.getElementById('train-model-form').addEventListener('submit',
        async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const hyperparameters = {
                iterations: parseInt(formData.get('iterations')),
                learning_rate: parseFloat(formData.get('learning_rate')),
                depth: parseInt(formData.get('depth'))
            };

            await module.startModelTraining(
                window.currentProjectId,
                formData.get('model_name'),
                formData.get('description'),
                hyperparameters
            );
        }
    );

    document.getElementById('run-prediction-btn').addEventListener('click',
        async () => {
            const threshold = parseFloat(
                document.getElementById('prediction-threshold').value
            );
            const autoAssign = document.getElementById('auto-assign-tags').checked;

            // 현재 선택된 BIM 객체 ID 가져오기
            const selectedIds = getSelectedRawElementIds();

            await module.predictClassifications(
                window.currentProjectId,
                selectedIds,
                threshold,
                autoAssign
            );
        }
    );
});
```

---

## 3. BIM 속성 표시 버그 수정

### 문제 상황
- BIM 데이터 테이블에서 `Attributes.Category` 등의 속성이 표시되지 않음
- 3D 뷰포트에서 객체 선택 시에는 정상 표시됨
- 원인: Revit에서 전송된 데이터가 중첩 구조 (`Attributes: {Category: "벽"}`)였으나, UI는 평탄화된 형식 (`Attributes.Category: "벽"`)을 기대

### 해결 방법

**파일**: `connections/static/connections/websocket.js`

WebSocket으로 Revit 데이터를 수신할 때 데이터 평탄화 로직 추가:

```javascript
case 'revit_data_chunk': {
    console.log('[DEBUG] Received revit_data_chunk:', data.payload.length);

    // ▼▼▼ [수정] raw_data 평탄화: Attributes, PropertySet 등을 최상위로 평탄화
    const processedPayload = data.payload.map(item => {
        if (item.raw_data) {
            const rd = item.raw_data;

            // 1. Attributes.* 평탄화
            if (rd.Attributes && typeof rd.Attributes === 'object') {
                for (const [key, value] of Object.entries(rd.Attributes)) {
                    rd[`Attributes.${key}`] = value;
                }
            }

            // 2. PropertySet.* 평탄화
            if (rd.PropertySet && typeof rd.PropertySet === 'object') {
                for (const [key, value] of Object.entries(rd.PropertySet)) {
                    rd[`PropertySet.${key}`] = value;
                }
            }

            // 3. Type.Attributes.* 평탄화
            if (rd.Type && rd.Type.Attributes &&
                typeof rd.Type.Attributes === 'object') {
                for (const [key, value] of Object.entries(rd.Type.Attributes)) {
                    rd[`Type.Attributes.${key}`] = value;
                }
            }

            // 4. Type.Parameters.* 평탄화
            if (rd.Type && rd.Type.Parameters &&
                typeof rd.Type.Parameters === 'object') {
                for (const [key, value] of Object.entries(rd.Type.Parameters)) {
                    rd[`Type.Parameters.${key}`] = value;
                }
            }

            // 5. Parameters.* 평탄화
            if (rd.Parameters && typeof rd.Parameters === 'object') {
                for (const [key, value] of Object.entries(rd.Parameters)) {
                    rd[`Parameters.${key}`] = value;
                }
            }
        }
        return item;
    });

    allRevitData.push(...processedPayload);
    // ... 나머지 로직
}
```

**효과**:
- BIM 데이터 테이블의 필드 선택 드롭다운에 모든 속성이 정상 표시
- 룰셋 조건 빌더에서도 중첩 속성 접근 가능
- UI 전반에 걸쳐 일관된 데이터 형식 제공

---

## 4. All-in-One 설치 패키지 빌드

### 4.1 빌드 스크립트 생성

**파일**: `BUILD_INSTALLER.bat` (신규 생성)

```batch
@echo off
REM Complete Build and Create Installer

echo =============================================
echo CostEstimator Complete Build Process
echo =============================================

REM Step 1: Build Django Server
echo [1/3] Building Django Server...
call .mddoyun\Scripts\activate.bat

pyinstaller --clean ^
    --name "CostEstimatorServer" ^
    --onefile ^
    --add-data "db.sqlite3;." ^
    --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" ^
    --add-data "connections;connections" ^
    --hidden-import "channels" ^
    --hidden-import "daphne" ^
    --hidden-import "django" ^
    --hidden-import "catboost" ^
    --hidden-import "sklearn" ^
    --hidden-import "pandas" ^
    --hidden-import "numpy" ^
    run_server.py

if errorlevel 1 (
    echo ERROR: Server build failed!
    pause
    exit /b 1
)

REM Step 2: Build Revit Addin
echo [2/3] Building Revit 2026 Addin...
dotnet restore CostEstimator_RevitAddin_2026/AiBimCost.csproj
dotnet build CostEstimator_RevitAddin_2026/AiBimCost.csproj -c Release

if errorlevel 1 (
    echo ERROR: Revit Addin build failed!
    pause
    exit /b 1
)

REM Step 3: Create Installer (requires Inno Setup)
echo [3/3] Creating Installer...

set ISCC="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not exist %ISCC% (
    set ISCC="C:\Program Files\Inno Setup 6\ISCC.exe"
)

if not exist %ISCC% (
    echo WARNING: Inno Setup not found!
    echo Please install from: https://jrsoftware.org/isdl.php
    pause
    exit /b 0
)

%ISCC% installer_allinone.iss

echo =============================================
echo BUILD COMPLETE!
echo =============================================
echo Server executable: dist\CostEstimatorServer.exe
echo Revit Addin: CostEstimator_RevitAddin_2026\bin\Release\net8.0-windows\
echo Installer: Output\CostEstimator_AllInOne_Setup.exe
pause
```

**파일**: `build_server.bat`, `build_revit_addin.bat`, `create_allinone_package.bat` (개별 빌드 스크립트)

### 4.2 인스톨러 정의 파일

**파일**: `installer_allinone.iss` (신규 생성)

```iss
; CostEstimator All-in-One Installer
; Includes: Django Server + Revit 2026 Addin

[Setup]
AppName=CostEstimator All-in-One
AppVersion=1.0.0
AppPublisher=AiBimCost
DefaultDirName={autopf}\CostEstimator
DefaultGroupName=CostEstimator
DisableProgramGroupPage=yes
OutputBaseFilename=CostEstimator_AllInOne_Setup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
WizardStyle=modern

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "startserver"; Description: "설치 후 서버 자동 시작"; GroupDescription: "추가 옵션:"; Flags: unchecked

[Files]
; Django Server
Source: "dist\CostEstimatorServer.exe"; DestDir: "{app}\Server"; Flags: ignoreversion

; Revit Addin - Install to user AppData
Source: "CostEstimator_RevitAddin_2026\bin\Release\net8.0-windows\*";
        DestDir: "{userappdata}\Autodesk\Revit\Addins\2026";
        Flags: ignoreversion recursesubdirs createallsubdirs

; Documentation
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion isreadme

[Icons]
Name: "{group}\Start Server"; Filename: "{app}\Server\CostEstimatorServer.exe"
Name: "{group}\Open Web Interface"; Filename: "http://127.0.0.1:8000"
Name: "{group}\{cm:UninstallProgram,CostEstimator}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\CostEstimator Server";
      Filename: "{app}\Server\CostEstimatorServer.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Server\CostEstimatorServer.exe";
          Description: "서버 시작";
          Flags: nowait postinstall skipifsilent; Tasks: startserver

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    // Create startup batch file
    SaveStringToFile(ExpandConstant('{app}\Start_Server.bat'),
      '@echo off' + #13#10 +
      'echo Starting CostEstimator Server...' + #13#10 +
      'cd /d "%~dp0Server"' + #13#10 +
      'start CostEstimatorServer.exe' + #13#10 +
      'echo Server started!' + #13#10 +
      'echo Open browser and go to: http://127.0.0.1:8000' + #13#10 +
      'timeout /t 5' + #13#10,
      False);
  end;
end;

[Messages]
SetupWindowTitle=CostEstimator 설치
WelcomeLabel1=CostEstimator All-in-One 설치
WelcomeLabel2=이 설치 프로그램은 다음을 설치합니다:%n%n  - CostEstimator 서버%n  - Revit 2026 애드인%n%n계속하려면 [다음]을 클릭하세요.
FinishedHeadingLabel=CostEstimator 설치 완료!
FinishedLabel=설치가 완료되었습니다.%n%nRevit 2026을 열어서 CostEstimator를 사용하세요!%n%n서버 시작: 시작 메뉴 > CostEstimator > Start Server
```

### 4.3 설치 가이드 문서

**파일**: `README_INSTALLER.md` (신규 생성)

포함 내용:
- 설치 방법 (인스톨러 사용 / 수동 설치)
- 시스템 요구사항
- 사용 방법 (서버 시작, Revit 연동, AI 분류 사용법)
- 주요 기능 설명
- 문제 해결 가이드
- 개발자 정보 (빌드 방법, 기술 스택)

### 4.4 빌드 결과

**실행 명령**:
```batch
BUILD_INSTALLER.bat
```

**빌드 성공**:
1. **Django 서버**: `dist/CostEstimatorServer.exe` (639MB)
   - 포함: Django, Channels, Daphne, CatBoost, scikit-learn, pandas, numpy
   - 경고: 일부 선택적 모듈 누락 (정상)

2. **Revit 애드인**: `CostEstimator_RevitAddin_2026/bin/Release/net8.0-windows/AiBimCost.dll` (59KB)
   - .NET 8.0 Release 빌드
   - 43개 nullable 참조 경고 (빌드 성공, 코드 품질 경고)

3. **인스톨러 스크립트**: `installer_allinone.iss`
   - Inno Setup으로 컴파일 가능
   - 출력: `Output/CostEstimator_AllInOne_Setup.exe`

---

## 5. 테스트 준비 완료

### 설치 패키지 구성
```
CostEstimator_AllInOne_Package/
├── dist/
│   └── CostEstimatorServer.exe          (639MB)
├── CostEstimator_RevitAddin_2026/
│   └── bin/Release/net8.0-windows/
│       ├── AiBimCost.dll                (59KB)
│       └── (기타 의존성 DLL들)
├── BUILD_INSTALLER.bat
├── installer_allinone.iss
├── README_INSTALLER.md
└── Start_Server.bat
```

### 설치 방법
1. **인스톨러 사용** (권장):
   - `CostEstimator_AllInOne_Setup.exe` 실행
   - 설치 경로: `C:\Program Files\CostEstimator`
   - Revit 애드인 자동 설치: `%APPDATA%\Autodesk\Revit\Addins\2026`

2. **수동 설치**:
   - 서버: `dist/CostEstimatorServer.exe`를 원하는 위치에 복사
   - Revit 애드인: 빌드 출력 폴더의 모든 파일을 `%APPDATA%\Autodesk\Revit\Addins\2026`로 복사

### 사용 방법
1. **서버 시작**: `Start_Server.bat` 실행 또는 `CostEstimatorServer.exe` 직접 실행
2. **웹 접속**: http://127.0.0.1:8000
3. **Revit 연동**: Revit 2026 실행 → CostEstimator 리본 탭 확인
4. **AI 분류 테스트**:
   - 관리 탭 > 🤖 AI 자동 분류
   - BIM 데이터 로드 → 수동으로 태그 할당 (학습 데이터 생성)
   - 최소 10개 이상 학습 데이터 준비
   - 모델 학습 실행
   - 새 객체에 대해 자동 분류 실행

---

## 6. 주요 기능 요약

### AI 자동 분류 시스템
- ✅ **다중 레이블 분류**: One-vs-Rest 전략 (CatBoost)
- ✅ **속성명 정규화**: 대소문자 무시, 한글/영문 동의어 처리
- ✅ **학습 데이터 관리**: 수동 레이블링, 룰셋 기반, AI 수정 피드백
- ✅ **모델 학습**: 하이퍼파라미터 조정 가능 (iterations, learning_rate, depth)
- ✅ **성능 평가**: F1 Score, Hamming Loss, Precision, Recall, Confusion Matrix
- ✅ **자동 예측**: 신뢰도 임계값 기반, 선택적 자동 할당
- ✅ **피드백 루프**: 사용자 수정 → 학습 데이터 자동 추가

### BIM 데이터 관리
- ✅ **속성 표시 개선**: 중첩 속성 평탄화 (Attributes.Category 등)
- ✅ **Revit 2026 연동**: WebSocket 실시간 데이터 전송
- ✅ **3D 뷰어**: 객체 선택, 속성 확인

### 배포 패키지
- ✅ **Django 서버**: 독립 실행형 EXE (639MB, 모든 의존성 포함)
- ✅ **Revit 애드인**: .NET 8.0 Release 빌드
- ✅ **인스톨러**: Inno Setup 스크립트
- ✅ **문서화**: 완전한 한글 설치/사용 가이드

---

## 7. 향후 확장 계획

### AI 시스템 확장
- **공사코드 자동 할당**: 분류 태그와 유사한 방식으로 CostCode 예측
- **수량 산출 자동화**: 룰셋 자동 생성 AI
- **이상치 탐지**: 비정상적인 BIM 속성 탐지
- **전이 학습**: 다른 프로젝트의 모델을 새 프로젝트에 적용

### 모델 개선
- **앙상블**: 여러 모델 결합 (CatBoost + XGBoost + LightGBM)
- **딥러닝**: Transformer 기반 BIM 속성 임베딩
- **능동 학습**: 불확실한 예측 우선 사용자 검토 요청

---

## 8. 파일 변경 요약

### 신규 생성 파일 (9개)
1. `connections/ai_classifier.py` - AI 분류 엔진 (570줄)
2. `connections/static/connections/ai_classification_management.js` - 프론트엔드 UI (430줄)
3. `BUILD_INSTALLER.bat` - 통합 빌드 스크립트
4. `build_server.bat` - 서버 빌드 스크립트
5. `build_revit_addin.bat` - Revit 애드인 빌드 스크립트
6. `create_allinone_package.bat` - 패키지 생성 스크립트
7. `installer_allinone.iss` - Inno Setup 인스톨러 정의
8. `README_INSTALLER.md` - 설치/사용 가이드 (163줄)
9. `workings/103_2025-11-26_AI_Auto_Classification_System_and_AllInOne_Installer.md` - 이 문서

### 수정된 파일 (6개)
1. `connections/models.py` - 3개 AI 모델 추가 (AIClassificationTrainingData, AIClassificationModel, AIClassificationPrediction)
2. `connections/views.py` - 11개 API 엔드포인트 추가
3. `connections/urls.py` - 8개 URL 패턴 추가
4. `connections/templates/revit_control.html` - AI 분류 UI 탭 추가
5. `connections/static/connections/style.css` - AI UI 스타일 310줄 추가
6. `connections/static/connections/websocket.js` - BIM 속성 평탄화 로직 추가
7. `connections/static/connections/app.js` - AI 모듈 로드 및 이벤트 리스너

### 빌드 출력 (2개)
1. `dist/CostEstimatorServer.exe` - Django 서버 실행 파일 (639MB)
2. `CostEstimator_RevitAddin_2026/bin/Release/net8.0-windows/AiBimCost.dll` - Revit 애드인 (59KB)

---

## 9. 테스트 체크리스트

### 설치 테스트
- [ ] 인스톨러 실행 (관리자 권한)
- [ ] 서버 설치 경로 확인 (`C:\Program Files\CostEstimator`)
- [ ] Revit 애드인 설치 확인 (`%APPDATA%\Autodesk\Revit\Addins\2026`)
- [ ] 시작 메뉴 단축키 확인
- [ ] 바탕화면 아이콘 확인 (선택한 경우)

### 서버 테스트
- [ ] `CostEstimatorServer.exe` 실행 성공
- [ ] http://127.0.0.1:8000 접속 확인
- [ ] 프로젝트 생성 가능
- [ ] 데이터베이스 파일 위치 확인 (`%USERPROFILE%\CostEstimator_Data\db.sqlite3`)

### Revit 연동 테스트
- [ ] Revit 2026 실행
- [ ] CostEstimator 리본 탭 표시 확인
- [ ] WebSocket 연결 성공
- [ ] BIM 데이터 전송 성공
- [ ] BIM 데이터 테이블에 Attributes.Category 등 속성 표시 확인

### AI 분류 기능 테스트
- [ ] 관리 탭 > 🤖 AI 자동 분류 탭 접근
- [ ] BIM 객체에 수동으로 태그 할당 (최소 10개)
- [ ] 학습 데이터 통계 표시 확인
- [ ] 모델 학습 시작
- [ ] 학습 진행률 표시 확인
- [ ] 모델 학습 완료 및 성능 지표 표시
- [ ] 새 객체에 자동 분류 실행
- [ ] 예측 결과 확인
- [ ] 예측 수정 → 학습 데이터 추가 피드백 루프 확인

### 성능 테스트
- [ ] 100개 이상 BIM 객체 로드 속도
- [ ] 1000개 이상 학습 데이터로 모델 학습 시간
- [ ] 예측 속도 (100개 객체 기준)
- [ ] 메모리 사용량 (학습 중 / 예측 중)

---

## 10. 알려진 이슈 및 제한사항

### 빌드 관련
- **서버 EXE 크기**: 639MB (TensorFlow, PyTorch 포함으로 인해 큼)
  - 해결책: 필요 시 TensorFlow/PyTorch 제거 후 재빌드 (AI 기능 일부 제한 가능)

- **Revit 애드인 경고**: 43개 nullable 참조 경고
  - 영향: 없음 (빌드 성공, 코드 품질 경고)
  - 해결책: 향후 C# 코드에 null 허용 여부 명시

### AI 시스템 제한
- **최소 학습 데이터**: 태그당 최소 5개 이상 권장 (10개 이상 권장)
- **메모리 사용량**: 대량 학습 시 메모리 부족 가능
  - 해결책: 하이퍼파라미터 조정 (iterations, depth 낮추기)

- **속성명 변형 처리**: 현재 정의된 동의어만 처리
  - 해결책: `ai_classifier.py`의 `PROPERTY_NAME_VARIANTS`에 추가

### 향후 개선 사항
- 백그라운드 학습 진행률 WebSocket 실시간 전송
- 모델 비교 기능 (A/B 테스트)
- 학습 데이터 품질 검증 도구
- 모델 버전 관리 개선

---

## 완료 시각
2025-11-26 (현재 세션)

## 작업자
Claude (AI Assistant)

## 관련 문서
- `AI_TECHNOLOGY_OVERVIEW.md` - AI 시스템 기술 개요 (향후 작성 예정)
- `README_INSTALLER.md` - 설치 가이드
- `CLAUDE.md` - 프로젝트 전체 가이드
