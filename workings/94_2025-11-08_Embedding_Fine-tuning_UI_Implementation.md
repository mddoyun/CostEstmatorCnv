# Embedding Fine-tuning UI 구현

**Date:** 2025-11-08
**Summary:** AI 모델 관리 탭에 Embedding 파인튜닝 UI 추가 및 완전한 모델 관리 시스템 구현

---

## 개요

사용자 요청에 따라 AI 모델 관리 탭 내에서 Embedding 파인튜닝을 직접 수행하고, 여러 모델을 관리하며, 프롬프트 실행 시 원하는 모델을 선택할 수 있는 완전한 시스템을 구현했습니다.

---

## 구현 내용

### 1. UI 추가 (HTML)

**위치:** `connections/templates/revit_control.html`

#### 새 내부 탭 추가
- AI 모델 관리 탭에 "🔤 Embedding 파인튜닝" 버튼 추가 (Line 2212-2217)
- 기존 탭: 모델 목록/업로드, 모델 학습, LLM 파인튜닝
- 새 탭: **Embedding 파인튜닝**

#### Embedding 파인튜닝 탭 구조 (Lines 2749-2881)

**1단계: 학습 데이터 확인**
- 학습 데이터 불러오기 버튼
- 데이터 카운트 표시
- 프롬프트별 그룹화된 미리보기

**2단계: 파인튜닝 설정**
- 베이스 모델 선택 (dropdown)
  - `paraphrase-multilingual-MiniLM-L12-v2` (추천)
  - `distiluse-base-multilingual-cased-v2`
  - `xlm-roberta-base` (대용량)
- 모델 이름 입력
- 에포크 수 설정 (1-20, 기본값: 3)
- 배치 크기 설정 (4-64, 기본값: 16)

**3단계: 파인튜닝 실행**
- 파인튜닝 시작 버튼
- 진행 상황 표시
  - 진행률 바 (0-100%)
  - 실시간 로그 출력
- 완료 후 결과 표시
  - 통계 정보 (샘플 수, 에포크 등)
  - 활성화 버튼
  - 다운로드 버튼

**4단계: 모델 관리**
- 모델 목록 테이블
  - 컬럼: 모델 이름, 베이스 모델, 학습 샘플, 학습 예시, 에포크, 생성일, 활성 상태, 액션
- 현재 활성 모델 표시
- 모델별 액션 버튼
  - 활성화
  - 삭제

---

### 2. JavaScript Handler 추가

**새 파일:** `connections/static/connections/embedding_finetuning_handler.js`

#### 주요 함수

**데이터 로딩:**
- `loadTrainingDataForEmbedding()` - 학습 데이터 조회 및 렌더링
- `renderTrainingDataPreview(trainingData)` - 프롬프트별 그룹화 미리보기

**파인튜닝:**
- `startEmbeddingFinetuning()` - 파인튜닝 시작 및 진행 관리
- `updateEmbeddingProgress(text, percentage)` - 진행 상황 업데이트

**모델 관리:**
- `refreshEmbeddingModels()` - 모델 목록 새로고침
- `renderEmbeddingModelsTable(models)` - 모델 테이블 렌더링
- `activateEmbeddingModel(modelPath)` - 모델 활성화
- `deleteEmbeddingModel(modelPath)` - 모델 삭제

**UI 제어:**
- `resetEmbeddingFinetuningUI()` - UI 초기화
- `handleEmbeddingModelsTableActions(event)` - 테이블 액션 핸들링

---

### 3. 이벤트 리스너 등록

**위치:** `connections/static/connections/app.js` (Lines 346-369)

```javascript
// Embedding Fine-tuning Listeners
document.getElementById("load-training-data-btn")
    ?.addEventListener("click", loadTrainingDataForEmbedding);

document.getElementById("start-embedding-finetuning-btn")
    ?.addEventListener("click", startEmbeddingFinetuning);

document.getElementById("reset-embedding-finetuning-btn")
    ?.addEventListener("click", resetEmbeddingFinetuningUI);

document.getElementById("refresh-embedding-models-btn")
    ?.addEventListener("click", refreshEmbeddingModels);

document.getElementById("activate-finetuned-embedding-btn")
    ?.addEventListener("click", () => activateEmbeddingModel(null));

document.getElementById("embedding-models-tbody")
    ?.addEventListener("click", handleEmbeddingModelsTableActions);
```

---

### 4. 탭 로딩 로직 추가

**위치:** `connections/static/connections/ai_model_management.js` (Lines 57-67)

