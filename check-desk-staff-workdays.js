const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDeskStaffWorkDays() {
  try {
    console.log('=== Desk Staff WorkDays Check ===\n');

    const clinic = await prisma.clinic.findFirst();
    const clinicId = clinic.id;

    // 데스크 부서 직원 조회
    const deskStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        departmentName: '데스크'
      },
      select: {
        id: true,
        name: true,
        workType: true,
        workDays: true,
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`Total Desk Staff: ${deskStaff.length}\n`);

    if (deskStaff.length === 0) {
      console.log('❌ No desk staff found!');
      console.log('   Desk staff might have been deleted.');
      return;
    }

    deskStaff.forEach(s => {
      const active = s.isActive ? '✅' : '❌';
      console.log(`${active} ${s.name}`);
      console.log(`   workType: ${s.workType}`);
      console.log(`   workDays: ${s.workDays}`);
      console.log();
    });

    // 주5일 직원 카운트
    const week5Staff = deskStaff.filter(s => s.workDays === 5);
    const week4Staff = deskStaff.filter(s => s.workDays === 4);

    console.log(`Summary:`);
    console.log(`  주5일 직원: ${week5Staff.length}명`);
    console.log(`  주4일 직원: ${week4Staff.length}명`);

    if (week5Staff.length > 0) {
      console.log(`\n⚠️ 주5일로 설정된 직원이 있습니다:`);
      week5Staff.forEach(s => {
        console.log(`   - ${s.name} (workType: ${s.workType}, workDays: ${s.workDays})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDeskStaffWorkDays();
