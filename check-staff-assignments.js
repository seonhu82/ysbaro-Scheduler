// 스태프 배정 데이터 확인 스크립트
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== 스태프 배정 데이터 확인 ===\n')

  // 2025년 10월의 스태프 배정 데이터 조회
  const startDate = new Date(2025, 9, 1) // 10월 1일
  const endDate = new Date(2025, 9, 31) // 10월 31일

  const assignments = await prisma.staffAssignment.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      staff: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      date: 'asc'
    }
  })

  console.log(`총 ${assignments.length}개의 스태프 배정 데이터 발견\n`)

  // 날짜별로 그룹화
  const byDate = {}
  assignments.forEach(assignment => {
    const dateKey = assignment.date.toISOString().split('T')[0]
    if (!byDate[dateKey]) {
      byDate[dateKey] = []
    }
    byDate[dateKey].push(assignment)
  })

  // 날짜별 출력
  Object.keys(byDate).sort().forEach(dateKey => {
    const dayAssignments = byDate[dateKey]
    console.log(`\n날짜: ${dateKey}`)
    console.log(`총 ${dayAssignments.length}명 배정`)

    const offCount = dayAssignments.filter(a => a.shiftType === 'OFF').length
    const morningCount = dayAssignments.filter(a => a.shiftType === 'MORNING').length
    const afternoonCount = dayAssignments.filter(a => a.shiftType === 'AFTERNOON').length
    const nightCount = dayAssignments.filter(a => a.shiftType === 'NIGHT').length

    console.log(`  - 오프(OFF): ${offCount}명`)
    console.log(`  - 오전: ${morningCount}명`)
    console.log(`  - 오후: ${afternoonCount}명`)
    console.log(`  - 야간: ${nightCount}명`)

    if (offCount > 0) {
      console.log(`  오프 배정 직원:`)
      dayAssignments.filter(a => a.shiftType === 'OFF').forEach(a => {
        console.log(`    - ${a.staff.name} (shiftType: ${a.shiftType})`)
      })
    }
  })

  // 전체 통계
  const totalOff = assignments.filter(a => a.shiftType === 'OFF').length
  console.log(`\n=== 전체 통계 ===`)
  console.log(`전체 배정: ${assignments.length}개`)
  console.log(`OFF 타입 배정: ${totalOff}개`)

  if (totalOff === 0) {
    console.log('\n⚠️ 경고: OFF 타입 배정이 하나도 없습니다!')
    console.log('자동 배치 알고리즘이 OFF를 생성했는지 확인이 필요합니다.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
