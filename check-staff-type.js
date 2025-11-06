const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const staff = await prisma.staff.findMany({
    where: {
      isActive: true,
      departmentName: '진료실'
    },
    select: {
      name: true,
      workType: true
    }
  });

  console.log(`진료실 전체: ${staff.length}명`);
  const fullTime = staff.filter(s => s.workType === 'FULL_TIME');
  const partTime = staff.filter(s => s.workType === 'PART_TIME');
  console.log(`FULL_TIME: ${fullTime.length}명`);
  console.log(`PART_TIME: ${partTime.length}명`);

  console.log('\nPART_TIME 직원:');
  partTime.forEach(s => console.log(`  - ${s.name}`));

  await prisma.$disconnect();
})();
