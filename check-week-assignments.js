const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWeekAssignments() {
  try {
    console.log('=== Week 47 (Nov 17-23) Desk Assignments ===\n');

    const clinicId = 'cmh697itv0001fw83azbrqe60';

    // 11월 스케줄
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year: 2025,
        month: 11
      }
    });

    if (!schedule) {
      console.log('No schedule found');
      return;
    }

    // 11월 17-23일 범위의 데스크 배정
    const startDate = new Date('2025-11-17');
    const endDate = new Date('2025-11-23');

    const assignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        date: {
          gte: startDate,
          lte: endDate
        },
        staff: {
          departmentName: '데스크'
        }
      },
      include: {
        staff: {
          select: {
            name: true,
            workDays: true
          }
        }
      },
      orderBy: [
        { date: 'asc' },
        { staff: { name: 'asc' } }
      ]
    });

    // 날짜별로 그룹화
    const byDate = new Map();
    assignments.forEach(a => {
      const dateKey = a.date.toISOString().split('T')[0];
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey).push({
        name: a.staff.name,
        shiftType: a.shiftType,
        workDays: a.staff.workDays
      });
    });

    // 날짜별 출력
    console.log('Date-wise assignments:');
    for (let d = 17; d <= 23; d++) {
      const dateStr = `2025-11-${String(d).padStart(2, '0')}`;
      const dayAssignments = byDate.get(dateStr) || [];
      const working = dayAssignments.filter(a => a.shiftType !== 'OFF');
      console.log(`  ${dateStr}: ${working.length}/${dayAssignments.length} working`);
      working.forEach(a => {
        console.log(`    - ${a.name} (workDays: ${a.workDays})`);
      });
    }

    // 직원별 주간 근무일 수 계산
    console.log(`\n직원별 주간 근무일 수 (11/17-11/23):`);
    const staffWeekCount = new Map();

    assignments.forEach(a => {
      if (a.shiftType !== 'OFF') {
        const name = a.staff.name;
        if (!staffWeekCount.has(name)) {
          staffWeekCount.set(name, {
            count: 0,
            workDays: a.staff.workDays,
            dates: []
          });
        }
        const staff = staffWeekCount.get(name);
        staff.count++;
        staff.dates.push(a.date.toISOString().split('T')[0]);
      }
    });

    staffWeekCount.forEach((data, name) => {
      const status = data.count > data.workDays ? '❌ 초과' : '✅';
      console.log(`  ${status} ${name}: ${data.count}일 근무 (제한: ${data.workDays}일)`);
      console.log(`     날짜: ${data.dates.join(', ')}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWeekAssignments();
