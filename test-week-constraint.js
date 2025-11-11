/**
 * 주4일 제약 직접 테스트
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const clinicId = 'cmh697itv0001fw83azbrqe60';
const staffId = 'cmh6naxac000s12lynsqel2z3'; // 혜숙

async function testWeekConstraint() {
  console.log('='.repeat(80));
  console.log('주4일 제약 테스트 - 11월 마지막 주');
  console.log('='.repeat(80));

  // 정기 휴무일 확인
  const closedDaySettings = await prisma.closedDaySettings.findUnique({
    where: { clinicId },
    select: { regularDays: true }
  });

  console.log('\n정기 휴무일:', closedDaySettings?.regularDays);

  // 테스트 날짜들
  const dates = [
    { date: new Date('2025-11-25'), name: '25일(화)' },
    { date: new Date('2025-11-26'), name: '26일(수)' },
    { date: new Date('2025-11-27'), name: '27일(목)' },
    { date: new Date('2025-11-28'), name: '28일(금)' },
    { date: new Date('2025-11-29'), name: '29일(토)' },
  ];

  for (const { date, name } of dates) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📅 ${name} OFF 신청 시뮬레이션`);
    console.log('-'.repeat(80));

    // 주 범위 계산
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = day === 0 ? 0 : -day;
    weekStart.setDate(weekStart.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    console.log(`주 범위: ${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]}`);

    // 영업일 수 계산
    const regularClosedDays = closedDaySettings?.regularDays || [0];
    let totalWeekdays = 0;
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (!regularClosedDays.includes(dayOfWeek)) {
        totalWeekdays++;
      }
    }

    console.log(`영업일: ${totalWeekdays}일`);

    // 공휴일 확인
    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: {
          gte: weekStart,
          lte: weekEnd
        }
      }
    });

    console.log(`공휴일: ${holidays.length}일`);

    // 이미 신청한 OFF 확인
    const existingOffs = await prisma.leaveApplication.findMany({
      where: {
        staffId,
        clinicId,
        date: {
          gte: weekStart,
          lte: weekEnd
        },
        leaveType: 'OFF',
        status: {
          in: ['CONFIRMED', 'PENDING']
        }
      },
      select: {
        date: true
      }
    });

    console.log(`기존 OFF: ${existingOffs.length}일`);
    existingOffs.forEach(off => {
      console.log(`  - ${off.date.toISOString().split('T')[0]}`);
    });

    // 이번 신청 포함
    const alreadyApplied = existingOffs.some(off =>
      off.date.toISOString().split('T')[0] === date.toISOString().split('T')[0]
    );

    const offCount = alreadyApplied ? existingOffs.length : existingOffs.length + 1;

    console.log(`\n${name} 신청 시 OFF 수: ${offCount}일`);

    // 근무 가능일 계산
    const workableDays = totalWeekdays - holidays.length - offCount;
    const minimumRequired = 4;

    console.log(`근무 가능일: ${totalWeekdays} - ${holidays.length} - ${offCount} = ${workableDays}일`);
    console.log(`최소 요구: ${minimumRequired}일`);

    if (workableDays < minimumRequired) {
      console.log(`\n❌ 차단: 근무 가능일 ${workableDays}일 < 최소 ${minimumRequired}일`);
    } else {
      console.log(`\n✅ 통과: 근무 가능일 ${workableDays}일 >= 최소 ${minimumRequired}일`);
    }
  }

  await prisma.$disconnect();
}

testWeekConstraint().catch(console.error);
