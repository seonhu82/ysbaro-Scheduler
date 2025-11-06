console.log('=== 분석 ===\n');

console.log('현재 상태:');
console.log('- 총 근무: 79건');
console.log('- 총 OFF: 41건');
console.log('- 목표 근무: 80건');
console.log('- 목표 OFF: 40건');
console.log();

console.log('차이:');
console.log('- 근무 1건 부족');
console.log('- OFF 1건 초과');
console.log();

console.log('직원 분포:');
console.log('- 3일 근무 (미달): 9명');
console.log('- 4일 근무 (정확): 3명');
console.log('- 5일 근무 (초과): 8명');
console.log();

console.log('Phase 2 목표:');
console.log('- OFF 1개를 근무로 바꾸기 (미달 직원에게)');
console.log();

console.log('Phase 2가 할 수 있는 것:');
console.log('- 3일 근무 중 한 명의 OFF를 근무로 변경');
console.log('- 그럼 그 직원은 4일 근무가 됨');
console.log();

console.log('문제:');
console.log('- 3일 근무 직원 9명 모두 OFF를 3개씩 가지고 있음');
console.log('- 그런데 Phase 2가 끝났을 때:');
console.log('  * 3일 근무 9명 → 모두 배정 시도');
console.log('  * 하지만 여전히 총 근무 79건, OFF 41건');
console.log();

console.log('로그에서:');
console.log('- "미달 직원 0명인데 OFF 1개 초과"');
console.log('- 이는 Phase 2가 9명을 모두 4일로 만들었는데도');
console.log('- 여전히 OFF가 1개 남았다는 의미');
console.log();

console.log('가능한 원인:');
console.log('1. Phase 2가 실제로는 8명만 배정하고 1명을 놓침');
console.log('2. Phase 2가 9명을 배정했지만 동시에 5일 근무자 1명을 OFF로 변경');
console.log('3. calculateWeeklyWorkDays 함수의 카운팅 오류');
console.log();

console.log('검증 필요:');
console.log('- Phase 2 로그에서 실제로 몇 명을 OFF→근무로 변경했는지');
console.log('- 그리고 몇 명을 근무→OFF로 변경했는지');
