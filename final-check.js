const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function finalCheck() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  const weekStart = new Date('2025-09-08T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  console.log('=== 최종 검증 (09-08~13 영업일만) ===\n');

  // 20명 직원
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

  console.log(`직원: ${staff.length}명`);
  console.log(`영업일: 6일`);
  console.log(`목표: 각 직원 주4일 근무`);
  console.log();

  // 각 직원의 근무일 수
  let below4 = 0;
  let equal4 = 0;
  let above4 = 0;
  let totalWork = 0;
  let totalOff = 0;

  for (const { staffId, staff: s } of staff) {
    const work = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        staffId: staffId,
        date: { gte: weekStart, lte: weekEnd },
        shiftType: { in: ['DAY', 'NIGHT'] }
      }
    });

    const off = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        staffId: staffId,
        date: { gte: weekStart, lte: weekEnd },
        shiftType: 'OFF'
      }
    });

    totalWork += work;
    totalOff += off;

    if (work < 4) below4++;
    else if (work === 4) equal4++;
    else above4++;
  }

  console.log(`총 근무: ${totalWork}건`);
  console.log(`총 OFF: ${totalOff}건`);
  console.log();

  console.log(`직원 분포:`);
  console.log(`- < 4일: ${below4}명`);
  console.log(`- = 4일: ${equal4}명`);
  console.log(`- > 4일: ${above4}명`);
  console.log();

  console.log(`목표 vs 실제:`);
  console.log(`- 목표 근무: ${staff.length} × 4 = ${staff.length * 4}건`);
  console.log(`- 실제 근무: ${totalWork}건`);
  console.log(`- 차이: ${totalWork - staff.length * 4}건`);
  console.log();
  console.log(`- 목표 OFF: ${staff.length} × 2 = ${staff.length * 2}건`);
  console.log(`- 실제 OFF: ${totalOff}건`);
  console.log(`- 차이: ${totalOff - staff.length * 2}건`);
  console.log();

  console.log(`검증:`);
  console.log(`- 총 슬롯: ${staff.length} × 6 = ${staff.length * 6}건`);
  console.log(`- 근무 + OFF: ${totalWork} + ${totalOff} = ${totalWork + totalOff}건`);
  console.log(`- 일치: ${totalWork + totalOff === staff.length * 6 ? '✓' : '✗'}`);
  console.log();

  if (below4 === 0 && totalOff > staff.length * 2) {
    console.log('❌ 문제:');
    console.log(`   미달 직원 0명인데 OFF ${totalOff - staff.length * 2}개 초과`);
    console.log();
    console.log('원인:');
    console.log('   Phase 2가 조정을 완료했지만');
    console.log('   여전히 OFF가 1개 남아있음');
    console.log();
    console.log('Phase 2 로그 재확인 필요:');
    console.log('   - "미달 직원 0명" 시점에');
    console.log('   - 실제로 모든 직원이 4일 이상 근무 중인지');
    console.log('   - 아니면 calculateWeeklyWorkDays 오류인지');
  }

  await prisma.$disconnect();
}

finalCheck();
