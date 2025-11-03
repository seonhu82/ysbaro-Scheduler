// 자동 배치 테스트 스크립트
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 형평성 계산 함수 간단 버전
async function calculateFairnessScore(staffId, clinicId, year, month, departmentFilter, scheduleId) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // 해당 월의 배정 조회
  const assignments = await prisma.staffAssignment.findMany({
    where: {
      staffId,
      scheduleId,
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  return {
    overallScore: assignments.length, // 단순히 근무일수 반환
    totalDays: assignments.length,
    nightShifts: assignments.filter(a => a.shiftType === 'NIGHT').length
  };
}

async function runAutoAssign() {
  try {
    const year = 2025;
    const month = 10;
    const clinicId = 'cmh697itv0001fw83azbrqe60';

    console.log(`\n🚀 직원 자동 배정 시작: ${year}년 ${month}월\n`);

    // 1. 스케줄 확인
    const schedule = await prisma.schedule.findFirst({
      where: { clinicId, year, month },
      include: {
        doctors: {
          include: { doctor: true },
          orderBy: { date: 'asc' }
        }
      }
    });

    if (!schedule) {
      console.log('❌ 스케줄이 없습니다.');
      return;
    }

    console.log(`   ♻️  기존 스케줄 사용 (ID: ${schedule.id})`);

    // 2. 모든 활성 직원 조회
    const allStaff = await prisma.staff.findMany({
      where: { clinicId, isActive: true }
    });

    console.log(`   👥 활성 직원: ${allStaff.length}명`);

    // 3. 확정된 연차/오프 조회
    const confirmedLeaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        status: 'CONFIRMED',
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0)
        }
      }
    });

    console.log(`   📅 확정된 연차/오프: ${confirmedLeaves.length}건`);

    // 4. 의사 조합 정보 조회
    const combinations = await prisma.doctorCombination.findMany({
      where: { clinicId }
    });

    let totalAssignments = 0;
    const warnings = [];
    const leavesByDate = new Map();

    // 날짜별 연차/오프 직원 맵 생성
    for (const leave of confirmedLeaves) {
      const dateKey = new Date(leave.date).toISOString().split('T')[0];
      if (!leavesByDate.has(dateKey)) {
        leavesByDate.set(dateKey, new Set());
      }
      leavesByDate.get(dateKey).add(leave.staffId);
    }

    // 날짜별로 그룹화
    const dateScheduleMap = new Map();
    for (const doctorSchedule of schedule.doctors) {
      const dateKey = new Date(doctorSchedule.date).toISOString().split('T')[0];
      if (!dateScheduleMap.has(dateKey)) {
        dateScheduleMap.set(dateKey, []);
      }
      dateScheduleMap.get(dateKey).push(doctorSchedule);
    }

    const sortedDates = Array.from(dateScheduleMap.keys()).sort();

    console.log(`\n📆 총 ${sortedDates.length}일 배치 시작 (날짜 순서대로)\n`);

    // 각 날짜를 순서대로 배정
    for (const dateKey of sortedDates) {
      const doctorsOnThisDay = dateScheduleMap.get(dateKey);
      const currentDate = new Date(dateKey + 'T00:00:00.000Z');

      const doctorShortNames = doctorsOnThisDay.map(ds => ds.doctor.shortName).sort();
      const hasNightShift = doctorsOnThisDay.some(ds => ds.hasNightShift);

      // 해당하는 조합 찾기
      const combination = combinations.find(c => {
        const comboDoctors = c.doctors.sort();
        return JSON.stringify(comboDoctors) === JSON.stringify(doctorShortNames) &&
               c.hasNightShift === hasNightShift;
      });

      if (!combination || !combination.requiredStaff) {
        warnings.push(`${dateKey}: 매칭되는 의사 조합을 찾을 수 없습니다`);
        continue;
      }

      const unavailableStaffIds = leavesByDate.get(dateKey) || new Set();

      console.log(`📅 ${dateKey}:`);
      console.log(`   - 원장: ${doctorShortNames.join(', ')}`);
      console.log(`   - 야간진료: ${hasNightShift ? '예' : '아니오'}`);

      // 진료실 직원만 필터링
      const availableTreatmentStaff = allStaff.filter(s =>
        s.departmentName === '진료실' &&
        !unavailableStaffIds.has(s.id)
      );

      console.log(`   - 가용 진료실 직원: ${availableTreatmentStaff.length}명`);

      // 카테고리별 필요 인원 확인
      const departmentCategoryStaff = combination.departmentCategoryStaff;
      let categoryRequirements = {};

      if (departmentCategoryStaff && departmentCategoryStaff['진료실']) {
        const treatmentRoomCategories = departmentCategoryStaff['진료실'];
        for (const [category, config] of Object.entries(treatmentRoomCategories)) {
          if (config && typeof config === 'object' && 'count' in config) {
            categoryRequirements[category] = config.count;
          }
        }
      }

      console.log(`   - 카테고리별 필요 인원:`, categoryRequirements);

      const assignedStaff = [];

      // 카테고리별로 배치
      if (Object.keys(categoryRequirements).length > 0) {
        for (const [category, required] of Object.entries(categoryRequirements)) {
          console.log(`\n   🏷️  ${category} 카테고리 배치 (필요: ${required}명):`);

          // 해당 카테고리의 가용 직원
          const categoryStaff = availableTreatmentStaff.filter(s =>
            s.categoryName === category &&
            !assignedStaff.some(as => as.id === s.id)
          );

          console.log(`      - 가용 ${category} 직원: ${categoryStaff.length}명 (${categoryStaff.map(s => s.name).join(', ')})`);

          // 형평성 점수 계산
          const staffWithScores = await Promise.all(
            categoryStaff.map(async staff => {
              const fairness = await calculateFairnessScore(
                staff.id,
                clinicId,
                year,
                month,
                '진료실',
                schedule.id
              );

              return {
                staff,
                score: fairness.overallScore,
                categoryName: staff.categoryName
              };
            })
          );

          console.log(`      - 형평성 점수: ${staffWithScores.map(s => `${s.staff.name}(${s.score}점)`).join(', ')}`);

          // 형평성 점수 낮은 순 정렬 (랜덤 셔플 포함)
          staffWithScores.sort((a, b) => {
            if (Math.abs(a.score - b.score) < 0.1) {
              return Math.random() - 0.5;
            }
            return a.score - b.score;
          });

          console.log(`      - 정렬 후: ${staffWithScores.map(s => `${s.staff.name}(${s.score}점)`).join(', ')}`);

          // 필요한 만큼 배정
          const toAssignFromCategory = staffWithScores.slice(0, required);

          console.log(`      - ✅ 배정: ${toAssignFromCategory.map(s => `${s.staff.name}(${s.score}점)`).join(', ')}`);

          assignedStaff.push(...toAssignFromCategory.map(s => s.staff));

          if (toAssignFromCategory.length < required) {
            warnings.push(
              `${dateKey}: ${category} 카테고리 인원 부족 (${toAssignFromCategory.length}/${required})`
            );
          }
        }
      }

      // DB에 배정 저장
      for (const staff of assignedStaff) {
        await prisma.staffAssignment.create({
          data: {
            scheduleId: schedule.id,
            staffId: staff.id,
            date: currentDate,
            shiftType: hasNightShift ? 'NIGHT' : 'DAY'
          }
        });
        totalAssignments++;
      }

      console.log(`   ✅ ${dateKey} 배정 완료: 총 ${assignedStaff.length}명\n`);
    }

    console.log(`\n✅ 직원 자동 배정 완료:`);
    console.log(`   - 총 배정: ${totalAssignments}건`);
    console.log(`   - 경고: ${warnings.length}건\n`);

    if (warnings.length > 0) {
      console.log('\n⚠️  경고:');
      warnings.forEach(w => console.log(`  - ${w}`));
    }

  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runAutoAssign();