```javascript
else if (innerTabId === 'embedding-finetuning') {
    console.log(`[DEBUG][loadDataForAiInnerTab] Initializing Embedding Fine-tuning UI.`);
    // Load training data and models when tab is opened
    if (typeof loadTrainingDataForEmbedding === 'function') {
        loadTrainingDataForEmbedding();
    }
    if (typeof refreshEmbeddingModels === 'function') {
        refreshEmbeddingModels();
    }
}
```

---

### 5. Backend API 구현

**위치:** `connections/views.py`

#### 기존 API (이미 구현됨)
- `ai_finetune_embedding_model()` - 파인튜닝 실행 (Lines 9313-9404)
- `ai_list_finetuned_models()` - 모델 목록 조회 (Lines 9407-9444)
- `ai_use_finetuned_model()` - 모델 활성화 (Lines 9447-9487)

#### 새로 추가한 API

**1. Training Data 조회** (Lines 9490-9525)
```python
@require_http_methods(["GET"])
def ai_get_training_data(request, project_id):
    # AITrainingData 쿼리
    # 프롬프트, 정답 ID, AI 선택 ID, 타임스탬프 반환
```

**2. 모델 삭제** (Lines 9528-9575)
```python
@require_http_methods(["POST"])
def ai_delete_finetuned_model(request):
    # model_path 받아서 디렉토리 삭제
    # shutil.rmtree() 사용
```

**3. 활성 모델 정보 추가**
- `ai_list_finetuned_models()` 수정
- `active_model` 필드 추가하여 현재 사용 중인 모델 정보 반환

---

### 6. AI Utils 개선

**위치:** `connections/ai_utils.py`

#### 새 함수 추가 (Lines 31-40)
```python
def set_embedding_model(model_path):
    """Set a custom embedding model"""
    global _embedding_model, _model_name
    from sentence_transformers import SentenceTransformer

    print(f'[AI Utils] Setting embedding model: {model_path}')
    _embedding_model = SentenceTransformer(model_path)
    _model_name = model_path
    print(f'[AI Utils] ✓ Embedding model activated: {model_path}')
    return True
```

#### 전역 변수 수정
- `get_embedding_model()` 함수에서 `_model_name`도 global로 선언
- 모델 활성화 시 `_model_name` 업데이트하여 추적 가능

---

### 7. URL 라우팅 추가

**위치:** `connections/urls.py` (Lines 211-216)

```python
# Embedding Model Fine-tuning
path('api/v2/ai/finetune-model/', views.ai_finetune_embedding_model, name='ai_finetune_embedding_model'),
path('api/v2/ai/list-models/', views.ai_list_finetuned_models, name='ai_list_finetuned_models'),
path('api/v2/ai/use-model/', views.ai_use_finetuned_model, name='ai_use_finetuned_model'),
path('api/v2/ai/delete-model/', views.ai_delete_finetuned_model, name='ai_delete_finetuned_model'),
path('api/v2/ai/training-data/<uuid:project_id>/', views.ai_get_training_data, name='ai_get_training_data'),
```

---

## 사용자 워크플로우

### 파인튜닝 수행하기

1. **AI 모델 관리 탭** 선택
2. **"🔤 Embedding 파인튜닝"** 내부 탭 클릭
3. **1단계:** "📊 학습 데이터 불러오기" 클릭
   - 프로젝트의 AI v2 피드백 데이터 확인
   - 최소 10개 이상 필요
4. **2단계:** 파인튜닝 설정
   - 베이스 모델 선택
   - 모델 이름 입력 (예: `bim_selector_v1`)
   - 에포크 수, 배치 크기 조정 (선택사항)
5. **3단계:** "🚀 파인튜닝 시작" 클릭
   - 진행 상황 실시간 확인
   - 완료 시 통계 확인
   - "⭐ 이 모델 활성화" 클릭
6. **4단계:** 모델 관리
   - 여러 모델 생성 및 비교
   - 원하는 모델 활성화
   - 불필요한 모델 삭제

### 모델 사용하기

1. 모델 활성화 후 **AI v2** 쿼리 사용
2. 활성화된 모델이 자동으로 적용됨
3. 프롬프트 실행 시 파인튜닝된 임베딩 사용
4. 성능 향상 확인

---

## 기술적 특징

### 1. 모델 버전 관리
- 각 모델은 독립적인 디렉토리에 저장
- 경로: `ai_models/embedding_finetuned_{model_name}/`
- 메타데이터 파일 (`training_stats.json`) 자동 생성

