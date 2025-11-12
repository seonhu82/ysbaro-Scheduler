const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testFairnessAPI() {
  try {
    // 토큰 조회
    const link = await prisma.applicationLink.findFirst({
      where: {
        clinicId: 'cmh697itv0001fw83azbrqe60',
        year: 2025,
        month: 11
      }
    })

    if (!link) {
      console.log('❌ No application link found')
      return
    }

    console.log('🔗 Token:', link.token)
    console.log('📅 Year/Month:', link.year, '/', link.month)

    const staffId = 'cmh6naxac000s12lynsqel2z3' // 혜숙

    // API 호출 시뮬레이션
    const url = `http://localhost:3000/api/leave-apply/${link.token}/fairness?staffId=${staffId}`
    console.log('\n🌐 Testing URL:', url)

    const response = await fetch(url)
    const result = await response.json()

    console.log('\n📊 API Response:')
    console.log(JSON.stringify(result, null, 2))

    if (result.success && result.data.fairnessCutoffs) {
      console.log('\n✅ Fairness Cutoffs:')
      console.log('총 근무일:', result.data.fairnessCutoffs.totalDays)
      console.log('야간:', result.data.fairnessCutoffs.night)
      console.log('주말:', result.data.fairnessCutoffs.weekend)
      console.log('공휴일:', result.data.fairnessCutoffs.holiday)
      console.log('공휴일 전후:', result.data.fairnessCutoffs.holidayAdjacent)
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testFairnessAPI()
