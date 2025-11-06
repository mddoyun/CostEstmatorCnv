// =====================================================================
// 공사코드(CostCode) 관리 관련 함수들
// =====================================================================

/**
 * 현재 프로젝트의 모든 공사코드를 서버에서 불러옵니다.
 */
async function loadCostCodes() {
    if (!currentProjectId) {
        renderCostCodesTable([]);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/cost-codes/${currentProjectId}/`
        );
        if (!response.ok)
            throw new Error('공사코드 목록을 불러오는데 실패했습니다.');

        window.loadedCostCodes = await response.json();
        renderCostCodesTable(window.loadedCostCodes);

        // 수량산출부재 탭의 공사코드 드롭다운도 채웁니다.
        const select = document.getElementById('qm-cost-code-assign-select');
        select.innerHTML = '<option value="">-- 공사코드 선택 --</option>'; // 초기화
        window.loadedCostCodes.forEach((code) => {
            const option = document.createElement('option');
            option.value = code.id;
            option.textContent = `${code.code} - ${code.name}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading cost codes:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 공사코드 데이터를 기반으로 테이블을 렌더링합니다.
 * @param {Array} codes - 렌더링할 공사코드 데이터 배열
 * @param {String|null} editId - 현재 편집 중인 코드의 ID ('new'일 경우 새 코드 추가)
 */
function renderCostCodesTable(codes, editId = null) {
    const container = document.getElementById('cost-codes-table-container');
    if (!codes.length && editId !== 'new') {
        container.innerHTML =
            '<p>정의된 공사코드가 없습니다. "새 공사코드 추가" 버튼으로 시작하세요.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'ruleset-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>코드</th>
                <th>이름</th>
                <th>설명</th>
                <th>내역코드</th>
                <th>공종</th>
                <th>품명</th>
                <th>규격</th>
                <th>단위</th>
                <th>비고</th>
                <!-- [ADD] 새 컬럼 2개 -->
                <th>AI개략견적</th>
                <th>상세견적</th>
                <th>작업</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    // 개별 행 렌더
    const renderRow = (code) => {
        const isEditMode =
            editId &&
            (editId === 'new' ? code.id === 'new' : code.id === editId);

        const row = document.createElement('tr');
        row.dataset.codeId = code.id;

        if (isEditMode) {
            row.classList.add('rule-edit-row');
            row.innerHTML = `
                <td><input type="text" class="cost-code-input" value="${
                    code.code || ''
                }" placeholder="C-001"></td>
                <td><input type="text" class="cost-name-input" value="${
                    code.name || ''
                }" placeholder="이름"></td>
                <td><input type="text" class="cost-description-input" value="${
                    code.description || ''
                }" placeholder="설명"></td>
                <td><input type="text" class="cost-detail-code-input" value="${
                    code.detail_code || ''
                }" placeholder="내역코드"></td>
                <td><input type="text" class="cost-category-input" value="${
                    code.category || ''
                }" placeholder="공종"></td>
                <td><input type="text" class="cost-product-name-input" value="${
                    code.product_name || ''
                }" placeholder="품명"></td>
                <td><input type="text" class="cost-spec-input" value="${
                    code.spec || ''
                }" placeholder="규격"></td>
                <td><input type="text" class="cost-unit-input" value="${
                    code.unit || ''
                }" placeholder="단위"></td>
                <td><input type="text" class="cost-note-input" value="${
                    code.note || ''
                }" placeholder="비고"></td>
                <!-- [ADD] 편집모드 체크박스 2개 -->
                <td><input type="checkbox" class="cost-ai-sd-input" ${
                    code.ai_sd_enabled ? 'checked' : ''
                }></td>
                <td><input type="checkbox" class="cost-dd-input" ${
                    code.dd_enabled ? 'checked' : ''
                }></td>
                <td>
                    <button class="save-cost-code-btn">💾 저장</button>
                    <button class="cancel-cost-code-btn">↩ 취소</button>
                </td>
            `;
        } else {
            row.innerHTML = `
                <td>${code.code}</td>
                <td>${code.name}</td>
                <td>${code.description || ''}</td>
                <td>${code.detail_code || ''}</td>
                <td>${code.category || ''}</td>
                <td>${code.product_name || ''}</td>
                <td>${code.spec || ''}</td>
                <td>${code.unit || ''}</td>
                <td>${code.note || ''}</td>
                <!-- [ADD] 보기모드 표시 2개 -->
                <td>${code.ai_sd_enabled ? '✅' : '—'}</td>
                <td>${code.dd_enabled ? '✅' : '—'}</td>
                <td>
                    <button class="edit-cost-code-btn">✏️ 수정</button>
                    <button class="delete-cost-code-btn">🗑️ 삭제</button>
                </td>
            `;
        }
        return row;
    };

    // 새 항목 편집행
    if (editId === 'new') {
        tbody.appendChild(
            renderRow({ id: 'new', ai_sd_enabled: false, dd_enabled: false })
        );
    }

    // 목록 행
    codes.forEach((code) => {
        tbody.appendChild(
            renderRow(
                code.id === editId ? codes.find((c) => c.id === editId) : code
            )
        );
    });

    container.innerHTML = '';
    container.appendChild(table);
}

/**
 * 공사코드 테이블의 액션을 처리합니다.
 */
async function handleCostCodeActions(event) {
    const target = event.target;
    const actionRow = target.closest('tr');
    if (!actionRow) return;

    const codeId = actionRow.dataset.codeId;

    // --- 수정 버튼 ---
    if (target.classList.contains('edit-cost-code-btn')) {
        if (
            document.querySelector('#cost-codes-table-container .rule-edit-row')
        ) {
            showToast('이미 편집 중인 항목이 있습니다.', 'error');
            return;
        }
        renderCostCodesTable(window.loadedCostCodes, codeId);
    }

    // --- 삭제 버튼 ---
    else if (target.classList.contains('delete-cost-code-btn')) {
        if (!confirm('이 공사코드를 정말 삭제하시겠습니까?')) return;
        try {
            const response = await fetch(
                `/connections/api/cost-codes/${currentProjectId}/${codeId}/`,
                {
                    method: 'DELETE',
                    headers: { 'X-CSRFToken': csrftoken }, // ✅ CSRF
                    credentials: 'same-origin', // (안전) 쿠키 포함
                }
            );
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            showToast(result.message, 'success');
            await loadCostCodes();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    // --- 저장 버튼 ---
    else if (target.classList.contains('save-cost-code-btn')) {
        const codeData = {
            code: actionRow.querySelector('.cost-code-input').value,
            name: actionRow.querySelector('.cost-name-input').value,
            spec: actionRow.querySelector('.cost-spec-input').value,
            unit: actionRow.querySelector('.cost-unit-input').value,
            category: actionRow.querySelector('.cost-category-input').value,
            description: actionRow.querySelector('.cost-description-input')
                .value,
            detail_code: actionRow.querySelector('.cost-detail-code-input').value,
            product_name: actionRow.querySelector('.cost-product-name-input').value,
            note: actionRow.querySelector('.cost-note-input').value,
            // ✅ 체크박스 2개 포함
            ai_sd_enabled:
                !!actionRow.querySelector('.cost-ai-sd-input')?.checked,
            dd_enabled: !!actionRow.querySelector('.cost-dd-input')?.checked,
        };

        if (!codeData.code || !codeData.name) {
            showToast('코드와 이름은 반드시 입력해야 합니다.', 'error');
            return;
        }

        const isNew = codeId === 'new';
        const url = isNew
            ? `/connections/api/cost-codes/${currentProjectId}/`
            : `/connections/api/cost-codes/${currentProjectId}/${codeId}/`;
        const method = isNew ? 'POST' : 'PUT';

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken, // ✅ CSRF
                },
                credentials: 'same-origin', // (안전) 쿠키 포함
                body: JSON.stringify(codeData),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            showToast(result.message, 'success');
            await loadCostCodes();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    // --- 취소 버튼 ---
    else if (target.classList.contains('cancel-cost-code-btn')) {
        renderCostCodesTable(window.loadedCostCodes);
    }
}

// --- 공사코드 CSV 핸들러 ---
function exportCostCodes() {
    if (!currentProjectId) {
        showToast('프로젝트를 선택하세요.', 'error');
        return;
    }
    window.location.href = `/connections/api/cost-codes/${currentProjectId}/export/`;
}
function triggerCostCodesImport() {
    if (!currentProjectId) {
        showToast('프로젝트를 선택하세요.', 'error');
        return;
    }
    currentCsvImportUrl = `/connections/api/cost-codes/${currentProjectId}/import/`;
    document.getElementById('csv-file-input')?.click();
}