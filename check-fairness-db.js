const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkFairness() {
  const staff = await prisma.staff.findMany({
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

  console.log('=== Staff Fairness Scores in DB ===')
  console.table(staff)

  await prisma.$disconnect()
}

checkFairness()
