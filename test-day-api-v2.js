const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testDayAPIv2() {
  console.log('=== /api/schedule/day API v2 테스트 (1월 31일 + Cross-Month 처리) ===\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const dateParam = '2025-01-31'
  const dateOnly = new Date(dateParam + 'T00:00:00.000Z')
  const yearParam = '2025'
  const monthParam = '2'  // 2월 캘린더에서 조회
  const statusParam = 'DRAFT'

  console.log('📅 요청 파라미터:')
  console.log('  date:', dateParam)
  console.log('  year:', yearParam)
  console.log('  month:', monthParam)
  console.log('  status:', statusParam)
  console.log()

  // Cross-month 체크 (API 로직 복제)
  const requestedDateYear = dateOnly.getFullYear()
  const requestedDateMonth = dateOnly.getMonth() + 1
  const isCrossMonth = yearParam && monthParam &&
                      (parseInt(yearParam) !== requestedDateYear || parseInt(monthParam) !== requestedDateMonth)

  console.log('🔍 Cross-month 판정:')
  console.log('  requestedDateYear:', requestedDateYear)
  console.log('  requestedDateMonth:', requestedDateMonth)
  console.log('  yearParam:', yearParam)
  console.log('  monthParam:', monthParam)
  console.log('  isCrossMonth:', isCrossMonth)
  console.log()

  // Schedule 조건
  const scheduleWhere = { clinicId }

  if (isCrossMonth) {
    // Cross-month 날짜: 해당 날짜가 속한 달의 DEPLOYED 스케줄에서 조회
    scheduleWhere.year = requestedDateYear
    scheduleWhere.month = requestedDateMonth
    scheduleWhere.status = 'DEPLOYED'
  } else if (statusParam) {
    // 같은 달: status 파라미터 사용
    scheduleWhere.status = statusParam
  } else {
    // status 미지정 시 DRAFT와 DEPLOYED 모두 조회
    scheduleWhere.status = { in: ['DRAFT', 'DEPLOYED'] }
  }

  console.log('📋 최종 scheduleWhere:', scheduleWhere)
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
      }
    }
  })

  console.log('👨‍⚕️ ScheduleDoctor 결과:', doctorSchedules.length)
  doctorSchedules.forEach(ds => {
    console.log(`  - ${ds.doctor.name}`)
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
      }
    }
  })

  console.log('👥 StaffAssignment 결과:', staffAssignments.length)
  console.log('  shiftType별 분포:')
  const byShift = {}
  staffAssignments.forEach(sa => {
    byShift[sa.shiftType] = (byShift[sa.shiftType] || 0) + 1
  })
  Object.entries(byShift).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}명`)
  })
  console.log()

  // 3. 데이터 분류
  const workingStaff = staffAssignments.filter(sa => sa.shiftType !== 'OFF')
  const offStaff = staffAssignments.filter(sa => sa.shiftType === 'OFF')

  console.log('✅ 최종 결과:')
  console.log('  근무 직원:', workingStaff.length, '명')
  console.log('  오프 직원:', offStaff.length, '명')
  console.log()

  if (doctorSchedules.length > 0 && staffAssignments.length > 0) {
    console.log('✅ SUCCESS: 팝업에 데이터가 정상적으로 표시될 것입니다!')
  } else {
    console.log('❌ FAIL: 데이터를 못 가져왔습니다.')
  }

  await prisma.$disconnect()
}

testDayAPIv2().catch(console.error)
