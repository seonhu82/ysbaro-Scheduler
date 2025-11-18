const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function triggerAutoAssign() {
  try {
    // Get schedule info
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

    console.log(`🔄 자동 배치 실행 중...`)
    console.log(`   - 스케줄 ID: ${schedule.id}`)
    console.log(`   - 병원: ${schedule.clinic.name}`)
    console.log(`   - 기간: ${schedule.year}년 ${schedule.month}월\n`)

    // Call auto-assign API
    const response = await fetch('http://localhost:3000/api/schedule/auto-assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scheduleId: schedule.id
      })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('❌ 자동 배치 실패:', result)
      return
    }

    console.log('\n✅ 자동 배치 완료!')
    console.log('\n📊 배치 결과:')
    console.log(JSON.stringify(result, null, 2))

  } catch (error) {
    console.error('❌ 에러:', error)
  } finally {
    await prisma.$disconnect()
  }
}

triggerAutoAssign()
