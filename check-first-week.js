/**
 * 첫째주 배치 상황 확인 스크립트
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkFirstWeek() {
  try {
    // 2025년 10월 스케줄 찾기
    const schedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 10
      },
      include: {
        doctors: {
          orderBy: { date: 'asc' }
        }
      }
    })

    if (!schedule) {
      console.log('❌ 스케줄을 찾을 수 없습니다')
      return
    }

    console.log('\n📅 2025년 10월 스케줄')
    console.log(`스케줄 ID: ${schedule.id}`)
    console.log(`상태: ${schedule.status}`)

    // 원장 스케줄 날짜 범위
    const doctorDates = schedule.doctors.map(d => d.date)
    const minDate = new Date(Math.min(...doctorDates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...doctorDates.map(d => d.getTime())))

    console.log(`\n📋 원장 스케줄 범위: ${toDateKey(minDate)} ~ ${toDateKey(maxDate)}`)

    // 첫째주 범위 계산 (일요일 시작)
    const firstDayOfWeek = minDate.getDay()
    const firstWeekSunday = new Date(minDate)
    firstWeekSunday.setDate(minDate.getDate() - firstDayOfWeek)

    const firstWeekSaturday = new Date(firstWeekSunday)
    firstWeekSaturday.setDate(firstWeekSunday.getDate() + 6)

    console.log(`\n🗓️  첫째주 범위: ${toDateKey(firstWeekSunday)} (일) ~ ${toDateKey(firstWeekSaturday)} (토)`)

    // 첫째주의 각 날짜별로 확인
    console.log('\n📊 첫째주 날짜별 배치 상황:\n')

    for (let d = new Date(firstWeekSunday); d <= firstWeekSaturday; d.setDate(d.getDate() + 1)) {
      const dateKey = toDateKey(d)
      const dayNames = ['일', '월', '화', '수', '목', '금', '토']
      const dayName = dayNames[d.getDay()]

      // 원장 스케줄 확인
      const doctorSchedule = schedule.doctors.filter(ds =>
        toDateKey(ds.date) === dateKey
      )

      // 직원 배치 확인
      const staffAssignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          date: new Date(d)
        },
        include: {
          staff: true
        }
      })

      const workingStaff = staffAssignments.filter(a => a.shiftType !== 'OFF')
      const offStaff = staffAssignments.filter(a => a.shiftType === 'OFF')

      console.log(`${dateKey} (${dayName}):`)

      if (doctorSchedule.length === 0) {
        console.log(`  ⚪ 원장 근무 없음`)
      } else {
        console.log(`  👨‍⚕️ 원장: ${doctorSchedule.length}명, 야간: ${doctorSchedule.some(d => d.hasNightShift) ? '예' : '아니오'}`)
      }

      console.log(`  👥 직원 배치: 총 ${staffAssignments.length}명`)
      console.log(`     - 근무: ${workingStaff.length}명 ${workingStaff.map(s => s.staff.name).join(', ')}`)
      console.log(`     - OFF: ${offStaff.length}명`)

      if (workingStaff.length === 0 && doctorSchedule.length > 0) {
        console.log(`  ⚠️  경고: 원장 근무는 있는데 직원 근무가 없음!`)
      } else if (workingStaff.length === 1 && doctorSchedule.length > 0) {
        console.log(`  ⚠️  경고: 직원이 1명만 배치됨!`)
      }

      console.log('')
    }

    // 첫째주 전체 통계
    const firstWeekAssignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        date: {
          gte: firstWeekSunday,
          lte: firstWeekSaturday
        }
      },
      include: {
        staff: true
      }
    })

    const workingByDate = {}
    firstWeekAssignments.forEach(a => {
      const dateKey = toDateKey(a.date)
      if (!workingByDate[dateKey]) {
        workingByDate[dateKey] = { working: 0, off: 0 }
      }
      if (a.shiftType !== 'OFF') {
        workingByDate[dateKey].working++
      } else {
        workingByDate[dateKey].off++
      }
    })

    console.log('📈 첫째주 요약:')
    console.log('날짜별 근무 인원:')
    Object.entries(workingByDate).forEach(([date, counts]) => {
      console.log(`  ${date}: 근무 ${counts.working}명, OFF ${counts.off}명`)
    })

  } catch (error) {
    console.error('❌ 에러:', error)
  } finally {
    await prisma.$disconnect()
  }
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

checkFirstWeek()
