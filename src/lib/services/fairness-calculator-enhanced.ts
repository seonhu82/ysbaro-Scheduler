/**
 * 개선된 형평성 계산 서비스
 *
 * 향상된 기능:
 * 1. 다차원 형평성 점수 (야간/주말/공휴일/공휴일전후)
 * 2. 부서별 형평성 추적
 * 3. 구분별 형평성 추적
 * 4. 장기 추세 분석 (여러 달에 걸친 패턴)
 * 5. 불균형 감지 및 자동 조정 제안
 */

import { prisma } from '@/lib/prisma'

export interface StaffMetrics {
  nightShifts: number
  weekendShifts: number
  holidayShifts: number
  holidayAdjacentShifts: number
}

export interface FairnessWeights {
  nightShift: number
  weekend: number
  holiday: number
  holidayAdjacent: number
}

export interface EnhancedFairnessResult {
  overallScore: number
  grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  nightShiftDeviation: number
  weekendShiftDeviation: number
  holidayShiftDeviation: number
  holidayAdjacentDeviation: number
  normalizedScore: number
  details: {
    weightedDeviation: number
    maxPossibleDeviation: number
  }
}

export interface CategoryFairnessResult {
  [categoryName: string]: {
    staffCount: number
    averageScore: number
    averageNightShifts: number
    averageWeekendShifts: number
    averageHolidayShifts: number
    variance: number
    grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  }
}

export interface DepartmentFairnessResult {
  [department: string]: {
    staffCount: number
    averageScore: number
    averageNightShifts: number
    averageWeekendShifts: number
    variance: number
    grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  }
}

export interface FairnessTrendResult {
  staffId: string
  trend: 'INCREASING' | 'DECREASING' | 'STABLE'
  monthlyScores: Array<{
    year: number
    month: number
    totalShifts: number
    weightedShifts: number
  }>
  averageMonthlyIncrease: number
  projectedNextMonth: number
}

export interface ImbalanceDetectionResult {
  hasImbalance: boolean
  imbalancedStaff: Array<{
    staffId: string
    staffName: string
    type: 'OVERWORKED' | 'UNDERWORKED'
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
    nightShiftDeviation: number
    weekendShiftDeviation: number
    totalDeviation: number
  }>
  averageNightShifts: number
  averageWeekendShifts: number
}

