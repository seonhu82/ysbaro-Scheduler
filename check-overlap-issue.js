const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOverlapIssue() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  // W35: 09-01~06
  // W36: 09-07~13 (2주차 로그)
  // W37: 09-14~20
  // W38: 09-21~27
  // W39: 09-28~30

  const weeks = [
    { key: '2025-W35', start: new Date('2025-09-01T00:00:00Z'), end: new Date('2025-09-06T23:59:59Z') },
    { key: '2025-W36', start: new Date('2025-09-07T00:00:00Z'), end: new Date('2025-09-13T23:59:59Z') },
    { key: '2025-W37', start: new Date('2025-09-14T00:00:00Z'), end: new Date('2025-09-20T23:59:59Z') },
    { key: '2025-W38', start: new Date('2025-09-21T00:00:00Z'), end: new Date('2025-09-27T23:59:59Z') },
    { key: '2025-W39', start: new Date('2025-09-28T00:00:00Z'), end: new Date('2025-09-30T23:59:59Z') }
  ];

  console.log('=== 주차별 직원 배정 현황 ===\n');

  for (const week of weeks) {
    const assignments = await prisma.staffAssignment.groupBy({
      by: ['staffId'],
      where: {
        scheduleId: schedule.id,
        date: { gte: week.start, lte: week.end }
      },
      _count: true
    });

    const assignedStaffCount = assignments.length;

    console.log(`${week.key}: 배정된 직원 ${assignedStaffCount}명`);

    // 영업일 수 확인
    const doctorDates = await prisma.scheduleDoctor.findMany({
      where: {
        scheduleId: schedule.id,
        date: { gte: week.start, lte: week.end }
      },
      select: { date: true },
      distinct: ['date']
    });

    const businessDays = doctorDates.length;
    console.log(`   영업일: ${businessDays}일`);
    console.log(`   목표 OFF: ${assignedStaffCount} × (${businessDays} - 4) = ${assignedStaffCount * (businessDays - 4)}개`);

    // 실제 OFF
    const actualOff = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        date: { gte: week.start, lte: week.end },
        shiftType: 'OFF'
      }
    });

    console.log(`   실제 OFF: ${actualOff}개`);
    console.log(`   차이: ${actualOff - (assignedStaffCount * (businessDays - 4))}개`);
    console.log();
  }

  await prisma.$disconnect();
}

checkOverlapIssue();
