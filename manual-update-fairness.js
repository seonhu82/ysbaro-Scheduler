/**
 * Staff 테이블 편차 수동 업데이트
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 Staff 테이블 편차 수동 업데이트\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const year = 2025
  const month = 10

  // fairness-calculator-v2의 함수를 동적으로 import
  const { calculateCategoryFairnessV2 } = require('./src/lib/services/fairness-calculator-v2')

  console.log(`계산 시작: ${year}년 ${month}월`)

  const fairnessScores = await calculateCategoryFairnessV2({
    clinicId,
    year,
    month
  })

  console.log(`\n✅ ${fairnessScores.length}명의 편차 계산 완료\n`)

  // Staff 테이블 업데이트
  await prisma.$transaction(async (tx) => {
    for (const score of fairnessScores) {
      await tx.staff.update({
        where: { id: score.staffId },
        data: {
          fairnessScoreTotalDays: score.dimensions.total.deviation,
          fairnessScoreNight: score.dimensions.night.deviation,
          fairnessScoreWeekend: score.dimensions.weekend.deviation,
          fairnessScoreHoliday: score.dimensions.holiday.deviation,
          fairnessScoreHolidayAdjacent: score.dimensions.holidayAdjacent.deviation
        }
      })

      console.log(
        `✅ ${score.staffName}: ` +
          `총근무=${score.dimensions.total.deviation.toFixed(2)}, ` +
          `야간=${score.dimensions.night.deviation.toFixed(2)}, ` +
          `주말=${score.dimensions.weekend.deviation.toFixed(2)}, ` +
          `공휴일=${score.dimensions.holiday.deviation.toFixed(2)}, ` +
          `공휴일전후=${score.dimensions.holidayAdjacent.deviation.toFixed(2)}`
      )
    }
  })

  console.log(`\n✅ Staff 테이블 업데이트 완료`)
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
