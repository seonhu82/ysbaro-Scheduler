const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateAllStaffToWeek4() {
  try {
    console.log('=== Update All Staff to WEEK_4 ===\n');

    // 연세바로치과 동탄점 클리닉 ID
    const clinicId = 'cmh697itv0001fw83azbrqe60';

    // 모든 활성 직원 조회
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        departmentName: true,
        workType: true,
        workDays: true
      },
      orderBy: [
        { departmentName: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log(`Found ${allStaff.length} active staff\n`);

    // 부서별 그룹화
    const byDept = new Map();
    allStaff.forEach(s => {
      if (!byDept.has(s.departmentName)) {
        byDept.set(s.departmentName, []);
      }
      byDept.get(s.departmentName).push(s);
    });

    // 현재 상태 출력
    console.log('Current Status:');
    byDept.forEach((staff, dept) => {
      console.log(`\n${dept} (${staff.length}명):`);
      staff.forEach(s => {
        console.log(`  ${s.name}: workType=${s.workType}, workDays=${s.workDays}`);
      });
    });

    // 업데이트
    console.log(`\n\nUpdating all staff to WEEK_4 (workDays: 4)...\n`);

    let updateCount = 0;
    for (const staff of allStaff) {
      await prisma.staff.update({
        where: { id: staff.id },
        data: {
          workType: 'WEEK_4',
          workDays: 4
        }
      });
      console.log(`  ✅ ${staff.departmentName} - ${staff.name} updated`);
      updateCount++;
    }

    console.log(`\n✅ Total ${updateCount} staff updated to WEEK_4 (4 days/week)`);

    // 검증
    console.log(`\n\nVerification:`);
    const updated = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true
      },
      select: {
        name: true,
        departmentName: true,
        workType: true,
        workDays: true
      },
      orderBy: [
        { departmentName: 'asc' },
        { name: 'asc' }
      ]
    });

    const byDeptUpdated = new Map();
    updated.forEach(s => {
      if (!byDeptUpdated.has(s.departmentName)) {
        byDeptUpdated.set(s.departmentName, []);
      }
      byDeptUpdated.get(s.departmentName).push(s);
    });

    byDeptUpdated.forEach((staff, dept) => {
      console.log(`\n${dept} (${staff.length}명):`);
      staff.forEach(s => {
        const check = s.workType === 'WEEK_4' && s.workDays === 4 ? '✅' : '❌';
        console.log(`  ${check} ${s.name}: workType=${s.workType}, workDays=${s.workDays}`);
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAllStaffToWeek4();
