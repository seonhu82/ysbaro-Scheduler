const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUpdatedFairness() {
  try {
    // 0이 아닌 fairnessScoreTotalDays를 가진 직원 조회
    const staffWithScores = await prisma.staff.findMany({
      where: {
        isActive: true,
        departmentName: '진료실',
        fairnessScoreTotalDays: { not: 0 }
      },
      select: {
        name: true,
        categoryName: true,
        fairnessScoreTotalDays: true,
        fairnessScoreNight: true,
        fairnessScoreWeekend: true,
        fairnessScoreHoliday: true,
        fairnessScoreHolidayAdjacent: true
      },
      orderBy: {
        categoryName: 'asc'
      }
    });

    console.log('\n📊 업데이트된 진료실 직원들의 형평성 점수:');
    console.log('='.repeat(120));

    if (staffWithScores.length === 0) {
      console.log('❌ 0이 아닌 형평성 점수를 가진 직원이 없습니다!');
    } else {
      staffWithScores.forEach(s => {
        console.log(`\n${s.name} (${s.categoryName})`);
        console.log(`  Total: ${s.fairnessScoreTotalDays.toFixed(2)} | Night: ${s.fairnessScoreNight.toFixed(2)} | Weekend: ${s.fairnessScoreWeekend.toFixed(2)} | Holiday: ${s.fairnessScoreHoliday.toFixed(2)} | HolidayAdj: ${s.fairnessScoreHolidayAdjacent.toFixed(2)}`);
      });

      console.log(`\n\n✅ 총 ${staffWithScores.length}명의 직원이 업데이트되었습니다!`);
    }

  } catch (error) {
    console.error('❌ 에러 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUpdatedFairness();
