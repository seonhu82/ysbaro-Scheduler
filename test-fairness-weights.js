const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testFairnessWeights() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'

    console.log('\n📊 형평성 가중치 설정 확인\n')
    console.log('='.repeat(60))

    const clinicSettings = await prisma.clinicSettings.findUnique({
      where: { clinicId }
    })

    if (!clinicSettings) {
      console.log('❌ ClinicSettings가 없습니다.')
      return
    }

    const fairnessWeights = clinicSettings.fairnessWeights || {}

    console.log('\n형평성 가중치:')
    console.log(JSON.stringify(fairnessWeights, null, 2))

    console.log('\n\n활성화된 항목:')
    const labels = {
      night: '야간',
      weekend: '주말',
      holiday: '공휴일',
      holidayAdjacent: '휴일연장'
    }

    Object.entries(fairnessWeights).forEach(([key, weight]) => {
      const label = labels[key] || key
      const status = weight > 0 ? '✅ 활성화' : '❌ 비활성화'
      console.log(`   ${label}: ${weight} - ${status}`)
    })

    console.log('\n' + '='.repeat(60))

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testFairnessWeights()
