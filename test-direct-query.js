const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDirect() {
  console.log('=== 직접 쿼리 테스트 ===\n');
  
  // 1. 전체 Clinic 확인
  const clinics = await prisma.clinic.findMany({
    select: { id: true, name: true }
  });
  console.log('Clinic 목록:', clinics);
  
  if (clinics.length === 0) {
    console.log('⚠️ Clinic 데이터가 없습니다!');
    return;
  }
  
  const clinicId = clinics[0].id;
  console.log('\n사용할 Clinic ID:', clinicId);
  
  // 2. Department 확인
  console.log('\n=== Department 목록 ===');
  const depts = await prisma.department.findMany({
    where: { clinicId }
  });
  console.log('전체 부서:', depts.length, '개');
  depts.forEach(d => {
    console.log('-', d.name, ':', 'useAutoAssignment =', d.useAutoAssignment);
  });
  
  // 3. Schedule 확인
  console.log('\n=== Schedule 목록 (2025년 11월) ===');
  const schedules = await prisma.schedule.findMany({
    where: {
      clinicId,
      year: 2025,
      month: 11
    },
    select: {
      id: true,
      status: true,
      deployedAt: true,
      _count: {
        select: {
          staffAssignments: true
        }
      }
    }
  });
  
  console.log('스케줄 수:', schedules.length);
  schedules.forEach(s => {
    console.log('-', s.id, ':', s.status, '배정:', s._count.staffAssignments, '건');
  });
}

testDirect().finally(() => prisma.$disconnect());
