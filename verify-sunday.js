const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifySunday() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 9 }
  });

  console.log('=== 09-07(일요일) 확인 ===\n');

  const date = new Date('2025-09-07T00:00:00.000Z');

  // 원장 근무 확인
  const doctorSchedule = await prisma.scheduleDoctor.findFirst({
    where: {
      scheduleId: schedule.id,
      date: date
    }
  });

  console.log(`원장 근무: ${doctorSchedule ? '있음' : '없음'}`);
  console.log();

  // 직원 배정 확인
  const assignments = await prisma.staffAssignment.findMany({
    where: {
      scheduleId: schedule.id,
      date: date
    },
    select: {
      shiftType: true,
      staff: {
        select: { name: true }
      }
    }
  });

  console.log(`총 배정: ${assignments.length}명`);

  const workCount = assignments.filter(a => a.shiftType !== 'OFF').length;
  const offCount = assignments.filter(a => a.shiftType === 'OFF').length;

  console.log(`- 근무: ${workCount}명`);
  console.log(`- OFF: ${offCount}명`);
  console.log();

  // W36 전체 OFF 계산
  const w36Start = new Date('2025-09-07T00:00:00.000Z');
  const w36End = new Date('2025-09-13T23:59:59.999Z');

  const w36Off = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { gte: w36Start, lte: w36End },
      shiftType: 'OFF'
    }
  });

  console.log(`W36(09-07~13) 전체 OFF: ${w36Off}개`);
  console.log();

  // 09-08~13만 계산
  const businessStart = new Date('2025-09-08T00:00:00.000Z');
  const businessEnd = new Date('2025-09-13T23:59:59.999Z');

  const businessOff = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { gte: businessStart, lte: businessEnd },
      shiftType: 'OFF'
    }
  });

  console.log(`영업일만(09-08~13) OFF: ${businessOff}개`);
  console.log(`09-07 OFF: ${w36Off - businessOff}개`);
  console.log();

  console.log('검증:');
  console.log(`${w36Off} = ${offCount} + ${businessOff}?`);
  console.log(`61 = 20 + 41 = ${20 + 41} ✓`);

  await prisma.$disconnect();
}

verifySunday();
