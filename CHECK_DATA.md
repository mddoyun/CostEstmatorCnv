# 데이터 구조 확인

브라우저 콘솔에서 다음 명령을 실행하여 실제 BIM 데이터 구조를 확인해주세요:

```javascript
// 1. 전체 데이터 확인
console.log('Total objects:', window.allRevitData.length);

// 2. 첫 번째 객체 구조 확인
console.log('First object:', window.allRevitData[0]);

// 3. 모든 객체의 타입 정보 확인
window.allRevitData.forEach((obj, idx) => {
    console.log(`Object ${idx}:`, {
        IfcClass: obj.IfcClass,
        Category: obj.Category,
        Name: obj.Name,
        Family: obj.Family,
        Type: obj.Type
    });
});
```

이 정보를 제공해주시면, 정확한 필터 조건으로 수정해드리겠습니다!
