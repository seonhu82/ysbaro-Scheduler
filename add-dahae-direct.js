const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addDahae() {
  try {
    // "다해" 직원 ID
    const dahaeId = 'cmhwr6bcd04wya2uk8tqr1ovh';

    // 11월 18일의 스케줄 ID 찾기
    const existingAssignment = await prisma.staffAssignment.findFirst({
      where: {
        date: new Date('2025-11-18T00:00:00.000Z')
      }
    });

    if (!existingAssignment) {
      console.log('❌ 11월 18일 스케줄을 찾을 수 없습니다.');
      return;
    }

    const scheduleId = existingAssignment.scheduleId;

    // "다해"를 DAY 근무로 추가
    const newAssignment = await prisma.staffAssignment.create({
      data: {
        scheduleId: scheduleId,
        staffId: dahaeId,
        date: new Date('2025-11-18T00:00:00.000Z'),
        shiftType: 'DAY',
        isFlexible: false
      }
    });

    console.log('✅ "다해"를 11월 18일 DAY 근무로 추가했습니다.');
    console.log('   Assignment ID:', newAssignment.id);

    // 추가 후 확인
    const total = await prisma.staffAssignment.count({
      where: {
        scheduleId: scheduleId,
        date: new Date('2025-11-18T00:00:00.000Z')
      }
    });

    console.log(`   11월 18일 총 배정 인원: ${total}명`);

  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addDahae();
