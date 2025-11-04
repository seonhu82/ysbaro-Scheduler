/**
 * 10월 스케줄의 previousMonthFairness 데이터 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 10월 스케줄의 previousMonthFairness 확인\n')

  const schedule = await prisma.schedule.findFirst({
    where: {
      year: 2025,
      month: 10
    }
  })

  if (!schedule) {
    console.log('❌ 10월 스케줄을 찾을 수 없습니다')
    return
  }

  console.log(`✅ 10월 스케줄 ID: ${schedule.id}`)
  console.log(`   상태: ${schedule.status}`)

  if (!schedule.previousMonthFairness) {
    console.log('\n❌ previousMonthFairness가 null입니다!')
    return
  }

  const previousFairness = schedule.previousMonthFairness
  const staffIds = Object.keys(previousFairness)

  console.log(`\n✅ previousMonthFairness 데이터 존재`)
  console.log(`   직원 수: ${staffIds.length}명\n`)

  // 처음 3명의 데이터 확인
  for (let i = 0; i < Math.min(3, staffIds.length); i++) {
    const staffId = staffIds[i]
    const fairness = previousFairness[staffId]

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { name: true }
    })

    console.log(`${staff?.name || staffId}:`)
    console.log(`  total: ${fairness.total}`)
    console.log(`  night: ${fairness.night}`)
    console.log(`  weekend: ${fairness.weekend}`)
    console.log(`  holiday: ${fairness.holiday}`)
    console.log(`  holidayAdjacent: ${fairness.holidayAdjacent}`)
    console.log()
  }
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
