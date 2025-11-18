const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== 11월 스케줄 확인 ===');
  const schedule = await prisma.schedule.findFirst({
    where: {
      year: 2025,
      month: 11,
      status: 'DEPLOYED'
    },
    select: {
      id: true,
      status: true,
      deployedAt: true
    }
  });
  
  if (!schedule) {
    console.log('11월 DEPLOYED 스케줄 없음');
    return;
  }
  
  console.log('스케줄 ID:', schedule.id);
  console.log('배포일:', schedule.deployedAt);
  
  console.log('\n=== 11월 StaffAssignment 부서별 분포 ===');
  const assignments = await prisma.staffAssignment.findMany({
    where: {
      scheduleId: schedule.id
    },
    include: {
      staff: {
        select: {
          name: true,
          departmentName: true
        }
      }
    }
  });
  
  console.log('전체 배정:', assignments.length);
  
  const byDept = {};
  assignments.forEach(a => {
    const dept = a.staff.departmentName || '미분류';
    byDept[dept] = (byDept[dept] || 0) + 1;
  });
  
  console.log('\n부서별 배정 수:');
  Object.entries(byDept).forEach(([dept, count]) => {
    console.log(`  ${dept}: ${count}건`);
  });
  
  console.log('\n=== 샘플 배정 데이터 (처음 20개) ===');
  assignments.slice(0, 20).forEach(a => {
    const date = new Date(a.date).toISOString().split('T')[0];
    console.log(`${date} - ${a.staff.name} (${a.staff.departmentName}) - ${a.shiftType}`);
  });
}

main().finally(() => prisma.$disconnect());
