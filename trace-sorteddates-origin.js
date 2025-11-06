const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function traceSortedDatesOrigin() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  console.log('=== sortedDates 출처 추적 ===\n');
  console.log('Phase 2는 sortedDates를 매개변수로 받습니다.');
  console.log('sortedDates는 어디서 생성되는지 확인 필요\n');

  // W36 전체 범위의 원장 스케줄
  const weekStart = new Date('2025-09-07T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  const allDoctorSchedules = await prisma.scheduleDoctor.findMany({
    where: {
      scheduleId: schedule.id,
      date: { gte: weekStart, lte: weekEnd }
    },
    select: {
      date: true,
      hasNightShift: true
    },
    orderBy: { date: 'asc' }
  });

  console.log('W36 원장 스케줄:');
  allDoctorSchedules.forEach(ds => {
    const dateStr = ds.date.toISOString().split('T')[0];
    const day = ds.date.getDay();
    const dayName = ['일', '월', '화', '수', '목', '금', '토'][day];
    console.log(`   ${dateStr} (${dayName}): night=${ds.hasNightShift}`);
  });

  console.log(`\n총 ${allDoctorSchedules.length}일\n`);

  // 일요일 레코드 확인
  const sundayRecord = allDoctorSchedules.find(ds => ds.date.getDay() === 0);
  if (sundayRecord) {
    console.log('일요일 레코드 존재:');
    console.log(`   night=${sundayRecord.hasNightShift}`);
    console.log('   → Phase 2의 sortedDates에 포함될 가능성');
  } else {
    console.log('일요일 레코드 없음');
    console.log('→ sortedDates에 포함되지 않음');
  }

  console.log('\n\n로그 "영업일 7일"의 의미:');
  console.log('1. sortedDates가 일요일 포함 7일을 전달받음');
  console.log('2. sortedDates는 auto-assign route에서 생성됨');
  console.log('3. auto-assign route의 sortedDates 생성 로직 확인 필요');

  await prisma.$disconnect();
}

traceSortedDatesOrigin();
