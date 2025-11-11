/**
 * 특정 날짜들의 신청 가능 여부 실제 테스트
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const clinicId = 'cmh697itv0001fw83azbrqe60';
const staffId = 'cmh6naxac000s12lynsqel2z3'; // 혜숙
const year = 2025;
const month = 11;

// 시뮬레이터 함수 복사
async function checkCategoryRequirement(clinicId, staffId, leaveDate, year, month) {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { categoryName: true, name: true }
  });

  if (!staff || !staff.categoryName) {
    return { allowed: false, message: '직원 정보를 찾을 수 없습니다.' };
  }

  const ruleSettings = await prisma.ruleSettings.findUnique({
    where: { clinicId },
    select: { staffCategories: true }
  });

  if (!ruleSettings) {
    return { allowed: false, message: '규칙 설정을 찾을 수 없습니다.' };
  }

  const scheduleDoctors = await prisma.scheduleDoctor.findMany({
    where: {
      date: leaveDate,
      schedule: { clinicId, year, month }
    },
    include: {
      doctor: { select: { id: true, shortName: true } }
    },
    orderBy: { doctorId: 'asc' }
  });

  if (scheduleDoctors.length === 0) {
    return { allowed: false, message: '해당 날짜의 스케줄이 아직 생성되지 않았습니다.' };
  }

  const doctorNames = scheduleDoctors.map(sd => sd.doctor.shortName).sort();
  const doctorCombination = await prisma.doctorCombination.findFirst({
    where: {
      clinicId,
      doctors: { equals: doctorNames }
    }
  });

  if (!doctorCombination) {
    return {
      allowed: false,
      message: `원장 조합 [${doctorNames.join(', ')}]에 대한 필요 직원 설정을 찾을 수 없습니다.`
    };
  }

  const requiredStaff = doctorCombination.requiredStaff;

  // CategoryRatioSettings 조회
  const ratioSettings = await prisma.categoryRatioSettings.findUnique({
    where: { clinicId },
    select: { ratios: true }
  });

  const ratios = ratioSettings?.ratios || {};
  const categoryRatio = (ratios[staff.categoryName] || 25) / 100;
  const categoryRequired = Math.ceil(requiredStaff * categoryRatio);

  // 같은 구분 전체 인원
  const totalCategoryStaff = await prisma.staff.count({
    where: {
      clinicId,
      categoryName: staff.categoryName,
      isActive: true
    }
  });

  // 이미 신청한 같은 구분 인원
  const approvedCount = await prisma.leaveApplication.count({
    where: {
      clinicId,
      date: leaveDate,
      status: 'CONFIRMED',
      staff: {
        categoryName: staff.categoryName
      }
    }
  });

  const available = totalCategoryStaff - approvedCount - categoryRequired;

  return {
    allowed: available > 0,
    message: available > 0 ? '신청 가능' : `${staff.categoryName} 구분의 신청 가능 슬롯이 부족합니다.`,
    details: {
      category: staff.categoryName,
      doctorNames,
      requiredStaff,
      categoryRatio: (categoryRatio * 100) + '%',
      categoryRequired,
      totalCategoryStaff,
      approvedCount,
      available
    }
  };
}

async function testDates() {
  console.log('='.repeat(80));
  console.log('11월 화수목 날짜별 신청 가능 여부 테스트');
  console.log('='.repeat(80));

  const testDates = [
    '2025-11-05', // 수
    '2025-11-06', // 목
    '2025-11-12', // 수
    '2025-11-13', // 목
    '2025-11-19', // 수
    '2025-11-20', // 목
    '2025-11-26', // 수
    '2025-11-27', // 목
  ];

  for (const dateStr of testDates) {
    const date = new Date(dateStr);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[date.getDay()];

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📅 ${dateStr} (${dayName}요일)`);
    console.log('-'.repeat(80));

    const result = await checkCategoryRequirement(clinicId, staffId, date, year, month);

    if (result.details) {
      const d = result.details;
      console.log(`원장: [${d.doctorNames.join(', ')}]`);
      console.log(`필요 직원: ${d.requiredStaff}명`);
      console.log(`\n${d.category} 구분:`);
      console.log(`  비율: ${d.categoryRatio}`);
      console.log(`  필요: ${d.categoryRequired}명`);
      console.log(`  전체: ${d.totalCategoryStaff}명`);
      console.log(`  이미 신청: ${d.approvedCount}명`);
      console.log(`  가용 슬롯: ${d.available}개`);
    }

    console.log(`\n결과: ${result.allowed ? '✅ 신청 가능' : '❌ 차단'}`);
    console.log(`사유: ${result.message}`);
  }

  console.log('\n' + '='.repeat(80));
}

async function main() {
  try {
    await testDates();
  } catch (error) {
    console.error('오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
