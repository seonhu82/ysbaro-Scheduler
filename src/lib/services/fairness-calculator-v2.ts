/**
 * 형평성 계산 V2 - 완전 개선 버전
 *
 * 주요 개선 사항:
 * 1. 계산 범위: 실제 배치 전체 날짜 (월 경계 포함)
 * 2. 총근무일 차원 추가
 * 3. 형평성 기준: 전체 인원 기준 (카테고리 아님)
 * 4. 연차 처리: 총근무일만 +1, 특수 근무일은 +0
 * 5. 성능 최적화: 캐시 파라미터 지원
 */

import { prisma } from '@/lib/prisma'

export interface DimensionScore {
  dimension: 'total' | 'night' | 'weekend' | 'holiday' | 'holidayAdjacent'
  baseline: number // 기준값 (총 필요인원 / 전체 인원)
  actual: number // 실제 근무일
  deviation: number // 편차 (baseline - actual) - 양수면 덜 일함
  score: number // 0-100 점수
  status: 'ahead' | 'behind' | 'onTrack' // 앞서있음/뒤처짐/균형
  percentage: number // 달성률
}

export interface FairnessScoreV2 {
  staffId: string
  staffName: string
  year: number
  month: number
  dimensions: {
    total: DimensionScore
    night: DimensionScore
    weekend: DimensionScore
    holiday: DimensionScore
    holidayAdjacent: DimensionScore
  }
  overallScore: number // 0-100, 높을수록 좋음 (여유가 있음)
  canApplyLeave: boolean // 연차/오프 신청 가능 여부
  sortKeys: {
    total: number
    night: number
    weekend: number
    holiday: number
    holidayAdjacent: number
  }
}

export interface MonthlyFairnessParams {
  clinicId: string
  year: number
  month: number
  categoryName?: string // 특정 카테고리만 계산
  departmentName?: string // 특정 부서만 계산
}

export interface FairnessCache {
  schedule?: any
  combinations?: any[]
  holidays?: any[]
  closedDays?: any
  fairnessSettings?: any
  actualDateRange?: { min: Date, max: Date }
  previousMonthFairness?: Record<string, {
    total: number
    night: number
    weekend: number
    holiday: number
    holidayAdjacent: number
  }> // 스냅샷: Schedule.previousMonthFairness
}

/**
 * 실제 배치 날짜 범위 조회
 */
async function getActualDateRange(
  clinicId: string,
  year: number,
  month: number
): Promise<{ min: Date, max: Date }> {
  const schedule = await prisma.schedule.findFirst({
    where: {
      clinicId,
      year,
      month,
      status: { in: ['DRAFT', 'CONFIRMED', 'DEPLOYED'] }
    }
  })

  if (!schedule) {
    // 스케줄이 없으면 해당 월로 기본값
    return {
      min: new Date(year, month - 1, 1),
      max: new Date(year, month, 0)
    }
  }

  // 실제 배치된 날짜 범위 조회
  const dateRange = await prisma.staffAssignment.aggregate({
    where: { scheduleId: schedule.id },
    _min: { date: true },
    _max: { date: true }
  })

  // 원장 스케줄 날짜도 확인
  const doctorDateRange = await prisma.scheduleDoctor.aggregate({
    where: { scheduleId: schedule.id },
    _min: { date: true },
    _max: { date: true }
  })

  const minDate = dateRange._min.date || doctorDateRange._min.date || new Date(year, month - 1, 1)
  const maxDate = dateRange._max.date || doctorDateRange._max.date || new Date(year, month, 0)

  return { min: minDate, max: maxDate }
}

/**
 * 총근무일 형평성 계산 (새로 추가)
 */
