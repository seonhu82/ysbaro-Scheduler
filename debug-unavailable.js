const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const year = 2025
  const month = 11

  // 11/14 자동배치 당시의 confirmedLeaves 조회
  const confirmedLeaves = await prisma.leaveApplication.findMany({
    where: {
      clinicId,
      status: 'CONFIRMED',
      date: {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0)
      }
    }
  })

  console.log(`=== 11월 CONFIRMED 연차/오프: ${confirmedLeaves.length}건 ===\n`)

  // 11/24일만 필터링
  const nov24Leaves = confirmedLeaves.filter(l => {
    const dateKey = new Date(l.date).toISOString().split('T')[0]
    return dateKey === '2025-11-24'
  })

  console.log('11/24 CONFIRMED 연차/오프:')
  for (const leave of nov24Leaves) {
    const staff = await prisma.staff.findUnique({
      where: { id: leave.staffId },
      select: { name: true }
    })
    console.log(`- ${staff?.name}: ${leave.leaveType}`)
  }

  // unavailableStaffIds 시뮬레이션
  const dateKey = '2025-11-24'
  const leavesByDate = new Map()

  for (const leave of confirmedLeaves) {
    const key = new Date(leave.date).toISOString().split('T')[0]
    if (!leavesByDate.has(key)) {
      leavesByDate.set(key, new Set())
    }
    leavesByDate.get(key).add(leave.staffId)
  }

  const unavailableStaffIds = leavesByDate.get(dateKey) || new Set()

  console.log(`\nunavailableStaffIds size: ${unavailableStaffIds.size}`)
  console.log('IDs:', Array.from(unavailableStaffIds))

  // 소정, 정아의 ID 확인
  const staff = await prisma.staff.findMany({
    where: {
      name: { in: ['소정', '정아'] }
    },
    select: { id: true, name: true }
  })

  console.log('\n소정, 정아 ID:')
  staff.forEach(s => {
    console.log(`- ${s.name}: ${s.id}`)
    console.log(`  unavailableStaffIds에 포함? ${unavailableStaffIds.has(s.id)}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
