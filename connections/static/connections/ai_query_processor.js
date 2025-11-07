/**
 * AI 쿼리 처리 시스템
 * - 2단계 접근: 속성 결정 → 샘플링 → 필터링
 * - 학습 가능한 우선순위 시스템
 */

class AIQueryProcessor {
    constructor() {
        // 속성 우선순위 (학습 가능 - 로컬 스토리지에 저장)
        this.attributePriorities = this.loadPriorities() || {
            // 기본 우선순위 (1-10, 높을수록 우선)
            'byClassificationTag': 9,    // QM 분류가 가장 중요
            'byCostCodeName': 8,         // 공사코드 이름
            'byActivity': 7,             // 공정
            'byIfcClass': 6,             // IFC 클래스
            'byCategory': 5,             // 카테고리
            'byMemberMark': 4,           // 일람부호
            'byFamily': 3,               // 패밀리
            'byType': 2,                 // 타입
            'byCostCode': 1,             // 공사코드 (코드)
            'byActivityCode': 1          // 공정코드
        };

        // 쿼리 히스토리 (학습용)
        this.queryHistory = this.loadQueryHistory() || [];

        // Few-shot 학습 예시 (사용자 피드백 기반)
        this.fewShotExamples = this.loadFewShotExamples() || [];

        // 학습된 룰셋 캐시
        this.learnedRules = [];

        // 샘플링 설정
        this.samplingConfig = {
            maxSampleSize: 10,           // AI에게 보낼 최대 샘플 개수
            representativeSampling: true // 대표성 있는 샘플 선택
        };

        // 프로젝트 로드 시 룰셋 로드
        this.loadLearnedRules();
    }

    /**
     * 학습된 룰셋 로드
     */
    async loadLearnedRules() {
        if (!window.currentProjectId) {
            console.warn('[AI Learning] No project ID, cannot load rules');
            return;
        }

        try {
            const response = await fetch(`/connections/api/ai-rules/${window.currentProjectId}/`);
            const result = await response.json();

            if (result.success) {
                this.learnedRules = result.rules;
                console.log('[AI Learning] Loaded learned rules:', this.learnedRules.length);
            }
        } catch (error) {
            console.error('[AI Learning] Error loading rules:', error);
        }
    }

