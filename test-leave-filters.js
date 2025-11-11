/**
 * 연차/오프 신청 필터 테스트
 * 각 제약 조건이 실제로 작동하는지 확인
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const clinicId = 'cmh697itv0001fw83azbrqe60';
const staffId = 'cmh6naxac000s12lynsqel2z3'; // 혜숙
const year = 2025;
const month = 11;

console.log('='.repeat(80));
console.log('연차/오프 신청 필터 테스트');
console.log('='.repeat(80));

async function testWeek4DayConstraint() {
  console.log('\n📋 테스트 1: 주4일 제약 (11월 마지막 주)');
  console.log('-'.repeat(80));

  // 11월 마지막 주: 11/23(일) ~ 11/29(토)
  const weekStart = new Date('2025-11-23');
  const weekEnd = new Date('2025-11-29');

  console.log(`주 범위: ${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]}`);

  // 평일 수 계산 (일요일 제외)
  let totalWeekdays = 0;
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0) {
      totalWeekdays++;
      console.log(`  ${d.toISOString().split('T')[0]} (${['일','월','화','수','목','금','토'][dayOfWeek]})`);
    }
  }
  console.log(`\n총 평일: ${totalWeekdays}일`);

  // 공휴일 확인
  const holidays = await prisma.holiday.findMany({
    where: {
      clinicId,
      date: {
        gte: weekStart,
        lte: weekEnd,
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
        lte: weekEnd,
      },
      leaveType: 'OFF',
      status: {
        in: ['CONFIRMED', 'PENDING']
      }
    },
    select: {
      date: true,
      status: true,
    }
  });

  console.log(`\n기존 OFF 신청: ${existingOffs.length}일`);
  existingOffs.forEach(off => {
    console.log(`  - ${off.date.toISOString().split('T')[0]} [${off.status}]`);
  });

  // 시나리오: 27, 28, 29일 신청하면?
  const testDates = [
    new Date('2025-11-27'),
    new Date('2025-11-28'),
    new Date('2025-11-29'),
  ];

  console.log('\n시나리오: 27(목), 28(금), 29(토) OFF 신청');
  const simulatedOffs = existingOffs.length + testDates.length;
  const workableDays = totalWeekdays - holidays.length - simulatedOffs;

  console.log(`  평일: ${totalWeekdays}일`);
  console.log(`  공휴일: ${holidays.length}일`);
  console.log(`  기존 OFF: ${existingOffs.length}일`);
  console.log(`  신규 OFF: ${testDates.length}일`);
  console.log(`  = 근무 가능일: ${workableDays}일`);
  console.log(`  최소 요구: 4일`);
  console.log(`  결과: ${workableDays >= 4 ? '✅ 통과 (문제!)' : '❌ 차단 (정상)'}`);
}

async function testCategorySlot() {
  console.log('\n\n📋 테스트 2: 구분별 슬롯 (특정 날짜에 모든 고년차가 신청)');
  console.log('-'.repeat(80));

  const testDate = new Date('2025-11-21');
  console.log(`테스트 날짜: ${testDate.toISOString().split('T')[0]}`);

  // 원장 스케줄 확인
  const scheduleDoctors = await prisma.scheduleDoctor.findMany({
    where: {
      date: testDate,
      schedule: {
        clinicId,
        year,
        month,
      }
    },
    include: {
      doctor: {
        select: {
          shortName: true
        }
      }
    },
    orderBy: {
      doctorId: 'asc'
    }
  });

  const doctorNames = scheduleDoctors.map(sd => sd.doctor.shortName).sort();
  console.log(`원장: [${doctorNames.join(', ')}]`);

  // 원장 조합으로 필요 직원 수 찾기
  const doctorCombination = await prisma.doctorCombination.findFirst({
    where: {
      clinicId,
      doctors: { equals: doctorNames }
    }
  });

  if (!doctorCombination) {
    console.log('❌ 원장 조합 설정을 찾을 수 없음');
    return;
  }

  console.log(`필요 직원: ${doctorCombination.requiredStaff}명`);

  // 구분별 비율 조회
  const ratioSettings = await prisma.categoryRatioSettings.findUnique({
    where: { clinicId },
    select: { ratios: true }
  });

  const ratios = ratioSettings?.ratios || {};
  console.log('\n구분별 비율:');
  Object.entries(ratios).forEach(([cat, ratio]) => {
    const required = Math.ceil(doctorCombination.requiredStaff * (ratio / 100));
    console.log(`  ${cat}: ${ratio}% → 필요 ${required}명`);
  });

  // 혜숙의 구분 확인
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { name: true, categoryName: true }
  });

  console.log(`\n테스트 대상: ${staff.name} (${staff.categoryName})`);

  // 같은 구분의 전체 직원 수
  const categoryStaffCount = await prisma.staff.count({
    where: {
      clinicId,
      categoryName: staff.categoryName,
      isActive: true,
    }
  });

  console.log(`${staff.categoryName} 전체 인원: ${categoryStaffCount}명`);

  // 이미 신청한 같은 구분 직원 수
  const approvedFromCategory = await prisma.leaveApplication.count({
    where: {
      clinicId,
      date: testDate,
      status: 'CONFIRMED',
      staff: {
        categoryName: staff.categoryName
      }
    }
  });

  console.log(`이미 신청한 ${staff.categoryName}: ${approvedFromCategory}명`);

  const categoryRatio = (ratios[staff.categoryName] || 25) / 100;
  const required = Math.ceil(doctorCombination.requiredStaff * categoryRatio);
  const available = categoryStaffCount - approvedFromCategory - required;

  console.log(`\n계산:`);
  console.log(`  필요: ${required}명`);
  console.log(`  이미 신청: ${approvedFromCategory}명`);
  console.log(`  가용 슬롯: ${available}개`);
  console.log(`  결과: ${available > 0 ? '✅ 신청 가능' : '❌ 슬롯 부족'}`);
}

async function testFairnessDeviation() {
  console.log('\n\n📋 테스트 3: 형평성 편차 (과도한 신청)');
  console.log('-'.repeat(80));

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      name: true,
      fairnessScoreTotalDays: true,
      departmentName: true,
      categoryName: true,
    }
  });

  console.log(`직원: ${staff.name}`);
  console.log(`누적 편차: ${staff.fairnessScoreTotalDays || 0}일`);

  // 부서 평균 편차
  const departmentStaff = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true,
      departmentName: staff.departmentName,
    },
    select: {
      fairnessScoreTotalDays: true,
    }
  });

  let totalDeviation = 0;
  let staffCount = 0;
  for (const s of departmentStaff) {
    if (s.fairnessScoreTotalDays !== null) {
      totalDeviation += s.fairnessScoreTotalDays;
      staffCount++;
    }
  }

  const avgDeviation = staffCount > 0 ? totalDeviation / staffCount : 0;
  const scoreDifference = (staff.fairnessScoreTotalDays || 0) - avgDeviation;

  console.log(`부서 평균 편차: ${avgDeviation.toFixed(1)}일`);
  console.log(`편차 차이: ${scoreDifference.toFixed(1)}일`);

  // 11월 근무일 수
  let workingDays = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }

  console.log(`\n11월 근무일(평일): ${workingDays}일`);

  // 최대 신청 가능 일수
  const baseAllowance = Math.floor(workingDays * 0.3);
  const fairnessBonus = Math.floor(scoreDifference / 2);
  const maxAllowedDays = Math.max(0, baseAllowance + fairnessBonus);

  console.log(`기본 허용(30%): ${baseAllowance}일`);
  console.log(`형평성 보너스: ${fairnessBonus}일`);
  console.log(`최대 신청 가능: ${maxAllowedDays}일`);

  // 이미 신청한 OFF 수
  const appliedOffs = await prisma.leaveApplication.count({
    where: {
      staffId,
      clinicId,
      status: { in: ['CONFIRMED', 'PENDING'] },
      leaveType: 'OFF',
      date: {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0),
      }
    }
  });

  console.log(`\n이미 신청한 OFF: ${appliedOffs}일`);
  console.log(`남은 신청 가능: ${Math.max(0, maxAllowedDays - appliedOffs)}일`);
  console.log(`결과: ${appliedOffs < maxAllowedDays ? '✅ 신청 가능' : '❌ 한도 초과'}`);

  // 시나리오: 토요일만 모두 신청
  const saturdays = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() === 6) {
      saturdays.push(date.toISOString().split('T')[0]);
    }
  }

  console.log(`\n시나리오: 11월 모든 토요일 신청`);
  console.log(`토요일: ${saturdays.join(', ')}`);
  console.log(`토요일 수: ${saturdays.length}일`);
  console.log(`최대 허용: ${maxAllowedDays}일`);
  console.log(`결과: ${saturdays.length <= maxAllowedDays ? '✅ 가능 (문제!)' : '❌ 차단 (정상)'}`);
}

async function testSaturdayIssue() {
  console.log('\n\n📋 테스트 4: 토요일 신청 문제');
  console.log('-'.repeat(80));

  // 11월 모든 토요일 찾기
  const saturdays = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() === 6) {
      saturdays.push(date);
    }
  }

  console.log(`11월 토요일: ${saturdays.length}일`);
  saturdays.forEach(sat => {
    console.log(`  - ${sat.toISOString().split('T')[0]}`);
  });

  // 첫 번째 토요일에 대한 주4일 체크
  const testSaturday = saturdays[0];
  console.log(`\n테스트: ${testSaturday.toISOString().split('T')[0]} 신청 시`);

  // 해당 주 계산
  const weekStart = new Date(testSaturday);
  const day = weekStart.getDay();
  const diff = day === 0 ? 0 : -day;
  weekStart.setDate(weekStart.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  console.log(`주 범위: ${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]}`);

  // 평일 수
  let totalWeekdays = 0;
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0) {
      totalWeekdays++;
    }
  }

  console.log(`평일 수: ${totalWeekdays}일`);
  console.log(`토요일 OFF 시 근무 가능일: ${totalWeekdays - 1}일`);
  console.log(`최소 요구: 4일`);
  console.log(`결과: ${totalWeekdays - 1 >= 4 ? '✅ 통과' : '❌ 차단'}`);
}

async function main() {
  try {
    await testWeek4DayConstraint();
    await testCategorySlot();
    await testFairnessDeviation();
    await testSaturdayIssue();

    console.log('\n' + '='.repeat(80));
    console.log('테스트 완료');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
