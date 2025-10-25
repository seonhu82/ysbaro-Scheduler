// 형평성 계산

interface StaffMetrics {
  nightShifts: number
  weekendShifts: number
  holidayShifts?: number
}

interface FairnessResult {
  score: number
  grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  nightShiftDeviation: number
  weekendShiftDeviation: number
  normalizedScore: number
}

export function calculateFairnessScore(
  nightShifts: number,
  weekendShifts: number,
  allStaffMetrics: StaffMetrics[]
): FairnessResult {
  // 1. 평균 계산
  const avgNightShifts = allStaffMetrics.reduce((sum, m) => sum + m.nightShifts, 0) / allStaffMetrics.length
  const avgWeekendShifts = allStaffMetrics.reduce((sum, m) => sum + m.weekendShifts, 0) / allStaffMetrics.length

  // 2. 편차 계산
  const nightShiftDeviation = Math.abs(nightShifts - avgNightShifts)
  const weekendShiftDeviation = Math.abs(weekendShifts - avgWeekendShifts)

  // 3. 가중 평균 (야간 3, 주말 2)
  const weightedDeviation = (nightShiftDeviation * 3 + weekendShiftDeviation * 2) / 5

  // 4. 정규화 점수 (0-100, 낮을수록 좋음)
  const maxPossibleDeviation = Math.max(avgNightShifts, avgWeekendShifts) || 1
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
    score: Math.round(normalizedScore),
    grade,
    nightShiftDeviation: Math.round(nightShiftDeviation * 10) / 10,
    weekendShiftDeviation: Math.round(weekendShiftDeviation * 10) / 10,
    normalizedScore: Math.round(normalizedScore * 10) / 10
  }
}

// 전체 팀의 형평성 계산
export function calculateTeamFairness(allStaffMetrics: StaffMetrics[]) {
  if (allStaffMetrics.length === 0) {
    return {
      overallScore: 0,
      grade: 'POOR' as const,
      nightShiftVariance: 0,
      weekendShiftVariance: 0
    }
  }

  // 분산 계산
  const avgNight = allStaffMetrics.reduce((sum, m) => sum + m.nightShifts, 0) / allStaffMetrics.length
  const avgWeekend = allStaffMetrics.reduce((sum, m) => sum + m.weekendShifts, 0) / allStaffMetrics.length

  const nightVariance = allStaffMetrics.reduce(
    (sum, m) => sum + Math.pow(m.nightShifts - avgNight, 2),
    0
  ) / allStaffMetrics.length

  const weekendVariance = allStaffMetrics.reduce(
    (sum, m) => sum + Math.pow(m.weekendShifts - avgWeekend, 2),
    0
  ) / allStaffMetrics.length

  // 표준편차 기반 점수 (낮을수록 좋음)
  const nightStdDev = Math.sqrt(nightVariance)
  const weekendStdDev = Math.sqrt(weekendVariance)

  // 변동계수 (CV) 계산 - 평균 대비 표준편차 비율
  const nightCV = avgNight > 0 ? (nightStdDev / avgNight) * 100 : 0
  const weekendCV = avgWeekend > 0 ? (weekendStdDev / avgWeekend) * 100 : 0

  // 가중 평균 CV
  const weightedCV = (nightCV * 3 + weekendCV * 2) / 5

  // 점수화 (CV가 낮을수록 높은 점수)
  const overallScore = Math.max(0, 100 - weightedCV)

  let grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  if (overallScore >= 85) {
    grade = 'EXCELLENT'
  } else if (overallScore >= 70) {
    grade = 'GOOD'
  } else if (overallScore >= 55) {
    grade = 'FAIR'
  } else {
    grade = 'POOR'
  }

  return {
    overallScore: Math.round(overallScore),
    grade,
    nightShiftVariance: Math.round(nightVariance * 10) / 10,
    weekendShiftVariance: Math.round(weekendVariance * 10) / 10
  }
}
