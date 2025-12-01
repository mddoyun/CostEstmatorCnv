# connections/ai_classifier.py
"""
AI 기반 다중 레이블 분류 시스템
CatBoost를 사용한 BIM 객체 자동 분류
"""

import pickle
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any
from collections import defaultdict

# CatBoost
from catboost import CatBoostClassifier

# Scikit-learn
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.metrics import (
    hamming_loss,
    f1_score,
    precision_score,
    recall_score,
    accuracy_score,
    multilabel_confusion_matrix
)


class BIMPropertyFeatureExtractor:
    """
    BIM 속성을 ML 피처로 변환하는 클래스
    - 다양한 속성명 처리 (이름/name/Name 등)
    - 텍스트 데이터를 수치형으로 변환
    """

    def __init__(self):
        self.feature_columns = []
        self.categorical_features = []
        self.known_categories = {}  # {feature: set(values)}

    def extract_features(self, bim_properties: Dict[str, Any]) -> Dict[str, Any]:
        """
        BIM 속성에서 피처를 추출

        Args:
            bim_properties: RawElement의 raw_data 또는 속성 딕셔너리

        Returns:
            피처 딕셔너리
        """
        features = {}

        # 기본 BIM 속성들
        standard_keys = [
            'Category', 'Family', 'Type', 'Level',
            'Name', 'name', '이름',  # 다양한 이름 표현
            'Material', 'material', '재질',
            'StructuralType', 'structural_type', '구조타입',
            'Width', 'width', '너비', 'Thickness', 'thickness', '두께',
            'Height', 'height', '높이', 'Length', 'length', '길이',
            'Area', 'area', '면적', 'Volume', 'volume', '체적',
        ]

        # 속성 값 추출 (대소문자 무시)
        for key in standard_keys:
            value = self._find_property_value(bim_properties, key)
            if value is not None:
                normalized_key = key.lower().replace(' ', '_')
                features[normalized_key] = value

        # Parameters에서 추가 속성 추출
        if 'Parameters' in bim_properties:
            params = bim_properties['Parameters']
            if isinstance(params, dict):
                for param_key, param_value in params.items():
                    normalized_key = f"param_{param_key.lower().replace(' ', '_')}"
                    features[normalized_key] = param_value

        # 수치형/범주형 구분
        for key, value in features.items():
            if isinstance(value, (int, float)):
                # 수치형은 그대로
                pass
            else:
                # 범주형은 문자열로 변환
                features[key] = str(value) if value is not None else 'unknown'

        return features

    def _find_property_value(self, bim_properties: Dict, key: str):
        """
        대소문자 무시하고 속성 값 찾기
        """
        # 직접 매칭
        if key in bim_properties:
            return bim_properties[key]

        # 대소문자 무시 매칭
        key_lower = key.lower()
        for prop_key, prop_value in bim_properties.items():
            if prop_key.lower() == key_lower:
                return prop_value

        # Parameters 안에서 찾기
        if 'Parameters' in bim_properties:
            params = bim_properties['Parameters']
            if isinstance(params, dict):
                if key in params:
                    return params[key]
                for param_key, param_value in params.items():
                    if param_key.lower() == key_lower:
                        return param_value

        return None

    def fit_transform(self, samples: List[Dict[str, Any]]) -> pd.DataFrame:
        """
        여러 샘플에서 피처를 추출하고 DataFrame으로 변환
        학습 시 사용 (피처 컬럼 정의)
        """
        extracted_features = [self.extract_features(sample) for sample in samples]

        # DataFrame 생성
        df = pd.DataFrame(extracted_features)

        # 결측치 처리
        for col in df.columns:
            if df[col].dtype == 'object':
                df[col] = df[col].fillna('unknown')
                self.categorical_features.append(col)
            else:
                df[col] = df[col].fillna(0)

        self.feature_columns = df.columns.tolist()

        # 범주형 값 기록
        for col in self.categorical_features:
            self.known_categories[col] = set(df[col].unique())

        return df

    def transform(self, samples: List[Dict[str, Any]]) -> pd.DataFrame:
        """
        학습된 피처 정의를 사용하여 새 샘플 변환
        예측 시 사용
        """
        extracted_features = [self.extract_features(sample) for sample in samples]
        df = pd.DataFrame(extracted_features)

        # 학습 시 정의된 컬럼만 사용
        for col in self.feature_columns:
            if col not in df.columns:
                # 없는 컬럼은 기본값 추가
                if col in self.categorical_features:
                    df[col] = 'unknown'
                else:
                    df[col] = 0

        # 학습 시 없던 컬럼 제거
        df = df[self.feature_columns]

        # 결측치 처리
        for col in df.columns:
            if col in self.categorical_features:
                df[col] = df[col].fillna('unknown')
                # 학습 시 보지 못한 값은 'unknown'으로 치환
                if col in self.known_categories:
                    mask = ~df[col].isin(self.known_categories[col])
                    df.loc[mask, col] = 'unknown'
            else:
                df[col] = df[col].fillna(0)

        return df