export interface AdjustmentSuggestion {
  staffId: string
  staffName: string
  action: 'INCREASE' | 'REDUCE' | 'MAINTAIN'
  nightShiftAdjustment: number
  weekendShiftAdjustment: number
  reason: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface AdjustmentResult {
  needsAdjustment: boolean
  suggestions: AdjustmentSuggestion[]
  expectedImpact: {
    varianceReduction: number
    fairnessScoreIncrease: number
  }
}

// 기본 가중치
const DEFAULT_WEIGHTS: FairnessWeights = {
  nightShift: 3,
  weekend: 2,
  holiday: 4,
  holidayAdjacent: 1.5
}

/**
 * 개선된 다차원 형평성 점수 계산
 */
export function calculateEnhancedFairnessScore(
  metrics: StaffMetrics,
  allStaffMetrics: StaffMetrics[],
  weights: FairnessWeights = DEFAULT_WEIGHTS
): EnhancedFairnessResult {
  if (allStaffMetrics.length === 0) {
    return {
      overallScore: 0,
      grade: 'POOR',
      nightShiftDeviation: 0,
      weekendShiftDeviation: 0,
      holidayShiftDeviation: 0,
      holidayAdjacentDeviation: 0,
      normalizedScore: 0,
      details: {
        weightedDeviation: 0,
        maxPossibleDeviation: 0
      }
    }
  }

  // 1. 평균 계산
  const avgNight =
    allStaffMetrics.reduce((sum, m) => sum + m.nightShifts, 0) / allStaffMetrics.length
  const avgWeekend =
    allStaffMetrics.reduce((sum, m) => sum + m.weekendShifts, 0) / allStaffMetrics.length
  const avgHoliday =
    allStaffMetrics.reduce((sum, m) => sum + m.holidayShifts, 0) / allStaffMetrics.length
  const avgHolidayAdjacent =
    allStaffMetrics.reduce((sum, m) => sum + m.holidayAdjacentShifts, 0) / allStaffMetrics.length

  // 2. 편차 계산
  const nightDeviation = Math.abs(metrics.nightShifts - avgNight)
  const weekendDeviation = Math.abs(metrics.weekendShifts - avgWeekend)
  const holidayDeviation = Math.abs(metrics.holidayShifts - avgHoliday)
  const holidayAdjacentDeviation = Math.abs(metrics.holidayAdjacentShifts - avgHolidayAdjacent)

  // 3. 가중 편차 계산
  const totalWeight =
    weights.nightShift + weights.weekend + weights.holiday + weights.holidayAdjacent
  const weightedDeviation =
    (nightDeviation * weights.nightShift +
      weekendDeviation * weights.weekend +
      holidayDeviation * weights.holiday +
      holidayAdjacentDeviation * weights.holidayAdjacent) /
    totalWeight

  // 4. 정규화 점수 (0-100, 낮을수록 좋음 -> 역전)
  const maxPossibleDeviation =
    Math.max(avgNight, avgWeekend, avgHoliday, avgHolidayAdjacent) || 1
  const normalizedScore = Math.max(0, 100 - (weightedDeviation / maxPossibleDeviation) * 100)

  // 5. 등급 산정
  let grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  if (normalizedScore >= 90) {
    grade = 'EXCELLENT'
  } else if (normalizedScore >= 75) {
    grade = 'GOOD'
  } else if (normalizedScore >= 60) {
    grade = 'FAIR'
  } else {
    grade = 'POOR'
  }

  return {
    overallScore: Math.round(normalizedScore),
    grade,
    nightShiftDeviation: Math.round(nightDeviation * 10) / 10,
    weekendShiftDeviation: Math.round(weekendDeviation * 10) / 10,
    holidayShiftDeviation: Math.round(holidayDeviation * 10) / 10,
    holidayAdjacentDeviation: Math.round(holidayAdjacentDeviation * 10) / 10,
    normalizedScore: Math.round(normalizedScore * 10) / 10,
    details: {
      weightedDeviation: Math.round(weightedDeviation * 10) / 10,
      maxPossibleDeviation: Math.round(maxPossibleDeviation * 10) / 10
    }
  }
}

/**
 * 구분별 형평성 계산
 */
export async function calculateCategoryFairness(
  clinicId: string,
  year: number,
  month: number
): Promise<CategoryFairnessResult> {
  console.log(`\n📊 구분별 형평성 계산: ${year}년 ${month}월`)

  // 모든 직원 조회 (구분별로 그룹화)
  const staffList = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      categoryName: true
    }
  })

  // 구분별로 그룹화
  const categoriesMap = new Map<
    string,
    Array<{
      id: string
      name: string | null
      nightShifts: number
      weekendShifts: number
      holidayShifts: number
    }>
  >()

  for (const staff of staffList) {
    const category = staff.categoryName || '미분류'

    // 형평성 점수 조회
    const scores = await prisma.fairnessScore.findMany({
      where: {
        staffId: staff.id,
        year,
        month
      }
    })

    const nightShifts = scores.reduce((sum, s) => sum + s.nightShiftCount, 0)
    const weekendShifts = scores.reduce((sum, s) => sum + s.weekendCount, 0)
    const holidayShifts = scores.reduce((sum, s) => sum + s.holidayCount, 0)

    if (!categoriesMap.has(category)) {
      categoriesMap.set(category, [])
    }

    categoriesMap.get(category)!.push({
      id: staff.id,
      name: staff.name,
      nightShifts,
      weekendShifts,
      holidayShifts
    })
  }

  // 각 구분별 통계 계산
  const result: CategoryFairnessResult = {}

  for (const [category, staffInCategory] of categoriesMap.entries()) {
    const staffCount = staffInCategory.length

    if (staffCount === 0) continue

    const avgNight =
      staffInCategory.reduce((sum, s) => sum + s.nightShifts, 0) / staffCount
    const avgWeekend =
      staffInCategory.reduce((sum, s) => sum + s.weekendShifts, 0) / staffCount
    const avgHoliday =
      staffInCategory.reduce((sum, s) => sum + s.holidayShifts, 0) / staffCount

    // 분산 계산
    const nightVariance =
      staffInCategory.reduce((sum, s) => sum + Math.pow(s.nightShifts - avgNight, 2), 0) /
      staffCount
    const weekendVariance =
      staffInCategory.reduce((sum, s) => sum + Math.pow(s.weekendShifts - avgWeekend, 2), 0) /
      staffCount

    const totalVariance = nightVariance + weekendVariance

    // 변동계수 계산
    const nightCV = avgNight > 0 ? (Math.sqrt(nightVariance) / avgNight) * 100 : 0
    const weekendCV = avgWeekend > 0 ? (Math.sqrt(weekendVariance) / avgWeekend) * 100 : 0
    const weightedCV = (nightCV * 3 + weekendCV * 2) / 5

    // 점수 계산
    const averageScore = Math.max(0, 100 - weightedCV)

    let grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
    if (averageScore >= 85) {
      grade = 'EXCELLENT'
    } else if (averageScore >= 70) {
      grade = 'GOOD'
    } else if (averageScore >= 55) {
      grade = 'FAIR'
    } else {
      grade = 'POOR'
    }

    result[category] = {
      staffCount,
      averageScore: Math.round(averageScore),
      averageNightShifts: Math.round(avgNight * 10) / 10,
      averageWeekendShifts: Math.round(avgWeekend * 10) / 10,
      averageHolidayShifts: Math.round(avgHoliday * 10) / 10,
      variance: Math.round(totalVariance * 10) / 10,
      grade
    }

    console.log(
      `   ${category}: 평균 점수 ${result[category].averageScore}, ` +
        `야간 ${result[category].averageNightShifts}회, ` +
        `주말 ${result[category].averageWeekendShifts}회 (${grade})`
    )
  }

  return result
}

