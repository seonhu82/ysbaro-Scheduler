const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// calculateWeeklyWorkDays 로직 복사
async function calculateWeeklyWorkDays(
  staffId,
  weekStart,
  weekEnd,
  scheduleId,
  confirmedLeaves,
  dailyAssignments,
  previousScheduleId
) {
  let workDayCount = 0;

  // 1. DB에서 조회
  const scheduleIds = [scheduleId];
  if (previousScheduleId) {
    scheduleIds.push(previousScheduleId);
  }

  const dbAssignments = await prisma.staffAssignment.findMany({
    where: {
      staffId,
      scheduleId: { in: scheduleIds },
      date: {
        gte: weekStart,
        lte: weekEnd
      },
      shiftType: { not: 'OFF' }
    },
    select: {
      date: true
    }
  });

  workDayCount += dbAssignments.length;
  console.log(`      DB 근무: ${dbAssignments.length}건`);

  // 2. 연차 확인
  const leavesInWeek = confirmedLeaves.filter(leave => {
    const leaveDate = new Date(leave.date);
    return leave.staffId === staffId &&
           leave.leaveType === 'ANNUAL' &&
           leave.status === 'CONFIRMED' &&
           leaveDate >= weekStart &&
           leaveDate <= weekEnd;
  });

  const dbAssignmentDates = new Set(dbAssignments.map(a => a.date.toISOString().split('T')[0]));
  const newLeaveDays = leavesInWeek.filter(leave => {
    const leaveDateKey = new Date(leave.date).toISOString().split('T')[0];
    return !dbAssignmentDates.has(leaveDateKey);
  });

  workDayCount += newLeaveDays.length;
  console.log(`      연차: ${newLeaveDays.length}건`);

  // 3. dailyAssignments 확인
  let dailyCount = 0;
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split('T')[0];
    if (dailyAssignments.has(dateKey) && dailyAssignments.get(dateKey).has(staffId)) {
      if (!dbAssignmentDates.has(dateKey)) {
        const isLeaveDay = leavesInWeek.some(leave =>
          new Date(leave.date).toISOString().split('T')[0] === dateKey
        );
        if (!isLeaveDay) {
          dailyCount++;
          workDayCount++;
        }
      }
    }
  }

  console.log(`      dailyAssignments: ${dailyCount}건`);
  console.log(`      총합: ${workDayCount}일`);

  return workDayCount;
}

async function testCalculateLogic() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  const weekStart = new Date('2025-09-08T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  // 실제 배정된 직원 중 한 명 선택 (예: "미주" - 3일 근무 미달)
  const staff = await prisma.staff.findFirst({
    where: { name: '미주', isActive: true }
  });

  console.log(`=== ${staff.name} 근무일 계산 테스트 ===\n`);

  // dailyAssignments는 비어있는 상태로 시작 (Phase 2 시작 시점)
  const dailyAssignments = new Map();

  console.log('1. Phase 2 시작 시점 (dailyAssignments 비어있음):');
  const days1 = await calculateWeeklyWorkDays(
    staff.id,
    weekStart,
    weekEnd,
    schedule.id,
    [],
    dailyAssignments,
    null
  );

  console.log();

  // Phase 2에서 2025-09-09에 OFF → 근무로 변경했다고 가정
  console.log('2. Phase 2가 2025-09-09 OFF → 근무로 변경 후:');

  // DB 업데이트 시뮬레이션 (실제로는 안함)
  // dailyAssignments 업데이트
  dailyAssignments.set('2025-09-09', new Set([staff.id]));

  const days2 = await calculateWeeklyWorkDays(
    staff.id,
    weekStart,
    weekEnd,
    schedule.id,
    [],
    dailyAssignments,
    null
  );

  console.log();
  console.log('=== 결론 ===');
  console.log(`Phase 2 시작: ${days1}일`);
  console.log(`변경 후: ${days2}일`);
  console.log(`차이: ${days2 - days1}일`);

  if (days2 - days1 === 0) {
    console.log('❌ dailyAssignments 업데이트가 반영 안됨!');
  } else {
    console.log('✅ dailyAssignments 업데이트 반영됨');
  }

  await prisma.$disconnect();
}

testCalculateLogic();
