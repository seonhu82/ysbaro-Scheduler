/**
 * 10월 공정성 계산 테스트 (같은 근무일수 직원 비교)
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 10월 공정성 계산 테스트\n')

  // calculateStaffFairnessV2 import
  const { calculateCategoryFairnessV2 } = require('./src/lib/services/fairness-calculator-v2')

  // 진료실 직원 공정성 계산
  const fairnessScores = await calculateCategoryFairnessV2({
    clinicId: 'cmh697itv0001fw83azbrqe60',
    year: 2025,
    month: 10,
    categoryName: null // 전체 직원
  })

  // 부서별로 필터링
  const clinicStaff = await prisma.staff.findMany({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      isActive: true
    },
    select: {
      id: true,
      name: true,
      departmentName: true
    }
  })

  const staffDepartmentMap = {}
  for (const staff of clinicStaff) {
    staffDepartmentMap[staff.id] = staff.departmentName
  }

  // 진료실만 필터링
  const clinicRoomScores = fairnessScores.filter(
    (score) => staffDepartmentMap[score.staffId] === '진료실'
  )

  // 총근무일수별로 그룹핑
  const groupedByTotalDays = {}
  for (const score of clinicRoomScores) {
    const totalDays = score.dimensions.total.actual
    if (!groupedByTotalDays[totalDays]) {
      groupedByTotalDays[totalDays] = []
    }
    groupedByTotalDays[totalDays].push(score)
  }

  // 결과 출력
  console.log('='.repeat(130))
  console.log('총근무일수별 직원 그룹 및 편차 비교')
  console.log('='.repeat(130))

  for (const [totalDays, group] of Object.entries(groupedByTotalDays).sort((a, b) => b[0] - a[0])) {
    console.log(`\n📌 총근무일수: ${totalDays}일 (${group.length}명)`)
    console.log('-'.repeat(130))

    for (const score of group) {
      console.log(
        `${score.staffName.padEnd(10)}` +
          `| 총=${score.dimensions.total.actual}일(편차=${score.dimensions.total.deviation.toFixed(2)}) ` +
          `| 야근=${score.dimensions.night.actual}회(편차=${score.dimensions.night.deviation.toFixed(2)}) ` +
          `| 주말=${score.dimensions.weekend.actual}회(편차=${score.dimensions.weekend.toFixed(2)}) ` +
          `| 공휴일=${score.dimensions.holiday.actual}회(편차=${score.dimensions.holiday.deviation.toFixed(2)})`
      )
    }
  }

  console.log('\n' + '='.repeat(130))
  console.log('✅ 분석 완료')
  console.log('\n💡 같은 총근무일수를 가진 직원들의 편차가 비슷해야 공정합니다.')
  console.log('💡 전월 편차가 0이므로, 같은 근무일수 = 같은 편차여야 합니다.')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
