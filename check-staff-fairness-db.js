/**
 * Staff 테이블의 편차 데이터 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 Staff 테이블의 편차 데이터 확인\n')

  const staffList = await prisma.staff.findMany({
    where: {
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

  console.log('처음 10명의 직원 편차 데이터:\n')
  console.log('이름'.padEnd(15) + '총근무일'.padEnd(12) + '야간'.padEnd(12) + '주말'.padEnd(12) + '공휴일')
  console.log('='.repeat(60))

  for (const staff of staffList) {
    console.log(
      staff.name.padEnd(15) +
      staff.fairnessScoreTotalDays.toFixed(2).padEnd(12) +
      staff.fairnessScoreNight.toFixed(2).padEnd(12) +
      staff.fairnessScoreWeekend.toFixed(2).padEnd(12) +
      staff.fairnessScoreHoliday.toFixed(2)
    )
  }

  console.log('\n✅ Staff 테이블 조회 완료')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
