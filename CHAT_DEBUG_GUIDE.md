# 채팅 명령 시스템 디버깅 가이드

## 🔍 디버깅 로그 추가 완료

채팅 명령 시스템의 모든 주요 함수에 상세한 콘솔 로그가 추가되었습니다.

### 추가된 로그 포인트

1. **초기화 단계**
   - `[Chat] Initializing chat command handler...`
   - `[Chat] Setting up event listeners...`
   - `[Chat] Event listeners attached successfully`

2. **이벤트 핸들러**
   - `[Chat] Send button clicked!`
   - `[Chat] ===== Processing command: {message} =====`

3. **패턴 매칭**
   - `[Chat] Step 1: Trying local pattern matching...`
   - `[Chat] Pattern matched! {action}`

4. **명령 실행**
   - `[Chat] executeCommand called: {action} {params}`
   - `[Chat] Executing SELECT action`

5. **객체 선택 과정**
   - `[Chat] selectObjectsByType called with: {typeName}`
   - `[Chat] Normalized to IFC class: {ifcClass}`
   - `[Chat] Total objects in allRevitData: {count}`
   - `[Chat] Matched objects: {count}`
   - `[Chat] Checking if selectObjectsInViewer exists: {type}`

6. **3D 뷰어 함수**
   - `[3D Viewer] Selecting objects from chat command: {count}`
   - `[3D Viewer] Found meshes to select: {count}`

## 🧪 테스트 방법

### 1. 브라우저에서 테스트

1. **브라우저 콘솔 열기**
   ```
   Chrome/Edge: F12 또는 Cmd+Option+I (Mac)
   Safari: Cmd+Option+C (Mac, 개발자 모드 활성화 필요)
   ```

2. **웹 앱 접속**
   ```
   http://127.0.0.1:8000
   ```

3. **BIM 데이터 로드**
   - Revit 또는 Blender에서 데이터 전송
   - 또는 기존 프로젝트 로드

4. **채팅 패널에서 명령 입력**
   ```
   벽 선택해줘
   ```

5. **콘솔 로그 확인**
   ```
   [Chat] Send button clicked!
   [Chat] ===== Processing command: 벽 선택해줘 =====
   [Chat] Step 1: Trying local pattern matching...
   [Chat] Pattern matched! select
   [Chat] executeCommand called: select {target: "벽"}
   [Chat] Executing SELECT action
   [Chat] selectObjectsByType called with: 벽
   [Chat] Normalized to IFC class: IfcWall
   [Chat] Total objects in allRevitData: 150
   [Chat] Matched objects: 25
   [Chat] Checking if selectObjectsInViewer exists: function
   [3D Viewer] Selecting objects from chat command: 25
   [3D Viewer] Found meshes to select: 25
   ```

### 2. 예상 문제 및 해결

#### 문제 1: "Chat input elements not found!"
```
[Chat] Chat input elements not found!
```

**원인**: 채팅 패널 DOM 요소가 아직 생성되지 않음

**해결**:
- 페이지 새로고침 (Cmd+R 또는 F5)
- `chat_command_handler.js`의 setTimeout 값 증가

#### 문제 2: "No BIM data loaded"
```
[Chat] No BIM data loaded
```

**원인**: `window.allRevitData`가 비어있음

**해결**:
1. Revit/Blender에서 데이터 전송 확인
2. 콘솔에서 확인:
   ```javascript
   console.log(window.allRevitData);
   ```
3. 데이터 로드 후 다시 시도

#### 문제 3: "Matched objects: 0"
```
[Chat] Matched objects: 0
```

**원인**: 필터 조건과 일치하는 객체가 없음

**해결**:
1. 객체 타입 확인:
   ```javascript
   // 콘솔에서 실행
   window.allRevitData.forEach(obj => {
       console.log(obj.IfcClass, obj.Category, obj.Name);
   });
   ```
2. 올바른 타입으로 다시 시도:
   - "벽" → IfcWall
   - "문" → IfcDoor
   - "슬래브" → IfcSlab

#### 문제 4: "selectObjectsInViewer exists: undefined"
```
[Chat] Checking if selectObjectsInViewer exists: undefined
```

**원인**: 3D 뷰어가 초기화되지 않음

**해결**:
1. 3D 뷰어 초기화 대기
2. 콘솔에서 확인:
   ```javascript
   console.log(typeof window.selectObjectsInViewer);
   ```
3. 페이지 새로고침

## 🐛 일반적인 문제

### 채팅 패널이 보이지 않음
- 좌측 상단의 파란색 세로 바를 클릭하여 펼치기
- 또는 `collapsed` 클래스 제거

### AI 응답이 느림
- 첫 요청은 모델 로딩으로 5-10초 소요
- 이후 요청은 1-2초로 빨라짐
- Ollama 서버 상태 확인:
  ```bash
  curl http://localhost:11434/api/tags
  ```

### 로컬 패턴이 작동하지 않음
- 패턴 목록 확인:
  ```javascript
  // 콘솔에서 실행 (chat_command_handler.js 스코프 내)
  console.log(COMMAND_PATTERNS);
  ```
- 새 패턴 추가 필요 시 `chat_command_handler.js` 수정

## 📊 성능 모니터링

### 브라우저 콘솔에서 실행

```javascript
// 전체 데이터 카운트
console.log('Total objects:', window.allRevitData?.length);

// 타입별 카운트
const typeCounts = {};
window.allRevitData?.forEach(obj => {
    const type = obj.IfcClass || 'Unknown';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
});
console.table(typeCounts);

// 선택된 객체 확인
console.log('Selected objects:', window.selectedObjects?.length);

// 3D 뷰어 상태
console.log('Scene children:', window.scene?.children.length);
```

## 🔧 고급 디버깅

### 특정 함수 직접 호출

```javascript
// 콘솔에서 직접 테스트
window.selectObjectsInViewer([
    window.allRevitData[0],
    window.allRevitData[1]
]);

// 카메라 포커스
window.focusOnSelectedObjects();

// 카메라 리셋
window.resetCamera();
```

### 명령 파싱 테스트

```javascript
// chat_command_handler.js 스코프에서 (디버거 사용)
const testCommand = "벽을 빨간색으로";
// processCommand 함수에 브레이크포인트 설정
```

## 📝 로그 레벨

현재 모든 로그가 `console.log`로 출력됩니다.

- `console.log`: 일반 정보
- `console.warn`: 경고 (데이터 없음 등)
- `console.error`: 오류

필요시 로그 레벨 필터링:
```javascript
// 브라우저 콘솔 필터에서 "[Chat]" 입력
```

## 🎯 다음 단계

1. **브라우저에서 테스트**
   - `http://127.0.0.1:8000` 접속
   - 개발자 도구 콘솔 열기
   - 채팅 명령 입력

2. **로그 확인**
   - 각 단계별 로그 출력 확인
   - 에러 발생 시 스택 트레이스 확인

3. **문제 보고**
   - 어느 단계에서 멈췄는지
   - 에러 메시지 전체
   - 콘솔 로그 스크린샷

---

**모든 디버깅 로그가 준비되었습니다!**  
이제 브라우저에서 실제로 테스트하고 콘솔 로그를 확인하면 문제를 정확히 파악할 수 있습니다.
