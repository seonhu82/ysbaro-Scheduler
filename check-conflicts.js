const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConflicts() {
  try {
    const schedule = await prisma.schedule.findFirst({
      where: { year: 2025, month: 11 },
      include: {
        staffAssignments: {
          include: { staff: true }
        }
      }
    });

    if (!schedule) {
      console.log('❌ 2025년 11월 스케줄을 찾을 수 없습니다.');
      return;
    }

    console.log(`\n📅 스케줄 ID: ${schedule.id}`);

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

    console.log(`\n✅ 확정된 연차/오프: ${confirmedLeaves.length}건`);
    console.log(`   - 연차: ${confirmedLeaves.filter(l => l.leaveType === 'ANNUAL').length}건`);
    console.log(`   - 오프: ${confirmedLeaves.filter(l => l.leaveType === 'OFF').length}건`);

    // StaffAssignment 조회
    const assignments = await prisma.staffAssignment.findMany({
      where: { scheduleId: schedule.id },
      include: { staff: true },
      orderBy: { date: 'asc' }
    });

    console.log(`\n📋 StaffAssignment 레코드: ${assignments.length}건`);
    console.log(`   - DAY: ${assignments.filter(a => a.shiftType === 'DAY').length}건`);
    console.log(`   - NIGHT: ${assignments.filter(a => a.shiftType === 'NIGHT').length}건`);
    console.log(`   - OFF: ${assignments.filter(a => a.shiftType === 'OFF').length}건`);

    // 충돌 감지
    console.log('\n\n🔍 충돌 검사 시작...\n');

    const conflicts = [];

    for (const leave of confirmedLeaves) {
      const dateStr = leave.date.toISOString().split('T')[0];

      // 같은 날짜에 근무(DAY/NIGHT) 배정이 있는지 확인
      const workAssignment = assignments.find(
        a => a.staffId === leave.staffId &&
             a.date.toISOString().split('T')[0] === dateStr &&
             (a.shiftType === 'DAY' || a.shiftType === 'NIGHT')
      );

      if (workAssignment) {
        conflicts.push({
          date: dateStr,
          staffId: leave.staffId,
          staffName: leave.staff.name,
          leaveType: leave.leaveType,
          assignedShift: workAssignment.shiftType,
          leaveApplicationId: leave.id,
          staffAssignmentId: workAssignment.id
        });
      }
    }

    if (conflicts.length === 0) {
      console.log('✅ 충돌 없음!');
    } else {
      console.log(`❌ 충돌 발견: ${conflicts.length}건\n`);

      // 날짜별로 그룹화
      const byDate = {};
      conflicts.forEach(c => {
        if (!byDate[c.date]) byDate[c.date] = [];
        byDate[c.date].push(c);
      });

      Object.entries(byDate).forEach(([date, items]) => {
        console.log(`📅 ${date} (${items.length}건)`);
        items.forEach(item => {
          console.log(`   - ${item.staffName}: ${item.leaveType} 신청 ⚔️ ${item.assignedShift} 배정`);
          console.log(`     Leave ID: ${item.leaveApplicationId}`);
          console.log(`     Assignment ID: ${item.staffAssignmentId}`);
        });
        console.log('');
      });

      // 해결 방법 제안
      console.log('\n💡 해결 방법:');
      console.log('1. StaffAssignment의 근무 배정을 OFF로 변경');
      console.log('2. leaveApplicationId 필드에 연차/오프 신청 ID 연결');
      console.log('3. 다른 직원으로 재배치\n');
    }

    // 연차/오프는 있지만 StaffAssignment가 없는 경우
    console.log('\n\n🔍 누락된 StaffAssignment 검사...\n');

    const missing = [];
    for (const leave of confirmedLeaves) {
      const dateStr = leave.date.toISOString().split('T')[0];

      const hasAssignment = assignments.some(
        a => a.staffId === leave.staffId &&
             a.date.toISOString().split('T')[0] === dateStr
      );

      if (!hasAssignment) {
        missing.push({
          date: dateStr,
          staffName: leave.staff.name,
          leaveType: leave.leaveType,
          leaveId: leave.id
        });
      }
    }

    if (missing.length === 0) {
      console.log('✅ 모든 연차/오프가 StaffAssignment에 기록됨');
    } else {
      console.log(`❌ StaffAssignment에 누락된 연차/오프: ${missing.length}건\n`);

      const byDate = {};
      missing.forEach(m => {
        if (!byDate[m.date]) byDate[m.date] = [];
        byDate[m.date].push(m);
      });

      Object.entries(byDate).forEach(([date, items]) => {
        console.log(`📅 ${date} (${items.length}건)`);
        items.forEach(item => {
          console.log(`   - ${item.staffName} (${item.leaveType})`);
        });
      });
    }

  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConflicts();