/**
 * 부서별 형평성 계산
 */
export async function calculateDepartmentFairness(
  clinicId: string,
  year: number,
  month: number
): Promise<DepartmentFairnessResult> {
  console.log(`\n🏢 부서별 형평성 계산: ${year}년 ${month}월`)

  const staffList = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      department: true
    }
  })

  const departmentsMap = new Map<
    string,
    Array<{
      id: string
      name: string | null
      nightShifts: number
      weekendShifts: number
    }>
  >()

  for (const staff of staffList) {
    const department = staff.department || '미분류'

    const scores = await prisma.fairnessScore.findMany({
      where: {
        staffId: staff.id,
        year,
        month
      }
    })

    const nightShifts = scores.reduce((sum, s) => sum + s.nightShiftCount, 0)
    const weekendShifts = scores.reduce((sum, s) => sum + s.weekendCount, 0)

    if (!departmentsMap.has(department)) {
      departmentsMap.set(department, [])
    }

    departmentsMap.get(department)!.push({
      id: staff.id,
      name: staff.name,
      nightShifts,
      weekendShifts
    })
  }

  const result: DepartmentFairnessResult = {}

  for (const [department, staffInDept] of departmentsMap.entries()) {
    const staffCount = staffInDept.length

    if (staffCount === 0) continue

    const avgNight = staffInDept.reduce((sum, s) => sum + s.nightShifts, 0) / staffCount
    const avgWeekend = staffInDept.reduce((sum, s) => sum + s.weekendShifts, 0) / staffCount

    const nightVariance =
      staffInDept.reduce((sum, s) => sum + Math.pow(s.nightShifts - avgNight, 2), 0) / staffCount
    const weekendVariance =
      staffInDept.reduce((sum, s) => sum + Math.pow(s.weekendShifts - avgWeekend, 2), 0) /
      staffCount

    const totalVariance = nightVariance + weekendVariance

    const nightCV = avgNight > 0 ? (Math.sqrt(nightVariance) / avgNight) * 100 : 0
    const weekendCV = avgWeekend > 0 ? (Math.sqrt(weekendVariance) / avgWeekend) * 100 : 0
    const weightedCV = (nightCV * 3 + weekendCV * 2) / 5

    const averageScore = Math.max(0, 100 - weightedCV)

    let grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
    if (averageScore >= 85) {
      grade = 'EXCELLENT'
    } else if (averageScore >= 70) {
      grade = 'GOOD'
    } else if (averageScore >= 55) {
      grade = 'FAIR'
    } else {
      grade = 'POOR'
    }

    result[department] = {
      staffCount,
      averageScore: Math.round(averageScore),
      averageNightShifts: Math.round(avgNight * 10) / 10,
      averageWeekendShifts: Math.round(avgWeekend * 10) / 10,
      variance: Math.round(totalVariance * 10) / 10,
      grade
    }

    console.log(
      `   ${department}: 평균 점수 ${result[department].averageScore}, ` +
        `야간 ${result[department].averageNightShifts}회, ` +
        `주말 ${result[department].averageWeekendShifts}회 (${grade})`
    )
  }

  return result
}

/**
 * 형평성 추세 분석 (여러 달)
 */
