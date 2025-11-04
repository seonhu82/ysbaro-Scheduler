const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkFairness() {
  try {
    const staff = await prisma.staff.findMany({
      where: {
        isActive: true,
        departmentName: '진료실'
      },
      select: {
        name: true,
        fairnessScoreTotalDays: true,
        fairnessScoreNight: true,
        fairnessScoreWeekend: true,
        fairnessScoreHoliday: true,
      },
      take: 5,
      orderBy: {
        name: 'asc'
      }
    })

    console.log('형평성 점수 확인:')
    console.log('================')
    staff.forEach(s => {
      console.log(`${s.name}:`)
      console.log(`  총근무일: ${s.fairnessScoreTotalDays}`)
      console.log(`  야근: ${s.fairnessScoreNight}`)
      console.log(`  주말: ${s.fairnessScoreWeekend}`)
      console.log(`  공휴일: ${s.fairnessScoreHoliday}`)
      console.log('')
    })
  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkFairness()
