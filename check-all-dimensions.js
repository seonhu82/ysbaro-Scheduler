/**
 * 모든 차원 편차 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 모든 차원 편차 확인\n')

  const staffList = await prisma.staff.findMany({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      departmentName: '진료실',
      isActive: true
    },
    select: {
      name: true,
      fairnessScoreTotalDays: true,
      fairnessScoreNight: true,
      fairnessScoreWeekend: true,
      fairnessScoreHoliday: true,
      fairnessScoreHolidayAdjacent: true
    },
    orderBy: {
      name: 'asc'
    },
    take: 10
  })

  console.log('이름'.padEnd(12) + '총근무'.padEnd(10) + '야간'.padEnd(10) + '주말'.padEnd(10) + '공휴일')
  console.log('='.repeat(60))

  for (const staff of staffList) {
    console.log(
      staff.name.padEnd(12) +
      staff.fairnessScoreTotalDays.toFixed(2).padEnd(10) +
      staff.fairnessScoreNight.toFixed(2).padEnd(10) +
      staff.fairnessScoreWeekend.toFixed(2).padEnd(10) +
      staff.fairnessScoreHoliday.toFixed(2)
    )
  }

  console.log('\n✅ 확인 완료')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
