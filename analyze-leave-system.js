/**
 * 연차/오프 신청 시스템 전체 구조 분석
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeSystem() {
  const clinicId = 'cmh697itv0001fw83azbrqe60';

  console.log('='.repeat(80));
  console.log('연차/오프 신청 시스템 전체 구조 분석');
  console.log('='.repeat(80));

  // 1. 데이터 생성 흐름 파악
  console.log('\n📋 1. 데이터 생성 흐름\n');

  console.log('Step 1: 관리자가 스케줄 생성 (마법사)');
  const schedule = await prisma.schedule.findFirst({
    where: { clinicId, year: 2025, month: 11 }
  });
  console.log('  - Schedule:', schedule ? '✅ 있음' : '❌ 없음');

  console.log('\nStep 2-1: 원장 배치 (마법사 1단계)');
  const doctorCount = await prisma.scheduleDoctor.count({
    where: { schedule: { clinicId, year: 2025, month: 11 } }
  });
  console.log('  - ScheduleDoctor:', doctorCount + '개', doctorCount > 0 ? '✅' : '❌');

  console.log('\nStep 2-2: 직원 배치 (마법사 2단계)');
  const staffCount = await prisma.staffAssignment.count({
    where: { schedule: { clinicId, year: 2025, month: 11 } }
  });
  console.log('  - StaffAssignment:', staffCount + '개', staffCount > 0 ? '✅' : '❌');

  console.log('\nStep 3: 연차/오프 슬롯 생성 (마법사 3단계)');
  const weekCount = await prisma.weekInfo.count({
    where: { clinicId, year: 2025, month: 11 }
  });
  const slotCount = await prisma.dailySlot.count({
    where: { week: { clinicId, year: 2025, month: 11 } }
  });
  console.log('  - WeekInfo:', weekCount + '개', weekCount > 0 ? '✅' : '❌');
  console.log('  - DailySlot:', slotCount + '개', slotCount > 0 ? '✅' : '❌');

  console.log('\nStep 4: 연차/오프 신청 링크 생성');
  const link = await prisma.applicationLink.findFirst({
    where: { clinicId, year: 2025, month: 11 }
  });
  console.log('  - ApplicationLink:', link ? '✅ 있음' : '❌ 없음');

  // 2. 현재 상태 파악
  console.log('\n' + '='.repeat(80));
  console.log('📊 2. 현재 11월 데이터 상태\n');

  // 특정 날짜 (11월 21일) 상세 분석
  const targetDate = new Date('2025-11-21');
  console.log(`분석 날짜: ${targetDate.toISOString().split('T')[0]}\n`);

  // ScheduleDoctor
  const doctors = await prisma.scheduleDoctor.findMany({
    where: {
      date: targetDate,
      schedule: { clinicId }
    },
    include: {
      doctor: { select: { name: true } }
    }
  });
  console.log('원장 배치 (ScheduleDoctor):');
  if (doctors.length > 0) {
    doctors.forEach(d => console.log(`  - ${d.doctor.name}`));
    console.log(`  총 ${doctors.length}명 ✅`);
  } else {
    console.log('  ❌ 없음');
  }

  // StaffAssignment
  const staff = await prisma.staffAssignment.findMany({
    where: {
      date: targetDate,
      schedule: { clinicId }
    },
    include: {
      staff: { select: { name: true, categoryName: true } }
    }
  });
  console.log('\n직원 배치 (StaffAssignment):');
  if (staff.length > 0) {
    const byCategory = {};
    staff.forEach(s => {
      const cat = s.staff.categoryName || '기타';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(s.staff.name);
    });
    Object.entries(byCategory).forEach(([cat, names]) => {
      console.log(`  - ${cat}: ${names.length}명`);
    });
    console.log(`  총 ${staff.length}명 ✅`);
  } else {
    console.log('  ❌ 없음');
  }

  // DailySlot
  const slot = await prisma.dailySlot.findFirst({
    where: {
      date: targetDate,
      week: { clinicId }
    }
  });
  console.log('\n슬롯 정보 (DailySlot):');
  if (slot) {
    console.log(`  - 필요 직원 수: ${slot.requiredStaff}명`);
    console.log(`  - 의사 조합: ${JSON.stringify(slot.doctorSchedule)}`);
    console.log(`  ✅`);
  } else {
    console.log('  ❌ 없음');
  }

  // LeaveApplication
  const leaves = await prisma.leaveApplication.findMany({
    where: {
      clinicId,
      date: targetDate
    },
    include: {
      staff: { select: { name: true, categoryName: true } }
    }
  });
  console.log('\n연차/오프 신청 (LeaveApplication):');
  if (leaves.length > 0) {
    leaves.forEach(l => {
      console.log(`  - ${l.staff.name} (${l.staff.categoryName}): ${l.leaveType} [${l.status}]`);
    });
  } else {
    console.log('  없음 (정상)');
  }

  // 3. 시스템 동작 방식 분석
  console.log('\n' + '='.repeat(80));
  console.log('🔍 3. 연차/오프 신청 시스템 동작 방식\n');

  console.log('현재 구현 방식:');
  console.log('  1. DailySlot 기반으로 작동');
  console.log('  2. DailySlot.requiredStaff를 기준으로 슬롯 계산');
  console.log('  3. DailySlot.doctorSchedule로 의사 조합 확인');

  console.log('\n문제점:');
  if (slotCount === 0) {
    console.log('  ❌ DailySlot이 없어서 시스템 작동 불가');
    console.log('  ❌ 마법사 3단계가 실행되지 않음');
  }

  console.log('\n해결 방안:');
  console.log('  방안 1: 마법사 3단계 실행하여 DailySlot 생성 (권장)');
  console.log('  방안 2: ScheduleDoctor 기반으로 시스템 수정');

  if (doctorCount > 0 && staffCount === 0 && slotCount === 0) {
    console.log('\n추천 방안:');
    console.log('  ⭐ 방안 2 추천: ScheduleDoctor는 있지만 StaffAssignment도 없음');
    console.log('  → ScheduleDoctor만으로 필요 직원 수를 계산하는 방식으로 수정');
    console.log('  → calculateCategorySlots는 LeaveApplication만 참조하므로 문제없음');
  }

  // 4. 필요 직원 수 계산 로직 분석
  console.log('\n' + '='.repeat(80));
  console.log('🧮 4. 필요 직원 수 계산 로직\n');

  const ruleSettings = await prisma.ruleSettings.findUnique({
    where: { clinicId },
    select: {
      staffPerDoctor: true,
      staffCategories: true
    }
  });

  if (ruleSettings) {
    console.log('규칙 설정:');
    console.log(`  - 의사 1명당 직원 수: ${ruleSettings.staffPerDoctor || 3}명`);
    console.log(`  - 직원 구분: ${ruleSettings.staffCategories.join(', ')}`);

    if (doctors.length > 0) {
      const requiredStaff = doctors.length * (ruleSettings.staffPerDoctor || 3);
      console.log('\n11월 21일 계산:');
      console.log('  - 원장 수: ' + doctors.length + '명');
      console.log('  - 필요 직원 수: ' + doctors.length + ' x ' + (ruleSettings.staffPerDoctor || 3) + ' = ' + requiredStaff + '명');
    }
  }

  // 5. 카테고리별 비율 설정
  console.log('\n' + '='.repeat(80));
  console.log('📊 5. 카테고리별 비율 설정\n');

  const ratioSettings = await prisma.categoryRatioSettings.findUnique({
    where: { clinicId }
  });

  if (ratioSettings) {
    console.log('비율 설정:');
    console.log('  ', JSON.stringify(ratioSettings.ratios, null, 2));
  } else {
    console.log('비율 설정 없음 → 직원 수 비율로 자동 계산');

    const staffCounts = await prisma.staff.groupBy({
      by: ['categoryName'],
      where: {
        clinicId,
        isActive: true,
        categoryName: { not: null }
      },
      _count: true
    });

    const totalStaff = staffCounts.reduce((sum, c) => sum + c._count, 0);
    console.log('\n직원 수 기반 비율:');
    staffCounts.forEach(c => {
      const ratio = ((c._count / totalStaff) * 100).toFixed(1);
      console.log(`  - ${c.categoryName}: ${c._count}명 (${ratio}%)`);
    });
  }

  await prisma.$disconnect();
}

analyzeSystem().catch(console.error);
