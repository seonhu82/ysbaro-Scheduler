// 휴가 데이터 확인 스크립트
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== 휴가 데이터 확인 ===\n')

  // 2025년 10월의 휴가 데이터 조회
  const startDate = new Date(2025, 9, 1) // 10월 1일
  const endDate = new Date(2025, 9, 31) // 10월 31일

  const leaves = await prisma.leaveApplication.findMany({
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

  console.log(`총 ${leaves.length}개의 휴가 데이터 발견\n`)

  leaves.forEach(leave => {
    console.log(`날짜: ${leave.date.toISOString().split('T')[0]}`)
    console.log(`직원: ${leave.staff.name}`)
    console.log(`유형: ${leave.leaveType}`)
    console.log(`상태: ${leave.status}`)
    console.log(`---`)
  })

  // CONFIRMED 상태만 조회
  const confirmedLeaves = leaves.filter(l => l.status === 'CONFIRMED')
  console.log(`\n승인된(CONFIRMED) 휴가: ${confirmedLeaves.length}개`)

  const annualCount = confirmedLeaves.filter(l => l.leaveType === 'ANNUAL').length
  const offCount = confirmedLeaves.filter(l => l.leaveType === 'OFF').length
  console.log(`  - 연차: ${annualCount}개`)
  console.log(`  - 오프: ${offCount}개`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
