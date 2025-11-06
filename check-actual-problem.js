const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkActualProblem() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  console.log('=== 실제 문제 확인 ===\n');

  // W36 (2주차) - 로그에서 "미달 직원 0명인데 OFF 1개 초과" 발생
  const weekStart = new Date('2025-09-07T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  console.log('W36 주차: 09-07 ~ 09-13\n');

  // 배정된 20명
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

  console.log(`배정된 직원: ${staff.length}명\n`);

  // 각 직원의 W36 근무일 수
  console.log('직원별 W36 근무일 (calculateWeeklyWorkDays 방식):');

  let below4 = [];
  let equal4 = [];
  let above4 = [];

  for (const { staffId, staff: s } of staff) {
    const workCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        staffId: staffId,
        date: {
          gte: weekStart,
          lte: weekEnd
        },
        shiftType: { not: 'OFF' }
      }
    });

    if (workCount < 4) {
      below4.push({ name: s.name, days: workCount });
    } else if (workCount === 4) {
      equal4.push({ name: s.name, days: workCount });
    } else {
      above4.push({ name: s.name, days: workCount });
    }
  }

  console.log(`\n< 4일 (미달): ${below4.length}명`);
  below4.forEach(s => console.log(`   ${s.name}: ${s.days}일`));

  console.log(`\n= 4일 (정확): ${equal4.length}명`);

  console.log(`\n> 4일 (초과): ${above4.length}명`);
  above4.forEach(s => console.log(`   ${s.name}: ${s.days}일`));

  console.log();

  // 영업일 계산
  const dates = ['2025-09-08', '2025-09-09', '2025-09-10', '2025-09-11', '2025-09-12', '2025-09-13'];
  console.log(`영업일 (원장 근무): ${dates.length}일`);
  console.log(`목표 OFF: ${staff.length} × (${dates.length} - 4) = ${staff.length * (dates.length - 4)}개`);

  // 실제 OFF (영업일만)
  let actualOff = 0;
  for (const dateStr of dates) {
    const offCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        date: new Date(dateStr + 'T00:00:00.000Z'),
        shiftType: 'OFF'
      }
    });
    actualOff += offCount;
  }

  console.log(`실제 OFF (영업일만): ${actualOff}개`);
  console.log(`차이: ${actualOff - staff.length * (dates.length - 4)}개`);
  console.log();

  console.log('결론:');
  if (below4.length === 0 && actualOff > staff.length * (dates.length - 4)) {
    console.log('✓ 미달 직원 0명');
    console.log(`✓ OFF ${actualOff - staff.length * (dates.length - 4)}개 초과`);
    console.log('✓ Phase 2가 더 이상 조정할 수 없는 상태');
    console.log();
    console.log('왜 이런 상황이 발생했는지:');
    console.log('1. 1차 배치에서 주4일 제한으로 특정 날짜에 인원 부족');
    console.log('2. 그 결과 일부 직원이 4일 미만 근무');
    console.log('3. Phase 2가 조정했지만 완전히 해결 못함');
    console.log('4. 마지막 1개를 조정하려 할 때 미달 직원 0명 상태');
  } else {
    console.log(`✓ 미달 직원 ${below4.length}명 존재`);
    console.log('✓ Phase 2가 계속 조정 가능');
  }

  await prisma.$disconnect();
}

checkActualProblem();
