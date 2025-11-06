const fs = require('fs');

const filePath = 'src/app/api/schedule/auto-assign/route.ts';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('📋 현재 파일 구조 분석 중...\n');

// 1. 주4일 보장 for 루프 시작 찾기 (1023줄)
const week4DayLoopStart = lines.findIndex((line, i) =>
  i >= 1020 && line.includes('for (const weekKey of Array.from(allWeekKeys).sort())')
);

// 2. 옛날 2차 배치 주석 찾기 (삭제 대상)
const oldPhase2CommentStart = lines.findIndex((line, i) =>
  i >= 1070 && line.includes('옛날 2차 배치 (비활성화)')
);

// 3. 새로운 2차 배치 시작 찾기 (현재 잘못된 위치)
const newPhase2Start = lines.findIndex((line, i) =>
  i >= 1070 && line.includes('2차 배치: 주별 OFF 목표값 기준 균등 배치')
);

// 4. 3차 공휴일 처리 완료 찾기
const phase3End = lines.findIndex((line, i) =>
  i >= 1300 && line.includes('3차 공휴일 처리 완료 ==========')
);

// 5. 형평성 저장 시작 찾기
const fairnessStart = lines.findIndex((line, i) =>
  i >= 1350 && line.includes('형평성 편차 저장 시작')
);

console.log(`주4일 보장 for 루프 시작: ${week4DayLoopStart + 1}줄`);
console.log(`옛날 2차 주석: ${oldPhase2CommentStart + 1}줄`);
console.log(`새로운 2차 배치 시작: ${newPhase2Start + 1}줄`);
console.log(`3차 공휴일 처리 완료: ${phase3End + 1}줄`);
console.log(`형평성 저장 시작: ${fairnessStart + 1}줄`);

// 주4일 보장 루프 종료 위치 찾기 - 옛날 2차 주석 바로 전까지
const week4DayLoopEnd = oldPhase2CommentStart - 1;

console.log(`\n주4일 보장 루프 종료 (추정): ${week4DayLoopEnd + 1}줄\n`);

// 코드 재구성
// Part 1: 주4일 보장 로직 완료까지 (옛날 2차 주석 제외)
const part1 = lines.slice(0, oldPhase2CommentStart);

// Part 2: 주4일 보장 완료 메시지 추가
const week4DayComplete = `
    console.log(\`\\n✅ 주4일 최소 보장 완료\`)
    console.log(\`========== 주4일 최소 보장 완료 ==========\\n\`)
`;

// Part 3: 새로운 2차/3차 코드 추출 (새로운 2차 시작부터 3차 완료까지)
const phase2And3Code = lines.slice(newPhase2Start, phase3End + 2); // +2 to include the closing line and newline

// Part 4: 형평성 저장부터 끝까지
const part4 = lines.slice(fairnessStart);

// 최종 조합
const newContent = [
  ...part1,
  week4DayComplete,
  ...phase2And3Code,
  ...part4
].join('\n');

// 저장
fs.writeFileSync(filePath, newContent, 'utf8');

console.log('✅ 코드 재배치 완료!\n');
console.log('변경 사항:');
console.log('1. 옛날 2차 배치 주석 제거');
console.log('2. 주4일 보장 완료 메시지 추가');
console.log('3. 새로운 2차/3차 배치를 주4일 루프 밖으로 이동');
console.log('4. 올바른 순서: 주4일 보장 → 2차 배치 → 3차 공휴일 → 형평성');
