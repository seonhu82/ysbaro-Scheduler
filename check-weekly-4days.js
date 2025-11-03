/**
 * 주4일 근무 보장 검증 스크립트
 *
 * 모든 직원이 각 주차별로 정확히 4일 근무하는지 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function getWeekKey(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const dayOfMonth = date.getDate()
  const dayOfWeek = date.getDay() // 0 = Sunday, 6 = Saturday

  // Get the Sunday of this week
  const sundayOfWeek = new Date(year, month, dayOfMonth - dayOfWeek)

  // Calculate week number based on first Sunday of the year
  const firstDayOfYear = new Date(sundayOfWeek.getFullYear(), 0, 1)
  const firstSunday = new Date(firstDayOfYear)
  const firstDayOfWeek = firstDayOfYear.getDay()

  // Adjust to first Sunday
  if (firstDayOfWeek !== 0) {
    firstSunday.setDate(firstDayOfYear.getDate() + (7 - firstDayOfWeek))
  }

  const diffTime = sundayOfWeek.getTime() - firstSunday.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(diffDays / 7) + 1

  return `${sundayOfWeek.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

async function checkWeekly4Days() {
  try {
    console.log('\n📊 주4일 근무 보장 검증 시작...\n')

    // 최근 스케줄 가져오기
    const schedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 10
      },
      include: {
        staffAssignments: {
          include: {
            staff: true
          }
        }
      }
    })

    if (!schedule) {
      console.log('❌ 2025년 10월 스케줄을 찾을 수 없습니다')
      return
    }

    console.log(`✅ 스케줄 ID: ${schedule.id}`)
    console.log(`✅ 상태: ${schedule.status}\n`)

    // 진료실 직원만 필터링
    const treatmentAssignments = schedule.staffAssignments.filter(
      a => a.staff.departmentName === '진료실'
    )

    // 직원별, 주차별 근무일수 계산
    const staffWeeklyWork = new Map() // staffId -> { weekKey -> workDays }

    for (const assignment of treatmentAssignments) {
      const staffId = assignment.staffId
      const date = new Date(assignment.date)
      const weekKey = getWeekKey(date)
      const isWorkDay = assignment.shiftType !== 'OFF'

      if (!staffWeeklyWork.has(staffId)) {
        staffWeeklyWork.set(staffId, {
          name: assignment.staff.name,
          weeks: new Map()
        })
      }

      const staffData = staffWeeklyWork.get(staffId)
      if (!staffData.weeks.has(weekKey)) {
        staffData.weeks.set(weekKey, 0)
      }

      if (isWorkDay) {
        staffData.weeks.set(weekKey, staffData.weeks.get(weekKey) + 1)
      }
    }

    // 연차도 포함 (ANNUAL은 근무일로 카운트)
    const confirmedLeaves = await prisma.leaveApplication.findMany({
      where: {
        status: 'CONFIRMED',
        leaveType: 'ANNUAL',
        date: {
          gte: new Date(2025, 9, 1),
          lte: new Date(2025, 9, 31)
        }
      },
      include: {
        staff: true
      }
    })

    for (const leave of confirmedLeaves) {
      if (leave.staff.departmentName !== '진료실') continue

      const staffId = leave.staffId
      const date = new Date(leave.date)
      const weekKey = getWeekKey(date)

      if (!staffWeeklyWork.has(staffId)) {
        staffWeeklyWork.set(staffId, {
          name: leave.staff.name,
          weeks: new Map()
        })
      }

      const staffData = staffWeeklyWork.get(staffId)
      if (!staffData.weeks.has(weekKey)) {
        staffData.weeks.set(weekKey, 0)
      }

      // 연차는 근무일로 카운트 (이미 배정에 포함되어 있을 수도 있음)
      // 중복 방지를 위해 확인 필요
      const hasAssignment = treatmentAssignments.some(
        a => a.staffId === staffId &&
             new Date(a.date).toISOString().split('T')[0] === date.toISOString().split('T')[0]
      )

      if (!hasAssignment) {
        staffData.weeks.set(weekKey, staffData.weeks.get(weekKey) + 1)
      }
    }

    // 모든 주차 찾기
    const allWeeks = new Set()
    for (const [staffId, data] of staffWeeklyWork) {
      for (const weekKey of data.weeks.keys()) {
        allWeeks.add(weekKey)
      }
    }

    const sortedWeeks = Array.from(allWeeks).sort()

    console.log(`📅 검사 대상 주차: ${sortedWeeks.join(', ')}\n`)

    // 위반 사항 추적
    const violations = []

    // 각 주차별로 검사
    for (const weekKey of sortedWeeks) {
      console.log(`\n🗓️  ${weekKey} 주차:`)

      const weekStats = []

      for (const [staffId, data] of staffWeeklyWork) {
        const workDays = data.weeks.get(weekKey) || 0
        weekStats.push({
          name: data.name,
          workDays
        })

        if (workDays < 4) {
          violations.push({
            week: weekKey,
            staff: data.name,
            workDays,
            issue: `주4일 미달 (${workDays}일)`
          })
        } else if (workDays > 4) {
          violations.push({
            week: weekKey,
            staff: data.name,
            workDays,
            issue: `주4일 초과 (${workDays}일)`
          })
        }
      }

      // 주차별 통계
      const below4 = weekStats.filter(s => s.workDays < 4)
      const exactly4 = weekStats.filter(s => s.workDays === 4)
      const above4 = weekStats.filter(s => s.workDays > 4)

      console.log(`   ✅ 정확히 4일: ${exactly4.length}명`)
      if (below4.length > 0) {
        console.log(`   ⚠️  4일 미만: ${below4.length}명`)
        below4.forEach(s => console.log(`      - ${s.name}: ${s.workDays}일`))
      }
      if (above4.length > 0) {
        console.log(`   ⚠️  4일 초과: ${above4.length}명`)
        above4.forEach(s => console.log(`      - ${s.name}: ${s.workDays}일`))
      }
    }

    // 최종 결과
    console.log('\n\n' + '='.repeat(60))
    console.log('📋 검증 결과')
    console.log('='.repeat(60))

    if (violations.length === 0) {
      console.log('\n✅ 모든 직원이 모든 주차에서 정확히 4일 근무합니다!\n')
    } else {
      console.log(`\n❌ ${violations.length}건의 위반 발견:\n`)
      violations.forEach(v => {
        console.log(`   ${v.week} | ${v.staff.padEnd(10)} | ${v.issue}`)
      })
      console.log()
    }

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkWeekly4Days()
