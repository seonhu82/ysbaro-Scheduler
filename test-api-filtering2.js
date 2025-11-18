const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testFiltering() {
  const clinic = await prisma.clinic.findFirst();
  const clinicId = clinic.id;
  const year = 2025;
  const month = 11;
  
  console.log('=== API 필터링 테스트 ===\n');
  
  // 1. 자동배치 부서 조회
  console.log('1. departmentType=auto 필터링:');
  const autoDepts = await prisma.department.findMany({
    where: {
      clinicId,
      useAutoAssignment: true
    },
    select: { name: true }
  });
  const autoDeptNames = autoDepts.map(d => d.name);
  console.log('  자동배치 부서:', autoDeptNames);
  
  // 2. 수동배치 부서 조회
  console.log('\n2. departmentType=manual 필터링:');
  const manualDepts = await prisma.department.findMany({
    where: {
      clinicId,
      useAutoAssignment: false
    },
    select: { name: true }
  });
  const manualDeptNames = manualDepts.map(d => d.name);
  console.log('  수동배치 부서:', manualDeptNames);
  
  // 3. 전체 배정 수 확인
  console.log('\n3. 전체 배정 수:');
  const allCount = await prisma.staffAssignment.count({
    where: {
      schedule: {
        clinicId,
        year,
        month,
        status: 'DEPLOYED'
      }
    }
  });
  console.log('  전체:', allCount, '건');
  
  const autoCount = await prisma.staffAssignment.count({
    where: {
      schedule: {
        clinicId,
        year,
        month,
        status: 'DEPLOYED'
      },
      staff: {
        departmentName: { in: autoDeptNames }
      }
    }
  });
  console.log('  자동배치:', autoCount, '건');
  
  const manualCount = await prisma.staffAssignment.count({
    where: {
      schedule: {
        clinicId,
        year,
        month,
        status: 'DEPLOYED'
      },
      staff: {
        departmentName: { in: manualDeptNames }
      }
    }
  });
  console.log('  수동배치:', manualCount, '건');
  
  console.log('\n합계 검증:', autoCount, '+', manualCount, '=', autoCount + manualCount, '(전체:', allCount + ')');
  
  if (autoCount + manualCount === allCount) {
    console.log('✅ 필터링 로직 정상');
  } else {
    console.log('⚠️ 필터링 로직에 문제가 있을 수 있음');
  }
}

testFiltering().finally(() => prisma.$disconnect());
