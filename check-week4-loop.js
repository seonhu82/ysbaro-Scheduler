const fs = require('fs');

const lines = fs.readFileSync('src/app/api/schedule/auto-assign/route.ts', 'utf8').split('\n');

// 1023줄: 주4일 for 루프 시작
console.log('주4일 for 루프 추적:\n');

let depth = 0;
let loopStartLine = 1022; // 0-based index

for (let i = loopStartLine; i < 1078; i++) {
  const line = lines[i];
  const oldDepth = depth;

  for (const char of line) {
    if (char === '{') depth++;
    if (char === '}') depth--;
  }

  // for 루프 시작과 끝 찾기
  if (i === 1022 || depth !== oldDepth) {
    console.log(`Line ${i+1}: depth=${oldDepth}->${depth} | ${line.trim().substring(0, 70)}`);
  }

  // depth가 0으로 돌아오면 루프가 끝난 것
  if (i > 1022 && depth === 0) {
    console.log(`\n✅ 주4일 for 루프 종료: ${i+1}줄`);
    break;
  }
}

console.log(`\n현재 상태:`);
console.log(`- 1023줄: 주4일 for 루프 시작`);
console.log(`- 1020줄: autoAssignStaff 선언 (주4일 루프 밖)`);
console.log(`- 1075-1076줄: 주4일 완료 메시지 (루프 안에 잘못 배치됨)`);
console.log(`- 1090줄: autoAssignStaff 재선언 (중복)`);
