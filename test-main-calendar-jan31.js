const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testMainCalendarJan31() {
  console.log('=== 메인 캘린더 1월 31일 상세 팝업 테스트 ===\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const dateOnly = new Date('2025-01-31T00:00:00.000Z')

  console.log('📅 요청 조건:')
  console.log('  date: 2025-01-31')
  console.log('  year/month: 없음 (메인 캘린더는 파라미터 없이 조회)')
  console.log('  status: 없음 (DRAFT + DEPLOYED 모두 조회)')
  console.log()

  // 메인 캘린더는 year/month/status 없이 조회
  const scheduleWhere = {
    clinicId,
    status: { in: ['DRAFT', 'DEPLOYED'] }
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

  // 3. 직원 ID별 중복 체크
  const staffIds = {}
  staffAssignments.forEach(sa => {
    const key = sa.staff.id
    staffIds[key] = (staffIds[key] || 0) + 1
  })

  const duplicates = Object.entries(staffIds).filter(([_, count]) => count > 1)

  if (duplicates.length > 0) {
    console.log('⚠️  중복된 직원 발견!')
    for (const [staffId, count] of duplicates) {
      const staff = staffAssignments.find(sa => sa.staff.id === staffId)
      console.log(`  - ${staff.staff.name}: ${count}건`)

      const details = staffAssignments.filter(sa => sa.staff.id === staffId)
      details.forEach(sa => {
        console.log(`      ${sa.schedule.year}년 ${sa.schedule.month}월 ${sa.schedule.status} - ${sa.shiftType}`)
      })
    }
    console.log()
  } else {
    console.log('✅ 중복 없음')
    console.log()
  }

  // 4. LeaveApplication 조회
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

  // 5. DayDetailPopup에서 표시될 데이터 시뮬레이션
  const workingStaff = staffAssignments.filter(sa => sa.shiftType !== 'OFF')
  const offStaff = staffAssignments.filter(sa => sa.shiftType === 'OFF')
  const annualLeave = leaveApplications.filter(la => la.leaveType === 'ANNUAL')
  const manualOff = leaveApplications.filter(la => la.leaveType === 'OFF')

  console.log('📊 DayDetailPopup에 표시될 데이터:')
  console.log('  근무 직원 (working):', workingStaff.length, '명')
  console.log('  오프 직원 (offDays from StaffAssignment):', offStaff.length, '명')
  console.log('  연차 (annualLeave from LeaveApplication):', annualLeave.length, '명')
  console.log('  수동 오프 (manual OFF from LeaveApplication):', manualOff.length, '명')
  console.log()

  console.log('🔍 오프 중복 가능성 체크:')
  console.log('  StaffAssignment OFF:', offStaff.length)
  console.log('  LeaveApplication OFF:', manualOff.length)
  console.log('  합계:', offStaff.length + manualOff.length)

  if (offStaff.length > 0 && manualOff.length > 0) {
    console.log('  ⚠️  StaffAssignment와 LeaveApplication에 모두 OFF 데이터가 있으면 중복 가능!')
  }

  await prisma.$disconnect()
}

testMainCalendarJan31().catch(console.error)
