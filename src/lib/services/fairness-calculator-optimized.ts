/**
 * 최적화된 형평성 계산 서비스
 *
 * 배치 로딩을 통한 N+1 쿼리 문제 해결
 */

import { prisma } from '@/lib/prisma'
import {
  batchLoadFairnessScores,
  batchLoadFairnessScoresMultiMonth,
  loadActiveStaffWithFairness
} from './query-optimizer'
import {
  EnhancedFairnessResult,
  CategoryFairnessResult,
  DepartmentFairnessResult,
  FairnessTrendResult,
  ImbalanceDetectionResult,
  AdjustmentResult,
  StaffMetrics,
  FairnessWeights
} from './fairness-calculator-enhanced'

// 기존 calculateEnhancedFairnessScore는 그대로 사용 (순수 함수)
export { calculateEnhancedFairnessScore } from './fairness-calculator-enhanced'

/**
 * 구분별 형평성 계산 (최적화)
 *
 * Before: O(N × M) - N개 직원에 대해 각각 DB 조회
 * After: O(1) - 한 번의 조회로 모든 데이터 획득
 */
export async function calculateCategoryFairnessOptimized(
  clinicId: string,
  year: number,
  month: number
): Promise<CategoryFairnessResult> {
  console.log(`\n📊 구분별 형평성 계산 (최적화): ${year}년 ${month}월`)

  // 1. 활성 직원과 형평성 점수를 한 번에 조회 (join 사용)
  const staffWithScores = await loadActiveStaffWithFairness(clinicId, year, month)

  // 2. 구분별로 그룹화
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

  for (const staff of staffWithScores) {
    const category = staff.categoryName || '미분류'

    // 형평성 점수 (이미 join으로 가져옴)
    const scores = staff.fairnessScores || []
    const nightShifts = scores.reduce((sum: number, s: any) => sum + s.nightShiftCount, 0)
    const weekendShifts = scores.reduce((sum: number, s: any) => sum + s.weekendCount, 0)
    const holidayShifts = scores.reduce((sum: number, s: any) => sum + s.holidayCount, 0)

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

  // 3. 각 구분별 통계 계산 (기존 로직과 동일)
  const result: CategoryFairnessResult = {}

  for (const [category, staffInCategory] of categoriesMap.entries()) {
    const staffCount = staffInCategory.length

    if (staffCount === 0) continue

    const avgNight = staffInCategory.reduce((sum, s) => sum + s.nightShifts, 0) / staffCount
    const avgWeekend = staffInCategory.reduce((sum, s) => sum + s.weekendShifts, 0) / staffCount
    const avgHoliday = staffInCategory.reduce((sum, s) => sum + s.holidayShifts, 0) / staffCount

    const nightVariance =
      staffInCategory.reduce((sum, s) => sum + Math.pow(s.nightShifts - avgNight, 2), 0) / staffCount
    const weekendVariance =
      staffInCategory.reduce((sum, s) => sum + Math.pow(s.weekendShifts - avgWeekend, 2), 0) / staffCount

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
 * 부서별 형평성 계산 (최적화)
 */
export async function calculateDepartmentFairnessOptimized(
  clinicId: string,
  year: number,
  month: number
): Promise<DepartmentFairnessResult> {
  console.log(`\n🏢 부서별 형평성 계산 (최적화): ${year}년 ${month}월`)

  const staffWithScores = await loadActiveStaffWithFairness(clinicId, year, month)

  const departmentsMap = new Map<
    string,
    Array<{
      id: string
      name: string | null
      nightShifts: number
      weekendShifts: number
    }>
  >()

  for (const staff of staffWithScores) {
    const department = staff.department || '미분류'

    const scores = staff.fairnessScores || []
    const nightShifts = scores.reduce((sum: number, s: any) => sum + s.nightShiftCount, 0)
    const weekendShifts = scores.reduce((sum: number, s: any) => sum + s.weekendCount, 0)

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
      staffInDept.reduce((sum, s) => sum + Math.pow(s.weekendShifts - avgWeekend, 2), 0) / staffCount

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
 * 형평성 추세 분석 (여러 직원에 대해 최적화)
 *
 * Before: 직원별로 각각 조회
 * After: 모든 직원의 데이터를 한 번에 조회
 */
export async function analyzeFairnessTrendsBatch(
  staffIds: string[],
  year: number,
  endMonth: number,
  monthsToAnalyze: number = 3
): Promise<Map<string, FairnessTrendResult>> {
  const startMonth = Math.max(1, endMonth - monthsToAnalyze + 1)

  // 배치로 모든 직원의 점수를 한 번에 조회
  const scoresMap = await batchLoadFairnessScoresMultiMonth(staffIds, year, startMonth, endMonth)

  const results = new Map<string, FairnessTrendResult>()

  for (const staffId of staffIds) {
    const scores = scoresMap.get(staffId) || []

    const monthlyScores = scores.map((score: any) => {
      const totalShifts =
        score.nightShiftCount + score.weekendCount + score.holidayCount + score.holidayAdjacentCount

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

    const projectedNextMonth =
      monthlyScores.length > 0
        ? monthlyScores[monthlyScores.length - 1].weightedShifts + averageMonthlyIncrease
        : 0

    results.set(staffId, {
      staffId,
      trend,
      monthlyScores,
      averageMonthlyIncrease: Math.round(averageMonthlyIncrease * 10) / 10,
      projectedNextMonth: Math.round(projectedNextMonth * 10) / 10
    })
  }

  return results
}

/**
 * 불균형 감지 (최적화)
 */
export async function detectFairnessImbalanceOptimized(
  clinicId: string,
  year: number,
  month: number,
  threshold: number = 1.5
): Promise<ImbalanceDetectionResult> {
  console.log(`\n⚠️ 형평성 불균형 감지 (최적화): ${year}년 ${month}월`)

  // 한 번의 조회로 모든 데이터 획득
  const staffWithScores = await loadActiveStaffWithFairness(clinicId, year, month)

  const staffMetrics: Array<{
    staffId: string
    staffName: string
    nightShifts: number
    weekendShifts: number
  }> = []

  for (const staff of staffWithScores) {
    const scores = staff.fairnessScores || []
    const nightShifts = scores.reduce((sum: number, s: any) => sum + s.nightShiftCount, 0)
    const weekendShifts = scores.reduce((sum: number, s: any) => sum + s.weekendCount, 0)

    staffMetrics.push({
      staffId: staff.id,
      staffName: staff.name || '직원',
      nightShifts,
      weekendShifts
    })
  }

  const avgNight =
    staffMetrics.reduce((sum, m) => sum + m.nightShifts, 0) / staffMetrics.length || 0
  const avgWeekend =
    staffMetrics.reduce((sum, m) => sum + m.weekendShifts, 0) / staffMetrics.length || 0

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
 * 성능 비교 유틸리티
 */
export async function comparePerformance(clinicId: string, year: number, month: number) {
  console.log('\n⏱️  성능 비교: 기존 vs 최적화')

  // 기존 방식
  const start1 = Date.now()
  const { calculateCategoryFairness } = await import('./fairness-calculator-enhanced')
  await calculateCategoryFairness(clinicId, year, month)
  const time1 = Date.now() - start1

  // 최적화된 방식
  const start2 = Date.now()
  await calculateCategoryFairnessOptimized(clinicId, year, month)
  const time2 = Date.now() - start2

  console.log(`\n📊 결과:`)
  console.log(`   기존: ${time1}ms`)
  console.log(`   최적화: ${time2}ms`)
  console.log(`   개선: ${Math.round((1 - time2 / time1) * 100)}%`)

  return {
    original: time1,
    optimized: time2,
    improvement: Math.round((1 - time2 / time1) * 100)
  }
}
