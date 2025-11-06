const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugExactIssue() {
  try {
    // 로그에서 문제 발생한 주차: 2025-09-08 ~ 2025-09-13 (2주차)
    const weekStart = new Date('2025-09-08T00:00:00.000Z');
    const weekEnd = new Date('2025-09-13T23:59:59.999Z');

    const schedule = await prisma.schedule.findFirst({
      where: { year: 2025, month: 9 }
    });

    console.log('=== 사실 확인 ===\n');

    // 1. 해당 주의 고유 날짜 (중복 제거)
    const allDates = await prisma.scheduleDoctor.findMany({
      where: {
        scheduleId: schedule.id,
        date: { gte: weekStart, lte: weekEnd }
      },
      select: { date: true }
    });

    const uniqueDates = [...new Set(allDates.map(d => d.date.toISOString().split('T')[0]))].sort();
    console.log(`1. 이 주의 고유 영업일 수: ${uniqueDates.length}일`);
    uniqueDates.forEach(d => console.log(`   - ${d}`));
    console.log();

    // 2. 자동 배치 대상 직원 수 (진료실만)
    const autoStaff = await prisma.staff.count({
      where: {
        isActive: true,
        departmentName: '진료실'
      }
    });
    console.log(`2. 자동 배치 대상 직원 수: ${autoStaff}명\n`);

    // 3. 각 날짜의 실제 배정 수
    console.log('3. 각 날짜의 배정 현황:');
    let totalWork = 0;
    let totalOff = 0;
    for (const dateStr of uniqueDates) {
      const date = new Date(dateStr + 'T00:00:00.000Z');

      const workCount = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id,
          date: date,
          shiftType: { in: ['DAY', 'NIGHT'] }
        }
      });

      const offCount = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id,
          date: date,
          shiftType: 'OFF'
        }
      });

      totalWork += workCount;
      totalOff += offCount;

      console.log(`   ${dateStr}: 근무 ${workCount}, OFF ${offCount}, 합계 ${workCount + offCount}`);
    }
    console.log();
    console.log(`   총 근무: ${totalWork}건`);
    console.log(`   총 OFF: ${totalOff}건`);
    console.log(`   전체: ${totalWork + totalOff}건`);
    console.log();

    // 4. Phase 2 목표 계산 (코드 그대로)
    const businessDays = uniqueDates.length;
    const maxWeeklyWorkDays = 4;
    const targetOffCount = autoStaff * (businessDays - maxWeeklyWorkDays);

    console.log(`4. Phase 2 목표 OFF 계산:`);
    console.log(`   ${autoStaff}명 × (${businessDays}일 - ${maxWeeklyWorkDays}일) = ${targetOffCount}개\n`);

    // 5. 차이
    const diff = totalOff - targetOffCount;
    console.log(`5. 실제 OFF vs 목표 OFF:`);
    console.log(`   실제: ${totalOff}개`);
    console.log(`   목표: ${targetOffCount}개`);
    console.log(`   차이: ${diff > 0 ? '+' : ''}${diff}개 (${diff > 0 ? 'OFF 초과' : 'OFF 부족'})\n`);

    // 6. 각 직원의 이 주 근무일 수
    const staff = await prisma.staff.findMany({
      where: {
        isActive: true,
        departmentName: '진료실'
      },
      select: { id: true, name: true }
    });

    console.log('6. 직원별 근무일 수:');
    const workCounts = [];
    for (const s of staff) {
      const count = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id,
          staffId: s.id,
          date: { gte: weekStart, lte: weekEnd },
          shiftType: { in: ['DAY', 'NIGHT'] }
        }
      });
      workCounts.push({ name: s.name, count });
    }

    workCounts.sort((a, b) => a.count - b.count);

    const below4 = workCounts.filter(w => w.count < 4);
    const equal4 = workCounts.filter(w => w.count === 4);
    const above4 = workCounts.filter(w => w.count > 4);

    console.log(`   주4일 미달: ${below4.length}명`);
    if (below4.length > 0 && below4.length <= 10) {
      below4.forEach(w => console.log(`      - ${w.name}: ${w.count}일`));
    }
    console.log(`   주4일 정확: ${equal4.length}명`);
    console.log(`   주4일 초과: ${above4.length}명`);
    console.log();

    // 7. 사실 정리
    console.log('=== 사실 정리 ===');
    console.log(`✓ 영업일: ${businessDays}일`);
    console.log(`✓ 직원: ${autoStaff}명`);
    console.log(`✓ 목표 OFF: ${targetOffCount}개`);
    console.log(`✓ 실제 OFF: ${totalOff}개`);
    console.log(`✓ 차이: ${diff > 0 ? '+' : ''}${diff}개`);
    console.log(`✓ 미달 직원(주4일 미만): ${below4.length}명`);
    console.log(`✓ 초과 직원(주4일 초과): ${above4.length}명`);

  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugExactIssue();
