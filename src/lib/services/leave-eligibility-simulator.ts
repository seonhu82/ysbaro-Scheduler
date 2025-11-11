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
import { calculateCategoryRequirements, calculateCategorySlots, calculateCategorySlotsFromCombination, checkCategoryAvailability } from '@/lib/services/category-slot-service'
import { getFlexibleStaff } from '@/lib/services/category-slot-service'
import { calculateFairnessBasedLeaveLimit } from '@/lib/services/fairness-based-leave-calculator'

export interface SimulationRequest {
  clinicId: string
  staffId: string
  leaveDate: Date
  leaveType: 'ANNUAL' | 'OFF'
  year: number
  month: number
  existingOffsInWeek?: string[]  // 같은 주에 이미 선택된 OFF 날짜들 (YYYY-MM-DD)
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
 * 주의 시작일 (일요일) 계산 - UTC 기준
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  // UTC 기준으로 요일 계산
  const day = d.getUTCDay()
  const diff = day === 0 ? 0 : -day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * 주의 종료일 (토요일) 계산 - UTC 기준
 */
function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
  weekEnd.setUTCHours(23, 59, 59, 999)
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
  // Holiday 모델에서 공휴일 조회
  const holidays = await prisma.holiday.findMany({
    where: {
      clinicId,
      date: {
        gte: weekStart,
        lte: weekEnd,
      }
    }
  })

  return holidays.length
}

/**
 * 1. 주4일 제약 검증
 *
 * 로직:
 * - 해당 주의 평일 수 (월~토) 계산
 * - 이미 신청한 OFF 수 확인
 * - 신청하려는 OFF 추가 시 근무 가능일이 4일 이상인지 확인
 * - 공휴일은 자동으로 OFF이므로 근무일에서 제외
 */
async function checkWeek4DayConstraint(
  clinicId: string,
  staffId: string,
  leaveDate: Date,
  leaveType: 'ANNUAL' | 'OFF',
  existingOffsInWeek?: string[]  // 프론트엔드에서 이미 선택한 OFF 날짜들
): Promise<{ allowed: boolean; message?: string; details?: any }> {
  const weekStart = getWeekStart(leaveDate)
  const weekEnd = getWeekEnd(leaveDate)

  console.log('🔍 [주4일 체크] 주 범위:', weekStart.toISOString().split('T')[0], '~', weekEnd.toISOString().split('T')[0])

  // OFF가 아니면 통과 (연차는 근무일로 계산)
  if (leaveType !== 'OFF') {
    return { allowed: true }
  }

  // 해당 주에 공휴일이 있는지 확인
  const holidaysInWeek = await prisma.holiday.findMany({
    where: {
      clinicId,
      date: {
        gte: weekStart,
        lte: weekEnd,
      }
    }
  })

  if (holidaysInWeek.length > 0) {
    const holidayDates = holidaysInWeek.map(h => h.date.toISOString().split('T')[0]).join(', ')
    return {
      allowed: false,
      message: `공휴일(${holidayDates})이 있는 주는 OFF 신청이 불가능합니다. 배치 유연성과 형평성 보존을 위해 연차만 신청 가능합니다.`,
      details: {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        holidaysInWeek: holidaysInWeek.length
      }
    }
  }

  // DB에서 해당 주의 승인된/대기중 OFF 조회
  const approvedOffs = await prisma.leaveApplication.findMany({
    where: {
      staffId,
      clinicId,
      date: {
        gte: weekStart,
        lte: weekEnd,
      },
      leaveType: 'OFF',
      status: {
        in: ['CONFIRMED', 'PENDING']
      }
    },
    select: { date: true }
  })

  console.log('📊 [주4일 체크] DB OFF 수:', approvedOffs.length)

  // 현재 OFF 카운트 = DB OFF 수
  let totalOffs = approvedOffs.length

  // 프론트엔드에서 이미 선택한 OFF 추가 (DB에 없는 것만)
  if (existingOffsInWeek && existingOffsInWeek.length > 0) {
    for (const dateStr of existingOffsInWeek) {
      const alreadyInDb = approvedOffs.some(off => {
        const offDate = new Date(off.date)
        return offDate.toISOString().split('T')[0] === dateStr
      })
      if (!alreadyInDb) {
        totalOffs++
      }
    }
    console.log('📊 [주4일 체크] 프론트엔드 추가 선택 후 OFF 수:', totalOffs)
  }

  // 현재 신청하려는 날짜가 아직 카운트 안됐으면 추가
  const currentDateStr = leaveDate.toISOString().split('T')[0]
  const alreadyInDb = approvedOffs.some(off => {
    const offDate = new Date(off.date)
    return offDate.toISOString().split('T')[0] === currentDateStr
  })
  const alreadySelected = existingOffsInWeek?.includes(currentDateStr)

  if (!alreadyInDb && !alreadySelected) {
    totalOffs++
  }

  console.log('📊 [주4일 체크] 최종 OFF 수 (현재 신청 포함):', totalOffs)

  // 주당 OFF 2개 초과 시 차단
  const MAX_OFFS_PER_WEEK = 2

  if (totalOffs > MAX_OFFS_PER_WEEK) {
    return {
      allowed: false,
      message: `이번 주(${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]})에 이미 ${totalOffs - 1}개의 OFF가 있습니다. 주당 최대 ${MAX_OFFS_PER_WEEK}개까지만 신청 가능합니다.`,
      details: {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        currentOffs: totalOffs - 1,
        maxAllowed: MAX_OFFS_PER_WEEK,
      }
    }
  }

  return { allowed: true }
}

