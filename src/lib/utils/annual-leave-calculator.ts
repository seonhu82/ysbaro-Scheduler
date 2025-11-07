/**
 * 연차 자동 계산 유틸리티
 * 한국 근로기준법 기준 연차 계산
 */

/**
 * 근속연수 계산
 * @param hireDate 입사일
 * @param baseDate 기준일 (기본값: 오늘)
 * @returns 근속연수 (소수점 포함)
 */
export function calculateYearsOfService(
  hireDate: Date,
  baseDate: Date = new Date()
): number {
  const diffTime = baseDate.getTime() - hireDate.getTime()
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25)
  return diffYears
}

/**
 * 한국 근로기준법 기준 연차 자동 계산
 *
 * 규칙:
 * - 1년 미만 근로자: 1개월 개근 시 1일 (최대 11일)
 * - 1년 이상 근로자: 15일 (기본)
 * - 3년 이상 근로자: 매 2년마다 1일씩 가산 (최대 25일)
 *
 * @param hireDate 입사일
 * @param baseDate 기준일 (기본값: 오늘)
 * @returns 연차 일수
 */
export function calculateAnnualLeave(
  hireDate: Date,
  baseDate: Date = new Date()
): number {
  const yearsOfService = calculateYearsOfService(hireDate, baseDate)

  if (yearsOfService < 1) {
    // 1년 미만: 1개월 개근 시 1일 (최대 11일)
    const months = Math.floor(yearsOfService * 12)
    return Math.min(months, 11)
  } else if (yearsOfService < 3) {
    // 1년 이상 3년 미만: 15일 기본
    return 15
  } else {
    // 3년 이상: 15일 + (근속년수-1)/2 (최대 25일)
    const additionalYears = Math.floor((yearsOfService - 1) / 2)
    return Math.min(15 + additionalYears, 25)
  }
}

/**
 * 근속연수를 사람이 읽기 쉬운 형식으로 변환
 * @param hireDate 입사일
 * @param baseDate 기준일 (기본값: 오늘)
 * @returns "N년 M개월" 형식 문자열
 */
export function formatYearsOfService(
  hireDate: Date,
  baseDate: Date = new Date()
): string {
  const yearsOfService = calculateYearsOfService(hireDate, baseDate)
  const years = Math.floor(yearsOfService)
  const months = Math.floor((yearsOfService - years) * 12)

  if (years === 0) {
    return `${months}개월`
  } else if (months === 0) {
    return `${years}년`
  } else {
    return `${years}년 ${months}개월`
  }
}

/**
 * 연차 계산 근거 설명 텍스트 생성
 * @param hireDate 입사일
 * @param baseDate 기준일 (기본값: 오늘)
 * @returns 연차 계산 근거 설명
 */
export function getAnnualLeaveReason(
  hireDate: Date,
  baseDate: Date = new Date()
): string {
  const yearsOfService = calculateYearsOfService(hireDate, baseDate)
  const annualDays = calculateAnnualLeave(hireDate, baseDate)
  const serviceText = formatYearsOfService(hireDate, baseDate)

  if (yearsOfService < 1) {
    const months = Math.floor(yearsOfService * 12)
    return `근속 ${serviceText} (1년 미만 근로자: 월 1일, 최대 11일)`
  } else if (yearsOfService < 3) {
    return `근속 ${serviceText} (1년 이상 근로자: 기본 15일)`
  } else {
    const additionalYears = Math.floor((yearsOfService - 1) / 2)
    return `근속 ${serviceText} (기본 15일 + 가산 ${additionalYears}일, 최대 25일)`
  }
}
