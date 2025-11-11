// Check category calculation vs actual combination requirements

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Get the combination with 구,박,윤
  const combination = await prisma.doctorCombination.findFirst({
    where: {
      doctors: { equals: ['구', '박', '윤'] }
    }
  })

  console.log('=== 원장 조합 정보 ===')
  console.log('이름:', combination?.name)
  console.log('요일:', combination?.dayOfWeek)
  console.log('총 필요 인원:', combination?.requiredStaff)
  console.log('\n부서별 필요 인원:')
  console.log(JSON.stringify(combination?.departmentRequiredStaff, null, 2))
  console.log('\n부서별 구분 상세:')
  console.log(JSON.stringify(combination?.departmentCategoryStaff, null, 2))

  // Get category ratio settings
  const ratioSettings = await prisma.categoryRatioSettings.findFirst()

  console.log('\n=== 구분별 비율 설정 ===')
  console.log(JSON.stringify(ratioSettings?.ratios, null, 2))

  // Simulate what the system calculates
  if (combination && ratioSettings) {
    const totalRequired = combination.requiredStaff
    const ratios = ratioSettings.ratios

    console.log('\n=== 시스템이 비율로 계산한 필요 인원 (현재 방식) ===')
    for (const [category, ratio] of Object.entries(ratios)) {
      const required = Math.round((totalRequired * ratio) / 100)
      console.log(`${category}: ${required}명 (비율 ${ratio}%)`)
    }

    console.log('\n=== 조합에 정의된 실제 필요 인원 (사용해야 할 값) ===')
    const deptCatStaff = combination.departmentCategoryStaff
    if (deptCatStaff && deptCatStaff['진료실']) {
      for (const [category, info] of Object.entries(deptCatStaff['진료실'])) {
        console.log(`${category}: ${info.count}명 (필수 ${info.minRequired || 0}명)`)
      }
    }

    console.log('\n⚠️  문제: 시스템이 비율로 계산하고 있지만, 조합에는 정확한 인원수가 정의되어 있음!')
    console.log('해결: leave-eligibility-simulator.ts에서 departmentCategoryStaff를 직접 사용해야 함')
  }

  await prisma.$disconnect()
}

main().catch(console.error)