/**
 * 2. 구분별 필수 인원 검증 (구분별 슬롯 계산 사용)
 */
async function checkCategoryRequirement(
  clinicId: string,
  staffId: string,
  leaveDate: Date,
  year: number,
  month: number
): Promise<{ allowed: boolean; message?: string; details?: any }> {
  // 직원의 구분 조회
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      categoryName: true,
      departmentName: true,
    }
  })

  if (!staff || !staff.categoryName) {
    return {
      allowed: false,
      message: '직원 정보를 찾을 수 없습니다.',
    }
  }

  // 규칙 설정 조회
  const ruleSettings = await prisma.ruleSettings.findUnique({
    where: { clinicId },
    select: {
      staffCategories: true
    }
  })

  if (!ruleSettings) {
    return {
      allowed: false,
      message: '규칙 설정을 찾을 수 없습니다.',
    }
  }

  // 해당 날짜의 원장 배치 조회
  const scheduleDoctors = await prisma.scheduleDoctor.findMany({
    where: {
      date: leaveDate,
      schedule: {
        clinicId,
        year,
        month,
      }
    },
    include: {
      doctor: {
        select: {
          id: true,
          shortName: true
        }
      }
    },
    orderBy: {
      doctorId: 'asc'
    }
  })

  if (scheduleDoctors.length === 0) {
    return {
      allowed: false,
      message: '해당 날짜의 스케줄이 아직 생성되지 않았습니다.',
    }
  }

  // 원장 조합으로 필요 직원 수 찾기
  const doctorNames = scheduleDoctors.map(sd => sd.doctor.shortName).sort()
  const doctorCombination = await prisma.doctorCombination.findFirst({
    where: {
      clinicId,
      doctors: { equals: doctorNames }
    }
  })

  if (!doctorCombination) {
    return {
      allowed: false,
      message: `원장 조합 [${doctorNames.join(', ')}]에 대한 필요 직원 설정을 찾을 수 없습니다.`,
    }
  }

  const requiredStaff = doctorCombination.requiredStaff

  // 구분별 슬롯 계산 - departmentCategoryStaff가 있으면 사용, 없으면 비율 기반 계산
  const categorySlots = doctorCombination.departmentCategoryStaff
    ? await calculateCategorySlotsFromCombination(
        clinicId,
        leaveDate,
        doctorCombination.departmentCategoryStaff,
        staff.departmentName
      )
    : await calculateCategorySlots(
        clinicId,
        leaveDate,
        requiredStaff,
        ruleSettings.staffCategories
      )

  console.log('🔍 [DEBUG] Category calculation:')
  console.log('  - Using departmentCategoryStaff:', !!doctorCombination.departmentCategoryStaff)
  console.log('  - Staff department:', staff.departmentName)
  console.log('  - Staff category:', staff.categoryName)
  console.log('  - Available slots:', Object.keys(categorySlots))
  console.log('  - Category slots:', JSON.stringify(categorySlots, null, 2))

  const myCategorySlot = categorySlots[staff.categoryName]

  if (!myCategorySlot) {
    return {
      allowed: false,
      message: `구분 '${staff.categoryName}'을 찾을 수 없습니다.`,
    }
  }

  // 신청 가능 슬롯이 0이면 거부
  if (myCategorySlot.available <= 0) {
    return {
      allowed: false,
      message: `${staff.categoryName} 구분의 신청 가능 슬롯이 부족합니다. (필요: ${myCategorySlot.required}명, 이미 신청: ${myCategorySlot.approved}명)`,
      details: {
        category: staff.categoryName,
        required: myCategorySlot.required,
        available: myCategorySlot.available,
        approved: myCategorySlot.approved,
      }
    }
  }

  return { allowed: true }
}

