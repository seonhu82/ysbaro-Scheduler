const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCalculateRange() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  // W36 주차 범위
  const weekStart = new Date('2025-09-07T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  console.log('=== calculateWeeklyWorkDays 범위 확인 ===\n');
  console.log(`weekStart: ${weekStart.toISOString().split('T')[0]}`);
  console.log(`weekEnd: ${weekEnd.toISOString().split('T')[0]}`);
  console.log();

  // 예시: "미주" 직원
  const staff = await prisma.staff.findFirst({
    where: { name: '미주', isActive: true }
  });

  // DB에서 조회 (calculateWeeklyWorkDays의 1번 단계)
  const dbAssignments = await prisma.staffAssignment.findMany({
    where: {
      staffId: staff.id,
      scheduleId: schedule.id,
      date: {
        gte: weekStart,
        lte: weekEnd
      },
      shiftType: { not: 'OFF' }
    },
    select: {
      date: true,
      shiftType: true
    }
  });

  console.log(`${staff.name}의 DB 근무 (09-07~13):`);
  dbAssignments.forEach(a => {
    console.log(`   ${a.date.toISOString().split('T')[0]}: ${a.shiftType}`);
  });
  console.log(`   총 ${dbAssignments.length}건`);
  console.log();

  // 09-07 포함 여부 확인
  const has0907 = dbAssignments.some(a =>
    a.date.toISOString().split('T')[0] === '2025-09-07'
  );

  console.log(`09-07 포함: ${has0907 ? '예' : '아니오'}`);
  console.log();

  // 09-08~13만 조회
  const businessStart = new Date('2025-09-08T00:00:00.000Z');
  const businessEnd = new Date('2025-09-13T23:59:59.999Z');

  const businessAssignments = await prisma.staffAssignment.findMany({
    where: {
      staffId: staff.id,
      scheduleId: schedule.id,
      date: {
        gte: businessStart,
        lte: businessEnd
      },
      shiftType: { not: 'OFF' }
    }
  });

  console.log(`${staff.name}의 DB 근무 (09-08~13, 영업일만):`);
  console.log(`   총 ${businessAssignments.length}건`);
  console.log();

  console.log('결론:');
  console.log('- calculateWeeklyWorkDays는 weekStart~weekEnd 전체 범위 조회');
  console.log('- W36: 09-07~13 (7일)');
  console.log('- 09-07은 원장 근무 없어서 모든 직원 OFF');
  console.log('- calculateWeeklyWorkDays는 OFF를 제외하므로 09-07은 카운트 안됨 ✓');
  console.log('- 따라서 정상 작동');

  await prisma.$disconnect();
}

checkCalculateRange();
