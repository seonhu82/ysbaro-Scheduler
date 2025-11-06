const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getWeekKey(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const dayOfMonth = date.getDate();
  const dayOfWeek = date.getDay();

  const sundayOfWeek = new Date(year, month, dayOfMonth - dayOfWeek);

  const firstDayOfYear = new Date(sundayOfWeek.getFullYear(), 0, 1);
  const firstSunday = new Date(firstDayOfYear);
  const firstDayOfWeek2 = firstDayOfYear.getDay();

  if (firstDayOfWeek2 !== 0) {
    firstSunday.setDate(firstDayOfYear.getDate() + (7 - firstDayOfWeek2));
  }

  const diffTime = sundayOfWeek.getTime() - firstSunday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffDays / 7) + 1;

  return `${sundayOfWeek.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

async function verifyWeekBoundaries() {
  console.log('=== 9월 주차 경계 확인 ===\n');

  const dates = [];
  for (let day = 1; day <= 30; day++) {
    const date = new Date(2025, 8, day); // 9월은 month=8
    const weekKey = getWeekKey(date);
    const dayName = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    dates.push({
      date: `2025-09-${String(day).padStart(2, '0')}`,
      day: dayName,
      weekKey: weekKey
    });
  }

  let currentWeek = null;
  dates.forEach(d => {
    if (d.weekKey !== currentWeek) {
      if (currentWeek !== null) console.log();
      console.log(`[${d.weekKey}]`);
      currentWeek = d.weekKey;
    }
    console.log(`  ${d.date} (${d.day})`);
  });

  console.log('\n=== 주차별 날짜 수 ===\n');
  const weekGroups = {};
  dates.forEach(d => {
    if (!weekGroups[d.weekKey]) {
      weekGroups[d.weekKey] = [];
    }
    weekGroups[d.weekKey].push(d.date);
  });

  for (const [weekKey, dates2] of Object.entries(weekGroups)) {
    console.log(`${weekKey}: ${dates2.length}일`);
  }

  await prisma.$disconnect();
}

verifyWeekBoundaries();