export async function analyzeFairnessTrends(
  staffId: string,
  year: number,
  endMonth: number,
  monthsToAnalyze: number = 3
): Promise<FairnessTrendResult> {
  const startMonth = Math.max(1, endMonth - monthsToAnalyze + 1)

  const scores = await prisma.fairnessScore.findMany({
    where: {
      staffId,
      year,
      month: {
        gte: startMonth,
        lte: endMonth
      }
    },
    orderBy: {
      month: 'asc'
    }
  })

  const monthlyScores = scores.map(score => {
    const totalShifts =
      score.nightShiftCount +
      score.weekendCount +
      score.holidayCount +
      score.holidayAdjacentCount

    const weightedShifts =
      score.nightShiftCount * 3 +
      score.weekendCount * 2 +
      score.holidayCount * 4 +
      score.holidayAdjacentCount * 1.5

    return {
      year: score.year,
      month: score.month,
      totalShifts,
      weightedShifts
    }
  })

  // 추세 계산 (단순 선형 회귀)
  let averageMonthlyIncrease = 0
  if (monthlyScores.length >= 2) {
    const increases = []
    for (let i = 1; i < monthlyScores.length; i++) {
      increases.push(monthlyScores[i].weightedShifts - monthlyScores[i - 1].weightedShifts)
    }
    averageMonthlyIncrease = increases.reduce((sum, inc) => sum + inc, 0) / increases.length
  }

  let trend: 'INCREASING' | 'DECREASING' | 'STABLE'
  if (averageMonthlyIncrease > 2) {
    trend = 'INCREASING'
  } else if (averageMonthlyIncrease < -2) {
    trend = 'DECREASING'
  } else {
    trend = 'STABLE'
  }

  // 다음 달 예측
  const projectedNextMonth =
    monthlyScores.length > 0
      ? monthlyScores[monthlyScores.length - 1].weightedShifts + averageMonthlyIncrease
      : 0

  return {
    staffId,
    trend,
    monthlyScores,
    averageMonthlyIncrease: Math.round(averageMonthlyIncrease * 10) / 10,
    projectedNextMonth: Math.round(projectedNextMonth * 10) / 10
  }
}

/**
 * 불균형 감지
 */
export async function detectFairnessImbalance(
  clinicId: string,
  year: number,
  month: number,
  threshold: number = 1.5 // 평균의 1.5표준편차 이상 차이면 불균형
): Promise<ImbalanceDetectionResult> {
  console.log(`\n⚠️ 형평성 불균형 감지: ${year}년 ${month}월`)

  const staffList = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true
    },
    select: {
      id: true,
      name: true
    }
  })

  const staffMetrics: Array<{
    staffId: string
    staffName: string
    nightShifts: number
    weekendShifts: number
  }> = []

  for (const staff of staffList) {
    const scores = await prisma.fairnessScore.findMany({
      where: {
        staffId: staff.id,
        year,
        month
      }
    })

    const nightShifts = scores.reduce((sum, s) => sum + s.nightShiftCount, 0)
    const weekendShifts = scores.reduce((sum, s) => sum + s.weekendCount, 0)

    staffMetrics.push({
      staffId: staff.id,
      staffName: staff.name || '직원',
      nightShifts,
      weekendShifts
    })
  }

  // 평균 계산
  const avgNight =
    staffMetrics.reduce((sum, m) => sum + m.nightShifts, 0) / staffMetrics.length || 0
  const avgWeekend =
    staffMetrics.reduce((sum, m) => sum + m.weekendShifts, 0) / staffMetrics.length || 0

  // 표준편차 계산
  const nightStdDev = Math.sqrt(
    staffMetrics.reduce((sum, m) => sum + Math.pow(m.nightShifts - avgNight, 2), 0) /
      staffMetrics.length
  )
  const weekendStdDev = Math.sqrt(
    staffMetrics.reduce((sum, m) => sum + Math.pow(m.weekendShifts - avgWeekend, 2), 0) /
      staffMetrics.length
  )

  const imbalancedStaff: ImbalanceDetectionResult['imbalancedStaff'] = []

  for (const metrics of staffMetrics) {
    const nightDeviation = Math.abs(metrics.nightShifts - avgNight)
    const weekendDeviation = Math.abs(metrics.weekendShifts - avgWeekend)

    // 표준편차 기준 불균형 판단
    const nightZ = nightStdDev > 0 ? nightDeviation / nightStdDev : 0
    const weekendZ = weekendStdDev > 0 ? weekendDeviation / weekendStdDev : 0

    const maxZ = Math.max(nightZ, weekendZ)

    if (maxZ > threshold) {
      const type: 'OVERWORKED' | 'UNDERWORKED' =
        metrics.nightShifts > avgNight || metrics.weekendShifts > avgWeekend
          ? 'OVERWORKED'
          : 'UNDERWORKED'

      let severity: 'LOW' | 'MEDIUM' | 'HIGH'
      if (maxZ > 3) {
        severity = 'HIGH'
      } else if (maxZ > 2.5) {
        severity = 'MEDIUM'
      } else {
        severity = 'LOW'
      }

      imbalancedStaff.push({
        staffId: metrics.staffId,
        staffName: metrics.staffName,
        type,
        severity,
        nightShiftDeviation: Math.round(nightDeviation * 10) / 10,
        weekendShiftDeviation: Math.round(weekendDeviation * 10) / 10,
        totalDeviation: Math.round((nightDeviation + weekendDeviation) * 10) / 10
      })

      console.log(
        `   ⚠️  ${metrics.staffName}: ${type} (${severity}), ` +
          `야간 편차 ${nightDeviation.toFixed(1)}, 주말 편차 ${weekendDeviation.toFixed(1)}`
      )
    }
  }

  return {
    hasImbalance: imbalancedStaff.length > 0,
    imbalancedStaff,
    averageNightShifts: Math.round(avgNight * 10) / 10,
    averageWeekendShifts: Math.round(avgWeekend * 10) / 10
  }
}

