// 형평성 점수 확인
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFairness() {
  try {
    const schedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 10,
        status: 'DRAFT'
      }
    });

    if (!schedule) {
      console.log('스케줄 없음');
      return;
    }

    const assignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id
      },
      include: {
        staff: {
          select: {
            name: true,
            categoryName: true,
            departmentName: true
          }
        }
      }
    });

    // 진료실 직원만 필터
    const staffStats = new Map();

    for (const a of assignments) {
      if (a.staff.departmentName !== '진료실') continue;

      if (!staffStats.has(a.staff.name)) {
        staffStats.set(a.staff.name, {
          name: a.staff.name,
          category: a.staff.categoryName,
          total: 0,
          night: 0,
          weekend: 0,
          off: 0
        });
      }

      const stats = staffStats.get(a.staff.name);

      if (a.shiftType === 'OFF') {
        stats.off++;
      } else {
        stats.total++;
        if (a.shiftType === 'NIGHT') stats.night++;

        const day = new Date(a.date).getDay();
        if (day === 0 || day === 6) stats.weekend++;
      }
    }

    const staffArray = Array.from(staffStats.values()).sort((a, b) => b.total - a.total);

    console.log('\n=== 직원별 근무일수 통계 ===\n');
    console.log('이름\t\t카테고리\t총근무\t야간\t주말\t오프');
    console.log('─'.repeat(60));

    for (const s of staffArray) {
      console.log(`${s.name}\t${s.category}\t${s.total}\t${s.night}\t${s.weekend}\t${s.off}`);
    }

    // 각 차원별 표준편차 계산
    const calcStdDev = (values) => {
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
      return Math.sqrt(variance);
    };

    const workDays = staffArray.map(s => s.total);
    const nightDays = staffArray.map(s => s.night);
    const weekendDays = staffArray.map(s => s.weekend);

    const stdDevTotal = calcStdDev(workDays);
    const stdDevNight = calcStdDev(nightDays);
    const stdDevWeekend = calcStdDev(weekendDays);

    // 가중합 계산
    const totalWeightedStdDev =
      stdDevTotal * 1.0 +
      stdDevNight * 1.2 +
      stdDevWeekend * 1.1;

    console.log('\n=== 통계 ===');
    console.log(`총 근무일 - 평균: ${(workDays.reduce((sum, v) => sum + v, 0) / workDays.length).toFixed(2)}, 표준편차: ${stdDevTotal.toFixed(2)}, 최소-최대: ${Math.min(...workDays)}-${Math.max(...workDays)}`);
    console.log(`야간 근무 - 평균: ${(nightDays.reduce((sum, v) => sum + v, 0) / nightDays.length).toFixed(2)}, 표준편차: ${stdDevNight.toFixed(2)}, 최소-최대: ${Math.min(...nightDays)}-${Math.max(...nightDays)}`);
    console.log(`주말 근무 - 평균: ${(weekendDays.reduce((sum, v) => sum + v, 0) / weekendDays.length).toFixed(2)}, 표준편차: ${stdDevWeekend.toFixed(2)}, 최소-최대: ${Math.min(...weekendDays)}-${Math.max(...weekendDays)}`);
    console.log(`\n가중 표준편차 합: ${totalWeightedStdDev.toFixed(2)}`);
    console.log(`형평성 점수: ${Math.max(0, 100 - totalWeightedStdDev * 10).toFixed(1)}점`);

  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFairness();
