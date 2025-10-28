# connections/admin.py

from django.contrib import admin
# ▼▼▼ [수정] AIModel, SplitElement 임포트 추가 ▼▼▼
from .models import UnitPriceType, UnitPrice, AIModel, RawElement, SplitElement
# ▲▲▲ [수정] 여기까지 ▲▲▲

# Register your models here.

@admin.register(RawElement)
class RawElementAdmin(admin.ModelAdmin):
    list_display = ('element_unique_id', 'project', 'geometry_volume', 'updated_at')
    list_filter = ('project',)
    search_fields = ('element_unique_id',)
    readonly_fields = ('geometry_volume', 'updated_at')

    def save_model(self, request, obj, form, change):
        print(f"[DEBUG][RawElementAdmin.save_model] Saving RawElement: {obj.element_unique_id}")
        super().save_model(request, obj, form, change)

# ▼▼▼ [추가] AIModel 관리자 설정 추가 ▼▼▼
@admin.register(AIModel)
class AIModelAdmin(admin.ModelAdmin):
    list_display = ('name', 'project', 'description', 'created_at', 'updated_at')
    list_filter = ('project',)
    search_fields = ('name', 'description')
    # readonly_fields = ('h5_file_content',) # 바이너리 데이터는 관리자에서 직접 수정하지 않도록 설정 (선택 사항)

    def save_model(self, request, obj, form, change):
        # 디버깅: 관리자 페이지에서 AIModel 저장 시 로그 출력
        print(f"[DEBUG][AIModelAdmin.save_model] Saving AIModel: {obj.name} (Project: {obj.project.name})")
        super().save_model(request, obj, form, change)
# ▲▲▲ [추가] 여기까지 ▲▲▲

@admin.register(UnitPriceType)
class UnitPriceTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'project', 'description', 'created_at')
    list_filter = ('project',)
    search_fields = ('name',)

    def save_model(self, request, obj, form, change):
        # 디버깅: 관리자 페이지에서 UnitPriceType 저장 시 로그 출력
        print(f"[DEBUG][UnitPriceTypeAdmin.save_model] Saving UnitPriceType: {obj.name}")
        super().save_model(request, obj, form, change)

@admin.register(UnitPrice)
class UnitPriceAdmin(admin.ModelAdmin):
    list_display = ('cost_code', 'unit_price_type', 'material_cost', 'labor_cost', 'expense_cost', 'total_cost', 'project_name', 'updated_at') # project -> project_name
    list_filter = ('project', 'unit_price_type', 'cost_code__category')
    search_fields = ('cost_code__code', 'cost_code__name', 'unit_price_type__name')
    # readonly_fields = ('total_cost',) # total_cost가 이제 DB 필드이므로 readonly 제거 (필요 시 유지)

    def project_name(self, obj): # Admin 페이지에서 Project 이름 보이도록
        return obj.project.name
    project_name.short_description = 'Project' # 컬럼 헤더 이름 변경
    project_name.admin_order_field = 'project'

    def save_model(self, request, obj, form, change):
        # 디버깅: 관리자 페이지에서 UnitPrice 저장 시 로그 출력
        print(f"[DEBUG][UnitPriceAdmin.save_model] Saving UnitPrice for {obj.cost_code.code} / {obj.unit_price_type.name}")
        super().save_model(request, obj, form, change)

# ▼▼▼ [추가] SplitElement 관리자 설정 추가 ▼▼▼
@admin.register(SplitElement)
class SplitElementAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'raw_element_info',
        'split_method',
        'split_part_type',
        'geometry_volume',
        'volume_ratio_percent',
        'is_active',
        'created_at'
    )
    list_filter = (
        'project',
        'split_method',
        'split_part_type',
        'is_active',
        'split_axis',
        'created_at'
    )
    search_fields = (
        'raw_element__element_unique_id',
        'id'
    )
    readonly_fields = (
        'id',
        'created_at',
        'updated_at',
        'split_hierarchy_display',
        'effective_volume_ratio_display'
    )

    fieldsets = (
        ('기본 정보', {
            'fields': ('id', 'project', 'raw_element', 'parent_split', 'is_active')
        }),
        ('체적 정보', {
            'fields': (
                'original_geometry_volume',
                'geometry_volume',
                'volume_ratio',
                'effective_volume_ratio_display'
            )
        }),
        ('분할 정보', {
            'fields': (
                'split_method',
                'split_part_type',
                'split_axis',
                'split_position',
            )
        }),
        ('지오메트리 데이터', {
            'fields': ('geometry_data', 'sketch_data'),
            'classes': ('collapse',)
        }),
        ('메타데이터', {
            'fields': ('metadata', 'created_at', 'updated_at', 'split_hierarchy_display'),
            'classes': ('collapse',)
        }),
    )

    def raw_element_info(self, obj):
        """BIM 원본 객체 정보 표시"""
        return f"{obj.raw_element.element_unique_id}"
    raw_element_info.short_description = 'BIM 원본'

    def volume_ratio_percent(self, obj):
        """체적 비율을 퍼센트로 표시"""
        return f"{float(obj.volume_ratio) * 100:.2f}%"
    volume_ratio_percent.short_description = '체적 비율'

    def split_hierarchy_display(self, obj):
        """분할 계층 구조 표시"""
        hierarchy = obj.get_split_hierarchy()
        return " → ".join([
            f"{split.split_part_type} ({split.split_method})"
            for split in hierarchy
        ])
    split_hierarchy_display.short_description = '분할 계층'

    def effective_volume_ratio_display(self, obj):
        """실제 체적 비율 표시"""
        ratio = obj.calculate_effective_volume_ratio()
        return f"{ratio * 100:.2f}%"
    effective_volume_ratio_display.short_description = '실제 체적 비율'

    def save_model(self, request, obj, form, change):
        # 디버깅: 관리자 페이지에서 SplitElement 저장 시 로그 출력
        print(f"[DEBUG][SplitElementAdmin.save_model] Saving SplitElement: {obj.id}")
        super().save_model(request, obj, form, change)

    actions = ['invalidate_selected_splits']

    def invalidate_selected_splits(self, request, queryset):
        """선택된 분할 객체들을 무효화"""
        count = 0
        for split_element in queryset:
            if split_element.is_active:
                split_element.invalidate_on_bim_change()
                count += 1
        self.message_user(request, f"{count}개의 분할 객체가 무효화되었습니다.")
    invalidate_selected_splits.short_description = "선택된 분할 객체 무효화"
# ▲▲▲ [추가] 여기까지 ▲▲▲