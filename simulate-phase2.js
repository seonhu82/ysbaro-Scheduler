const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// calculateWeeklyWorkDays 로직 복사
async function calculateWeeklyWorkDays(
  staffId,
  weekKey,
  scheduleId,
  confirmedLeaves,
  dailyAssignments,
  previousScheduleId
) {
  // 주차 범위 계산
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = parseInt(yearStr);
  const weekNumber = parseInt(weekStr);

  const firstDayOfYear = new Date(year, 0, 1);
  const firstSunday = new Date(firstDayOfYear);
  const firstDayOfWeek = firstDayOfYear.getDay();

  if (firstDayOfWeek !== 0) {
    firstSunday.setDate(firstDayOfYear.getDate() + (7 - firstDayOfWeek));
  }

  const sundayOfWeek = new Date(firstSunday);
  sundayOfWeek.setDate(firstSunday.getDate() + (weekNumber - 1) * 7);

  const weekStart = new Date(sundayOfWeek);
  const weekEnd = new Date(sundayOfWeek);
  weekEnd.setDate(weekEnd.getDate() + 6);

  let workDayCount = 0;

  // 1. DB 조회
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

  // 2. 연차 (없음)
  const leavesInWeek = [];
  workDayCount += leavesInWeek.length;

  // 3. dailyAssignments
  const dbAssignmentDates = new Set(dbAssignments.map(a => a.date.toISOString().split('T')[0]));
  let dailyCount = 0;

  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split('T')[0];
    if (dailyAssignments.has(dateKey) && dailyAssignments.get(dateKey).has(staffId)) {
      if (!dbAssignmentDates.has(dateKey)) {
        dailyCount++;
        workDayCount++;
      }
    }
  }

  return { workDayCount, dbCount: dbAssignments.length, dailyCount };
}

async function simulatePhase2() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  const weekKey = '2025-W36';

  // 미달 직원 중 한 명 선택
  const staff = await prisma.staff.findFirst({
    where: { name: '미주', isActive: true }
  });

  console.log('=== Phase 2 시뮬레이션 (미주) ===\n');

  // Phase 2 시작 시점 (dailyAssignments 비어있음)
  const dailyAssignments = new Map();

  console.log('1단계: Phase 2 시작');
  const result1 = await calculateWeeklyWorkDays(
    staff.id,
    weekKey,
    schedule.id,
    [],
    dailyAssignments,
    null
  );
  console.log(`   근무일: ${result1.workDayCount}일 (DB: ${result1.dbCount}, daily: ${result1.dailyCount})`);
  console.log(`   미달: ${result1.workDayCount < 4 ? '예' : '아니오'}`);
  console.log();

  // Phase 2가 09-09 OFF → 근무로 변경
  console.log('2단계: 09-09 OFF → 근무 변경 (DB 업데이트 완료)');

  // DB에 이미 반영되었다고 가정 (실제 Phase 2 동작)
  await prisma.staffAssignment.update({
    where: {
      scheduleId_staffId_date: {
        scheduleId: schedule.id,
        staffId: staff.id,
        date: new Date('2025-09-09T00:00:00.000Z')
      }
    },
    data: {
      shiftType: 'DAY'
    }
  });

  // dailyAssignments 업데이트 (Phase 2 코드 324줄)
  dailyAssignments.set('2025-09-09', new Set([staff.id]));

  console.log('   dailyAssignments 업데이트 완료');
  console.log();

  // 다음 루프에서 재계산
  console.log('3단계: 다음 루프에서 재계산');
  const result2 = await calculateWeeklyWorkDays(
    staff.id,
    weekKey,
    schedule.id,
    [],
    dailyAssignments,
    null
  );
  console.log(`   근무일: ${result2.workDayCount}일 (DB: ${result2.dbCount}, daily: ${result2.dailyCount})`);
  console.log(`   미달: ${result2.workDayCount < 4 ? '예' : '아니오'}`);
  console.log();

  // DB 롤백
  await prisma.staffAssignment.update({
    where: {
      scheduleId_staffId_date: {
        scheduleId: schedule.id,
        staffId: staff.id,
        date: new Date('2025-09-09T00:00:00.000Z')
      }
    },
    data: {
      shiftType: 'OFF'
    }
  });

  console.log('검증:');
  console.log(`- DB 업데이트 즉시 반영: ${result2.dbCount > result1.dbCount ? '예' : '아니오'}`);
  console.log(`- dailyAssignments 중복 카운트: ${result2.dailyCount > 0 && result2.dbCount > result1.dbCount ? '예' : '아니오'}`);

  await prisma.$disconnect();
}

simulatePhase2();