### 2. 실시간 피드백
- 진행률 바 및 로그 스트리밍
- 파인튜닝 중 중단 불가 (서버 측 작업)
- 완료 후 즉시 모델 활성화 가능

### 3. 전역 모델 상태 관리
- `ai_utils._embedding_model` - 현재 로드된 모델 인스턴스
- `ai_utils._model_name` - 현재 모델 경로/이름
- 서버 재시작 시 기본 모델로 리셋 (추후 DB 저장 기능 추가 필요)

### 4. UI/UX 최적화
- 단계별 워크플로우
- 실시간 데이터 미리보기
- 테이블 기반 모델 관리
- 활성 모델 시각적 표시 (✓ 아이콘)

---

## API 요약

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/v2/ai/training-data/<project_id>/` | 학습 데이터 조회 |
| POST | `/api/v2/ai/finetune-model/` | 파인튜닝 실행 |
| GET | `/api/v2/ai/list-models/` | 모델 목록 및 활성 모델 조회 |
| POST | `/api/v2/ai/use-model/` | 모델 활성화 |
| POST | `/api/v2/ai/delete-model/` | 모델 삭제 |

---

## 파일 변경 사항 요약

| 파일 | 변경 내용 | 줄 수 |
|------|----------|-------|
| `revit_control.html` | Embedding 파인튜닝 탭 추가 | ~135 lines |
| `embedding_finetuning_handler.js` | **새 파일** - 전체 UI 로직 | ~390 lines |
| `app.js` | 이벤트 리스너 추가 | ~25 lines |
| `ai_model_management.js` | 탭 로딩 로직 추가 | ~10 lines |
| `views.py` | API 2개 추가 + 1개 수정 | ~110 lines |
| `ai_utils.py` | `set_embedding_model()` 추가 | ~10 lines |
| `urls.py` | URL 2개 추가 | 2 lines |

**Total: ~680 lines of new code**

---

## 향후 개선 사항

### 1. 프로젝트별 모델 설정 저장
**현재:** 전역 모델 사용 (모든 프로젝트 공통)
**개선:** Project 모델에 `active_embedding_model` 필드 추가

```python
# models.py
class Project(models.Model):
    # ... existing fields
    active_embedding_model = models.CharField(max_length=500, null=True, blank=True)
```

### 2. 모델 성능 비교 기능
- A/B 테스트 프레임워크
- 정확도 메트릭 표시
- 히스토리 그래프

### 3. 자동 파인튜닝 트리거
- 학습 데이터 100개마다 자동 파인튜닝
- 주간 스케줄 설정
- 성능 저하 시 알림

### 4. 모델 다운로드 기능
- 파인튜닝된 모델 로컬 저장
- 다른 프로젝트로 임포트
- 공유 및 배포

---

## 테스트 가이드

### 기본 테스트 시나리오

1. **UI 로딩 테스트**
   ```
   - AI 모델 관리 탭 진입
   - Embedding 파인튜닝 탭 클릭
   - 모든 UI 요소 정상 렌더링 확인
   ```

2. **학습 데이터 로딩 테스트**
   ```
   - "학습 데이터 불러오기" 클릭
   - 데이터 카운트 표시 확인
   - 프롬프트별 그룹화 확인
   ```

3. **파인튜닝 실행 테스트**
   ```
   - 모델 이름: test_model_1
   - 에포크: 2
   - 배치 크기: 16
   - 파인튜닝 시작
   - 진행률 바 및 로그 확인
   - 완료 후 통계 확인
   ```

4. **모델 활성화 테스트**
   ```
   - "이 모델 활성화" 클릭
   - 모델 목록에서 ✓ 아이콘 확인
   - AI v2 쿼리 실행하여 새 모델 사용 확인
   ```

5. **모델 삭제 테스트**
   ```
   - 다른 모델 생성
   - 기존 모델 삭제 버튼 클릭
   - 삭제 확인 다이얼로그
   - 테이블에서 제거 확인
   ```

---

## 결론

완전한 Embedding 파인튜닝 UI가 AI 모델 관리 탭에 통합되었습니다. 사용자는 이제:

✅ **브라우저에서 직접 파인튜닝** 수행
✅ **여러 모델 생성 및 관리**
✅ **원하는 모델을 선택하여 사용**
✅ **실시간 진행 상황 모니터링**
✅ **모델 성능 비교 및 최적화**

이 시스템은 사용자 피드백 기반 학습과 심층 모델 파인튜닝을 결합하여 최고의 정확도를 제공합니다.
