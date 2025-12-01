# 프로젝트 삭제 버그 수정 및 공사코드 내보내기 개선 (v1.4.3)

## 작업 일시
2025-12-02

## 작업 개요
1. 프로젝트 삭제 기능 버그 수정 (CSRF 오류)
2. 데이터베이스 마이그레이션 로직 개선
3. 공사코드(CostCode) 내보내기/가져오기 전체 필드 지원
4. Revit 애드인 설치 파일 v1.4.3 빌드

---

## 1. 프로젝트 삭제 CSRF 오류 수정

### 문제
- 홈 화면에서 프로젝트 선택 후 "프로젝트 삭제" 버튼 클릭 시 삭제가 안 됨
- 403 Forbidden 오류 발생

### 원인
- `delete_project` 뷰 함수에 `@csrf_exempt` 데코레이터 누락

### 수정 내용
**파일**: `connections/views.py`

```python
# 수정 전
def delete_project(request, project_id):
    """프로젝트를 삭제하는 API"""

# 수정 후
@csrf_exempt
def delete_project(request, project_id):
    """프로젝트를 삭제하는 API"""
```

---

## 2. 데이터베이스 마이그레이션 로직 개선

### 문제
- 프로젝트 삭제 시 "no such table: connections_aiclassificationtrainingdata" 오류 발생
- 배포된 DB에 migrations 0033, 0034가 적용되지 않음

### 원인
- `run_server.py`에서 DB 파일이 100KB 이상이면 마이그레이션을 스킵하던 로직

### 수정 내용
**파일**: `run_server.py`

기존 로직에서 마이그레이션을 항상 실행하도록 변경:
- Django의 `migrate` 명령은 이미 적용된 마이그레이션은 자동으로 스킵
- 새로운 마이그레이션만 적용되므로 기존 데이터는 유지됨

```python
try:
    # --- 4. Run database migration ---
    # Django migrate는 이미 적용된 마이그레이션은 스킵하고 새로운 것만 적용합니다.
    # 기존 데이터는 유지되면서 새 테이블/필드만 추가됩니다.
    print("\n--- Checking and applying database migrations ---")
    execute_from_command_line([sys.argv[0], 'migrate', '--verbosity', '1'])
    print("--- Database migration check complete ---\n")
```

### 동작 방식
1. 서버 시작 시 항상 `migrate` 실행
2. 이미 적용된 마이그레이션은 "No migrations to apply" 또는 스킵
3. 새로운 마이그레이션만 적용 (기존 데이터 보존)
4. 사용자는 기존 프로젝트를 그대로 사용 가능

---

## 3. 공사코드 내보내기/가져오기 전체 필드 지원

### 문제
- 공사코드 내보내기 시 6개 필드만 저장됨
- 실제 CostCode 모델에는 15개 필드 존재

### 기존 내보내기 필드 (6개)
```
code, name, spec, unit, category, description
```

### 수정 후 내보내기 필드 (15개)
```
code, name, description, detail_code, category, product_name,
spec, unit, secondary_name, secondary_spec, secondary_unit,
secondary_detail_code, note, ai_sd_enabled, dd_enabled
```

### 수정 내용
**파일**: `connections/views.py`

#### export_cost_codes 함수
```python
@require_http_methods(["GET"])
def export_cost_codes(request, project_id):
    project = Project.objects.get(id=project_id)
    codes = CostCode.objects.filter(project=project)

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{project.name}_cost_codes.csv"'

    writer = csv.writer(response)
    # [수정 2025-12-01] 모든 필드 포함
    writer.writerow([
        'code', 'name', 'description', 'detail_code', 'category', 'product_name',
        'spec', 'unit', 'secondary_name', 'secondary_spec', 'secondary_unit',
        'secondary_detail_code', 'note', 'ai_sd_enabled', 'dd_enabled'
    ])
    for code in codes:
        writer.writerow([
            code.code, code.name, code.description or '', code.detail_code or '',
            code.category or '', code.product_name or '', code.spec or '', code.unit or '',
            code.secondary_name or '', code.secondary_spec or '', code.secondary_unit or '',
            code.secondary_detail_code or '', code.note or '',
            'TRUE' if code.ai_sd_enabled else 'FALSE',
            'TRUE' if code.dd_enabled else 'FALSE'
        ])
    return response
```

