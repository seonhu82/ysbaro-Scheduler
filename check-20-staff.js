const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check20Staff() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  // 2주차 (2025-09-08 ~ 2025-09-13)
  const weekStart = new Date('2025-09-08T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  console.log('=== 2주차 (09-08 ~ 09-13) 20명 기준 분석 ===\n');

  // 1. 이 주에 실제 배정된 직원 목록
  const assignedStaff = await prisma.staffAssignment.findMany({
    where: {
      scheduleId: schedule.id,
      date: { gte: weekStart, lte: weekEnd }
    },
    select: {
      staffId: true,
      staff: {
        select: { name: true }
      }
    },
    distinct: ['staffId']
  });

  console.log(`1. 이 주에 배정된 직원: ${assignedStaff.length}명\n`);

  // 2. 각 직원의 근무일 수
  console.log('2. 각 직원의 근무일 수:');
  const workDays = [];
  for (const { staffId, staff } of assignedStaff) {
    const workCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        staffId: staffId,
        date: { gte: weekStart, lte: weekEnd },
        shiftType: { in: ['DAY', 'NIGHT'] }
      }
    });

    const offCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        staffId: staffId,
        date: { gte: weekStart, lte: weekEnd },
        shiftType: 'OFF'
      }
    });

    workDays.push({ name: staff.name, work: workCount, off: offCount });
  }

  workDays.sort((a, b) => a.work - b.work);

  let below4 = 0, equal4 = 0, above4 = 0;
  workDays.forEach(w => {
    const status = w.work < 4 ? '미달' : w.work === 4 ? '정확' : '초과';
    console.log(`   ${w.name}: 근무 ${w.work}일, OFF ${w.off}일 (${status})`);
    if (w.work < 4) below4++;
    else if (w.work === 4) equal4++;
    else above4++;
  });

  console.log();
  console.log(`   미달(< 4일): ${below4}명`);
  console.log(`   정확(= 4일): ${equal4}명`);
  console.log(`   초과(> 4일): ${above4}명`);
  console.log();

  // 3. 영업일 및 목표 계산
  const dates = ['2025-09-08', '2025-09-09', '2025-09-10', '2025-09-11', '2025-09-12', '2025-09-13'];
  const businessDays = dates.length;
  const staffCount = assignedStaff.length;
  const targetOff = staffCount * (businessDays - 4);

  console.log('3. 목표 계산:');
  console.log(`   직원: ${staffCount}명`);
  console.log(`   영업일: ${businessDays}일`);
  console.log(`   목표 OFF: ${staffCount} × (${businessDays} - 4) = ${targetOff}개`);
  console.log();

  // 4. 실제 OFF 수
  const actualOff = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { gte: weekStart, lte: weekEnd },
      shiftType: 'OFF'
    }
  });

  console.log('4. 실제 OFF:');
  console.log(`   실제 OFF: ${actualOff}개`);
  console.log(`   차이: ${actualOff - targetOff}개 (${actualOff > targetOff ? '초과' : '부족'})`);
  console.log();

  // 5. 결론
  console.log('=== 결론 ===');
  if (below4 === 0 && actualOff > targetOff) {
    console.log(`✓ 미달 직원 0명인데 OFF ${actualOff - targetOff}개 초과`);
    console.log(`✓ Phase 2가 조정 불가능한 상태`);
  } else if (below4 > 0 && actualOff > targetOff) {
    console.log(`✓ 미달 직원 ${below4}명 있음`);
    console.log(`✓ OFF ${actualOff - targetOff}개 초과`);
    console.log(`✓ Phase 2가 조정해야 하는데 ${actualOff - targetOff - below4}개 남음`);
  }

  await prisma.$disconnect();
}

check20Staff();