/**
 * 3. 편차 허용 범위 검증 (형평성 기반 경우의 수 계산)
 */
async function checkFairnessDeviation(
  clinicId: string,
  staffId: string,
  leaveDate: Date
): Promise<{ allowed: boolean; message?: string; details?: any }> {
  const year = leaveDate.getFullYear()
  const month = leaveDate.getMonth() + 1

  try {
    // 형평성 기반 최대 신청 가능 일수 계산
    const fairnessLimit = await calculateFairnessBasedLeaveLimit(
      clinicId,
      staffId,
      year,
      month
    )

    // 이미 신청한 오프 수 확인
    const appliedOffs = await prisma.leaveApplication.count({
      where: {
        staffId,
        clinicId,
        status: { in: ['CONFIRMED', 'PENDING'] },
        leaveType: 'OFF',
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0),
        }
      }
    })

    // 신청 가능 일수 초과 체크
    if (appliedOffs >= fairnessLimit.maxAllowedDays) {
      return {
        allowed: false,
        message: `형평성 기준 초과: ${fairnessLimit.reason} (최대 ${fairnessLimit.maxAllowedDays}일, 이미 ${appliedOffs}일 신청)`,
        details: {
          currentDeviation: fairnessLimit.currentDeviation,
          avgDeviation: fairnessLimit.avgDeviation,
          maxAllowedDays: fairnessLimit.maxAllowedDays,
          appliedOffs,
        }
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('형평성 체크 오류:', error)
    // 오류 시 통과로 처리 (안전장치)
    return { allowed: true }
  }
}

/**
 * 메인 시뮬레이션 함수
 */
export async function simulateScheduleWithLeave(
  request: SimulationRequest
): Promise<SimulationResult> {
  const { clinicId, staffId, leaveDate, leaveType, year, month } = request

  console.log('🔍 [Simulator] 시뮬레이션 시작:', {
    staffId,
    leaveDate: leaveDate.toISOString().split('T')[0],
    leaveType,
    year,
    month
  })

  try {
    // 1. 주4일 제약 검증
    console.log('📋 [Simulator] 1단계: 주4일 제약 검증 시작')
    const week4DayCheck = await checkWeek4DayConstraint(
      clinicId,
      staffId,
      leaveDate,
      leaveType,
      request.existingOffsInWeek
    )
    console.log('📋 [Simulator] 주4일 제약 결과:', week4DayCheck)

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
    console.log('📋 [Simulator] 2단계: 구분별 슬롯 검증 시작')
    const categoryCheck = await checkCategoryRequirement(
      clinicId,
      staffId,
      leaveDate,
      year,
      month
    )
    console.log('📋 [Simulator] 구분별 슬롯 결과:', categoryCheck)

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
    console.log('📋 [Simulator] 3단계: 형평성 편차 검증 시작')
    const fairnessCheck = await checkFairnessDeviation(clinicId, staffId, leaveDate)
    console.log('📋 [Simulator] 형평성 편차 결과:', fairnessCheck)

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
    console.log('✅ [Simulator] 모든 제약 조건 통과 - 신청 가능')
    return {
      feasible: true,
    }

  } catch (error: any) {
    console.error('❌ [Simulator] 시뮬레이션 오류:', error)
    return {
      feasible: false,
      reason: 'UNKNOWN',
      technicalReason: error.message,
      userFriendlyMessage: '신청 가능 여부를 확인하는 중 오류가 발생했습니다.',
    }
  }
}
