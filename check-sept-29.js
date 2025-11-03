const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkSept29() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'

    // 9월 스케줄 조회
    const septSchedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year: 2025,
        month: 9
      }
    })

    // 10월 스케줄 조회
    const octSchedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year: 2025,
        month: 10
      }
    })

    console.log(`\n9월 스케줄: ${septSchedule ? septSchedule.id : '없음'}`)
    console.log(`10월 스케줄: ${octSchedule ? octSchedule.id : '없음'}`)

    // 9월 29일 원장 스케줄 조회 (9월 스케줄)
    if (septSchedule) {
      const doctorScheduleSept = await prisma.scheduleDoctor.findFirst({
        where: {
          scheduleId: septSchedule.id,
          date: new Date('2025-09-29')
        }
      })

      console.log(`\n📅 9월 29일 원장 스케줄 (9월 스케줄에서):`)
      if (doctorScheduleSept) {
        console.log(`  있음 - hasNightShift: ${doctorScheduleSept.hasNightShift}`)
      } else {
        console.log(`  없음 - 휴진일?`)
      }
    }

    // 9월 29일 원장 스케줄 조회 (10월 스케줄)
    if (octSchedule) {
      const doctorScheduleOct = await prisma.scheduleDoctor.findFirst({
        where: {
          scheduleId: octSchedule.id,
          date: new Date('2025-09-29')
        }
      })

      console.log(`\n📅 9월 29일 원장 스케줄 (10월 스케줄에서):`)
      if (doctorScheduleOct) {
        console.log(`  있음 - hasNightShift: ${doctorScheduleOct.hasNightShift}`)
      } else {
        console.log(`  없음`)
      }

      // 9월 28-30일 직원 assignment 조회
      console.log(`\n📅 9월 28-30일 직원 배정 (10월 스케줄):`)
      const assignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: octSchedule.id,
          date: {
            gte: new Date('2025-09-28'),
            lte: new Date('2025-09-30')
          }
        },
        include: {
          staff: {
            select: {
              name: true
            }
          }
        },
        orderBy: [
          { date: 'asc' },
          { staff: { name: 'asc' } }
        ]
      })

      const byDate = {}
      assignments.forEach(a => {
        const dateKey = a.date.toISOString().split('T')[0]
        if (!byDate[dateKey]) byDate[dateKey] = []
        byDate[dateKey].push(`${a.staff.name}(${a.shiftType})`)
      })

      Object.keys(byDate).sort().forEach(date => {
        console.log(`\n  ${date}: ${byDate[date].length}명`)
        console.log(`    ${byDate[date].join(', ')}`)
      })
    }

  } catch (error) {
    console.error('에러 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSept29()
