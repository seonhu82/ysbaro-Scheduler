// 유연 근무 가능 직원 확인
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFlexible() {
  try {
    const staff = await prisma.staff.findMany({
      where: {
        departmentName: '진료실',
        isActive: true
      },
      select: {
        name: true,
        categoryName: true,
        flexibleForCategories: true,
        flexibilityPriority: true
      },
      orderBy: {
        categoryName: 'asc'
      }
    });

    console.log('\n=== 진료실 직원 유연 근무 설정 ===\n');

    const byCategory = {};
    for (const s of staff) {
      if (!byCategory[s.categoryName]) {
        byCategory[s.categoryName] = [];
      }
      byCategory[s.categoryName].push(s);
    }

    for (const [category, staffList] of Object.entries(byCategory)) {
      console.log(`\n${category} (${staffList.length}명):`);
      for (const s of staffList) {
        const flexible = s.flexibleForCategories.length > 0
          ? `✅ ${s.flexibleForCategories.join(', ')} (우선순위: ${s.flexibilityPriority})`
          : '❌ 유연 근무 불가';
        console.log(`  ${s.name}: ${flexible}`);
      }
    }

    // 통계
    const flexibleCount = staff.filter(s => s.flexibleForCategories.length > 0).length;
    console.log(`\n총 ${staff.length}명 중 ${flexibleCount}명이 유연 근무 가능`);

  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFlexible();
