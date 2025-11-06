const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyActualLogCalculation() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  console.log('=== 실제 로그 계산 검증 ===\n');

  // W36 범위
  const weekStart = new Date('2025-09-07T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  // 전체 날짜 (일요일 포함)
  const allDates = [];
  let currentDate = new Date(weekStart);
  while (currentDate <= weekEnd) {
    allDates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`W36 전체 날짜: ${allDates.length}일`);
  console.log(allDates.join(', '));
  console.log();

  // 원장 스케줄이 있는 날짜만
  const datesWithDoctor = [];
  for (const dateKey of allDates) {
    const hasDoctor = await prisma.scheduleDoctor.findFirst({
      where: {
        scheduleId: schedule.id,
        date: new Date(dateKey + 'T00:00:00.000Z')
      }
    });
    if (hasDoctor) {
      datesWithDoctor.push(dateKey);
    }
  }

  console.log(`원장 스케줄 있는 날: ${datesWithDoctor.length}일`);
  console.log(datesWithDoctor.join(', '));
  console.log();

  // 로그에 나온 "영업일 7일, 직원 20명"
  const logBusinessDays = 7;
  const logStaffCount = 20;
  const logTargetOff = 60;
  const logCurrentOff = 73;

  console.log('로그 값:');
  console.log(`   영업일: ${logBusinessDays}일`);
  console.log(`   직원: ${logStaffCount}명`);
  console.log(`   목표 OFF: ${logTargetOff}개`);
  console.log(`   현재 OFF: ${logCurrentOff}개\n`);

  // 역산
  console.log('역산:');
  console.log(`   목표 60 = 직원 × (영업일 - 4)`);
  console.log(`   60 = 20 × (businessDays - 4)`);
  console.log(`   60 = 20 × X`);
  console.log(`   X = 3`);
  console.log(`   businessDays - 4 = 3`);
  console.log(`   businessDays = 7\n`);

  console.log('결론:');
  console.log('   로그의 "영업일 7일"은 일요일 포함');
  console.log('   sortedDates = 전체 7일 (일요일 포함)');
  console.log();

  // 현재 OFF 검증
  const offAllDays = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { gte: weekStart, lte: weekEnd },
      shiftType: 'OFF'
    }
  });

  const offBusinessDays = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { in: datesWithDoctor.map(d => new Date(d + 'T00:00:00.000Z')) },
      shiftType: 'OFF'
    }
  });

  console.log('실제 OFF:');
  console.log(`   전체 7일: ${offAllDays}개`);
  console.log(`   영업일만 6일: ${offBusinessDays}개`);
  console.log();

  if (offAllDays === logCurrentOff) {
    console.log(`✓ 로그 "현재 OFF 73개" = 전체 7일 OFF ${offAllDays}개 일치`);
  }

  console.log();
  console.log('Phase 2 코드의 계산:');
  console.log('   1. sortedDates에 일요일 포함 (NO_DOCTOR)');
  console.log('   2. businessDays = 7일로 계산');
  console.log('   3. 목표 = 20 × (7 - 4) = 60');
  console.log('   4. 현재 = 전체 7일의 OFF = 73');
  console.log('   5. 차이 = 73 - 60 = 13개 초과');

  await prisma.$disconnect();
}

verifyActualLogCalculation();
