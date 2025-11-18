const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addDahaeToNov18() {
  try {
    // "다해" 직원 찾기
    const dahae = await prisma.staff.findFirst({
      where: { name: '다해' }
    });

    if (!dahae) {
      console.log('❌ "다해" 직원을 찾을 수 없습니다.');
      return;
    }

    console.log('✅ "다해" 직원 ID:', dahae.id);

    // 11월 18일의 스케줄 찾기
    const existingAssignment = await prisma.staffAssignment.findFirst({
      where: {
        date: new Date('2025-11-18T00:00:00.000Z')
      },
      include: {
        schedule: true
      }
    });

    if (!existingAssignment) {
      console.log('❌ 11월 18일 스케줄을 찾을 수 없습니다.');
      return;
    }

    const scheduleId = existingAssignment.scheduleId;
    console.log('✅ 스케줄 ID:', scheduleId);
    console.log('   스케줄 정보:', {
      year: existingAssignment.schedule.year,
      month: existingAssignment.schedule.month,
      status: existingAssignment.schedule.status
    });

    // 11월 18일 의사 조합 확인
    const doctorSchedule = await prisma.scheduleDoctor.findFirst({
      where: {
        scheduleId: scheduleId,
        date: new Date('2025-11-18T00:00:00.000Z')
      },
      include: {
        doctor: true
      }
    });

    console.log('   의사 조합:', doctorSchedule ? doctorSchedule.doctor.name : '없음');

    // 현재 배정 현황
    const currentAssignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: scheduleId,
        date: new Date('2025-11-18T00:00:00.000Z')
      },
      include: {
        staff: true
      }
    });

    const dayCount = currentAssignments.filter(a => a.shiftType === 'DAY').length;
    const offCount = currentAssignments.filter(a => a.shiftType === 'OFF').length;

    console.log(`\n현재 배정: DAY ${dayCount}명, OFF ${offCount}명, 총 ${currentAssignments.length}명`);

    // "다해"를 DAY로 추가 (근무 인원이 7명이므로 8명으로 맞추기)
    console.log('\n"다해"를 DAY 근무로 추가하시겠습니까?');
    console.log('추가하려면 이 스크립트를 수정하여 아래 주석을 해제하세요:\n');

    // 주석을 해제하고 실행하세요:
    /*
    const newAssignment = await prisma.staffAssignment.create({
      data: {
        scheduleId: scheduleId,
        staffId: dahae.id,
        date: new Date('2025-11-18T00:00:00.000Z'),
        shiftType: 'DAY',
        isFlexible: false
      }
    });

    console.log('✅ "다해"를 11월 18일 DAY 근무로 추가했습니다.');
    console.log('   Assignment ID:', newAssignment.id);
    */

    console.log('// 위 주석을 제거하고 다시 실행하면 "다해"가 추가됩니다.');

  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addDahaeToNov18();
