const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Week key generation (Sunday-based week)
function getWeekKey(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const dayOfMonth = date.getDate()
  const dayOfWeek = date.getDay()

  const sundayOfWeek = new Date(year, month, dayOfMonth - dayOfWeek)
  const firstDayOfYear = new Date(sundayOfWeek.getFullYear(), 0, 1)
  const firstSunday = new Date(firstDayOfYear)
  const firstDayOfWeek = firstDayOfYear.getDay()

  if (firstDayOfWeek !== 0) {
    firstSunday.setDate(firstDayOfYear.getDate() + (7 - firstDayOfWeek))
  }

  const diffTime = sundayOfWeek.getTime() - firstSunday.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(diffDays / 7) + 1

  return `${sundayOfWeek.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

async function checkWeekReport() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const year = 2025
    const month = 4

    console.log(`\n📊 ${year}년 ${month}월 주차별 리포트 (일요일 포함)\n`)

    const schedule = await prisma.schedule.findFirst({
      where: { clinicId, year, month },
      include: {
        staffAssignments: {
          include: { staff: true }
        }
      }
    })

    if (!schedule) {
      console.log('❌ 스케줄을 찾을 수 없습니다.')
      return
    }

    const allStaff = await prisma.staff.findMany({
      where: { clinicId, isActive: true, departmentName: '진료실' }
    })

    console.log(`👥 전체 직원 수: ${allStaff.length}명\n`)

    // **일요일 포함** 모든 배치
    const allAssignments = schedule.staffAssignments

    console.log(`📅 총 배치 건수 (일요일 포함): ${allAssignments.length}건\n`)

    // 주차별 데이터 분석
    const weeklyData = new Map()

    for (const assignment of allAssignments) {
      const date = new Date(assignment.date)
      const weekKey = getWeekKey(date)

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          weekKey,
          dates: [],
          offCount: 0,
          workCount: 0,
          staffWorkDays: new Map(),
          staffOffDays: new Map()
        })
      }

      const weekData = weeklyData.get(weekKey)
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
      if (!weekData.dates.includes(dateStr)) {
        weekData.dates.push(dateStr)
      }

      if (assignment.shiftType === 'OFF') {
        weekData.offCount++
        const offCount = weekData.staffOffDays.get(assignment.staffId) || 0
        weekData.staffOffDays.set(assignment.staffId, offCount + 1)
      } else {
        weekData.workCount++
        const currentCount = weekData.staffWorkDays.get(assignment.staffId) || 0
        weekData.staffWorkDays.set(assignment.staffId, currentCount + 1)
      }
    }

    // 주차별 상세 출력
    let weekIndex = 0
    for (const [weekKey, weekData] of Array.from(weeklyData.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      weekIndex++
      const weekNames = ['첫째', '둘째', '셋째', '넷째', '다섯째']
      const weekLabel = weekNames[weekIndex - 1] || `${weekIndex}번째`

      console.log(`\n${'='.repeat(80)}`)
      console.log(`📅 ${weekLabel} 주 (Week Key: ${weekKey})`)
      console.log(`   날짜: ${weekData.dates.sort((a, b) => {
        const [ma, da] = a.split('/').map(Number)
        const [mb, db] = b.split('/').map(Number)
        return ma === mb ? da - db : ma - mb
      }).join(', ')}`)
      console.log(`${'='.repeat(80)}`)

      const totalAssignments = weekData.offCount + weekData.workCount
      const businessDaysInWeek = Math.ceil(totalAssignments / allStaff.length)

      console.log(`\n📊 주차 통계:`)
      console.log(`   - 총 배치 수: ${totalAssignments} (${weekData.dates.length}일 × 20명)`)
      console.log(`   - OFF 배치: ${weekData.offCount}`)
      console.log(`   - WORK 배치: ${weekData.workCount}`)
      console.log(`   - 영업일 수 (계산): ${businessDaysInWeek}일`)
      console.log(`   - 목표 OFF: 40 (영업일 6 - 4일 근무) × 20명`)

      // 직원별 상세
      const staffDetails = []
      for (const staff of allStaff) {
        const workDays = weekData.staffWorkDays.get(staff.id) || 0
        const offDays = weekData.staffOffDays.get(staff.id) || 0
        const totalDays = workDays + offDays

        staffDetails.push({ name: staff.name, workDays, offDays, totalDays })
      }

      staffDetails.sort((a, b) => a.workDays - b.workDays)

      console.log(`\n   [3일 이하 근무]`)
      const below4 = staffDetails.filter(s => s.workDays <= 3)
      if (below4.length > 0) {
        below4.forEach(s => {
          console.log(`   ${s.workDays <= 3 ? '⚠️ ' : '  '} ${s.name}: 근무 ${s.workDays}일, OFF ${s.offDays}일, 총 ${s.totalDays}일`)
        })
      }

      console.log(`\n   [4일 근무]`)
      const equal4 = staffDetails.filter(s => s.workDays === 4)
      console.log(`   ✅ 4일 근무 직원: ${equal4.length}명`)

      console.log(`\n   [5일 이상 근무]`)
      const above4 = staffDetails.filter(s => s.workDays >= 5)
      if (above4.length > 0) {
        above4.forEach(s => {
          console.log(`   📈 ${s.name}: 근무 ${s.workDays}일, OFF ${s.offDays}일, 총 ${s.totalDays}일`)
        })
      }
    }

    console.log(`\n${'='.repeat(80)}\n`)

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkWeekReport()
