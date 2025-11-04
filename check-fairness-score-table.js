const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  try {
    const scores = await prisma.fairnessScore.findMany({
      where: {
        year: 2025,
        month: 10
      },
      include: {
        staff: {
          select: {
            name: true
          }
        }
      },
      take: 5
    })

    console.log(`10월 FairnessScore 레코드: ${scores.length}개`)
    scores.forEach(s => {
      console.log(`${s.staff.name}: 야간${s.nightShiftCount}, 주말${s.weekendCount}, 공휴일${s.holidayCount}`)
    })

  } catch (error) {
    console.error('오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

check()
