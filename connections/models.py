# connections/models.py
import uuid
from django.db import models
import decimal # <--- decimal 임포트 추가 (정확한 계산 위해)
# ▼▼▼ [추가] AI 모델 저장을 위한 BinaryField 임포트 ▼▼▼
from django.db.models import BinaryField
# ▲▲▲ [추가] 여기까지 ▲▲▲
from django.db.models.signals import pre_save
from django.dispatch import receiver

# -----------------------------------------------------------------------------
# 1. 프로젝트 관리 모듈
# -----------------------------------------------------------------------------
class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, default="새 프로젝트")
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        # 디버깅: 프로젝트 이름 반환 확인
        print(f"[DEBUG][Project.__str__] Returning project name: {self.name}")
        return self.name

# -----------------------------------------------------------------------------
# 2. 분류 기준 항목 (기초 데이터)
# -----------------------------------------------------------------------------
class QuantityClassificationTag(models.Model):
    """'건축_골조_슬래브_RC' 등 수량산출을 위한 분류(태그) 정의"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='classification_tags')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    required_properties = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('project', 'name')
        ordering = ['name']

    def __str__(self):
        # 디버깅: 태그 이름 반환 확인
        # print(f"[DEBUG][QuantityClassificationTag.__str__] Returning tag name: {self.name}") # 너무 빈번할 수 있어 주석 처리
        return self.name

class CostCode(models.Model):
    """'철근가공조립', '콘크리트타설' 등 최종 내역 항목을 구성하기 위한 공사코드"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='cost_codes')
    code = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    spec = models.TextField(blank=True, null=True)
    unit = models.CharField(max_length=50, blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    # ▼▼▼ [추가] 새로운 필드 3개 ▼▼▼
    detail_code = models.CharField(max_length=100, blank=True, null=True, verbose_name="내역코드")
    product_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="품명")
    note = models.TextField(blank=True, null=True, verbose_name="비고")
    # ▲▲▲ [추가] 여기까지 ▲▲▲
    created_at = models.DateTimeField(auto_now_add=True)
    # ▼▼▼ [수정] ai_sd_enabled 필드 verbose_name 추가 ▼▼▼
    ai_sd_enabled = models.BooleanField(default=False, verbose_name="개산견적(SD) 사용")       # AI개략견적활용여부
    # ▲▲▲ [수정] 여기까지 ▲▲▲
    dd_enabled    = models.BooleanField(default=False, verbose_name="상세견적(DD) 사용")       # 상세견적활용여부
    class Meta:
        unique_together = ('project', 'code')
        ordering = ['code']

    def __str__(self):
        # 디버깅: 공사코드 정보 반환 확인
        # print(f"[DEBUG][CostCode.__str__] Returning cost code: {self.code} - {self.name}") # 너무 빈번할 수 있어 주석 처리
        return f"{self.code} - {self.name}"

# ▼▼▼ [추가] AI 모델 저장을 위한 새 모델 정의 ▼▼▼
class AIModel(models.Model):
    """업로드되거나 학습된 AI 모델(.h5)과 메타데이터(.json)를 저장"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='ai_models')
    name = models.CharField(max_length=255, help_text="모델 이름")
    description = models.TextField(blank=True, null=True, help_text="모델 설명")
    h5_file_content = BinaryField(help_text=".h5 모델 파일의 바이너리 데이터")
    metadata = models.JSONField(default=dict, help_text="모델 메타데이터 (입력/출력 피처, 성능 등)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('project', 'name')
        ordering = ['-created_at']

    def __str__(self):
        # 디버깅: AI 모델 이름 반환 확인
        print(f"[DEBUG][AIModel.__str__] Returning AI model name: {self.name}")
        return self.name
# ▲▲▲ [추가] 여기까지 ▲▲▲

class UnitPriceType(models.Model):
    """단가의 구분을 정의 (예: 표준단가, 조사단가, 시장단가 등)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='unit_price_types')
    name = models.CharField(max_length=100, help_text="단가 구분 이름 (예: 표준단가)")
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('project', 'name')
        ordering = ['name']

    def __str__(self):
        # 디버깅: 단가 구분 이름 반환 확인
        # print(f"[DEBUG][UnitPriceType.__str__] Returning type name: {self.name}") # 너무 빈번할 수 있어 주석 처리
        return self.name

