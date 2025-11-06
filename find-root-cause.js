console.log('=== 근본 원인 찾기 ===\n');

console.log('사실:');
console.log('1. Phase 2에서 총 68건의 OFF→근무 변경');
console.log('2. 최종 상태: 근무 79건, OFF 41건');
console.log('3. 목표: 근무 80건, OFF 40건');
console.log('4. 결과: 근무 1건 부족, OFF 1건 초과');
console.log();

console.log('Phase 2는 4개 주차를 처리:');
console.log('- 1주차: 13건 조정');
console.log('- 2주차: 13건 조정 (로그에서 마지막 1개 실패)');
console.log('- 3주차: 16건 조정');
console.log('- 4주차: 13건 조정 (로그에서 마지막 1개 실패)');
console.log('- 5주차: 13건 조정 (로그에서 마지막 1개 실패)');
console.log('- 합계: 약 65-68건');
console.log();

console.log('로그에서 확인:');
console.log('- 여러 주차에서 "미달 직원 0명인데 OFF 1개 초과"');
console.log('- 총 3번 실패 (2주차, 4주차, 5주차)');
console.log();

console.log('가능성 1: Phase 2가 같은 직원을 여러 번 변경');
console.log('- 예: "소정 OFF → 근무 (3일→4일)"이 여러 번 나옴');
console.log('- "다애 OFF → 근무"가 5번 나옴');
console.log('- "정아 OFF → 근무"가 4번 나옴');
console.log();

console.log('이게 문제의 원인:');
console.log('- Phase 2가 여러 주차를 처리하면서');
console.log('- 같은 직원을 여러 주차에서 변경');
console.log('- 하지만 DB 조회는 전체 기간 기준');
console.log('- dailyAssignments는 누적됨');
console.log('- 결과: 중복 카운트 또는 잘못된 카운트');
console.log();

console.log('검증 필요:');
console.log('- Phase 2가 주차별로 독립적으로 계산하는지');
console.log('- 아니면 전체 기간을 한 번에 계산하는지');
