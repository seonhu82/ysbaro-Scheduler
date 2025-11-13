const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkScheduleDoctor() {
  try {
    // 모든 Schedule 조회
    const schedules = await prisma.schedule.findMany({
      include: {
        doctors: {
          select: {
            id: true,
            date: true
          }
        }
      }
    })

    console.log('=== Schedule과 ScheduleDoctor 관계 ===\n')

    for (const schedule of schedules) {
      console.log(`Schedule: ${schedule.year}년 ${schedule.month}월 (ID: ${schedule.id.substring(0,8)}...)`)
      console.log(`  Status: ${schedule.status}`)
      console.log(`  ScheduleDoctor 개수: ${schedule.doctors.length}개`)

      if (schedule.doctors.length > 0) {
        const dates = schedule.doctors.map(d => d.date.toISOString().split('T')[0])
        const firstDate = dates[0]
        const lastDate = dates[dates.length - 1]
        console.log(`  날짜 범위: ${firstDate} ~ ${lastDate}`)
      }
      console.log()
    }

    // ScheduleDoctor가 어느 Schedule에 속하는지 확인
    const allDoctorSchedules = await prisma.scheduleDoctor.findMany({
      include: {
        schedule: {
          select: {
            year: true,
            month: true,
            status: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    console.log('=== ScheduleDoctor 74개 상세 ===')
    const bySchedule = {}
    allDoctorSchedules.forEach(ds => {
      const key = `${ds.schedule.year}-${ds.schedule.month}`
      if (!bySchedule[key]) {
        bySchedule[key] = []
      }
      bySchedule[key].push(ds.date.toISOString().split('T')[0])
    })

    Object.entries(bySchedule).forEach(([key, dates]) => {
      console.log(`${key}: ${dates.length}개 (${dates[0]} ~ ${dates[dates.length-1]})`)
    })

    await prisma.$disconnect()
  } catch (error) {
    console.error('오류:', error)
    await prisma.$disconnect()
  }
}

checkScheduleDoctor()
