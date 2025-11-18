const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllStaff() {
  try {
    const clinic = await prisma.clinic.findFirst();
    const clinicId = clinic.id;

    const allStaff = await prisma.staff.findMany({
      where: { clinicId },
      select: {
        id: true,
        name: true,
        departmentName: true,
        workType: true,
        workDays: true,
        isActive: true
      },
      orderBy: [
        { departmentName: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log(`Total Staff: ${allStaff.length}\n`);

    // 부서별로 그룹화
    const byDept = new Map();
    allStaff.forEach(s => {
      if (!byDept.has(s.departmentName)) {
        byDept.set(s.departmentName, []);
      }
      byDept.get(s.departmentName).push(s);
    });

    byDept.forEach((staff, dept) => {
      console.log(`\n${dept} (${staff.length}명):`);
      staff.forEach(s => {
        const active = s.isActive ? '✅' : '❌';
        console.log(`  ${active} ${s.name} - workType: ${s.workType}, workDays: ${s.workDays}`);
      });
    });

    // 주4일/주5일 통계
    const week4 = allStaff.filter(s => s.workDays === 4);
    const week5 = allStaff.filter(s => s.workDays === 5);

    console.log(`\n\nSummary:`);
    console.log(`  주4일 직원: ${week4.length}명`);
    console.log(`  주5일 직원: ${week5.length}명`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllStaff();
