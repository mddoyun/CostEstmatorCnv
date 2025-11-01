# 액티비티 표시 버그 수정 (2025-01-02)

## 문제 상황
3D 뷰어의 "액티비티" 탭에서 선택된 객체와 연관된 산출항목(CostItem)의 액티비티가 표시되지 않는 문제가 발생했습니다.

## 원인 분석
프론트엔드 JavaScript 코드와 백엔드 Django API 간의 필드명 불일치:

1. **백엔드 (views.py:1502)**
   ```python
   'activities': [str(act.id) for act in item.activities.all()]
   ```
   - CostItem의 ManyToManyField인 `activities`를 직렬화하여 전송

2. **프론트엔드 (three_d_viewer.js)**
   ```javascript
   if (item.activity_ids && Array.isArray(item.activity_ids)) {
       item.activity_ids.forEach(activityId => {
   ```
   - 잘못된 필드명 `activity_ids`를 참조하여 데이터를 찾지 못함

## 수정 내용

### 1. three_d_viewer.js (Line 3397, 3426)
**변경 전:**
```javascript
if (item.activity_ids && Array.isArray(item.activity_ids)) {
    item.activity_ids.forEach(activityId => {
```

**변경 후:**
```javascript
if (item.activities && Array.isArray(item.activities)) {
    item.activities.forEach(activityId => {
```

### 2. three_d_viewer.js (Line 3321) - 추가 개선
**변경 전:**
```javascript
html += `<div class="quantity-member-item-name">${item.name || 'Unnamed Item'}</div>`;
html += `<div class="quantity-member-item-info">`;
html += `ID: ${item.id}`;
if (item.cost_code_name) {
    html += ` | 공사코드: ${item.cost_code_name}`;
}
```

**변경 후:**
```javascript
html += `<div class="quantity-member-item-name">${item.cost_code_name || 'Unnamed Item'}</div>`;
html += `<div class="quantity-member-item-info">`;
html += `ID: ${item.id}`;
if (item.quantity !== undefined) {
    html += ` | 수량: ${item.quantity}`;
}
```

**이유:**
- CostItem 모델에는 `name` 필드가 없음
- `cost_code_name`을 사용하는 것이 올바름
- 정보 표시도 중복되는 공사코드명 대신 수량을 표시하도록 개선

## 영향 범위
- **수정된 파일**: `/connections/static/connections/three_d_viewer.js`
- **영향받는 기능**:
  - 3D 뷰어의 "액티비티" 탭
  - 3D 뷰어의 "산출항목" 탭 (표시 개선)

## 테스트 방법
1. 웹 애플리케이션에서 3D 뷰어를 열기
2. 산출항목(CostItem)이 있는 BIM 객체 선택
3. "액티비티" 탭 클릭
4. 해당 산출항목과 연관된 액티비티 목록이 표시되는지 확인
5. "산출항목" 탭에서 공사코드명과 수량이 올바르게 표시되는지 확인

## 데이터 흐름
```
BIM Object (RawElement)
  → QuantityMember
    → CostItem (ManyToMany with Activity)
      → Activity (displayed in 액티비티 tab)
```

## 참고 사항
- Activity는 두 가지 경로로 연결됨:
  1. QuantityMember → Activity (ForeignKey: `activity_id`)
  2. CostItem → Activity (ManyToManyField: `activities`)
- 중복 방지를 위해 Map 자료구조 사용
- 각 액티비티의 출처(QuantityMember 또는 CostItem)를 표시
