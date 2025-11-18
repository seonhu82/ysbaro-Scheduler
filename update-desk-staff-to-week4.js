const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateDeskStaffToWeek4() {
  try {
    console.log('=== Update Desk Staff to WEEK_4 ===\n');

    // 연세바로치과 동탄점 클리닉 ID
    const clinicId = 'cmh697itv0001fw83azbrqe60';

    // 데스크 직원 조회
    const deskStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        departmentName: '데스크'
      },
      select: {
        id: true,
        name: true,
        workType: true,
        workDays: true
      }
    });

    console.log(`Found ${deskStaff.length} desk staff\n`);

    if (deskStaff.length === 0) {
      console.log('No desk staff found!');
      return;
    }

    // 현재 상태 출력
    console.log('Current Status:');
    deskStaff.forEach(s => {
      console.log(`  ${s.name}: workType=${s.workType}, workDays=${s.workDays}`);
    });

    // 업데이트
    console.log(`\nUpdating to WEEK_4 (workDays: 4)...\n`);

    for (const staff of deskStaff) {
      await prisma.staff.update({
        where: { id: staff.id },
        data: {
          workType: 'WEEK_4',
          workDays: 4
        }
      });
      console.log(`  ✅ ${staff.name} updated`);
    }

    console.log(`\n✅ All desk staff updated to WEEK_4 (4 days/week)`);

    // 검증
    console.log(`\nVerification:`);
    const updated = await prisma.staff.findMany({
      where: {
        clinicId,
        departmentName: '데스크'
      },
      select: {
        name: true,
        workType: true,
        workDays: true
      }
    });

    updated.forEach(s => {
      const check = s.workType === 'WEEK_4' && s.workDays === 4 ? '✅' : '❌';
      console.log(`  ${check} ${s.name}: workType=${s.workType}, workDays=${s.workDays}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateDeskStaffToWeek4();
