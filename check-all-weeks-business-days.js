const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllWeeksBusinessDays() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  console.log('=== 모든 주차의 BusinessDays 계산 ===\n');

  const weeks = [
    { key: '2025-W35', label: 'W35 (09-01~06)', start: '2025-08-31', end: '2025-09-06' },
    { key: '2025-W36', label: 'W36 (09-07~13)', start: '2025-09-07', end: '2025-09-13' },
    { key: '2025-W37', label: 'W37 (09-14~20)', start: '2025-09-14', end: '2025-09-20' },
    { key: '2025-W38', label: 'W38 (09-21~27)', start: '2025-09-21', end: '2025-09-27' },
    { key: '2025-W39', label: 'W39 (09-28~10-04)', start: '2025-09-28', end: '2025-10-04' }
  ];

  const allStaff = await prisma.staff.findMany({
    where: {
      isActive: true,
      departmentName: '진료실'
    }
  });

  console.log(`전체 진료실 직원: ${allStaff.length}명\n`);

  for (const week of weeks) {
    console.log(`\n${week.label}:`);

    const weekStart = new Date(week.start + 'T00:00:00.000Z');
    const weekEnd = new Date(week.end + 'T23:59:59.999Z');

    // sortedDates 재현
    const sortedDates = [];
    let currentDate = new Date(weekStart);

    while (currentDate <= weekEnd) {
      const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')}`;

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

    const businessDays = sortedDates.length;
    const targetOff = allStaff.length * (businessDays - 4);

    // 현재 OFF
    let currentOff = 0;
    for (const dateKey of sortedDates) {
      const offCount = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id,
          date: new Date(dateKey + 'T00:00:00.000Z'),
          shiftType: 'OFF'
        }
      });
      currentOff += offCount;
    }

    console.log(`   영업일: ${businessDays}일`);
    console.log(`   목표 OFF: ${allStaff.length} × (${businessDays} - 4) = ${targetOff}개`);
    console.log(`   현재 OFF: ${currentOff}개`);
    console.log(`   차이: ${currentOff - targetOff}개`);

    if (targetOff === 60) {
      console.log(`   ✓ 목표 60 발견!`);
    }
    if (currentOff === 73) {
      console.log(`   ✓ 현재 73 발견!`);
    }
  }

  await prisma.$disconnect();
}

checkAllWeeksBusinessDays();
