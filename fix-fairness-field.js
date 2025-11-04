const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/lib/services/fairness-calculator-v2.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 수정 1: calculateTotalDimension 함수 (248-256줄)
const oldCode1 = `  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { name: true, fairnessScoreNight: true, fairnessScoreWeekend: true, fairnessScoreHoliday: true, fairnessScoreHolidayAdjacent: true }
  })

  // 총 근무일은 모든 차원의 평균 편차를 사용
  const previousDeviation = staff ? (
    (staff.fairnessScoreNight + staff.fairnessScoreWeekend + staff.fairnessScoreHoliday + staff.fairnessScoreHolidayAdjacent) / 4
  ) : 0`;

const newCode1 = `  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { name: true, fairnessScoreTotalDays: true }
  })

  // 총 근무일 전월 편차
  const previousDeviation = staff?.fairnessScoreTotalDays || 0`;

content = content.replace(oldCode1, newCode1);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ fairness-calculator-v2.ts 파일 수정 완료!');
console.log('   - fairnessScoreTotalDays 필드를 사용하도록 변경');