    /**
     * 쿼리에 매칭되는 룰셋 찾기
     */
    findMatchingRule(userQuery) {
        if (!this.learnedRules || this.learnedRules.length === 0) {
            return null;
        }

        // 쿼리 키워드 추출
        const queryLower = userQuery.toLowerCase();
        const queryWords = userQuery.split(/\s+/).filter(w => w.length > 1);

        // 각 룰에 대한 점수 계산
        const ruleScores = [];

        for (const rule of this.learnedRules) {
            let score = 0;
            let matchType = '';
            let matchedKeyword = '';

            // 1. 완전한 쿼리 패턴 매칭 (최고 점수: 100 + 패턴 길이)
            const ruleQueryPattern = rule.query_pattern.toLowerCase();
            if (queryLower === ruleQueryPattern) {
                score = 100 + ruleQueryPattern.length;
                matchType = 'exact_query_match';
                matchedKeyword = rule.query_pattern;
            }
            // 2. 쿼리가 룰의 쿼리 패턴을 포함 (높은 점수: 80 + 패턴 길이)
            else if (queryLower.includes(ruleQueryPattern)) {
                score = 80 + ruleQueryPattern.length;
                matchType = 'query_pattern_contains';
                matchedKeyword = rule.query_pattern;
            }
            // 3. 룰의 쿼리 패턴이 쿼리를 포함 (중간 점수: 60 + 패턴 길이)
            else if (ruleQueryPattern.includes(queryLower)) {
                score = 60 + ruleQueryPattern.length;
                matchType = 'query_pattern_included';
                matchedKeyword = rule.query_pattern;
            }

            // 4. 키워드 패턴 매칭 (쿼리에 특정 키워드가 포함된 경우)
            let bestKeywordScore = 0;
            let bestKeyword = '';
            for (const keyword of rule.keyword_patterns) {
                const keywordLower = keyword.toLowerCase();

                // 쿼리가 키워드를 완전히 포함 (점수: 50 + 키워드 길이)
                if (queryLower.includes(keywordLower)) {
                    const keywordScore = 50 + keyword.length;
                    if (keywordScore > bestKeywordScore) {
                        bestKeywordScore = keywordScore;
                        bestKeyword = keyword;
                    }
                }
            }

            if (bestKeywordScore > score) {
                score = bestKeywordScore;
                matchType = 'keyword_match';
                matchedKeyword = bestKeyword;
            }

            // 5. 쿼리 단어와 키워드 패턴 부분 매칭 (낮은 점수: 20 + 단어 길이)
            let bestWordScore = 0;
            let bestWord = '';
            for (const word of queryWords) {
                for (const keyword of rule.keyword_patterns) {
                    const keywordLower = keyword.toLowerCase();
                    if (keywordLower.includes(word.toLowerCase())) {
                        const wordScore = 20 + word.length;
                        if (wordScore > bestWordScore) {
                            bestWordScore = wordScore;
                            bestWord = `${word} ↔ ${keyword}`;
                        }
                    } else if (word.toLowerCase().includes(keywordLower)) {
                        const wordScore = 15 + keywordLower.length;
                        if (wordScore > bestWordScore) {
                            bestWordScore = wordScore;
                            bestWord = `${word} ↔ ${keyword}`;
                        }
                    }
                }
            }

            if (bestWordScore > score) {
                score = bestWordScore;
                matchType = 'word_fuzzy_match';
                matchedKeyword = bestWord;
            }

            // 점수가 0보다 크면 후보에 추가
            if (score > 0) {
                ruleScores.push({
                    rule: rule,
                    score: score,
                    matchType: matchType,
                    matchedKeyword: matchedKeyword,
                    confidence: rule.confidence
                });
            }
        }

        // 점수가 있는 룰이 없으면 null 반환
        if (ruleScores.length === 0) {
            return null;
        }

        // 점수 순으로 정렬 (점수 높은 순, 동점이면 신뢰도 높은 순)
        ruleScores.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return b.confidence - a.confidence;
        });

        // 디버깅: 모든 매칭된 룰과 점수 출력
        console.log('[AI Learning] Rule matching scores:');
        ruleScores.forEach((rs, idx) => {
            console.log(`  ${idx + 1}. ${rs.rule.name}: score=${rs.score} (${rs.matchType}, "${rs.matchedKeyword}"), confidence=${rs.confidence}`);
        });

        // 최고 점수 룰 반환
        const bestMatch = ruleScores[0];
        console.log(`[AI Learning] ✓ Selected rule: ${bestMatch.rule.name} (score=${bestMatch.score}, confidence=${bestMatch.confidence})`);
        return bestMatch.rule;
    }

    /**
     * 룰셋 기반으로 객체 선택
     */
    selectByLearnedRule(rule) {
        console.log('[AI Learning] Applying learned rule:', rule.name);
        const results = [];

        // 전체 객체 검색
        const allObjects = window.allRevitData || [];

        for (const obj of allObjects) {
            let matched = false;
            const raw_data = obj.raw_data || {};

            // Category 패턴 매칭
            if (rule.category_patterns && rule.category_patterns.length > 0) {
                const category = raw_data.Category;
                if (category && rule.category_patterns.includes(category)) {
                    matched = true;
                }
            }

            // Family 패턴 매칭
            if (!matched && rule.family_patterns && rule.family_patterns.length > 0) {
                const family = raw_data.Family;
                if (family && rule.family_patterns.includes(family)) {
                    matched = true;
                }
            }

            // Type 패턴 매칭
            if (!matched && rule.type_patterns && rule.type_patterns.length > 0) {
                const type = raw_data.Type;
                if (type && rule.type_patterns.includes(type)) {
                    matched = true;
                }
            }

            // Keyword 패턴 매칭 (전체 raw_data 검색)
            if (!matched && rule.keyword_patterns && rule.keyword_patterns.length > 0) {
                const dataStr = JSON.stringify(raw_data).toLowerCase();
                for (const keyword of rule.keyword_patterns) {
                    if (dataStr.includes(keyword.toLowerCase())) {
                        matched = true;
                        break;
                    }
                }
            }

            // Parameter 패턴 매칭
            if (!matched && rule.parameter_patterns && Object.keys(rule.parameter_patterns).length > 0) {
                const params = raw_data.Parameters || {};
                for (const [paramName, paramValues] of Object.entries(rule.parameter_patterns)) {
                    if (params[paramName] && paramValues.includes(params[paramName])) {
                        matched = true;
                        break;
                    }
                }
            }

            if (matched) {
                results.push({
                    id: obj.id,
                    name: raw_data.Name || '(unnamed)',
                    category: raw_data.Category,
                    family: raw_data.Family,
                    type: raw_data.Type,
                    source: 'learned_rule',
                    rule_name: rule.name
                });
            }
        }

        console.log(`[AI Learning] Rule "${rule.name}" matched ${results.length} objects`);
        return results;
    }

    /**
     * 임베딩 기반 의미론적 유사도 검색
     *
     * @param {string} userQuery - 사용자 쿼리
     * @param {number} topK - 상위 K개 반환 (기본 20)
     * @param {number} threshold - 최소 유사도 임계값 (기본 0.5)
     * @returns {Array<string>} 선택된 객체 ID 배열
     */
    async searchByEmbedding(userQuery, topK = 20, threshold = 0.5) {
        console.log('[AI Embedding] Searching by semantic similarity...');

        try {
            if (!window.currentProjectId) {
                console.warn('[AI Embedding] No project ID');
                return [];
            }

            const response = await fetch(`/connections/api/ai-embeddings/search/${window.currentProjectId}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: userQuery,
                    top_k: topK,
                    threshold: threshold
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log(`[AI Embedding] Found ${result.results.length} objects (checked ${result.total_checked})`);

                // 유사도 순으로 이미 정렬되어 있음
                result.results.forEach((item, idx) => {
                    console.log(`[AI Embedding]   ${idx + 1}. ${item.element_id} (similarity: ${item.similarity.toFixed(3)})`);
                    if (item.text) {
                        console.log(`[AI Embedding]      ${item.text.substring(0, 80)}...`);
                    }
                });

                return result.results.map(r => r.element_id);
            } else {
                console.warn('[AI Embedding] Search failed:', result.error);
                return [];
            }
        } catch (error) {
            console.error('[AI Embedding] Error during search:', error);
            return [];
        }
    }

    /**
     * Step 1: AI가 쿼리를 분석하여 필요한 속성 결정
     */
    async determineRelevantAttributes(userQuery) {
        console.log('[AI Query] Step 1: Determining relevant attributes...');

        const prompt = `
다음 사용자 질문을 분석하여, 어떤 BIM 객체 속성들을 확인해야 하는지 결정하세요.

사용자 질문: "${userQuery}"

사용 가능한 속성 인덱스:
- byIfcClass: IFC 클래스 (예: IfcWall, IfcSlab, IfcColumn)
- byCategory: Revit 카테고리 (예: Walls, Floors, Structural Columns)
- byFamily: Revit 패밀리
- byType: Revit 타입
- byClassificationTag: 물량 분류 태그 (예: "건축_골조_벽_RC", "조적공사_블록쌓기", "건축_마감_천장_석고보드")
- byMemberMark: 일람부호
- byCostCode: 공사코드 (코드)
- byCostCodeName: 공사코드 (이름, 예: "조적공사", "콘크리트공사", "미장공사")
- byActivity: 공정 이름 (예: "조적공사", "골조공사")
- byActivityCode: 공정 코드
- byKeyword: 전체 키워드 검색 (가장 포괄적 - 모든 속성 값에서 검색)

**중요**:
- **대부분의 경우 byKeyword를 primary로 사용하세요** - 부분 일치를 지원하여 가장 유연합니다
- byKeyword는 classification_tag, cost_code_name, activity_name, properties 등 모든 텍스트 값을 검색합니다
- 사용자가 "콘크리트패널"이라고 하면 "노출콘크리트패널", "콘크리트패널마감" 등을 모두 찾습니다
- byClassificationTag나 byIfcClass는 정확한 이름을 알 때만 사용하세요
- keywords 배열에는 사용자가 입력한 키워드를 그대로 사용하세요 (예: "콘크리트패널" → ["콘크리트패널"])

다음 JSON 형식으로 반환하세요:
{
    "primary_attributes": [
        {
            "index": "인덱스 이름",
            "keywords": ["검색할 키워드1", "키워드2"],
            "reason": "이 속성을 선택한 이유"
        }
    ],
    "secondary_attributes": [
        {
            "index": "인덱스 이름",
            "keywords": ["검색할 키워드1"],
            "reason": "보조 확인용"
        }
    ],
    "intent": "select",
    "analysis": "쿼리 분석 결과"
}

**중요**: intent는 반드시 다음 중 **하나만** 선택하세요:
- "select": 객체를 선택하는 작업 (예: "~를 선택해줘", "~를 찾아줘")
- "answer": 질문에 답변하는 작업 (예: "얼마나 있어?", "무엇인가요?")
- "section": 섹션 박스를 생성하는 작업 (예: "섹션 만들어줘")

대부분의 쿼리는 "select"입니다.

**중요**: 대부분의 쿼리는 byKeyword를 primary로 사용해야 합니다!

예시 1:
질문: "벽을 선택해줘"
→ {
    "primary_attributes": [
        { "index": "byKeyword", "keywords": ["벽"], "reason": "키워드 검색으로 부분 일치" }
    ],
    "secondary_attributes": [],
    "intent": "select"
}

예시 2:
질문: "콘크리트패널 선택해줘"
→ {
    "primary_attributes": [
        { "index": "byKeyword", "keywords": ["콘크리트패널"], "reason": "콘크리트패널 포함 객체 모두 검색" }
    ],
    "secondary_attributes": [],
    "intent": "select"
}

예시 3:
질문: "도배지 선택해줘"
→ {
    "primary_attributes": [
        { "index": "byKeyword", "keywords": ["도배"], "reason": "도배 관련 객체 검색 (classification_tag, cost_code_name 등)" }
    ],
    "secondary_attributes": [],
    "intent": "select"
}

예시 4:
질문: "마감을 선택해줘"
→ {
    "primary_attributes": [
        { "index": "byKeyword", "keywords": ["마감"], "reason": "마감 포함 객체 검색" }
    ],
    "secondary_attributes": [],
    "intent": "select"
}

예시 5:
질문: "concrete panel을 선택해줘"
→ {
    "primary_attributes": [
        { "index": "byKeyword", "keywords": ["concrete", "panel", "콘크리트", "패널"], "reason": "영어/한글 키워드로 검색" }
    ],
    "secondary_attributes": [],
    "intent": "select"
}

잘못된 예시:
질문: "도배지 선택해줘"
→ {
    "primary_attributes": [
        { "index": "byClassificationTag", "keywords": ["도배"], "reason": "..." }  ← ❌ WRONG!
    ],
    ...
}
byClassificationTag는 정확한 태그 이름을 알 때만 사용하세요. 대부분은 byKeyword를 사용하세요!
${this.getFewShotPromptSection()}
반드시 순수 JSON만 반환하세요. 다른 설명은 제외하세요.
`;

        const response = await this.callOllama(prompt);

        console.log('[AI Query] Raw Ollama response (first 500 chars):', response.substring(0, 500));

        try {
            // JSON 추출 (마크다운 코드 블록 제거)
            let jsonText = response.trim();
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            }

            // JSON이 불완전할 수 있으므로 닫는 괄호 확인
            const openBraces = (jsonText.match(/{/g) || []).length;
            const closeBraces = (jsonText.match(/}/g) || []).length;
            if (openBraces > closeBraces) {
                console.warn('[AI Query] JSON incomplete, adding missing closing braces');
                jsonText += '}'.repeat(openBraces - closeBraces);
            }

            console.log('[AI Query] Extracted JSON (first 300 chars):', jsonText.substring(0, 300));

            const result = JSON.parse(jsonText);
            console.log('[AI Query] Determined attributes:', result);

            // Validate result - check if primary_attributes is empty
            if (!result.primary_attributes || result.primary_attributes.length === 0) {
                console.error('[AI Query] ❌ AI returned empty primary_attributes! Using fallback...');
                const queryKeyword = userQuery.replace(/선택해줘|해줘|보여줘|찾아줘|\./g, '').trim();
                console.log('[AI Query] Fallback keyword extracted:', queryKeyword);
                return {
                    primary_attributes: [
                        { index: 'byKeyword', keywords: [queryKeyword], reason: 'Fallback: extracted from user query' }
                    ],
                    secondary_attributes: [],
                    intent: 'select',
                    analysis: 'Fallback - AI returned empty attributes'
                };
            }

            return result;
        } catch (e) {
            console.error('[AI Query] Failed to parse attribute determination:', response);
            console.error('[AI Query] Parse error:', e);

            // 폴백: 키워드 검색 (쿼리에서 주요 키워드만 추출)
            const keywords = userQuery.replace(/선택해줘|해줘|보여줘|찾아줘/g, '').trim().split(/\s+/);
            return {
                primary_attributes: [
                    { index: 'byKeyword', keywords: keywords, reason: 'Fallback to keyword search' },
                    { index: 'byClassificationTag', keywords: keywords, reason: 'Also search classification tags' }
                ],
                secondary_attributes: [],
                intent: 'select',
                analysis: 'Failed to parse AI response, using keyword fallback'
            };
        }
    }

    /**
     * Step 2: 인덱스로 후보 객체 찾기
     */
    async findCandidateObjects(attributeSpec) {
        console.log('[AI Query] Step 2: Finding candidate objects...');

        const candidates = new Set();

        // Primary attributes로 먼저 검색
        for (const attr of attributeSpec.primary_attributes) {
            for (const keyword of attr.keywords) {
                let ids = [];

                if (attr.index === 'byKeyword') {
                    ids = window.aiIndexBuilder.searchByKeyword(keyword);
                } else {
                    ids = window.aiIndexBuilder.search(attr.index, keyword);
                }

                console.log(`[AI Query]   ${attr.index}["${keyword}"] → ${ids.length} objects`);
                ids.forEach(id => candidates.add(id));
            }
        }

        // Secondary attributes로 보완
        for (const attr of attributeSpec.secondary_attributes || []) {
            for (const keyword of attr.keywords) {
                const ids = window.aiIndexBuilder.search(attr.index, keyword);
                console.log(`[AI Query]   (secondary) ${attr.index}["${keyword}"] → ${ids.length} objects`);
                ids.forEach(id => candidates.add(id));
            }
        }

        const candidateIds = Array.from(candidates);
        console.log(`[AI Query] Total candidates: ${candidateIds.length}`);

        return candidateIds;
    }

    /**
     * Step 3: 대표 샘플 선택 (너무 많으면 샘플링)
     */
    selectRepresentativeSamples(candidateIds) {
        console.log('[AI Query] Step 3: Selecting representative samples...');

        if (candidateIds.length <= this.samplingConfig.maxSampleSize) {
            console.log(`[AI Query] Candidate count (${candidateIds.length}) within limit, using all`);
            return candidateIds;
        }

        // 대표성 있는 샘플 선택
        if (this.samplingConfig.representativeSampling) {
            // 전략: 다양한 분류 태그를 가진 객체들을 골고루 선택
            const tagGroups = new Map(); // classification_tag -> [ids]

            candidateIds.forEach(id => {
                const elem = window.allRevitData?.find(e => e.id === id);
                if (!elem) return;

                const qms = window.loadedQuantityMembers?.filter(qm => qm.raw_element_id === id) || [];
                qms.forEach(qm => {
                    const tag = qm.classification_tag || 'unclassified';
                    if (!tagGroups.has(tag)) {
                        tagGroups.set(tag, []);
                    }
                    tagGroups.get(tag).push(id);
                });
            });

            // 각 그룹에서 골고루 샘플링
            const samples = [];
            const groupArray = Array.from(tagGroups.entries());
            const samplesPerGroup = Math.ceil(this.samplingConfig.maxSampleSize / groupArray.length);

            groupArray.forEach(([tag, ids]) => {
                const groupSamples = ids.slice(0, samplesPerGroup);
                samples.push(...groupSamples);
            });

            const finalSamples = samples.slice(0, this.samplingConfig.maxSampleSize);
            console.log(`[AI Query] Selected ${finalSamples.length} representative samples from ${tagGroups.size} groups`);

            return finalSamples;
        } else {
            // 단순 랜덤 샘플링
            const shuffled = candidateIds.sort(() => 0.5 - Math.random());
            return shuffled.slice(0, this.samplingConfig.maxSampleSize);
        }
    }

    /**
     * Step 4: AI가 샘플을 분석하여 최종 선택
     */
    async analyzeSamplesAndDecide(userQuery, sampleIds, allCandidateIds) {
        console.log('[AI Query] Step 4: AI analyzing samples...');

        // 샘플 데이터 수집 (전체 상속 체인)
        const sampleData = sampleIds.map(id => this.collectObjectData(id));

        const prompt = `
사용자 질문: "${userQuery}"

**당신의 임무**: 사용자가 찾고자 하는 키워드를 기반으로 필터 규칙을 만드세요.

다음은 후보 객체 중 대표 샘플입니다 (전체 ${allCandidateIds.length}개 중 ${sampleIds.length}개):

${sampleData.map((data, idx) => `
=== 샘플 #${idx + 1} ===
ID: ${data.id}
${this.formatObjectData(data)}
`).join('\n')}

**필수 규칙**:
1. 사용자 질문에서 핵심 키워드를 추출하세요
   - "마감 선택해줘" → "마감"
   - "콘크리트패널 선택해줘" → "콘크리트패널"
   - "벽을 선택해줘" → "벽"

2. **filter_rules의 value는 반드시 사용자가 입력한 키워드를 사용하세요**
   - ✅ CORRECT: value = "콘크리트패널" (사용자가 입력한 키워드)
   - ❌ WRONG: value = "건축_마감_내부_기타" (샘플에서 본 전체 문자열)
   - ❌ WRONG: value = "노출콘크리트패널 마감" (샘플에서 본 긴 문자열)

3. contains 연산자는 부분 일치를 검색합니다
   - "콘크리트패널"로 검색하면 → "노출콘크리트패널", "콘크리트패널마감" 모두 찾음
   - "마감"으로 검색하면 → "건축_마감_XXX" 모두 찾음

4. **샘플은 참고용입니다. value는 사용자 질문의 키워드만 사용하세요**

다음 JSON 형식으로 반환하세요:
{
    "filter_rules": [
        {
            "attribute_path": "QM.0.classification_tag_name",
            "operator": "contains",
            "value": "사용자가 찾는 키워드",
            "reason": "이 규칙이 필요한 이유"
        }
    ],
    "expected_match_count": ${allCandidateIds.length},
    "confidence": 0.8,
    "analysis": "샘플 분석 결과"
}

**중요**:
- attribute_path는 "QM.0.classification_tag_name" 형식으로 작성 (QM은 배열이므로 첫 번째 요소 [0]을 지정)
- value는 **사용자 질문에서 사용한 키워드**를 그대로 사용
- expected_match_count는 숫자로 반환 (문자열 아님)
- confidence는 숫자로 반환 (0.0 ~ 1.0)

예시 1:
질문: "마감 선택해줘"
샘플의 classification_tag_name: "건축_마감_내부_기타"
→ {
    "filter_rules": [
        {
            "attribute_path": "QM.0.classification_tag_name",
            "operator": "contains",
            "value": "마감",
            "reason": "사용자가 '마감' 키워드로 검색"
        }
    ],
    "expected_match_count": 13,
    "confidence": 0.9,
    "analysis": "사용자 키워드 '마감'으로 검색"
}

예시 2:
질문: "콘크리트패널 선택해줘"
샘플의 classification_tag_name: "건축_마감_외부_기타"
→ {
    "filter_rules": [
        {
            "attribute_path": "QM.0.classification_tag_name",
            "operator": "contains",
            "value": "콘크리트패널",
            "reason": "사용자가 '콘크리트패널' 키워드로 검색"
        }
    ],
    "expected_match_count": 4,
    "confidence": 0.9,
    "analysis": "사용자 키워드 '콘크리트패널'로 검색"
}

예시 3 (잘못된 예시 - 이렇게 하지 마세요):
질문: "콘크리트패널 선택해줘"
샘플의 classification_tag_name: "건축_마감_내부_기타"
→ {
    "filter_rules": [
        {
            "attribute_path": "QM.0.classification_tag_name",
            "operator": "contains",
            "value": "건축_마감_내부_기타",  ← ❌ WRONG! 샘플의 문자열을 그대로 사용
            "reason": "..."
        }
    ],
    ...
}
이것은 잘못되었습니다! value는 반드시 사용자 질문의 키워드("콘크리트패널")를 사용해야 합니다.

반드시 순수 JSON만 반환하세요. 추가 설명은 하지 마세요.
`;

        const response = await this.callOllama(prompt);

        try {
            let jsonText = response.trim();

            // Extract JSON from code blocks
            if (jsonText.includes('```json')) {
                const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)```/);
                if (jsonMatch) {
                    jsonText = jsonMatch[1].trim();
                }
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            }

            // If there's text after closing brace, remove it
            const firstBraceIndex = jsonText.indexOf('{');
            const lastBraceIndex = jsonText.lastIndexOf('}');
            if (firstBraceIndex !== -1 && lastBraceIndex !== -1) {
                jsonText = jsonText.substring(firstBraceIndex, lastBraceIndex + 1);
            }

            const result = JSON.parse(jsonText);
            console.log('[AI Query] Filter rules:', result);

            return result;
        } catch (e) {
            console.error('[AI Query] Failed to parse filter rules:', response);
            console.error('[AI Query] Parse error:', e);

            // 폴백: 모든 후보 반환
            return {
                filter_rules: [],
                expected_match_count: allCandidateIds.length,
                confidence: 0.5,
                analysis: 'Failed to parse, returning all candidates'
            };
        }
    }

    /**
     * Step 5: 필터 규칙 적용하여 최종 선택
     */
    applyFilterRules(candidateIds, filterRules) {
        console.log('[AI Query] Step 5: Applying filter rules...');

        const results = [];
        let debugCount = 0; // Only log first 3 objects for debugging

        for (const id of candidateIds) {
            const data = this.collectObjectData(id);
            let matches = true;
            const matchReasons = [];

            // ▼▼▼ Debug logging for first 3 objects ▼▼▼
            const shouldDebug = debugCount < 3;
            if (shouldDebug) {
                console.log(`[AI Query] ===== Checking candidate ${debugCount + 1} (ID: ${id}) =====`);
                console.log(`[AI Query]   Data structure:`, {
                    'QM (array length)': data.QM?.length,
                    'QM[0] keys': data.QM?.[0] ? Object.keys(data.QM[0]) : 'N/A',
                    'QM[0].classification_tag_name': data.QM?.[0]?.classification_tag_name
                });
            }

            for (const rule of filterRules) {
                const value = this.getValueByPath(data, rule.attribute_path);
                const ruleMatch = this.evaluateRule(value, rule.operator, rule.value);

                if (shouldDebug) {
                    console.log(`[AI Query]   Rule: ${rule.attribute_path} ${rule.operator} "${rule.value}"`);
                    console.log(`[AI Query]   Extracted value:`, value);
                    console.log(`[AI Query]   Match result: ${ruleMatch}`);
                }

                if (!ruleMatch) {
                    matches = false;
                    if (shouldDebug) {
                        console.log(`[AI Query]   ❌ Rule failed - object rejected`);
                    }
                    break;
                }

                matchReasons.push(`${rule.attribute_path} ${rule.operator} "${rule.value}"`);
            }

            if (matches) {
                if (shouldDebug) {
                    console.log(`[AI Query]   ✅ All rules passed - object accepted`);
                }
                results.push({
                    id: id,
                    reasons: matchReasons
                });
            }

            if (shouldDebug) {
                debugCount++;
            }
        }

        console.log(`[AI Query] Matched ${results.length} / ${candidateIds.length} candidates`);
        return results;
    }

    /**
     * 규칙 평가
     */
    evaluateRule(value, operator, target) {
        if (value == null) return false;

        const valueStr = String(value).toLowerCase();
        const targetStr = String(target).toLowerCase();

        switch (operator) {
            case 'equals':
                return valueStr === targetStr;
            case 'contains':
                return valueStr.includes(targetStr);
            case 'startsWith':
                return valueStr.startsWith(targetStr);
            case 'endsWith':
                return valueStr.endsWith(targetStr);
            case 'not_contains':
                return !valueStr.includes(targetStr);
            default:
                return false;
        }
    }

    /**
     * 경로로 값 가져오기 (예: "QM.classification_tag")
     */
    getValueByPath(data, path) {
        const parts = path.split('.');
        let current = data;

        for (const part of parts) {
            if (current == null) return null;

            // 배열이면 인덱스로 접근하거나 첫 번째 요소 사용
            if (Array.isArray(current)) {
                // 숫자면 배열 인덱스
                const index = parseInt(part);
                if (!isNaN(index)) {
                    current = current[index];
                    continue;
                } else {
                    // 숫자가 아니면 첫 번째 요소의 속성에 접근
                    if (current.length === 0) return null;
                    current = current[0];
                }
            }

            current = current[part];
        }

        return current;
    }

    /**
     * 객체 데이터 수집 (전체 상속 체인)
     */
    collectObjectData(rawElementId) {
        const elem = window.allRevitData?.find(e => e.id === rawElementId);
        if (!elem) return { id: rawElementId };

        const data = {
            id: rawElementId,
            BIM: elem.raw_data || {},
            QM: [],
            MM: [],
            CI: [],
            CC: [],
            AO: [],
            AC: []
        };

        // QM
        const qms = window.loadedQuantityMembers?.filter(qm => qm.raw_element_id === rawElementId) || [];
        data.QM = qms;

        // MM
        qms.forEach(qm => {
            if (qm.member_mark_id) {
                const mm = window.loadedMemberMarks?.find(m => m.id === qm.member_mark_id);
                if (mm) data.MM.push(mm);
            }
        });

        // CI
        qms.forEach(qm => {
            const cis = window.loadedCostItems?.filter(ci => ci.quantity_member_id === qm.id) || [];
            data.CI.push(...cis);
        });

        // CC
        data.CI.forEach(ci => {
            if (ci.cost_codes && Array.isArray(ci.cost_codes)) {
                ci.cost_codes.forEach(ccId => {
                    const cc = window.loadedCostCodes?.find(c => c.id === ccId);
                    if (cc) data.CC.push(cc);
                });
            }
        });

        // AO
        data.CI.forEach(ci => {
            const aos = window.loadedActivityObjects?.filter(ao => ao.cost_item_id === ci.id) || [];
            data.AO.push(...aos);
        });

        // AC
        data.AO.forEach(ao => {
            if (ao.activity_id) {
                const ac = window.loadedActivities?.find(a => a.id === ao.activity_id);
                if (ac) data.AC.push(ac);
            }
        });

        return data;
    }

    /**
     * 객체 데이터 포맷팅 (AI에게 전달용)
     */
    formatObjectData(data) {
        const lines = [];

        // BIM
        if (data.BIM) {
            lines.push('BIM 속성:');
            lines.push(`  - IfcClass: ${data.BIM['Attributes.IfcClass'] || 'N/A'}`);
            lines.push(`  - Category: ${data.BIM.Category || 'N/A'}`);
            lines.push(`  - Family: ${data.BIM.Family || 'N/A'}`);
            lines.push(`  - Type: ${data.BIM.Type || 'N/A'}`);
        }

        // QM
        if (data.QM && data.QM.length > 0) {
            lines.push('QM 분류:');
            data.QM.forEach(qm => {
                lines.push(`  - classification_tag_name: ${qm.classification_tag_name || 'N/A'}`);
                lines.push(`  - quantity: ${qm.quantity || 'N/A'}`);
            });
        }

        // MM
        if (data.MM && data.MM.length > 0) {
            lines.push('일람부호:');
            data.MM.forEach(mm => {
                lines.push(`  - ${mm.name || 'N/A'}`);
            });
        }

        // CC
        if (data.CC && data.CC.length > 0) {
            lines.push('공사코드:');
            data.CC.forEach(cc => {
                lines.push(`  - ${cc.code}: ${cc.name || 'N/A'}`);
            });
        }

        // AC
        if (data.AC && data.AC.length > 0) {
            lines.push('공정:');
            data.AC.forEach(ac => {
                lines.push(`  - ${ac.code}: ${ac.name || 'N/A'}`);
            });
        }

        return lines.join('\n');
    }

    /**
     * Ollama 호출 (타임아웃 + 리트라이)
     */
    async callOllama(prompt, timeout = 30000, retries = 2) {
        const ollamaUrl = 'http://localhost:11434/api/generate';
        const modelName = 'llama3.2:3b';

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                console.log(`[AI Query] Ollama call attempt ${attempt + 1}/${retries + 1}...`);

                // 타임아웃 설정
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(ollamaUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: modelName,
                        prompt: prompt,
                        stream: false
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Ollama API error: ${response.status}`);
                }

                const data = await response.json();
                console.log(`[AI Query] Ollama call succeeded on attempt ${attempt + 1}`);
                return data.response;

            } catch (error) {
                clearTimeout(timeoutId);

                if (error.name === 'AbortError') {
                    console.error(`[AI Query] Ollama call timed out after ${timeout}ms (attempt ${attempt + 1})`);
                } else {
                    console.error(`[AI Query] Ollama call failed (attempt ${attempt + 1}):`, error);
                }

                // 마지막 시도였다면 에러 throw
                if (attempt === retries) {
                    throw new Error(`Ollama 호출 실패 (${retries + 1}번 시도): ${error.message}`);
                }

                // 재시도 전 대기 (1초 * 시도 횟수)
                console.log(`[AI Query] Retrying in ${(attempt + 1)}s...`);
                await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
            }
        }
    }

    /**
     * 우선순위 저장/로드 (로컬 스토리지)
     */
    savePriorities() {
        localStorage.setItem('ai_attribute_priorities', JSON.stringify(this.attributePriorities));
    }

    loadPriorities() {
        const stored = localStorage.getItem('ai_attribute_priorities');
        return stored ? JSON.parse(stored) : null;
    }

    /**
     * 쿼리 히스토리 저장/로드
     */
    saveQueryHistory() {
        // 최근 100개만 저장
        const recent = this.queryHistory.slice(-100);
        localStorage.setItem('ai_query_history', JSON.stringify(recent));
    }

    loadQueryHistory() {
        const stored = localStorage.getItem('ai_query_history');
        return stored ? JSON.parse(stored) : null;
    }

    /**
     * 쿼리 실행 후 히스토리에 추가
     */
    recordQuery(query, resultCount, confidence) {
        this.queryHistory.push({
            query: query,
            timestamp: Date.now(),
            resultCount: resultCount,
            confidence: confidence
        });
        this.saveQueryHistory();
    }

    /**
     * 사용자 피드백 저장 (DB에 저장)
     */
    async saveFeedback(feedbackData) {
        console.log('[AI Feedback] Saving to DB...', feedbackData);

        try {
            // DB에 저장 (connections/ 접두사 추가)
            const response = await fetch('/connections/api/ai-feedback/save/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    project_id: window.currentProjectId,
                    query: feedbackData.query,
                    aiSelectedIds: feedbackData.aiSelectedIds,
                    userCorrectedIds: feedbackData.userCorrectedIds,
                    wasCorrect: feedbackData.wasCorrect,
                    falsePositives: feedbackData.falsePositives || [],
                    falseNegatives: feedbackData.falseNegatives || [],
                    confidence: feedbackData.confidence
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log('[AI Feedback] Saved to DB successfully:', result.feedback_id);

                // 자동으로 룰셋 생성/업데이트
                if (!feedbackData.wasCorrect && feedbackData.userCorrectedIds.length > 0) {
                    console.log('[AI Feedback] User provided corrections, generating/updating rule...');
                    await this.generateRuleFromFeedback(result.feedback_id);
                }

                // Few-shot 예시 업데이트 (DB에서 로드)
                await this.updateFewShotExamplesFromDB();

                // 룰셋 다시 로드
                await this.loadLearnedRules();
            } else {
                console.error('[AI Feedback] Failed to save:', result.error);
            }

        } catch (error) {
            console.error('[AI Feedback] Error saving to DB:', error);
            // DB 저장 실패 시 로컬 스토리지에 백업
            this.saveFeedbackLocal(feedbackData);
        }
    }

    /**
     * 피드백으로부터 룰셋 자동 생성/업데이트
     */
    async generateRuleFromFeedback(feedbackId) {
        try {
            const response = await fetch(`/connections/api/ai-rules/generate/${feedbackId}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();

            if (result.success) {
                console.log(`[AI Learning] ${result.created ? 'Created' : 'Updated'} rule: ${result.rule_name}`);
                console.log(`  - Confidence: ${result.confidence}`);
                console.log(`  - Patterns:`, result.patterns);
                showToast(`학습 완료: ${result.rule_name} (신뢰도: ${(result.confidence * 100).toFixed(0)}%)`, 'success');
            } else {
                console.error('[AI Learning] Failed to generate rule:', result.error);
            }
        } catch (error) {
            console.error('[AI Learning] Error generating rule:', error);
        }
    }

    /**
     * 로컬 스토리지 백업 저장
     */
    saveFeedbackLocal(feedbackData) {
        const feedbacks = this.loadFeedbacks() || [];

        feedbacks.push({
            ...feedbackData,
            savedAt: Date.now()
        });

        // 최근 50개만 저장
        const recent = feedbacks.slice(-50);
        localStorage.setItem('ai_selection_feedbacks', JSON.stringify(recent));

        console.log('[AI Feedback] Saved to localStorage (backup)');
    }

    /**
     * 저장된 피드백 로드
     */
    loadFeedbacks() {
        const stored = localStorage.getItem('ai_selection_feedbacks');
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Few-shot 학습 예시 업데이트 (DB에서 로드)
     */
    async updateFewShotExamplesFromDB() {
        if (!window.currentProjectId) {
            console.warn('[AI Learning] No project ID, cannot load few-shot examples');
            return;
        }

        try {
            const response = await fetch(`/connections/api/ai-feedback/few-shot/${window.currentProjectId}/`);
            const result = await response.json();

            if (result.success) {
                this.fewShotExamples = result.examples;
                console.log('[AI Learning] Updated few-shot examples from DB:', this.fewShotExamples);

                // 로컬 스토리지에도 캐싱
                localStorage.setItem('ai_few_shot_examples', JSON.stringify(this.fewShotExamples));
            }
        } catch (error) {
            console.error('[AI Learning] Error loading few-shot examples from DB:', error);
        }
    }

    /**
     * Few-shot 학습 예시 업데이트 (로컬 스토리지 - 백업용)
     */
    updateFewShotExamples() {
        const feedbacks = this.loadFeedbacks();

        // 정확했던 피드백만 필터링 (wasCorrect === true)
        const correctFeedbacks = feedbacks.filter(f => f.wasCorrect);

        // 최신 5개만 사용 (few-shot)
        const recentCorrect = correctFeedbacks.slice(-5);

        // 예시 생성: 각 피드백을 "질문 → 정답" 형태로 저장
        this.fewShotExamples = recentCorrect.map(f => ({
            query: f.query,
            correctIds: f.userCorrectedIds,
            count: f.userCorrectedIds.length
        }));

        // 로컬 스토리지에 저장
        localStorage.setItem('ai_few_shot_examples', JSON.stringify(this.fewShotExamples));

        console.log('[AI Learning] Updated few-shot examples (local):', this.fewShotExamples);
    }

    /**
     * Few-shot 예시 로드
     */
    loadFewShotExamples() {
        const stored = localStorage.getItem('ai_few_shot_examples');
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Few-shot 예시를 프롬프트에 추가
     * (determineRelevantAttributes 함수에서 사용)
     */
    getFewShotPromptSection() {
        const examples = this.loadFewShotExamples();

        if (examples.length === 0) {
            return '';
        }

        let section = '\n\n**학습된 성공 사례 (참고용)**:\n';
        examples.forEach((ex, idx) => {
            section += `\n사례 ${idx + 1}:\n`;
            section += `- 질문: "${ex.query}"\n`;
            section += `- 정답 객체 수: ${ex.count}개\n`;
            section += `- 이 질문에는 byKeyword를 사용하는 것이 효과적이었습니다.\n`;
        });
        section += '\n위 사례들을 참고하여, 비슷한 패턴의 질문에는 byKeyword를 우선적으로 사용하세요.\n';

        return section;
    }

    /**
     * 속성 우선순위 업데이트 (학습)
     * 성공적인 쿼리의 경우 사용된 속성의 우선순위를 증가
     */
    updatePriorities(usedAttributes, success) {
        if (success) {
            usedAttributes.forEach(attr => {
                if (this.attributePriorities[attr.index]) {
                    this.attributePriorities[attr.index] = Math.min(
                        10,
                        this.attributePriorities[attr.index] + 0.1
                    );
                }
            });
        } else {
            usedAttributes.forEach(attr => {
                if (this.attributePriorities[attr.index]) {
                    this.attributePriorities[attr.index] = Math.max(
                        1,
                        this.attributePriorities[attr.index] - 0.1
                    );
                }
            });
        }

        this.savePriorities();
        console.log('[AI Query] Updated priorities:', this.attributePriorities);
    }
}

// 전역 인스턴스
window.aiQueryProcessor = new AIQueryProcessor();
