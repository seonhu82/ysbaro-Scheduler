const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function getStaffId() {
  try {
    const staff = await prisma.staff.findFirst({
      where: {
        departmentName: '진료실',
        isActive: true,
        name: '금환'
      },
      select: {
        id: true,
        name: true,
        fairnessScoreTotalDays: true,
        fairnessScoreNight: true,
        fairnessScoreWeekend: true
      }
    })

    console.log('금환 직원:', staff)
  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

getStaffId()
