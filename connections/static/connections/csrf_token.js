
// /Users/mddoyun/Developments/CostEstimatorCnv/connections/static/connections/csrf_token.js

// CSRF 토큰 헬퍼
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2)
        return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

// var를 사용하여 전역 스코프에서 확실히 접근 가능하도록 함
var csrftoken =
    document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
    getCookie('csrftoken');

// CSRF 토큰을 반환하는 함수
function getCSRFToken() {
    if (!csrftoken) {
        csrftoken =
            document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
            getCookie('csrftoken');
    }
    return csrftoken;
}

// window 객체에도 명시적으로 연결
window.csrftoken = csrftoken;
window.getCSRFToken = getCSRFToken;
