/**
 * 연차/오프 신청 시 자동 배치 가능성을 시뮬레이션하는 엔진
 *
 * 핵심 철학:
 * - 신청은 최소화되어야 함 (자동 배치 우선)
 * - 신청이 많을수록 자동 배치 실패 가능성 증가
 * - 제약 조건을 만족할 수 없으면 신청 차단
 *
 * 검증하는 제약 조건:
 * 1. 구분별 필수 인원 (minRequired)
 * 2. 주4일 제약 (주 경계: 일~토)
 * 3. 공휴일 있는 주 처리
 * 4. 편차 허용 범위 (±3.0 상한선)
 */

import { prisma } from '@/lib/prisma'
import { calculateCategoryRequirements } from '@/lib/services/category-slot-service'
import { getFlexibleStaff } from '@/lib/services/category-slot-service'

export interface SimulationRequest {
  clinicId: string
  staffId: string
  leaveDate: Date
  leaveType: 'ANNUAL' | 'OFF'
  year: number
  month: number
}

export interface SimulationResult {
  feasible: boolean
  reason?: 'CATEGORY_SHORTAGE' | 'WEEK_4DAY_VIOLATION' | 'FAIRNESS_EXCEEDED' | 'NO_SCHEDULE' | 'UNKNOWN'
  technicalReason?: string
  userFriendlyMessage?: string
  details?: {
    categoryShortage?: {
      category: string
      required: number
      available: number
    }
    weekConstraint?: {
      weekStart: string
      weekEnd: string
      currentWorkDays: number
      minimumRequired: number
    }
    fairnessIssue?: {
      currentDeviation: number
      maxAllowed: number
    }
  }
  suggestedDates?: string[]
}

/**
 * 주의 시작일 (일요일) 계산
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? 0 : -day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * 주의 종료일 (토요일) 계산
 */
function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return weekEnd
}

/**
 * 해당 주의 공휴일 수 계산
 */
async function getHolidaysInWeek(
  clinicId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  const year = weekStart.getFullYear()
  const month = weekStart.getMonth() + 1

  // ClosedDaySettings에서 공휴일 조회
  const closedDaySettings = await prisma.closedDaySettings.findUnique({
    where: {
      clinicId_year_month: {
        clinicId,
        year,
        month,
      }
    },
    select: {
      holidays: true,
    }
  })

  if (!closedDaySettings?.holidays) {
    return 0
  }

  const holidays = closedDaySettings.holidays as any[]

  // 주 범위 내의 공휴일 개수 세기
  const holidayCount = holidays.filter(holiday => {
    const holidayDate = new Date(holiday.date)
    return holidayDate >= weekStart && holidayDate <= weekEnd
  }).length

  return holidayCount
}

/**
 * 1. 주4일 제약 검증
 */