class MultiLabelClassifierTrainer:
    """
    다중 레이블 분류 모델 학습 클래스
    """

    def __init__(self, hyperparameters: Dict = None):
        """
        Args:
            hyperparameters: CatBoost 하이퍼파라미터
        """
        self.hyperparameters = hyperparameters or {
            'iterations': 500,
            'depth': 6,
            'learning_rate': 0.1,
            'loss_function': 'MultiClass',
            'random_seed': 42,
            'verbose': False,
            'task_type': 'CPU',
        }

        self.feature_extractor = BIMPropertyFeatureExtractor()
        self.label_encoder = MultiLabelBinarizer()
        self.models = {}  # {label: CatBoostClassifier}
        self.labels = []

    def train(
        self,
        training_samples: List[Dict],
        test_size: float = 0.2
    ) -> Dict[str, Any]:
        """
        모델 학습 (One-vs-Rest 전략)

        Args:
            training_samples: [
                {
                    'bim_properties': {...},
                    'tags': ['구조벽', '마감벽', ...]
                },
                ...
            ]
            test_size: 테스트 데이터 비율

        Returns:
            성능 지표 딕셔너리
        """
        print(f"[AI Classifier] 학습 시작: {len(training_samples)}개 샘플")

        # 피처 추출
        X_properties = [s['bim_properties'] for s in training_samples]
        y_tags = [s['tags'] for s in training_samples]

        X = self.feature_extractor.fit_transform(X_properties)
        print(f"[AI Classifier] 피처 추출 완료: {X.shape[1]}개 피처")

        # 레이블 인코딩
        y_binary = self.label_encoder.fit_transform(y_tags)
        self.labels = self.label_encoder.classes_.tolist()
        print(f"[AI Classifier] 레이블: {len(self.labels)}개 - {self.labels}")

        # Train/Test 분할
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_binary, test_size=test_size, random_state=42
        )

        # One-vs-Rest: 각 레이블마다 이진 분류 모델 학습
        categorical_indices = [
            i for i, col in enumerate(self.feature_extractor.feature_columns)
            if col in self.feature_extractor.categorical_features
        ]

        for i, label in enumerate(self.labels):
            print(f"[AI Classifier] '{label}' 모델 학습 중... ({i+1}/{len(self.labels)})")

            # 이진 레이블
            y_train_label = y_train[:, i]
            y_test_label = y_test[:, i]

            # CatBoost 모델
            model = CatBoostClassifier(
                **self.hyperparameters,
                cat_features=categorical_indices,
            )

            model.fit(
                X_train,
                y_train_label,
                eval_set=(X_test, y_test_label),
                verbose=False
            )

            self.models[label] = model

        # 성능 평가
        metrics = self._evaluate(X_test, y_test)

        print(f"[AI Classifier] 학습 완료!")
        print(f"  - Hamming Loss: {metrics['hamming_loss']:.4f}")
        print(f"  - F1 (Macro): {metrics['f1_macro']:.4f}")
        print(f"  - F1 (Micro): {metrics['f1_micro']:.4f}")

        return metrics

    def _evaluate(self, X_test: pd.DataFrame, y_test: np.ndarray) -> Dict[str, Any]:
        """
        모델 성능 평가
        """
        # 예측
        y_pred = self.predict_binary(X_test)

        # 전체 지표
        metrics = {
            'hamming_loss': float(hamming_loss(y_test, y_pred)),
            'f1_macro': float(f1_score(y_test, y_pred, average='macro', zero_division=0)),
            'f1_micro': float(f1_score(y_test, y_pred, average='micro', zero_division=0)),
            'f1_samples': float(f1_score(y_test, y_pred, average='samples', zero_division=0)),
            'precision_macro': float(precision_score(y_test, y_pred, average='macro', zero_division=0)),
            'recall_macro': float(recall_score(y_test, y_pred, average='macro', zero_division=0)),
            'subset_accuracy': float(accuracy_score(y_test, y_pred)),
        }

        # 레이블별 지표
        per_label_metrics = {}
        confusion_matrices = {}

        for i, label in enumerate(self.labels):
            y_true_label = y_test[:, i]
            y_pred_label = y_pred[:, i]

            per_label_metrics[label] = {
                'f1': float(f1_score(y_true_label, y_pred_label, zero_division=0)),
                'precision': float(precision_score(y_true_label, y_pred_label, zero_division=0)),
                'recall': float(recall_score(y_true_label, y_pred_label, zero_division=0)),
                'support': int(y_true_label.sum()),
            }

        # Confusion Matrix (per label)
        cm = multilabel_confusion_matrix(y_test, y_pred)
        for i, label in enumerate(self.labels):
            confusion_matrices[label] = cm[i].tolist()

        metrics['per_label_metrics'] = per_label_metrics
        metrics['confusion_matrices'] = confusion_matrices

        # Feature Importance (첫 번째 모델 기준)
        if self.labels:
            first_label = self.labels[0]
            feature_importance = dict(zip(
                self.feature_extractor.feature_columns,
                self.models[first_label].feature_importances_
            ))
            # 중요도 높은 순으로 정렬
            feature_importance = dict(sorted(
                feature_importance.items(),
                key=lambda x: x[1],
                reverse=True
            ))
            metrics['feature_importance'] = {k: float(v) for k, v in feature_importance.items()}

        return metrics

    def predict_binary(self, X: pd.DataFrame) -> np.ndarray:
        """
        이진 예측 (0 or 1)
        """
        predictions = np.zeros((len(X), len(self.labels)))

        for i, label in enumerate(self.labels):
            model = self.models[label]
            predictions[:, i] = model.predict(X)

        return predictions

    def predict_proba(self, X: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        확률 예측

        Returns:
            (binary_predictions, probabilities)
        """
        binary_preds = np.zeros((len(X), len(self.labels)))
        probas = np.zeros((len(X), len(self.labels)))

        for i, label in enumerate(self.labels):
            model = self.models[label]
            proba = model.predict_proba(X)
            probas[:, i] = proba[:, 1]  # 클래스 1의 확률
            binary_preds[:, i] = (proba[:, 1] >= 0.5).astype(int)

        return binary_preds, probas

    def predict_tags(
        self,
        bim_properties_list: List[Dict[str, Any]],
        threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        BIM 속성에서 태그 예측

        Returns:
            [
                {
                    'tags': ['구조벽', '마감벽'],
                    'scores': {'구조벽': 0.95, '마감벽': 0.87}
                },
                ...
            ]
        """
        X = self.feature_extractor.transform(bim_properties_list)
        binary_preds, probas = self.predict_proba(X)

        results = []
        for i in range(len(bim_properties_list)):
            pred_indices = np.where(probas[i] >= threshold)[0]
            tags = [self.labels[j] for j in pred_indices]
            scores = {self.labels[j]: float(probas[i, j]) for j in pred_indices}

            results.append({
                'tags': tags,
                'scores': scores
            })

        return results

    def save(self) -> Tuple[bytes, bytes]:
        """
        모델과 인코더를 pickle로 직렬화

        Returns:
            (model_binary, label_encoder_binary)
        """
        model_data = {
            'models': self.models,
            'labels': self.labels,
            'feature_extractor': self.feature_extractor,
            'hyperparameters': self.hyperparameters,
        }

        model_binary = pickle.dumps(model_data)
        label_encoder_binary = pickle.dumps(self.label_encoder)

        return model_binary, label_encoder_binary

    @classmethod
    def load(cls, model_binary: bytes, label_encoder_binary: bytes):
        """
        직렬화된 모델 로드
        """
        model_data = pickle.loads(model_binary)
        label_encoder = pickle.loads(label_encoder_binary)

        trainer = cls(hyperparameters=model_data['hyperparameters'])
        trainer.models = model_data['models']
        trainer.labels = model_data['labels']
        trainer.feature_extractor = model_data['feature_extractor']
        trainer.label_encoder = label_encoder

        return trainer
