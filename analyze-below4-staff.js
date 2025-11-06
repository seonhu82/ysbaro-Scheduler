const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeBelow4Staff() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  console.log('=== 미달 직원 분석 ===\n');

  const weekStart = new Date('2025-09-07T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  // 배정된 직원
  const staff = await prisma.staffAssignment.findMany({
    where: {
      scheduleId: schedule.id,
      date: { gte: weekStart, lte: weekEnd }
    },
    select: {
      staffId: true,
      staff: { select: { name: true } }
    },
    distinct: ['staffId']
  });

  console.log('W36 미달 직원 (< 4일):\n');

  const below4Staff = [];
  for (const { staffId, staff: s } of staff) {
    const workCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        staffId: staffId,
        date: { gte: weekStart, lte: weekEnd },
        shiftType: { not: 'OFF' }
      }
    });

    if (workCount < 4) {
      below4Staff.push({ id: staffId, name: s.name, workDays: workCount });
    }
  }

  for (const s of below4Staff) {
    console.log(`${s.name} (${s.workDays}일 근무):`);

    // 전체 배정
    const assignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        staffId: s.id,
        date: { gte: weekStart, lte: weekEnd }
      },
      select: {
        date: true,
        shiftType: true
      },
      orderBy: { date: 'asc' }
    });

    assignments.forEach(a => {
      const dateStr = a.date.toISOString().split('T')[0];
      const day = a.date.getDay();
      const dayName = ['일', '월', '화', '수', '목', '금', '토'][day];
      console.log(`   ${dateStr} (${dayName}): ${a.shiftType}`);
    });

    console.log();
  }

  console.log('결론:');
  console.log('- 미달 직원들이 OFF인 날짜를 확인');
  console.log('- 만약 같은 날에 여러 미달 직원이 OFF면 Phase 2가 1명만 조정 가능');
  console.log('- 나머지는 조정 불가');

  await prisma.$disconnect();
}

analyzeBelow4Staff();
