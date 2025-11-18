const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDeskNov18() {
  try {
    console.log('=== Desk Department Check ===\n');

    // 1. Get clinic ID
    const clinic = await prisma.clinic.findFirst();
    const clinicId = clinic.id;

    // 2. Check active desk staff
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
      }
    });

    console.log(`Active Desk Staff: ${deskStaff.length} members`);
    deskStaff.forEach(s => {
      console.log(`  - ${s.name} (workDays: ${s.workDays})`);
    });

    // 3. Check desk assignments in November
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year: 2025,
        month: 11
      }
    });

    if (!schedule) {
      console.log('\nNo schedule found for Nov 2025');
      return;
    }

    const deskAssignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        staff: {
          departmentName: '데스크'
        }
      },
      include: {
        staff: {
          select: { name: true }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    console.log(`\nTotal Desk Assignments in Nov: ${deskAssignments.length}`);

    // Group by date
    const byDate = new Map();
    deskAssignments.forEach(a => {
      const dateKey = a.date.toISOString().split('T')[0];
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey).push({
        name: a.staff.name,
        shiftType: a.shiftType
      });
    });

    console.log(`\nDates with Desk assignments: ${byDate.size} days`);
    byDate.forEach((assignments, date) => {
      const working = assignments.filter(a => a.shiftType !== 'OFF').length;
      const off = assignments.filter(a => a.shiftType === 'OFF').length;
      console.log(`  ${date}: ${assignments.length} total (${working} working, ${off} off)`);
    });

    // Check specifically Nov 18
    const nov18 = byDate.get('2025-11-18');
    console.log(`\nNov 18 Desk Assignments: ${nov18 ? nov18.length : 0}`);
    if (nov18) {
      nov18.forEach(a => {
        console.log(`  - ${a.name} (${a.shiftType})`);
      });
    } else {
      console.log('  ❌ NO DESK ASSIGNMENTS ON NOV 18');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDeskNov18();
