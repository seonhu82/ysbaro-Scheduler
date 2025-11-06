const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugPhase2Issue() {
  try {
    console.log('=== Phase 2 이슈 디버깅 ===\n');

    // 1. 활성 직원 수 확인
    const activeStaff = await prisma.staff.findMany({
      where: {
        isActive: true,
        departmentName: '진료실'
      },
      select: {
        id: true,
        name: true
      }
    });
    console.log(`✅ 진료실 활성 직원: ${activeStaff.length}명`);
    console.log(`   직원 목록: ${activeStaff.map(s => s.name).join(', ')}\n`);

    // 2. 2025년 9월 스케줄 확인
    const schedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 9
      }
    });

    if (!schedule) {
      console.log('❌ 2025년 9월 스케줄 없음');
      return;
    }

    console.log(`✅ 스케줄 ID: ${schedule.id}\n`);

    // 3. 2주차 날짜 범위 계산 (2025-09-08 ~ 2025-09-13)
    const weekStart = new Date('2025-09-08T00:00:00.000Z');
    const weekEnd = new Date('2025-09-13T23:59:59.999Z');

    console.log(`=== 2주차 분석 (2025-09-08 ~ 2025-09-13) ===\n`);

    // 4. 영업일 확인 (원장 스케줄이 있는 날)
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        scheduleId: schedule.id,
        date: {
          gte: weekStart,
          lte: weekEnd
        }
      },
      orderBy: { date: 'asc' }
    });

    console.log(`📅 영업일: ${doctorSchedules.length}일`);
    doctorSchedules.forEach(ds => {
      console.log(`   - ${ds.date.toISOString().split('T')[0]} (야간: ${ds.hasNightShift})`);
    });
    console.log();

    // 5. 각 날짜별 배정 현황
    console.log(`=== 날짜별 배정 현황 ===\n`);
    let totalWorkSlots = 0;
    let totalOffSlots = 0;

    for (const ds of doctorSchedules) {
      const dateKey = ds.date.toISOString().split('T')[0];

      const workAssignments = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id,
          date: ds.date,
          shiftType: { in: ['DAY', 'NIGHT'] }
        }
      });

      const offAssignments = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id,
          date: ds.date,
          shiftType: 'OFF'
        }
      });

      totalWorkSlots += workAssignments;
      totalOffSlots += offAssignments;

      console.log(`${dateKey}: 근무 ${workAssignments}명, OFF ${offAssignments}명 (합계: ${workAssignments + offAssignments}명)`);
    }

    console.log();
    console.log(`📊 2주차 합계:`);
    console.log(`   - 총 근무 슬롯: ${totalWorkSlots}건`);
    console.log(`   - 총 OFF 슬롯: ${totalOffSlots}건`);
    console.log(`   - 전체 슬롯: ${totalWorkSlots + totalOffSlots}건`);
    console.log();

    // 6. 주4일 계산 (목표 OFF)
    const businessDays = doctorSchedules.length;
    const totalStaff = activeStaff.length;
    const maxWeeklyWorkDays = 4;

    const totalSlots = totalStaff * businessDays;
    const targetOff = totalStaff * (businessDays - maxWeeklyWorkDays);

    console.log(`📐 목표 계산:`);
    console.log(`   - 직원 수: ${totalStaff}명`);
    console.log(`   - 영업일: ${businessDays}일`);
    console.log(`   - 주 근무일: ${maxWeeklyWorkDays}일`);
    console.log(`   - 목표 OFF: ${totalStaff} × (${businessDays} - ${maxWeeklyWorkDays}) = ${targetOff}개`);
    console.log();

    // 7. 각 직원별 2주차 근무일 수 확인
    console.log(`=== 직원별 근무일 수 ===\n`);

    const staffWorkDays = [];
    for (const staff of activeStaff) {
      const workCount = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id,
          staffId: staff.id,
          date: {
            gte: weekStart,
            lte: weekEnd
          },
          shiftType: { in: ['DAY', 'NIGHT'] }
        }
      });

      staffWorkDays.push({ name: staff.name, days: workCount });
    }

    // 근무일 수로 정렬
    staffWorkDays.sort((a, b) => a.days - b.days);

    staffWorkDays.forEach(s => {
      const status = s.days < 4 ? '⚠️ 미달' : s.days === 4 ? '✅' : '⚠️ 초과';
      console.log(`   ${status} ${s.name}: ${s.days}일`);
    });

    console.log();
    const below4 = staffWorkDays.filter(s => s.days < 4).length;
    const equal4 = staffWorkDays.filter(s => s.days === 4).length;
    const above4 = staffWorkDays.filter(s => s.days > 4).length;

    console.log(`📊 요약:`);
    console.log(`   - 주4일 미달: ${below4}명`);
    console.log(`   - 주4일 정확: ${equal4}명`);
    console.log(`   - 주4일 초과: ${above4}명`);
    console.log();

    // 8. 차이 분석
    console.log(`=== 분석 결과 ===\n`);
    console.log(`목표 OFF: ${targetOff}개`);
    console.log(`실제 OFF: ${totalOffSlots}개`);
    console.log(`차이: ${totalOffSlots - targetOff}개 ${totalOffSlots > targetOff ? '초과' : '부족'}`);
    console.log();

    if (below4 === 0 && totalOffSlots > targetOff) {
      console.log(`❌ 문제 발견:`);
      console.log(`   - 미달 직원이 0명인데 OFF가 ${totalOffSlots - targetOff}개 초과`);
      console.log(`   - 이는 Phase 2 로직으로 해결 불가능한 상태`);
      console.log();
      console.log(`🔍 가능한 원인:`);
      console.log(`   1. 1차 배치에서 주4일 제한 때문에 배정하지 못한 날짜가 있음`);
      console.log(`   2. calculateWeeklyWorkDays 함수의 카운팅 오류`);
      console.log(`   3. dailyAssignments 추적 누락`);
    }

  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPhase2Issue();
