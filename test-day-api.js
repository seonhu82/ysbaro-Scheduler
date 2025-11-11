const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testDayAPI() {
  console.log('=== /api/schedule/day API 테스트 (1월 31일) ===\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const dateOnly = new Date('2025-01-31T00:00:00.000Z')
  const statusParam = 'DRAFT'

  console.log('📅 조회 조건:')
  console.log('  date:', dateOnly.toISOString().split('T')[0])
  console.log('  status:', statusParam)
  console.log()

  // Schedule 조건 (수정된 로직)
  const scheduleWhere = {
    clinicId,
    status: statusParam
  }

  console.log('🔍 scheduleWhere:', scheduleWhere)
  console.log()

  // 1. ScheduleDoctor 조회
  const doctorSchedules = await prisma.scheduleDoctor.findMany({
    where: {
      date: dateOnly,
      schedule: scheduleWhere
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          shortName: true
        }
      },
      schedule: {
        select: {
          id: true,
          year: true,
          month: true,
          status: true
        }
      }
    }
  })

  console.log('👨‍⚕️ ScheduleDoctor 결과:', doctorSchedules.length)
  doctorSchedules.forEach(ds => {
    console.log(`  - ${ds.doctor.name} (스케줄: ${ds.schedule.year}년 ${ds.schedule.month}월 ${ds.schedule.status})`)
  })
  console.log()

  // 2. StaffAssignment 조회
  const staffAssignments = await prisma.staffAssignment.findMany({
    where: {
      date: dateOnly,
      schedule: scheduleWhere
    },
    include: {
      staff: {
        select: {
          id: true,
          name: true,
          rank: true,
          categoryName: true,
          departmentName: true
        }
      },
      schedule: {
        select: {
          id: true,
          year: true,
          month: true,
          status: true
        }
      }
    }
  })

  console.log('👥 StaffAssignment 결과:', staffAssignments.length)
  console.log('  스케줄별 분포:')
  const bySchedule = {}
  staffAssignments.forEach(sa => {
    const key = `${sa.schedule.year}년 ${sa.schedule.month}월 ${sa.schedule.status}`
    bySchedule[key] = (bySchedule[key] || 0) + 1
  })
  Object.entries(bySchedule).forEach(([key, count]) => {
    console.log(`    ${key}: ${count}명`)
  })

  console.log('  shiftType별 분포:')
  const byShift = {}
  staffAssignments.forEach(sa => {
    byShift[sa.shiftType] = (byShift[sa.shiftType] || 0) + 1
  })
  Object.entries(byShift).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}명`)
  })
  console.log()

  // 3. LeaveApplication 조회
  const leaveApplications = await prisma.leaveApplication.findMany({
    where: {
      clinicId,
      date: dateOnly,
      status: 'CONFIRMED'
    },
    include: {
      staff: {
        select: {
          id: true,
          name: true,
          rank: true,
          categoryName: true,
          departmentName: true
        }
      }
    }
  })

  console.log('📝 LeaveApplication 결과:', leaveApplications.length)
  leaveApplications.forEach(la => {
    console.log(`  - ${la.staff.name} (${la.leaveType})`)
  })
  console.log()

  // status 없이 조회 (DEPLOYED 포함)
  console.log('--- status 조건 없이 재조회 (DEPLOYED 포함) ---')
  console.log()

  const scheduleWhereAll = {
    clinicId,
    status: { in: ['DRAFT', 'DEPLOYED'] }
  }

  const doctorSchedulesAll = await prisma.scheduleDoctor.findMany({
    where: {
      date: dateOnly,
      schedule: scheduleWhereAll
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          shortName: true
        }
      },
      schedule: {
        select: {
          id: true,
          year: true,
          month: true,
          status: true
        }
      }
    }
  })

  console.log('👨‍⚕️ ScheduleDoctor 결과 (ALL):', doctorSchedulesAll.length)
  doctorSchedulesAll.forEach(ds => {
    console.log(`  - ${ds.doctor.name} (스케줄: ${ds.schedule.year}년 ${ds.schedule.month}월 ${ds.schedule.status})`)
  })
  console.log()

  const staffAssignmentsAll = await prisma.staffAssignment.findMany({
    where: {
      date: dateOnly,
      schedule: scheduleWhereAll
    },
    include: {
      staff: {
        select: {
          id: true,
          name: true,
          rank: true,
          categoryName: true,
          departmentName: true
        }
      },
      schedule: {
        select: {
          id: true,
          year: true,
          month: true,
          status: true
        }
      }
    }
  })

  console.log('👥 StaffAssignment 결과 (ALL):', staffAssignmentsAll.length)
  console.log('  스케줄별 분포:')
  const byScheduleAll = {}
  staffAssignmentsAll.forEach(sa => {
    const key = `${sa.schedule.year}년 ${sa.schedule.month}월 ${sa.schedule.status}`
    byScheduleAll[key] = (byScheduleAll[key] || 0) + 1
  })
  Object.entries(byScheduleAll).forEach(([key, count]) => {
    console.log(`    ${key}: ${count}명`)
  })

  console.log('  shiftType별 분포:')
  const byShiftAll = {}
  staffAssignmentsAll.forEach(sa => {
    byShiftAll[sa.shiftType] = (byShiftAll[sa.shiftType] || 0) + 1
  })
  Object.entries(byShiftAll).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}명`)
  })

  await prisma.$disconnect()
}

testDayAPI().catch(console.error)
