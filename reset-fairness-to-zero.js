/**
 * 진료실 직원 편차를 0으로 초기화
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 진료실 직원 편차 0으로 초기화\n')

  const result = await prisma.staff.updateMany({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      departmentName: '진료실',
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

  console.log(`✅ ${result.count}명의 직원 편차를 0으로 초기화했습니다`)

  // 확인
  const staff = await prisma.staff.findMany({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      departmentName: '진료실',
      isActive: true
    },
    select: {
      name: true,
      fairnessScoreTotalDays: true
    },
    orderBy: {
      name: 'asc'
    }
  })

  console.log('\n확인:')
  staff.forEach(s => {
    console.log(`  ${s.name}: ${s.fairnessScoreTotalDays}`)
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
