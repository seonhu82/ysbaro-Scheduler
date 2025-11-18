const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 정확히 API와 동일한 주 계산 로직
function getWeekKey(date) {
  const year = date.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor((dayOfYear + firstDayOfYear.getDay()) / 7);
  return `${year}-W${weekNumber}`;
}

async function diagnoseNov18Save() {
  try {
    console.log('=== Diagnosing Nov 18 Manual Assignment Save ===\n');

    const clinicId = 'cmh697itv0001fw83azbrqe60';
    const year = 2025;
    const month = 11;
    const departmentName = '데스크';

    // 사용자가 저장하려는 내용: 11월 18일에 데스크 1, 2, 4, 5
    const userRequest = {
      date: '2025-11-18',
      staffIds: [] // 곧 채울 예정
    };

    // 데스크 직원 조회
    const deskStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        departmentName: '데스크',
        isActive: true
      },
      select: {
        id: true,
        name: true,
        workDays: true
      },
      orderBy: { name: 'asc' }
    });

    console.log('Desk Staff:');
    deskStaff.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name} (workDays: ${s.workDays})`);
    });

    // 사용자가 선택한 1, 2, 4, 5번 (0-indexed로 0, 1, 3, 4)
    const selectedIndices = [0, 1, 3, 4];
    userRequest.staffIds = selectedIndices.map(i => deskStaff[i].id);

    console.log('\nUser wants to assign on Nov 18:');
    selectedIndices.forEach(i => {
      console.log(`  - ${deskStaff[i].name} (${deskStaff[i].id})`);
    });

    // 기존 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: { clinicId, year, month }
    });

    if (!schedule) {
      console.log('\n❌ No schedule found for Nov 2025!');
      return;
    }

    console.log(`\nSchedule ID: ${schedule.id}`);

    // 11월 전체 기존 배정 조회 (데스크만)
    const existingAssignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        staff: {
          departmentName: '데스크'
        }
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            workDays: true
          }
        }
      }
    });

    console.log(`\nExisting Nov assignments: ${existingAssignments.length}`);

    // 11월 18일 기존 배정 확인
    const nov18Existing = existingAssignments.filter(a => {
      const dateStr = a.date.toISOString().split('T')[0];
      return dateStr === '2025-11-18';
    });

    console.log(`\nExisting Nov 18 assignments: ${nov18Existing.length}`);
    nov18Existing.forEach(a => {
      console.log(`  - ${a.staff.name}: ${a.shiftType}`);
    });

    // 새로운 배정 시뮬레이션 (11월 18일 새로 추가)
    const newAssignments = userRequest.staffIds.map(staffId => {
      const staff = deskStaff.find(s => s.id === staffId);
      return {
        date: new Date('2025-11-18T00:00:00.000Z'),
        staffId: staffId,
        staffName: staff.name,
        shiftType: 'DAY',
        workDays: staff.workDays
      };
    });

    console.log('\n=== Validation: Weekly Work Limit Check ===\n');

    // 기존 배정에서 근무일만 (OFF 제외)
    const workingAssignments = existingAssignments
      .filter(a => a.shiftType !== 'OFF')
      .map(a => ({
        date: a.date,
        staffId: a.staff.id,
        staffName: a.staff.name,
        shiftType: a.shiftType,
        workDays: a.staff.workDays
      }));

    // 새 배정 합치기
    const allAssignments = [...workingAssignments, ...newAssignments];

    console.log(`Total working assignments to check: ${allAssignments.length}`);
    console.log(`  - Existing: ${workingAssignments.length}`);
    console.log(`  - New (Nov 18): ${newAssignments.length}\n`);

    // 주별, 직원별 근무일 계산
    const weeklyStaffWorkDays = new Map();

    allAssignments.forEach(a => {
      const weekKey = getWeekKey(a.date);

      if (!weeklyStaffWorkDays.has(weekKey)) {
        weeklyStaffWorkDays.set(weekKey, new Map());
      }

      const staffMap = weeklyStaffWorkDays.get(weekKey);

      if (!staffMap.has(a.staffId)) {
        staffMap.set(a.staffId, {
          count: 0,
          name: a.staffName,
          workDays: a.workDays,
          dates: []
        });
      }

      const staffData = staffMap.get(a.staffId);
      staffData.count++;
      staffData.dates.push(a.date.toISOString().split('T')[0]);
    });

    // 주별로 출력
    console.log('Weekly work count by staff:\n');

    const sortedWeeks = Array.from(weeklyStaffWorkDays.keys()).sort();

    sortedWeeks.forEach(weekKey => {
      console.log(`Week ${weekKey}:`);

      const staffMap = weeklyStaffWorkDays.get(weekKey);

      staffMap.forEach((data, staffId) => {
        const status = data.count > data.workDays ? '❌ VIOLATION' : '✅';
        console.log(`  ${status} ${data.name}: ${data.count}일 (limit: ${data.workDays}일)`);
        console.log(`     Dates: ${data.dates.join(', ')}`);
      });

      console.log();
    });

    // 위반 사항 확인
    const violations = [];

    weeklyStaffWorkDays.forEach((staffMap, weekKey) => {
      staffMap.forEach((data, staffId) => {
        if (data.count > data.workDays) {
          violations.push(
            `${data.name} (${weekKey}): ${data.count}일 근무 (제한: ${data.workDays}일/주)`
          );
        }
      });
    });

    console.log('\n=== RESULT ===\n');

    if (violations.length > 0) {
      console.log('❌ SAVE WOULD FAIL - Weekly limit violations:');
      violations.forEach(v => console.log(`  - ${v}`));
    } else {
      console.log('✅ SAVE SHOULD SUCCEED - No violations detected');
    }

    // Nov 17-23 주 번호 확인
    console.log('\n=== Week Number Check ===\n');
    for (let d = 17; d <= 23; d++) {
      const date = new Date(`2025-11-${String(d).padStart(2, '0')}T00:00:00.000Z`);
      const weekKey = getWeekKey(date);
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      console.log(`  Nov ${d} (${dayName}): ${weekKey}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseNov18Save();
