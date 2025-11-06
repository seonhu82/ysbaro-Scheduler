const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function tracePhase2Loop() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  const weekStart = new Date('2025-09-07T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

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

  console.log('=== Phase 2 루프 추적 ===\n');
  console.log('W36 주차에서 Phase 2가 OFF 초과를 해결하려 함\n');

  // 현재 미달 직원 목록
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
      below4Staff.push({ id: staffId, name: s.name, days: workCount });
    }
  }

  console.log(`현재 미달 직원: ${below4Staff.length}명`);
  below4Staff.forEach(s => console.log(`   ${s.name}: ${s.days}일`));
  console.log();

  // 각 날짜의 OFF 수
  const dates = ['2025-09-08', '2025-09-09', '2025-09-10', '2025-09-11', '2025-09-12', '2025-09-13'];
  console.log('날짜별 OFF 현황:');

  for (const dateStr of dates) {
    const dateObj = new Date(dateStr + 'T00:00:00.000Z');

    const offStaff = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        date: dateObj,
        shiftType: 'OFF'
      },
      select: {
        staffId: true,
        staff: { select: { name: true } }
      }
    });

    // 이 날짜에 OFF이면서 미달인 직원
    const offAndBelow = offStaff.filter(os =>
      below4Staff.some(b => b.id === os.staffId)
    );

    console.log(`   ${dateStr}: OFF ${offStaff.length}명 (미달 직원 ${offAndBelow.length}명)`);
    if (offAndBelow.length > 0 && offAndBelow.length <= 3) {
      offAndBelow.forEach(s => console.log(`      - ${s.staff.name}`));
    }
  }

  console.log();
  console.log('Phase 2 시뮬레이션:');
  console.log('- OFF가 많은 날짜부터 미달 직원의 OFF를 근무로 변경');
  console.log('- 각 날짜마다 1명씩 변경');
  console.log('- 변경 후 그 직원은 미달 목록에서 제외됨');
  console.log();
  console.log('문제 가능성:');
  console.log('1. 같은 직원을 여러 날짜에서 변경하려 시도');
  console.log('2. 변경 후 미달 재계산이 누락됨');
  console.log('3. dailyAssignments가 제대로 업데이트 안됨');

  await prisma.$disconnect();
}

tracePhase2Loop();
