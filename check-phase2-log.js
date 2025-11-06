// Phase 2 로그 확인 스크립트
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPhase2() {
  const schedule = await prisma.schedule.findFirst({
    where: {
      year: 2025,
      month: 9
    }
  });

  if (!schedule) {
    console.log('스케줄을 찾을 수 없습니다.');
    return;
  }

  console.log(`스케줄 ID: ${schedule.id}\n`);

  // 주차별 집계
  const weeks = ['2025-W35', '2025-W36', '2025-W37', '2025-W38', '2025-W39'];

  for (const week of weeks) {
    const [yearStr, weekStr] = week.split('-W');
    const weekYear = parseInt(yearStr);
    const weekNumber = parseInt(weekStr);

    const firstDayOfYear = new Date(weekYear, 0, 1);
    const firstSunday = new Date(firstDayOfYear);
    const firstDayOfWeek = firstDayOfYear.getDay();
    if (firstDayOfWeek !== 0) {
      firstSunday.setDate(firstDayOfYear.getDate() + (7 - firstDayOfWeek));
    }

    const sundayOfWeek = new Date(firstSunday);
    sundayOfWeek.setDate(firstSunday.getDate() + (weekNumber - 1) * 7);
    const weekStart = new Date(sundayOfWeek);
    const weekEnd = new Date(sundayOfWeek);
    weekEnd.setDate(weekEnd.getDate() + 6);

    console.log(`\n${week} (${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]}):`);

    // OFF 수 집계
    const offCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        date: { gte: weekStart, lte: weekEnd },
        shiftType: 'OFF'
      }
    });

    // DAY/NIGHT 수 집계
    const workCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        date: { gte: weekStart, lte: weekEnd },
        shiftType: { in: ['DAY', 'NIGHT'] }
      }
    });

    // 전체 배정 수
    const totalCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        date: { gte: weekStart, lte: weekEnd }
      }
    });

    console.log(`  - OFF: ${offCount}건`);
    console.log(`  - 근무(DAY/NIGHT): ${workCount}건`);
    console.log(`  - 전체: ${totalCount}건`);
    console.log(`  - 목표 OFF: 40건 (20명 × 2일)`);
  }

  await prisma.$disconnect();
}

checkPhase2().catch(console.error);
