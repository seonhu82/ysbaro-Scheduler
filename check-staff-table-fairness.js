/**
 * Staff 테이블에 저장된 편차 값 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 Staff 테이블 편차 값 확인\n')

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
    }
  })

  console.log('이름'.padEnd(12) + '총근무'.padEnd(12) + '야간'.padEnd(12) + '주말'.padEnd(12) + '공휴일'.padEnd(12) + '전후')
  console.log('='.repeat(80))

  for (const staff of staffList) {
    console.log(
      staff.name.padEnd(12) +
      staff.fairnessScoreTotalDays.toFixed(2).padEnd(12) +
      staff.fairnessScoreNight.toFixed(2).padEnd(12) +
      staff.fairnessScoreWeekend.toFixed(2).padEnd(12) +
      staff.fairnessScoreHoliday.toFixed(2).padEnd(12) +
      staff.fairnessScoreHolidayAdjacent.toFixed(2)
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
