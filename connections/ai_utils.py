"""
AI 학습 기반 시스템 유틸리티
- Embedding 기반 객체 선택
- 함수 분류
- 학습 데이터 관리
"""

import json
import numpy as np
from typing import List, Dict, Tuple, Optional
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import os
import pickle

# 전역 모델 인스턴스 (서버 시작 시 로드)
_embedding_model = None
_model_name = 'paraphrase-multilingual-MiniLM-L12-v2'


def get_embedding_model():
    """Embedding 모델 싱글톤 인스턴스"""
    global _embedding_model, _model_name
    if _embedding_model is None:
        print(f'[AI Utils] Loading embedding model: {_model_name}')
        _embedding_model = SentenceTransformer(_model_name)
        print('[AI Utils] ✓ Embedding model loaded successfully')
    return _embedding_model


def set_embedding_model(model_path):
    """Set a custom embedding model"""
    global _embedding_model, _model_name
    from sentence_transformers import SentenceTransformer

    print(f'[AI Utils] Setting embedding model: {model_path}')
    _embedding_model = SentenceTransformer(model_path)
    _model_name = model_path
    print(f'[AI Utils] ✓ Embedding model activated: {model_path}')
    return True


def encode_text(text: str) -> np.ndarray:
    """텍스트를 임베딩 벡터로 변환"""
    model = get_embedding_model()
    return model.encode(text, convert_to_numpy=True)


