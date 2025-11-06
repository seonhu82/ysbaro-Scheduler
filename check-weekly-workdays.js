const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWeeklyWorkDays() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  if (!schedule) {
    console.log('스케줄을 찾을 수 없습니다.');
    return;
  }

  const autoAssignStaff = await prisma.staff.findMany({
    where: {
      clinicId: schedule.clinicId,
      departmentName: '진료실',
      isActive: true
    }
  });

  console.log(`\n자동배치 대상 직원: ${autoAssignStaff.length}명\n`);

  // W35 주차 (2025-08-30 ~ 2025-09-05)
  const weekStart = new Date('2025-08-30T00:00:00.000Z');
  const weekEnd = new Date('2025-09-05T23:59:59.999Z');

  console.log(`주차: 2025-W35 (${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]})\n`);

  for (const staff of autoAssignStaff) {
    const assignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        staffId: staff.id,
        date: { gte: weekStart, lte: weekEnd }
      },
      orderBy: { date: 'asc' }
    });

    const workDays = assignments.filter(a => a.shiftType === 'DAY' || a.shiftType === 'NIGHT').length;
    const offDays = assignments.filter(a => a.shiftType === 'OFF').length;

    if (assignments.length > 0) {
      console.log(`${staff.name}: 근무 ${workDays}일, OFF ${offDays}일, 전체 ${assignments.length}일`);
      if (workDays < 4) {
        console.log(`  ⚠️ 주4일 미달!`);
      }
    }
  }

  await prisma.$disconnect();
}

checkWeeklyWorkDays().catch(console.error);
