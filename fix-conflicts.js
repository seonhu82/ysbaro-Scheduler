const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixConflicts() {
  try {
    console.log('🔧 데이터 일관성 수정 시작...\n');

    const schedule = await prisma.schedule.findFirst({
      where: { year: 2025, month: 11 }
    });

    if (!schedule) {
      console.log('❌ 2025년 11월 스케줄을 찾을 수 없습니다.');
      return;
    }

    // 확정된 연차/오프 조회
    const confirmedLeaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId: schedule.clinicId,
        date: {
          gte: new Date('2025-11-01'),
          lte: new Date('2025-11-30')
        },
        status: 'CONFIRMED'
      },
      include: { staff: true },
      orderBy: { date: 'asc' }
    });

    console.log(`✅ 확정된 연차/오프: ${confirmedLeaves.length}건\n`);

    let fixedConflicts = 0;
    let addedAssignments = 0;

    for (const leave of confirmedLeaves) {
      const dateStr = leave.date.toISOString().split('T')[0];

      // 기존 배정 확인
      const existingAssignment = await prisma.staffAssignment.findFirst({
        where: {
          scheduleId: schedule.id,
          staffId: leave.staffId,
          date: leave.date
        }
      });

      if (existingAssignment) {
        // 충돌 케이스: DAY/NIGHT로 배정되어 있음
        if (existingAssignment.shiftType !== 'OFF') {
          console.log(`🔧 충돌 수정: ${leave.staff.name} (${dateStr})`);
          console.log(`   ${existingAssignment.shiftType} → OFF`);

          await prisma.staffAssignment.update({
            where: { id: existingAssignment.id },
            data: {
              shiftType: 'OFF',
              leaveApplicationId: leave.id
            }
          });

          fixedConflicts++;
        } else if (!existingAssignment.leaveApplicationId) {
          // OFF는 맞지만 leaveApplicationId가 없는 경우
          console.log(`🔗 연결 추가: ${leave.staff.name} (${dateStr})`);

          await prisma.staffAssignment.update({
            where: { id: existingAssignment.id },
            data: { leaveApplicationId: leave.id }
          });
        }
      } else {
        // 누락 케이스: StaffAssignment 자체가 없음 (주로 ANNUAL)
        console.log(`➕ 누락 추가: ${leave.staff.name} (${dateStr}) - ${leave.leaveType}`);

        await prisma.staffAssignment.create({
          data: {
            scheduleId: schedule.id,
            staffId: leave.staffId,
            date: leave.date,
            shiftType: 'OFF',
            leaveApplicationId: leave.id
          }
        });

        addedAssignments++;
      }
    }

    console.log('\n\n✅ 수정 완료!');
    console.log(`   - 충돌 해결: ${fixedConflicts}건`);
    console.log(`   - 누락 추가: ${addedAssignments}건`);

    // 검증
    console.log('\n\n🔍 검증 중...\n');

    const assignments = await prisma.staffAssignment.findMany({
      where: { scheduleId: schedule.id }
    });

    let verifiedConflicts = 0;
    let verifiedMissing = 0;

    for (const leave of confirmedLeaves) {
      const assignment = assignments.find(
        a => a.staffId === leave.staffId &&
             a.date.toISOString().split('T')[0] === leave.date.toISOString().split('T')[0]
      );

      if (!assignment) {
        verifiedMissing++;
      } else if (assignment.shiftType !== 'OFF') {
        verifiedConflicts++;
      }
    }

    if (verifiedConflicts === 0 && verifiedMissing === 0) {
      console.log('✅ 검증 성공: 모든 데이터가 일관성 있게 저장됨!');
    } else {
      console.log(`❌ 검증 실패:`);
      console.log(`   - 여전히 충돌: ${verifiedConflicts}건`);
      console.log(`   - 여전히 누락: ${verifiedMissing}건`);
    }

    // 최종 통계
    const finalAssignments = await prisma.staffAssignment.findMany({
      where: { scheduleId: schedule.id }
    });

    console.log('\n\n📊 최종 통계:');
    console.log(`   - 총 StaffAssignment: ${finalAssignments.length}건`);
    console.log(`   - DAY: ${finalAssignments.filter(a => a.shiftType === 'DAY').length}건`);
    console.log(`   - NIGHT: ${finalAssignments.filter(a => a.shiftType === 'NIGHT').length}건`);
    console.log(`   - OFF: ${finalAssignments.filter(a => a.shiftType === 'OFF').length}건`);
    console.log(`   - leaveApplicationId 연결: ${finalAssignments.filter(a => a.leaveApplicationId).length}건`);

  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixConflicts();