async function calculateTotalDimension(
  staffId: string,
  clinicId: string,
  year: number,
  month: number,
  department: string,
  cache?: FairnessCache
): Promise<DimensionScore> {
  // 1. 실제 배치 날짜 범위
  const dateRange = cache?.actualDateRange || await getActualDateRange(clinicId, year, month)
  const startDate = dateRange.min
  const endDate = dateRange.max

  // 2. 스케줄 조회
  const schedule = cache?.schedule || await prisma.schedule.findFirst({
    where: {
      clinicId,
      year,
      month,
      status: { in: ['DRAFT', 'CONFIRMED', 'DEPLOYED'] }
    },
    include: {
      doctors: {
        include: { doctor: true }
      }
    }
  })

  if (!schedule) {
    return {
      dimension: 'total',
      baseline: 0,
      actual: 0,
      deviation: 0,
      score: 50,
      status: 'onTrack',
      percentage: 0
    }
  }

  // 3. 의사 조합 정보
  const combinations = cache?.combinations || await prisma.doctorCombination.findMany({
    where: { clinicId }
  })

  // 4. 전체 배치 기간의 총 필요인원 계산
  const dateMap = new Map<string, typeof schedule.doctors>()
  for (const ds of schedule.doctors) {
    const dateKey = ds.date.toISOString().split('T')[0]
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, [])
    }
    dateMap.get(dateKey)!.push(ds)
  }

  let totalRequired = 0
  const processedDates = new Set<string>()

  for (const [dateKey, doctorSchedules] of dateMap) {
    const currentDate = new Date(dateKey + 'T00:00:00.000Z')

    // 날짜 범위 체크
    if (currentDate < startDate || currentDate > endDate) continue
    if (processedDates.has(dateKey)) continue
    processedDates.add(dateKey)

    // 의사 조합 찾기
    const doctorNames = doctorSchedules.map(ds => ds.doctor.shortName).sort()
    const hasNight = doctorSchedules.some(ds => ds.hasNightShift)

    const combination = combinations.find(c => {
      const comboDoctors = (c.doctors as string[]).sort()
      return JSON.stringify(comboDoctors) === JSON.stringify(doctorNames) &&
             c.hasNightShift === hasNight
    })

    if (combination?.requiredStaff) {
      totalRequired += combination.requiredStaff as number
    }
  }

  // 5. 해당 부서 전체 인원 수
  const totalStaffInDepartment = await prisma.staff.count({
    where: {
      clinicId,
      departmentName: department,
      isActive: true
    }
  })

  // 6. 실제 배치된 총 근무 슬롯 수 계산 (연차 포함)
  const totalActualAssignments = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { gte: startDate, lte: endDate },
      shiftType: { not: 'OFF' }
    }
  })

  const totalLeaveCount = await prisma.leaveApplication.count({
    where: {
      clinicId,
      leaveType: 'OFF',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate }
    }
  })

  const totalActualSlots = totalActualAssignments + totalLeaveCount

  // 7. 기준 = 실제 배치된 총 슬롯 수 / 전체 인원
  // (이렇게 하면 실제로 일한 평균이 기준이 되어 deviation이 0에 가까워짐)
  const baseline = totalStaffInDepartment > 0 ? totalActualSlots / totalStaffInDepartment : 0

  // 8. 이 직원의 실제 근무일 = 실제 배치 + 연차
  const actualAssignments = await prisma.staffAssignment.count({
    where: {
      staffId,
      scheduleId: schedule.id,
      date: { gte: startDate, lte: endDate },
      shiftType: { not: 'OFF' }
    }
  })

  const leaveCount = await prisma.leaveApplication.count({
    where: {
      staffId,
      clinicId,
      leaveType: 'OFF',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate }
    }
  })

  const actual = actualAssignments + leaveCount

  // 9. 편차 및 점수 계산
  const deviation = baseline - actual
  // 점수: 편차가 작을수록 높음 (100점 만점, 편차 0 = 완벽)
  const score = Math.max(0, Math.min(100, 100 - Math.abs(deviation) * 10))
  const percentage = baseline > 0 ? Math.round((actual / baseline) * 100) : 0

  let status: 'ahead' | 'behind' | 'onTrack'
  if (deviation < -0.5) {
    status = 'behind'
  } else if (deviation > 0.5) {
    status = 'ahead'
  } else {
    status = 'onTrack'
  }

  return {
    dimension: 'total',
    baseline: Math.round(baseline * 10) / 10,
    actual,
    deviation: Math.round(deviation * 10) / 10,
    score: Math.round(score * 10) / 10,
    status,
    percentage
  }
}

/**
 * 특수 차원(야간/주말/공휴일/공휴일전후) 형평성 계산
 */
