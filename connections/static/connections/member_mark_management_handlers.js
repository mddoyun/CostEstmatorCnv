// =====================================================================
// 일람부호(MemberMark) 관리 관련 함수들
// =====================================================================

/**
 * 현재 프로젝트의 모든 일람부호를 서버에서 불러옵니다.
 */
async function loadMemberMarks() {
    if (!currentProjectId) {
        renderMemberMarksTable([]);
        return;
    }
    try {
        const response = await fetch(
            `/connections/api/member-marks/${currentProjectId}/`
        );
        if (!response.ok)
            throw new Error('일람부호 목록을 불러오는데 실패했습니다.');

        window.loadedMemberMarks = await response.json();
        renderMemberMarksTable(window.loadedMemberMarks);

        // 수량산출부재 탭의 일람부호 드롭다운도 채웁니다.
        const select = document.getElementById('qm-member-mark-assign-select');
        select.innerHTML = '<option value="">-- 일람부호 선택 --</option>'; // 초기화
        window.loadedMemberMarks.forEach((mark) => {
            const option = document.createElement('option');
            option.value = mark.id;
            option.textContent = mark.mark;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading member marks:', error);
        showToast(error.message, 'error');
    }
}

/**
 * 일람부호 데이터를 기반으로 테이블을 렌더링합니다.
 */
function renderMemberMarksTable(marks, editId = null) {
    const container = document.getElementById('member-marks-table-container');
    if (!marks.length && editId !== 'new') {
        container.innerHTML =
            '<p>정의된 일람부호가 없습니다. "새 일람부호 추가" 버튼으로 시작하세요.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'ruleset-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>일람부호</th>
                <th>설명</th>
                <th>속성 (JSON)</th>
                <th>작업</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    const renderRow = (mark) => {
        const isEditMode =
            editId &&
            (editId === 'new' ? mark.id === 'new' : mark.id === editId);
        const row = document.createElement('tr');
        row.dataset.markId = mark.id;

        if (isEditMode) {
            row.classList.add('rule-edit-row');
            row.innerHTML = `
                <td><input type="text" class="mark-mark-input" value="${
                    mark.mark || ''
                }" placeholder="C1"></td>
                <td><input type="text" class="mark-description-input" value="${
                    mark.description || ''
                }"></td>
                <td><textarea class="mark-properties-input" rows="3" placeholder='{"철근": "HD13", "간격": 200}'>${JSON.stringify(
                    mark.properties || {},
                    null,
                    2
                )}</textarea></td>
                <td>
                    <button class="save-member-mark-btn">💾 저장</button>
                    <button class="cancel-member-mark-btn">❌ 취소</button>
                </td>
            `;
        } else {
            row.innerHTML = `
                <td>${mark.mark}</td>
                <td>${mark.description}</td>
                <td><pre>${JSON.stringify(mark.properties, null, 2)}</pre></td>
                <td>
                    <button class="edit-member-mark-btn">✏️ 수정</button>
                    <button class="delete-member-mark-btn">🗑️ 삭제</button>
                </td>
            `;
        }
        return row;
    };
    if (editId === 'new') tbody.appendChild(renderRow({ id: 'new' }));
    marks.forEach((mark) => {
        tbody.appendChild(
            renderRow(
                mark.id === editId ? marks.find((c) => c.id === editId) : mark
            )
        );
    });

    container.innerHTML = '';
    container.appendChild(table);
}

/**
 * 일람부호 테이블의 액션을 처리합니다.
 */
async function handleMemberMarkActions(event) {
    const target = event.target;
    const actionRow = target.closest('tr');
    if (!actionRow) return;

    const markId = actionRow.dataset.markId;

    if (target.classList.contains('edit-member-mark-btn')) {
        if (
            document.querySelector(
                '#member-marks-table-container .rule-edit-row'
            )
        ) {
            showToast('이미 편집 중인 항목이 있습니다.', 'error');
            return;
        }
        renderMemberMarksTable(window.loadedMemberMarks, markId);
    } else if (target.classList.contains('delete-member-mark-btn')) {
        if (!confirm('이 일람부호를 정말 삭제하시겠습니까?')) return;
        try {
            const response = await fetch(
                `/connections/api/member-marks/${currentProjectId}/${markId}/`,
                {
                    method: 'DELETE',
                    headers: { 'X-CSRFToken': csrftoken },
                }
            );
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            showToast(result.message, 'success');
            await loadMemberMarks();
        } catch (error) {
            showToast(error.message, 'error');
        }
    } else if (target.classList.contains('save-member-mark-btn')) {
        let properties;
        try {
            properties = JSON.parse(
                actionRow.querySelector('.mark-properties-input').value || '{}'
            );
            if (typeof properties !== 'object' || Array.isArray(properties))
                throw new Error();
        } catch (e) {
            showToast('속성이 유효한 JSON 객체 형식이 아닙니다.', 'error');
            return;
        }
        const markData = {
            mark: actionRow.querySelector('.mark-mark-input').value,
            description: actionRow.querySelector('.mark-description-input')
                .value,
            properties: properties,
        };
        if (!markData.mark) {
            showToast('일람부호는 반드시 입력해야 합니다.', 'error');
            return;
        }

        const isNew = markId === 'new';
        const url = isNew
            ? `/connections/api/member-marks/${currentProjectId}/`
            : `/connections/api/member-marks/${currentProjectId}/${markId}/`;
        const method = isNew ? 'POST' : 'PUT';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify(markData),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            showToast(result.message, 'success');
            await loadMemberMarks();
        } catch (error) {
            showToast(error.message, 'error');
        }
    } else if (target.classList.contains('cancel-member-mark-btn')) {
        renderMemberMarksTable(window.loadedMemberMarks);
    }
}

// --- 일람부호 CSV 핸들러 ---
function exportMemberMarks() {
    console.log('[DEBUG] Triggering Member Marks CSV export.');
    if (!currentProjectId) {
        showToast('프로젝트를 선택하세요.', 'error');
        return;
    }
    window.location.href = `/connections/api/member-marks/${currentProjectId}/export/`;
}
function triggerMemberMarksImport() {
    console.log('[DEBUG] Triggering Member Marks CSV import.');
    if (!currentProjectId) {
        showToast('프로젝트를 선택하세요.', 'error');
        return;
    }
    currentCsvImportUrl = `/connections/api/member-marks/${currentProjectId}/import/`;
    document.getElementById('csv-file-input')?.click();
}