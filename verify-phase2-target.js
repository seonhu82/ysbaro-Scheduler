const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyPhase2Target() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  console.log('=== Phase 2 목표 계산 검증 ===\n');

  // 전체 진료실 직원
  const allStaff = await prisma.staff.findMany({
    where: {
      isActive: true,
      departmentName: '진료실'
    }
  });

  console.log(`전체 진료실 직원: ${allStaff.length}명\n`);

  // W36 (09-07~13)
  const weekStart = new Date('2025-09-07T00:00:00.000Z');
  const weekEnd = new Date('2025-09-13T23:59:59.999Z');

  // 이 주에 배정된 직원
  const assignedStaff = await prisma.staffAssignment.findMany({
    where: {
      scheduleId: schedule.id,
      date: { gte: weekStart, lte: weekEnd }
    },
    select: { staffId: true },
    distinct: ['staffId']
  });

  console.log(`W36에 배정된 직원: ${assignedStaff.length}명\n`);

  // 영업일 (sortedDates 방식)
  const dates = ['2025-09-08', '2025-09-09', '2025-09-10', '2025-09-11', '2025-09-12', '2025-09-13'];
  const businessDays = dates.length;

  console.log(`영업일: ${businessDays}일\n`);

  // Phase 2 목표 계산 (코드 대로)
  const targetOff_code = allStaff.length * (businessDays - 4);
  console.log(`Phase 2 목표 (코드): ${allStaff.length} × (${businessDays} - 4) = ${targetOff_code}개\n`);

  // 실제 필요 목표
  const targetOff_real = assignedStaff.length * (businessDays - 4);
  console.log(`실제 필요 목표: ${assignedStaff.length} × (${businessDays} - 4) = ${targetOff_real}개\n`);

  // 실제 OFF (영업일만)
  let actualOff = 0;
  for (const dateStr of dates) {
    const count = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        date: new Date(dateStr + 'T00:00:00.000Z'),
        shiftType: 'OFF'
      }
    });
    actualOff += count;
  }

  console.log(`실제 OFF (영업일만): ${actualOff}개\n`);

  console.log('차이:');
  console.log(`- Phase 2 목표 기준: 실제 ${actualOff} - 목표 ${targetOff_code} = ${actualOff - targetOff_code}개 (${actualOff > targetOff_code ? 'OFF 초과' : 'OFF 부족'})`);
  console.log(`- 올바른 목표 기준: 실제 ${actualOff} - 목표 ${targetOff_real} = ${actualOff - targetOff_real}개 (${actualOff > targetOff_real ? 'OFF 초과' : 'OFF 부족'})`);
  console.log();

  if (actualOff < targetOff_code) {
    console.log('❌ Phase 2가 OFF 부족으로 판단');
    console.log(`   ${targetOff_code - actualOff}개 부족`);
    console.log('   → 근무를 OFF로 변경하려 함');
    console.log('   → 하지만 실제로는 OFF 1개 초과 상태');
  }

  await prisma.$disconnect();
}

verifyPhase2Target();