#### import_cost_codes 함수
```python
@require_http_methods(["POST"])
def import_cost_codes(request, project_id):
    # ... 파일 읽기 로직 ...

    for row in reader:
        if len(row) >= 2:
            code_value = row[0].strip()
            name = row[1].strip()
            description = row[2].strip() if len(row) > 2 else ''
            detail_code = row[3].strip() if len(row) > 3 else ''
            category = row[4].strip() if len(row) > 4 else ''
            product_name = row[5].strip() if len(row) > 5 else ''
            spec = row[6].strip() if len(row) > 6 else ''
            unit = row[7].strip() if len(row) > 7 else ''
            secondary_name = row[8].strip() if len(row) > 8 else ''
            secondary_spec = row[9].strip() if len(row) > 9 else ''
            secondary_unit = row[10].strip() if len(row) > 10 else ''
            secondary_detail_code = row[11].strip() if len(row) > 11 else ''
            note = row[12].strip() if len(row) > 12 else ''
            ai_sd_enabled = row[13].strip().upper() == 'TRUE' if len(row) > 13 else True
            dd_enabled = row[14].strip().upper() == 'TRUE' if len(row) > 14 else True

            CostCode.objects.update_or_create(
                project=project,
                code=code_value,
                defaults={
                    'name': name,
                    'description': description,
                    'detail_code': detail_code,
                    'category': category,
                    'product_name': product_name,
                    'spec': spec,
                    'unit': unit,
                    'secondary_name': secondary_name,
                    'secondary_spec': secondary_spec,
                    'secondary_unit': secondary_unit,
                    'secondary_detail_code': secondary_detail_code,
                    'note': note,
                    'ai_sd_enabled': ai_sd_enabled,
                    'dd_enabled': dd_enabled
                }
            )
```

### 다른 내보내기/가져오기 함수 검토
다음 함수들은 이미 모든 필드를 올바르게 처리하고 있음:
- `export_tags` / `import_tags` - QuantityClassificationTag
- `export_member_marks` / `import_member_marks` - MemberMark
- `export_spaces` / `import_spaces` - Space
- `export_activities` / `import_activities` - Activity
- 룰셋 내보내기/가져오기 함수들

---

## 4. 설치 파일 빌드 (v1.4.3)

### 빌드 프로세스
1. Django 서버 PyInstaller 빌드
2. Revit 애드인 Release 빌드
3. 서버 실행파일을 Revit 애드인 폴더로 복사
4. Inno Setup 설치 파일 생성

### 빌드 명령어

#### 서버 빌드
```bash
.mddoyun/Scripts/pyinstaller.exe --clean --name "CostEstimatorServer" \
  --onefile \
  --add-data "db.sqlite3;." \
  --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" \
  --add-data "connections;connections" \
  --hidden-import "channels" \
  --hidden-import "daphne" \
  --hidden-import "django" \
  run_server.py
```

#### Revit 애드인 빌드
```bash
dotnet build CostEstimator_RevitAddin_2026/AiBimCost.csproj -c Release
```

#### 설치 파일 생성
```bash
"C:/Program Files (x86)/Inno Setup 6/ISCC.exe" installer_allinone.iss
```

### 생성된 파일
- 위치: `dist/CostEstimator_AllInOne_v1.4.3_Setup.exe`
- 크기: 631MB

### 설치 파일 내용물
- Django 서버 (`CostEstimatorServer.exe`) - 640MB
- Revit 2026 애드인 DLL 및 종속성
- 아이콘 파일 (`Icons/Tool.png`)
- README 문서

---

## 수정된 파일 목록

| 파일 | 수정 내용 |
|------|-----------|
| `connections/views.py` | delete_project에 @csrf_exempt 추가, CostCode 내보내기/가져오기 전체 필드 지원 |
| `run_server.py` | 마이그레이션 항상 실행하도록 수정 |
| `installer_allinone.iss` | 버전 1.4.2 → 1.4.3 업데이트 |

---

## 테스트 결과

1. **프로젝트 삭제**: 정상 동작 확인
2. **마이그레이션**: 기존 데이터 유지하면서 새 테이블 추가 확인
3. **공사코드 내보내기**: 15개 필드 모두 CSV에 저장 확인
4. **설치 파일**: 정상 생성 (631MB)

---

## 버전 정보
- **버전**: 1.4.3
- **빌드 일시**: 2025-12-02 00:32
- **주요 변경**: 프로젝트 삭제 버그 수정, 마이그레이션 개선, CostCode 필드 확장
