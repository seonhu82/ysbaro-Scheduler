const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWeekBoundaryBug() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  console.log('=== 주차 경계 버그 확인 ===\n');

  // 미주의 전체 배정 확인
  const staff = await prisma.staff.findFirst({
    where: { name: '미주', isActive: true }
  });

  const allAssignments = await prisma.staffAssignment.findMany({
    where: {
      scheduleId: schedule.id,
      staffId: staff.id,
      date: {
        gte: new Date('2025-09-01T00:00:00.000Z'),
        lte: new Date('2025-09-30T23:59:59.999Z')
      }
    },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      shiftType: true
    }
  });

  console.log(`${staff.name}의 9월 전체 배정:\n`);

  // 주차별로 그룹화
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

  const byWeek = {};
  allAssignments.forEach(a => {
    const weekKey = getWeekKey(a.date);
    if (!byWeek[weekKey]) byWeek[weekKey] = [];
    byWeek[weekKey].push(a);
  });

  for (const [weekKey, assignments] of Object.entries(byWeek)) {
    console.log(`[${weekKey}]`);
    let workCount = 0;
    let offCount = 0;

    assignments.forEach(a => {
      const dateStr = a.date.toISOString().split('T')[0];
      const dayName = ['일', '월', '화', '수', '목', '금', '토'][a.date.getDay()];
      console.log(`   ${dateStr} (${dayName}): ${a.shiftType}`);
      if (a.shiftType === 'OFF') offCount++;
      else workCount++;
    });

    console.log(`   → 근무 ${workCount}일, OFF ${offCount}일`);

    // calculateWeeklyWorkDays 시뮬레이션
    const weekStart = new Date(assignments[0].date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const dbWork = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        staffId: staff.id,
        date: {
          gte: weekStart,
          lte: weekEnd
        },
        shiftType: { not: 'OFF' }
      }
    });

    console.log(`   → calculateWeeklyWorkDays: ${dbWork}일`);

    if (dbWork !== workCount) {
      console.log(`   ⚠️ 불일치! 실제 ${workCount}일 vs 계산 ${dbWork}일`);
    }

    console.log();
  }

  await prisma.$disconnect();
}

checkWeekBoundaryBug();