async function checkWeek4DayConstraint(
  clinicId: string,
  staffId: string,
  leaveDate: Date,
  leaveType: 'ANNUAL' | 'OFF'
): Promise<{ allowed: boolean; message?: string; details?: any }> {
  const weekStart = getWeekStart(leaveDate)
  const weekEnd = getWeekEnd(leaveDate)

  // 해당 주의 스케줄 조회
  const year = leaveDate.getFullYear()
  const month = leaveDate.getMonth() + 1

  // 해당 주에 직원이 배치된 날짜들 조회
  const assignments = await prisma.dailyStaffAssignment.findMany({
    where: {
      staffId,
      slot: {
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
        week: {
          schedule: {
            clinicId,
            year,
            month,
          }
        }
      }
    },
    include: {
      slot: {
        select: {
          date: true,
        }
      }
    }
  })

  // 해당 주의 승인된 연차 조회
  const approvedLeaves = await prisma.leaveApplication.findMany({
    where: {
      staffId,
      clinicId,
      date: {
        gte: weekStart,
        lte: weekEnd,
      },
      status: {
        in: ['CONFIRMED', 'PENDING']
      }
    },
    select: {
      date: true,
      leaveType: true,
    }
  })

  // 공휴일 수 조회
  const holidayCount = await getHolidaysInWeek(clinicId, weekStart, weekEnd)

  // 현재 근무일 수 계산
  let currentWorkDays = assignments.length

  // 신청하려는 날짜가 현재 배치되어 있으면 제외
  const isAssignedOnLeaveDate = assignments.some(a => {
    const assignedDate = new Date(a.slot.date)
    return assignedDate.toISOString().split('T')[0] === leaveDate.toISOString().split('T')[0]
  })

  if (isAssignedOnLeaveDate) {
    currentWorkDays--
  }

  // 연차 일수 계산 (연차는 근무일로 계산)
  let annualDays = approvedLeaves.filter(l => l.leaveType === 'ANNUAL').length

  // 신청하려는 것이 연차이고, 해당 날짜에 이미 신청한 것이 없으면 추가
  if (leaveType === 'ANNUAL') {
    const alreadyApplied = approvedLeaves.some(l => {
      const appliedDate = new Date(l.date)
      return appliedDate.toISOString().split('T')[0] === leaveDate.toISOString().split('T')[0]
    })
    if (!alreadyApplied) {
      annualDays++
    }
  }

  // 최소 근무일 = 4 - 공휴일 수
  const minimumRequired = Math.max(0, 4 - holidayCount)
  const totalWorkEquivalent = currentWorkDays + annualDays

  if (totalWorkEquivalent < minimumRequired) {
    return {
      allowed: false,
      message: `해당 주는 실제 근무 ${currentWorkDays}일 + 연차 ${annualDays}일 = ${totalWorkEquivalent}일로 주${minimumRequired}일 미만입니다.`,
      details: {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        currentWorkDays: totalWorkEquivalent,
        minimumRequired,
      }
    }
  }

  return { allowed: true }
}

/**
 * 2. 구분별 필수 인원 검증
 */
async function checkCategoryRequirement(
  clinicId: string,
  staffId: string,
  leaveDate: Date
): Promise<{ allowed: boolean; message?: string; details?: any }> {
  const year = leaveDate.getFullYear()
  const month = leaveDate.getMonth() + 1

  // 직원의 구분 조회
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      categoryName: true,
    }
  })

  if (!staff) {
    return {
      allowed: false,
      message: '직원 정보를 찾을 수 없습니다.',
    }
  }

  // 해당 날짜의 DailySlot 조회
  const slot = await prisma.dailySlot.findFirst({
    where: {
      date: leaveDate,
      week: {
        schedule: {
          clinicId,
          year,
          month,
        }
      }
    },
    select: {
      id: true,
      requiredStaff: true,
      doctorSchedule: true,
    }
  })

  if (!slot) {
    return {
      allowed: false,
      message: '해당 날짜의 스케줄이 아직 생성되지 않았습니다.',
    }
  }

  // 의사 조합 정보 조회
  const doctorSchedule = slot.doctorSchedule as any
  const doctorCombo = doctorSchedule?.doctors || []

  // Category ratio settings 조회
  const ratioSettings = await prisma.categoryRatioSettings.findUnique({
    where: { clinicId }
  })

  if (!ratioSettings) {
    return {
      allowed: false,
      message: '구분별 비율 설정을 찾을 수 없습니다.',
    }
  }

  const ratios = ratioSettings.ratios as { [key: string]: number }

  // 구분별 필요 인원 계산
  const categoryRequirements = calculateCategoryRequirements(slot.requiredStaff, ratios)
  const minRequired = categoryRequirements[staff.categoryName] || 0

  // 해당 구분의 전체 직원 조회 (활성 + 이미 OFF 신청 안한 사람)
  const availableStaff = await prisma.staff.findMany({
    where: {
      clinicId,
      categoryName: staff.categoryName,
      isActive: true,
      id: {
        not: staffId, // 신청자 제외
      },
      leaveApplications: {
        none: {
          date: leaveDate,
          status: { in: ['PENDING', 'CONFIRMED'] }
        }
      }
    }
  })

  // Flexible staff 확인
  const flexibleStaff = await getFlexibleStaff(
    clinicId,
    staff.categoryName,
    [staffId]
  )

  const totalAvailable = availableStaff.length + flexibleStaff.length

  if (totalAvailable < minRequired) {
    return {
      allowed: false,
      message: `${staff.categoryName}급은 최소 ${minRequired}명 필요하지만, 귀하 제외 시 ${totalAvailable}명만 가능합니다.`,
      details: {
        category: staff.categoryName,
        required: minRequired,
        available: totalAvailable,
      }
    }
  }

  return { allowed: true }
}

