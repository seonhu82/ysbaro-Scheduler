console.log('=== 최종 분석 결과 ===\n');

console.log('발견한 사실:');
console.log('1. W35(1주차): OFF 40개 - 정확히 맞음');
console.log('2. W36(2주차): OFF 61개 - 21개 초과 (목표 40개)');
console.log('3. W37(3주차): OFF 60개 - 20개 초과 (목표 40개)');
console.log('4. W38(4주차): OFF 61개 - 21개 초과 (목표 40개)');
console.log('5. W39(5주차): OFF 33개 - 영업일 2일이므로 목표 -40개 (이상한 계산)');
console.log();

console.log('W36(2주차) 상세 확인:');
console.log('- 영업일: 6일 (09-08 ~ 09-13, 일요일 포함)');
console.log('- 직원: 20명');
console.log('- 목표 근무: 20 × 4 = 80건');
console.log('- 목표 OFF: 20 × 2 = 40개');
console.log('- 실제 근무: 79건');
console.log('- 실제 OFF: 41개 (W36만 집계 시 61개?)');
console.log();

console.log('차이가 나는 이유:');
console.log('- W36은 09-07(일) ~ 09-13(토)');
console.log('- 하지만 09-07(일)은 휴무일');
console.log('- 실제 영업일은 09-08 ~ 09-13 (6일)');
console.log('- W36 전체로 집계하면 09-07(일) OFF도 포함됨');
console.log('- 그래서 OFF가 더 많이 집계됨');
console.log();

console.log('09-07(일) 확인 필요:');
console.log('- 09-07(일)은 원장 근무 없음');
console.log('- 모든 직원 OFF 배정됨 (20명)');
console.log('- W36 OFF 61개 = 09-07 OFF 20개 + 09-08~13 OFF 41개');
console.log('- 61 = 20 + 41 ✓');
console.log();

console.log('결론:');
console.log('- Phase 2는 주차 단위(일~토)로 계산함');
console.log('- 하지만 휴무일(일요일)도 포함되어 목표 OFF 계산이 잘못됨');
console.log('- 휴무일의 OFF는 목표에서 제외되어야 함');
console.log('- 또는 영업일만으로 주차를 나눠야 함');