class UnitPrice(models.Model):
    """개별 공사코드에 대한 특정 구분(Type)의 단가 정보"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='unit_prices')
    cost_code = models.ForeignKey(CostCode, on_delete=models.CASCADE, related_name='unit_prices')
    unit_price_type = models.ForeignKey(UnitPriceType, on_delete=models.PROTECT, related_name='unit_prices', help_text="단가 구분")

    # ▼▼▼ [수정] DecimalField로 변경하여 정확도 향상 ▼▼▼
    material_cost = models.DecimalField(max_digits=19, decimal_places=4, default=decimal.Decimal('0.0'), help_text="재료비 단가")
    labor_cost = models.DecimalField(max_digits=19, decimal_places=4, default=decimal.Decimal('0.0'), help_text="노무비 단가")
    expense_cost = models.DecimalField(max_digits=19, decimal_places=4, default=decimal.Decimal('0.0'), help_text="경비 단가")
    total_cost = models.DecimalField(max_digits=19, decimal_places=4, default=decimal.Decimal('0.0'), help_text="합계 단가 (재료비+노무비+경비 또는 직접 입력)")
    # ▲▲▲ [수정] 여기까지 입니다 ▲▲▲

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ▼▼▼ [추가] save 메서드 오버라이드 ▼▼▼
    def save(self, *args, **kwargs):
        # 디버깅: UnitPrice 저장 시작
        print(f"[DEBUG][UnitPrice.save] Saving UnitPrice for CostCode '{self.cost_code.code}', Type '{self.unit_price_type.name}'")
        print(f"[DEBUG][UnitPrice.save] Incoming values: M={self.material_cost}, L={self.labor_cost}, E={self.expense_cost}, T={self.total_cost}")

        # Decimal 타입으로 변환 (입력이 float이나 문자열일 수 있으므로)
        m_cost = decimal.Decimal(self.material_cost or '0.0')
        l_cost = decimal.Decimal(self.labor_cost or '0.0')
        e_cost = decimal.Decimal(self.expense_cost or '0.0')
        t_cost = decimal.Decimal(self.total_cost or '0.0')

        # 재료비, 노무비, 경비 중 하나라도 0보다 큰 값이 있으면 합계를 다시 계산하여 덮어쓴다.
        if m_cost > 0 or l_cost > 0 or e_cost > 0:
            calculated_total = m_cost + l_cost + e_cost
            # Decimal 비교 시 타입 일치 확인
            current_total_decimal = decimal.Decimal(self.total_cost or '0.0')
            if current_total_decimal != calculated_total:
                 print(f"[DEBUG][UnitPrice.save] Recalculating total_cost: {calculated_total} (overwriting {self.total_cost})")
                 self.total_cost = calculated_total
            else:
                 print("[DEBUG][UnitPrice.save] Component costs provided, total_cost matches calculated value.")
        # 재료비, 노무비, 경비가 모두 0인데 합계가 0보다 크면, 사용자가 직접 입력한 것으로 간주하고 그 값을 유지한다.
        elif t_cost > 0:
            print("[DEBUG][UnitPrice.save] Component costs are zero, using directly provided total_cost.")
            # 컴포넌트 비용을 0으로 명시적 설정
            self.material_cost = decimal.Decimal('0.0')
            self.labor_cost = decimal.Decimal('0.0')
            self.expense_cost = decimal.Decimal('0.0')
            self.total_cost = t_cost # 입력된 합계값 사용
        # 모든 값이 0이면 그냥 0으로 저장
        else:
             print("[DEBUG][UnitPrice.save] All costs are zero.")
             self.material_cost = decimal.Decimal('0.0')
             self.labor_cost = decimal.Decimal('0.0')
             self.expense_cost = decimal.Decimal('0.0')
             self.total_cost = decimal.Decimal('0.0')

        # 디버깅: 최종 저장될 값 확인
        print(f"[DEBUG][UnitPrice.save] Final values before super().save: M={self.material_cost}, L={self.labor_cost}, E={self.expense_cost}, T={self.total_cost}")
        super().save(*args, **kwargs) # 부모의 save 메서드 호출하여 실제 저장
    # ▲▲▲ [추가] 여기까지 입니다. ▲▲▲


    class Meta:
        unique_together = ('cost_code', 'unit_price_type')
        ordering = ['cost_code__code', 'unit_price_type__name']

    def __str__(self):
        # total_cost 필드를 직접 사용하도록 변경
        # 디버깅: UnitPrice 정보 반환 확인
        # print(f"[DEBUG][UnitPrice.__str__] Returning UnitPrice info for {self.cost_code.code}") # 너무 빈번할 수 있어 주석 처리
        return f"{self.cost_code.code} - {self.unit_price_type.name}: {self.total_cost}"

class MemberMark(models.Model):
    """부재일람부호 (예: C1, G1, B1 등)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='member_marks')
    mark = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    properties = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ('project', 'mark')
        ordering = ['mark']

    def __str__(self):
        # 디버깅: 일람부호 반환 확인
        # print(f"[DEBUG][MemberMark.__str__] Returning mark: {self.mark}") # 너무 빈번할 수 있어 주석 처리
        return self.mark


class SpaceClassification(models.Model):
    """'부지 > 건물 > 층 > 공간' 등 위계를 가지는 공간 분류"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='space_classifications')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    created_at = models.DateTimeField(auto_now_add=True)
    mapped_elements = models.ManyToManyField('RawElement', related_name='space_classifications', blank=True)

    # ▼▼▼ [수정] 이 필드를 ForeignKey(unique=True)에서 OneToOneField로 변경해주세요. ▼▼▼
    source_element = models.OneToOneField(
        'RawElement',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='source_of_space',
        help_text="이 공간분류를 생성한 원본 BIM 객체"
    )
    # ▲▲▲ [수정] 여기까지 입니다. ▲▲▲


    class Meta:
        ordering = ['name']
        unique_together = ('project', 'parent', 'name')

    @property
    def full_path(self):
        """공간 분류의 전체 계층 경로를 반환합니다. (예: '건물 A > 1층 > 101호')"""
        path_parts = []
        current = self
        # 순환 참조 방지를 위한 방문 추적
        visited = set()

        while current is not None:
            # 순환 참조 감지
            if current.id in visited:
                break
            visited.add(current.id)

            path_parts.insert(0, current.name)
            current = current.parent

        return ' > '.join(path_parts) if path_parts else self.name

    def __str__(self):
        # 디버깅: 공간 분류 이름 반환 확인
        # print(f"[DEBUG][SpaceClassification.__str__] Returning space name: {self.name}") # 너무 빈번할 수 있어 주석 처리
        return self.name
# -----------------------------------------------------------------------------
# 3. 메인 데이터 (핵심 흐름)
# -----------------------------------------------------------------------------
class ElementClassificationAssignment(models.Model):
    """RawElement와 QuantityClassificationTag 사이의 할당 관계 (중간 테이블)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    raw_element = models.ForeignKey('RawElement', on_delete=models.CASCADE, related_name='tag_assignments')
    classification_tag = models.ForeignKey(QuantityClassificationTag, on_delete=models.CASCADE, related_name='element_assignments')

    # 할당 방식 구분
    ASSIGNMENT_TYPES = [
        ('ruleset', '룰셋 기반'),
        ('manual', '수동'),
    ]
    assignment_type = models.CharField(max_length=10, choices=ASSIGNMENT_TYPES, default='manual')
    assigned_by_rule = models.ForeignKey('ClassificationRule', on_delete=models.SET_NULL, null=True, blank=True, related_name='assignments')
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('raw_element', 'classification_tag')
        ordering = ['-assigned_at']

    def __str__(self):
        return f"{self.raw_element.element_unique_id} -> {self.classification_tag.name} ({self.get_assignment_type_display()})"

