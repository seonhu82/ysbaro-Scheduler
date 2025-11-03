/**
 * 스케줄 자동 배정 API (Wizard Step 3용)
 * POST /api/schedule/auto-assign
 *
 * 주간 패턴 기반 월간 스케줄 자동 생성:
 * - 각 주에 지정된 패턴 적용
 * - 확정된 연차/오프 반영
 *
 * **배정 단계:**
 * 1. 1차 배정: 날짜 유형별 우선순위 배정
 *    - 야간진료일 → 주말 → 휴일인접일 → 일반 진료일 순서
 *    - 각 날짜마다 주4일 최대 제한 적용 (연차 포함, 주 경계: 일~토)
 *    - 형평성 기반 직원 선택:
 *      * NIGHT: 야간 형평성만 고려
 *      * WEEKEND: 1순위 총 근무일, 2순위 주말 형평성
 *      * HOLIDAY_ADJACENT: 1순위 총 근무일, 2순위 휴일인접 형평성
 *      * NORMAL: 총 근무일 형평성만
 * 2. 2차 배정: 주4일 최소 보장
 *    - 각 주차별로 4일 미만 근무한 직원 찾기
 *    - OFF 날짜 중에서 필요한 만큼 근무로 변경
 *
 * - 미리보기 데이터 생성
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { calculateStaffFairnessV2, FairnessCache, FairnessScoreV2 } from '@/lib/services/fairness-calculator-v2'

interface WeeklyPattern {
  weekNumber: number
  patternId: string
}

type DayType = 'WEEKEND' | 'NIGHT' | 'HOLIDAY_ADJACENT' | 'NORMAL'

interface StaffWithScore {
  staff: any
  fairness: FairnessScoreV2
  sortKey: number // 날짜 유형별 정렬 키
}

interface WeeklyWorkCount {
  weekKey: string // Format: "YYYY-Www" (e.g., "2024-W43")
  count: number // Work days in this week (including 연차)
}

/**
 * 주차 키 생성 (일요일 시작 기준)
 * Format: "YYYY-Www" (e.g., "2024-W43")
 * Week boundaries: Sunday to Saturday
 */
function getWeekKey(date: Date): string {
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

/**
 * 직원의 주간 근무일수 계산 (연차 포함, 이전 달 배포 범위 포함)
 *
 * @param staffId - 직원 ID
 * @param weekKey - 주차 키 (e.g., "2024-W43")
 * @param scheduleId - 스케줄 ID (현재 월)
 * @param confirmedLeaves - 확정된 연차/오프 목록
 * @param existingAssignments - 이미 배정된 근무 목록 (이번 자동 배정에서)
 * @param previousScheduleId - 이전 달 스케줄 ID (옵션)
 * @returns 해당 주의 총 근무일수 (연차 포함, OFF 제외, 이전 달 배포 범위 포함)
 */
async function calculateWeeklyWorkDays(
  staffId: string,
  weekKey: string,
  scheduleId: string,
  confirmedLeaves: any[],
  existingAssignments: Map<string, Set<string>>, // dateKey -> Set of staffIds
  previousScheduleId?: string | null
): Promise<number> {
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
  weekEnd.setDate(weekEnd.getDate() + 6) // Saturday

  let workDayCount = 0

  // 1. DB에서 이미 배정된 근무일 확인 (현재 스케줄 + 이전 스케줄)
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
      date: true
    }
  })

  workDayCount += dbAssignments.length

  // 2. 확정된 연차 확인 (ANNUAL만 카운트, OFF 제외)
  const leavesInWeek = confirmedLeaves.filter(leave => {
    const leaveDate = new Date(leave.date)
    return leave.staffId === staffId &&
           leave.leaveType === 'ANNUAL' && // 연차만 카운트
           leave.status === 'CONFIRMED' &&
           leaveDate >= weekStart &&
           leaveDate <= weekEnd
  })

  // 연차 중 이미 DB에 배정된 것 제외
  const dbAssignmentDates = new Set(dbAssignments.map(a => a.date.toISOString().split('T')[0]))
  const newLeaveDays = leavesInWeek.filter(leave => {
    const leaveDateKey = new Date(leave.date).toISOString().split('T')[0]
    return !dbAssignmentDates.has(leaveDateKey)
  })

  workDayCount += newLeaveDays.length

  // 3. 이번 배정 사이클에서 추가된 근무일 확인
  const currentDate = new Date()
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split('T')[0]
    if (existingAssignments.has(dateKey) && existingAssignments.get(dateKey)!.has(staffId)) {
      // 이미 DB에 있거나 연차로 카운트되지 않았는지 확인
      if (!dbAssignmentDates.has(dateKey)) {
        const isLeaveDay = leavesInWeek.some(leave =>
          new Date(leave.date).toISOString().split('T')[0] === dateKey
        )
        if (!isLeaveDay) {
          workDayCount++
        }
      }
    }
  }

  return workDayCount
}

/**
 * 날짜 유형 판별
 */
function getDayType(
  date: Date,
  hasNightShift: boolean,
  holidays: Date[],
  closedDays: any
): DayType {
  const dayOfWeek = date.getDay() // 0=일요일, 6=토요일

  // 1순위: 야간진료일
  if (hasNightShift) return 'NIGHT'

  // 2순위: 주말 (토요일 또는 일요일)
  if (dayOfWeek === 0 || dayOfWeek === 6) return 'WEEKEND'

  // 3순위: 휴일 인접일 (휴일 전날 또는 휴일 다음날)
  const dateStr = date.toISOString().split('T')[0]
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)
  const tomorrow = new Date(date)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const isHolidayYesterday = holidays.some(
    h => h.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]
  )
  const isHolidayTomorrow = holidays.some(
    h => h.toISOString().split('T')[0] === tomorrow.toISOString().split('T')[0]
  )

  if (isHolidayYesterday || isHolidayTomorrow) return 'HOLIDAY_ADJACENT'

  // 4순위: 평일
  return 'NORMAL'
}

