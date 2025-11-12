const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * 주말 형평성 필터 테스트
 * - 혜숙님이 11월에 토요일 3개 선택 시 3번째는 막혀야 함
 */
async function testWeekendFilter() {
  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const staffId = 'cmh6naxac000s12lynsqel2z3' // 혜숙
  const year = 2025
  const month = 11

  console.log('=== 주말 형평성 필터 테스트 ===\n')

  // 11월 토요일 날짜들
  const saturdays = [
    new Date(2025, 10, 8),   // 11/8 (토)
    new Date(2025, 10, 15),  // 11/15 (토)
    new Date(2025, 10, 22),  // 11/22 (토)
    new Date(2025, 10, 29),  // 11/29 (토)
  ]

  console.log('테스트 시나리오: 혜숙님이 토요일 3개 연속 신청')
  console.log('예상: 첫 2개는 통과, 3번째는 거부\n')

  // 1. 기존 OFF 신청 조회
  const existingApplications = await prisma.leaveApplication.findMany({
    where: {
      staffId,
      leaveType: 'OFF',
      status: { in: ['CONFIRMED', 'PENDING'] },
      date: {
        gte: new Date(2025, 10, 1),
        lte: new Date(2025, 10, 30)
      }
    },
    select: { date: true, status: true }
  })

  console.log('기존 OFF 신청:')
  existingApplications.forEach(app => {
    const day = ['일', '월', '화', '수', '목', '금', '토'][app.date.getDay()]
    console.log(\`  - \${app.date.toISOString().split('T')[0]} (\${day}) - \${app.status}\`)
  })

  const existingSaturdays = existingApplications
    .filter(app => app.date.getDay() === 6)

  console.log(\`\n기존 토요일 OFF 신청: \${existingSaturdays.length}개\`)

  // 2. checkDynamicFairness 동적 import
  const { checkDynamicFairness } = await import('./src/lib/services/dynamic-fairness-calculator.ts')

  // 3. 각 토요일에 대해 형평성 검사
  console.log('\n=== 형평성 검사 시작 ===\n')

  for (let i = 0; i < saturdays.length; i++) {
    const testDate = saturdays[i]
    const dateStr = testDate.toISOString().split('T')[0]

    console.log(\`\${i + 1}. \${dateStr} (토) 테스트:\`)

    try {
      const result = await checkDynamicFairness(
        clinicId,
        staffId,
        testDate,
        year,
        month
      )

      if (result.allowed) {
        console.log('   ✅ 허용됨')
      } else {
        console.log('   ❌ 거부됨')
        console.log(\`   사유: \${result.reason}\`)
        if (result.details) {
          console.log(\`   상세: \${JSON.stringify(result.details, null, 2)}\`)
        }
      }
    } catch (error) {
      console.log(\`   ⚠️ 오류: \${error.message}\`)
    }

    console.log('')
  }

  await prisma.$disconnect()
}

testWeekendFilter().catch(console.error)
