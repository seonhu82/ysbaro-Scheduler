/**
 * 10월 배치 완료 후 Staff 테이블 형평성 점수 즉시 업데이트
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// TypeScript 함수를 동적으로 로드
async function updateStaffFairness() {
  console.log('📊 Staff 테이블 형평성 점수 업데이트 시작\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const year = 2025
  const month = 10

  // calculateCategoryFairnessV2를 사용하여 계산
  const { calculateCategoryFairnessV2 } = require('./src/lib/services/fairness-calculator-v2.ts')

  console.log('계산 중...')

  const fairnessScores = await calculateCategoryFairnessV2({
    clinicId,
    year,
    month,
    categoryName: null // 전체
  })

  console.log(`✅ ${fairnessScores.length}명의 형평성 점수 계산 완료\n`)

  // Staff 테이블 업데이트
  console.log('Staff 테이블 업데이트 중...\n')

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
        `${score.staffName.padEnd(10)} - ` +
        `총:${score.dimensions.total.deviation.toFixed(2).padStart(6)} ` +
        `야:${score.dimensions.night.deviation.toFixed(2).padStart(6)} ` +
        `주:${score.dimensions.weekend.deviation.toFixed(2).padStart(6)} ` +
        `휴:${score.dimensions.holiday.deviation.toFixed(2).padStart(6)}`
      )
    }
  })

  console.log('\n✅ Staff 테이블 업데이트 완료!')
}

updateStaffFairness()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