/**
 * 날짜 유형별 직원 정렬
 * - NIGHT: 야간 형평성만 고려
 * - WEEKEND: 1순위 총 근무일, 2순위 주말 형평성
 * - HOLIDAY_ADJACENT: 1순위 총 근무일, 2순위 휴일인접 형평성
 * - NORMAL: 총 근무일 형평성만
 */
function sortStaffByDayType(
  staffList: StaffWithScore[],
  dayType: DayType
): StaffWithScore[] {
  const sorted = [...staffList]

  sorted.sort((a, b) => {
    switch (dayType) {
      case 'NIGHT':
        // 야간 형평성만 고려
        if (Math.abs(a.fairness.dimensions.night.deviation - b.fairness.dimensions.night.deviation) >= 0.1) {
          return b.fairness.dimensions.night.deviation - a.fairness.dimensions.night.deviation
        }
        return Math.random() - 0.5

      case 'WEEKEND':
        // 1순위: 총 근무일 점수
        if (Math.abs(a.fairness.dimensions.total.deviation - b.fairness.dimensions.total.deviation) >= 0.1) {
          return b.fairness.dimensions.total.deviation - a.fairness.dimensions.total.deviation
        }
        // 2순위: 주말 점수
        if (Math.abs(a.fairness.dimensions.weekend.deviation - b.fairness.dimensions.weekend.deviation) >= 0.1) {
          return b.fairness.dimensions.weekend.deviation - a.fairness.dimensions.weekend.deviation
        }
        return Math.random() - 0.5

      case 'HOLIDAY_ADJACENT':
        // 1순위: 총 근무일 점수
        if (Math.abs(a.fairness.dimensions.total.deviation - b.fairness.dimensions.total.deviation) >= 0.1) {
          return b.fairness.dimensions.total.deviation - a.fairness.dimensions.total.deviation
        }
        // 2순위: 휴일인접 점수
        if (Math.abs(a.fairness.dimensions.holidayAdjacent.deviation - b.fairness.dimensions.holidayAdjacent.deviation) >= 0.1) {
          return b.fairness.dimensions.holidayAdjacent.deviation - a.fairness.dimensions.holidayAdjacent.deviation
        }
        return Math.random() - 0.5

      case 'NORMAL':
      default:
        // 총 근무일 점수만
        if (Math.abs(a.fairness.dimensions.total.deviation - b.fairness.dimensions.total.deviation) >= 0.1) {
          return b.fairness.dimensions.total.deviation - a.fairness.dimensions.total.deviation
        }
        return Math.random() - 0.5
    }
  })

  return sorted
}

/**
 * 형평성 편차 체크 및 유연 배치 필요 여부 판단
 * - 편차 > 1.0: 유연 배치 필요
 * - 편차 > 3.0: 절대 상한선, 강제 배치 불가
 */
