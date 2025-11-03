// 10월 전체 필요 인원 확인
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRequirements() {
  try {
    const schedule = await prisma.schedule.findFirst({
      where: { year: 2025, month: 10 }
    });

    if (!schedule) {
      console.log('스케줄 없음');
      return;
    }

    // 전체 배정 조회
    const assignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        shiftType: { not: 'OFF' }
      },
      include: {
        staff: {
          select: {
            name: true,
            categoryName: true
          }
        }
      }
    });

    // 날짜별 그룹화
    const dateMap = new Map();
    for (const a of assignments) {
      const dateKey = new Date(a.date).toISOString().split('T')[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey).push(a);
    }

    console.log('\n=== 10월 필요 인원 분석 ===\n');
    console.log(`총 근무일: ${dateMap.size}일`);
    console.log(`총 배정 건수: ${assignments.length}건`);
    console.log(`일평균 필요 인원: ${(assignments.length / dateMap.size).toFixed(1)}명`);

    // 날짜별 필요 인원
    console.log('\n날짜별 필요 인원:');
    const sortedDates = Array.from(dateMap.keys()).sort();

    const dailyRequirements = [];
    for (const date of sortedDates) {
      const count = dateMap.get(date).length;
      dailyRequirements.push(count);
      console.log(`${date}: ${count}명`);
    }

    console.log(`\n최소: ${Math.min(...dailyRequirements)}명`);
    console.log(`최대: ${Math.max(...dailyRequirements)}명`);

    // 진료실 활성 직원 수
    const treatmentStaff = await prisma.staff.count({
      where: {
        departmentName: '진료실',
        isActive: true
      }
    });

    console.log(`\n진료실 활성 직원: ${treatmentStaff}명`);

    // 만약 모든 날 동일한 인원이 필요하다면
    const avgRequired = assignments.length / dateMap.size;
    const totalWorkDays = assignments.length;
    const idealPerPerson = totalWorkDays / treatmentStaff;

    console.log(`\n=== 이상적인 분배 ===`);
    console.log(`총 근무일 수: ${totalWorkDays}일`);
    console.log(`활성 직원 수: ${treatmentStaff}명`);
    console.log(`1인당 이상적 근무일: ${idealPerPerson.toFixed(1)}일`);

  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRequirements();
