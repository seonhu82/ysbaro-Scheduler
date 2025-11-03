// 직원 카테고리 확인
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const staff = await prisma.staff.findMany({
    where: {
      departmentName: '진료실',
      isActive: true
    },
    select: {
      name: true,
      categoryName: true
    },
    orderBy: {
      categoryName: 'asc'
    }
  });

  console.log('\n진료실 직원 카테고리:');
  staff.forEach(s => {
    console.log(`${s.name}: [${s.categoryName}]`);
  });

  await prisma.$disconnect();
}

check();
