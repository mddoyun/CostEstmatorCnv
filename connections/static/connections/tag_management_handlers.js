// =====================================================================
// 태그(Tag) 관리 관련 함수들
// =====================================================================

function createNewTag() {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }
    const newTagNameInput = document.getElementById('new-tag-name');
    const newTagName = newTagNameInput.value.trim();
    if (!newTagName) {
        showToast('분류 이름을 입력하세요.', 'error');
        return;
    }
    frontendSocket.send(
        JSON.stringify({
            type: 'create_tag',
            payload: { project_id: currentProjectId, name: newTagName },
        })
    );
    newTagNameInput.value = '';
}

function handleTagListActions(event) {
    const target = event.target;
    const tagId = target.dataset.id;
    if (!tagId) return;
    if (target.classList.contains('delete-tag-btn')) {
        if (confirm('이 분류를 삭제하시겠습니까?')) {
            frontendSocket.send(
                JSON.stringify({
                    type: 'delete_tag',
                    payload: { project_id: currentProjectId, tag_id: tagId },
                })
            );
        }
    } else if (target.classList.contains('rename-tag-btn')) {
        const currentName = target.dataset.name;
        const newName = prompt('새 분류 이름을 입력하세요:', currentName);
        if (newName && newName.trim() !== '' && newName !== currentName) {
            frontendSocket.send(
                JSON.stringify({
                    type: 'update_tag',
                    payload: {
                        project_id: currentProjectId,
                        tag_id: tagId,
                        new_name: newName.trim(),
                    },
                })
            );
        }
    }
}

function importTags(event) {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }
    const file = event.target.files[0];
    if (file) {
        const formData = new FormData();
        formData.append('tag_file', file);
        fetch(`/connections/import-tags/${currentProjectId}/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': csrftoken },
            body: formData,
        })
            .then((res) => res.json())
            .then((data) => {
                showToast(
                    data.status === 'success'
                        ? '태그 파일을 성공적으로 가져왔습니다.'
                        : '파일 업로드에 실패했습니다.',
                    data.status === 'success' ? 'success' : 'error'
                );
                event.target.value = '';
            });
    }
}

function exportTags() {
    if (!currentProjectId) {
        showToast('먼저 프로젝트를 선택하세요.', 'error');
        return;
    }
    window.location.href = `/connections/export-tags/${currentProjectId}/`;
}