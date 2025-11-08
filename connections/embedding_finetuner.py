"""
Embedding Model Fine-tuning for AI v2
- Sentence Transformer fine-tuning on user feedback
- Model versioning and management
"""

import os
import json
from datetime import datetime
from typing import List, Dict, Tuple
from sentence_transformers import SentenceTransformer, InputExample, losses
from sentence_transformers.evaluation import EmbeddingSimilarityEvaluator
from torch.utils.data import DataLoader


def finetune_embedding_model(
    training_data: List[Dict],
    objects_with_features: Dict[str, str],
    base_model_name: str = 'paraphrase-multilingual-MiniLM-L12-v2',
    output_path: str = None,
    epochs: int = 3,
    batch_size: int = 16
) -> Tuple[str, Dict]:
    """
    Embedding 모델 파인튜닝

    Args:
        training_data: AITrainingData 리스트
            [{
                'prompt': str,
                'correct_ids': [str],
                'ai_selected_ids': [str]
            }]
        objects_with_features: 객체 ID → 피처 문자열 매핑
            {
                'object_id': 'Name Category Family Type...'
            }
        base_model_name: 베이스 모델 이름
        output_path: 저장 경로 (None이면 자동 생성)
        epochs: 학습 에포크 수
        batch_size: 배치 크기

    Returns:
        (model_path, stats) 튜플
    """
    print(f'[Fine-tuning] Starting with {len(training_data)} training samples')

    # 1. 베이스 모델 로드
    model = SentenceTransformer(base_model_name)
    print(f'[Fine-tuning] Loaded base model: {base_model_name}')

    # 2. 학습 데이터 생성
    train_examples = []

    for td in training_data:
        prompt = td['prompt']
        correct_ids = td.get('correct_ids', [])
        ai_selected_ids = td.get('ai_selected_ids', [])

        # Positive examples: 프롬프트와 정답 객체는 유사
        for obj_id in correct_ids:
            if obj_id in objects_with_features:
                train_examples.append(InputExample(
                    texts=[prompt, objects_with_features[obj_id]],
                    label=1.0  # High similarity
                ))

        # Negative examples: 프롬프트와 오답 객체는 다름
        false_positives = set(ai_selected_ids) - set(correct_ids)
        for obj_id in false_positives:
            if obj_id in objects_with_features:
                train_examples.append(InputExample(
                    texts=[prompt, objects_with_features[obj_id]],
                    label=0.0  # Low similarity
                ))

    print(f'[Fine-tuning] Created {len(train_examples)} training examples')

    if len(train_examples) < 10:
        raise ValueError(f'Insufficient training examples: {len(train_examples)} (need at least 10)')

    # 3. 데이터 로더 생성
    train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=batch_size)

    # 4. Loss 함수 정의
    train_loss = losses.CosineSimilarityLoss(model)

    # 5. 출력 경로 설정
    if output_path is None:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_path = f'ai_models/embedding_finetuned_{timestamp}'

    os.makedirs(output_path, exist_ok=True)

    # 6. 파인튜닝 실행
    print(f'[Fine-tuning] Training for {epochs} epochs...')
    model.fit(
        train_objectives=[(train_dataloader, train_loss)],
        epochs=epochs,
        warmup_steps=int(len(train_dataloader) * 0.1),
        output_path=output_path,
        show_progress_bar=True
    )

    print(f'[Fine-tuning] Model saved to: {output_path}')

    # 7. 통계 생성
    stats = {
        'base_model': base_model_name,
        'training_samples': len(training_data),
        'training_examples': len(train_examples),
        'epochs': epochs,
        'batch_size': batch_size,
        'timestamp': datetime.now().isoformat(),
        'output_path': output_path
    }

    # 통계 저장
    with open(os.path.join(output_path, 'training_stats.json'), 'w') as f:
        json.dump(stats, f, indent=2)

    return output_path, stats


def evaluate_model(
    model_path: str,
    test_data: List[Dict],
    objects_with_features: Dict[str, str]
) -> Dict:
    """
    모델 평가

    Args:
        model_path: 파인튜닝된 모델 경로
        test_data: 테스트 데이터
        objects_with_features: 객체 피처 매핑

    Returns:
        평가 결과 딕셔너리
    """
    model = SentenceTransformer(model_path)

    # 평가 데이터 생성
    eval_examples = []
    for td in test_data:
        prompt = td['prompt']
        correct_ids = td.get('correct_ids', [])

        for obj_id in correct_ids:
            if obj_id in objects_with_features:
                eval_examples.append(InputExample(
                    texts=[prompt, objects_with_features[obj_id]],
                    label=1.0
                ))

    # Evaluator 생성
    evaluator = EmbeddingSimilarityEvaluator.from_input_examples(
        eval_examples,
        name='embedding-eval'
    )

    # 평가 실행
    score = evaluator(model, output_path=model_path)

    return {
        'score': score,
        'test_samples': len(test_data),
        'test_examples': len(eval_examples)
    }


def list_finetuned_models(base_dir: str = 'ai_models') -> List[Dict]:
    """
    파인튜닝된 모델 목록 조회

    Returns:
        모델 정보 리스트
    """
    if not os.path.exists(base_dir):
        return []

    models = []
    for dirname in os.listdir(base_dir):
        if dirname.startswith('embedding_finetuned_'):
            model_path = os.path.join(base_dir, dirname)
            stats_path = os.path.join(model_path, 'training_stats.json')

            if os.path.exists(stats_path):
                with open(stats_path, 'r') as f:
                    stats = json.load(f)
                    stats['name'] = dirname
                    stats['path'] = model_path
                    models.append(stats)

    # 최신순 정렬
    models.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

    return models
