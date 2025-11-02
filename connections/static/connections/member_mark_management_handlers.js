// =====================================================================
// 일람부호(MemberMark) 관리 관련 함수들
// =====================================================================

/**
 * 현재 프로젝트의 모든 일람부호를 서버에서 불러옵니다.
 */
async function loadMemberMarks() {
    console.log(`[DEBUG][loadMemberMarks] Called. currentProjectId: ${currentProjectId}`);
    if (!currentProjectId) {
        console.warn('[WARN][loadMemberMarks] No project selected. Clearing table.');
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
 * 일람부호 속성 편집 UI를 생성합니다.
 * @param {object} properties - 속성 객체
 * @returns {string} HTML 문자열
 */
function renderMemberMarkPropertiesBuilder(properties) {
    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';

    // 기존 속성들을 표시 (항상 테이블 구조 생성)
    html += '<table class="properties-table-container" style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">';
    html += '<thead><tr style="background: #f5f5f5;"><th style="padding: 6px; text-align: left; border: 1px solid #ddd;">속성명</th><th style="padding: 6px; text-align: left; border: 1px solid #ddd;">값</th><th style="padding: 6px; width: 60px; border: 1px solid #ddd;">작업</th></tr></thead>';
    html += '<tbody class="member-mark-properties-list">';

    const entries = Object.entries(properties || {});
    if (entries.length > 0) {
        entries.forEach(([key, value]) => {
            html += `
                <tr class="property-row" data-property-key="${key}">
                    <td style="padding: 6px; border: 1px solid #ddd;">
                        <input type="text" class="property-key-input" value="${key}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px;">
                    </td>
                    <td style="padding: 6px; border: 1px solid #ddd;">
                        <input type="text" class="property-value-input" value="${value}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px;">
                    </td>
                    <td style="padding: 6px; text-align: center; border: 1px solid #ddd;">
                        <button class="delete-property-row-btn" type="button" style="padding: 4px 8px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">삭제</button>
                    </td>
                </tr>
            `;
        });
    } else {
        html += '<tr class="empty-properties-row"><td colspan="3" style="padding: 10px; text-align: center; color: #999; font-style: italic; border: 1px solid #ddd;">속성이 없습니다.</td></tr>';
    }

    html += '</tbody></table>';

    // 새 속성 추가 폼
    html += '<div style="padding: 10px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">';
    html += '<div style="display: flex; gap: 8px; align-items: center;">';
    html += '<input type="text" class="new-property-key-input" placeholder="속성명 (예: 철근)" style="flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">';
    html += '<input type="text" class="new-property-value-input" placeholder="값 (예: HD13)" style="flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">';
    html += '<button class="add-property-row-btn" type="button" style="padding: 6px 12px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; white-space: nowrap;">+ 추가</button>';
    html += '</div>';
    html += '</div>';

    html += '</div>';
    return html;
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

            // 속성 빌더 HTML 생성
            const propertiesHtml = renderMemberMarkPropertiesBuilder(mark.properties || {});

            row.innerHTML = `
                <td><input type="text" class="mark-mark-input" value="${
                    mark.mark || ''
                }" placeholder="C1"></td>
                <td><input type="text" class="mark-description-input" value="${
                    mark.description || ''
                }"></td>
                <td>
                    <div class="member-mark-properties-builder">
                        ${propertiesHtml}
                    </div>
                </td>
                <td>
                    <button class="save-member-mark-btn">💾 저장</button>
                    <button class="cancel-member-mark-btn">❌ 취소</button>
                </td>
            `;
        } else {
            // 속성을 사용자 친화적으로 표시
            let propertiesDisplay = '';
            if (mark.properties && Object.keys(mark.properties).length > 0) {
                const propertyItems = Object.entries(mark.properties).map(([key, value]) => {
                    return `<div style="padding: 4px 8px; margin: 2px 0; background: #f0f0f0; border-radius: 3px; display: inline-block; margin-right: 6px;">
                        <strong>${key}:</strong> ${value}
                    </div>`;
                }).join('');
                propertiesDisplay = `<div style="display: flex; flex-wrap: wrap; gap: 4px;">${propertyItems}</div>`;
            } else {
                propertiesDisplay = '<span style="color: #999; font-style: italic;">속성 없음</span>';
            }

            row.innerHTML = `
                <td>${mark.mark}</td>
                <td>${mark.description}</td>
                <td>${propertiesDisplay}</td>
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

    // 속성 빌더 이벤트 리스너 설정 (이벤트 위임)
    container.addEventListener('click', (e) => {
        // 속성 추가 버튼
        if (e.target.classList.contains('add-property-row-btn')) {
            const builder = e.target.closest('.member-mark-properties-builder');
            const keyInput = builder.querySelector('.new-property-key-input');
            const valueInput = builder.querySelector('.new-property-value-input');
            const key = keyInput.value.trim();
            const value = valueInput.value.trim();

            if (!key) {
                showToast('속성명을 입력하세요.', 'warning');
                return;
            }
            if (!value) {
                showToast('값을 입력하세요.', 'warning');
                return;
            }

            // 새 속성 행 추가
            const tbody = builder.querySelector('.member-mark-properties-list');
            if (!tbody) {
                console.error('[ERROR] Could not find .member-mark-properties-list tbody');
                showToast('UI 오류: tbody를 찾을 수 없습니다.', 'error');
                return;
            }

            // 빈 속성 행이 있으면 제거 (첫 속성 추가 시)
            const emptyRow = tbody.querySelector('.empty-properties-row');
            if (emptyRow) {
                emptyRow.remove();
            }

            // 새 속성 행 생성
            const newRow = document.createElement('tr');
            newRow.className = 'property-row';
            newRow.dataset.propertyKey = key;
            newRow.innerHTML = `
                <td style="padding: 6px; border: 1px solid #ddd;">
                    <input type="text" class="property-key-input" value="${key}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px;">
                </td>
                <td style="padding: 6px; border: 1px solid #ddd;">
                    <input type="text" class="property-value-input" value="${value}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px;">
                </td>
                <td style="padding: 6px; text-align: center; border: 1px solid #ddd;">
                    <button class="delete-property-row-btn" type="button" style="padding: 4px 8px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">삭제</button>
                </td>
            `;
            tbody.appendChild(newRow);

            // 입력 필드 초기화
            keyInput.value = '';
            valueInput.value = '';
            keyInput.focus();
        }

        // 속성 삭제 버튼
        if (e.target.classList.contains('delete-property-row-btn')) {
            const row = e.target.closest('.property-row');
            const tbody = row.closest('tbody');
            row.remove();

            // 모든 속성 행이 삭제되면 빈 행 다시 추가
            const remainingRows = tbody.querySelectorAll('.property-row');
            if (remainingRows.length === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.className = 'empty-properties-row';
                emptyRow.innerHTML = '<td colspan="3" style="padding: 10px; text-align: center; color: #999; font-style: italic; border: 1px solid #ddd;">속성이 없습니다.</td>';
                tbody.appendChild(emptyRow);
            }
        }
    });
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
        if (!currentProjectId) {
            showToast('프로젝트를 먼저 선택해주세요.', 'warning');
            return;
        }
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
        if (!currentProjectId) {
            showToast('프로젝트를 먼저 선택해주세요.', 'warning');
            return;
        }
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
        // currentProjectId 확인
        if (!currentProjectId) {
            console.error('[ERROR] currentProjectId is not set when trying to save member mark');
            showToast('프로젝트가 선택되지 않았습니다. 프로젝트를 선택해주세요.', 'error');
            return;
        }

        // 속성 빌더에서 속성 데이터 수집
        const properties = {};
        const propertyRows = actionRow.querySelectorAll('.property-row');
        propertyRows.forEach(row => {
            const key = row.querySelector('.property-key-input').value.trim();
            const value = row.querySelector('.property-value-input').value.trim();
            if (key && value) {
                properties[key] = value;
            }
        });

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

        console.log(`[DEBUG] Saving member mark with URL: ${url}, method: ${method}`);
        console.log('[DEBUG] Mark data:', markData);

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