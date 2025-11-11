const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function calculateWeeklyWorkDays(
  staffId,
  weekKey,
  scheduleId,
  previousScheduleId = null
) {
  // 주차 키에서 연도와 주차 번호 추출
  const [yearStr, weekStr] = weekKey.split('-W')
  const year = parseInt(yearStr)
  const weekNumber = parseInt(weekStr)

  // 해당 주의 일요일 계산
  const firstDayOfYear = new Date(year, 0, 1)
  const firstSunday = new Date(firstDayOfYear)
  const firstDayOfWeek = firstDayOfYear.getDay()

  if (firstDayOfWeek !== 0) {
    firstSunday.setDate(firstDayOfYear.getDate() + (7 - firstDayOfWeek))
  }

  const sundayOfWeek = new Date(firstSunday)
  sundayOfWeek.setDate(firstSunday.getDate() + (weekNumber - 1) * 7)

  // 해당 주의 날짜 범위 (일요일 ~ 토요일)
  const weekStart = new Date(sundayOfWeek)
  const weekEnd = new Date(sundayOfWeek)
  weekEnd.setDate(weekEnd.getDate() + 6)

  console.log(`\n📅 주차: ${weekKey}`)
  console.log(`   범위: ${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]}`)

  let workDayCount = 0

  // 1. DB에서 이미 배정된 근무일 확인
  const scheduleIds = [scheduleId]
  if (previousScheduleId) {
    scheduleIds.push(previousScheduleId)
  }

  const dbAssignments = await prisma.staffAssignment.findMany({
    where: {
      staffId,
      scheduleId: { in: scheduleIds },
      date: {
        gte: weekStart,
        lte: weekEnd
      },
      shiftType: { not: 'OFF' }
    },
    select: {
      date: true,
      shiftType: true
    }
  })

  workDayCount += dbAssignments.length

  console.log(`   DB 근무일: ${dbAssignments.length}건`)
  dbAssignments.forEach(a => {
    const date = new Date(a.date)
    console.log(`      - ${date.toISOString().split('T')[0]}: ${a.shiftType}`)
  })

  return workDayCount
}

async function testCalculateWorkDays() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const year = 2025
    const month = 4

    // 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: { clinicId, year, month }
    })

    if (!schedule) {
      console.log('❌ 스케줄을 찾을 수 없습니다.')
      return
    }

    // 대상 직원들
    const targetStaffNames = ['보은', '다애', '김소', '이소']

    const targetStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        name: { in: targetStaffNames },
        departmentName: '진료실'
      }
    })

    console.log(`\n📊 calculateWeeklyWorkDays 함수 테스트 (2025-W13)\n`)
    console.log('='.repeat(60))

    for (const staff of targetStaff) {
      console.log(`\n👤 ${staff.name}:`)
      const workDays = await calculateWeeklyWorkDays(
        staff.id,
        '2025-W13',
        schedule.id
      )
      console.log(`   ✅ 총 근무일: ${workDays}일`)

      if (workDays < 4) {
        console.log(`   ⚠️  주4일 미달!`)
      } else {
        console.log(`   ✅ 주4일 충족`)
      }
    }

    console.log('\n' + '='.repeat(60) + '\n')

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testCalculateWorkDays()
