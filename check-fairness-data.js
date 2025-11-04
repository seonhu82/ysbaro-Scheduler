const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFairnessData() {
  try {
    // 1. Staff 테이블에서 형평성 점수 확인
    const staff = await prisma.staff.findMany({
      where: {
        isActive: true,
        departmentName: '진료실'
      },
      select: {
        id: true,
        name: true,
        categoryName: true,
        fairnessScoreTotalDays: true,
        fairnessScoreNight: true,
        fairnessScoreWeekend: true,
        fairnessScoreHoliday: true,
        fairnessScoreHolidayAdjacent: true
      }
    });

    console.log('\n📊 Staff 테이블의 형평성 점수 (처음 5명):');
    console.log('='.repeat(100));
    staff.slice(0, 5).forEach(s => {
      console.log(`\n직원: ${s.name} (${s.categoryName})`);
      console.log(`  - Total Days: ${s.fairnessScoreTotalDays}`);
      console.log(`  - Night: ${s.fairnessScoreNight}`);
      console.log(`  - Weekend: ${s.fairnessScoreWeekend}`);
      console.log(`  - Holiday: ${s.fairnessScoreHoliday}`);
      console.log(`  - Holiday Adjacent: ${s.fairnessScoreHolidayAdjacent}`);
    });

    // 0이 아닌 값이 있는지 확인
    const hasNonZeroTotal = staff.some(s => s.fairnessScoreTotalDays !== 0);
    const hasNonZeroNight = staff.some(s => s.fairnessScoreNight !== 0);
    const hasNonZeroWeekend = staff.some(s => s.fairnessScoreWeekend !== 0);
    const hasNonZeroHoliday = staff.some(s => s.fairnessScoreHoliday !== 0);

    console.log('\n\n📈 요약:');
    console.log('='.repeat(100));
    console.log(`전체 직원 수: ${staff.length}`);
    console.log(`Total Days에 0이 아닌 값: ${hasNonZeroTotal ? '있음 ✅' : '없음 ❌'}`);
    console.log(`Night에 0이 아닌 값: ${hasNonZeroNight ? '있음 ✅' : '없음 ❌'}`);
    console.log(`Weekend에 0이 아닌 값: ${hasNonZeroWeekend ? '있음 ✅' : '없음 ❌'}`);
    console.log(`Holiday에 0이 아닌 값: ${hasNonZeroHoliday ? '있음 ✅' : '없음 ❌'}`);

    // 2. FairnessScore 테이블 확인 (있다면)
    try {
      const fairnessScores = await prisma.fairnessScore.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          staff: {
            select: { name: true }
          }
        }
      });

      if (fairnessScores.length > 0) {
        console.log('\n\n📊 FairnessScore 테이블 (최근 5개):');
        console.log('='.repeat(100));
        fairnessScores.forEach(fs => {
          console.log(`\n직원: ${fs.staff.name}`);
          console.log(`  - Year/Month: ${fs.year}/${fs.month}`);
          console.log(`  - Total Deviation: ${fs.totalDeviation}`);
          console.log(`  - Night Deviation: ${fs.nightDeviation}`);
          console.log(`  - Weekend Deviation: ${fs.weekendDeviation}`);
          console.log(`  - Holiday Deviation: ${fs.holidayDeviation}`);
        });
      } else {
        console.log('\n\n⚠️  FairnessScore 테이블이 비어있습니다.');
      }
    } catch (e) {
      console.log('\n\n⚠️  FairnessScore 테이블 조회 실패 (테이블이 없을 수 있음)');
    }

    // 3. 10월 스케줄 확인
    const octoberSchedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 10,
        status: 'CONFIRMED'
      }
    });

    console.log('\n\n📅 2025년 10월 스케줄:');
    console.log('='.repeat(100));
    if (octoberSchedule) {
      console.log(`스케줄 ID: ${octoberSchedule.id}`);
      console.log(`상태: ${octoberSchedule.status}`);
      console.log(`배포 날짜: ${octoberSchedule.deployedAt}`);
    } else {
      console.log('⚠️  2025년 10월 CONFIRMED 스케줄이 없습니다.');
    }

  } catch (error) {
    console.error('❌ 에러 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFairnessData();
