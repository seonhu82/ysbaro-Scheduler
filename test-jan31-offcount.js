const { PrismaClient } = require('@prisma/client')
const { startOfMonth, endOfMonth, startOfWeek, endOfWeek } = require('date-fns')

const prisma = new PrismaClient()

async function testJan31OffCount() {
  console.log('=== 1월 31일 오프 인원 집계 테스트 ===\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const year = 2025
  const month = 2 // 2월 캘린더에서 1월 31일 보기

  // 캘린더 그리드 날짜 범위 계산
  const monthStart = startOfMonth(new Date(year, month - 1, 1))
  const monthEnd = endOfMonth(new Date(year, month - 1, 1))
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  console.log('📅 2월 캘린더 범위:')
  console.log('  monthStart:', monthStart.toISOString().split('T')[0])
  console.log('  monthEnd:', monthEnd.toISOString().split('T')[0])
  console.log('  calendarStart:', calendarStart.toISOString().split('T')[0])
  console.log('  calendarEnd:', calendarEnd.toISOString().split('T')[0])
  console.log()

  // 2월 DRAFT 스케줄 조회
  const schedule = await prisma.schedule.findFirst({
    where: {
      clinicId,
      year,
      month,
      status: 'DRAFT'
    },
    include: {
      doctors: true,
      staffAssignments: true
    }
  })

  console.log('📋 2월 DRAFT 스케줄:')
  console.log('  doctors 수:', schedule?.doctors?.length || 0)
  console.log('  staffAssignments 수:', schedule?.staffAssignments?.length || 0)
  console.log()

  // 1월 DEPLOYED 스케줄 조회 (캘린더 범위 내)
  const prevSchedule = await prisma.schedule.findFirst({
    where: {
      clinicId,
      year: 2025,
      month: 1,
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

  console.log('📋 1월 DEPLOYED 스케줄 (2월 캘린더 범위 내):')
  console.log('  doctors 수:', prevSchedule?.doctors?.length || 0)
  console.log('  staffAssignments 수:', prevSchedule?.staffAssignments?.length || 0)
  console.log()

  // 1월 31일 데이터 확인
  const jan31Doctors = prevSchedule?.doctors?.filter(d =>
    new Date(d.date).toISOString().split('T')[0] === '2025-01-31'
  ) || []

  const jan31Staff = prevSchedule?.staffAssignments?.filter(s =>
    new Date(s.date).toISOString().split('T')[0] === '2025-01-31'
  ) || []

  console.log('📅 1월 31일 상세:')
  console.log('  의사 수:', jan31Doctors.length)
  jan31Doctors.forEach(d => {
    console.log(`    - ${d.doctor.shortName} (야간: ${d.hasNightShift})`)
  })

  console.log('  직원 배치 수:', jan31Staff.length)
  const dayShift = jan31Staff.filter(s => s.shiftType === 'DAY').length
  const nightShift = jan31Staff.filter(s => s.shiftType === 'NIGHT').length
  const offShift = jan31Staff.filter(s => s.shiftType === 'OFF').length

  console.log(`    - DAY: ${dayShift}명`)
  console.log(`    - NIGHT: ${nightShift}명`)
  console.log(`    - OFF: ${offShift}명`)
  console.log(`    - 총 근무: ${dayShift + nightShift}명`)
  console.log()

  // 전체 활성 직원 수
  const autoAssignDept = await prisma.department.findMany({
    where: { clinicId, useAutoAssignment: true },
    select: { name: true }
  })
  const autoAssignDeptNames = autoAssignDept.map(d => d.name)

  const totalActiveStaff = await prisma.staff.count({
    where: {
      clinicId,
      isActive: true,
      departmentName: { in: autoAssignDeptNames }
    }
  })

  console.log('👥 전체 활성 직원 수 (자동 배치 부서):', totalActiveStaff)
  console.log()

  // offCount 계산 로직 시뮬레이션
  const assignedStaff = dayShift + nightShift
  const offCount = offShift

  console.log('📊 계산 결과:')
  console.log('  assignedStaff (근무):', assignedStaff)
  console.log('  offCount (OFF 배정):', offCount)
  console.log('  예상 오프 (전체 - 근무):', totalActiveStaff - assignedStaff)
  console.log()

  // CalendarView.tsx 로직 시뮬레이션
  const calculatedOffCount = totalActiveStaff - assignedStaff - 0 // annualLeaveCount는 0으로 가정
  console.log('💡 CalendarView.tsx 계산 방식:')
  console.log('  offCount = 전체 - 배치된 직원 - 연차 직원')
  console.log('  offCount =', totalActiveStaff, '-', assignedStaff, '- 0 =', calculatedOffCount)
  console.log()

  if (offCount !== calculatedOffCount) {
    console.log('⚠️  WARNING: API offCount와 CalendarView 계산값이 다릅니다!')
    console.log('   API offCount:', offCount)
    console.log('   CalendarView 계산:', calculatedOffCount)
  }

  await prisma.$disconnect()
}

testJan31OffCount().catch(console.error)
