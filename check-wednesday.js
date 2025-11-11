const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWednesday() {
  const clinicId = 'cmh697itv0001fw83azbrqe60';
  const testDate = new Date('2025-11-05'); // 수요일

  console.log('='.repeat(80));
  console.log(`수요일 (${testDate.toISOString().split('T')[0]}) 분석`);
  console.log('='.repeat(80));

  // 1. 원장 스케줄 확인
  const scheduleDoctors = await prisma.scheduleDoctor.findMany({
    where: {
      date: testDate,
      schedule: {
        clinicId,
        year: 2025,
        month: 11
      }
    },
    include: {
      doctor: { select: { shortName: true } }
    },
    orderBy: { doctorId: 'asc' }
  });

  const doctorNames = scheduleDoctors.map(sd => sd.doctor.shortName).sort();
  console.log('\n원장 배치:', doctorNames);

  // 2. DoctorCombination 확인
  const combination = await prisma.doctorCombination.findFirst({
    where: {
      clinicId,
      doctors: { equals: doctorNames }
    }
  });

  if (!combination) {
    console.log('❌ 원장 조합이 등록되지 않음!');
    console.log('\n등록된 모든 원장 조합:');

    const allCombinations = await prisma.doctorCombination.findMany({
      where: { clinicId },
      select: {
        name: true,
        doctors: true,
        requiredStaff: true,
      }
    });

    allCombinations.forEach(c => {
      console.log(`  - ${c.name}: [${c.doctors.join(', ')}] → ${c.requiredStaff}명`);
    });

    console.log('\n해결 방법:');
    console.log(`  [${doctorNames.join(', ')}] 조합을 DoctorCombination 테이블에 추가해야 합니다.`);
  } else {
    console.log('✅ 원장 조합 찾음:', combination.name);
    console.log('필요 직원:', combination.requiredStaff + '명');

    // 3. 구분별 계산
    const ratios = await prisma.categoryRatioSettings.findUnique({
      where: { clinicId },
      select: { ratios: true }
    });

    if (ratios) {
      console.log('\n구분별 필요 인원:');
      Object.entries(ratios.ratios).forEach(([cat, ratio]) => {
        const required = Math.ceil(combination.requiredStaff * (ratio / 100));
        console.log(`  ${cat}: ${ratio}% → ${required}명 필요`);
      });
    }

    // 4. 구분별 전체 인원
    const staffByCategory = await prisma.staff.groupBy({
      by: ['categoryName'],
      where: {
        clinicId,
        isActive: true,
        categoryName: { not: null }
      },
      _count: true
    });

    console.log('\n구분별 전체 인원:');
    staffByCategory.forEach(s => {
      console.log(`  ${s.categoryName}: ${s._count}명`);
    });

    // 5. 신청 현황
    const applications = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: testDate,
        status: { in: ['CONFIRMED', 'PENDING'] }
      },
      include: {
        staff: { select: { name: true, categoryName: true } }
      }
    });

    console.log(`\n신청 현황: ${applications.length}건`);
    if (applications.length > 0) {
      applications.forEach(app => {
        console.log(`  - ${app.staff.name} (${app.staff.categoryName}): ${app.leaveType} [${app.status}]`);
      });
    }
  }

  await prisma.$disconnect();
}

checkWednesday().catch(console.error);