/**
 * 3. 편차 허용 범위 검증 (선택적 - 추후 구현)
 */
async function checkFairnessDeviation(
  staffId: string,
  leaveDate: Date
): Promise<{ allowed: boolean; message?: string; details?: any }> {
  // TODO: 과거 누적 편차 조회 및 검증
  // 현재는 통과로 처리
  return { allowed: true }
}

/**
 * 메인 시뮬레이션 함수
 */
export async function simulateScheduleWithLeave(
  request: SimulationRequest
): Promise<SimulationResult> {
  const { clinicId, staffId, leaveDate, leaveType, year, month } = request

  try {
    // 1. 주4일 제약 검증
    const week4DayCheck = await checkWeek4DayConstraint(
      clinicId,
      staffId,
      leaveDate,
      leaveType
    )

    if (!week4DayCheck.allowed) {
      return {
        feasible: false,
        reason: 'WEEK_4DAY_VIOLATION',
        technicalReason: week4DayCheck.message,
        userFriendlyMessage: '이 날짜 신청 시 주간 근무일이 부족합니다. 자동 배치에 맡기시면 적절히 OFF를 배정받으실 수 있습니다.',
        details: {
          weekConstraint: week4DayCheck.details,
        }
      }
    }

    // 2. 구분별 필수 인원 검증
    const categoryCheck = await checkCategoryRequirement(
      clinicId,
      staffId,
      leaveDate
    )

    if (!categoryCheck.allowed) {
      return {
        feasible: false,
        reason: categoryCheck.message?.includes('스케줄이 아직') ? 'NO_SCHEDULE' : 'CATEGORY_SHORTAGE',
        technicalReason: categoryCheck.message,
        userFriendlyMessage: categoryCheck.message?.includes('스케줄이 아직')
          ? '해당 날짜의 스케줄이 아직 생성되지 않았습니다. 스케줄 생성 후 신청해주세요.'
          : `이 날짜는 ${categoryCheck.details?.category}급 인원이 부족하여 자동 배치가 어렵습니다. 다른 날짜를 고려하시거나, 자동 배치에 맡겨주세요.`,
        details: {
          categoryShortage: categoryCheck.details,
        }
      }
    }

    // 3. 편차 검증 (선택적)
    const fairnessCheck = await checkFairnessDeviation(staffId, leaveDate)

    if (!fairnessCheck.allowed) {
      return {
        feasible: false,
        reason: 'FAIRNESS_EXCEEDED',
        technicalReason: fairnessCheck.message,
        userFriendlyMessage: '과거 근무 이력상 이 날짜 신청 시 형평성 조율이 어렵습니다. 자동 배치 시스템이 가장 공평한 방식으로 OFF를 배정해드립니다.',
        details: {
          fairnessIssue: fairnessCheck.details,
        }
      }
    }

    // 모든 제약 조건 통과
    return {
      feasible: true,
    }

  } catch (error: any) {
    console.error('Simulation error:', error)
    return {
      feasible: false,
      reason: 'UNKNOWN',
      technicalReason: error.message,
      userFriendlyMessage: '신청 가능 여부를 확인하는 중 오류가 발생했습니다.',
    }
  }
}
