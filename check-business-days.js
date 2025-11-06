const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBusinessDays() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  console.log('=== BusinessDays 계산 확인 ===\n');

  // W36 범위
  const weekStart = new Date('2025-09-07T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  console.log('W36 주차: 09-07 ~ 09-13 (일~토)\n');

  // 원장 스케줄 확인으로 sortedDates 재현
  const sortedDates = [];
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
      sortedDates.push(dateKey);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`sortedDates에 포함된 날짜: ${sortedDates.length}일`);
  sortedDates.forEach(d => console.log(`   ${d}`));
  console.log();

  // 전체 진료실 직원
  const allStaff = await prisma.staff.findMany({
    where: {
      isActive: true,
      departmentName: '진료실'
    }
  });

  console.log(`전체 진료실 직원 (totalStaffCount): ${allStaff.length}명\n`);

  // Phase 2 계산
  const businessDays = sortedDates.length;
  const maxWeeklyWorkDays = 4;
  const targetOffCount = allStaff.length * (businessDays - maxWeeklyWorkDays);

  console.log('Phase 2 목표 계산:');
  console.log(`   totalStaffCount × (businessDays - maxWeeklyWorkDays)`);
  console.log(`   = ${allStaff.length} × (${businessDays} - ${maxWeeklyWorkDays})`);
  console.log(`   = ${allStaff.length} × ${businessDays - maxWeeklyWorkDays}`);
  console.log(`   = ${targetOffCount}개\n`);

  // 실제 OFF
  let currentOffCount = 0;
  for (const dateKey of sortedDates) {
    const offCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        date: new Date(dateKey + 'T00:00:00.000Z'),
        shiftType: 'OFF'
      }
    });
    currentOffCount += offCount;
  }

  console.log(`현재 OFF (sortedDates만): ${currentOffCount}개\n`);

  console.log('차이:');
  const diff = currentOffCount - targetOffCount;
  console.log(`   현재 ${currentOffCount} - 목표 ${targetOffCount} = ${diff}개`);
  console.log(`   → ${diff > 0 ? 'OFF 초과' : diff < 0 ? 'OFF 부족' : '정확'}\n`);

  // 로그와 비교
  console.log('예상 로그 출력:');
  console.log(`   목표 OFF: ${targetOffCount}개`);
  console.log(`   현재 OFF: ${currentOffCount}개`);

  await prisma.$disconnect();
}

checkBusinessDays();
