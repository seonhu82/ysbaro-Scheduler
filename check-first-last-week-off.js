const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkFirstLastWeekOff() {
  try {
    console.log('🔍 10월 첫째주/마지막주 오프 결과 확인\n')

    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const year = 2025
    const month = 10

    // 첫째 주와 마지막 주의 날짜 범위 계산
    const monthStart = new Date(year, month - 1, 1)
    const firstDayOfWeek = monthStart.getDay()

    // 첫째 주: 일요일부터 토요일까지
    const firstWeekStart = new Date(year, month - 1, 1 - firstDayOfWeek)
    const firstWeekEnd = new Date(year, month - 1, 1 - firstDayOfWeek + 6)

    // 마지막 주: 마지막 일이 속한 주의 일요일부터 토요일까지
    const monthEnd = new Date(year, month, 0)
    const lastDayOfWeek = monthEnd.getDay()
    const lastWeekStart = new Date(year, month, 0 - lastDayOfWeek)
    const lastWeekEnd = new Date(year, month, 0 - lastDayOfWeek + 6)

    console.log(`📊 첫째 주: ${firstWeekStart.toISOString().split('T')[0]} ~ ${firstWeekEnd.toISOString().split('T')[0]}`)
    console.log(`📊 마지막 주: ${lastWeekStart.toISOString().split('T')[0]} ~ ${lastWeekEnd.toISOString().split('T')[0]}\n`)

    // 첫째 주 오프 결과 조회
    console.log('🔍 첫째 주 오프 결과:')
    const firstWeekDates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(firstWeekStart)
      date.setDate(date.getDate() + i)
      firstWeekDates.push(date)
    }

    let firstWeekTotalOff = 0
    for (const date of firstWeekDates) {
      const dateStr = date.toISOString().split('T')[0]
      const dayNames = ['일', '월', '화', '수', '목', '금', '토']
      const dayName = dayNames[date.getDay()]

      // 해당 날짜의 오프 신청 조회
      const offLeaves = await prisma.leaveApplication.findMany({
        where: {
          clinicId,
          date: new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())),
          status: 'CONFIRMED',
          leaveType: 'OFF'
        },
        include: {
          staff: {
            select: { name: true }
          }
        }
      })

      firstWeekTotalOff += offLeaves.length
      console.log(`   ${dateStr} (${dayName}): 오프 ${offLeaves.length}명 ${offLeaves.length > 0 ? `[${offLeaves.map(l => l.staff.name).join(', ')}]` : ''}`)
    }
    console.log(`   ✅ 첫째 주 총 오프: ${firstWeekTotalOff}명\n`)

    // 마지막 주 오프 결과 조회
    console.log('🔍 마지막 주 오프 결과:')
    const lastWeekDates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(lastWeekStart)
      date.setDate(date.getDate() + i)
      lastWeekDates.push(date)
    }

    let lastWeekTotalOff = 0
    for (const date of lastWeekDates) {
      const dateStr = date.toISOString().split('T')[0]
      const dayNames = ['일', '월', '화', '수', '목', '금', '토']
      const dayName = dayNames[date.getDay()]

      // 해당 날짜의 오프 신청 조회
      const offLeaves = await prisma.leaveApplication.findMany({
        where: {
          clinicId,
          date: new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())),
          status: 'CONFIRMED',
          leaveType: 'OFF'
        },
        include: {
          staff: {
            select: { name: true }
          }
        }
      })

      lastWeekTotalOff += offLeaves.length
      console.log(`   ${dateStr} (${dayName}): 오프 ${offLeaves.length}명 ${offLeaves.length > 0 ? `[${offLeaves.map(l => l.staff.name).join(', ')}]` : ''}`)
    }
    console.log(`   ✅ 마지막 주 총 오프: ${lastWeekTotalOff}명\n`)

  } catch (error) {
    console.error('❌ 에러 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkFirstLastWeekOff()