async function calculateSpecialDimension(
  dimension: 'night' | 'weekend' | 'holiday' | 'holidayAdjacent',
  staffId: string,
  clinicId: string,
  year: number,
  month: number,
  department: string,
  cache?: FairnessCache
): Promise<DimensionScore> {
  // 1. 실제 배치 날짜 범위
  const dateRange = cache?.actualDateRange || await getActualDateRange(clinicId, year, month)
  const startDate = dateRange.min
  const endDate = dateRange.max

  // 2. 스케줄 조회
  const schedule = cache?.schedule || await prisma.schedule.findFirst({
    where: {
      clinicId,
      year,
      month,
      status: { in: ['DRAFT', 'CONFIRMED', 'DEPLOYED'] }
    },
    include: {
      doctors: {
        include: { doctor: true }
      }
    }
  })

  if (!schedule) {
    return {
      dimension,
      baseline: 0,
      actual: 0,
      deviation: 0,
      score: 50,
      status: 'onTrack',
      percentage: 0
    }
  }

  // 3. 의사 조합 정보
  const combinations = cache?.combinations || await prisma.doctorCombination.findMany({
    where: { clinicId }
  })

  // 4. 공휴일 정보
  const holidays = cache?.holidays || await prisma.holiday.findMany({
    where: {
      clinicId,
      date: { gte: startDate, lte: endDate }
    }
  })

  const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))

  // 5. 해당 차원의 총 필요인원 계산
  const dateMap = new Map<string, typeof schedule.doctors>()
  for (const ds of schedule.doctors) {
    const dateKey = ds.date.toISOString().split('T')[0]
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, [])
    }
    dateMap.get(dateKey)!.push(ds)
  }

  let totalRequired = 0
  let dimensionDays = 0

  for (const [dateKey, doctorSchedules] of dateMap) {
    const currentDate = new Date(dateKey + 'T00:00:00.000Z')

    // 날짜 범위 체크
    if (currentDate < startDate || currentDate > endDate) continue

    const dayOfWeek = currentDate.getDay()
    const isWeekend = dayOfWeek === 6 // 토요일만 (일요일은 휴업일)
    const isHoliday = holidayDates.has(dateKey)

    // 공휴일 전후 판별
    const yesterday = new Date(currentDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date(currentDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isHolidayAdjacent = !isHoliday && (
      holidayDates.has(yesterday.toISOString().split('T')[0]) ||
      holidayDates.has(tomorrow.toISOString().split('T')[0])
    )

    const hasNight = doctorSchedules.some(ds => ds.hasNightShift)

    // 해당 차원인지 판별
    let isDimensionDay = false
    if (dimension === 'night' && hasNight) isDimensionDay = true
    else if (dimension === 'weekend' && isWeekend) isDimensionDay = true
    else if (dimension === 'holiday' && isHoliday) isDimensionDay = true
    else if (dimension === 'holidayAdjacent' && isHolidayAdjacent) isDimensionDay = true

    if (!isDimensionDay) continue

    // 의사 조합 찾기
    const doctorNames = doctorSchedules.map(ds => ds.doctor.shortName).sort()
    const combination = combinations.find(c => {
      const comboDoctors = (c.doctors as string[]).sort()
      return JSON.stringify(comboDoctors) === JSON.stringify(doctorNames) &&
             c.hasNightShift === hasNight
    })

    if (combination?.requiredStaff) {
      totalRequired += combination.requiredStaff as number
      dimensionDays++
    }
  }

  // 6. 해당 부서 전체 인원 수
  const totalStaffInDepartment = await prisma.staff.count({
    where: {
      clinicId,
      departmentName: department,
      isActive: true
    }
  })

  // 7. 실제 배치된 해당 차원의 총 슬롯 수 계산
  // (2차 배치 시 OFF→근무 변경이 실시간 반영되도록)
  const allAssignments = await prisma.staffAssignment.findMany({
    where: {
      scheduleId: schedule.id,
      date: { gte: startDate, lte: endDate },
      shiftType: { not: 'OFF' }
    },
    select: {
      date: true,
      shiftType: true
    }
  })

  let totalActualDimensionSlots = 0
  for (const assignment of allAssignments) {
    const assignmentDate = assignment.date
    const dateKey = assignmentDate.toISOString().split('T')[0]
    const dayOfWeek = assignmentDate.getDay()
    const isWeekend = dayOfWeek === 6
    const isHoliday = holidayDates.has(dateKey)
    const isNight = assignment.shiftType === 'NIGHT'

    // 공휴일 전후 판별
    const yesterday = new Date(assignmentDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date(assignmentDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isHolidayAdjacent = !isHoliday && (
      holidayDates.has(yesterday.toISOString().split('T')[0]) ||
      holidayDates.has(tomorrow.toISOString().split('T')[0])
    )

    // 해당 차원인지 체크
    if (dimension === 'night' && isNight) totalActualDimensionSlots++
    else if (dimension === 'weekend' && isWeekend) totalActualDimensionSlots++
    else if (dimension === 'holiday' && isHoliday) totalActualDimensionSlots++
    else if (dimension === 'holidayAdjacent' && isHolidayAdjacent) totalActualDimensionSlots++
  }

  // 8. 기준 = 실제 배치된 총 슬롯 수 / 전체 인원
  // (이렇게 하면 2차 배치 시 OFF→근무 변경이 즉시 반영됨)
  const baseline = totalStaffInDepartment > 0 ? totalActualDimensionSlots / totalStaffInDepartment : 0

  // 9. 실제 근무일 = 실제 배치만 (연차 포함 안 함!)
  const staffAssignments = await prisma.staffAssignment.findMany({
    where: {
      staffId,
      scheduleId: schedule.id,
      date: { gte: startDate, lte: endDate },
      shiftType: { not: 'OFF' }
    },
    select: {
      date: true,
      shiftType: true
    }
  })

  let actual = 0
  for (const assignment of staffAssignments) {
    const assignmentDate = assignment.date
    const dateKey = assignmentDate.toISOString().split('T')[0]
    const dayOfWeek = assignmentDate.getDay()
    const isWeekend = dayOfWeek === 6
    const isHoliday = holidayDates.has(dateKey)
    const isNight = assignment.shiftType === 'NIGHT'

    // 공휴일 전후 판별
    const yesterday = new Date(assignmentDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date(assignmentDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isHolidayAdjacent = !isHoliday && (
      holidayDates.has(yesterday.toISOString().split('T')[0]) ||
      holidayDates.has(tomorrow.toISOString().split('T')[0])
    )

    // 해당 차원인지 체크
    if (dimension === 'night' && isNight) actual++
    else if (dimension === 'weekend' && isWeekend) actual++
    else if (dimension === 'holiday' && isHoliday) actual++
    else if (dimension === 'holidayAdjacent' && isHolidayAdjacent) actual++
  }

  // ⚠️ 중요: 연차(OFF)는 특수 근무일에 카운트하지 않음!
  // 연차는 총근무일에만 카운트됨

  // 10. 편차 및 점수 계산
  const deviation = baseline - actual
  // 점수: 편차가 작을수록 높음 (100점 만점, 편차 0 = 완벽)
  const score = Math.max(0, Math.min(100, 100 - Math.abs(deviation) * 10))
  const percentage = baseline > 0 ? Math.round((actual / baseline) * 100) : 0

  let status: 'ahead' | 'behind' | 'onTrack'
  if (deviation < -0.5) {
    status = 'behind'
  } else if (deviation > 0.5) {
    status = 'ahead'
  } else {
    status = 'onTrack'
  }

  return {
    dimension,
    baseline: Math.round(baseline * 10) / 10,
    actual,
    deviation: Math.round(deviation * 10) / 10,
    score: Math.round(score * 10) / 10,
    status,
    percentage
  }
}

/**
 * Schedule.previousMonthFairness 스냅샷에서 편차를 가져오는 함수
 * (자동배정 시 사용 - 배정 시작 시점의 편차 값)
 */
export async function getStaffFairnessFromSnapshot(
  staffId: string,
  year: number,
  month: number,
  cache?: FairnessCache
): Promise<FairnessScoreV2> {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      name: true
    }
  })

  if (!staff) {
    throw new Error(`Staff not found: ${staffId}`)
  }

  // 캐시에서 스냅샷 가져오기
  const snapshot = cache?.previousMonthFairness?.[staffId]

  if (!snapshot) {
    // 스냅샷이 없으면 모두 0으로 초기화
    const zeroDimension = (dim: 'total' | 'night' | 'weekend' | 'holiday' | 'holidayAdjacent'): DimensionScore => ({
      dimension: dim,
      baseline: 0,
      actual: 0,
      deviation: 0,
      score: 100,
      status: 'onTrack',
      percentage: 0
    })

    return {
      staffId: staff.id,
      staffName: staff.name || '직원',
      year,
      month,
      dimensions: {
        total: zeroDimension('total'),
        night: zeroDimension('night'),
        weekend: zeroDimension('weekend'),
        holiday: zeroDimension('holiday'),
        holidayAdjacent: zeroDimension('holidayAdjacent')
      },
      overallScore: 100,
      canApplyLeave: true,
      sortKeys: {
        total: 0,
        night: 0,
        weekend: 0,
        holiday: 0,
        holidayAdjacent: 0
      }
    }
  }

  // 스냅샷 편차로 DimensionScore 생성
  const createDimensionScore = (
    dimension: 'total' | 'night' | 'weekend' | 'holiday' | 'holidayAdjacent',
    deviation: number
  ): DimensionScore => {
    const status: 'ahead' | 'behind' | 'onTrack' =
      deviation < -0.5 ? 'behind' : deviation > 0.5 ? 'ahead' : 'onTrack'

    return {
      dimension,
      baseline: 0, // 스냅샷에서는 baseline 정보 없음
      actual: 0, // 스냅샷에서는 actual 정보 없음
      deviation: Math.round(deviation * 10) / 10,
      score: Math.max(0, Math.min(100, 100 - Math.abs(deviation) * 10)),
      status,
      percentage: 0 // 스냅샷에서는 percentage 정보 없음
    }
  }

  const dimensions = {
    total: createDimensionScore('total', snapshot.total),
    night: createDimensionScore('night', snapshot.night),
    weekend: createDimensionScore('weekend', snapshot.weekend),
    holiday: createDimensionScore('holiday', snapshot.holiday),
    holidayAdjacent: createDimensionScore('holidayAdjacent', snapshot.holidayAdjacent)
  }

  // 종합 점수 계산 (가중 평균)
  const weights = { total: 2, night: 3, weekend: 2, holiday: 4, holidayAdjacent: 1 }
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0)
  const weightedSum =
    dimensions.total.deviation * weights.total +
    dimensions.night.deviation * weights.night +
    dimensions.weekend.deviation * weights.weekend +
    dimensions.holiday.deviation * weights.holiday +
    dimensions.holidayAdjacent.deviation * weights.holidayAdjacent
  const weightedDeviation = totalWeight > 0 ? weightedSum / totalWeight : 0
  const overallScore = Math.max(0, Math.min(100, 100 - Math.abs(weightedDeviation) * 10))

  return {
    staffId: staff.id,
    staffName: staff.name || '직원',
    year,
    month,
    dimensions,
    overallScore: Math.round(overallScore),
    canApplyLeave: overallScore >= 60,
    sortKeys: {
      total: dimensions.total.deviation,
      night: dimensions.night.deviation,
      weekend: dimensions.weekend.deviation,
      holiday: dimensions.holiday.deviation,
      holidayAdjacent: dimensions.holidayAdjacent.deviation
    }
  }
}

/**
 * 직원의 월간 형평성 점수 계산 (실시간 계산)
 * ⚠️ 자동배정 중에는 getStaffFairnessFromSnapshot 사용!
 * ⚠️ 이 함수는 배정 완료 후 Staff 테이블 업데이트 시에만 사용!
 */
export async function calculateStaffFairnessV2(
  staffId: string,
  clinicId: string,
  year: number,
  month: number,
  departmentFilter?: string,
  cache?: FairnessCache
): Promise<FairnessScoreV2> {
  // 직원 정보 조회
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      name: true,
      categoryName: true,
      departmentName: true
    }
  })

  if (!staff) {
    throw new Error(`Staff not found: ${staffId}`)
  }

  const department = departmentFilter || staff.departmentName

  // 형평성 설정 조회
  const fairnessSettings = cache?.fairnessSettings || await prisma.fairnessSettings.findUnique({
    where: { clinicId }
  })

  const enabledDimensions = {
    total: true, // 항상 활성화
    night: fairnessSettings?.enableNightShiftFairness ?? true,
    weekend: fairnessSettings?.enableWeekendFairness ?? true,
    holiday: fairnessSettings?.enableHolidayFairness ?? true,
    holidayAdjacent: fairnessSettings?.enableHolidayAdjacentFairness ?? false
  }

  // 실제 배치 날짜 범위 조회 (캐시에 없으면)
  if (!cache?.actualDateRange) {
    const dateRange = await getActualDateRange(clinicId, year, month)
    if (cache) {
      cache.actualDateRange = dateRange
    }
  }

  // 각 차원 계산
  const defaultScore: DimensionScore = {
    dimension: 'night',
    baseline: 0,
    actual: 0,
    deviation: 0,
    score: 50,
    status: 'onTrack',
    percentage: 0
  }

  // 총근무일 (항상 계산)
  const total = await calculateTotalDimension(staffId, clinicId, year, month, department, cache)

  // 특수 차원 (활성화된 것만)
  const night = enabledDimensions.night
    ? await calculateSpecialDimension('night', staffId, clinicId, year, month, department, cache)
    : { ...defaultScore, dimension: 'night' as const }

  const weekend = enabledDimensions.weekend
    ? await calculateSpecialDimension('weekend', staffId, clinicId, year, month, department, cache)
    : { ...defaultScore, dimension: 'weekend' as const }

  const holiday = enabledDimensions.holiday
    ? await calculateSpecialDimension('holiday', staffId, clinicId, year, month, department, cache)
    : { ...defaultScore, dimension: 'holiday' as const }

  const holidayAdjacent = enabledDimensions.holidayAdjacent
    ? await calculateSpecialDimension('holidayAdjacent', staffId, clinicId, year, month, department, cache)
    : { ...defaultScore, dimension: 'holidayAdjacent' as const }

  // 종합 점수 계산 (가중 평균)
  const weights = {
    total: 2,
    night: 3,
    weekend: 2,
    holiday: 4,
    holidayAdjacent: 1
  }

  let totalWeight = 0
  let weightedSum = 0

  if (enabledDimensions.total) {
    totalWeight += weights.total
    weightedSum += total.deviation * weights.total
  }
  if (enabledDimensions.night) {
    totalWeight += weights.night
    weightedSum += night.deviation * weights.night
  }
  if (enabledDimensions.weekend) {
    totalWeight += weights.weekend
    weightedSum += weekend.deviation * weights.weekend
  }
  if (enabledDimensions.holiday) {
    totalWeight += weights.holiday
    weightedSum += holiday.deviation * weights.holiday
  }
  if (enabledDimensions.holidayAdjacent) {
    totalWeight += weights.holidayAdjacent
    weightedSum += holidayAdjacent.deviation * weights.holidayAdjacent
  }

  const weightedDeviation = totalWeight > 0 ? weightedSum / totalWeight : 0
  // 종합 점수: 편차가 작을수록 높음 (100점 만점)
  const overallScore = Math.max(0, Math.min(100, 100 - Math.abs(weightedDeviation) * 10))
  const canApplyLeave = overallScore >= 60

  return {
    staffId: staff.id,
    staffName: staff.name || '직원',
    year,
    month,
    dimensions: {
      total,
      night,
      weekend,
      holiday,
      holidayAdjacent
    },
    overallScore: Math.round(overallScore),
    canApplyLeave,
    sortKeys: {
      total: total.deviation,
      night: night.deviation,
      weekend: weekend.deviation,
      holiday: holiday.deviation,
      holidayAdjacent: holidayAdjacent.deviation
    }
  }
}

