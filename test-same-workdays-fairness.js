/**
 * 같은 근무일수 직원들의 공정성 편차 비교
 *
 * 진료실 직원들 중 같은 근무일수를 가진 직원들의 편차를 비교합니다.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 같은 근무일수 직원들의 공정성 편차 비교 (2025년 10월)\n')

  // 1. 10월 스케줄 조회
  const schedule = await prisma.schedule.findFirst({
    where: {
      year: 2025,
      month: 10
    }
  })

  if (!schedule) {
    console.log('❌ 10월 스케줄을 찾을 수 없습니다')
    return
  }

  const clinicId = schedule.clinicId

  // 배포 날짜 범위 확인
  if (!schedule.deployedStartDate || !schedule.deployedEndDate) {
    console.log('❌ 배포된 스케줄이 아닙니다')
    return
  }

  console.log(`📅 배포 범위: ${schedule.deployedStartDate.toISOString().split('T')[0]} ~ ${schedule.deployedEndDate.toISOString().split('T')[0]}\n`)

  // 2. 진료실 직원 조회
  const staffList = await prisma.staff.findMany({
    where: {
      clinicId,
      departmentName: '진료실',
      isActive: true
    },
    select: {
      id: true,
      name: true,
      fairnessScoreTotalDays: true,
      fairnessScoreNight: true,
      fairnessScoreWeekend: true,
      fairnessScoreHoliday: true
    }
  })

  // 3. 각 직원의 실제 근무일수 계산
  const staffWorkdays = []

  for (const staff of staffList) {
    // 실제 배치된 근무일 (OFF 제외)
    const actualDays = await prisma.staffAssignment.count({
      where: {
        staffId: staff.id,
        scheduleId: schedule.id,
        shiftType: { not: 'OFF' }
      }
    })

    // 연차 (OFF 타입)
    const leaveDays = await prisma.leaveApplication.count({
      where: {
        staffId: staff.id,
        clinicId,
        leaveType: 'OFF',
        status: 'CONFIRMED',
        date: {
          gte: schedule.deployedStartDate,
          lte: schedule.deployedEndDate
        }
      }
    })

    const totalDays = actualDays + leaveDays

    // 야근, 주말, 공휴일 횟수
    const assignments = await prisma.staffAssignment.findMany({
      where: {
        staffId: staff.id,
        scheduleId: schedule.id,
        shiftType: { not: 'OFF' }
      },
      select: {
        date: true,
        shiftType: true
      }
    })

    let nightCount = 0
    let weekendCount = 0
    let holidayCount = 0

    // 공휴일 정보
    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: {
          gte: schedule.deployedStartDate,
          lte: schedule.deployedEndDate
        }
      }
    })
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))

    for (const assignment of assignments) {
      if (assignment.shiftType === 'NIGHT') {
        nightCount++
      }

      const dayOfWeek = assignment.date.getDay()
      if (dayOfWeek === 6) {
        weekendCount++
      }

      const dateKey = assignment.date.toISOString().split('T')[0]
      if (holidayDates.has(dateKey)) {
        holidayCount++
      }
    }

    staffWorkdays.push({
      name: staff.name,
      totalDays,
      nightCount,
      weekendCount,
      holidayCount,
      deviationTotal: staff.fairnessScoreTotalDays,
      deviationNight: staff.fairnessScoreNight,
      deviationWeekend: staff.fairnessScoreWeekend,
      deviationHoliday: staff.fairnessScoreHoliday
    })
  }

  // 4. 총근무일수별로 그룹핑
  const groupedByTotalDays = {}
  for (const staff of staffWorkdays) {
    if (!groupedByTotalDays[staff.totalDays]) {
      groupedByTotalDays[staff.totalDays] = []
    }
    groupedByTotalDays[staff.totalDays].push(staff)
  }

  // 5. 결과 출력
  console.log('='.repeat(120))
  console.log('총근무일수별 직원 그룹 및 편차 비교')
  console.log('='.repeat(120))

  for (const [totalDays, group] of Object.entries(groupedByTotalDays)) {
    console.log(`\n📌 총근무일수: ${totalDays}일 (${group.length}명)`)
    console.log('-'.repeat(120))

    for (const staff of group) {
      console.log(
        `${staff.name.padEnd(10)}` +
          `| 총=${staff.totalDays}일 ` +
          `| 야근=${staff.nightCount}회 ` +
          `| 주말=${staff.weekendCount}회 ` +
          `| 공휴일=${staff.holidayCount}회 ` +
          `| 편차(총=${staff.deviationTotal.toFixed(2)}, 야=${staff.deviationNight.toFixed(2)}, 주=${staff.deviationWeekend.toFixed(2)}, 공=${staff.deviationHoliday.toFixed(2)})`
      )
    }
  }

  console.log('\n' + '='.repeat(120))
  console.log('✅ 분석 완료')
  console.log('\n💡 같은 총근무일수를 가진 직원들의 편차가 비슷해야 공정합니다.')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
