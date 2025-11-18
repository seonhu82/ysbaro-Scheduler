const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testCompleteFlow() {
  try {
    console.log('========================================')
    console.log('자동 배치 완전성 테스트')
    console.log('========================================\n')

    // 1. 스케줄 정보 확인
    const schedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 11
      },
      include: {
        clinic: { select: { name: true } }
      }
    })

    if (!schedule) {
      console.log('❌ 2025년 11월 스케줄을 찾을 수 없습니다.')
      return
    }

    console.log(`✅ 스케줄 정보:`)
    console.log(`   - ID: ${schedule.id}`)
    console.log(`   - 병원: ${schedule.clinic.name}`)
    console.log(`   - 기간: ${schedule.year}년 ${schedule.month}월`)
    console.log(`   - 배포 시작일: ${schedule.deployStartDate?.toISOString().split('T')[0] || 'N/A'}`)
    console.log(`   - 배포 종료일: ${schedule.deployEndDate?.toISOString().split('T')[0] || 'N/A'}\n`)

    // 2. 배치 결과 통계
    const assignments = await prisma.staffAssignment.findMany({
      where: { scheduleId: schedule.id },
      include: {
        staff: { select: { name: true } }
      },
      orderBy: [{ date: 'asc' }, { staff: { name: 'asc' } }]
    })

    console.log(`📊 배치 결과 통계:`)
    console.log(`   - 총 배치 레코드: ${assignments.length}건\n`)

    // 3. ShiftType별 통계
    const shiftTypeCounts = {
      DAY: 0,
      NIGHT: 0,
      OFF: 0,
      ANNUAL: 0
    }

    assignments.forEach(a => {
      shiftTypeCounts[a.shiftType]++
    })

    console.log(`   ShiftType별 분포:`)
    console.log(`   - DAY: ${shiftTypeCounts.DAY}건`)
    console.log(`   - NIGHT: ${shiftTypeCounts.NIGHT}건`)
    console.log(`   - OFF: ${shiftTypeCounts.OFF}건`)
    console.log(`   - ANNUAL: ${shiftTypeCounts.ANNUAL}건\n`)

    // 4. 날짜 범위 확인
    const dates = [...new Set(assignments.map(a => a.date.toISOString().split('T')[0]))].sort()
    console.log(`📅 배치 날짜 범위:`)
    console.log(`   - 시작일: ${dates[0]}`)
    console.log(`   - 종료일: ${dates[dates.length - 1]}`)
    console.log(`   - 총 일수: ${dates.length}일\n`)

    // 5. DAY/NIGHT가 있는 날짜 확인 (1~3차 배치 날짜)
    const workDates = [...new Set(
      assignments
        .filter(a => a.shiftType === 'DAY' || a.shiftType === 'NIGHT')
        .map(a => a.date.toISOString().split('T')[0])
    )].sort()

    console.log(`🔨 근무 배치 날짜 (1~3차):`)
    console.log(`   - 시작일: ${workDates[0]}`)
    console.log(`   - 종료일: ${workDates[workDates.length - 1]}`)
    console.log(`   - 총 일수: ${workDates.length}일\n`)

    // 6. OFF/ANNUAL만 있는 날짜 확인 (4차에서 처리하면 안되는 날짜)
    const offOnlyDates = dates.filter(d => !workDates.includes(d))
    if (offOnlyDates.length > 0) {
      console.log(`⚠️  근무 배치 없는 날짜 (OFF/ANNUAL만):`)
      console.log(`   - ${offOnlyDates.join(', ')}`)
      console.log(`   - 총 ${offOnlyDates.length}일`)
      console.log(`   ❌ 이 날짜들은 전월 배포 데이터일 가능성 있음!\n`)
    } else {
      console.log(`✅ 모든 배치 날짜에 근무(DAY/NIGHT)가 존재합니다.\n`)
    }

    // 7. 연차 신청 연결 확인
    const annualAssignments = assignments.filter(a => a.shiftType === 'ANNUAL')
    const annualWithLink = annualAssignments.filter(a => a.leaveApplicationId)
    const annualWithoutLink = annualAssignments.filter(a => !a.leaveApplicationId)

    console.log(`📋 ANNUAL 배치 상세:`)
    console.log(`   - 총 ANNUAL: ${annualAssignments.length}건`)
    console.log(`   - 연차 신청 연결됨: ${annualWithLink.length}건`)
    console.log(`   - 연차 신청 미연결: ${annualWithoutLink.length}건`)

    if (annualWithoutLink.length > 0) {
      console.log(`   ⚠️  미연결 ANNUAL:`)
      annualWithoutLink.slice(0, 5).forEach(a => {
        console.log(`      - ${a.staff.name}: ${a.date.toISOString().split('T')[0]}`)
      })
      if (annualWithoutLink.length > 5) {
        console.log(`      ... 외 ${annualWithoutLink.length - 5}건`)
      }
    }
    console.log()

    // 8. OFF 배치 상세
    const offAssignments = assignments.filter(a => a.shiftType === 'OFF')
    const offWithLeaveLink = offAssignments.filter(a => a.leaveApplicationId)
    const offWithoutLeaveLink = offAssignments.filter(a => !a.leaveApplicationId)

    console.log(`📋 OFF 배치 상세:`)
    console.log(`   - 총 OFF: ${offAssignments.length}건`)
    console.log(`   - 오프 신청 연결됨: ${offWithLeaveLink.length}건`)
    console.log(`   - 신청 없음 (순수 OFF): ${offWithoutLeaveLink.length}건\n`)

    // 9. 충돌 확인 (근무 배치 + 연차/오프 신청)
    const confirmedLeaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId: schedule.clinicId,
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

    const conflicts = []
    for (const leave of confirmedLeaves) {
      const dateStr = leave.date.toISOString().split('T')[0]
      const workAssignment = assignments.find(
        a => a.staffId === leave.staffId &&
             a.date.toISOString().split('T')[0] === dateStr &&
             (a.shiftType === 'DAY' || a.shiftType === 'NIGHT')
      )

      if (workAssignment) {
        conflicts.push({
          staff: leave.staff.name,
          date: dateStr,
          leaveType: leave.leaveType,
          shiftType: workAssignment.shiftType
        })
      }
    }

    console.log(`⚠️  충돌 확인:`)
    if (conflicts.length === 0) {
      console.log(`   ✅ 충돌 없음 (근무 배치 vs 확정 연차/오프)\n`)
    } else {
      console.log(`   ❌ ${conflicts.length}건의 충돌 발견:`)
      conflicts.forEach(c => {
        console.log(`      - ${c.staff}: ${c.date} (${c.leaveType} 신청 vs ${c.shiftType} 배치)`)
      })
      console.log(`   🔧 4차 로직이 이 신청들을 반려했어야 합니다.\n`)
    }

    // 10. 주차별 OFF 통계
    console.log(`📊 주차별 통계:`)
    const weekGroups = new Map()

    for (const assignment of assignments) {
      const date = assignment.date
      const weekNum = Math.ceil(date.getDate() / 7)
      const weekKey = `${weekNum}째주`

      if (!weekGroups.has(weekKey)) {
        weekGroups.set(weekKey, { DAY: 0, NIGHT: 0, OFF: 0, ANNUAL: 0, dates: new Set() })
      }

      const week = weekGroups.get(weekKey)
      week[assignment.shiftType]++
      week.dates.add(date.toISOString().split('T')[0])
    }

    for (const [weekKey, stats] of weekGroups) {
      const dateRange = Array.from(stats.dates).sort()
      console.log(`\n   ${weekKey} (${dateRange[0]} ~ ${dateRange[dateRange.length - 1]}):`)
      console.log(`      - DAY: ${stats.DAY}건`)
      console.log(`      - NIGHT: ${stats.NIGHT}건`)
      console.log(`      - OFF: ${stats.OFF}건`)
      console.log(`      - ANNUAL: ${stats.ANNUAL}건`)
    }

    console.log('\n========================================')
    console.log('테스트 완료')
    console.log('========================================')

  } catch (error) {
    console.error('❌ 테스트 실패:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testCompleteFlow()
