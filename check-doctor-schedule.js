const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDoctorSchedule() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  if (!schedule) {
    console.log('스케줄을 찾을 수 없습니다.');
    return;
  }

  const weekStart = new Date('2025-08-30T00:00:00.000Z');
  const weekEnd = new Date('2025-09-05T23:59:59.999Z');

  console.log(`\n주차: 2025-W35 (${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]})\n`);

  // 해당 주의 모든 날짜 확인
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split('T')[0];
    const dayName = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];

    const doctorSchedule = await prisma.scheduleDoctor.findFirst({
      where: { scheduleId: schedule.id, date: new Date(d) }
    });

    if (doctorSchedule) {
      console.log(`${dateKey} (${dayName}): 원장 근무 ✓ (야간: ${doctorSchedule.hasNightShift ? '있음' : '없음'})`);
    } else {
      console.log(`${dateKey} (${dayName}): 원장 근무 없음 ✗`);
    }
  }

  await prisma.$disconnect();
}

checkDoctorSchedule().catch(console.error);
