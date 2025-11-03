// 더미 직원 삭제
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteDummy() {
  try {
    const result = await prisma.staff.deleteMany({
      where: {
        OR: [
          { name: { startsWith: '위생사' } },
          { name: { startsWith: '간호' } },
          { name: { startsWith: '어시' } }
        ]
      }
    });

    console.log(`삭제된 더미 직원: ${result.count}명`);

    // 남은 진료실 직원 확인
    const remaining = await prisma.staff.findMany({
      where: {
        departmentName: '진료실',
        isActive: true
      },
      select: {
        name: true,
        categoryName: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`\n남은 진료실 활성 직원: ${remaining.length}명`);
    remaining.forEach(s => {
      console.log(`  - ${s.name} (${s.categoryName})`);
    });

  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteDummy();
