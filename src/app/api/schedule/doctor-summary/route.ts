import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAutoAssignDepartmentNamesWithFallback, getCategoryOrderMap } from '@/lib/utils/department-utils'

/**
 * 주어진 날짜가 월 내에서 몇 주차인지 계산
 */
function getWeekNumberInMonth(date: Date, monthStart: Date, monthEnd: Date): number | null {
  if (date < monthStart || date > monthEnd) {
    return null
  }

  // 월의 첫 날이 속한 주의 월요일 찾기
  const firstMonday = new Date(monthStart)
  const firstDayOfWeek = monthStart.getDay()
  const daysUntilMonday = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek
  firstMonday.setDate(monthStart.getDate() + daysUntilMonday)

  // date가 속한 주의 월요일 찾기
  const currentMonday = new Date(date)
  const currentDayOfWeek = date.getDay()
  const daysUntilCurrentMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek
  currentMonday.setDate(date.getDate() + daysUntilCurrentMonday)

  // 주차 계산 (1부터 시작)
  const weeksDiff = Math.floor((currentMonday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return weeksDiff + 1
}

/**
 * GET /api/schedule/doctor-summary
 * 특정 월의 원장 스케줄 요약
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month required' },
        { status: 400 }
      )
    }

    const clinicId = session.user.clinicId

    // 해당 월의 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month
      }
    })

    // 주차별 실제 배포 데이터 존재 여부 계산 (스케줄 없어도 계산)
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)
    const weeksWithData: number[] = []

    // 이 월의 날짜 범위에 해당하는 직원 배치 데이터 조회
    const staffAssignments = await prisma.staffAssignment.findMany({
      where: {
        schedule: {
          clinicId
        },
        date: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      select: {
        date: true
      },
      distinct: ['date']
    })

    console.log(`[doctor-summary] StaffAssignment 조회: ${year}년 ${month}월, ${staffAssignments.length}개 날짜`)

    // 각 배치 날짜가 어느 주차에 속하는지 계산
    staffAssignments.forEach(sa => {
      const weekNumber = getWeekNumberInMonth(sa.date, monthStart, monthEnd)
      if (weekNumber && !weeksWithData.includes(weekNumber)) {
        weeksWithData.push(weekNumber)
      }
    })

    console.log('[doctor-summary] Weeks with deployed data (StaffAssignment):', weeksWithData)

    if (!schedule) {
      return NextResponse.json({
        success: true,
        hasSchedule: false,
        doctorSchedules: [],
        slots: [],
        weeksWithData // 스케줄 없어도 weeksWithData 반환
      })
    }

    // 원장 스케줄 조회 - 주차 범위로 확장 (이전/다음 달 포함)
    // 월 시작일이 속한 주의 일요일부터 월 마지막일이 속한 주의 토요일까지
    const firstWeekSunday = new Date(monthStart)
    const firstDayOfWeek = monthStart.getDay()
    firstWeekSunday.setDate(monthStart.getDate() - firstDayOfWeek)

    const lastWeekSaturday = new Date(monthEnd)
    const lastDayOfWeek = monthEnd.getDay()
    lastWeekSaturday.setDate(monthEnd.getDate() + (6 - lastDayOfWeek))

    const allDoctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        schedule: {
          clinicId
        },
        date: {
          gte: firstWeekSunday,
          lte: lastWeekSaturday
        }
      },
      include: {
        doctor: true,
        schedule: true
      },
      orderBy: {
        date: 'asc'
      }
    })

    // 중복 제거: 같은 날짜에 여러 스케줄의 데이터가 있을 경우
    // 1. 해당 월의 스케줄 우선
    // 2. 배포된 스케줄 우선
    // 3. 최신 스케줄 우선
    const doctorSchedulesByDate = new Map<string, typeof allDoctorSchedules>()

    allDoctorSchedules.forEach(ds => {
      const dateStr = ds.date.toISOString().split('T')[0]

      if (!doctorSchedulesByDate.has(dateStr)) {
        doctorSchedulesByDate.set(dateStr, [])
      }
      doctorSchedulesByDate.get(dateStr)!.push(ds)
    })

    // 각 날짜별로 최적의 스케줄 선택
    const doctorSchedules = Array.from(doctorSchedulesByDate.entries()).flatMap(([dateStr, schedules]) => {
      // 우선순위: 해당 월 스케줄 > 배포된 스케줄 > 최신 스케줄
      const currentMonthSchedules = schedules.filter(ds =>
        ds.schedule.year === year && ds.schedule.month === month
      )

      if (currentMonthSchedules.length > 0) {
        return currentMonthSchedules
      }

      const deployedSchedules = schedules.filter(ds => ds.schedule.status === 'DEPLOYED')
      if (deployedSchedules.length > 0) {
        return deployedSchedules
      }

      // 최신 스케줄 선택
      return schedules.sort((a, b) =>
        new Date(b.schedule.createdAt).getTime() - new Date(a.schedule.createdAt).getTime()
      ).slice(0, 3) // 같은 날짜에 최대 3명의 원장 (중복 방지를 위해 첫 번째 스케줄만)
    })

    // 휴무일 설정 조회
    const closedDaySettings = await prisma.closedDaySettings.findUnique({
      where: { clinicId }
    })

    // 정기 휴무일 (0=일요일, 1=월요일, ..., 6=토요일)
    const regularClosedDays = closedDaySettings?.regularDays
      ? (closedDaySettings.regularDays as number[])
      : []

    // 공휴일 조회 - 주차 범위에 맞춰 확장 (이전/다음 달 포함)
    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: {
          gte: firstWeekSunday,
          lte: lastWeekSaturday
        }
      }
    })

    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))

    // 해당 월에 속하는 원장 스케줄만 필터링 (통계 및 주차 계산용)
    const currentMonthDoctorSchedules = doctorSchedules.filter(ds => {
      const date = new Date(ds.date)
      return date >= monthStart && date <= monthEnd
    })

    // 원장별 근무 통계 (해당 월만)
    const doctorStats = currentMonthDoctorSchedules.reduce((acc, ds) => {
      const name = ds.doctor.name
      if (!acc[name]) {
        acc[name] = {
          doctorName: name,
          totalDays: 0,
          nightShifts: 0
        }
      }
      acc[name].totalDays++
      if (ds.hasNightShift) {
        acc[name].nightShifts++
      }
      return acc
    }, {} as Record<string, any>)

    // 원장 스케줄이 있는 날짜들이 속한 모든 주(일~토)를 수집 (해당 월만)
    const weekRanges = new Set<string>() // "YYYY-MM-DD~YYYY-MM-DD" 형태로 저장

    currentMonthDoctorSchedules.forEach(ds => {
      const date = new Date(ds.date)
      const dayOfWeek = date.getDay()

      // 해당 날짜가 속한 주의 일요일 찾기
      const sunday = new Date(date)
      sunday.setDate(date.getDate() - dayOfWeek)

      // 해당 주의 토요일
      const saturday = new Date(sunday)
      saturday.setDate(sunday.getDate() + 6)

      const weekKey = `${sunday.toISOString().split('T')[0]}~${saturday.toISOString().split('T')[0]}`
      weekRanges.add(weekKey)
    })

    console.log('[doctor-summary] Week ranges:', Array.from(weekRanges))

    // 일별 슬롯 정보 (원장 조합별로 그룹화)
    const dayOfWeekMap = ['일', '월', '화', '수', '목', '금', '토']
    const slotsByDate = doctorSchedules.reduce((acc, ds) => {
      const dayOfWeek = ds.date.getDay()

      const dateStr = ds.date.toISOString().split('T')[0]
      if (!acc[dateStr]) {
        acc[dateStr] = {
          date: dateStr,
          dayOfWeek: dayOfWeekMap[dayOfWeek],
          doctors: [],
          doctorShortNames: [],
          hasNightShift: false
        }
      }
      acc[dateStr].doctors.push(ds.doctor.name)
      acc[dateStr].doctorShortNames.push(ds.doctor.shortName)
      if (ds.hasNightShift) {
        acc[dateStr].hasNightShift = true
      }
      return acc
    }, {} as Record<string, any>)

    // 각 주의 모든 날짜(일~토)를 슬롯 목록에 추가
    const allDatesInWeeks: Record<string, any> = {}

    weekRanges.forEach(weekKey => {
      const [sundayStr, saturdayStr] = weekKey.split('~')
      const sunday = new Date(sundayStr)

      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(sunday)
        currentDate.setDate(sunday.getDate() + i)
        const dateStr = currentDate.toISOString().split('T')[0]
        const dayOfWeek = currentDate.getDay()

        // 이미 원장 스케줄이 있는 날짜는 그대로 사용
        if (slotsByDate[dateStr]) {
          allDatesInWeeks[dateStr] = slotsByDate[dateStr]
        } else {
          // 원장 스케줄이 없는 날짜는 빈 슬롯으로 추가
          allDatesInWeeks[dateStr] = {
            date: dateStr,
            dayOfWeek: dayOfWeekMap[dayOfWeek],
            doctors: [],
            doctorShortNames: [],
            hasNightShift: false,
            isClosed: true // 휴무일 표시
          }
        }
      }
    })

    // 자동 배치 부서 직원 총원 (categoryName이 있는 직원만) - 한 번만 조회
    const autoAssignDeptNames = await getAutoAssignDepartmentNamesWithFallback(clinicId)
    const totalTreatmentStaff = await prisma.staff.count({
      where: {
        clinicId,
        isActive: true,
        categoryName: { not: null },
        departmentName: { in: autoAssignDeptNames }
      }
    })

    // 모든 DoctorCombination 조회 (한 번만 조회)
    const allCombinations = await prisma.doctorCombination.findMany({
      where: {
        clinicId
      }
    })

    // 각 슬롯에 대해 DoctorCombination에서 requiredStaff 조회
    const slots = Object.values(allDatesInWeeks).map((slot: any) => {
      // 휴무일인 경우
      if (slot.isClosed) {
        return {
          date: slot.date,
          dayOfWeek: slot.dayOfWeek,
          doctors: [],
          hasNightShift: false,
          requiredStaff: 0,
          availableSlots: 0,
          isClosed: true
        }
      }

      const doctorShortNames = slot.doctorShortNames.sort().join(',')

      // 원장 조합 찾기 (배열 순서 무시하고 정렬해서 비교)
      const combination = allCombinations.find(c => {
        const combDoctors = (c.doctors as string[]).sort().join(',')
        return combDoctors === doctorShortNames && c.hasNightShift === slot.hasNightShift
      })

      const requiredStaff = combination?.requiredStaff || 0
      const availableSlots = totalTreatmentStaff - requiredStaff

      // 공휴일 여부 확인
      const isHoliday = holidayDates.has(slot.date)
      const holidayInfo = isHoliday ? holidays.find(h => h.date.toISOString().split('T')[0] === slot.date) : null

      return {
        date: slot.date,
        dayOfWeek: slot.dayOfWeek,
        doctors: slot.doctors,
        hasNightShift: slot.hasNightShift,
        requiredStaff,
        availableSlots,
        isHoliday,
        holidayName: holidayInfo?.name || null
      }
    })

    // 날짜순으로 정렬
    slots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // 실제 원장 스케줄 데이터가 있는지 확인
    const hasActualSchedule = currentMonthDoctorSchedules.length > 0

    // 전달 배포된 스케줄에서 데이터가 온 것인지 확인
    const hasDataFromPreviousMonth = doctorSchedules.some(ds =>
      ds.schedule.year !== year || ds.schedule.month !== month
    )

    return NextResponse.json({
      success: true,
      hasSchedule: hasActualSchedule,
      hasDataFromPreviousMonth, // 전달 배포 스케줄 데이터 여부
      isCurrentMonthDeployed: schedule.status === 'DEPLOYED', // 현재 월 배포 여부
      doctorSchedules: Object.values(doctorStats),
      slots,
      weekPatterns: schedule.weekPatterns || null, // 주차별 패턴 정보 추가
      weeksWithData, // 실제 데이터가 있는 주차 번호 배열 추가
      schedule: {
        id: schedule.id,
        status: schedule.status,
        deployedAt: schedule.deployedAt,
        deployedStartDate: schedule.deployedStartDate,
        deployedEndDate: schedule.deployedEndDate
      }
    })

  } catch (error) {
    console.error('Doctor schedule summary error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load doctor schedule summary' },
      { status: 500 }
    )
  }
}
