const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateOctoberFairness() {
  try {
    console.log('\n🔄 2025년 10월 형평성 점수 업데이트 시작...\n');

    // 1. 10월 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 10,
        status: { in: ['CONFIRMED', 'DEPLOYED'] }
      },
      include: {
        doctors: {
          include: { doctor: true }
        }
      }
    });

    if (!schedule) {
      console.log('❌ 2025년 10월 스케줄을 찾을 수 없습니다.');
      return;
    }

    console.log(`✅ 스케줄 발견: ${schedule.id} (${schedule.status})`);

    // 2. 날짜 범위 계산
    const startDate = new Date(2025, 9, 1); // 10월 1일
    const endDate = new Date(2025, 9, 31); // 10월 31일

    // 3. 공휴일 조회
    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId: schedule.clinicId,
        date: { gte: startDate, lte: endDate }
      }
    });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    console.log(`📅 공휴일: ${holidayDates.size}개`);

    // 4. 진료실 직원 조회
    const staff = await prisma.staff.findMany({
      where: {
        clinicId: schedule.clinicId,
        isActive: true,
        departmentName: '진료실'
      }
    });

    console.log(`👥 진료실 직원: ${staff.length}명\n`);

    const totalStaff = staff.length;

    // 5. 각 직원의 10월 근무 통계 계산
    for (const s of staff) {
      const assignments = await prisma.staffAssignment.findMany({
        where: {
          staffId: s.id,
          scheduleId: schedule.id,
          date: { gte: startDate, lte: endDate },
          shiftType: { not: 'OFF' }
        }
      });

      let totalDays = 0;
      let nightDays = 0;
      let weekendDays = 0;
      let holidayDays = 0;
      let holidayAdjacentDays = 0;

      for (const a of assignments) {
        const dateKey = a.date.toISOString().split('T')[0];
        const dayOfWeek = a.date.getDay();

        totalDays++;

        if (a.shiftType === 'NIGHT') nightDays++;
        if (dayOfWeek === 6) weekendDays++; // 토요일
        if (holidayDates.has(dateKey)) holidayDays++;

        // 공휴일 전후
        const yesterday = new Date(a.date);
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date(a.date);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isHolidayAdjacent = !holidayDates.has(dateKey) && (
          holidayDates.has(yesterday.toISOString().split('T')[0]) ||
          holidayDates.has(tomorrow.toISOString().split('T')[0])
        );
        if (isHolidayAdjacent) holidayAdjacentDays++;
      }

      // 6. 전체 배치된 슬롯 수 계산
      const totalAssignments = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id,
          date: { gte: startDate, lte: endDate },
          shiftType: { not: 'OFF' }
        }
      });

      const nightAssignments = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id,
          date: { gte: startDate, lte: endDate },
          shiftType: 'NIGHT'
        }
      });

      const weekendAssignments = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id,
          date: { gte: startDate, lte: endDate },
          shiftType: { not: 'OFF' }
        }
      });

      // 주말만 카운트
      const allWeekendAssignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          date: { gte: startDate, lte: endDate },
          shiftType: { not: 'OFF' }
        },
        select: { date: true }
      });
      const actualWeekendCount = allWeekendAssignments.filter(a => a.date.getDay() === 6).length;

      // 공휴일만 카운트
      const actualHolidayCount = allWeekendAssignments.filter(a => holidayDates.has(a.date.toISOString().split('T')[0])).length;

      // 7. 기준값 계산 (전체 슬롯 / 전체 인원)
      const baselineTotal = totalAssignments / totalStaff;
      const baselineNight = nightAssignments / totalStaff;
      const baselineWeekend = actualWeekendCount / totalStaff;
      const baselineHoliday = actualHolidayCount / totalStaff;

      // 8. 편차 계산 (기준 - 실제)
      const deviationTotal = baselineTotal - totalDays;
      const deviationNight = baselineNight - nightDays;
      const deviationWeekend = baselineWeekend - weekendDays;
      const deviationHoliday = baselineHoliday - holidayDays;
      const deviationHolidayAdjacent = 0 - holidayAdjacentDays; // 공휴일전후는 기준이 0

      // 9. Staff 테이블 업데이트
      await prisma.staff.update({
        where: { id: s.id },
        data: {
          fairnessScoreTotalDays: deviationTotal,
          fairnessScoreNight: deviationNight,
          fairnessScoreWeekend: deviationWeekend,
          fairnessScoreHoliday: deviationHoliday,
          fairnessScoreHolidayAdjacent: deviationHolidayAdjacent
        }
      });

      console.log(`✅ ${s.name}: Total=${deviationTotal.toFixed(2)}, Night=${deviationNight.toFixed(2)}, Weekend=${deviationWeekend.toFixed(2)}, Holiday=${deviationHoliday.toFixed(2)}`);
    }

    console.log('\n✅ 형평성 점수 업데이트 완료!\n');

  } catch (error) {
    console.error('❌ 에러 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateOctoberFairness();