/**
 * 카테고리 전체 직원의 형평성 점수 계산 (평균 편차 조정 포함)
 */
export async function calculateCategoryFairnessV2(
  params: MonthlyFairnessParams
): Promise<FairnessScoreV2[]> {
  const { clinicId, year, month, categoryName, departmentName } = params

  // 직원 목록 조회
  const staffList = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true,
      ...(categoryName && { categoryName }),
      ...(departmentName && { departmentName })
    },
    select: {
      id: true
    }
  })

  if (staffList.length === 0) {
    return []
  }

  // 병렬로 계산
  const rawScores = await Promise.all(
    staffList.map(staff => calculateStaffFairnessV2(staff.id, clinicId, year, month))
  )

  // 각 차원별 평균 편차 계산
  const avgDeviations = {
    total: rawScores.reduce((sum, s) => sum + s.dimensions.total.deviation, 0) / rawScores.length,
    night: rawScores.reduce((sum, s) => sum + s.dimensions.night.deviation, 0) / rawScores.length,
    weekend: rawScores.reduce((sum, s) => sum + s.dimensions.weekend.deviation, 0) / rawScores.length,
    holiday: rawScores.reduce((sum, s) => sum + s.dimensions.holiday.deviation, 0) / rawScores.length,
    holidayAdjacent: rawScores.reduce((sum, s) => sum + s.dimensions.holidayAdjacent.deviation, 0) / rawScores.length
  }

  // 평균 편차를 빼서 조정 (평균이 0이 되도록)
  const adjustedScores = rawScores.map(score => {
    const adjustedDimensions = {
      total: {
        ...score.dimensions.total,
        deviation: Math.round((score.dimensions.total.deviation - avgDeviations.total) * 10) / 10
      },
      night: {
        ...score.dimensions.night,
        deviation: Math.round((score.dimensions.night.deviation - avgDeviations.night) * 10) / 10
      },
      weekend: {
        ...score.dimensions.weekend,
        deviation: Math.round((score.dimensions.weekend.deviation - avgDeviations.weekend) * 10) / 10
      },
      holiday: {
        ...score.dimensions.holiday,
        deviation: Math.round((score.dimensions.holiday.deviation - avgDeviations.holiday) * 10) / 10
      },
      holidayAdjacent: {
        ...score.dimensions.holidayAdjacent,
        deviation: Math.round((score.dimensions.holidayAdjacent.deviation - avgDeviations.holidayAdjacent) * 10) / 10
      }
    }

    // sortKeys도 조정
    const adjustedSortKeys = {
      total: adjustedDimensions.total.deviation,
      night: adjustedDimensions.night.deviation,
      weekend: adjustedDimensions.weekend.deviation,
      holiday: adjustedDimensions.holiday.deviation,
      holidayAdjacent: adjustedDimensions.holidayAdjacent.deviation
    }

    // overallScore도 재계산
    const weights = { total: 2, night: 3, weekend: 2, holiday: 4, holidayAdjacent: 1 }
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0)
    const weightedSum =
      adjustedDimensions.total.deviation * weights.total +
      adjustedDimensions.night.deviation * weights.night +
      adjustedDimensions.weekend.deviation * weights.weekend +
      adjustedDimensions.holiday.deviation * weights.holiday +
      adjustedDimensions.holidayAdjacent.deviation * weights.holidayAdjacent
    const weightedDeviation = totalWeight > 0 ? weightedSum / totalWeight : 0
    const overallScore = Math.max(0, Math.min(100, 50 + weightedDeviation * 10))

    return {
      ...score,
      dimensions: adjustedDimensions,
      sortKeys: adjustedSortKeys,
      overallScore: Math.round(overallScore),
      canApplyLeave: overallScore >= 60
    }
  })

  return adjustedScores
}

