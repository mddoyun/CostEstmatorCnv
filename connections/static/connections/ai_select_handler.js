/**
 * AI 기반 객체 선택 핸들러
 * - 5단계 파이프라인: 속성 결정 → 후보 검색 → 샘플링 → AI 분석 → 필터링
 */

async function handleAiSelectCommand(userQuery) {
    console.log('[AI Select] ==================== START ====================');
    console.log('[AI Select] User query:', userQuery);

    try {
        // 인덱스 확인 및 빌드
        if (!window.aiIndexBuilder || window.aiIndexBuilder.indexes.byKeyword.size === 0) {
            console.log('[AI Select] Building indexes...');
            await window.aiIndexBuilder.buildAll();
        }

        const processor = window.aiQueryProcessor;

        // === Step 0: 학습된 룰셋 먼저 확인 ===
        console.log('[AI Select] Step 0: Checking learned rules...');
        const matchedRule = processor.findMatchingRule(userQuery);

        if (matchedRule) {
            console.log('[AI Select] ✓ Found matching learned rule, applying directly');
            showToast(`학습된 룰셋 적용 중: ${matchedRule.name}`, 'success');

            // 룰셋 기반 선택
            const ruleResults = processor.selectByLearnedRule(matchedRule);

            if (ruleResults.length > 0) {
                console.log(`[AI Select] Rule selected ${ruleResults.length} objects`);
                showToast(`${ruleResults.length}개 객체 선택됨 (학습된 룰셋)`, 'success');

                // 3D 뷰포트에서 선택
                const resultIds = ruleResults.map(r => r.id);
                if (window.selectObjectsInViewer) {
                    window.selectObjectsInViewer(resultIds);
                    console.log('[AI Select] Objects selected in viewport via selectObjectsInViewer');
                } else {
                    console.error('[AI Select] selectObjectsInViewer function not found');
                }

                // 피드백 수집
                window.lastAiSelection = {
                    query: userQuery,
                    aiSelectedIds: resultIds,
                    timestamp: Date.now(),
                    confidence: matchedRule.confidence,
                    source: 'learned_rule',
                    rule_id: matchedRule.id,
                    rule_name: matchedRule.name
                };

                // 피드백 UI 표시
                if (window.showAiFeedbackPanel) {
                    window.showAiFeedbackPanel(resultIds.length);
                }

                console.log('[AI Select] ==================== END ====================');
                return;
            } else {
                console.log('[AI Select] Rule matched but found 0 objects, falling back to AI analysis');
                showToast('룰셋이 매칭되지 않아 AI 분석으로 전환합니다', 'info');
            }
        } else {
            console.log('[AI Select] No matching rule found, proceeding with AI analysis');
        }

        // === Step 0.5: 임베딩 검색 시도 (실험적) ===
        let candidateIds = [];
        let embeddingSearchUsed = false;

        try {
            showToast('임베딩 검색 시도 중...', 'info');
            const embeddingResults = await processor.searchByEmbedding(userQuery, 20, 0.5);

            if (embeddingResults && embeddingResults.length > 0) {
                console.log(`[AI Select] Embedding search found ${embeddingResults.length} objects, using these`);
                candidateIds = embeddingResults;
                embeddingSearchUsed = true;
            } else {
                console.log('[AI Select] Embedding search returned 0 results, falling back to keyword search');
            }
        } catch (error) {
            console.warn('[AI Select] Embedding search failed or unavailable, falling back to keyword search:', error);
        }

        // === Step 1-2: 키워드 기반 검색 (임베딩이 실패한 경우 폴백) ===
        if (!embeddingSearchUsed || candidateIds.length === 0) {
            // === Step 1: AI가 필요한 속성 결정 ===
            showToast('AI가 쿼리를 분석 중...', 'info');
            const attributeSpec = await processor.determineRelevantAttributes(userQuery);

            if (attributeSpec.intent !== 'select') {
                console.warn('[AI Select] Query intent is not "select":', attributeSpec.intent);
                showToast(`이 쿼리는 선택이 아닌 "${attributeSpec.intent}" 작업입니다.`, 'warning');
                // TODO: answer나 section intent 처리
                return;
            }

            // === Step 2: 인덱스로 후보 객체 찾기 ===
            showToast('후보 객체 검색 중...', 'info');
            candidateIds = await processor.findCandidateObjects(attributeSpec);
        }

        if (candidateIds.length === 0) {
            showToast('AI가 객체를 찾지 못했습니다. 정답을 알려주세요.', 'info');
            console.log('[AI Select] No candidates found');

            // 피드백 수집: AI가 0개 선택 (사용자가 정답 알려줄 수 있도록)
            window.lastAiSelection = {
                query: userQuery,
                aiSelectedIds: [], // AI가 아무것도 못 찾음
                timestamp: Date.now(),
                confidence: 0.0
            };

            // 피드백 UI 표시 (정답 알려주기)
            if (window.showAiFeedbackPanel) {
                window.showAiFeedbackPanel(0); // 0개 선택됨
            }

            console.log('[AI Select] ==================== END ====================');
            return;
        }

        console.log(`[AI Select] Found ${candidateIds.length} candidates`);
        if (embeddingSearchUsed) {
            console.log('[AI Select] 🎯 Results from EMBEDDING SEARCH (semantic similarity)');
        }

        // If candidates are few enough, skip filtering and select all
        if (candidateIds.length <= 20) {
            console.log(`[AI Select] Candidate count (${candidateIds.length}) is small, selecting all without filtering`);
            showToast(`${candidateIds.length}개 객체를 찾았습니다`, 'info');

            const searchMethod = embeddingSearchUsed ? 'Found by embedding search (semantic)' : 'Found by keyword search';
            const finalResults = candidateIds.map(id => ({
                id,
                reasons: [searchMethod]
            }));

            const selectedIds = finalResults.map(r => r.id);

            // === 3D 뷰포트에서 선택 ===
            if (window.selectObjectsInViewer) {
                window.selectObjectsInViewer(selectedIds);

                console.log('[AI Select] Selection reasons:');
                finalResults.slice(0, 5).forEach((r, idx) => {
                    console.log(`  [${idx + 1}] ID: ${r.id}`);
                    console.log(`      Reasons: ${r.reasons.join(' AND ')}`);
                });

                if (finalResults.length > 5) {
                    console.log(`  ... and ${finalResults.length - 5} more`);
                }
            }

            // 피드백 수집: AI 선택 결과 저장
            window.lastAiSelection = {
                query: userQuery,
                aiSelectedIds: selectedIds,
                timestamp: Date.now(),
                confidence: 0.9
            };

            // 무조건 피드백 UI 표시 (사용자가 정답 제출)
            if (window.showAiFeedbackPanel) {
                window.showAiFeedbackPanel(finalResults.length);
            } else {
                console.error('[AI Select] showAiFeedbackPanel not found');
            }

            console.log('[AI Select] ==================== END ====================');
            return;
        }

        // === Step 3: 샘플 선택 ===
        showToast(`${candidateIds.length}개 후보 중 샘플 선택...`, 'info');
        const sampleIds = processor.selectRepresentativeSamples(candidateIds);

        // === Step 4: AI가 샘플 분석하여 필터 규칙 생성 ===
        showToast('AI가 샘플을 분석 중...', 'info');
        const filterSpec = await processor.analyzeSamplesAndDecide(userQuery, sampleIds, candidateIds);

        // ▼▼▼ Detailed logging for filter rules debugging ▼▼▼
        console.log('[AI Select] ===== FILTER RULES DETAILS =====');
        console.log('[AI Select] Total filter rules:', filterSpec.filter_rules.length);
        filterSpec.filter_rules.forEach((rule, idx) => {
            console.log(`[AI Select] Rule ${idx + 1}:`, JSON.stringify(rule, null, 2));
        });
        console.log('[AI Select] AI Analysis:', filterSpec.analysis);
        console.log('[AI Select] Expected match count:', filterSpec.expected_match_count);
        console.log('[AI Select] ====================================');

        // === Step 5: 필터 규칙 적용하여 최종 선택 ===
        showToast('필터 규칙 적용 중...', 'info');
        const finalResults = processor.applyFilterRules(candidateIds, filterSpec.filter_rules);

        console.log('[AI Select] Final results:', finalResults.length);
        console.log('[AI Select] Confidence:', filterSpec.confidence);

        // === 3D 뷰포트에서 선택 ===
        if (finalResults.length > 0) {
            const selectedIds = finalResults.map(r => r.id);

            if (window.selectObjectsInViewer) {
                // Use the global selectObjectsInViewer function with raw element IDs
                window.selectObjectsInViewer(selectedIds);

                // 성공 메시지 + 피드백 버튼
                showToast(
                    `✓ ${finalResults.length}개 객체 선택 완료 (확신도: ${(filterSpec.confidence * 100).toFixed(0)}%)`,
                    'success'
                );

                // 선택 이유 로그
                console.log('[AI Select] Selection reasons:');
                finalResults.slice(0, 5).forEach((r, idx) => {
                    console.log(`  [${idx + 1}] ID: ${r.id}`);
                    console.log(`      Reasons: ${r.reasons.join(' AND ')}`);
                });

                if (finalResults.length > 5) {
                    console.log(`  ... and ${finalResults.length - 5} more`);
                }

                // 학습: 성공적인 쿼리로 기록
                processor.recordQuery(userQuery, finalResults.length, filterSpec.confidence);
                processor.updatePriorities(attributeSpec.primary_attributes, true);

                // 피드백 수집: AI 선택 결과 저장 (사용자가 나중에 수정할 수 있도록)
                window.lastAiSelection = {
                    query: userQuery,
                    aiSelectedIds: selectedIds,
                    timestamp: Date.now(),
                    confidence: filterSpec.confidence
                };

                // 뷰포트에 피드백 UI 표시
                if (window.showAiFeedbackPanel) {
                    window.showAiFeedbackPanel(finalResults.length);
                }

            } else {
                console.error('[AI Select] Viewer not available - selectObjectsInViewer function not found');
                showToast('3D 뷰어를 사용할 수 없습니다.', 'error');
            }
        } else {
            // 필터 후 결과 없음
            showToast('AI가 객체를 찾지 못했습니다. 정답을 알려주세요.', 'info');
            console.log('[AI Select] No objects matched filter rules');

            // 피드백 수집: AI가 0개 선택 (사용자가 정답 알려줄 수 있도록)
            window.lastAiSelection = {
                query: userQuery,
                aiSelectedIds: [], // AI가 아무것도 못 찾음
                timestamp: Date.now(),
                confidence: filterSpec.confidence
            };

            // 피드백 UI 표시 (정답 알려주기)
            if (window.showAiFeedbackPanel) {
                window.showAiFeedbackPanel(0); // 0개 선택됨
            }
        }

        console.log('[AI Select] ==================== END ====================');

    } catch (error) {
        console.error('[AI Select] Error:', error);
        showToast(`오류 발생: ${error.message}`, 'error');
    }
}

