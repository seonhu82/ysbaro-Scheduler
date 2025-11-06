const fs = require('fs');

const content = fs.readFileSync('src/app/api/schedule/auto-assign/route.ts', 'utf8');
const lines = content.split('\n');

let depth = 0;
let maxDepth = 0;
let tryStartLine = 0;

for (let i = 302; i < 1306; i++) {
  const line = lines[i];

  // try 블록 시작 찾기
  if (line.includes('try {')) {
    tryStartLine = i + 1;
    console.log(`Try block starts at line ${tryStartLine}`);
  }

  // 중괄호 카운트
  for (const char of line) {
    if (char === '{') depth++;
    if (char === '}') depth--;
  }

  if (depth > maxDepth) maxDepth = depth;

  // 주요 지점에서 depth 출력
  if ([303, 500, 1000, 1200, 1227, 1277, 1300, 1305].includes(i + 1)) {
    console.log(`Line ${i + 1}: depth=${depth} | ${line.trim().substring(0, 60)}`);
  }
}

console.log(`\nFinal depth at line 1306: ${depth}`);
console.log(`Max depth reached: ${maxDepth}`);
console.log(`\nIssue: try block started at line ${tryStartLine}, but depth is ${depth} (should be 1 to close properly)`);
