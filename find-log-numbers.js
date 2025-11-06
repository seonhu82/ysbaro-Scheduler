const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findLogNumbers() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  console.log('=== 로그 숫자 60과 73의 출처 찾기 ===\n');

  // W36 범위
  const weekStart = new Date('2025-09-07T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  // 배정된 직원 (W36)
  const staff = await prisma.staffAssignment.findMany({
    where: {
      scheduleId: schedule.id,
      date: { gte: weekStart, lte: weekEnd }
    },
    select: { staffId: true },
    distinct: ['staffId']
  });

  console.log(`W36 배정된 직원: ${staff.length}명\n`);

  // 전체 진료실 직원
  const allStaff = await prisma.staff.findMany({
    where: {
      isActive: true,
      departmentName: '진료실'
    }
  });

  console.log(`전체 진료실 직원: ${allStaff.length}명\n`);

  // 영업일
  const dates = ['2025-09-08', '2025-09-09', '2025-09-10', '2025-09-11', '2025-09-12', '2025-09-13'];
  console.log(`영업일: ${dates.length}일\n`);

  // 다양한 계산 조합
  console.log('가능한 계산 조합:\n');

  console.log('1. 배정 20명 × (영업일 6 - 4):');
  console.log(`   목표 = ${staff.length} × ${dates.length - 4} = ${staff.length * (dates.length - 4)}`);

  console.log('\n2. 전체 37명 × (영업일 6 - 4):');
  console.log(`   목표 = ${allStaff.length} × ${dates.length - 4} = ${allStaff.length * (dates.length - 4)}`);

  console.log('\n3. 배정 20명 × 전체일 7 - 4):');
  console.log(`   목표 = ${staff.length} × ${7 - 4} = ${staff.length * (7 - 4)}`);

  console.log('\n4. 전체 37명 × (전체일 7 - 4):');
  console.log(`   목표 = ${allStaff.length} × ${7 - 4} = ${allStaff.length * (7 - 4)}`);

  console.log('\n5. 배정 20명 × 영업일 6 - 배정 20명:');
  console.log(`   목표 = ${staff.length} × ${dates.length} - ${staff.length} = ${staff.length * dates.length - staff.length}`);

  console.log('\n6. 특정 숫자들:');
  if (allStaff.length === 30) {
    console.log(`   30명 × 2 = 60`);
  }
  const special1 = allStaff.length * 2;
  const special2 = staff.length * 3;
  console.log(`   전체 ${allStaff.length}명 × 2 = ${special1}`);
  console.log(`   배정 ${staff.length}명 × 3 = ${special2}`);

  // 실제 OFF 수
  console.log('\n\n실제 OFF 수:\n');

  const offBusinessDays = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { in: dates.map(d => new Date(d + 'T00:00:00.000Z')) },
      shiftType: 'OFF'
    }
  });

  console.log(`영업일만 (6일): ${offBusinessDays}개`);

  const offAllDays = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { gte: weekStart, lte: weekEnd },
      shiftType: 'OFF'
    }
  });

  console.log(`전체일 (7일, 일요일 포함): ${offAllDays}개`);

  console.log('\n\n로그 값 매칭:');
  console.log(`- 목표 60: ?`);
  console.log(`- 현재 73: ?`);

  await prisma.$disconnect();
}

findLogNumbers();
