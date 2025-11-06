const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSortedDatesSunday() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  console.log('=== sortedDates에 일요일 포함 여부 확인 ===\n');

  // W36 범위
  const weekStart = new Date('2025-09-07T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  console.log('W36 주차: 09-07 ~ 09-13\n');

  // Phase 2 코드의 sortedDates 재현 (line 126-129)
  const sortedDates_phase2 = [];
  let currentDate = new Date(weekStart);

  while (currentDate <= weekEnd) {
    const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')}`;

    // 원장 스케줄 확인
    const hasDoctor = await prisma.scheduleDoctor.findFirst({
      where: {
        scheduleId: schedule.id,
        date: new Date(dateKey + 'T00:00:00.000Z')
      }
    });

    if (hasDoctor) {
      sortedDates_phase2.push({ date: dateKey, hasDoctor: true });
    } else {
      console.log(`   ${dateKey}: 원장 스케줄 없음`);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`\nsortedDates_phase2 (원장 스케줄 있는 날만): ${sortedDates_phase2.length}일\n`);

  // 실제로 원장이 OFF인 날 확인
  const sundaySchedule = await prisma.scheduleDoctor.findFirst({
    where: {
      scheduleId: schedule.id,
      date: new Date('2025-09-07T00:00:00.000Z')
    }
  });

  console.log('09-07 (일요일) 원장 스케줄:');
  if (sundaySchedule) {
    console.log(`   존재함: hasDayShift=${sundaySchedule.hasDayShift}, hasNightShift=${sundaySchedule.hasNightShift}`);
    if (!sundaySchedule.hasDayShift && !sundaySchedule.hasNightShift) {
      console.log('   → 원장 OFF이지만 스케줄 레코드는 존재!');
      console.log('   → sortedDates에 포함됨!');
    }
  } else {
    console.log('   존재하지 않음');
  }

  console.log();

  // Phase 2 로그 재현
  const businessDays = sortedDates_phase2.length + (sundaySchedule ? 1 : 0);
  const targetOff = 20 * (businessDays - 4);

  console.log('Phase 2 계산 (일요일 포함):');
  console.log(`   영업일: ${businessDays}일`);
  console.log(`   목표 OFF: 20 × (${businessDays} - 4) = ${targetOff}개`);

  if (targetOff === 60) {
    console.log('   ✓ 로그의 목표 60과 일치!\n');
  }

  // 현재 OFF (일요일 포함)
  const offWithSunday = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { gte: weekStart, lte: weekEnd },
      shiftType: 'OFF'
    }
  });

  console.log(`현재 OFF (일요일 포함): ${offWithSunday}개`);

  if (offWithSunday === 73) {
    console.log('✓ 로그의 현재 73과 일치!\n');
  }

  console.log('결론:');
  console.log('- Phase 2 코드가 sortedDates에 일요일을 포함시킴');
  console.log('- 일요일에는 원장이 OFF지만 scheduleDoctor 레코드는 존재');
  console.log('- 그 결과 businessDays가 7일로 계산됨');
  console.log('- 목표 = 20 × 3 = 60');
  console.log('- 현재 = 73 (일요일 20 OFF + 영업일 53 OFF)');

  await prisma.$disconnect();
}

checkSortedDatesSunday();
