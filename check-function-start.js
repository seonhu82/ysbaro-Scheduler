const fs = require('fs');

const content = fs.readFileSync('D:/작업/프로그램 만들기/연세바로치과 스케줄러/src/lib/algorithms/weekly-assign-v2.ts', 'utf8');
const lines = content.split('\n');

let depth = 0;
let lineNum = 0;

for (const line of lines) {
  lineNum++;

  const before = depth;
  for (const char of line) {
    if (char === '{') depth++;
    if (char === '}') depth--;
  }

  if (lineNum >= 75 && lineNum <= 90) {
    console.log(`Line ${lineNum}: depth ${before} -> ${depth} | ${line.trim()}`);
  }
}

console.log(`\nFinal depth: ${depth}`);