class RawElement(models.Model):
    """Revit에서 가져온 원본 BIM 객체 데이터"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='raw_elements')
    element_unique_id = models.CharField(max_length=255)
    raw_data = models.JSONField()
    geometry_volume = models.DecimalField(
        max_digits=20,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name="Geometry Volume",
        help_text="Geometry의 체적 (cubic units)"
    )
    classification_tags = models.ManyToManyField(
        QuantityClassificationTag,
        through='ElementClassificationAssignment',
        related_name='raw_elements',
        blank=True
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('project', 'element_unique_id')

    def calculate_geometry_volume(self):
        """
        Geometry의 체적을 계산 (Signed volume method)
        Vertices와 faces를 사용하여 tetrahedron 공식으로 계산

        지원하는 데이터 구조:
        1. raw_data['geometry'] (Revit/일반 형식)
        2. raw_data['Parameters']['Geometry'] (Blender IFC 형식)
        """
        if not self.raw_data:
            return None

        # Geometry 데이터 찾기 (여러 경로 지원)
        geometry = None

        # 경로 1: raw_data['geometry'] (Revit 형식)
        if 'geometry' in self.raw_data:
            geometry = self.raw_data['geometry']
        # 경로 2: raw_data['Parameters']['Geometry'] (Blender IFC 형식)
        elif 'Parameters' in self.raw_data and isinstance(self.raw_data['Parameters'], dict):
            if 'Geometry' in self.raw_data['Parameters']:
                geometry = self.raw_data['Parameters']['Geometry']

        if not geometry:
            return None

        # Vertices 찾기 (여러 키 이름 지원)
        vertices = geometry.get('vertices') or geometry.get('verts', [])
        faces = geometry.get('faces', [])

        if not vertices or not faces:
            return None

        signed_volume = 0.0

        # 각 삼각형(face)에 대해 signed volume 계산
        for face in faces:
            if len(face) != 3:
                continue  # 삼각형이 아니면 스킵

            i0, i1, i2 = face[0], face[1], face[2]

            # 인덱스 범위 체크
            if i0 >= len(vertices) or i1 >= len(vertices) or i2 >= len(vertices):
                continue

            # 꼭짓점 좌표
            v0 = vertices[i0]
            v1 = vertices[i1]
            v2 = vertices[i2]

            if len(v0) != 3 or len(v1) != 3 or len(v2) != 3:
                continue

            v0x, v0y, v0z = v0[0], v0[1], v0[2]
            v1x, v1y, v1z = v1[0], v1[1], v1[2]
            v2x, v2y, v2z = v2[0], v2[1], v2[2]

            # Cross product: v1 × v2
            cross_x = v1y * v2z - v1z * v2y
            cross_y = v1z * v2x - v1x * v2z
            cross_z = v1x * v2y - v1y * v2x

            # Signed volume of tetrahedron: v0 · (v1 × v2)
            signed_volume += (v0x * cross_x + v0y * cross_y + v0z * cross_z)

        # 절대값을 취하고 6으로 나눔 (tetrahedron 공식)
        volume = abs(signed_volume / 6.0)

        return round(volume, 6)  # 소수점 6자리까지

    def update_geometry_volume(self):
        """
        Geometry 체적을 계산하고 저장
        """
        volume = self.calculate_geometry_volume()
        if volume is not None:
            self.geometry_volume = volume
            self.save(update_fields=['geometry_volume'])
            return volume
        return None

    def __str__(self):
        # 디버깅: RawElement 정보 반환 확인
        # print(f"[DEBUG][RawElement.__str__] Returning RawElement info for project {self.project.name}") # 너무 빈번할 수 있어 주석 처리
        return f"{self.project.name} - {self.element_unique_id}"

class Activity(models.Model):
    """4D 시뮬레이션을 위한 공정/액티비티 관리"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='activities')

    # Basic information
    code = models.CharField(max_length=100, help_text="공정코드")
    name = models.CharField(max_length=255, help_text="공정명")
    description = models.TextField(blank=True, null=True, help_text="공정 설명")

    # Schedule information
    duration_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=decimal.Decimal('1.0'),
        help_text="단위수량당 소요일수 (duration per unit quantity)"
    )
    manual_start_date = models.DateField(
        null=True,
        blank=True,
        help_text="수동으로 지정한 시작일 (설정 시 의존성 무시하고 이 날짜에 시작)"
    )

    # Resource and cost
    resources = models.JSONField(
        default=dict,
        blank=True,
        help_text="투입 자원 정보 (인력, 장비 등)"
    )
    estimated_cost = models.DecimalField(
        max_digits=19,
        decimal_places=4,
        default=decimal.Decimal('0.0'),
        help_text="예상 비용"
    )
    actual_cost = models.DecimalField(
        max_digits=19,
        decimal_places=4,
        default=decimal.Decimal('0.0'),
        help_text="실제 비용"
    )

    # Work breakdown structure
    parent_activity = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sub_activities',
        help_text="상위 공정 (WBS 구조)"
    )
    wbs_code = models.CharField(
        max_length=100,
        blank=True,
        help_text="WBS 코드 (예: 1.2.3)"
    )

    # Additional information
    responsible_person = models.CharField(
        max_length=100,
        blank=True,
        help_text="담당자"
    )
    contractor = models.CharField(
        max_length=200,
        blank=True,
        help_text="시공사/협력업체"
    )
    location = models.CharField(
        max_length=200,
        blank=True,
        help_text="작업 위치"
    )
    notes = models.TextField(blank=True, help_text="비고")

    # Metadata
    metadata = models.JSONField(default=dict, blank=True, help_text="추가 메타데이터")

    # Work Calendar (optional - uses project's main calendar if not set)
    work_calendar = models.ForeignKey(
        'WorkCalendar',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activities',
        help_text="이 액티비티에 적용할 작업 캘린더 (미설정시 프로젝트 기본 캘린더 사용)"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('project', 'code')
        ordering = ['wbs_code', 'code']
        indexes = [
            models.Index(fields=['project', 'code']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"


class ActivityObject(models.Model):
    """CostItem에 할당된 Activity의 실제 작업 객체 (일정 정보 포함)"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='activity_objects')

    # 연관 관계
    cost_item = models.ForeignKey('CostItem', on_delete=models.CASCADE, related_name='activity_objects', help_text="연관된 산출항목")
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='activity_objects', help_text="연관된 액티비티 코드")

    # 일정 정보
    start_date = models.DateField(null=True, blank=True, help_text="시작일")
    end_date = models.DateField(null=True, blank=True, help_text="종료일")
    actual_duration = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="실제 소요일수 (계산 또는 수동 입력)"
    )

    # 수량 정보 (CostItem에서 상속되지만 개별적으로 수정 가능)
    quantity = models.DecimalField(
        max_digits=19,
        decimal_places=4,
        default=decimal.Decimal('0.0'),
        help_text="수량 (기본값: cost_item.quantity)"
    )

    # 수동 입력 여부
    is_manual = models.BooleanField(default=False, help_text="수동으로 일자/수량을 입력했는지 여부")
    manual_formula = models.TextField(blank=True, help_text="수동 입력 시 사용한 산식")

    # 진행 상태
    progress = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=decimal.Decimal('0.0'),
        help_text="진행률 (0-100)"
    )

    # 활성화 상태
    is_active = models.BooleanField(default=True, help_text="활성화 여부")

    # 메타데이터
    metadata = models.JSONField(default=dict, blank=True, help_text="추가 메타데이터")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('cost_item', 'activity')
        ordering = ['start_date', 'cost_item']
        indexes = [
            models.Index(fields=['project', 'activity']),
            models.Index(fields=['cost_item', 'is_active']),
        ]

    def __str__(self):
        return f"{self.activity.code} - {self.cost_item}"

    def calculate_duration(self):
        """
        Activity의 duration_per_unit과 quantity를 기반으로 소요일수 계산
        """
        if self.activity and self.quantity:
            return float(self.activity.duration_per_unit) * float(self.quantity)
        return 0.0

    def auto_calculate_dates(self):
        """
        duration을 기반으로 종료일 자동 계산
        """
        if self.start_date and self.actual_duration:
            from datetime import timedelta
            self.end_date = self.start_date + timedelta(days=float(self.actual_duration))


class ActivityDependency(models.Model):
    """공정 간 선후행 관계 (Dependency)"""

    # Dependency types (PDM - Precedence Diagramming Method)
    TYPE_FINISH_TO_START = 'FS'
    TYPE_START_TO_START = 'SS'
    TYPE_FINISH_TO_FINISH = 'FF'
    TYPE_START_TO_FINISH = 'SF'
    TYPE_CHOICES = [
        (TYPE_FINISH_TO_START, 'Finish-to-Start (FS)'),
        (TYPE_START_TO_START, 'Start-to-Start (SS)'),
        (TYPE_FINISH_TO_FINISH, 'Finish-to-Finish (FF)'),
        (TYPE_START_TO_FINISH, 'Start-to-Finish (SF)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='activity_dependencies')

    # Predecessor and Successor
    predecessor_activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name='successor_dependencies',
        help_text="선행 공정"
    )
    successor_activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name='predecessor_dependencies',
        help_text="후행 공정"
    )

    # Relationship type
    dependency_type = models.CharField(
        max_length=2,
        choices=TYPE_CHOICES,
        default=TYPE_FINISH_TO_START,
        help_text="선후행 관계 유형"
    )

    # Lag and Lead time
    lag_days = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=decimal.Decimal('0.0'),
        help_text="Lag Time (지연 시간, 양수 = 지연, 음수 = 앞당기기/Lead)"
    )

    # Additional information
    description = models.TextField(blank=True, help_text="관계 설명")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('predecessor_activity', 'successor_activity', 'dependency_type')
        ordering = ['predecessor_activity__code', 'successor_activity__code']

    def __str__(self):
        lag_str = f" +{self.lag_days}d" if self.lag_days > 0 else f" {self.lag_days}d" if self.lag_days < 0 else ""
        return f"{self.predecessor_activity.code} → {self.successor_activity.code} ({self.dependency_type}{lag_str})"

    def clean(self):
        """순환 참조 방지"""
        from django.core.exceptions import ValidationError

        if self.predecessor_activity == self.successor_activity:
            raise ValidationError("공정이 자기 자신을 선행/후행 공정으로 가질 수 없습니다.")

        # 순환 참조 체크 (간단한 버전)
        if self.would_create_cycle():
            raise ValidationError("이 관계는 순환 참조를 생성합니다.")

    def would_create_cycle(self):
        """순환 참조 발생 여부 확인"""
        visited = set()

        def has_path(start, end):
            if start == end:
                return True
            if start in visited:
                return False
            visited.add(start)

            for dep in start.successor_dependencies.all():
                if has_path(dep.successor_activity, end):
                    return True
            return False

        return has_path(self.successor_activity, self.predecessor_activity)


class WorkCalendar(models.Model):
    """프로젝트별 작업 캘린더 (작업일/휴일/특별작업일 설정)"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='work_calendars')

    # 캘린더 이름
    name = models.CharField(max_length=200, default="기본 캘린더", help_text="캘린더 이름")

    # 메인 캘린더 여부 (프로젝트당 하나만 메인)
    is_main = models.BooleanField(default=False, help_text="메인 캘린더 여부")

    # 작업 요일 설정 (기본값: 월~토 작업, 일요일 휴무)
    working_days = models.JSONField(
        default=dict,
        help_text="작업 요일 설정 예: {'mon': true, 'tue': true, ..., 'sun': false}"
    )

    # 휴일 목록 (특정 날짜)
    holidays = models.JSONField(
        default=list,
        help_text="휴일 목록 예: ['2025-01-01', '2025-12-25']"
    )

    # 특별 작업일 (휴일이지만 작업하는 날)
    special_working_days = models.JSONField(
        default=list,
        help_text="특별 작업일 목록 예: ['2025-05-05']"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('project', 'name')
        ordering = ['-is_main', 'name']

    def __str__(self):
        main_text = " (메인)" if self.is_main else ""
        return f"{self.name}{main_text} - {self.project.name}"

    def save(self, *args, **kwargs):
        # 메인 캘린더로 설정하면, 같은 프로젝트의 다른 캘린더들의 메인 설정 해제
        if self.is_main:
            WorkCalendar.objects.filter(project=self.project, is_main=True).exclude(pk=self.pk).update(is_main=False)
        super().save(*args, **kwargs)

    def is_working_day(self, date):
        """주어진 날짜가 작업일인지 확인"""
        from datetime import datetime

        # 날짜를 문자열로 변환
        if isinstance(date, datetime):
            date_str = date.strftime('%Y-%m-%d')
        else:
            date_str = str(date)

        # 특별 작업일이면 True
        if date_str in self.special_working_days:
            return True

        # 휴일이면 False
        if date_str in self.holidays:
            return False

        # 요일별 작업 여부 확인
        if isinstance(date, str):
            date = datetime.strptime(date, '%Y-%m-%d')

        weekday_map = {
            0: 'mon', 1: 'tue', 2: 'wed', 3: 'thu',
            4: 'fri', 5: 'sat', 6: 'sun'
        }
        weekday_key = weekday_map[date.weekday()]

        # working_days에 설정이 없으면 기본값 사용 (월~토 작업)
        return self.working_days.get(weekday_key, weekday_key != 'sun')

    def get_working_days_count(self, start_date, end_date):
        """시작일부터 종료일까지의 작업일 수 계산"""
        from datetime import timedelta

        count = 0
        current_date = start_date

        while current_date <= end_date:
            if self.is_working_day(current_date):
                count += 1
            current_date += timedelta(days=1)

        return count

    def add_working_days(self, start_date, working_days):
        """시작일로부터 working_days만큼의 작업일 후 날짜 계산"""
        from datetime import timedelta

        current_date = start_date
        count = 0

        while count < working_days:
            if self.is_working_day(current_date):
                count += 1
                if count == working_days:
                    return current_date
            current_date += timedelta(days=1)

        return current_date


class QuantityMember(models.Model):
    """수량산출의 기본 단위가 되는 부재"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, related_name='quantity_members', on_delete=models.CASCADE)
    raw_element = models.ForeignKey(RawElement, related_name='quantity_members', on_delete=models.SET_NULL, null=True, blank=True)

    classification_tag = models.ForeignKey(QuantityClassificationTag, related_name='quantity_members', on_delete=models.CASCADE, null=True, blank=True)

    cost_codes = models.ManyToManyField(CostCode, related_name='quantity_members', blank=True)
    member_mark = models.ForeignKey(MemberMark, on_delete=models.SET_NULL, related_name='quantity_members', null=True, blank=True)
    name = models.CharField(max_length=255, blank=True)
    properties = models.JSONField(default=dict, blank=True)
    locked_properties = models.JSONField(default=list, blank=True, help_text="룰셋 적용에서 제외할 속성 이름 목록")
    mapping_expression = models.JSONField(default=dict, blank=True, verbose_name="맵핑식(json)")
    member_mark_expression = models.CharField(max_length=255, blank=True, help_text="개별 부재에 적용될 일람부호(Mark) 값 표현식")

    space_classifications = models.ManyToManyField(SpaceClassification, related_name='quantity_members', blank=True)

    cost_code_expressions = models.JSONField(default=list, blank=True, help_text="개별 부재에 적용될 공사코드 표현식 목록 (JSON)")
    locked_cost_code_ids = models.JSONField(default=list, blank=True, help_text="잠금된 공사코드 ID 목록 (UUID strings)")

    # ▼▼▼ [추가] 4D 액티비티 연결 ▼▼▼
    activity = models.ForeignKey(
        Activity,
        on_delete=models.SET_NULL,
        related_name='quantity_members',
        null=True,
        blank=True,
        help_text="이 산출부재에 할당된 공정/액티비티"
    )
    # ▲▲▲ [추가] 여기까지 ▲▲▲

    # Split-related fields
    is_active = models.BooleanField(default=True, help_text="활성 상태 (분할된 경우 원본은 False)")
    split_element = models.ForeignKey('SplitElement', on_delete=models.CASCADE, related_name='quantity_members', null=True, blank=True, help_text="이 산출부재가 속한 분할 객체")
    source_quantity_member = models.ForeignKey('self', on_delete=models.SET_NULL, related_name='derived_members', null=True, blank=True, help_text="원본 산출부재 (분할 전)")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        tag_name = self.classification_tag.name if self.classification_tag else "미분류"
        # 디버깅: QuantityMember 정보 반환 확인
        # print(f"[DEBUG][QuantityMember.__str__] Returning QuantityMember: {self.name or '이름 없는 부재'} ({tag_name})") # 너무 빈번할 수 있어 주석 처리
        return f"{self.name or '이름 없는 부재'} ({tag_name})"

    class Meta:
        ordering = ['created_at']

class CostItem(models.Model):
    """최종 내역서를 구성하는 가장 작은 단위 항목"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='cost_items')
    quantity_member = models.ForeignKey(QuantityMember, on_delete=models.CASCADE, null=True, blank=True, related_name='cost_items')
    cost_code = models.ForeignKey(CostCode, on_delete=models.PROTECT, related_name='cost_items')
    quantity = models.FloatField(default=0.0)
    is_manual_quantity = models.BooleanField(default=False, help_text="수동으로 입력된 수량 여부 (True면 자동 생성 시 수량 유지)")

    quantity_mapping_expression = models.JSONField(default=dict, blank=True, verbose_name="수량 맵핑식(json)")

    unit_price_type = models.ForeignKey(
            UnitPriceType,
            on_delete=models.SET_NULL, # UnitPriceType 삭제 시 이 필드를 null로 설정
            null=True,                 # DB에서 null 허용
            blank=True,                # Django Admin 등에서 빈 값 허용
            related_name='cost_items',
            help_text="이 산출항목에 적용할 단가 기준"
        )

    # ▼▼▼ [수정] 4D 액티비티 코드 연결: ForeignKey → ManyToManyField로 변경 ▼▼▼
    activities = models.ManyToManyField(
        'Activity',
        related_name='cost_items',
        blank=True,
        help_text="이 산출항목에 할당된 액티비티 코드들 (복수 할당 가능)"
    )
    # ▲▲▲ [수정] 여기까지 ▲▲▲

    locked_activity_ids = models.JSONField(default=list, blank=True, help_text="잠금된 액티비티 ID 목록 (UUID strings)")

    description = models.TextField(blank=True, null=True, help_text="수동 생성 시 특이사항 기록")

    # Split-related fields
    is_active = models.BooleanField(default=True, help_text="활성 상태 (분할된 경우 원본은 False)")
    split_element = models.ForeignKey('SplitElement', on_delete=models.CASCADE, related_name='cost_items', null=True, blank=True, help_text="이 산출항목이 속한 분할 객체")
    source_cost_item = models.ForeignKey('self', on_delete=models.SET_NULL, related_name='derived_items', null=True, blank=True, help_text="원본 산출항목 (분할 전)")
    volume_ratio_applied = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True, help_text="적용된 체적 비율 (quantity = 원본 quantity × volume_ratio)")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        # 디버깅: CostItem 정보 반환 확인
        # print(f"[DEBUG][CostItem.__str__] Returning CostItem: {self.cost_code.name} - Qty: {self.quantity}") # 너무 빈번할 수 있어 주석 처리
        return f"{self.cost_code.name} - Qty: {self.quantity}"

# -----------------------------------------------------------------------------
# 4. 룰셋 (자동화 엔진)
# -----------------------------------------------------------------------------
class ClassificationRule(models.Model):
    """'조건'에 맞는 RawElement에 'Tag'를 할당하는 규칙"""
    # [수정] 중복 정의되었던 모델 중 하나를 삭제했습니다.
    project = models.ForeignKey(Project, related_name='classification_rules', on_delete=models.CASCADE)
    target_tag = models.ForeignKey(QuantityClassificationTag, related_name='rules', on_delete=models.CASCADE)
    conditions = models.JSONField(default=list)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['id']  # priority 제거, ID 순서로 정렬

    def __str__(self):
        # 디버깅: 분류 규칙 정보 반환 확인
        # print(f"[DEBUG][ClassificationRule.__str__] Returning rule for {self.target_tag.name}") # 너무 빈번할 수 있어 주석 처리
        return f"Rule for {self.target_tag.name} in {self.project.name}"

class PropertyMappingRule(models.Model):
    """'조건'에 맞는 RawElement의 속성을 '맵핑식'에 따라 계산하여 QuantityMember의 속성으로 자동 생성하는 규칙"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, related_name='property_mapping_rules', on_delete=models.CASCADE)
    name = models.CharField(max_length=255, default="새 속성 맵핑 규칙")
    description = models.TextField(blank=True, null=True)
    target_tag = models.ForeignKey(QuantityClassificationTag, related_name='property_mapping_rules', on_delete=models.CASCADE, help_text="이 규칙이 적용될 대상 수량산출분류")
    conditions = models.JSONField(default=list, blank=True, help_text="규칙이 적용될 RawElement를 필터링하는 조건 (ClassificationRule과 동일한 구조)")
    mapping_script = models.JSONField(default=dict, help_text="속성을 계산하고 맵핑하는 스크립트. 예: {'체적': '{Volume} * 1.05'}")
    priority = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['priority', 'name']

    def __str__(self):
        # 디버깅: 속성 매핑 규칙 정보 반환 확인
        # print(f"[DEBUG][PropertyMappingRule.__str__] Returning mapping rule: {self.name}") # 너무 빈번할 수 있어 주석 처리
        return f"{self.name} (for {self.target_tag.name})"



class CostCodeRule(models.Model):
    """'조건'에 맞는 QuantityMember와 '공사코드' 조합에 대한 '수량' 계산 규칙"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, related_name='cost_code_rules', on_delete=models.CASCADE)
    name = models.CharField(max_length=255, default="새 공사코드 룰셋")
    description = models.TextField(blank=True, null=True)
    target_cost_code = models.ForeignKey(CostCode, related_name='cost_code_rules', on_delete=models.CASCADE, help_text="이 규칙이 적용될 대상 공사코드")
    conditions = models.JSONField(default=list, blank=True, help_text="규칙이 적용될 QuantityMember를 필터링하는 조건")
    quantity_mapping_script = models.JSONField(default=dict, help_text="수량을 계산하는 맵핑 스크립트. 예: {'수량': '({면적} + [철근총길이]) * 1.05'}")
    priority = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['priority', 'name']

    def __str__(self):
        # 디버깅: 공사코드 규칙 정보 반환 확인
        # print(f"[DEBUG][CostCodeRule.__str__] Returning cost code rule: {self.name}") # 너무 빈번할 수 있어 주석 처리
        return f"{self.name} (for {self.target_cost_code.name})"



class MemberMarkAssignmentRule(models.Model):
    """'조건'에 맞는 QuantityMember에 MemberMark를 할당하는 규칙"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, related_name='member_mark_assignment_rules', on_delete=models.CASCADE)
    name = models.CharField(max_length=255, default="새 일람부호 할당 규칙")
    conditions = models.JSONField(default=list, blank=True, help_text="규칙이 적용될 QuantityMember를 필터링하는 조건")
    mark_expression = models.CharField(max_length=255, help_text="할당할 일람부호(Mark) 값을 반환하는 표현식. 예: 'C' + str({층})")
    priority = models.IntegerField(default=0)

    class Meta:
        ordering = ['priority', 'name']

    def __str__(self):
        # 디버깅: 일람부호 할당 규칙 정보 반환 확인
        # print(f"[DEBUG][MemberMarkAssignmentRule.__str__] Returning mark assignment rule: {self.name}") # 너무 빈번할 수 있어 주석 처리
        return self.name

class CostCodeAssignmentRule(models.Model):
    """'조건'에 맞는 QuantityMember에 CostCode를 할당하는 규칙"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, related_name='cost_code_assignment_rules', on_delete=models.CASCADE)
    name = models.CharField(max_length=255, default="새 공사코드 할당 규칙")
    conditions = models.JSONField(default=list, blank=True, help_text="규칙이 적용될 QuantityMember를 필터링하는 조건")
    # 공사코드는 code와 name이 있으므로 JSON으로 여러 표현식을 관리합니다.
    cost_code_expressions = models.JSONField(default=dict, help_text="할당할 공사코드의 속성을 반환하는 표현식. 예: {'code': 'RC-{층}', 'name': '{분류} 타설'}")
    priority = models.IntegerField(default=0)

    class Meta:
        ordering = ['priority', 'name']

    def __str__(self):
        # 디버깅: 공사코드 할당 규칙 정보 반환 확인
        # print(f"[DEBUG][CostCodeAssignmentRule.__str__] Returning cost code assignment rule: {self.name}") # 너무 빈번할 수 있어 주석 처리
        return self.name


# ▼▼▼ [추가] 공간분류 자동 생성을 위한 룰 모델 ▼▼▼
class SpaceClassificationRule(models.Model):
    """BIM 객체 데이터로부터 공간분류 위계를 자동으로 생성하기 위한 규칙"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='space_classification_rules')

    level_depth = models.IntegerField(help_text="위계 수준 (0=최상위)")
    level_name = models.CharField(max_length=100, help_text="위계의 이름 (예: Project, Site, Building)")

    bim_object_filter = models.JSONField(help_text="이 위계에 해당하는 BIM 객체를 찾는 조건")
    name_source_param = models.CharField(max_length=255, help_text="공간분류의 이름으로 사용할 BIM 객체의 속성 이름")

    # 상위 위계와의 연결을 위한 규칙
    parent_join_param = models.CharField(max_length=255, blank=True, help_text="상위 객체에서 연결에 사용할 속성 (예: GlobalId)")
    child_join_param = models.CharField(max_length=255, blank=True, help_text="현재 객체에서 상위 객체와 연결에 사용할 속성 (예: ParentGlobalId)")

    class Meta:
        unique_together = ('project', 'level_depth')
        ordering = ['project', 'level_depth']

    def __str__(self):
        # 디버깅: 공간 분류 생성 규칙 정보 반환 확인
        # print(f"[DEBUG][SpaceClassificationRule.__str__] Returning space classification rule for level {self.level_depth}") # 너무 빈번할 수 있어 주석 처리
        return f"{self.project.name} - Level {self.level_depth}: {self.level_name}"


class SpaceAssignmentRule(models.Model):
    """'조건'에 맞는 QuantityMember와 SpaceClassification을 동적으로 찾아 연결(Join)하는 규칙"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, related_name='space_assignment_rules', on_delete=models.CASCADE)
    name = models.CharField(max_length=255, default="새 동적 공간 할당 규칙")

    # 1. 어떤 부재에 적용할지 결정하는 필터 (선택 사항)
    member_filter_conditions = models.JSONField(default=list, blank=True, help_text="규칙을 적용할 수량산출부재를 필터링하는 조건 (JSON)")

    # 2. 부재와 공간을 연결할 '키'가 되는 속성 경로
    member_join_property = models.CharField(max_length=255, help_text="매칭에 사용할 부재의 속성 경로 (예: BIM원본.참조 레벨)")
    space_join_property = models.CharField(max_length=255, help_text="매칭에 사용할 공간의 속성 경로 (예: Name 또는 BIM원본.Name)")

    priority = models.IntegerField(default=0)

    class Meta:
        ordering = ['priority', 'name']

    def __str__(self):
        # 디버깅: 공간 할당 규칙 정보 반환 확인
        # print(f"[DEBUG][SpaceAssignmentRule.__str__] Returning space assignment rule: {self.name}") # 너무 빈번할 수 있어 주석 처리
        return self.name


class ActivityAssignmentRule(models.Model):
    """'조건'에 맞는 CostItem에 Activity를 할당하는 규칙

    조건문에서 사용 가능한 속성 접근 문법:
    - CostItem 자체 속성: {property_name} (예: {quantity}, {description})
    - QuantityMember 속성: QM.{property_name} (예: QM.{name}, QM.{properties.면적})
    - MemberMark 속성: MM.{property_name} (예: MM.{mark}, MM.{description})
    - RawElement (BIM 원본) 속성: RE.{property_name} (예: RE.{Category}, RE.{Family})
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, related_name='activity_assignment_rules', on_delete=models.CASCADE)
    name = models.CharField(max_length=255, default="새 액티비티 할당 규칙")
    description = models.TextField(blank=True, null=True, help_text="규칙 설명")
    conditions = models.JSONField(default=list, blank=True, help_text="규칙이 적용될 CostItem을 필터링하는 조건 (다단계 속성 접근 지원)")
    target_activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='assignment_rules', help_text="할당할 액티비티")
    priority = models.IntegerField(default=0, help_text="우선순위 (낮을수록 먼저 적용)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['priority', 'name']

    def __str__(self):
        return f"{self.name} (→ {self.target_activity.code})"

# -----------------------------------------------------------------------------
# 3D 객체 분할 관리
# -----------------------------------------------------------------------------
class SplitElement(models.Model):
    """3D 뷰어에서 분할된 객체를 저장하고 관리"""

    # Split method choices
    SPLIT_METHOD_PLANE = 'plane'
    SPLIT_METHOD_SKETCH = 'sketch'
    SPLIT_METHOD_CHOICES = [
        (SPLIT_METHOD_PLANE, 'Plane Split'),
        (SPLIT_METHOD_SKETCH, 'Sketch Split'),
    ]

    # Split axis choices (plane split only)
    SPLIT_AXIS_X = 'x'
    SPLIT_AXIS_Y = 'y'
    SPLIT_AXIS_Z = 'z'
    SPLIT_AXIS_CHOICES = [
        (SPLIT_AXIS_X, 'X Axis'),
        (SPLIT_AXIS_Y, 'Y Axis'),
        (SPLIT_AXIS_Z, 'Z Axis'),
    ]

    # Split part type choices
    SPLIT_PART_BOTTOM = 'bottom'
    SPLIT_PART_TOP = 'top'
    SPLIT_PART_REMAINDER = 'remainder'
    SPLIT_PART_EXTRACTED = 'extracted'
    SPLIT_PART_TYPE_CHOICES = [
        (SPLIT_PART_BOTTOM, 'Bottom Part (Plane Split)'),
        (SPLIT_PART_TOP, 'Top Part (Plane Split)'),
        (SPLIT_PART_REMAINDER, 'Remainder Part (Sketch Split)'),
        (SPLIT_PART_EXTRACTED, 'Extracted Part (Sketch Split)'),
    ]

    # Primary key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Foreign keys
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='split_elements',
        help_text="프로젝트"
    )

    raw_element = models.ForeignKey(
        RawElement,
        on_delete=models.CASCADE,
        related_name='split_elements',
        help_text="원본 BIM 객체 (최초 분할 대상)"
    )

    parent_split = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        related_name='child_splits',
        null=True,
        blank=True,
        help_text="부모 분할 객체 (분할의 분할인 경우)"
    )

    # Volume information
    original_geometry_volume = models.DecimalField(
        max_digits=20,
        decimal_places=6,
        help_text="원본 BIM 객체의 geometry_volume (최초 BIM 원본 기준, 캐시됨)"
    )

    geometry_volume = models.DecimalField(
        max_digits=20,
        decimal_places=6,
        help_text="이 분할 객체의 실제 geometry volume"
    )

    volume_ratio = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        help_text="원본 BIM 대비 체적 비율 (geometry_volume / original_geometry_volume)"
    )

    # Split information
    split_method = models.CharField(
        max_length=20,
        choices=SPLIT_METHOD_CHOICES,
        help_text="분할 방식 (plane: 평면 분할, sketch: 스케치 분할)"
    )

    split_axis = models.CharField(
        max_length=1,
        choices=SPLIT_AXIS_CHOICES,
        null=True,
        blank=True,
        help_text="분할 축 (plane split only: x, y, z)"
    )

    split_position = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="분할 위치 (plane split only: 0-100 백분율)"
    )

    split_part_type = models.CharField(
        max_length=20,
        choices=SPLIT_PART_TYPE_CHOICES,
        help_text="분할 부분 타입 (bottom/top for plane, remainder/extracted for sketch)"
    )

    # Geometry data for reconstruction
    geometry_data = models.JSONField(
        default=dict,
        help_text="3D 뷰 재생성을 위한 geometry 데이터 (vertices, faces, matrix 등)"
    )

    # Sketch split specific data
    sketch_data = models.JSONField(
        default=dict,
        null=True,
        blank=True,
        help_text="스케치 분할 정보 (스케치 포인트, 평면 법선 등)"
    )

    # Status
    is_active = models.BooleanField(
        default=True,
        help_text="활성 상태 (BIM 원본이 변경되면 False로 설정)"
    )

    # Additional metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="추가 메타데이터 (사용자 메모, 태그 등)"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['raw_element', 'is_active']),
            models.Index(fields=['project', 'is_active']),
            models.Index(fields=['parent_split']),
        ]

    def __str__(self):
        return f"{self.raw_element.element_unique_id} - {self.split_part_type} ({self.split_method})"

    def invalidate_on_bim_change(self):
        """
        BIM 원본 객체가 변경되었을 때 이 분할 객체와 모든 하위 분할을 무효화
        """
        self.is_active = False
        self.save(update_fields=['is_active', 'updated_at'])

        # 모든 하위 분할도 무효화
        for child in self.child_splits.all():
            child.invalidate_on_bim_change()

    def get_split_hierarchy(self):
        """
        분할 계층 구조를 반환 (원본 BIM → 중간 분할들 → 현재 분할)
        """
        hierarchy = []
        current = self
        while current:
            hierarchy.insert(0, current)
            current = current.parent_split
        return hierarchy

    def calculate_effective_volume_ratio(self):
        """
        원본 BIM 대비 실제 비율 계산
        (중간에 여러 번 분할된 경우에도 최종 비율 계산)
        """
        if self.original_geometry_volume and self.original_geometry_volume > 0:
            return float(self.geometry_volume) / float(self.original_geometry_volume)
        return 0.0


# -----------------------------------------------------------------------------
# Signals for automatic updates
# -----------------------------------------------------------------------------

@receiver(pre_save, sender=RawElement)
def invalidate_splits_on_bim_change(sender, instance, **kwargs):
    """
    RawElement의 geometry_volume이 변경되면 관련된 모든 분할 객체를 무효화
    """
    if instance.pk:  # 기존 객체인 경우만 (신규 생성 시 제외)
        try:
            old_instance = RawElement.objects.get(pk=instance.pk)

            # geometry_volume이 변경되었는지 확인
            if old_instance.geometry_volume != instance.geometry_volume:
                print(f"[DEBUG] RawElement {instance.element_unique_id} geometry_volume changed:")
                print(f"  - Old: {old_instance.geometry_volume}")
                print(f"  - New: {instance.geometry_volume}")
                print(f"  - Invalidating all related split elements...")

                # 이 RawElement와 연결된 모든 활성 분할 객체 무효화
                split_count = 0
                for split_element in instance.split_elements.filter(is_active=True):
                    split_element.invalidate_on_bim_change()
                    split_count += 1

                if split_count > 0:
                    print(f"  - Invalidated {split_count} split elements")

        except RawElement.DoesNotExist:
            # 객체가 존재하지 않으면 무시 (새로 생성되는 경우)
            pass