/**
 * 형평성 점수를 기반으로 연차/오프 승인 가능 여부 판단
 */
export function canApplyLeaveType(
  fairnessScore: FairnessScoreV2,
  leaveType: 'ANNUAL' | 'OFF'
): { canApply: boolean; reason?: string } {
  const score = fairnessScore.overallScore

  if (leaveType === 'ANNUAL') {
    if (score >= 60) {
      return { canApply: true }
    } else {
      return {
        canApply: false,
        reason: `형평성 점수가 낮습니다 (${score}점/60점). 더 근무한 후 신청해주세요.`
      }
    }
  } else {
    if (score >= 75) {
      return { canApply: true }
    } else if (score >= 60) {
      return {
        canApply: false,
        reason: `오프는 형평성 점수 75점 이상 필요합니다 (현재 ${score}점). 연차로 신청하거나 더 근무 후 신청해주세요.`
      }
    } else {
      return {
        canApply: false,
        reason: `형평성 점수가 낮습니다 (${score}점/75점). 더 근무한 후 신청해주세요.`
      }
    }
  }
}

/**
 * 형평성 불균형 감지
 */
export async function detectImbalanceV2(
  clinicId: string,
  year: number,
  month: number
): Promise<{
  hasImbalance: boolean
  imbalancedStaff: Array<{
    staffId: string
    staffName: string
    score: number
    type: 'OVERWORKED' | 'UNDERWORKED'
    severity: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
}> {
  const scores = await calculateCategoryFairnessV2({ clinicId, year, month })

  const imbalancedStaff = scores
    .filter(s => s.overallScore < 40 || s.overallScore > 80)
    .map(s => {
      const type = s.overallScore < 50 ? 'OVERWORKED' : 'UNDERWORKED'
      const severity =
        s.overallScore < 30 || s.overallScore > 90
          ? 'HIGH'
          : s.overallScore < 35 || s.overallScore > 85
          ? 'MEDIUM'
          : 'LOW'

      return {
        staffId: s.staffId,
        staffName: s.staffName,
        score: s.overallScore,
        type,
        severity
      }
    })

  return {
    hasImbalance: imbalancedStaff.length > 0,
    imbalancedStaff
  }
}
