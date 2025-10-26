const fs = require('fs');

const content = fs.readFileSync('D:/작업/프로그램 만들기/연세바로치과 스케줄러/src/lib/algorithms/weekly-assign-v2.ts', 'utf8');
const lines = content.split('\n');

let depth = 0;
let lineNum = 0;
let maxDepth = 0;
let maxDepthLine = 0;

for (const line of lines) {
  lineNum++;

  if (lineNum < 77 || lineNum > 1114) continue;

  const before = depth;
  for (const char of line) {
    if (char === '{') depth++;
    if (char === '}') depth--;
  }

  if (depth > maxDepth) {
    maxDepth = depth;
    maxDepthLine = lineNum;
  }

  // Log significant depth changes or when depth goes negative
  if (Math.abs(depth - before) >= 2 || depth < 0 || (lineNum >= 1090 && lineNum <= 1115)) {
    console.log(`Line ${lineNum}: depth ${before} -> ${depth} | ${line.trim().substring(0, 80)}`);
  }
}

console.log(`\nMax depth: ${maxDepth} at line ${maxDepthLine}`);
console.log(`Final depth: ${depth}`);
