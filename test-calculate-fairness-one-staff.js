/**
 * 한 명의 직원 편차 계산 테스트
 */

const { PrismaClient } = require('@prisma/client')
const { calculateStaffFairnessV2 } = require('./src/lib/services/fairness-calculator-v2')

const prisma = new PrismaClient()

async function main() {
  console.log('📊 한 명의 직원 편차 계산 테스트\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const year = 2025
  const month = 10

  // 금환 직원 찾기
  const staff = await prisma.staff.findFirst({
    where: {
      clinicId,
      name: '금환',
      isActive: true
    }
  })

  if (!staff) {
    console.log('❌ 금환 직원을 찾을 수 없습니다')
    return
  }

  console.log(`직원: ${staff.name} (ID: ${staff.id})`)

  // 편차 계산
  const fairness = await calculateStaffFairnessV2(staff.id, clinicId, year, month)

  console.log('\n계산된 편차:')
  console.log(`  총근무: ${fairness.dimensions.total.deviation.toFixed(2)}`)
  console.log(`  야간: ${fairness.dimensions.night.deviation.toFixed(2)}`)
  console.log(`  주말: ${fairness.dimensions.weekend.deviation.toFixed(2)}`)
  console.log(`  공휴일: ${fairness.dimensions.holiday.deviation.toFixed(2)}`)
  console.log(`  공휴일전후: ${fairness.dimensions.holidayAdjacent.deviation.toFixed(2)}`)

  console.log('\n기대값:')
  console.log(`  총근무: 0.00 (모두 20일)`)
  console.log(`  야간: 0.15 (actual=7, baseline=7.15)`)
  console.log(`  주말: -0.40 (actual=3, baseline=2.60)`)
  console.log(`  공휴일: 0.00`)
  console.log(`  공휴일전후: 0.00`)

  console.log('\n✅ 테스트 완료')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