function checkFairnessDeviation(
  assignedStaff: any[],
  fairnessScores: Map<string, FairnessScoreV2>
): { needsFlexible: boolean; maxDeviation: number } {
  if (assignedStaff.length === 0) return { needsFlexible: false, maxDeviation: 0 }

  const deviations = assignedStaff.map(staff => {
    const fairness = fairnessScores.get(staff.id)
    return fairness ? Math.abs(fairness.dimensions.total.deviation) : 0
  })

  const maxDeviation = Math.max(...deviations)
  const needsFlexible = maxDeviation > 1.0

  return { needsFlexible, maxDeviation }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { year, month, forceRedeploy } = body as {
      year: number
      month: number
      forceRedeploy?: boolean
    }

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month required' },
        { status: 400 }
      )
    }

    const clinicId = (session.user as any).clinicId

    console.log(`\n🚀 직원 자동 배정 시작: ${year}년 ${month}월`)

    // ==================== 공통 데이터 사전 로드 (캐시) ====================
    console.log(`\n📦 공통 데이터 로드 중...`)

    // 1. 기존 스케줄 확인
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month
      },
      include: {
        doctors: {
          include: {
            doctor: true
          },
          orderBy: { date: 'asc' }
        }
      }
    })

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: '원장 스케줄이 먼저 생성되어야 합니다' },
        { status: 400 }
      )
    }

    // 배포된 스케줄 재배치 시 경고 반환 (forceRedeploy=true가 아닌 경우)
    if (schedule.status === 'DEPLOYED' && !forceRedeploy) {
      return NextResponse.json(
        {
          success: false,
          error: 'DEPLOYED_SCHEDULE_WARNING',
          message: `${year}년 ${month}월 스케줄은 이미 배포되었습니다.\n\n재배치를 진행하면 기존 배정이 모두 삭제되고 새로 생성됩니다.\n배포 후 다시 배포 절차를 진행해야 합니다.\n\n그래도 재배치를 진행하시겠습니까?`,
          scheduleInfo: {
            year,
            month,
            deployedAt: schedule.deployedAt,
            deployedStartDate: schedule.deployedStartDate,
            deployedEndDate: schedule.deployedEndDate
          }
        },
        { status: 409 } // 409 Conflict
      )
    }

    // 강제 재배치인 경우 DRAFT 상태로 변경
    if (schedule.status === 'DEPLOYED' && forceRedeploy) {
      console.log(`   ⚠️  배포된 스케줄 강제 재배치 시작 (forceRedeploy=true)`)
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          status: 'DRAFT',
          deployedAt: null,
          deployedStartDate: null,
          deployedEndDate: null
        }
      })
      // schedule 객체도 업데이트
      schedule.status = 'DRAFT'
      schedule.deployedAt = null
      schedule.deployedStartDate = null
      schedule.deployedEndDate = null
    }

    console.log(`   ✅ 스케줄 로드 완료 (ID: ${schedule.id})`)

    // 2. 이전 달에 배포된 날짜 범위 확인
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year

    const previousDeployedSchedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year: prevYear,
        month: prevMonth,
        status: 'DEPLOYED'
      },
      select: {
        id: true,
        deployedStartDate: true,
        deployedEndDate: true
      }
    })

    // 배포된 날짜 범위 (현재 월에 걸친 부분)
    let deployedDateRange: { start: Date; end: Date } | null = null
    if (previousDeployedSchedule?.deployedEndDate) {
      const deployedEnd = new Date(previousDeployedSchedule.deployedEndDate)
      const currentMonthStart = new Date(year, month - 1, 1) // 현재 월 1일

      // 배포 종료일이 현재 월 시작일 이후인지 확인 (이전 달 배포가 현재 월로 연장된 경우)
      if (deployedEnd >= currentMonthStart) {
        deployedDateRange = {
          start: currentMonthStart,
          end: deployedEnd
        }
        console.log(`   ⚠️  이전 달 배포 범위 감지: ${deployedDateRange.start.toISOString().split('T')[0]} ~ ${deployedDateRange.end.toISOString().split('T')[0]}`)
        console.log(`   → 해당 범위의 직원 배치는 건너뜁니다`)
      }
    }

    // 3. 의사 조합 정보 조회
    const combinations = await prisma.doctorCombination.findMany({
      where: { clinicId }
    })
    console.log(`   ✅ 의사 조합 ${combinations.length}개 로드`)

    // 3. 휴일 정보 조회
    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0)
        }
      }
    })
    const holidayDatesArray = holidays.map(h => h.date) // For getDayType function
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0])) // For Set operations
    console.log(`   ✅ 휴일 ${holidays.length}개 로드`)

    // 4. 정기휴무 정보 조회
    const closedDays = await prisma.closedDaySettings.findFirst({
      where: { clinicId }
    })
    console.log(`   ✅ 정기휴무 설정 로드`)

    // 5. 형평성 설정 조회
    const fairnessSettings = await prisma.fairnessSettings.findFirst({
      where: { clinicId }
    })
    console.log(`   ✅ 형평성 설정 로드`)

    // 6. 실제 배치 날짜 범위 계산 (주차 기준 확장)
    const doctorDates = schedule.doctors.map(d => new Date(d.date))
    const scheduleMinDate = new Date(Math.min(...doctorDates.map(d => d.getTime())))
    const scheduleMaxDate = new Date(Math.max(...doctorDates.map(d => d.getTime())))

    console.log(`   ℹ️  원장 스케줄 범위: ${scheduleMinDate.toISOString().split('T')[0]} ~ ${scheduleMaxDate.toISOString().split('T')[0]}`)

    // 7. 주차 기준으로 배치 범위 확장 (첫째 주 일요일 ~ 마지막 주 토요일)
    const firstDayOfWeek = scheduleMinDate.getDay() // 0 = Sunday
    const firstWeekSunday = new Date(scheduleMinDate)
    firstWeekSunday.setDate(scheduleMinDate.getDate() - firstDayOfWeek)

    const lastDayOfWeek = scheduleMaxDate.getDay() // 0 = Sunday
    const lastWeekSaturday = new Date(scheduleMaxDate)
    lastWeekSaturday.setDate(scheduleMaxDate.getDate() + (6 - lastDayOfWeek))

    console.log(`   📅 주차 확장 범위: ${firstWeekSunday.toISOString().split('T')[0]} (${['일','월','화','수','목','금','토'][firstWeekSunday.getDay()]}) ~ ${lastWeekSaturday.toISOString().split('T')[0]} (${['일','월','화','수','목','금','토'][lastWeekSaturday.getDay()]})`)

    // 8. 이전 달 배포 스케줄에서 첫째 주 이전 날짜의 원장 근무 가져오기
    if (firstWeekSunday < scheduleMinDate && previousDeployedSchedule) {
      console.log(`   🔍 이전 달 스케줄에서 ${firstWeekSunday.toISOString().split('T')[0]} ~ ${new Date(scheduleMinDate.getTime() - 24*60*60*1000).toISOString().split('T')[0]} 확인 중...`)

      const extendedDoctors = await prisma.scheduleDoctor.findMany({
        where: {
          scheduleId: previousDeployedSchedule.id,
          date: {
            gte: firstWeekSunday,
            lt: scheduleMinDate
          }
        },
        include: {
          doctor: true
        },
        orderBy: { date: 'asc' }
      })

      if (extendedDoctors.length > 0) {
        console.log(`   ✅ 이전 달에서 ${extendedDoctors.length}일 발견 (${extendedDoctors[0].date.toISOString().split('T')[0]} ~ ${extendedDoctors[extendedDoctors.length-1].date.toISOString().split('T')[0]}), 배치에 포함`)
        schedule.doctors.unshift(...extendedDoctors)
      } else {
        console.log(`   ⚠️  이전 달 스케줄에 원장 근무 없음, 해당 날짜는 OFF로 배치`)
      }
    }

    // 9. 다음 달로 넘어가는 마지막 주 날짜 처리 (다음 달 스케줄은 아직 없으므로 OFF로 배치)
    if (lastWeekSaturday > scheduleMaxDate) {
      console.log(`   ⚠️  마지막 주 다음 달 날짜 (${new Date(scheduleMaxDate.getTime() + 24*60*60*1000).toISOString().split('T')[0]} ~ ${lastWeekSaturday.toISOString().split('T')[0]})는 OFF로 배치`)
    }

    const actualDateRange = {
      min: firstWeekSunday,
      max: lastWeekSaturday
    }

    console.log(`   ✅ 최종 배치 범위: ${actualDateRange.min.toISOString().split('T')[0]} ~ ${actualDateRange.max.toISOString().split('T')[0]}`)

    // 캐시 객체 생성
    const fairnessCache: FairnessCache = {
      schedule,
      combinations,
      holidays,
      closedDays,
      fairnessSettings,
      actualDateRange
    }

    // 기존 직원 배치 삭제
    await prisma.staffAssignment.deleteMany({
      where: {
        scheduleId: schedule.id
      }
    })
    console.log(`   ✅ 기존 배치 삭제 완료`)

    // 모든 활성 직원 조회
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true
      }
    })
    console.log(`   ✅ 활성 직원 ${allStaff.length}명 로드`)

    // 확정된 연차/오프 조회
    const confirmedLeaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        status: 'CONFIRMED',
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0)
        }
      }
    })
    console.log(`   ✅ 확정 연차/오프 ${confirmedLeaves.length}건 로드\n`)

    // ==================== 날짜별 배치 시작 ====================
    let totalAssignments = 0
    const warnings: string[] = []
    const leavesByDate = new Map<string, Set<string>>()

    // 날짜별 연차/오프 직원 맵 생성
    for (const leave of confirmedLeaves) {
      const dateKey = new Date(leave.date).toISOString().split('T')[0]
      if (!leavesByDate.has(dateKey)) {
        leavesByDate.set(dateKey, new Set())
      }
      leavesByDate.get(dateKey)!.add(leave.staffId)
    }

    // 이번 배정 사이클에서 배정된 직원 추적 (주간 4일 제한 체크용)
    const dailyAssignments = new Map<string, Set<string>>() // dateKey -> Set of staffIds

    // 날짜별로 그룹화하여 정렬 (날짜 순서대로 배치하기 위해)
    const dateScheduleMap = new Map<string, typeof schedule.doctors>()
    for (const doctorSchedule of schedule.doctors) {
      const dateKey = new Date(doctorSchedule.date).toISOString().split('T')[0]
      if (!dateScheduleMap.has(dateKey)) {
        dateScheduleMap.set(dateKey, [])
      }
      dateScheduleMap.get(dateKey)!.push(doctorSchedule)
    }

    // 전체 주차 범위의 모든 날짜 생성 (원장 근무 없는 날도 포함)
    const allDatesInRange: string[] = []
    const currentDateIter = new Date(actualDateRange.min)
    while (currentDateIter <= actualDateRange.max) {
      allDatesInRange.push(currentDateIter.toISOString().split('T')[0])
      currentDateIter.setDate(currentDateIter.getDate() + 1)
    }

    // 날짜 유형별로 분류 및 정렬
    const datesByType = {
      NIGHT: [] as string[],
      WEEKEND: [] as string[],
      HOLIDAY_ADJACENT: [] as string[],
      NORMAL: [] as string[],
      NO_DOCTOR: [] as string[] // 원장 근무 없는 날 (모든 직원 OFF)
    }

    for (const dateKey of allDatesInRange) {
      const currentDate = new Date(dateKey + 'T00:00:00.000Z')
      const doctorsOnThisDay = dateScheduleMap.get(dateKey)

      // 원장 근무가 없는 날
      if (!doctorsOnThisDay || doctorsOnThisDay.length === 0) {
        datesByType.NO_DOCTOR.push(dateKey)
        continue
      }

      const hasNightShift = doctorsOnThisDay.some(ds => ds.hasNightShift)
      const dayType = getDayType(currentDate, hasNightShift, holidayDatesArray, closedDays)

      datesByType[dayType].push(dateKey)
    }

    // 각 유형별로 날짜순 정렬
    datesByType.NIGHT.sort()
    datesByType.WEEKEND.sort()
    datesByType.HOLIDAY_ADJACENT.sort()
    datesByType.NORMAL.sort()
    datesByType.NO_DOCTOR.sort()

    // 최종 배치 순서: 야간 → 주말 → 휴일인접 → 일반 → 원장 없는 날
    const sortedDates = [
      ...datesByType.NIGHT,
      ...datesByType.WEEKEND,
      ...datesByType.HOLIDAY_ADJACENT,
      ...datesByType.NORMAL,
      ...datesByType.NO_DOCTOR
    ]

    console.log(`📆 총 ${sortedDates.length}일 배치 시작 (우선순위: 야간 → 주말 → 휴일인접 → 일반)\n`)
    console.log(`   - 야간진료일: ${datesByType.NIGHT.length}일`)
    console.log(`   - 주말: ${datesByType.WEEKEND.length}일`)
    console.log(`   - 휴일인접일: ${datesByType.HOLIDAY_ADJACENT.length}일`)
    console.log(`   - 일반 진료일: ${datesByType.NORMAL.length}일`)
    console.log(`   - 원장 근무 없음: ${datesByType.NO_DOCTOR.length}일\n`)

    // 각 날짜를 순서대로 배정 (형평성을 실시간 반영하기 위해)
    for (const dateKey of sortedDates) {
      const doctorsOnThisDay = dateScheduleMap.get(dateKey)
      const currentDate = new Date(dateKey + 'T00:00:00.000Z')

      // 이미 배포된 날짜 범위 체크
      if (deployedDateRange && currentDate >= deployedDateRange.start && currentDate <= deployedDateRange.end) {
        console.log(`🔒 ${dateKey}: 이미 배포된 날짜 (이전 달 스케줄) - 건너뜀`)
        continue
      }

      // 원장 근무가 없는 날 처리 (모든 직원 OFF)
      if (!doctorsOnThisDay || doctorsOnThisDay.length === 0) {
        console.log(`📅 ${dateKey}: 원장 근무 없음 (모든 직원 OFF 배치)`)

        const allTreatmentStaff = allStaff.filter(s => s.departmentName === '진료실')
        for (const staff of allTreatmentStaff) {
          await prisma.staffAssignment.create({
            data: {
              scheduleId: schedule.id,
              staffId: staff.id,
              date: currentDate,
              shiftType: 'OFF'
            }
          })
        }

        console.log(`   ✅ ${dateKey} 배정 완료: OFF ${allTreatmentStaff.length}명\n`)
        continue
      }

      const doctorShortNames = doctorsOnThisDay.map(ds => ds.doctor.shortName).sort()
      const hasNightShift = doctorsOnThisDay.some(ds => ds.hasNightShift)

      // 날짜 유형 판별
      const dayType = getDayType(currentDate, hasNightShift, holidayDatesArray, closedDays)

      // 해당하는 조합 찾기
      const combination = combinations.find(c => {
        const comboDoctors = (c.doctors as string[]).sort()
        return JSON.stringify(comboDoctors) === JSON.stringify(doctorShortNames) &&
               c.hasNightShift === hasNightShift
      })

      if (!combination || !combination.requiredStaff) {
        warnings.push(`${dateKey}: 매칭되는 의사 조합을 찾을 수 없습니다`)
        continue
      }

      // 이미 이 날짜에 배정했는지 확인 (중복 방지)
      const existingAssignment = await prisma.staffAssignment.findFirst({
        where: {
          scheduleId: schedule.id,
          date: currentDate
        }
      })

      if (existingAssignment) continue // 이미 배정됨

      const unavailableStaffIds = leavesByDate.get(dateKey) || new Set()

      console.log(`📅 ${dateKey} 배정 (${dayType} 유형):`)
      console.log(`   - 원장: ${doctorShortNames.join(', ')}`)
      console.log(`   - 야간진료: ${hasNightShift ? '예' : '아니오'}`)

      // 이 날짜가 속한 주차 계산
      const currentWeekKey = getWeekKey(currentDate)
      console.log(`   - 주차: ${currentWeekKey}`)

      // 진료실 직원만 필터링 (연차/오프 제외한 가용 직원)
      const allTreatmentStaff = allStaff.filter(s =>
        s.departmentName === '진료실' &&
        !unavailableStaffIds.has(s.id)
      )

      console.log(`   - 초기 가용 진료실 직원: ${allTreatmentStaff.length}명`)

      let availableTreatmentStaff = [...allTreatmentStaff]

      // ============= 주간 4일 근무 제한 필터링 (최우선 제약) =============
      const weeklyWorkCounts = await Promise.all(
        availableTreatmentStaff.map(async staff => {
          const workDays = await calculateWeeklyWorkDays(
            staff.id,
            currentWeekKey,
            schedule.id,
            confirmedLeaves,
            dailyAssignments,
            previousDeployedSchedule?.id || null
          )
          return { staffId: staff.id, staffName: staff.name, workDays }
        })
      )

      // 이미 4일 근무한 직원 필터링
      const staffExceeding4Days = weeklyWorkCounts.filter(wc => wc.workDays >= 4)
      if (staffExceeding4Days.length > 0) {
        console.log(`   - 주4일 제한 도달 직원 (배정 제외): ${staffExceeding4Days.map(s => `${s.staffName}(${s.workDays}일)`).join(', ')}`)
      }

      const weeklyWorkCountMap = new Map(weeklyWorkCounts.map(wc => [wc.staffId, wc.workDays]))

      // 주간 4일 미만인 직원만 필터링
      availableTreatmentStaff = availableTreatmentStaff.filter(s => {
        const workDays = (weeklyWorkCountMap.get(s.id) ?? 0) as number
        return workDays < 4
      })

      console.log(`   - 주4일 제한 적용 후 가용 직원: ${availableTreatmentStaff.length}명`)

      if (availableTreatmentStaff.length === 0) {
        warnings.push(`${dateKey}: 주4일 근무 제한으로 인해 배정 가능한 직원이 없습니다`)
        console.log(`   ⚠️  경고: 배정 가능한 직원 없음 (모든 직원이 주4일 도달)`)
        continue
      }

      // 카테고리별 필요 인원 확인
      const departmentCategoryStaff = combination.departmentCategoryStaff as any
      let categoryRequirements: { [category: string]: number } = {}

      if (departmentCategoryStaff && departmentCategoryStaff['진료실']) {
        const treatmentRoomCategories = departmentCategoryStaff['진료실']
        for (const [category, config] of Object.entries(treatmentRoomCategories as any)) {
          if (config && typeof config === 'object' && 'count' in config) {
            categoryRequirements[category] = (config as any).count as number
          }
        }
      }

      console.log('   - 카테고리별 필요 인원:', categoryRequirements)

      // 카테고리별로 배치할 직원 목록
      const assignedStaff: any[] = []

      // 카테고리별로 배치
      if (Object.keys(categoryRequirements).length > 0) {
        for (const [category, required] of Object.entries(categoryRequirements)) {
          console.log(`\n   🏷️  ${category} 카테고리 배치 (필요: ${required}명):`)

          // 해당 카테고리의 가용 직원
          const categoryStaff = availableTreatmentStaff.filter(s =>
            s.categoryName === category &&
            !assignedStaff.some(as => as.id === s.id)
          )

          console.log(`      - 가용 ${category} 직원: ${categoryStaff.length}명`)

          // 형평성 점수 계산 (캐시 사용) - 진료실 부서만 고려
          const staffWithScores: StaffWithScore[] = await Promise.all(
            categoryStaff.map(async staff => {
              const fairness = await calculateStaffFairnessV2(
                staff.id,
                clinicId,
                year,
                month,
                '진료실', // 부서 필터 적용
                fairnessCache // 캐시 전달
              )

              console.log(`         - ${staff.name}: 총${fairness.dimensions.total.deviation.toFixed(1)} 야간${fairness.dimensions.night.deviation.toFixed(1)} 주말${fairness.dimensions.weekend.deviation.toFixed(1)} 휴일인접${fairness.dimensions.holidayAdjacent.deviation.toFixed(1)}`)

              return {
                staff,
                fairness,
                sortKey: fairness.dimensions.total.deviation
              }
            })
          )

          // 날짜 유형별 정렬 적용
          const sortedStaff = sortStaffByDayType(staffWithScores, dayType)

          // 필요한 만큼 배정
          const toAssignFromCategory = sortedStaff.slice(0, required)

          console.log(`      - 배정할 직원: ${toAssignFromCategory.map(s => `${s.staff.name}(${s.fairness.dimensions.total.deviation.toFixed(1)})`).join(', ')}`)

          assignedStaff.push(...toAssignFromCategory.map(s => ({
            ...s.staff,
            _isFlexible: false,
            _originalCategory: s.staff.categoryName,
            _assignedCategory: category
          })))

          // 인원 부족 시 유연 근무 가능 직원으로 채우기
          if (toAssignFromCategory.length < required) {
            const shortage = required - toAssignFromCategory.length
            console.log(`      - ⚠️  ${shortage}명 부족, 유연 직원 찾는 중...`)

            // 유연 근무 가능 직원 찾기
            const flexibleStaff = availableTreatmentStaff.filter(s =>
              s.flexibleForCategories &&
              s.flexibleForCategories.includes(category) &&
              !assignedStaff.some(as => as.id === s.id)
            )

            if (flexibleStaff.length > 0) {
              console.log(`      - 가용 유연 직원: ${flexibleStaff.length}명 (${flexibleStaff.map(s => s.name).join(', ')})`)

              // 형평성 점수 계산
              const flexibleWithScores: StaffWithScore[] = await Promise.all(
                flexibleStaff.map(async staff => {
                  const fairness = await calculateStaffFairnessV2(
                    staff.id,
                    clinicId,
                    year,
                    month,
                    '진료실',
                    fairnessCache
                  )
                  return {
                    staff,
                    fairness,
                    sortKey: fairness.dimensions.total.deviation
                  }
                })
              )

              // 날짜 유형별 정렬 + 유연 우선순위 적용
              const sortedFlexible = sortStaffByDayType(flexibleWithScores, dayType)
              sortedFlexible.sort((a, b) => {
                // 1순위: 형평성 (이미 sortStaffByDayType으로 정렬됨)
                // 2순위: 유연 우선순위
                if (Math.abs(a.fairness.dimensions.total.deviation - b.fairness.dimensions.total.deviation) < 0.1) {
                  return a.staff.flexibilityPriority - b.staff.flexibilityPriority
                }
                return 0
              })

              const flexibleToAssign = sortedFlexible.slice(0, shortage)
              console.log(`      - 유연 배정: ${flexibleToAssign.map(s => `${s.staff.name}(${s.fairness.dimensions.total.deviation.toFixed(1)})🅱️`).join(', ')}`)

              assignedStaff.push(...flexibleToAssign.map(s => ({
                ...s.staff,
                _isFlexible: true,
                _originalCategory: s.staff.categoryName,
                _assignedCategory: category
              })))
            }

            // 여전히 부족하면 경고
            if (toAssignFromCategory.length + (flexibleStaff.length > 0 ? Math.min(shortage, flexibleStaff.length) : 0) < required) {
              warnings.push(
                `${dateKey}: ${category} 카테고리 인원 부족 (${assignedStaff.filter((s: any) => s.categoryName === category || s.flexibleForCategories?.includes(category)).length}/${required})`
              )
            }
          }
        }
      } else {
        // 카테고리 구분 없이 전체 필요 인원만 배치 (레거시)
        console.log(`   ⚠️  카테고리 구분 없음, 전체 인원으로 배치`)

        const requiredStaff = combination.requiredStaff as number

        const staffWithScores: StaffWithScore[] = await Promise.all(
          availableTreatmentStaff.map(async staff => {
            const fairness = await calculateStaffFairnessV2(
              staff.id,
              clinicId,
              year,
              month,
              '진료실', // 부서 필터 적용
              fairnessCache
            )
            return {
              staff,
              fairness,
              sortKey: fairness.dimensions.total.deviation
            }
          })
        )

        // 날짜 유형별 정렬 적용
        const sortedStaff = sortStaffByDayType(staffWithScores, dayType)

        const toAssign = sortedStaff.slice(0, requiredStaff)
        assignedStaff.push(...toAssign.map(s => ({
          ...s.staff,
          _isFlexible: false,
          _originalCategory: s.staff.categoryName,
          _assignedCategory: s.staff.categoryName
        })))

        if (toAssign.length < requiredStaff) {
          warnings.push(
            `${dateKey}: 필요인원 부족 (${toAssign.length}/${requiredStaff})`
          )
        }
      }

      // DB에 배정 저장
      for (const staff of assignedStaff) {
        await prisma.staffAssignment.create({
          data: {
            scheduleId: schedule.id,
            staffId: staff.id,
            date: currentDate,
            shiftType: hasNightShift ? 'NIGHT' : 'DAY',
            isFlexible: staff._isFlexible || false,
            originalCategory: staff._originalCategory || null,
            assignedCategory: staff._assignedCategory || null
          }
        })
        totalAssignments++

        // 주간 근무일 추적 업데이트
        if (!dailyAssignments.has(dateKey)) {
          dailyAssignments.set(dateKey, new Set())
        }
        dailyAssignments.get(dateKey)!.add(staff.id)
      }

      // 나머지 진료실 직원은 OFF로 저장
      const assignedStaffIds = new Set(assignedStaff.map(s => s.id))

      // 1. 배정되지 않은 가용 직원 (allTreatmentStaff에서 제외)
      const offStaff = allTreatmentStaff.filter(s => !assignedStaffIds.has(s.id))

      // 2. unavailableStaffIds 중 LeaveApplication OFF인 직원
      const leaveOffStaffIds = Array.from(unavailableStaffIds).filter(staffId => {
        const leave = confirmedLeaves.find(l =>
          l.staffId === staffId &&
          l.date.toISOString().split('T')[0] === dateKey &&
          l.leaveType === 'OFF'
        )
        return !!leave
      })

      // 3. 모든 OFF 직원 합치기
      const allOffStaffIds = new Set([...offStaff.map(s => s.id), ...leaveOffStaffIds])

      // 4. StaffAssignment에 OFF 기록
      for (const staffId of allOffStaffIds) {
        await prisma.staffAssignment.create({
          data: {
            scheduleId: schedule.id,
            staffId: staffId,
            date: currentDate,
            shiftType: 'OFF'
          }
        })
      }

      console.log(`   ✅ ${dateKey} 배정 완료: 근무 ${assignedStaff.length}명, OFF ${allOffStaffIds.size}명 (관리자 지정 ${leaveOffStaffIds.length}명 포함)`)
    }

    console.log(`\n✅ 1차 직원 배정 완료:`)
    console.log(`   - 총 배정: ${totalAssignments}건`)
    console.log(`   - 경고: ${warnings.length}건\n`)

    // ==================== 주4일 최소 보장 로직 (추가 배치) ====================
    console.log(`\n📊 주4일 최소 보장 검사 시작...\n`)

    // 모든 주차 찾기 (전체 배치 범위 기준)
    const allWeekKeys = new Set<string>()
    for (const dateKey of allDatesInRange) {
      const date = new Date(dateKey + 'T00:00:00.000Z')
      allWeekKeys.add(getWeekKey(date))
    }

    console.log(`   📅 검사 대상 주차: ${Array.from(allWeekKeys).sort().join(', ')}\n`)

    const treatmentStaff = allStaff.filter(s => s.departmentName === '진료실')

    // 각 주차별로 처리
    for (const weekKey of Array.from(allWeekKeys).sort()) {
      console.log(`\n🗓️  ${weekKey} 주차 검사:`)

      // 이 주차에 4일 미만 근무한 직원 찾기
      const staffBelowMinimum: Array<{ staff: any; workDays: number }> = []

      for (const staff of treatmentStaff) {
        const workDays = await calculateWeeklyWorkDays(
          staff.id,
          weekKey,
          schedule.id,
          confirmedLeaves,
          dailyAssignments,
          previousDeployedSchedule?.id || null
        )

        if (workDays < 4) {
          staffBelowMinimum.push({ staff, workDays })
        }
      }

      if (staffBelowMinimum.length === 0) {
        console.log(`   ✅ 모든 직원이 주4일 충족`)
        continue
      }

      console.log(`   ⚠️  주4일 미달 직원: ${staffBelowMinimum.length}명`)
      for (const { staff, workDays } of staffBelowMinimum) {
        console.log(`      - ${staff.name}: ${workDays}일 → ${4 - workDays}일 추가 필요`)
      }

      // 이 주차에 속한 날짜들 중 OFF인 날짜 찾기
      const [yearStr, weekStr] = weekKey.split('-W')
      const year2 = parseInt(yearStr)
      const weekNumber = parseInt(weekStr)

      const firstDayOfYear = new Date(year2, 0, 1)
      const firstSunday = new Date(firstDayOfYear)
      const firstDayOfWeek = firstDayOfYear.getDay()

      if (firstDayOfWeek !== 0) {
        firstSunday.setDate(firstDayOfYear.getDate() + (7 - firstDayOfWeek))
      }

      const sundayOfWeek = new Date(firstSunday)
      sundayOfWeek.setDate(firstSunday.getDate() + (weekNumber - 1) * 7)

      const weekStart = new Date(sundayOfWeek)
      const weekEnd = new Date(sundayOfWeek)
      weekEnd.setDate(weekEnd.getDate() + 6)

      // ========== 새로운 2차 배치 로직: 날짜별 OFF 균등 분배 ==========

      // 1. 이 주차의 모든 날짜별 현재 OFF 수 계산
      const dailyOffCounts = new Map<string, number>()
      let currentDate = new Date(weekStart)
      while (currentDate <= weekEnd) {
        const dateKey = currentDate.toISOString().split('T')[0]
        if (sortedDates.includes(dateKey)) {
          const offCount = await prisma.staffAssignment.count({
            where: {
              scheduleId: schedule.id,
              date: currentDate,
              shiftType: 'OFF'
            }
          })
          dailyOffCounts.set(dateKey, offCount)
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }

      console.log(`   📊 날짜별 현재 OFF 수:`, Object.fromEntries(dailyOffCounts))

      // 2. 총 필요 배치 수 계산
      const totalNeed = staffBelowMinimum.reduce((sum, s) => sum + (4 - s.workDays), 0)
      console.log(`   📦 총 추가 배치 필요: ${totalNeed}건`)

      // 3. OFF가 많은 날부터 하나씩 배치
      let assignmentsMade = 0
      while (assignmentsMade < totalNeed) {
        // 3-1. 현재 OFF가 가장 많은 날짜 찾기
        let maxOffDate = ''
        let maxOffCount = -1
        for (const [dateKey, count] of dailyOffCounts) {
          if (count > maxOffCount) {
            maxOffCount = count
            maxOffDate = dateKey
          }
        }

        if (maxOffDate === '' || maxOffCount === 0) {
          console.log(`   ⚠️  더 이상 배치 가능한 OFF 날짜 없음`)
          break
        }

        // 3-2. 이 날짜가 OFF인 주4일 미달 직원 찾기
        const candidateStaff = []
        for (const { staff, workDays } of staffBelowMinimum) {
          const needed = 4 - workDays

          // 이미 충분히 배치된 직원은 제외
          const currentWorkDays = await calculateWeeklyWorkDays(
            staff.id,
            weekKey,
            schedule.id,
            confirmedLeaves,
            dailyAssignments,
            previousDeployedSchedule?.id || null
          )
          if (currentWorkDays >= 4) continue

          // 이 날짜에 OFF인지 확인
          const assignment = await prisma.staffAssignment.findFirst({
            where: {
              scheduleId: schedule.id,
              staffId: staff.id,
              date: new Date(maxOffDate + 'T00:00:00.000Z'),
              shiftType: 'OFF'
            }
          })

          if (assignment) {
            // 형평성 점수 계산
            const fairness = await calculateStaffFairnessV2(
              staff.id,
              clinicId,
              year,
              month,
              '진료실',
              { ...fairnessCache, schedule: undefined }
            )
            candidateStaff.push({ staff, fairness })
          }
        }

        if (candidateStaff.length === 0) {
          console.log(`   ⚠️  ${maxOffDate}에 배치 가능한 직원 없음, OFF 수 유지`)
          dailyOffCounts.set(maxOffDate, 0) // 이 날짜는 더 이상 선택 안되도록
          continue
        }

        // 3-3. 형평성 기준으로 정렬 (deviation 큰 순 = 덜 일한 순)
        candidateStaff.sort((a, b) => b.fairness.dimensions.total.deviation - a.fairness.dimensions.total.deviation)
        const selected = candidateStaff[0]

        // 3-4. OFF를 근무로 변경
        const selectedDate = new Date(maxOffDate + 'T00:00:00.000Z')
        const doctorSchedule = await prisma.scheduleDoctor.findFirst({
          where: {
            scheduleId: schedule.id,
            date: selectedDate
          }
        })

        if (!doctorSchedule) {
          console.log(`   ⚠️  ${maxOffDate}의 의사 스케줄 없음`)
          dailyOffCounts.set(maxOffDate, 0)
          continue
        }

        const hasNightShift = doctorSchedule.hasNightShift

        await prisma.staffAssignment.update({
          where: {
            scheduleId_staffId_date: {
              scheduleId: schedule.id,
              staffId: selected.staff.id,
              date: selectedDate
            }
          },
          data: {
            shiftType: hasNightShift ? 'NIGHT' : 'DAY'
          }
        })

        // 3-5. 상태 업데이트
        dailyOffCounts.set(maxOffDate, maxOffCount - 1)
        if (!dailyAssignments.has(maxOffDate)) {
          dailyAssignments.set(maxOffDate, new Set())
        }
        dailyAssignments.get(maxOffDate)!.add(selected.staff.id)

        assignmentsMade++
        totalAssignments++
        console.log(`   ✅ ${maxOffDate} (OFF ${maxOffCount}→${maxOffCount-1}): ${selected.staff.name} 배치 (deviation: ${selected.fairness.dimensions.total.deviation.toFixed(1)})`)
      }

      console.log(`   📊 최종 날짜별 OFF 수:`, Object.fromEntries(dailyOffCounts))
    }

    console.log(`\n✅ 주4일 최소 보장 완료\n`)

    // 최종 평균 형평성 계산 (진료실 직원만)
    const fairnessScores = await Promise.all(
      treatmentStaff.map(staff => calculateStaffFairnessV2(staff.id, clinicId, year, month, '진료실', fairnessCache))
    )
    const averageFairness = fairnessScores.length > 0 ? Math.round(
      fairnessScores.reduce((sum, s) => sum + s.overallScore, 0) / fairnessScores.length
    ) : 0

    console.log(`\n✅ 최종 배정 완료:`)
    console.log(`   - 총 배정: ${totalAssignments}건`)
    console.log(`   - 평균 형평성: ${averageFairness}점`)

    // 미리보기 데이터 생성
    const preview = {
      totalAssignments,
      averageFairness
    }

    return NextResponse.json({
      success: true,
      preview,
      result: {
        scheduleId: schedule.id,
        totalAssignments,
        averageFairness,
        warnings
      },
      warnings
    })

  } catch (error) {
    console.error('Auto-assign error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to auto-assign schedule' },
      { status: 500 }
    )
  }
}
