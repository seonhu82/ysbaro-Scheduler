const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulateMonthlyViewAPI(departmentType) {
  const clinicId = 'cmh697itv0001fw83azbrqe60';
  const year = 2025;
  const month = 11;
  const scheduleStatus = 'DEPLOYED';
  
  console.log('\n=== Simulating API: departmentType =', departmentType, '===');
  
  // 부서 필터링 (monthly-view API 로직과 동일)
  let departmentNames = undefined;
  if (departmentType === 'auto' || departmentType === 'manual') {
    const departments = await prisma.department.findMany({
      where: {
        clinicId,
        useAutoAssignment: departmentType === 'auto'
      },
      select: { name: true }
    });
    departmentNames = departments.map(d => d.name);
  }
  
  console.log('필터링할 부서:', departmentNames || '전체');
  
  // 현재 월 스케줄 조회
  const schedule = await prisma.schedule.findFirst({
    where: {
      clinicId,
      year,
      month,
      status: scheduleStatus
    },
    include: {
      staffAssignments: {
        include: {
          staff: {
            select: {
              name: true,
              departmentName: true
            }
          }
        },
        where: departmentNames ? {
          staff: {
            departmentName: { in: departmentNames }
          }
        } : undefined
      }
    }
  });
  
  if (!schedule) {
    console.log('스케줄 없음');
    return;
  }
  
  console.log('조회된 StaffAssignment:', schedule.staffAssignments.length, '건');
  
  // 부서별 분포
  const byDept = {};
  schedule.staffAssignments.forEach(a => {
    const dept = a.staff.departmentName || '미분류';
    byDept[dept] = (byDept[dept] || 0) + 1;
  });
  
  console.log('부서별 분포:');
  Object.entries(byDept).forEach(([dept, count]) => {
    console.log('  -', dept, ':', count, '건');
  });
  
  // 샘플 데이터
  console.log('\n샘플 (처음 5개):');
  schedule.staffAssignments.slice(0, 5).forEach(a => {
    const date = new Date(a.date).toISOString().split('T')[0];
    console.log('  -', date, a.staff.name, '(' + a.staff.departmentName + ')', a.shiftType);
  });
}

async function main() {
  console.log('=== API 호출 시뮬레이션 ===');
  
  await simulateMonthlyViewAPI('auto');
  await simulateMonthlyViewAPI('manual');
  await simulateMonthlyViewAPI(null);
}

main().finally(() => prisma.$disconnect());
