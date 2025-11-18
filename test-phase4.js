const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testPhase4() {
  try {
    const scheduleId = 'cmhtxwt2o021ni58efxiibik1'

    // Get clinicId from schedule
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: { clinicId: true }
    })
    const clinicId = schedule.clinicId

    console.log('========== 4차 로직 테스트 ==========\n')

    // 확정된 연차/오프 조회
    const confirmedLeaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        status: 'CONFIRMED',
        date: {
          gte: new Date(2025, 10, 1),
          lte: new Date(2025, 10, 30)
        }
      },
      include: {
        staff: { select: { name: true } }
      }
    })

    console.log(`📋 확정 연차/오프: ${confirmedLeaves.length}건`)
    console.log(`   - ANNUAL: ${confirmedLeaves.filter(l => l.leaveType === 'ANNUAL').length}건`)
    console.log(`   - OFF: ${confirmedLeaves.filter(l => l.leaveType === 'OFF').length}건\n`)

    // 연차/오프 맵 생성
    const leaveMap = new Map()
    confirmedLeaves.forEach(leave => {
      const key = `${leave.staffId}_${leave.date.toISOString().split('T')[0]}`
      leaveMap.set(key, leave)
    })

    // 1~3차가 배치한 날짜 조회
    const assignedDatesRaw = await prisma.staffAssignment.findMany({
      where: {
        scheduleId,
        shiftType: { in: ['DAY', 'NIGHT'] }
      },
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'asc' }
    })

    const assignedDates = assignedDatesRaw.map(d => d.date)
    console.log(`📅 1~3차 배치 날짜: ${assignedDates.length}일\n`)

    let annualFound = 0
    let offWithLeaveFound = 0
    let conflictFound = 0

    // 샘플 날짜 하나만 테스트
    const testDate = assignedDates[10] // 11번째 날짜
    const dateStr = testDate.toISOString().split('T')[0]

    console.log(`🔍 테스트 날짜: ${dateStr}\n`)

    // 해당 날짜의 기존 배정 조회
    const existingAssignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId,
        date: testDate
      },
      include: {
        staff: { select: { name: true } }
      }
    })

    console.log(`   전체 배정: ${existingAssignments.length}건`)
    console.log(`   - DAY: ${existingAssignments.filter(a => a.shiftType === 'DAY').length}건`)
    console.log(`   - NIGHT: ${existingAssignments.filter(a => a.shiftType === 'NIGHT').length}건`)
    console.log(`   - OFF: ${existingAssignments.filter(a => a.shiftType === 'OFF').length}건\n`)

    // OFF 배정 확인
    const offAssignments = existingAssignments.filter(a => a.shiftType === 'OFF')

    console.log(`📊 OFF 배정 분석:`)
    for (const offAssignment of offAssignments) {
      const leaveKey = `${offAssignment.staffId}_${dateStr}`
      const leave = leaveMap.get(leaveKey)

      if (leave) {
        console.log(`   - ${offAssignment.staff.name}: ${leave.leaveType} 신청 있음`)
        if (leave.leaveType === 'ANNUAL') {
          annualFound++
        } else {
          offWithLeaveFound++
        }
      }
    }

    console.log(`\n   → ANNUAL로 변경 가능: ${annualFound}건`)
    console.log(`   → OFF + leaveApplicationId 연결 가능: ${offWithLeaveFound}건\n`)

    // 충돌 확인
    console.log(`⚠️  충돌 확인:`)
    for (const assignment of existingAssignments) {
      if (assignment.shiftType === 'DAY' || assignment.shiftType === 'NIGHT') {
        const leaveKey = `${assignment.staffId}_${dateStr}`
        const leave = leaveMap.get(leaveKey)

        if (leave) {
          console.log(`   - ${assignment.staff.name}: ${assignment.shiftType} 배치 vs ${leave.leaveType} 신청 충돌`)
          conflictFound++
        }
      }
    }

    if (conflictFound === 0) {
      console.log(`   → 충돌 없음\n`)
    } else {
      console.log(`   → 총 ${conflictFound}건의 충돌 발견\n`)
    }

    console.log('========== 테스트 완료 ==========')

  } catch (error) {
    console.error('❌ 에러:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testPhase4()
