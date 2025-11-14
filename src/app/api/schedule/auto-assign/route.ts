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
import { updateStaffFairnessScores } from '@/lib/services/fairness-score-update-service'
import { getAutoAssignDepartmentNamesWithFallback } from '@/lib/utils/department-utils'
import { recalculateFinalFairness, loadCumulativeFairness } from '@/lib/services/fairness-snapshot'

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

  // 해당 주의 일요일 계산 (UTC 기준)
  const firstDayOfYear = new Date(Date.UTC(year, 0, 1))
  const firstSunday = new Date(firstDayOfYear)
  const firstDayOfWeek = firstDayOfYear.getUTCDay()

  if (firstDayOfWeek !== 0) {
    firstSunday.setUTCDate(firstDayOfYear.getUTCDate() + (7 - firstDayOfWeek))
  }

  const sundayOfWeek = new Date(firstSunday)
  sundayOfWeek.setUTCDate(firstSunday.getUTCDate() + (weekNumber - 1) * 7)

  // 해당 주의 날짜 범위 (일요일 ~ 토요일)
  const weekStart = new Date(sundayOfWeek)
  const weekEnd = new Date(sundayOfWeek)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6) // Saturday

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
  let totalAssignments = 0
  let averageFairness = 0

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

    // ==================== 자동 배치 대상 부서 조회 ====================
    const autoAssignDepartments = await getAutoAssignDepartmentNamesWithFallback(clinicId)
    console.log(`📋 자동 배치 대상 부서: ${autoAssignDepartments.join(', ')}`)

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

    // 배포된 날짜 범위 (이전 달 배포 전체 범위)
    let deployedDateRange: { start: Date; end: Date } | null = null
    if (previousDeployedSchedule?.deployedStartDate && previousDeployedSchedule?.deployedEndDate) {
      const deployedStart = new Date(previousDeployedSchedule.deployedStartDate)
      const deployedEnd = new Date(previousDeployedSchedule.deployedEndDate)

      // 이전 달 배포의 전체 날짜 범위를 보호
      // (예: 1월 배포가 12/30~2/1이면, 2월 자동 배정 시 12/30~2/1 모두 건너뜀)
      deployedDateRange = {
        start: deployedStart,
        end: deployedEnd
      }
      console.log(`   ⚠️  이전 달 배포 범위 감지: ${deployedDateRange.start.toISOString().split('T')[0]} ~ ${deployedDateRange.end.toISOString().split('T')[0]}`)
      console.log(`   → 해당 범위의 직원 배치는 건너뜁니다`)
    }

    // 3. 주 근무일 설정 조회
    const ruleSettings = await prisma.ruleSettings.findUnique({
      where: { clinicId }
    })
    const weekBusinessDays = ruleSettings?.weekBusinessDays || 6 // 주 영업일 (기본값 6)
    const defaultWorkDays = ruleSettings?.defaultWorkDays || 4 // 주 근무일 (기본값 4)
    console.log(`   ✅ 주 영업일: ${weekBusinessDays}일, 주 근무일: ${defaultWorkDays}일`)

    // 4. 의사 조합 정보 조회
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

    // 이전 달들의 누적 근무일 로드
    const cumulativeActual = month > 1 ? await loadCumulativeFairness(clinicId, year, month) : {}

    // 캐시 객체 생성
    const fairnessCache: FairnessCache = {
      schedule,
      combinations,
      holidays,
      closedDays,
      fairnessSettings,
      actualDateRange,
      cumulativeActual
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
      },
      include: {
        staff: { select: { name: true } }
      }
    })
    const annualCount = confirmedLeaves.filter(l => l.leaveType === 'ANNUAL').length
    const offCount = confirmedLeaves.filter(l => l.leaveType === 'OFF').length
    console.log(`   ✅ 확정 연차/오프 ${confirmedLeaves.length}건 로드 (연차: ${annualCount}, 오프: ${offCount})`)

    // OFF 상세 로그
    const offLeaves = confirmedLeaves.filter(l => l.leaveType === 'OFF')
    if (offLeaves.length > 0) {
      console.log(`   📋 승인된 OFF 목록:`)
      offLeaves.forEach(leave => {
        console.log(`      - ${(leave.staff as any).name}: ${new Date(leave.date).toISOString().split('T')[0]}`)
      })
    }

    // 보류된 연차/오프 조회 (후순위 배치용)
    const onHoldLeaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        status: 'ON_HOLD',
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0)
        }
      }
    })
    console.log(`   ⏳ 보류 연차/오프 ${onHoldLeaves.length}건 로드 (후순위 배치)\n`)

    // ==================== 날짜별 배치 시작 ====================
    const warnings: string[] = []
    const leavesByDate = new Map<string, Set<string>>()
    const onHoldByDate = new Map<string, Set<string>>()

    // 날짜별 확정 연차/오프 직원 맵 생성 (배치 제외)
    for (const leave of confirmedLeaves) {
      const dateKey = new Date(leave.date).toISOString().split('T')[0]
      if (!leavesByDate.has(dateKey)) {
        leavesByDate.set(dateKey, new Set())
      }
      leavesByDate.get(dateKey)!.add(leave.staffId)
    }

    // 날짜별 보류 연차/오프 직원 맵 생성 (후순위 배치)
    for (const leave of onHoldLeaves) {
      const dateKey = new Date(leave.date).toISOString().split('T')[0]
      if (!onHoldByDate.has(dateKey)) {
        onHoldByDate.set(dateKey, new Set())
      }
      onHoldByDate.get(dateKey)!.add(leave.staffId)
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

      // 원장 근무가 없는 날 처리 (자동 배치 대상 부서의 모든 직원 OFF)
      if (!doctorsOnThisDay || doctorsOnThisDay.length === 0) {
        console.log(`📅 ${dateKey}: 원장 근무 없음 (모든 직원 OFF 배치)`)

        const allAutoAssignStaff = allStaff.filter(s => autoAssignDepartments.includes(s.departmentName ?? ''))
        for (const staff of allAutoAssignStaff) {
          await prisma.staffAssignment.create({
            data: {
              scheduleId: schedule.id,
              staffId: staff.id,
              date: currentDate,
              shiftType: 'OFF'
            }
          })
        }

        console.log(`   ✅ ${dateKey} 배정 완료: OFF ${allAutoAssignStaff.length}명\n`)
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
      if (unavailableStaffIds.size > 0) {
        const unavailableNames = confirmedLeaves
          .filter(l => new Date(l.date).toISOString().split('T')[0] === dateKey)
          .map(l => `${(l.staff as any).name}(${l.leaveType})`)
        console.log(`   - 배치 제외 (연차/오프): ${unavailableNames.join(', ')}`)
      }

      // 이 날짜가 속한 주차 계산
      const currentWeekKey = getWeekKey(currentDate)
      console.log(`   - 주차: ${currentWeekKey}`)

      // 자동 배치 대상 부서 직원만 필터링 (확정 연차/오프 제외한 가용 직원)
      const onHoldStaffIds = onHoldByDate.get(dateKey) || new Set()
      const allAutoAssignDeptStaff = allStaff.filter(s =>
        autoAssignDepartments.includes(s.departmentName ?? '') &&
        !unavailableStaffIds.has(s.id)
      ).sort((a, b) => {
        // 보류 직원을 후순위로 정렬
        const aIsOnHold = onHoldStaffIds.has(a.id)
        const bIsOnHold = onHoldStaffIds.has(b.id)
        if (aIsOnHold && !bIsOnHold) return 1  // a가 보류면 뒤로
        if (!aIsOnHold && bIsOnHold) return -1 // b가 보류면 뒤로
        return 0 // 둘 다 보류거나 둘 다 일반이면 순서 유지
      })

      const onHoldCount = Array.from(onHoldStaffIds).filter(id =>
        allAutoAssignDeptStaff.some(s => s.id === id)
      ).length

      console.log(`   - 초기 가용 직원: ${allAutoAssignDeptStaff.length}명 (${autoAssignDepartments.join(', ')})${onHoldCount > 0 ? ` [보류 ${onHoldCount}명 후순위]` : ''}`)

      let availableTreatmentStaff = [...allAutoAssignDeptStaff]

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

      // 카테고리별 필요 인원 확인 (자동 배치 대상 부서만)
      const departmentCategoryStaff = combination.departmentCategoryStaff as any
      let categoryRequirements: { [category: string]: number } = {}

      // 자동 배치 대상 부서들에서 카테고리별 필요 인원 수집
      if (departmentCategoryStaff) {
        for (const deptName of autoAssignDepartments) {
          if (departmentCategoryStaff[deptName]) {
            const deptCategories = departmentCategoryStaff[deptName]
            for (const [category, config] of Object.entries(deptCategories as any)) {
              if (config && typeof config === 'object' && 'count' in config) {
                const count = (config as any).count as number
                categoryRequirements[category] = (categoryRequirements[category] || 0) + count
              }
            }
          }
        }
      }

      console.log('   - 카테고리별 필요 인원 (자동 배치 부서):', categoryRequirements)

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

          // 형평성 점수 계산 (캐시 사용) - 해당 직원의 부서로 필터 적용
          const staffWithScores: StaffWithScore[] = await Promise.all(
            categoryStaff.map(async staff => {
              const fairness = await calculateStaffFairnessV2(
                staff.id,
                clinicId,
                year,
                month,
                staff.departmentName ?? undefined, // 직원의 부서로 필터 적용
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
                    staff.departmentName ?? undefined,
                    fairnessCache
                  )
                  return {
                    staff,
                    fairness,
                    sortKey: fairness.dimensions.total.deviation
                  }
                })
              )

              // 날짜 유형별 정렬 적용 (형평성 기반)
              const sortedFlexible = sortStaffByDayType(flexibleWithScores, dayType)

              const flexibleToAssign = sortedFlexible.slice(0, shortage)
              console.log(`      - 유연 배정: ${flexibleToAssign.map(s => `${s.staff.name}(${s.fairness.dimensions.total.deviation.toFixed(1)})🅱️`).join(', ')}`)

              assignedStaff.push(...flexibleToAssign.map(s => ({
                ...s.staff,
                _isFlexible: true,
                _originalCategory: s.staff.categoryName,
                _assignedCategory: category
              })))
            }

            // 1차 배치 시점 경고는 skip (2차 배치 후 최종 검증에서 확인)
            // const actualAssigned = assignedStaff.filter((s: any) =>
            //   s.categoryName === category ||
            //   s._assignedCategory === category ||
            //   s.flexibleForCategories?.includes(category)
            // ).length

            // if (actualAssigned < required) {
            //   warnings.push(
            //     `${dateKey}: ${category} 카테고리 인원 부족 (${actualAssigned}/${required})`
            //   )
            // }
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
              staff.departmentName ?? undefined, // 직원의 부서로 필터 적용
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

      // 나머지 자동 배치 부서 직원은 OFF로 저장
      const assignedStaffIds = new Set(assignedStaff.map(s => s.id))

      // 1. 배정되지 않은 가용 직원 (allAutoAssignDeptStaff에서 제외)
      const offStaff = allAutoAssignDeptStaff.filter(s => !assignedStaffIds.has(s.id))

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

    const autoAssignStaff = allStaff.filter(s => autoAssignDepartments.includes(s.departmentName ?? ''))

    // 각 주차별로 처리
    for (const weekKey of Array.from(allWeekKeys).sort()) {
      console.log(`\n🗓️  ${weekKey} 주차 검사:`)

      // 이 주차에 4일 미만 근무한 직원 찾기
      const staffBelowMinimum: Array<{ staff: any; workDays: number }> = []

      for (const staff of autoAssignStaff) {
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


    console.log(`\n✅ 주4일 최소 보장 완료`)
    console.log(`========== 주4일 최소 보장 완료 ==========\n`)

    // ==================== 2차 배치: 주별 OFF 목표값 기준 균등 배치 ====================
    console.log(`\n========== 2차 배치 시작: 주별 OFF 균등화 ==========`)

    // allWeekKeys는 이미 1012줄에서 선언됨 (주4일 보장 로직에서 사용)
    console.log(`\n📅 배치 범위 주차: ${Array.from(allWeekKeys).sort().join(', ')}`)

    // autoAssignStaff는 이미 1020줄에서 선언됨
    const offTarget = (weekBusinessDays - defaultWorkDays) * autoAssignStaff.length
    console.log(`📊 주별 OFF 목표값: ${offTarget}건 = (${weekBusinessDays} - ${defaultWorkDays}) × ${autoAssignStaff.length}명\n`)

    // 각 주차별로 OFF 목표값 달성
    let phase2Adjustments = 0
    for (const weekKey of Array.from(allWeekKeys).sort()) {
      // 주차 날짜 범위 계산 (UTC 기준)
      const [yearStr, weekStr] = weekKey.split('-W')
      const weekYear = parseInt(yearStr)
      const weekNumber = parseInt(weekStr)

      const firstDayOfYear = new Date(Date.UTC(weekYear, 0, 1))
      const firstSunday = new Date(firstDayOfYear)
      const firstDayOfWeek = firstDayOfYear.getUTCDay()
      if (firstDayOfWeek !== 0) {
        firstSunday.setUTCDate(firstDayOfYear.getUTCDate() + (7 - firstDayOfWeek))
      }

      const sundayOfWeek = new Date(firstSunday)
      sundayOfWeek.setUTCDate(firstSunday.getUTCDate() + (weekNumber - 1) * 7)
      const weekStart = new Date(sundayOfWeek)
      const weekEnd = new Date(sundayOfWeek)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)

      console.log(`\n🗓️  ${weekKey} (${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]}):`)

      // A. 현재 OFF 수 집계 (일요일 정기휴무 제외)
      const allAssignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          date: { gte: weekStart, lte: weekEnd },
          shiftType: 'OFF'
        },
        select: { date: true }
      })

      // 일요일 OFF와 영업일 OFF 분리
      const sundayOff = allAssignments.filter(a => a.date.getUTCDay() === 0).length
      const businessDayOff = allAssignments.filter(a => a.date.getUTCDay() !== 0).length
      const currentOffCount = businessDayOff

      console.log(`   - 현재 OFF: ${currentOffCount}건 (영업일) + ${sundayOff}건 (일요일) = ${allAssignments.length}건 (총합)`)
      console.log(`   - 목표 OFF: ${offTarget}건`)

      const diff = offTarget - currentOffCount
      if (diff === 0) {
        console.log(`   ✅ OFF 목표 달성`)
        continue
      }

      console.log(`   ${diff > 0 ? '⚠️' : '📊'} 조정 필요: ${diff > 0 ? '+' : ''}${diff}건 (${diff > 0 ? '근무→OFF' : 'OFF→근무'})`)

      // B. 조정 실행
      let weekAdjustments = 0
      if (diff > 0) {
        // 근무 → OFF 변경 (주4일 초과 직원 대상)
        for (let i = 0; i < diff; i++) {
          // B-1. 주4일 초과한 직원 찾기
          const candidates = []
          for (const staff of autoAssignStaff) {
            const workDays = await calculateWeeklyWorkDays(
              staff.id, weekKey, schedule.id, confirmedLeaves,
              dailyAssignments, previousDeployedSchedule?.id || null
            )
            if (workDays > defaultWorkDays) {
              candidates.push({ staff, workDays })
            }
          }

          if (candidates.length === 0) {
            console.log(`      ⚠️ 주${defaultWorkDays}일 초과 직원 없음, ${i}/${diff}건 조정 후 중단`)
            console.log(`      ⚠️ ${weekKey} 최종 OFF: ${currentOffCount + weekAdjustments}/${offTarget}건 (${offTarget - currentOffCount - weekAdjustments}건 부족)`)
            break
          }

          // B-2. OFF가 가장 적은 날짜의 근무 중에서 형평성 편차 낮은 직원 선택
          let bestCandidate: any = null
          let bestDate: Date | null = null
          let minOffCount = Infinity
          let bestFairness = Infinity

          // 먼저 OFF가 가장 적은 날짜 찾기
          const dateOffCounts = new Map<string, number>()
          for (const { staff } of candidates) {
            const workAssignments = await prisma.staffAssignment.findMany({
              where: {
                scheduleId: schedule.id,
                staffId: staff.id,
                date: { gte: weekStart, lte: weekEnd },
                shiftType: { in: ['DAY', 'NIGHT'] }
              }
            })

            for (const assignment of workAssignments) {
              const dateKey = assignment.date.toISOString().split('T')[0]
              if (!dateOffCounts.has(dateKey)) {
                const offCount = await prisma.staffAssignment.count({
                  where: {
                    scheduleId: schedule.id,
                    date: assignment.date,
                    shiftType: 'OFF'
                  }
                })
                dateOffCounts.set(dateKey, offCount)
              }
            }
          }

          // OFF가 가장 적은 날짜 선택
          let targetDate: Date | null = null
          for (const [dateKey, offCount] of dateOffCounts.entries()) {
            if (offCount < minOffCount) {
              minOffCount = offCount
              targetDate = new Date(dateKey + 'T00:00:00.000Z')
            }
          }

          if (!targetDate) {
            console.log(`      ⚠️ 변경 가능한 근무 없음, ${i}/${diff}건 조정 후 중단`)
            console.log(`      ⚠️ ${weekKey} 최종 OFF: ${currentOffCount + weekAdjustments}/${offTarget}건 (${offTarget - currentOffCount - weekAdjustments}건 부족)`)
            break
          }

          // 해당 날짜에 근무 중인 후보들의 형평성 계산
          const targetDateDOW = targetDate.getUTCDay()
          const isWeekend = targetDateDOW === 0 || targetDateDOW === 6

          for (const { staff } of candidates) {
            const assignment = await prisma.staffAssignment.findUnique({
              where: {
                scheduleId_staffId_date: {
                  scheduleId: schedule.id,
                  staffId: staff.id,
                  date: targetDate
                }
              }
            })

            if (!assignment || assignment.shiftType === 'OFF') continue

            // 이 직원의 현재 형평성 계산
            const staffFairness = await calculateStaffFairnessV2(
              staff.id,
              clinicId,
              year,
              month,
              staff.departmentName ?? undefined,
              fairnessCache
            )

            // 종합 편차 계산: 총 근무일 + 해당 날짜 특성에 따른 편차
            // 음수 = 많이 근무, 양수 = 적게 근무
            // 근무→OFF는 음수(많이 근무)인 직원 우선 = 편차가 낮을수록 좋음
            let totalDeviation = staffFairness.dimensions.total.deviation

            // 야근이면 야근 편차 추가
            if (assignment.shiftType === 'NIGHT') {
              totalDeviation += staffFairness.dimensions.night.deviation
            }

            // 주말이면 주말 편차 추가
            if (isWeekend) {
              totalDeviation += staffFairness.dimensions.weekend.deviation
            }

            // 편차가 가장 낮은(음수 값이 큰) 직원 선택
            if (totalDeviation < bestFairness) {
              bestFairness = totalDeviation
              bestCandidate = { staff, assignment }
              bestDate = targetDate
            }
          }

          if (!bestCandidate) {
            console.log(`      ⚠️ 변경 가능한 근무 없음, ${i}/${diff}건 조정 후 중단`)
            console.log(`      ⚠️ ${weekKey} 최종 OFF: ${currentOffCount + weekAdjustments}/${offTarget}건 (${offTarget - currentOffCount - weekAdjustments}건 부족)`)
            break
          }

          // B-3. 근무 → OFF 변경
          await prisma.staffAssignment.update({
            where: {
              scheduleId_staffId_date: {
                scheduleId: schedule.id,
                staffId: bestCandidate.staff.id,
                date: bestCandidate.assignment.date
              }
            },
            data: { shiftType: 'OFF' }
          })

          phase2Adjustments++
          weekAdjustments++
          console.log(`      ✅ [${i + 1}/${diff}] ${bestDate!.toISOString().split('T')[0]}: ${bestCandidate.staff.name} 근무→OFF`)
        }
      } else {
        // OFF → 근무 변경 (주4일 미달 직원 대상)
        for (let i = 0; i < Math.abs(diff); i++) {
          // B-1. 주4일 미달 직원 찾기
          const candidates = []
          for (const staff of autoAssignStaff) {
            const workDays = await calculateWeeklyWorkDays(
              staff.id, weekKey, schedule.id, confirmedLeaves,
              dailyAssignments, previousDeployedSchedule?.id || null
            )
            if (workDays < defaultWorkDays) {
              candidates.push({ staff, workDays })
            }
          }

          if (candidates.length === 0) {
            console.log(`      ⚠️ 주${defaultWorkDays}일 미달 직원 없음, ${i}/${Math.abs(diff)}건 조정 후 중단`)
            console.log(`      ⚠️ ${weekKey} 최종 OFF: ${currentOffCount - weekAdjustments}/${offTarget}건 (${currentOffCount - weekAdjustments - offTarget}건 초과)`)
            break
          }

          // B-2. OFF가 가장 많은 날짜의 OFF 중에서 형평성 편차 높은 직원 선택 (원장 근무 있는 날만)
          let bestCandidate: any = null
          let bestDate: Date | null = null
          let maxOffCount = -1
          let bestFairness = -Infinity

          // 먼저 OFF가 가장 많은 날짜 찾기 (원장 근무 있는 날만)
          const dateOffCounts = new Map<string, { count: number, doctorSchedule: any }>()
          for (const { staff } of candidates) {
            const offAssignments = await prisma.staffAssignment.findMany({
              where: {
                scheduleId: schedule.id,
                staffId: staff.id,
                date: { gte: weekStart, lte: weekEnd },
                shiftType: 'OFF'
              }
            })

            for (const assignment of offAssignments) {
              const dateKey = assignment.date.toISOString().split('T')[0]
              if (!dateOffCounts.has(dateKey)) {
                // 원장 스케줄 확인
                const doctorSchedule = await prisma.scheduleDoctor.findFirst({
                  where: { scheduleId: schedule.id, date: assignment.date }
                })

                if (!doctorSchedule) continue // 원장 근무 없는 날은 건너뛰기

                const offCount = await prisma.staffAssignment.count({
                  where: {
                    scheduleId: schedule.id,
                    date: assignment.date,
                    shiftType: 'OFF'
                  }
                })
                dateOffCounts.set(dateKey, { count: offCount, doctorSchedule })
              }
            }
          }

          // OFF가 가장 많은 날짜 선택
          let targetDate: Date | null = null
          let targetDoctorSchedule: any = null
          for (const [dateKey, { count, doctorSchedule }] of dateOffCounts.entries()) {
            if (count > maxOffCount) {
              maxOffCount = count
              targetDate = new Date(dateKey + 'T00:00:00.000Z')
              targetDoctorSchedule = doctorSchedule
            }
          }

          if (!targetDate) {
            console.log(`      ⚠️ 변경 가능한 OFF 없음 (원장 근무 있는 날 중), ${i}/${Math.abs(diff)}건 조정 후 중단`)
            console.log(`      ⚠️ ${weekKey} 최종 OFF: ${currentOffCount - weekAdjustments}/${offTarget}건 (${currentOffCount - weekAdjustments - offTarget}건 초과)`)
            break
          }

          // 해당 날짜에 OFF인 후보들의 형평성 계산
          const targetDateDOW = targetDate.getUTCDay()
          const isWeekend = targetDateDOW === 0 || targetDateDOW === 6
          const hasNightShift = targetDoctorSchedule.hasNightShift

          for (const { staff } of candidates) {
            const assignment = await prisma.staffAssignment.findUnique({
              where: {
                scheduleId_staffId_date: {
                  scheduleId: schedule.id,
                  staffId: staff.id,
                  date: targetDate
                }
              }
            })

            if (!assignment || assignment.shiftType !== 'OFF') continue

            // 이 직원의 현재 형평성 계산
            const staffFairness = await calculateStaffFairnessV2(
              staff.id,
              clinicId,
              year,
              month,
              staff.departmentName ?? undefined,
              fairnessCache
            )

            // 종합 편차 계산: 총 근무일 + 해당 날짜 특성에 따른 편차
            // 음수 = 많이 근무, 양수 = 적게 근무
            // OFF→근무는 양수(적게 근무)인 직원 우선 = 편차가 높을수록 좋음
            let totalDeviation = staffFairness.dimensions.total.deviation

            // 야근이면 야근 편차 추가
            if (hasNightShift) {
              totalDeviation += staffFairness.dimensions.night.deviation
            }

            // 주말이면 주말 편차 추가
            if (isWeekend) {
              totalDeviation += staffFairness.dimensions.weekend.deviation
            }

            // 편차가 가장 높은(양수 값이 큰) 직원 선택
            if (totalDeviation > bestFairness) {
              bestFairness = totalDeviation
              bestCandidate = { staff, assignment, doctorSchedule: targetDoctorSchedule }
              bestDate = targetDate
            }
          }

          if (!bestCandidate) {
            console.log(`      ⚠️ 변경 가능한 OFF 없음 (원장 근무 있는 날 중), ${i}/${Math.abs(diff)}건 조정 후 중단`)
            console.log(`      ⚠️ ${weekKey} 최종 OFF: ${currentOffCount - weekAdjustments}/${offTarget}건 (${currentOffCount - weekAdjustments - offTarget}건 초과)`)
            break
          }

          // B-3. OFF → 근무 변경
          await prisma.staffAssignment.update({
            where: {
              scheduleId_staffId_date: {
                scheduleId: schedule.id,
                staffId: bestCandidate.staff.id,
                date: bestDate!
              }
            },
            data: {
              shiftType: bestCandidate.doctorSchedule.hasNightShift ? 'NIGHT' : 'DAY'
            }
          })

          phase2Adjustments++
          weekAdjustments++
          totalAssignments++
          console.log(`      ✅ [${i + 1}/${Math.abs(diff)}] ${bestDate!.toISOString().split('T')[0]}: ${bestCandidate.staff.name} OFF→근무`)
        }
      }
    }

    console.log(`\n✅ 2차 배치 완료: ${phase2Adjustments}건 조정`)
    console.log(`========== 2차 배치 완료 ==========\n`)

    // ==================== 최종 검증: 2차 배치 완료 후 실제 배치 결과 확인 ====================
    console.log(`\n========== 최종 검증 시작 (2차 배치 완료 기준) ==========`)

    // 공휴일 목록 조회 (주4일/오프 검증에서 제외용)
    const holidaysForValidation = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: {
          gte: actualDateRange.min,
          lte: actualDateRange.max
        }
      }
    })
    const holidayDatesSet = new Set(
      holidaysForValidation.map(h => h.date.toISOString().split('T')[0])
    )

    // 주별 주4일 근무 및 오프 검증
    const weeklyValidation = new Map<string, { staffId: string, workDays: number, offDays: number, dates: string[] }>()

    // 모든 직원의 배치 조회
    const allAssignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id
      },
      orderBy: {
        date: 'asc'
      }
    })

    // 주별로 그룹화
    for (const assignment of allAssignments) {
      const dateStr = assignment.date.toISOString().split('T')[0]
      const weekKeyStr = getWeekKey(assignment.date)
      const weekKey = `${assignment.staffId}-${weekKeyStr}`

      if (!weeklyValidation.has(weekKey)) {
        weeklyValidation.set(weekKey, {
          staffId: assignment.staffId,
          workDays: 0,
          offDays: 0,
          dates: []
        })
      }

      const weekData = weeklyValidation.get(weekKey)!
      weekData.dates.push(dateStr)

      if (assignment.shiftType === 'DAY' || assignment.shiftType === 'NIGHT') {
        weekData.workDays++
      } else if (assignment.shiftType === 'OFF') {
        weekData.offDays++
      }
    }

    // 주4일 및 오프 검증 (공휴일 있는 주는 제외)
    for (const [weekKey, data] of weeklyValidation.entries()) {
      // 해당 주에 공휴일이 있는지 확인
      const hasHoliday = data.dates.some(dateStr => holidayDatesSet.has(dateStr))

      if (hasHoliday) {
        continue // 공휴일 있는 주는 검증 제외
      }

      const staff = autoAssignStaff.find(s => s.id === data.staffId)
      if (!staff) continue

      // ruleSettings의 defaultWorkDays를 우선 사용 (전체 규칙이 개별 설정보다 우선)
      const expectedWorkDays = defaultWorkDays
      const expectedOffDays = weekBusinessDays - expectedWorkDays

      // 주4일 미달 검증
      if (data.workDays < expectedWorkDays) {
        const weekStartStr = weekKey.split('-').slice(1).join('-')
        warnings.push(
          `${staff.name} (${weekStartStr} 주): 주${expectedWorkDays}일 근무 미달 (실제: ${data.workDays}일) - 검토 요망`
        )
      }

      // 오프 미달 검증 (100% 미충족)
      if (data.offDays < expectedOffDays) {
        const weekStartStr = weekKey.split('-').slice(1).join('-')
        warnings.push(
          `${staff.name} (${weekStartStr} 주): 오프 ${expectedOffDays}일 미달 (실제: ${data.offDays}일) - 검토 요망`
        )
      }
    }

    // 날짜별 필요 인원 vs 배치 인원 검증
    const dateStaffCount = new Map<string, number>()
    for (const assignment of allAssignments) {
      if (assignment.shiftType === 'DAY' || assignment.shiftType === 'NIGHT') {
        const dateStr = assignment.date.toISOString().split('T')[0]
        dateStaffCount.set(dateStr, (dateStaffCount.get(dateStr) || 0) + 1)
      }
    }

    // 각 날짜의 필요 인원 확인
    const scheduleDoctorsForValidation = await prisma.scheduleDoctor.findMany({
      where: {
        scheduleId: schedule.id
      }
    })

    const doctorsByDate = new Map<string, typeof scheduleDoctorsForValidation>()
    for (const sd of scheduleDoctorsForValidation) {
      const dateStr = sd.date.toISOString().split('T')[0]
      if (!doctorsByDate.has(dateStr)) {
        doctorsByDate.set(dateStr, [])
      }
      doctorsByDate.get(dateStr)!.push(sd)
    }

    for (const [dateStr, doctors] of doctorsByDate.entries()) {
      const doctorNames = Array.from(new Set(doctors.map(d => d.doctorId))).sort()
      const hasNightShift = doctors.some(d => d.hasNightShift)

      // 필요 인원 조회
      const doctorCombination = await prisma.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: { equals: doctorNames },
          hasNightShift
        }
      })

      if (doctorCombination) {
        const requiredStaff = doctorCombination.requiredStaff
        const assignedStaff = dateStaffCount.get(dateStr) || 0

        if (assignedStaff < requiredStaff) {
          warnings.push(
            `${dateStr}: 필요 인원 부족 (배치: ${assignedStaff}명 / 필요: ${requiredStaff}명) - 검토 요망`
          )
        }
      }
    }

    // 1차 배치 경고를 최종 경고로 교체
    console.log(`\n✅ 최종 검증 완료: ${warnings.length}건의 경고`)
    if (warnings.length > 0) {
      console.log(`⚠️  경고 목록:`)
      warnings.forEach(w => console.log(`   - ${w}`))
    }
    console.log(`========== 최종 검증 완료 ==========\n`)

    // ==================== 3차 공휴일 처리: 모든 공휴일 근무 → OFF 변경 ====================
    console.log(`\n========== 3차 공휴일 처리 시작 ==========`)

    // 배치 범위의 모든 공휴일 조회 (실제 배치 범위 기준)
    const holidaysInRange = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: {
          gte: actualDateRange.min,
          lte: actualDateRange.max
        }
      }
    })

    console.log(`\n📅 처리 대상 공휴일: ${holidaysInRange.length}개`)
    if (holidaysInRange.length > 0) {
      console.log(`   ${holidaysInRange.map(h => `${h.date.toISOString().split('T')[0]} (${h.name})`).join(', ')}\n`)
    }

    let holidayChanges = 0
    for (const holiday of holidaysInRange) {
      const holidayAssignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          date: holiday.date,
          shiftType: { in: ['DAY', 'NIGHT'] }
        }
      })

      for (const assignment of holidayAssignments) {
        await prisma.staffAssignment.update({
          where: {
            scheduleId_staffId_date: {
              scheduleId: schedule.id,
              staffId: assignment.staffId,
              date: holiday.date
            }
          },
          data: { shiftType: 'OFF' }
        })
        holidayChanges++
      }

      if (holidayAssignments.length > 0) {
        console.log(`   ✅ ${holiday.date.toISOString().split('T')[0]} (${holiday.name}): ${holidayAssignments.length}명 OFF 변경`)
      }
    }

    console.log(`\n✅ 3차 공휴일 처리 완료: ${holidayChanges}건 변경`)
    console.log(`========== 3차 공휴일 처리 완료 ==========\n`)

    // 최종 평균 형평성 계산 (자동 배치 부서 직원만)
    const fairnessScores = await Promise.all(
      autoAssignStaff.map(staff => calculateStaffFairnessV2(staff.id, clinicId, year, month, staff.departmentName ?? undefined, fairnessCache))
    )
    averageFairness = fairnessScores.length > 0 ? Math.round(
      fairnessScores.reduce((sum, s) => sum + s.overallScore, 0) / fairnessScores.length
    ) : 0

    console.log(`\n✅ 최종 배정 완료:`)
    console.log(`   - 총 배정: ${totalAssignments}건`)
    console.log(`   - 평균 형평성: ${averageFairness}점`)

  } // 메인 try 블록 종료

    // 4차: 배치되지 않은 직원을 분류하여 저장 + 충돌 처리
    console.log(`\n========== 4차: 배치되지 않은 직원 저장 및 충돌 처리 시작 ==========`)
    try {
      const monthStart = new Date(year, month - 1, 1)
      const monthEnd = new Date(year, month, 0)

      // 전체 자동 배치 대상 직원 조회
      const autoAssignStaffIds = autoAssignStaff.map(s => s.id)

      // 확정 및 보류 중인 연차/오프 조회 (분류 및 충돌 확인용)
      const leaveApplications = await prisma.leaveApplication.findMany({
        where: {
          clinicId,
          status: { in: ['CONFIRMED', 'ON_HOLD'] },
          date: {
            gte: monthStart,
            lte: monthEnd
          }
        },
        include: {
          staff: {
            select: { name: true }
          }
        }
      })

      // 연차/오프 맵 생성 (staffId_date -> leave)
      const leaveMap = new Map<string, any>()
      leaveApplications.forEach(leave => {
        const key = `${leave.staffId}_${leave.date.toISOString().split('T')[0]}`
        leaveMap.set(key, leave)
      })

      const confirmedCount = leaveApplications.filter(l => l.status === 'CONFIRMED').length
      const onHoldCount = leaveApplications.filter(l => l.status === 'ON_HOLD').length
      console.log(`   📋 확정 연차/오프: ${confirmedCount}건, 보류: ${onHoldCount}건`)
      console.log(`   👥 자동 배치 대상 직원: ${autoAssignStaffIds.length}명`)

      let annualCreated = 0
      let offCreated = 0
      let conflictRejected = 0
      let onHoldApproved = 0

      console.log(`   🔍 Step 1: 1~3차 배치 날짜 조회 중...`)
      // 1~3차가 배치한 날짜만 추출 (DAY/NIGHT가 있는 날짜)
      const assignedDatesRaw = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          shiftType: { in: ['DAY', 'NIGHT'] }
        },
        select: { date: true },
        distinct: ['date'],
        orderBy: { date: 'asc' }
      })

      const assignedDates = assignedDatesRaw.map(d => d.date)
      console.log(`   📅 1~3차 배치 날짜: ${assignedDates.length}일 (${assignedDates[0]?.toISOString().split('T')[0]} ~ ${assignedDates[assignedDates.length - 1]?.toISOString().split('T')[0]})`)

      console.log(`   🔍 Step 2: 날짜별 처리 시작...`)
      // 1~3차가 배치한 날짜만 순회
      for (const currentDate of assignedDates) {
        console.log(`      Processing ${currentDate.toISOString().split('T')[0]}...`)
        const dateStr = currentDate.toISOString().split('T')[0]

        // 해당 날짜의 기존 배정 조회 (1~3차에서 저장된 DAY/NIGHT)
        const existingAssignments = await prisma.staffAssignment.findMany({
          where: {
            scheduleId: schedule.id,
            date: currentDate
          }
        })

        const assignedStaffIds = new Set(existingAssignments.map(a => a.staffId))

        // 배치되지 않은 직원 찾기
        const unassignedStaff = autoAssignStaffIds.filter(id => !assignedStaffIds.has(id))

        // 기존 OFF 배치를 연차/오프 신청에 따라 업데이트
        const offAssignments = existingAssignments.filter(a => a.shiftType === 'OFF')

        for (const offAssignment of offAssignments) {
          const leaveKey = `${offAssignment.staffId}_${dateStr}`
          const leave = leaveMap.get(leaveKey)

          if (leave) {
            // 연차 또는 오프 신청이 있는 경우 → leaveApplicationId 연결 및 ANNUAL 분류
            const shiftType = leave.leaveType === 'ANNUAL' ? 'ANNUAL' : 'OFF'

            await prisma.staffAssignment.update({
              where: { id: offAssignment.id },
              data: {
                shiftType,
                leaveApplicationId: leave.id
              }
            })

            // 보류 중이었다면 승인으로 변경
            if (leave.status === 'ON_HOLD') {
              await prisma.leaveApplication.update({
                where: { id: leave.id },
                data: { status: 'CONFIRMED' }
              })
              onHoldApproved++
              console.log(`   ✅ 보류 승인: ${leave.staff.name} (${dateStr}) - ${leave.leaveType} 신청 승인 (OFF 배치 확인)`)
            }

            if (leave.leaveType === 'ANNUAL') {
              annualCreated++
            } else {
              offCreated++
            }
          }
          // 신청 없는 OFF는 그대로 유지 (아무것도 안 함)
        }

        // 충돌 확인: 근무 배치(DAY/NIGHT)된 직원 중 연차/오프 신청한 경우
        for (const assignment of existingAssignments) {
          if (assignment.shiftType === 'DAY' || assignment.shiftType === 'NIGHT') {
            const leaveKey = `${assignment.staffId}_${dateStr}`
            const leave = leaveMap.get(leaveKey)

            if (leave) {
              // 충돌 발견: 연차/오프 신청 반려
              await prisma.leaveApplication.update({
                where: { id: leave.id },
                data: { status: 'CANCELLED' }
              })

              // 알림 생성 (Staff는 User와 별개이므로 userId는 null, relatedId에 staffId 저장)
              await prisma.notification.create({
                data: {
                  clinicId,
                  userId: null,
                  type: 'LEAVE_CANCELLED',
                  title: '연차/오프 신청 자동 취소',
                  message: `[${leave.staff.name}] 자동 배치로 인해 ${dateStr} ${leave.leaveType === 'ANNUAL' ? '연차' : '오프'} 신청이 취소되었습니다. (근무 배정됨: ${assignment.shiftType})`,
                  relatedId: leave.staffId,
                  isRead: false
                }
              })

              conflictRejected++
              console.log(`   ⚠️ 충돌 반려: ${leave.staff.name} (${dateStr}) - ${leave.leaveType} 신청 vs ${assignment.shiftType} 배정`)
            }
          }
        }
      }

      console.log(`\n✅ 4차 저장 완료:`)
      console.log(`   - ANNUAL 생성: ${annualCreated}건`)
      console.log(`   - OFF 생성: ${offCreated}건`)
      console.log(`   - 충돌 반려: ${conflictRejected}건`)
      console.log(`   - 보류 승인: ${onHoldApproved}건`)
    } catch (saveError: any) {
      console.error('❌ 4차 저장 실패 (무시):', saveError.message)
      console.error('❌ 에러 상세:', JSON.stringify(saveError, null, 2))
      if (saveError.stack) console.error('❌ Stack:', saveError.stack)
    }
    console.log(`========== 4차: 완료 ==========\n`)

    // 배치 완료 후 최종 형평성 재계산 & 스냅샷 저장
    try {
      await recalculateFinalFairness(schedule.id, clinicId, year, month)
    } catch (fairnessError) {
      console.error('❌ 형평성 스냅샷 생성 실패 (무시):', fairnessError)
    }

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
        warnings: warnings
      },
      warnings: warnings
    })
  } catch (error) {
    console.error('Auto-assign error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to auto-assign schedule' },
      { status: 500 }
    )
  }
}
