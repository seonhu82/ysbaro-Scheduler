const { PrismaClient } = require('@prisma/client')
const { startOfMonth, endOfMonth, startOfWeek, endOfWeek } = require('date-fns')

const prisma = new PrismaClient()

// monthly-view API 로직을 그대로 복제
async function testMonthlyViewAPI() {
  console.log('=== /api/schedule/monthly-view API 시뮬레이션 ===\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const year = 2025
  const month = 2
  const scheduleStatus = 'DRAFT'

  // 캘린더 그리드 날짜 범위 계산
  const monthStart = startOfMonth(new Date(year, month - 1, 1))
  const monthEnd = endOfMonth(new Date(year, month - 1, 1))
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  console.log('📅 캘린더 범위:')
  console.log('  monthStart:', monthStart.toISOString().split('T')[0])
  console.log('  monthEnd:', monthEnd.toISOString().split('T')[0])
  console.log('  calendarStart:', calendarStart.toISOString().split('T')[0])
  console.log('  calendarEnd:', calendarEnd.toISOString().split('T')[0])
  console.log()

  // 현재 월 스케줄 조회
  const schedule = await prisma.schedule.findFirst({
    where: {
      clinicId,
      year,
      month,
      status: scheduleStatus
    },
    include: {
      doctors: {
        include: {
          doctor: true
        }
      },
      staffAssignments: {
        include: {
          staff: true
        }
      }
    }
  })

  let prevSchedule = null
  let nextSchedule = null

  if (schedule) {
    // 이전 달의 DEPLOYED 스케줄 조회
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    prevSchedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year: prevYear,
        month: prevMonth,
        status: 'DEPLOYED'
      },
      include: {
        doctors: {
          include: {
            doctor: true
          },
          where: {
            date: {
              gte: calendarStart,
              lte: monthEnd
            }
          }
        },
        staffAssignments: {
          include: {
            staff: true
          },
          where: {
            date: {
              gte: calendarStart,
              lte: monthEnd
            }
          }
        }
      }
    })
  }

  console.log('📋 스케줄 조회 결과:')
  console.log('  현재 월 (2월 DRAFT):', schedule ? 'O' : 'X')
  console.log('  이전 달 (1월 DEPLOYED):', prevSchedule ? 'O' : 'X')
  console.log()

  // 연차/오프 신청 조회
  const leaves = await prisma.leaveApplication.findMany({
    where: {
      clinicId,
      date: {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0)
      }
    },
    include: {
      staff: true
    }
  })

  // 공휴일 조회
  const holidays = await prisma.holiday.findMany({
    where: {
      clinicId,
      date: {
        gte: calendarStart,
        lte: calendarEnd
      }
    }
  })

  const holidayMap = new Map()
  holidays.forEach(holiday => {
    const dateKey = new Date(holiday.date).toISOString().split('T')[0]
    holidayMap.set(dateKey, holiday.name)
  })

  // 의사 조합 정보 조회
  const combinations = await prisma.doctorCombination.findMany({
    where: { clinicId }
  })

  // 자동 배치 부서의 전체 활성 직원 수 조회
  const autoAssignDept = await prisma.department.findMany({
    where: { clinicId, useAutoAssignment: true }
  })
  const autoAssignDeptNames = autoAssignDept.map(d => d.name)

  const totalActiveStaff = await prisma.staff.count({
    where: {
      clinicId,
      isActive: true,
      departmentName: { in: autoAssignDeptNames }
    }
  })

  console.log('👥 전체 활성 직원:', totalActiveStaff)
  console.log()

  // 모든 스케줄 데이터 병합 (중복 제거)
  const currentDoctors = schedule?.doctors || []
  const currentStaff = schedule?.staffAssignments || []

  const currentDoctorDates = new Set(currentDoctors.map(d => new Date(d.date).toISOString().split('T')[0]))
  const currentStaffDates = new Set(currentStaff.map(s => new Date(s.date).toISOString().split('T')[0]))

  const prevDoctors = (prevSchedule?.doctors || []).filter(d =>
    !currentDoctorDates.has(new Date(d.date).toISOString().split('T')[0])
  )
  const prevStaff = (prevSchedule?.staffAssignments || []).filter(s =>
    !currentStaffDates.has(new Date(s.date).toISOString().split('T')[0])
  )

  const allDoctors = [...currentDoctors, ...prevDoctors]
  const allStaffAssignments = [...currentStaff, ...prevStaff]

  console.log('📊 병합 결과:')
  console.log('  currentDoctors:', currentDoctors.length)
  console.log('  prevDoctors (중복 제거):', prevDoctors.length)
  console.log('  allDoctors:', allDoctors.length)
  console.log()
  console.log('  currentStaff:', currentStaff.length)
  console.log('  prevStaff (중복 제거):', prevStaff.length)
  console.log('  allStaffAssignments:', allStaffAssignments.length)
  console.log()

  // 날짜별로 그룹화
  const doctorsByDate = new Map()
  for (const doctorSchedule of allDoctors) {
    const dateKey = new Date(doctorSchedule.date).toISOString().split('T')[0]
    if (!doctorsByDate.has(dateKey)) {
      doctorsByDate.set(dateKey, [])
    }
    doctorsByDate.get(dateKey).push(doctorSchedule)
  }

  const staffByDate = new Map()
  for (const staffAssignment of allStaffAssignments) {
    const dateKey = new Date(staffAssignment.date).toISOString().split('T')[0]
    if (!staffByDate.has(dateKey)) {
      staffByDate.set(dateKey, [])
    }
    staffByDate.get(dateKey).push(staffAssignment)
  }

  // 1월 31일 처리
  const dateKey = '2025-01-31'
  const doctorSchedules = doctorsByDate.get(dateKey) || []
  const dayStaff = staffByDate.get(dateKey) || []

  console.log('🔍 1월 31일 처리:')
  console.log('  doctorSchedules:', doctorSchedules.length)
  console.log('  dayStaff:', dayStaff.length)

  if (doctorSchedules.length > 0) {
    const doctorShortNames = doctorSchedules.map(ds => ds.doctor.shortName)
    const hasNightShift = doctorSchedules.some(ds => ds.hasNightShift)

    const combination = combinations.find(c => {
      const comboDoctors = (c.doctors).sort()
      return JSON.stringify(comboDoctors) === JSON.stringify(doctorShortNames.sort()) &&
             c.hasNightShift === hasNightShift
    })

    const requiredStaff = combination?.requiredStaff || 0
    const assignedStaff = dayStaff.filter(s => s.shiftType !== 'OFF').length
    const offCount = dayStaff.filter(s => s.shiftType === 'OFF').length

    const dayLeaves = leaves.filter(
      l => new Date(l.date).toISOString().split('T')[0] === dateKey
    )
    const annualLeaveCount = dayLeaves.filter(l =>
      (l.status === 'CONFIRMED' || l.status === 'ON_HOLD') && l.leaveType === 'ANNUAL'
    ).length

    console.log()
    console.log('📊 1월 31일 최종 데이터:')
    console.log('  combinationName:', combination?.name || '조합 미정')
    console.log('  hasNightShift:', hasNightShift)
    console.log('  requiredStaff:', requiredStaff)
    console.log('  assignedStaff:', assignedStaff)
    console.log('  doctorShortNames:', doctorShortNames)
    console.log('  annualLeaveCount:', annualLeaveCount)
    console.log('  offCount:', offCount)
    console.log('  holidayName:', holidayMap.get(dateKey) || null)
  } else {
    console.log('  ❌ 의사 스케줄 없음')
  }

  await prisma.$disconnect()
}

testMonthlyViewAPI().catch(console.error)
