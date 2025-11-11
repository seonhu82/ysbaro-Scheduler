const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testHolidayOffCount() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const year = 2025
    const month = 1

    console.log(`\n📊 ${year}년 ${month}월 공휴일 OFF 처리 확인\n`)
    console.log('='.repeat(60))

    // 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: { clinicId, year, month },
      include: {
        staffAssignments: true
      }
    })

    if (!schedule) {
      console.log('❌ 스케줄이 없습니다.')
      return
    }

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

    console.log(`\n📅 공휴일 목록: ${holidays.length}개`)
    holidays.forEach(h => {
      console.log(`   - ${h.date.toISOString().split('T')[0]}: ${h.name}`)
    })

    // 각 공휴일별 OFF 처리 현황
    console.log('\n\n🔍 공휴일별 OFF 처리 현황:\n')

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

      console.log(`📅 ${holidayDateStr} (${holiday.name})`)
      console.log(`   - 전체 배치: ${allAssignments.length}건`)
      console.log(`   - OFF 처리: ${offAssignments.length}건`)
      console.log(`   - 근무 배치: ${workAssignments.length}건`)

      if (workAssignments.length > 0) {
        console.log(`   ⚠️  근무 배치가 있음:`)
        workAssignments.slice(0, 3).forEach(a => {
          console.log(`      - ${a.staffId}: ${a.shiftType}`)
        })
      }
      console.log()
    }

    // 총 공휴일 OFF 건수
    const totalHolidayOffs = holidays.reduce((sum, holiday) => {
      const holidayDateStr = holiday.date.toISOString().split('T')[0]
      const offCount = schedule.staffAssignments.filter(
        a => new Date(a.date).toISOString().split('T')[0] === holidayDateStr && a.shiftType === 'OFF'
      ).length
      return sum + offCount
    }, 0)

    console.log('='.repeat(60))
    console.log(`\n✅ 총 공휴일 OFF 처리: ${totalHolidayOffs}건`)
    console.log(`   (공휴일 ${holidays.length}개 × 평균 ${Math.round(totalHolidayOffs / holidays.length)}건)\n`)

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testHolidayOffCount()
