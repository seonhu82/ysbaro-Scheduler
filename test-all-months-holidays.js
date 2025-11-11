const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testAllMonthsHolidays() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const year = 2025

    console.log(`\n📊 ${year}년 전체 월 공휴일 OFF 처리 확인\n`)
    console.log('='.repeat(80))

    // 모든 스케줄 조회
    const schedules = await prisma.schedule.findMany({
      where: { clinicId, year },
      include: {
        staffAssignments: true
      },
      orderBy: { month: 'asc' }
    })

    console.log(`\n📅 스케줄이 있는 월: ${schedules.length}개\n`)

    for (const schedule of schedules) {
      const { year, month } = schedule

      console.log(`\n${'='.repeat(80)}`)
      console.log(`📅 ${year}년 ${month}월`)
      console.log('='.repeat(80))

      // 공휴일 조회
      const holidays = await prisma.holiday.findMany({
        where: {
          clinicId,
          date: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1)
          }
        }
      })

      if (holidays.length === 0) {
        console.log('   ℹ️  공휴일 없음\n')
        continue
      }

      console.log(`\n   공휴일: ${holidays.length}개`)

      let monthTotalOffCount = 0

      // 각 공휴일별 OFF 처리 현황
      for (const holiday of holidays) {
        const holidayDateStr = holiday.date.toISOString().split('T')[0]

        // 해당 날짜의 모든 배치
        const allAssignments = schedule.staffAssignments.filter(
          a => new Date(a.date).toISOString().split('T')[0] === holidayDateStr
        )

        // OFF 배치만
        const offAssignments = allAssignments.filter(a => a.shiftType === 'OFF')

        // OFF가 아닌 배치
        const workAssignments = allAssignments.filter(a => a.shiftType !== 'OFF')

        monthTotalOffCount += offAssignments.length

        console.log(`\n   🎌 ${holidayDateStr} (${holiday.name})`)
        console.log(`      - 전체 배치: ${allAssignments.length}건`)
        console.log(`      - OFF 처리: ${offAssignments.length}건`)
        console.log(`      - 근무 배치: ${workAssignments.length}건`)

        if (workAssignments.length > 0) {
          console.log(`      ⚠️  근무 배치가 있음 (처음 3명):`)
          workAssignments.slice(0, 3).forEach(a => {
            console.log(`         - Staff ${a.staffId.slice(0, 8)}: ${a.shiftType}`)
          })
        }
      }

      console.log(`\n   ✅ ${month}월 총 공휴일 OFF 처리: ${monthTotalOffCount}건`)
      console.log(`      (공휴일 ${holidays.length}개 × 평균 ${Math.round(monthTotalOffCount / holidays.length * 10) / 10}건)`)
    }

    console.log(`\n${'='.repeat(80)}\n`)

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAllMonthsHolidays()
