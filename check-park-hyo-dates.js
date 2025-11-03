const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkParkHyoDates() {
  try {
    const scheduleId = 'cmhgmfchh02zp12wjh3abc4ku'

    // 모든 날짜별 원장 조합 조회
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        scheduleId
      },
      include: {
        doctor: true
      },
      orderBy: {
        date: 'asc'
      }
    })

    // 날짜별로 그룹화
    const dateMap = new Map()
    for (const ds of doctorSchedules) {
      const dateKey = ds.date.toISOString().split('T')[0]
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          doctors: [],
          hasNightShift: false
        })
      }
      dateMap.get(dateKey).doctors.push(ds.doctor.shortName)
      if (ds.hasNightShift) {
        dateMap.get(dateKey).hasNightShift = true
      }
    }

    // 박,효 조합 찾기
    console.log('\n박,효 조합 날짜:')
    let found = false
    for (const [date, info] of dateMap.entries()) {
      const sorted = info.doctors.sort()
      if (sorted.join(',') === '박,효') {
        console.log(`  ${date}: hasNightShift=${info.hasNightShift}`)
        found = true
      }
    }

    if (!found) {
      console.log('  없음')
    }

    // 9월 29일 정보
    console.log('\n9월 29일:')
    if (dateMap.has('2025-09-29')) {
      const info = dateMap.get('2025-09-29')
      console.log(`  doctors: ${info.doctors.sort().join(',')}`)
      console.log(`  hasNightShift: ${info.hasNightShift}`)
    } else {
      console.log('  없음')
    }

  } catch (error) {
    console.error('에러:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkParkHyoDates()
