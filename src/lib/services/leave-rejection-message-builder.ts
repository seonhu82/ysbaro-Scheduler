/**
 * 연차/오프 신청 거절 시 사용자 친화적 메시지를 생성하는 빌더
 *
 * 목적:
 * - 자동 배치 우선 원칙을 강조
 * - 직원이 이해할 수 있는 언어로 이유 설명
 * - 대안 제시 (다른 날짜, 자동 배치 활용)
 */

import { SimulationResult } from './leave-eligibility-simulator'

export interface RejectionMessage {
  title: string
  message: string
  suggestion: string
  icon?: 'warning' | 'info' | 'error'
  alternatives?: string[]
}

/**
 * 시뮬레이션 결과를 기반으로 사용자 친화적 메시지 생성
 */
export function buildRejectionMessage(result: SimulationResult): RejectionMessage {
  if (result.feasible) {
    return {
      title: '신청 가능',
      message: '이 날짜는 신청이 가능합니다.',
      suggestion: '',
      icon: 'info',
    }
  }

  switch (result.reason) {
    case 'CATEGORY_SHORTAGE':
      return buildCategoryShortageMessage(result)

    case 'WEEK_4DAY_VIOLATION':
      return buildWeek4DayViolationMessage(result)

    case 'FAIRNESS_EXCEEDED':
      return buildFairnessExceededMessage(result)

    case 'NO_SCHEDULE':
      return buildNoScheduleMessage(result)

    default:
      return buildUnknownErrorMessage(result)
  }
}

/**
 * 구분별 인원 부족 메시지
 */
function buildCategoryShortageMessage(result: SimulationResult): RejectionMessage {
  const details = result.details?.categoryShortage

  if (!details) {
    return {
      title: '자동 배치가 어렵습니다',
      message: '이 날짜는 인원 배치가 어려울 수 있습니다.',
      suggestion: '이 날짜는 자동 배치에 맡기시면 시스템이 최적의 OFF를 배정해드립니다.',
      icon: 'warning',
    }
  }

  const shortage = details.required - details.available

  return {
    title: '인원 부족으로 자동 배치가 어렵습니다',
    message: `이 날짜는 ${details.category}급 ${details.required}명이 필요하지만, 귀하를 제외하면 ${details.available}명만 근무 가능합니다 (${shortage}명 부족).`,
    suggestion: '꼭 필요한 날짜가 아니라면 자동 배치로 형평성 있는 OFF를 받으실 수 있습니다.',
    icon: 'warning',
  }
}

/**
 * 주4일 제약 위반 메시지
 */
function buildWeek4DayViolationMessage(result: SimulationResult): RejectionMessage {
  const details = result.details?.weekConstraint

  if (!details) {
    return {
      title: '주간 근무일 부족',
      message: '해당 주에 이미 연차/오프 신청이 많아 추가 신청이 어렵습니다.',
      suggestion: '꼭 필요한 날짜가 아니라면 자동 배치로 형평성 있는 OFF를 받으실 수 있습니다.',
      icon: 'warning',
    }
  }

  const weekStartDate = new Date(details.weekStart)
  const weekEndDate = new Date(details.weekEnd)

  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return {
    title: '주간 근무일 부족',
    message: `해당 주(${formatDate(weekStartDate)}~${formatDate(weekEndDate)})에 이 날짜까지 OFF를 받으면 주${details.minimumRequired}일 미만 근무가 됩니다 (현재: ${details.currentWorkDays}일).`,
    suggestion: '주4일 근무 원칙을 지키기 위해 이 날짜는 자동 배치에 맡겨주세요.',
    icon: 'warning',
  }
}

/**
 * 편차 초과 메시지
 */
function buildFairnessExceededMessage(result: SimulationResult): RejectionMessage {
  return {
    title: '형평성 조율이 어렵습니다',
    message: '과거 근무 이력을 고려할 때, 이 날짜 신청 시 다른 직원과의 형평성 조율이 어렵습니다.',
    suggestion: '자동 배치 시스템이 모든 직원의 과거 근무 이력을 고려하여 가장 공평하게 OFF를 배정해드립니다.',
    icon: 'info',
  }
}

/**
 * 스케줄 미생성 메시지
 */
function buildNoScheduleMessage(result: SimulationResult): RejectionMessage {
  return {
    title: '스케줄이 아직 생성되지 않았습니다',
    message: '해당 날짜의 근무 스케줄이 아직 생성되지 않아 신청 가능 여부를 확인할 수 없습니다.',
    suggestion: '관리자가 스케줄을 생성한 후 다시 신청해주세요.',
    icon: 'info',
  }
}

/**
 * 알 수 없는 오류 메시지
 */
function buildUnknownErrorMessage(result: SimulationResult): RejectionMessage {
  return {
    title: '신청 확인 중 오류 발생',
    message: '신청 가능 여부를 확인하는 중 오류가 발생했습니다.',
    suggestion: '잠시 후 다시 시도하거나 관리자에게 문의해주세요.',
    icon: 'error',
  }
}

/**
 * 과도한 신청 경고 메시지 (통계 기반)
 */
export function buildExcessiveApplicationWarning(
  currentCount: number,
  recommendedMax: number,
  expectedTotal: number
): RejectionMessage {
  const ratio = Math.round((currentCount / expectedTotal) * 100)

  return {
    title: '⚠️ 신청 수가 많습니다',
    message: `현재 ${currentCount}일을 신청하셨습니다 (권장: ${recommendedMax}일 이하). 과도한 신청은 자동 배치의 유연성을 떨어뜨립니다.`,
    suggestion: '꼭 필요한 날짜만 신청하고, 나머지는 자동 배치에 맡기시는 것을 권장합니다.',
    icon: 'warning',
  }
}

/**
 * 신청 성공 메시지
 */
export function buildSuccessMessage(applicationType: 'ANNUAL' | 'OFF'): RejectionMessage {
  return {
    title: '신청이 접수되었습니다',
    message: `${applicationType === 'ANNUAL' ? '연차' : '오프'} 신청이 성공적으로 접수되었습니다.`,
    suggestion: '나머지 OFF는 자동 배치 시스템이 형평성을 고려하여 배정합니다.',
    icon: 'info',
  }
}
