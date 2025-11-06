const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findRealIssue() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  console.log('=== 실제 문제 찾기 ===\n');

  // 로그: 미달 직원 0명, 목표 1개 더 조정 필요
  // 이것은 어느 주차에서 발생했는가?

  const weeks = [
    { key: 'W36', start: '2025-09-07', end: '2025-09-13' },
    { key: 'W37', start: '2025-09-14', end: '2025-09-20' },
    { key: 'W39', start: '2025-09-28', end: '2025-10-04' }
  ];

  for (const week of weeks) {
    console.log(`\n${week.key} (${week.start} ~ ${week.end}):`);

    const weekStart = new Date(week.start + 'T00:00:00.000Z');
    const weekEnd = new Date(week.end + 'T23:59:59.999Z');

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

    // 각 직원의 근무일 수
    let below4 = 0;
    let equal4 = 0;
    let above4 = 0;

    for (const { staffId } of staff) {
      const workCount = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id,
          staffId: staffId,
          date: { gte: weekStart, lte: weekEnd },
          shiftType: { not: 'OFF' }
        }
      });

      if (workCount < 4) below4++;
      else if (workCount === 4) equal4++;
      else above4++;
    }

    console.log(`   배정 직원: ${staff.length}명`);
    console.log(`   < 4일: ${below4}명`);
    console.log(`   = 4일: ${equal4}명`);
    console.log(`   > 4일: ${above4}명`);

    // 영업일 (원장 스케줄 있는 날)
    const businessDays = [];
    let currentDate = new Date(weekStart);
    while (currentDate <= weekEnd) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const hasDoctor = await prisma.scheduleDoctor.findFirst({
        where: {
          scheduleId: schedule.id,
          date: new Date(dateKey + 'T00:00:00.000Z')
        }
      });
      if (hasDoctor) businessDays.push(dateKey);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 실제 OFF (영업일만)
    let actualOff = 0;
    for (const dateKey of businessDays) {
      const offCount = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id,
          date: new Date(dateKey + 'T00:00:00.000Z'),
          shiftType: 'OFF'
        }
      });
      actualOff += offCount;
    }

    const targetOff = staff.length * (businessDays.length - 4);
    const diff = actualOff - targetOff;

    console.log(`   영업일: ${businessDays.length}일`);
    console.log(`   목표 OFF: ${targetOff}개 (${staff.length} × ${businessDays.length - 4})`);
    console.log(`   실제 OFF: ${actualOff}개`);
    console.log(`   차이: ${diff}개 ${diff > 0 ? '초과' : diff < 0 ? '부족' : '정확'}`);

    if (below4 === 0 && diff > 0) {
      console.log(`   ⚠️  문제 발견: 미달 직원 0명인데 OFF ${diff}개 초과`);
    }
  }

  await prisma.$disconnect();
}

findRealIssue();
