const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLogNumbers() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  console.log('=== 로그 숫자 검증 ===\n');
  console.log('로그: 목표 OFF 60개, 현재 OFF 73개\n');

  // W36 범위
  const weekStart = new Date('2025-09-07T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  // sortedDates에 포함된 날짜 (영업일)
  const dates = [];
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split('T')[0];

    // 원장 스케줄 확인
    const hasDoctor = await prisma.scheduleDoctor.findFirst({
      where: {
        scheduleId: schedule.id,
        date: new Date(dateKey + 'T00:00:00.000Z')
      }
    });

    if (hasDoctor) {
      dates.push(dateKey);
    }
  }

  console.log(`W36 영업일: ${dates.length}일`);
  dates.forEach(d => console.log(`   ${d}`));
  console.log();

  // 배정된 직원 수
  const staffCount = await prisma.staffAssignment.groupBy({
    by: ['staffId'],
    where: {
      scheduleId: schedule.id,
      date: { gte: weekStart, lte: weekEnd }
    },
    _count: true
  });

  console.log(`W36 배정된 직원: ${staffCount.length}명\n`);

  // 목표 계산
  const target = staffCount.length * (dates.length - 4);
  console.log(`목표 OFF: ${staffCount.length} × (${dates.length} - 4) = ${target}개\n`);

  // 현재 OFF (sortedDates만)
  let currentOff = 0;
  for (const dateKey of dates) {
    const count = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        date: new Date(dateKey + 'T00:00:00.000Z'),
        shiftType: 'OFF'
      }
    });
    currentOff += count;
  }

  console.log(`현재 OFF (영업일만): ${currentOff}개\n`);

  console.log('로그와 비교:');
  console.log(`- 로그 목표: 60개, 계산: ${target}개 → ${target === 60 ? '일치' : '불일치'}`);
  console.log(`- 로그 현재: 73개, 계산: ${currentOff}개 → ${currentOff === 73 ? '일치' : '불일치'}`);

  if (target === 60 && currentOff !== 73) {
    console.log();
    console.log('현재 OFF 73개 확인:');

    // 전체 기간 (09-07 포함)
    const totalOff = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        date: { gte: weekStart, lte: weekEnd },
        shiftType: 'OFF'
      }
    });

    console.log(`   전체 기간 (09-07 포함): ${totalOff}개`);
  }

  await prisma.$disconnect();
}

checkLogNumbers();
