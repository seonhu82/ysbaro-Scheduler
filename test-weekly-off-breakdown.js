const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Week key generation (Sunday-based week) - UTC 기준
function getWeekKey(date) {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const dayOfMonth = date.getUTCDate()
  const dayOfWeek = date.getUTCDay()

  const sundayOfWeek = new Date(Date.UTC(year, month, dayOfMonth - dayOfWeek))
  const firstDayOfYear = new Date(Date.UTC(sundayOfWeek.getUTCFullYear(), 0, 1))
  const firstSunday = new Date(firstDayOfYear)
  const firstDayOfWeek = firstDayOfYear.getUTCDay()

  if (firstDayOfWeek !== 0) {
    firstSunday.setUTCDate(firstDayOfYear.getUTCDate() + (7 - firstDayOfWeek))
  }

  const diffTime = sundayOfWeek.getTime() - firstSunday.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(diffDays / 7) + 1

  return `${sundayOfWeek.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

async function testWeeklyOffBreakdown() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const year = 2025
    const month = 8

    console.log(`\n📊 ${year}년 ${month}월 주차별 OFF 분석\n`)
    console.log('='.repeat(80))

    // 병원 설정
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId }
    })

    const weekBusinessDays = clinic?.weekBusinessDays || 6
    const defaultWorkDays = clinic?.defaultWorkDays || 4

    console.log(`\n🏥 병원 설정:`)
    console.log(`   - 주간 영업일: ${weekBusinessDays}일`)
    console.log(`   - 기본 근무일: ${defaultWorkDays}일`)

    // 전체 직원 수
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      }
    })

    console.log(`   - 전체 직원: ${allStaff.length}명`)
    console.log(`   - 1주 예상 OFF: ${allStaff.length} × ${weekBusinessDays - defaultWorkDays} = ${allStaff.length * (weekBusinessDays - defaultWorkDays)}건`)

    // 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: { clinicId, year, month },
      include: {
        staffAssignments: true
      }
    })

    if (!schedule) {
      console.log('\n❌ 스케줄이 없습니다.')
      return
    }

    // 공휴일 조회
    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1)
        }
      }
    })

    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))

    // 주차별 데이터 수집
    const weeklyData = new Map()

    for (const assignment of schedule.staffAssignments) {
      const date = new Date(assignment.date)
      const dayOfWeek = date.getDay()

      // 일요일 제외
      if (dayOfWeek === 0) continue

      const weekKey = getWeekKey(date)
      const dateStr = date.toISOString().split('T')[0]

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          weekKey,
          totalOffs: 0,
          normalOffs: 0,
          holidayOffs: 0,
          dates: new Map()
        })
      }

      const weekData = weeklyData.get(weekKey)

      if (!weekData.dates.has(dateStr)) {
        weekData.dates.set(dateStr, {
          date: dateStr,
          isHoliday: holidayDates.has(dateStr),
          offCount: 0,
          workCount: 0
        })
      }

      const dateData = weekData.dates.get(dateStr)

      if (assignment.shiftType === 'OFF') {
        weekData.totalOffs++
        dateData.offCount++

        if (holidayDates.has(dateStr)) {
          weekData.holidayOffs++
        } else {
          weekData.normalOffs++
        }
      } else {
        dateData.workCount++
      }
    }

    // 주차별 출력
    console.log('\n\n📅 주차별 상세 분석:\n')

    for (const [weekKey, weekData] of Array.from(weeklyData.entries()).sort()) {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`📅 ${weekKey}`)
      console.log('='.repeat(80))

      console.log(`\n   총 OFF: ${weekData.totalOffs}건`)
      console.log(`   - 평일 OFF: ${weekData.normalOffs}건`)
      console.log(`   - 공휴일 OFF: ${weekData.holidayOffs}건`)

      console.log(`\n   일별 상세:`)
      for (const [dateStr, dateData] of Array.from(weekData.dates.entries()).sort()) {
        const marker = dateData.isHoliday ? '🎌' : '  '
        const holidayInfo = dateData.isHoliday ? holidays.find(h => h.date.toISOString().split('T')[0] === dateStr) : null
        const holidayName = holidayInfo ? ` (${holidayInfo.name})` : ''

        console.log(`   ${marker} ${dateStr}${holidayName}`)
        console.log(`      - OFF: ${dateData.offCount}건`)
        console.log(`      - 근무: ${dateData.workCount}건`)
        console.log(`      - 총: ${dateData.offCount + dateData.workCount}건`)
      }

      // 공휴일로 인한 추가 OFF 계산
      const normalOffTarget = (weekBusinessDays - defaultWorkDays) * allStaff.length
      const additionalHolidayOffs = weekData.holidayOffs > 0 ? weekData.totalOffs - normalOffTarget : 0

      console.log(`\n   📊 분석:`)
      console.log(`   - 원래 목표 OFF: ${normalOffTarget}건`)
      console.log(`   - 실제 총 OFF: ${weekData.totalOffs}건`)
      console.log(`   - 공휴일로 추가된 OFF: ${additionalHolidayOffs}건`)
    }

    console.log(`\n${'='.repeat(80)}\n`)

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testWeeklyOffBreakdown()