def compute_similarity(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    """두 임베딩 간 코사인 유사도 계산"""
    return float(cosine_similarity([embedding1], [embedding2])[0][0])


def predict_function(prompt: str, training_data: List[Dict]) -> Tuple[str, float]:
    """
    프롬프트에서 함수 이름 예측

    Args:
        prompt: 사용자 입력 프롬프트
        training_data: 학습 데이터 리스트 (각 항목: {prompt: str, function_name: str})

    Returns:
        (function_name, confidence) 튜플
    """
    if len(training_data) < 3:
        # 학습 데이터 부족 시 기본값 반환
        return ('select_objects', 0.5)

    # 프롬프트 임베딩
    prompt_embedding = encode_text(prompt)

    # 각 학습 데이터와 유사도 계산
    similarities = []
    for data in training_data:
        train_prompt_embedding = encode_text(data['prompt'])
        sim = compute_similarity(prompt_embedding, train_prompt_embedding)
        similarities.append({
            'function_name': data['function_name'],
            'similarity': sim
        })

    # 유사도 순으로 정렬
    similarities.sort(key=lambda x: x['similarity'], reverse=True)

    # Top-3 중 가장 많이 나오는 함수 선택 (다수결)
    top_3 = similarities[:3]
    function_votes = {}
    for item in top_3:
        func = item['function_name']
        function_votes[func] = function_votes.get(func, 0) + item['similarity']

    # 가장 높은 투표를 받은 함수 선택
    best_function = max(function_votes.items(), key=lambda x: x[1])
    confidence = best_function[1] / sum(function_votes.values())

    return (best_function[0], confidence)


def extract_object_features(raw_data: Dict, qm_data: Optional[Dict] = None) -> str:
    """
    객체의 피처를 문자열로 추출 (임베딩용)

    Args:
        raw_data: RawElement의 raw_data
        qm_data: QuantityMember 데이터 (선택)

    Returns:
        피처 문자열
    """
    features = []

    # BIM 속성
    if 'Name' in raw_data:
        features.append(raw_data['Name'])
    if 'Category' in raw_data:
        features.append(raw_data['Category'])
    if 'Family' in raw_data:
        features.append(raw_data['Family'])
    if 'Type' in raw_data:
        features.append(raw_data['Type'])

    # QM 속성
    if qm_data:
        if 'classification_tag_name' in qm_data:
            features.append(qm_data['classification_tag_name'])
        if 'properties' in qm_data and qm_data['properties']:
            for key, value in qm_data['properties'].items():
                features.append(f"{key}:{value}")

    return ' '.join(str(f) for f in features if f)


def predict_objects(
    prompt: str,
    objects_with_features: List[Dict],
    training_data: List[Dict],
    threshold: float = 0.3,
    top_k: int = 100
) -> List[str]:
    """
    프롬프트에 매칭되는 객체 ID 예측

    Args:
        prompt: 사용자 입력 프롬프트
        objects_with_features: 객체 리스트 (각 항목: {id: str, features: str})
        training_data: 학습 데이터 (각 항목: {prompt: str, correct_ids: [str]})
        threshold: 최소 유사도 임계값
        top_k: 최대 반환 객체 수

    Returns:
        선택된 객체 ID 리스트
    """
    # 프롬프트 임베딩
    prompt_embedding = encode_text(prompt)

    # 각 객체에 대해 점수 계산
    object_scores = []

    for obj in objects_with_features:
        # 객체 피처 임베딩
        obj_embedding = encode_text(obj['features'])

        # 기본 유사도
        base_similarity = compute_similarity(prompt_embedding, obj_embedding)

        # 학습 데이터 기반 가중치
        weight = compute_learned_weight(prompt, obj['id'], training_data)

        # 최종 점수
        final_score = base_similarity * weight

        object_scores.append({
            'id': obj['id'],
            'score': final_score,
            'base_similarity': base_similarity,
            'weight': weight
        })

    # 점수 순으로 정렬
    object_scores.sort(key=lambda x: x['score'], reverse=True)

    # threshold 이상인 것만 선택
    selected = [obj for obj in object_scores if obj['score'] >= threshold]

    # top_k 개만 반환
    selected_ids = [obj['id'] for obj in selected[:top_k]]

    print(f'[AI Utils] predict_objects: {len(selected_ids)} objects selected (threshold={threshold})')
    if len(selected) > 0:
        scores_str = ', '.join([f"{s['score']:.3f}" for s in selected[:3]])
        print(f'[AI Utils]   Top 3 scores: [{scores_str}]')

    return selected_ids


def compute_learned_weight(prompt: str, object_id: str, training_data: List[Dict]) -> float:
    """
    학습 데이터 기반 가중치 계산

    Args:
        prompt: 현재 프롬프트
        object_id: 객체 ID
        training_data: 학습 데이터

    Returns:
        가중치 (0.2 ~ 2.5) - Increased penalty range for better learning convergence
    """
    if len(training_data) == 0:
        return 1.0

    # 유사한 프롬프트 찾기 (첫 단어 기준)
    prompt_words = prompt.lower().split()
    if len(prompt_words) == 0:
        return 1.0

    first_word = prompt_words[0]

    # 유사한 프롬프트에서 이 객체가 정답이었던 비율
    similar_count = 0
    correct_count = 0

    for data in training_data:
        train_words = data['prompt'].lower().split()
        # 첫 단어가 정확히 일치하는 경우만 매칭
        if len(train_words) > 0 and train_words[0] == first_word:
            similar_count += 1
            if object_id in data.get('correct_ids', []):
                correct_count += 1

    if similar_count == 0:
        return 1.0

    # 가중치 계산 - Stronger penalties (0.2x) and rewards (2.5x)
    ratio = correct_count / similar_count
    weight = max(0.2, min(2.5, ratio * 2.5))

    # 디버그: 가중치 계산 과정 출력 (first 5 objects)
    if similar_count > 0:
        import random
        if random.random() < 0.02:  # 2% 확률로 출력 (너무 많은 로그 방지)
            print(f'[AI Weight] obj={object_id[:8]} similar={similar_count} correct={correct_count} ratio={ratio:.2f} weight={weight:.2f}')

    return weight


def save_model(model_data: bytes, model_path: str):
    """모델 파일 저장"""
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    with open(model_path, 'wb') as f:
        f.write(model_data)
    print(f'[AI Utils] Model saved to {model_path}')


def load_model(model_path: str) -> Optional[any]:
    """모델 파일 로드"""
    if not os.path.exists(model_path):
        print(f'[AI Utils] Model not found: {model_path}')
        return None

    try:
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        print(f'[AI Utils] Model loaded from {model_path}')
        return model
    except Exception as e:
        print(f'[AI Utils] Error loading model: {e}')
        return None