// === 뷰포트 피드백 UI ===
window.showAiFeedbackPanel = function(selectedCount) {
    // 기존 패널이 있다면 제거
    const existingPanel = document.getElementById('ai-feedback-panel');
    if (existingPanel) {
        existingPanel.remove();
    }

    // 피드백 패널 생성
    const panel = document.createElement('div');
    panel.id = 'ai-feedback-panel';
    panel.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        border: 2px solid #1976d2;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        min-width: 280px;
        font-family: Arial, sans-serif;
        animation: slideIn 0.3s ease-out;
    `;

    panel.innerHTML = `
        <style>
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            #ai-feedback-panel .title {
                font-weight: bold;
                font-size: 16px;
                color: #1976d2;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #ai-feedback-panel .info {
                font-size: 14px;
                color: #666;
                margin-bottom: 16px;
            }
            #ai-feedback-panel .button-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            #ai-feedback-panel button {
                padding: 10px 16px;
                border: none;
                border-radius: 4px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
            }
            #ai-feedback-panel button:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            #ai-feedback-panel .btn-correct {
                background: #4CAF50;
                color: white;
            }
            #ai-feedback-panel .btn-correct:hover {
                background: #45a049;
            }
            #ai-feedback-panel .btn-fix {
                background: #ff9800;
                color: white;
            }
            #ai-feedback-panel .btn-fix:hover {
                background: #fb8c00;
            }
            #ai-feedback-panel .btn-close {
                background: #f44336;
                color: white;
            }
            #ai-feedback-panel .btn-close:hover {
                background: #da190b;
            }
        </style>
        <div class="title">
            🤖 AI 선택 결과 확인
        </div>
        <div class="info">
            ${selectedCount}개 객체가 선택되었습니다.<br>
            결과가 정확한가요?
        </div>
        <div class="button-group">
            <button class="btn-correct" onclick="window.confirmAiSelectionCorrect()">
                ✓ 정확합니다
            </button>
            <button class="btn-fix" onclick="window.startAiSelectionCorrection()">
                ✗ 수정하겠습니다
            </button>
            <button class="btn-close" onclick="window.closeAiFeedbackPanel()">
                × 닫기
            </button>
        </div>
    `;

    document.body.appendChild(panel);
    console.log('[AI Feedback UI] Feedback panel shown');
};

window.closeAiFeedbackPanel = function() {
    const panel = document.getElementById('ai-feedback-panel');
    if (panel) {
        panel.remove();
        console.log('[AI Feedback UI] Panel closed');
    }
};

window.confirmAiSelectionCorrect = function() {
    console.log('[AI Feedback] User confirmed selection is correct');

    if (!window.lastAiSelection) {
        showToast('이전 선택 기록이 없습니다.', 'error');
        window.closeAiFeedbackPanel();
        return;
    }

    const { query, aiSelectedIds, timestamp, confidence } = window.lastAiSelection;

    // 피드백 저장
    window.aiQueryProcessor.saveFeedback({
        query,
        aiSelectedIds,
        userCorrectedIds: aiSelectedIds, // 정확하므로 AI 선택과 동일
        wasCorrect: true,
        timestamp,
        confidence
    });

    showToast('✓ 피드백 감사합니다! 학습에 반영됩니다.', 'success');
    if (window.addChatMessage) {
        window.addChatMessage('✓ 정답으로 저장되었습니다.', 'system');
    }

    window.closeAiFeedbackPanel();
    window.lastAiSelection = null;
};

window.startAiSelectionCorrection = function() {
    console.log('[AI Feedback] User wants to correct selection');

    // 패널 내용을 수정 모드로 변경
    const panel = document.getElementById('ai-feedback-panel');
    if (!panel) return;

    panel.innerHTML = `
        <style>
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            #ai-feedback-panel .title {
                font-weight: bold;
                font-size: 16px;
                color: #ff9800;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #ai-feedback-panel .info {
                font-size: 14px;
                color: #666;
                margin-bottom: 16px;
                line-height: 1.6;
            }
            #ai-feedback-panel .instruction {
                background: #fff3cd;
                border-left: 4px solid #ff9800;
                padding: 12px;
                margin-bottom: 16px;
                font-size: 13px;
                line-height: 1.5;
            }
            #ai-feedback-panel .button-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            #ai-feedback-panel button {
                padding: 10px 16px;
                border: none;
                border-radius: 4px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
            }
            #ai-feedback-panel button:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            #ai-feedback-panel .btn-save {
                background: #4CAF50;
                color: white;
            }
            #ai-feedback-panel .btn-save:hover {
                background: #45a049;
            }
            #ai-feedback-panel .btn-cancel {
                background: #9e9e9e;
                color: white;
            }
            #ai-feedback-panel .btn-cancel:hover {
                background: #757575;
            }
        </style>
        <div class="title">
            ✏️ 정답 선택 중...
        </div>
        <div class="instruction">
            <strong>안내:</strong><br>
            1. 뷰포트에서 정확한 객체를 선택하세요<br>
            2. Ctrl+클릭으로 여러 객체 선택 가능<br>
            3. 선택 완료 후 아래 버튼을 눌러주세요
        </div>
        <div class="info" id="current-selection-info">
            현재 선택: <span id="selection-count">0</span>개
        </div>
        <div class="button-group">
            <button class="btn-save" onclick="window.saveCorrectedSelection()">
                💾 이 선택이 정답입니다
            </button>
            <button class="btn-cancel" onclick="window.closeAiFeedbackPanel()">
                취소
            </button>
        </div>
    `;

    // 선택 개수 실시간 업데이트
    const updateSelectionCount = setInterval(() => {
        const countSpan = document.getElementById('selection-count');
        if (!countSpan) {
            clearInterval(updateSelectionCount);
            return;
        }
        const selectedIds = window.getSelectedObjectIds ? window.getSelectedObjectIds() : [];
        countSpan.textContent = selectedIds.length;
    }, 500);

    showToast('뷰포트에서 정확한 객체를 선택해주세요', 'info');
};

window.saveCorrectedSelection = function() {
    if (!window.lastAiSelection) {
        showToast('이전 선택 기록이 없습니다.', 'error');
        window.closeAiFeedbackPanel();
        return;
    }

    const userCorrectedIds = window.getSelectedObjectIds ? window.getSelectedObjectIds() : [];

    if (userCorrectedIds.length === 0) {
        showToast('선택된 객체가 없습니다. 정확한 객체를 선택해주세요.', 'warning');
        return;
    }

    const { query, aiSelectedIds, timestamp, confidence } = window.lastAiSelection;

    // 차이 분석
    const aiSet = new Set(aiSelectedIds);
    const userSet = new Set(userCorrectedIds);

    const falsePositives = aiSelectedIds.filter(id => !userSet.has(id)); // AI가 잘못 선택
    const falseNegatives = userCorrectedIds.filter(id => !aiSet.has(id)); // AI가 누락

    console.log('[AI Feedback] Correction analysis:', {
        aiCount: aiSelectedIds.length,
        userCount: userCorrectedIds.length,
        falsePositives: falsePositives.length,
        falseNegatives: falseNegatives.length
    });

    // 피드백 저장
    window.aiQueryProcessor.saveFeedback({
        query,
        aiSelectedIds,
        userCorrectedIds,
        wasCorrect: false,
        falsePositives,
        falseNegatives,
        timestamp,
        confidence
    });

    showToast(
        `✓ 정답이 저장되었습니다!\nAI: ${aiSelectedIds.length}개 → 정답: ${userCorrectedIds.length}개`,
        'success'
    );

    if (window.addChatMessage) {
        window.addChatMessage(
            `✓ 수정된 결과가 학습되었습니다.\n- AI 선택: ${aiSelectedIds.length}개\n- 정답: ${userCorrectedIds.length}개\n- 잘못 선택: ${falsePositives.length}개\n- 누락: ${falseNegatives.length}개`,
            'system'
        );
    }

    window.closeAiFeedbackPanel();
    window.lastAiSelection = null;
};

// === 피드백 핸들러 (채팅용 - 하위 호환성) ===
window.handleAiSelectionFeedback = function(isCorrect) {
    if (!window.lastAiSelection) {
        console.error('[AI Feedback] No previous selection to provide feedback on');
        if (window.addChatMessage) {
            window.addChatMessage('이전 선택 기록이 없습니다.', 'system');
        }
        return;
    }

    const { query, aiSelectedIds, timestamp, confidence } = window.lastAiSelection;

    if (isCorrect) {
        // 사용자가 "정확함"을 선택
        console.log('[AI Feedback] User confirmed selection is correct');

        // 현재 선택된 객체 ID 가져오기
        const currentSelection = window.getSelectedObjectIds ? window.getSelectedObjectIds() : aiSelectedIds;

        // 피드백 데이터 저장
        window.aiQueryProcessor.saveFeedback({
            query,
            aiSelectedIds,
            userCorrectedIds: currentSelection, // 사용자가 수정하지 않았으므로 AI 선택과 동일
            wasCorrect: true,
            timestamp,
            confidence
        });

        if (window.addChatMessage) {
            window.addChatMessage('✓ 피드백 감사합니다! 이 결과가 학습에 반영됩니다.', 'system');
        }

    } else {
        // 사용자가 "수정 필요"를 선택
        console.log('[AI Feedback] User wants to correct selection');

        if (window.addChatMessage) {
            window.addChatMessage(
                '뷰포트에서 정확한 객체를 선택하신 후, 아래 버튼을 클릭해주세요. <button onclick="window.saveAiCorrectedSelection()" style="background: #4CAF50; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; margin-top: 8px;">현재 선택 저장</button>',
                'system'
            );
        }
    }
};

window.saveAiCorrectedSelection = function() {
    if (!window.lastAiSelection) {
        console.error('[AI Feedback] No previous selection to correct');
        return;
    }

    // 사용자가 수동으로 선택한 객체 ID 가져오기
    const userCorrectedIds = window.getSelectedObjectIds ? window.getSelectedObjectIds() : [];

    if (userCorrectedIds.length === 0) {
        if (window.addChatMessage) {
            window.addChatMessage('선택된 객체가 없습니다. 먼저 정확한 객체를 선택해주세요.', 'system');
        }
        return;
    }

    const { query, aiSelectedIds, timestamp, confidence } = window.lastAiSelection;

    // 차이 분석
    const aiSet = new Set(aiSelectedIds);
    const userSet = new Set(userCorrectedIds);

    const falsePositives = aiSelectedIds.filter(id => !userSet.has(id)); // AI가 잘못 선택
    const falseNegatives = userCorrectedIds.filter(id => !aiSet.has(id)); // AI가 누락

    console.log('[AI Feedback] Correction analysis:', {
        aiCount: aiSelectedIds.length,
        userCount: userCorrectedIds.length,
        falsePositives: falsePositives.length,
        falseNegatives: falseNegatives.length
    });

    // 피드백 데이터 저장
    window.aiQueryProcessor.saveFeedback({
        query,
        aiSelectedIds,
        userCorrectedIds,
        wasCorrect: false,
        falsePositives,
        falseNegatives,
        timestamp,
        confidence
    });

    if (window.addChatMessage) {
        window.addChatMessage(
            `✓ 수정된 결과가 저장되었습니다!\n- AI 선택: ${aiSelectedIds.length}개\n- 정답: ${userCorrectedIds.length}개\n- 잘못 선택: ${falsePositives.length}개\n- 누락: ${falseNegatives.length}개\n\n이 데이터는 AI 성능 향상에 사용됩니다.`,
            'system'
        );
    }

    // 저장 후 lastAiSelection 초기화
    window.lastAiSelection = null;
};

// 전역 함수 노출 (chat_command_handler.js에서 호출)
window.handleAiSelectCommand = handleAiSelectCommand;
