const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkClinicsAndStaff() {
  try {
    // 모든 클리닉 조회
    const clinics = await prisma.clinic.findMany({
      select: {
        id: true,
        name: true
      }
    });

    console.log(`Total Clinics: ${clinics.length}\n`);

    for (const clinic of clinics) {
      console.log(`\n=== Clinic: ${clinic.name} (${clinic.id}) ===`);

      const staffCount = await prisma.staff.count({
        where: { clinicId: clinic.id }
      });

      console.log(`Staff Count: ${staffCount}`);

      if (staffCount > 0) {
        const staff = await prisma.staff.findMany({
          where: { clinicId: clinic.id },
          select: {
            name: true,
            departmentName: true,
            workDays: true,
            isActive: true
          },
          orderBy: [
            { departmentName: 'asc' },
            { name: 'asc' }
          ]
        });

        const byDept = new Map();
        staff.forEach(s => {
          if (!byDept.has(s.departmentName)) {
            byDept.set(s.departmentName, []);
          }
          byDept.get(s.departmentName).push(s);
        });

        byDept.forEach((staffList, dept) => {
          console.log(`\n  ${dept} (${staffList.length}명):`);
          staffList.forEach(s => {
            const active = s.isActive ? '✅' : '❌';
            console.log(`    ${active} ${s.name} (workDays: ${s.workDays})`);
          });
        });
      }
    }

    // 11월 스케줄 확인
    console.log(`\n\n=== November 2025 Schedules ===`);
    const novSchedules = await prisma.schedule.findMany({
      where: {
        year: 2025,
        month: 11
      },
      include: {
        clinic: {
          select: { name: true }
        }
      }
    });

    console.log(`Total Nov 2025 Schedules: ${novSchedules.length}\n`);
    novSchedules.forEach(s => {
      console.log(`  Clinic: ${s.clinic.name}`);
      console.log(`  Schedule ID: ${s.id}`);
      console.log(`  Status: ${s.status}`);
      console.log();
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkClinicsAndStaff();