/**
 * 자동 조정 제안
 */
export async function suggestFairnessAdjustments(
  clinicId: string,
  year: number,
  month: number
): Promise<AdjustmentResult> {
  console.log(`\n💡 형평성 자동 조정 제안: ${year}년 ${month}월`)

  const imbalance = await detectFairnessImbalance(clinicId, year, month)

  if (!imbalance.hasImbalance) {
    console.log('   ✅ 형평성 균형 상태, 조정 불필요')
    return {
      needsAdjustment: false,
      suggestions: [],
      expectedImpact: {
        varianceReduction: 0,
        fairnessScoreIncrease: 0
      }
    }
  }

  const suggestions: AdjustmentSuggestion[] = []

  for (const staff of imbalance.imbalancedStaff) {
    let action: 'INCREASE' | 'REDUCE' | 'MAINTAIN'
    let nightAdjustment = 0
    let weekendAdjustment = 0
    let priority: 'HIGH' | 'MEDIUM' | 'LOW'

    if (staff.type === 'OVERWORKED') {
      action = 'REDUCE'
      // 편차의 50%를 줄이도록 제안
      nightAdjustment = -Math.ceil(staff.nightShiftDeviation * 0.5)
      weekendAdjustment = -Math.ceil(staff.weekendShiftDeviation * 0.5)
    } else {
      action = 'INCREASE'
      // 편차의 50%를 늘리도록 제안
      nightAdjustment = Math.ceil(staff.nightShiftDeviation * 0.5)
      weekendAdjustment = Math.ceil(staff.weekendShiftDeviation * 0.5)
    }

    priority = staff.severity === 'HIGH' ? 'HIGH' : staff.severity === 'MEDIUM' ? 'MEDIUM' : 'LOW'

    suggestions.push({
      staffId: staff.staffId,
      staffName: staff.staffName,
      action,
      nightShiftAdjustment: nightAdjustment,
      weekendShiftAdjustment: weekendAdjustment,
      reason: `${staff.type === 'OVERWORKED' ? '과도한 근무' : '부족한 근무'} (심각도: ${staff.severity})`,
      priority
    })

    console.log(
      `   💡 ${staff.staffName}: ${action} (야간 ${nightAdjustment >= 0 ? '+' : ''}${nightAdjustment}, ` +
        `주말 ${weekendAdjustment >= 0 ? '+' : ''}${weekendAdjustment}) [${priority}]`
    )
  }

  // 예상 효과 계산 (간단한 추정)
  const expectedVarianceReduction = imbalance.imbalancedStaff.reduce(
    (sum, staff) => sum + staff.totalDeviation,
    0
  ) * 0.5

  const expectedScoreIncrease = Math.min(20, expectedVarianceReduction * 2)

  return {
    needsAdjustment: true,
    suggestions,
    expectedImpact: {
      varianceReduction: Math.round(expectedVarianceReduction * 10) / 10,
      fairnessScoreIncrease: Math.round(expectedScoreIncrease * 10) / 10
    }
  }
}
