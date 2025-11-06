const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testOctoberAutoAssign() {
  try {
    console.log('🧪 10월 자동배치 테스트 시작...\n')

    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const year = 2025
    const month = 10

    // 1. 주간 패턴 적용 (원장 스케줄 생성)
    console.log('📅 1단계: 주간 패턴 적용 중...')
    const weekPatterns = {
      1: 'cm4m2q9qs0002mzbmcnrhvqo1', // 첫째주
      2: 'cm4m2q9qs0002mzbmcnrhvqo1',
      3: 'cm4m2q9qs0002mzbmcnrhvqo1',
      4: 'cm4m2q9qs0002mzbmcnrhvqo1',
      5: 'cm4m2q9qs0002mzbmcnrhvqo1'  // 마지막주
    }

    const applyResponse = await fetch('http://localhost:3000/api/schedule/apply-weekly-pattern', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, weekPatterns })
    })
    const applyData = await applyResponse.json()
    console.log('주간 패턴 적용 응답:', JSON.stringify(applyData, null, 2))
    if (!applyData.success) {
      console.log('❌ 주간 패턴 적용 실패')
      return
    }
    console.log('✅ 주간 패턴 적용 완료\n')

    // 2. 자동배치 실행
    console.log('🤖 2단계: 자동배치 실행 중...')
    const autoAssignResponse = await fetch('http://localhost:3000/api/schedule/auto-assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month })
    })
    const autoAssignData = await autoAssignResponse.json()
    console.log('자동배치 응답:', JSON.stringify(autoAssignData, null, 2))
    if (!autoAssignData.success) {
      console.log('❌ 자동배치 실패')
      return
    }
    console.log('✅ 자동배치 완료\n')

    // 3. 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: { clinicId, year, month }
    })

    if (!schedule) {
      console.log('❌ 스케줄을 찾을 수 없습니다')
      return
    }

    // 4. 첫째 주와 마지막 주의 날짜 범위 계산
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

    // 5. 첫째 주 오프 결과 조회
    console.log('🔍 첫째 주 오프 결과:')
    const firstWeekDates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(firstWeekStart)
      date.setDate(date.getDate() + i)
      firstWeekDates.push(date)
    }

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
          category: 'OFF'
        },
        include: {
          staff: {
            select: { name: true }
          }
        }
      })

      console.log(`   ${dateStr} (${dayName}): 오프 ${offLeaves.length}명 ${offLeaves.length > 0 ? `[${offLeaves.map(l => l.staff.name).join(', ')}]` : ''}`)
    }

    console.log('\n🔍 마지막 주 오프 결과:')
    const lastWeekDates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(lastWeekStart)
      date.setDate(date.getDate() + i)
      lastWeekDates.push(date)
    }

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
          category: 'OFF'
        },
        include: {
          staff: {
            select: { name: true }
          }
        }
      })

      console.log(`   ${dateStr} (${dayName}): 오프 ${offLeaves.length}명 ${offLeaves.length > 0 ? `[${offLeaves.map(l => l.staff.name).join(', ')}]` : ''}`)
    }

  } catch (error) {
    console.error('❌ 에러 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testOctoberAutoAssign()
