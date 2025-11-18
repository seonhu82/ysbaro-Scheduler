const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCorrect() {
  const clinicId = 'cmh697itv0001fw83azbrqe60'; // 동탄점
  
  console.log('=== Clinic:', clinicId, '===\n');
  
  // 1. Department 확인
  console.log('1. Department 목록:');
  const depts = await prisma.department.findMany({
    where: { clinicId }
  });
  console.log('전체 부서:', depts.length, '개');
  depts.forEach(d => {
    console.log('-', d.name, ': useAutoAssignment =', d.useAutoAssignment);
  });
  
  const autoDepts = depts.filter(d => d.useAutoAssignment).map(d => d.name);
  const manualDepts = depts.filter(d => !d.useAutoAssignment).map(d => d.name);
  
  console.log('\n자동배치 부서:', autoDepts);
  console.log('수동배치 부서:', manualDepts);
  
  // 2. Schedule 확인
  console.log('\n2. 11월 스케줄:');
  const schedule = await prisma.schedule.findFirst({
    where: {
      clinicId,
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
  
  // 3. StaffAssignment 카운트
  console.log('\n3. StaffAssignment 카운트:');
  const totalCount = await prisma.staffAssignment.count({
    where: { scheduleId: schedule.id }
  });
  console.log('전체:', totalCount, '건');
  
  if (autoDepts.length > 0) {
    const autoCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        staff: {
          departmentName: { in: autoDepts }
        }
      }
    });
    console.log('자동배치 부서:', autoCount, '건');
  }
  
  if (manualDepts.length > 0) {
    const manualCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        staff: {
          departmentName: { in: manualDepts }
        }
      }
    });
    console.log('수동배치 부서:', manualCount, '건');
  }
  
  // 4. 샘플 데이터
  console.log('\n4. 샘플 배정 (각 부서별 5개):');
  
  for (const deptName of [...autoDepts, ...manualDepts]) {
    const samples = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        staff: {
          departmentName: deptName
        }
      },
      include: {
        staff: {
          select: { name: true, departmentName: true }
        }
      },
      take: 5
    });
    
    console.log('\n', deptName, '부서:');
    samples.forEach(s => {
      const date = new Date(s.date).toISOString().split('T')[0];
      console.log('  -', date, s.staff.name, s.shiftType);
    });
  }
}

testCorrect().finally(() => prisma.$disconnect());
