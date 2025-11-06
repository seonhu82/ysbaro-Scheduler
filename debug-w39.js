const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugW39() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  const staff = await prisma.staff.findFirst({
    where: { name: '미주', isActive: true }
  });

  console.log('=== W39 버그 디버깅 ===\n');

  // W39 범위: 09-28 ~ 10-04 (일~토)
  const weekStart = new Date('2025-09-28T00:00:00.000Z');
  const weekEnd = new Date('2025-10-04T23:59:59.999Z');

  console.log('W39 주차 범위:');
  console.log(`   ${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]}`);
  console.log();

  // DB 조회
  const dbAssignments = await prisma.staffAssignment.findMany({
    where: {
      scheduleId: schedule.id,
      staffId: staff.id,
      date: {
        gte: weekStart,
        lte: weekEnd
      },
      shiftType: { not: 'OFF' }
    },
    select: {
      date: true,
      shiftType: true
    },
    orderBy: { date: 'asc' }
  });

  console.log('DB 조회 결과 (shiftType != OFF):');
  dbAssignments.forEach(a => {
    console.log(`   ${a.date.toISOString().split('T')[0]}: ${a.shiftType}`);
  });
  console.log(`   총 ${dbAssignments.length}건`);
  console.log();

  // 10월 배정 확인
  const octoberAssignments = await prisma.staffAssignment.findMany({
    where: {
      scheduleId: schedule.id,
      staffId: staff.id,
      date: {
        gte: new Date('2025-10-01T00:00:00.000Z'),
        lte: new Date('2025-10-04T23:59:59.999Z')
      }
    },
    select: {
      date: true,
      shiftType: true
    },
    orderBy: { date: 'asc' }
  });

  console.log('10월 배정 (10-01 ~ 10-04):');
  octoberAssignments.forEach(a => {
    console.log(`   ${a.date.toISOString().split('T')[0]}: ${a.shiftType}`);
  });
  console.log();

  console.log('문제 발견:');
  console.log('- W39는 09-28 ~ 10-04 (7일)');
  console.log('- 9월 스케줄은 09-30까지만 있음');
  console.log('- 하지만 calculateWeeklyWorkDays는 10-01~04도 조회함');
  console.log('- 만약 10월 스케줄이 있으면 10월 근무도 포함됨!');

  await prisma.$disconnect();
}

debugW39();
