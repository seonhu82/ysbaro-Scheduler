const { PrismaClient } = require('@prisma/client')
const { calculateStaffFairnessV2 } = require('./src/lib/services/fairness-calculator-v2')

const prisma = new PrismaClient()

async function testFairnessCalculation() {
  try {
    console.log('\n🧪 형평성 계산 테스트...\n')

    // 진료실 직원 1명 조회
    const staff = await prisma.staff.findFirst({
      where: {
        clinicId: 'cmh697itv0001fw83azbrqe60',
        isActive: true,
        departmentName: '진료실'
      }
    })

    if (!staff) {
      console.log('❌ 진료실 직원을 찾을 수 없습니다')
      return
    }

    console.log(`✅ 테스트 대상: ${staff.name} (${staff.id})`)

    // 10월 형평성 계산
    console.log('\n📊 10월 형평성 계산 중...')
    const fairness = await calculateStaffFairnessV2(
      staff.id,
      'cmh697itv0001fw83azbrqe60',
      2025,
      10,
      '진료실'
    )

    console.log('\n결과:')
    console.log('  총근무일:', {
      baseline: fairness.dimensions.total.baseline,
      actual: fairness.dimensions.total.actual,
      deviation: fairness.dimensions.total.deviation,
      score: fairness.dimensions.total.score
    })
    console.log('  야간:', {
      baseline: fairness.dimensions.night.baseline,
      actual: fairness.dimensions.night.actual,
      deviation: fairness.dimensions.night.deviation,
      score: fairness.dimensions.night.score
    })
    console.log('  주말:', {
      baseline: fairness.dimensions.weekend.baseline,
      actual: fairness.dimensions.weekend.actual,
      deviation: fairness.dimensions.weekend.deviation,
      score: fairness.dimensions.weekend.score
    })
    console.log('  전체 점수:', fairness.overallScore)

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testFairnessCalculation()
