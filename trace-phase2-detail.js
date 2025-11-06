const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function tracePhase2Detail() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  const weekStart = new Date('2025-09-08T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  // 2주차 배정된 20명
  const assignedStaff = await prisma.staffAssignment.findMany({
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

  const staffIds = assignedStaff.map(s => s.staffId);

  console.log('=== 2주차 상세 추적 ===\n');

  // 각 직원의 날짜별 배정 현황
  for (const { staffId, staff } of assignedStaff) {
    const assignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        staffId: staffId,
        date: { gte: weekStart, lte: weekEnd }
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        shiftType: true
      }
    });

    const workCount = assignments.filter(a => a.shiftType !== 'OFF').length;
    const offCount = assignments.filter(a => a.shiftType === 'OFF').length;

    if (workCount !== 4) {
      console.log(`${staff.name}: ${workCount}일 근무, ${offCount}일 OFF`);
      assignments.forEach(a => {
        const dateStr = a.date.toISOString().split('T')[0];
        console.log(`   ${dateStr}: ${a.shiftType}`);
      });
      console.log();
    }
  }

  // 총 카운트
  const totalWork = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { gte: weekStart, lte: weekEnd },
      shiftType: { in: ['DAY', 'NIGHT'] }
    }
  });

  const totalOff = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { gte: weekStart, lte: weekEnd },
      shiftType: 'OFF'
    }
  });

  console.log('=== 전체 합계 ===');
  console.log(`총 근무: ${totalWork}건`);
  console.log(`총 OFF: ${totalOff}건`);
  console.log(`직원: ${assignedStaff.length}명`);
  console.log(`영업일: 6일`);
  console.log(`목표 근무: ${assignedStaff.length} × 4 = ${assignedStaff.length * 4}건`);
  console.log(`목표 OFF: ${assignedStaff.length} × 2 = ${assignedStaff.length * 2}건`);
  console.log();

  // 각 날짜별 상세
  const dates = ['2025-09-08', '2025-09-09', '2025-09-10', '2025-09-11', '2025-09-12', '2025-09-13'];
  console.log('=== 날짜별 상세 ===');
  for (const dateStr of dates) {
    const date = new Date(dateStr + 'T00:00:00.000Z');

    const workStaff = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        date: date,
        shiftType: { in: ['DAY', 'NIGHT'] }
      },
      select: {
        staff: { select: { name: true } }
      }
    });

    const offStaff = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        date: date,
        shiftType: 'OFF'
      },
      select: {
        staff: { select: { name: true } }
      }
    });

    console.log(`${dateStr}: 근무 ${workStaff.length}명, OFF ${offStaff.length}명`);
  }

  await prisma.$disconnect();
}

tracePhase2Detail();
