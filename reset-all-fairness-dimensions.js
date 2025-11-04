/**
 * 모든 직원의 모든 편차 차원을 0으로 초기화
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 모든 직원의 모든 편차 차원 0으로 초기화\n')

  const result = await prisma.staff.updateMany({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      isActive: true
    },
    data: {
      fairnessScoreTotalDays: 0,
      fairnessScoreNight: 0,
      fairnessScoreWeekend: 0,
      fairnessScoreHoliday: 0,
      fairnessScoreHolidayAdjacent: 0
    }
  })

  console.log(`✅ ${result.count}명의 직원 편차를 0으로 초기화했습니다\n`)

  // 확인
  const staff = await prisma.staff.findMany({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      isActive: true
    },
    select: {
      name: true,
      departmentName: true,
      fairnessScoreTotalDays: true,
      fairnessScoreNight: true,
      fairnessScoreWeekend: true,
      fairnessScoreHoliday: true,
      fairnessScoreHolidayAdjacent: true
    },
    orderBy: [
      { departmentName: 'asc' },
      { name: 'asc' }
    ]
  })

  console.log('확인:')
  console.log('이름    부서      총근무  야간   주말   공휴일 공휴일전후')
  console.log('─'.repeat(60))
  staff.forEach(s => {
    console.log(
      `${s.name.padEnd(8)} ${s.departmentName.padEnd(8)} ` +
      `${s.fairnessScoreTotalDays.toString().padStart(4)}  ` +
      `${s.fairnessScoreNight.toString().padStart(4)}  ` +
      `${s.fairnessScoreWeekend.toString().padStart(4)}  ` +
      `${s.fairnessScoreHoliday.toString().padStart(4)}   ` +
      `${s.fairnessScoreHolidayAdjacent.toString().padStart(4)}`
    )
  })

  console.log('\n✅ 완료')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
