/**
 * Chat Command Handler
 * 일반 대화 + 자동 명령 감지 및 실행 시스템
 * Ollama 기반 자연어 대화 + 3D 뷰포트 연동
 */

(function() {
    console.log('[Chat] Initializing conversational chat system with command detection...');

    // ===== 기존 3D 뷰어 함수 맵핑 =====
    const VIEWER_FUNCTIONS = {
        // 3D 뷰포트에서 선택된 객체 가져오기
        getSelectedFromViewer: () => {
            if (typeof window.getSelectedObjectsFrom3DViewer === 'function') {
                return window.getSelectedObjectsFrom3DViewer();
            }
            return [];
        },

        // 3D 뷰포트에서 객체 선택하기 (BIM ID로)
        selectInViewer: (bimObjectIds) => {
            if (typeof window.selectObjectsIn3DViewer === 'function') {
                window.selectObjectsIn3DViewer(bimObjectIds);
                return true;
            }
            return false;
        },

        // 3D 뷰포트 선택 해제
        deselectAll: () => {
            if (typeof window.deselectAllObjects === 'function') {
                window.deselectAllObjects();
                return true;
            }
            return false;
        },

        // 카메라 포커스
        focusOnSelected: () => {
            if (typeof window.focusOnSelectedObjects === 'function') {
                window.focusOnSelectedObjects();
                return true;
            }
            return false;
        },

        // 카메라 리셋
        resetCamera: () => {
            if (typeof window.resetCamera === 'function') {
                window.resetCamera();
                return true;
            }
            return false;
        }
    };

    // ===== 객체 타입 매핑 테이블 =====
    const TYPE_MAPPING = {
        // 한글 -> IFC Class
        '벽': 'IfcWall',
        '문': 'IfcDoor',
        '창': 'IfcWindow',
        '창문': 'IfcWindow',
        '슬래브': 'IfcSlab',
        '바닥': 'IfcSlab',
        '기둥': 'IfcColumn',
        '보': 'IfcBeam',
        '지붕': 'IfcRoof',
        '계단': 'IfcStair',
        '난간': 'IfcRailing',
        '커튼월': 'IfcCurtainWall',
        '가구': 'IfcFurniture',
        '공간': 'IfcSpace',

        // 영어 -> IFC Class (소문자로 매칭)
        'wall': 'IfcWall',
        'brick': 'IfcWall',
        'door': 'IfcDoor',
        'window': 'IfcWindow',
        'slab': 'IfcSlab',
        'floor': 'IfcSlab',
        'column': 'IfcColumn',
        'beam': 'IfcBeam',
        'roof': 'IfcRoof',
        'stair': 'IfcStair',
        'railing': 'IfcRailing',
        'curtainwall': 'IfcCurtainWall',
        'furniture': 'IfcFurniture',
        'space': 'IfcSpace'
    };

    // ===== 유틸리티 함수 =====

    /**
     * 채팅 메시지 추가
     */
    function addChatMessage(text, type = 'assistant') {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return null;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;

        // 마크다운 스타일 간단 처리
        const formattedText = text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');

        messageDiv.innerHTML = formattedText;
        chatMessages.appendChild(messageDiv);

        // 스크롤을 최하단으로
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return messageDiv;
    }

    /**
     * 객체 타입 정규화
     */
    function normalizeObjectType(typeName) {
        const normalized = typeName.toLowerCase().trim();
        return TYPE_MAPPING[normalized] || TYPE_MAPPING[typeName] || typeName;
    }

    // ===== BIM 데이터 검색 함수 =====

    /**
     * 퍼지 매칭으로 BIM 객체 검색
     * 다양한 조건으로 유사한 객체를 찾음
     */
    function findBIMObjects(query) {
        console.log('[Chat] Finding BIM objects with query:', query);

        if (!window.allRevitData || window.allRevitData.length === 0) {
            console.warn('[Chat] No BIM data loaded');
            return [];
        }

        const queryLower = query.toLowerCase();
        const ifcClass = normalizeObjectType(query);

        console.log('[Chat] Normalized to IFC class:', ifcClass);
        console.log('[Chat] Total objects in allRevitData:', window.allRevitData.length);

        // 여러 조건으로 매칭 시도
        const matchedObjects = window.allRevitData.filter(obj => {
            const raw = obj.raw_data || {};

            // IFC 클래스 매칭
            if (raw.IfcClass === ifcClass) return true;

            // 카테고리 매칭
            if (raw.Category && (
                raw.Category === query ||
                raw.Category === ifcClass ||
                raw.Category.toLowerCase().includes(queryLower)
            )) return true;

            // 이름 매칭
            if (raw.Name && raw.Name.toLowerCase().includes(queryLower)) return true;

            // 패밀리 매칭
            if (raw.Family && raw.Family.toLowerCase().includes(queryLower)) return true;

            // 타입 매칭
            if (raw.Type && raw.Type.toLowerCase().includes(queryLower)) return true;

            return false;
        });

        console.log('[Chat] Matched objects:', matchedObjects.length);
        return matchedObjects;
    }

    /**
     * 3D 뷰포트에서 객체 선택 실행
     */
    function selectObjectsInViewport(objects) {
        console.log('[Chat] Selecting objects in viewport:', objects.length);

        if (objects.length === 0) {
            return {
                success: false,
                message: '선택할 객체를 찾을 수 없습니다.'
            };
        }

        // BIM 객체 ID 추출
        const bimObjectIds = objects.map(obj => obj.id).filter(id => id);

        console.log('[Chat] BIM object IDs:', bimObjectIds);

        // 3D 뷰어에서 선택
        if (VIEWER_FUNCTIONS.selectInViewer(bimObjectIds)) {
            return {
                success: true,
                message: `✅ ${objects.length}개 객체를 3D 뷰포트에서 선택했습니다.`,
                count: objects.length
            };
        } else {
            return {
                success: false,
                message: '3D 뷰어 기능을 사용할 수 없습니다.'
            };
        }
    }

    // ===== AI 기반 대화 시스템 =====

    /**
     * Ollama AI에게 대화 요청
     */
    async function chatWithAI(userMessage, conversationHistory = []) {
        console.log('[Chat] Sending message to AI:', userMessage);

        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;

        const formData = new FormData();
        formData.append('message', userMessage);
        formData.append('history', JSON.stringify(conversationHistory));

        try {
            const response = await fetch('/connections/api/chat-conversation/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken
                },
                body: formData,
                timeout: 30000
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('[Chat] AI response:', data);

            return data;
        } catch (error) {
            console.error('[Chat] AI request failed:', error);
            return {
                success: false,
                error: `AI 서버 연결 실패: ${error.message}`
            };
        }
    }

    /**
     * AI 응답에서 명령 감지 및 실행
     */
    async function detectAndExecuteCommand(aiResponse, userMessage) {
        console.log('[Chat] Checking for commands in AI response...');

        // AI가 명령을 감지했는지 확인
        if (!aiResponse.command) {
            console.log('[Chat] No command detected, returning conversation');
            return {
                type: 'conversation',
                message: aiResponse.response || aiResponse.message || '응답을 받을 수 없습니다.'
            };
        }

        console.log('[Chat] Command detected:', aiResponse.command);
        const cmd = aiResponse.command;

        // 명령 실행
        let result = null;

        try {
            switch (cmd.action) {
                case 'select':
                case 'select_objects':
                    // 객체 선택
                    const target = cmd.target || cmd.object_type || cmd.query;
                    if (!target) {
                        result = {
                            success: false,
                            message: '선택할 객체 타입을 알 수 없습니다.'
                        };
                        break;
                    }

                    const objects = findBIMObjects(target);
                    result = selectObjectsInViewport(objects);

                    // 카메라 포커스 (선택 성공 시)
                    if (result.success && cmd.parameters?.focus !== false) {
                        setTimeout(() => VIEWER_FUNCTIONS.focusOnSelected(), 100);
                    }
                    break;

                case 'deselect':
                case 'clear_selection':
                    // 선택 해제
                    if (VIEWER_FUNCTIONS.deselectAll()) {
                        result = {
                            success: true,
                            message: '✅ 모든 선택을 해제했습니다.'
                        };
                    } else {
                        result = {
                            success: false,
                            message: '선택 해제 기능을 사용할 수 없습니다.'
                        };
                    }
                    break;

                case 'focus':
                case 'zoom':
                    // 카메라 포커스
                    if (VIEWER_FUNCTIONS.focusOnSelected()) {
                        result = {
                            success: true,
                            message: '🔍 선택된 객체로 카메라를 이동했습니다.'
                        };
                    } else {
                        result = {
                            success: false,
                            message: '선택된 객체가 없거나 포커스 기능을 사용할 수 없습니다.'
                        };
                    }
                    break;

                case 'reset':
                case 'reset_camera':
                    // 카메라 리셋
                    if (VIEWER_FUNCTIONS.resetCamera()) {
                        result = {
                            success: true,
                            message: '🔄 카메라를 초기화했습니다.'
                        };
                    }
                    break;

                case 'count':
                    // 객체 개수 세기
                    const countTarget = cmd.target || cmd.object_type || cmd.query;
                    if (!countTarget) {
                        result = {
                            success: false,
                            message: '개수를 셀 객체 타입을 알 수 없습니다.'
                        };
                        break;
                    }

                    const countObjects = findBIMObjects(countTarget);
                    result = {
                        success: true,
                        message: `📊 "${countTarget}" 객체는 총 ${countObjects.length}개 있습니다.`,
                        count: countObjects.length
                    };
                    break;

                default:
                    console.warn('[Chat] Unknown command action:', cmd.action);
                    result = {
                        success: false,
                        message: `알 수 없는 명령: ${cmd.action}`
                    };
            }
        } catch (error) {
            console.error('[Chat] Command execution error:', error);
            result = {
                success: false,
                message: `명령 실행 중 오류: ${error.message}`
            };
        }

        // AI의 대화 응답 + 명령 실행 결과 결합
        let fullMessage = '';
        if (aiResponse.response || aiResponse.message) {
            fullMessage += (aiResponse.response || aiResponse.message);
        }
        if (result && result.message) {
            if (fullMessage) fullMessage += '\n\n';
            fullMessage += result.message;
        }

        return {
            type: 'command_executed',
            message: fullMessage || '명령을 실행했습니다.',
            command: cmd,
            result: result
        };
    }

    // ===== 대화 히스토리 관리 =====

    let conversationHistory = [];
    const MAX_HISTORY = 10; // 최근 10개 대화만 유지

    function addToHistory(role, content) {
        conversationHistory.push({ role, content });

        // 히스토리 크기 제한
        if (conversationHistory.length > MAX_HISTORY * 2) {
            conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
        }
    }

    // ===== 메인 처리 함수 =====

    /**
     * 사용자 메시지 처리
     */
    async function processUserMessage(message) {
        console.log('[Chat] ===== Processing user message:', message, '=====');

        // 도움말 처리
        if (message === '도움말' || message.toLowerCase() === 'help') {
            return {
                type: 'help',
                message: getHelpText()
            };
        }

        // 히스토리 초기화
        if (message === '초기화' || message === 'clear' || message.toLowerCase() === 'reset chat') {
            conversationHistory = [];
            return {
                type: 'system',
                message: '🔄 대화 히스토리를 초기화했습니다.'
            };
        }

        // AI와 대화
        const aiResponse = await chatWithAI(message, conversationHistory);

        if (!aiResponse.success) {
            return {
                type: 'error',
                message: `❌ ${aiResponse.error || 'AI 서버에 연결할 수 없습니다.'}`
            };
        }

        // 히스토리에 추가
        addToHistory('user', message);
        addToHistory('assistant', aiResponse.response || aiResponse.message);

        // 명령 감지 및 실행
        const result = await detectAndExecuteCommand(aiResponse, message);

        return result;
    }

    /**
     * 도움말 텍스트
     */
    function getHelpText() {
        return `
**💬 AI 채팅 도우미**

저는 일반 대화와 BIM 명령을 모두 이해할 수 있습니다!

**🎯 명령 예시**
• "벽을 3D 뷰포트에서 선택해줘"
• "brick 선택"
• "문 객체 몇 개야?"
• "선택한 객체로 줌"
• "선택 해제"
• "카메라 리셋"

**💡 일반 대화**
• "안녕하세요"
• "BIM이 뭐야?"
• "이 프로그램 어떻게 사용해?"

**🔧 시스템 명령**
• "도움말" - 이 메시지 표시
• "초기화" - 대화 히스토리 초기화

자연스럽게 이야기해주세요! 명령이 포함된 경우 자동으로 실행됩니다.
        `.trim();
    }

    // ===== 이벤트 리스너 설정 =====

    setTimeout(() => {
        console.log('[Chat] Setting up event listeners...');
        const chatInput = document.getElementById('chat-input');
        const chatSendBtn = document.getElementById('chat-send-btn');

        if (!chatInput || !chatSendBtn) {
            console.error('[Chat] Chat input elements not found!');
            return;
        }

        console.log('[Chat] Event listeners attached successfully');

        // 전송 버튼 클릭
        chatSendBtn.addEventListener('click', async () => {
            console.log('[Chat] Send button clicked!');
            const message = chatInput.value.trim();
            if (!message) return;

            // 사용자 메시지 표시
            addChatMessage(message, 'user');
            chatInput.value = '';

            // 로딩 표시
            const loadingMsg = addChatMessage('⏳ AI가 생각 중...', 'system');

            // 메시지 처리
            const result = await processUserMessage(message);

            // 로딩 메시지 제거
            if (loadingMsg && loadingMsg.parentNode) {
                loadingMsg.parentNode.removeChild(loadingMsg);
            }

            // 응답 표시
            addChatMessage(result.message, 'assistant');
        });

        // Enter 키로 전송
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chatSendBtn.click();
            }
        });

        // 환영 메시지
        addChatMessage('안녕하세요! 👋 무엇을 도와드릴까요?\n일반 대화도 가능하고, BIM 명령도 실행할 수 있습니다.\n"도움말"을 입력하면 사용 가능한 기능을 확인할 수 있어요.', 'assistant');

        console.log('[Chat] Conversational chat system initialized successfully');
    }, 1000);

    // ===== 전역 함수 노출 =====
    window.processChatMessage = processUserMessage;
    window.addChatMessage = addChatMessage;
    window.findBIMObjects = findBIMObjects;

})();
