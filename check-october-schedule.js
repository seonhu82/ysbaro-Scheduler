const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkSchedule() {
  try {
    const schedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 10,
        status: 'DEPLOYED'
      },
      select: {
        id: true,
        year: true,
        month: true,
        status: true,
        deployedAt: true,
      }
    })

    console.log('10월 스케줄:', schedule)

    if (schedule) {
      const assignmentCount = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id
        }
      })
      console.log('총 배치 수:', assignmentCount)
    }
  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSchedule()
