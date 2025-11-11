const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Week key generation (Sunday-based week)
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

async function checkWeekReport() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const year = 2025
    const month = 4

    console.log(`\n📊 ${year}년 ${month}월 주차별 리포트 상세 분석\n`)

    // 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: { clinicId, year, month },
      include: {
        staffAssignments: {
          include: {
            staff: true
          }
        }
      }
    })

    if (!schedule) {
      console.log('❌ 스케줄을 찾을 수 없습니다.')
      return
    }

    // 전체 직원 조회
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      }
    })

    console.log(`👥 전체 직원 수: ${allStaff.length}명\n`)

    // 일요일 제외한 배치
    const businessDays = schedule.staffAssignments.filter(a => {
      const date = new Date(a.date)
      const dayOfWeek = date.getDay()
      return dayOfWeek !== 0
    })

    console.log(`📅 총 배치 건수 (일요일 제외): ${businessDays.length}건\n`)

    // 주차별 데이터 분석
    const weeklyData = new Map()

    for (const assignment of businessDays) {
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

      // 날짜 추가
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
    for (const [weekKey, weekData] of weeklyData) {
      weekIndex++
      const weekNames = ['첫째', '둘째', '셋째', '넷째', '다섯째']
      const weekLabel = weekNames[weekIndex - 1] || `${weekIndex}번째`

      console.log(`\n${'='.repeat(80)}`)
      console.log(`📅 ${weekLabel} 주 (Week Key: ${weekKey})`)
      console.log(`   날짜: ${weekData.dates.sort().join(', ')}`)
      console.log(`${'='.repeat(80)}`)

      const totalAssignments = weekData.offCount + weekData.workCount
      const businessDaysInWeek = Math.ceil(totalAssignments / allStaff.length)

      console.log(`\n📊 주차 통계:`)
      console.log(`   - 총 배치 수: ${totalAssignments}`)
      console.log(`   - OFF 배치: ${weekData.offCount}`)
      console.log(`   - WORK 배치: ${weekData.workCount}`)
      console.log(`   - 영업일 수: ${businessDaysInWeek}일`)
      console.log(`   - 목표 OFF: ${(businessDaysInWeek - 4) * allStaff.length} (영업일 ${businessDaysInWeek} - 4일 근무) × ${allStaff.length}명`)
      console.log(`   - OFF 달성률: ${((weekData.offCount / ((businessDaysInWeek - 4) * allStaff.length)) * 100).toFixed(1)}%`)

      // 직원별 상세
      console.log(`\n👥 직원별 근무/OFF 현황:`)

      const staffDetails = []
      for (const staff of allStaff) {
        const workDays = weekData.staffWorkDays.get(staff.id) || 0
        const offDays = weekData.staffOffDays.get(staff.id) || 0
        const totalDays = workDays + offDays

        staffDetails.push({
          name: staff.name,
          workDays,
          offDays,
          totalDays
        })
      }

      // 근무일 순으로 정렬
      staffDetails.sort((a, b) => a.workDays - b.workDays)

      console.log(`\n   [최소 근무일 미달 가능성]`)
      const below4 = staffDetails.filter(s => s.workDays < 4)
      if (below4.length > 0) {
        below4.forEach(s => {
          console.log(`   ⚠️  ${s.name}: 근무 ${s.workDays}일, OFF ${s.offDays}일, 총 ${s.totalDays}일`)
        })
      } else {
        console.log(`   ✅ 주4일 미달 직원 없음`)
      }

      console.log(`\n   [최대 근무일 (주4일 초과)]`)
      const above4 = staffDetails.filter(s => s.workDays > 4)
      if (above4.length > 0) {
        above4.slice(-5).forEach(s => {
          console.log(`   📈 ${s.name}: 근무 ${s.workDays}일, OFF ${s.offDays}일, 총 ${s.totalDays}일`)
        })
      } else {
        console.log(`   ✅ 주4일 초과 직원 없음`)
      }

      // OFF 통계
      console.log(`\n   [OFF 통계]`)
      const withOff = staffDetails.filter(s => s.offDays > 0)
      const withoutOff = staffDetails.filter(s => s.offDays === 0)
      console.log(`   - OFF 받은 직원: ${withOff.length}명`)
      console.log(`   - OFF 없는 직원: ${withoutOff.length}명`)

      if (withoutOff.length > 0 && withoutOff.length <= 10) {
        console.log(`   - OFF 없는 직원 목록: ${withoutOff.map(s => s.name).join(', ')}`)
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
