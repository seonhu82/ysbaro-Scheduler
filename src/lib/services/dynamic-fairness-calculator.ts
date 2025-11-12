/**
 * 동적 형평성 기반 연차/오프 필터
 *
 * 설정에 따라 근무일, 야간, 주말, 공휴일, 공휴일 전후 형평성을 동적으로 적용
 * 각 직원의 구분별 필요 근무 횟수를 계산하여 신청 가능 여부 판단
 */

import { prisma } from '@/lib/prisma'

interface FairnessSettings {
  enableNightShiftFairness: boolean
  enableWeekendFairness: boolean
  enableHolidayFairness: boolean
  enableHolidayAdjacentFairness: boolean
  fairnessThreshold: number // 편차 허용 범위
}

interface StaffFairnessScore {
  totalDays: number
  night: number
  weekend: number
  holiday: number
  holidayAdjacent: number
}

interface DynamicFairnessResult {
  allowed: boolean
  reason?: string
  details?: {
    category: string
    totalStaff: number
    requiredSlots: number
    baseRequirement: number // 기준 근무 횟수 (필요 슬롯 / 인원)
    adjustedRequirement: number // 편차 적용 후 최소 근무 횟수
    currentApplications: number // 현재 신청 수
    maxApplications: number // 최대 신청 가능 수
    totalOpportunities: number // 전체 기회 (예: 주말 4번)
  }
}

/**
 * 주말 형평성 필터
 *
 * 계산 로직:
 * 1. 현재 직원의 구분(rank) 파악
 * 2. 해당 월 주말(토요일)에 필요한 해당 구분 인력 합 계산
 * 3. 해당 구분 총 인원 수 파악
 * 4. 기준 근무 횟수 = 필요 인력 / 총 인원
 * 5. 편차 적용 = 기준 근무 횟수 - 편차
 * 6. 최대 신청 가능 = 전체 주말 수 - 편차 적용 후 최소 근무 횟수
 */
export async function checkWeekendFairness(
  clinicId: string,
  staffId: string,
  requestDate: Date,
  year: number,
  month: number,
  currentApplications: number | Date[], // 이미 신청한 주말 OFF/연차 수 또는 날짜 배열
  applicationStartDate?: Date, // 신청 가능 시작일 (옵션)
  applicationEndDate?: Date // 신청 가능 종료일 (옵션)
): Promise<DynamicFairnessResult> {
  // 1. 형평성 설정 확인
  const fairnessSettings = await prisma.fairnessSettings.findUnique({
    where: { clinicId },
    select: {
      enableWeekendFairness: true,
      fairnessThreshold: true
    }
  })

  // 주말 형평성이 비활성화되어 있으면 무조건 허용
  if (!fairnessSettings?.enableWeekendFairness) {
    return { allowed: true }
  }

  // 2. 직원 정보 조회
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      categoryName: true,
      fairnessScoreWeekend: true
    }
  })

  if (!staff || !staff.categoryName) {
    return { allowed: true, reason: '직원 정보를 찾을 수 없습니다' }
  }

  const category = staff.categoryName

  // 3. 해당 구분 총 인원 조회
  const totalStaffInCategory = await prisma.staff.count({
    where: {
      clinicId,
      isActive: true,
      departmentName: '진료실',
      categoryName: category
    }
  })

  if (totalStaffInCategory === 0) {
    return { allowed: true, reason: '해당 구분 직원이 없습니다' }
  }

  // 4. 해당 월의 신청 가능한 토요일 날짜 찾기 (한국 시간 기준)
  const saturdays: Date[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    // 한국 시간 기준으로 날짜 생성 (UTC)
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
    if (date.getUTCDay() === 6) { // 토요일
      // 신청 가능 기간 필터링 (제공된 경우)
      if (applicationStartDate && date < applicationStartDate) continue
      if (applicationEndDate && date > applicationEndDate) continue

      saturdays.push(date)
    }
  }

  // 5. 각 토요일에 필요한 해당 구분 인력 계산
  let totalRequiredSlots = 0

  for (const saturday of saturdays) {
    const dateStr = saturday.toISOString().split('T')[0]

    // 해당 날짜의 원장 스케줄 조회
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        date: saturday,
        schedule: {
          clinicId,
          year,
          month
        }
      },
      include: {
        doctor: {
          select: {
            shortName: true
          }
        }
      }
    })

    if (doctorSchedules.length === 0) continue

    // 원장 조합으로 필요 인원 찾기
    const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
    const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

    const combination = await prisma.doctorCombination.findFirst({
      where: {
        clinicId,
        doctors: { equals: doctorShortNames },
        hasNightShift
      }
    })

    if (!combination) continue

    // 부서별 필요 인원 중 해당 구분 필요 인원
    const departmentRequiredStaff = combination.departmentRequiredStaff as { [key: string]: number }
    const departmentCategoryStaff = combination.departmentCategoryStaff as {
      [key: string]: {
        [key: string]: { count: number; minRequired: number }
      }
    }

    const treatmentDept = departmentCategoryStaff['진료실'] || {}
    const categoryData = treatmentDept[category]
    const categoryRequired = categoryData?.count || 0

    totalRequiredSlots += categoryRequired
  }

  // 6. 기준 근무 횟수 계산 (슬롯 기준)
  const baseRequirement = totalRequiredSlots / totalStaffInCategory

  // 7. 편차 적용
  const currentWeekendDeviation = staff.fairnessScoreWeekend || 0

  // 편차 적용: 기준 + 편차
  // 예: 기준 2.67, 편차 -0.5 → 2.67 + (-0.5) = 2.17 → 최소 2번 근무
  const adjustedRequirement = Math.max(0, Math.round(baseRequirement + currentWeekendDeviation))

  // 8. 최대 신청 가능 슬롯 수
  const maxApplicationSlots = Math.max(0, totalRequiredSlots - adjustedRequirement)

  // 9. 현재 신청의 실제 슬롯 수 계산
  let currentUsedSlots = 0

  if (Array.isArray(currentApplications)) {
    // 날짜 배열이 제공된 경우: 각 날짜의 실제 슬롯 수를 계산
    for (const appDate of currentApplications) {
      const doctorSchedules = await prisma.scheduleDoctor.findMany({
        where: {
          date: appDate,
          schedule: { clinicId, year, month }
        },
        include: {
          doctor: { select: { shortName: true } }
        }
      })

      if (doctorSchedules.length === 0) continue

      const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
      const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

      const combination = await prisma.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: { equals: doctorShortNames },
          hasNightShift
        }
      })

      if (combination) {
        const departmentCategoryStaff = combination.departmentCategoryStaff as {
          [key: string]: {
            [key: string]: { count: number; minRequired: number }
          }
        }
        const treatmentDept = departmentCategoryStaff['진료실'] || {}
        const categoryData = treatmentDept[category]
        const categoryRequired = categoryData?.count || 0
        currentUsedSlots += categoryRequired
      }
    }
  } else {
    // 숫자가 제공된 경우 (하위 호환성): 평균 슬롯 수로 추정
    const avgSlotsPerDay = saturdays.length > 0 ? totalRequiredSlots / saturdays.length : 0
    currentUsedSlots = currentApplications * avgSlotsPerDay
  }

  const applicationCount = Array.isArray(currentApplications) ? currentApplications.length : currentApplications

  console.log('📊 [checkWeekendFairness] 상세 정보:', {
    category,
    totalStaff: totalStaffInCategory,
    totalRequiredSlots,
    baseRequirement: Math.round(baseRequirement * 100) / 100,
    currentWeekendDeviation: staff.fairnessScoreWeekend,
    adjustedRequirement,
    applicationCount,
    maxApplicationSlots,
    currentUsedSlots: Math.round(currentUsedSlots * 100) / 100,
    totalOpportunities: saturdays.length
  })

  if (currentUsedSlots >= maxApplicationSlots) {
    console.log('❌ [checkWeekendFairness] 슬롯 수 초과로 거부')
    return {
      allowed: false,
      reason: `주말 형평성 기준 초과: 현재 ${currentUsedSlots.toFixed(1)}슬롯 사용 중 (최대 ${maxApplicationSlots}슬롯)`,
      details: {
        category,
        totalStaff: totalStaffInCategory,
        requiredSlots: totalRequiredSlots,
        baseRequirement: Math.round(baseRequirement * 100) / 100,
        adjustedRequirement,
        currentApplications: applicationCount,
        maxApplicationSlots,
        currentUsedSlots: Math.round(currentUsedSlots * 100) / 100,
        totalOpportunities: saturdays.length
      }
    }
  }

  console.log('✅ [checkWeekendFairness] 슬롯 여유 있음 - 통과')
  return {
    allowed: true,
    details: {
      category,
      totalStaff: totalStaffInCategory,
      requiredSlots: totalRequiredSlots,
      baseRequirement: Math.round(baseRequirement * 100) / 100,
      adjustedRequirement,
      currentApplications: applicationCount,
      maxApplicationSlots,
      currentUsedSlots: Math.round(currentUsedSlots * 100) / 100,
      totalOpportunities: saturdays.length
    }
  }
}

/**
 * 야간 형평성 필터
 * 주말과 동일한 로직, 야간 근무가 있는 날짜만 대상
 */
export async function checkNightShiftFairness(
  clinicId: string,
  staffId: string,
  requestDate: Date,
  year: number,
  month: number,
  currentApplications: number | Date[]
): Promise<DynamicFairnessResult> {
  // 형평성 설정 확인
  const fairnessSettings = await prisma.fairnessSettings.findUnique({
    where: { clinicId },
    select: {
      enableNightShiftFairness: true,
      fairnessThreshold: true
    }
  })

  if (!fairnessSettings?.enableNightShiftFairness) {
    return { allowed: true }
  }

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      categoryName: true,
      fairnessScoreNight: true
    }
  })

  if (!staff || !staff.categoryName) {
    return { allowed: true }
  }

  const category = staff.categoryName

  const totalStaffInCategory = await prisma.staff.count({
    where: {
      clinicId,
      isActive: true,
      departmentName: '진료실',
      categoryName: category
    }
  })

  if (totalStaffInCategory === 0) {
    return { allowed: true }
  }

  // 야간 근무가 있는 날짜 찾기
  const nightShiftDates = await prisma.scheduleDoctor.findMany({
    where: {
      schedule: {
        clinicId,
        year,
        month
      },
      hasNightShift: true
    },
    select: {
      date: true
    },
    distinct: ['date']
  })

  // 각 야간 근무일의 슬롯 수 합계를 구함
  let totalRequiredSlots = 0

  for (const { date } of nightShiftDates) {
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        date,
        schedule: {
          clinicId,
          year,
          month
        }
      },
      include: {
        doctor: {
          select: {
            shortName: true
          }
        }
      }
    })

    const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
    const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

    const combination = await prisma.doctorCombination.findFirst({
      where: {
        clinicId,
        doctors: { equals: doctorShortNames },
        hasNightShift
      }
    })

    if (!combination) continue

    const departmentCategoryStaff = combination.departmentCategoryStaff as {
      [key: string]: {
        [key: string]: { count: number; minRequired: number }
      }
    }
    const treatmentDept = departmentCategoryStaff['진료실'] || {}
    const categoryData = treatmentDept[category]
    const categoryRequired = categoryData?.count || 0

    totalRequiredSlots += categoryRequired
  }

  // 기준: 총 슬롯 / 인원수
  const baseRequirement = totalRequiredSlots / totalStaffInCategory
  const currentNightDeviation = staff.fairnessScoreNight || 0

  // 편차 적용: 기준 + 편차 = 최소 일해야 하는 날 수
  const adjustedRequirement = Math.max(0, Math.round(baseRequirement + currentNightDeviation))

  // 최대 신청 가능 일수 = 전체 야간일 - 일해야하는 날
  const totalNightShiftDays = nightShiftDates.length
  const maxApplicationDays = Math.max(0, totalNightShiftDays - adjustedRequirement)

  // 현재 신청한 야간 근무일 수 (날짜 개수)
  const applicationCount = Array.isArray(currentApplications) ? currentApplications.length : currentApplications

  console.log('📊 [checkNightShiftFairness] 상세 정보:', {
    category,
    totalStaff: totalStaffInCategory,
    totalNightShiftDays,
    totalRequiredSlots,
    baseRequirement: Math.round(baseRequirement * 100) / 100,
    currentNightDeviation: staff.fairnessScoreNight,
    adjustedRequirement,
    maxApplicationDays,
    applicationCount,
  })

  if (applicationCount > maxApplicationDays) {
    console.log('❌ [checkNightShiftFairness] 날짜 개수 초과로 거부')
    return {
      allowed: false,
      reason: `야간 형평성 기준 초과: 현재 ${applicationCount}일 신청 중 (최대 ${maxApplicationDays}일)`,
      details: {
        category,
        totalStaff: totalStaffInCategory,
        totalNightShiftDays,
        totalRequiredSlots,
        baseRequirement: Math.round(baseRequirement * 100) / 100,
        adjustedRequirement,
        currentApplications: applicationCount,
        maxApplicationDays,
      }
    }
  }

  console.log('✅ [checkNightShiftFairness] 날짜 개수 여유 있음 - 통과')
  return { allowed: true }
}

/**
 * 공휴일 형평성 필터
 */
export async function checkHolidayFairness(
  clinicId: string,
  staffId: string,
  requestDate: Date,
  year: number,
  month: number,
  currentApplications: number | Date[]
): Promise<DynamicFairnessResult> {
  const fairnessSettings = await prisma.fairnessSettings.findUnique({
    where: { clinicId },
    select: {
      enableHolidayFairness: true,
      fairnessThreshold: true
    }
  })

  if (!fairnessSettings?.enableHolidayFairness) {
    return { allowed: true }
  }

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      categoryName: true,
      fairnessScoreHoliday: true
    }
  })

  if (!staff || !staff.categoryName) {
    return { allowed: true }
  }

  const category = staff.categoryName

  const totalStaffInCategory = await prisma.staff.count({
    where: {
      clinicId,
      isActive: true,
      departmentName: '진료실',
      categoryName: category
    }
  })

  if (totalStaffInCategory === 0) {
    return { allowed: true }
  }

  // 공휴일 찾기
  const holidays = await prisma.holiday.findMany({
    where: {
      clinicId,
      date: {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0)
      }
    },
    select: {
      date: true
    }
  })

  let totalRequiredSlots = 0

  for (const { date } of holidays) {
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        date,
        schedule: {
          clinicId,
          year,
          month
        }
      },
      include: {
        doctor: {
          select: {
            shortName: true
          }
        }
      }
    })

    if (doctorSchedules.length === 0) continue

    const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
    const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

    const combination = await prisma.doctorCombination.findFirst({
      where: {
        clinicId,
        doctors: { equals: doctorShortNames },
        hasNightShift
      }
    })

    if (!combination) continue

    const departmentCategoryStaff = combination.departmentCategoryStaff as {
      [key: string]: {
        [key: string]: { count: number; minRequired: number }
      }
    }
    const treatmentDept = departmentCategoryStaff['진료실'] || {}
    const categoryData = treatmentDept[category]
    const categoryRequired = categoryData?.count || 0

    totalRequiredSlots += categoryRequired
  }

  // 기준: 총 슬롯 / 인원수 (일 단위)
  const baseRequirement = totalRequiredSlots / totalStaffInCategory
  const currentHolidayDeviation = staff.fairnessScoreHoliday || 0

  // 편차 적용: 기준 + 편차 = 최소 일해야 하는 날 수
  const adjustedRequirement = Math.max(0, Math.round(baseRequirement + currentHolidayDeviation))

  // 최대 신청 가능 일수 = 전체 공휴일 - 일해야하는 날
  const totalHolidayDays = holidays.length
  const maxApplicationDays = Math.max(0, totalHolidayDays - adjustedRequirement)

  // 현재 신청한 공휴일 수 (날짜 개수)
  const applicationCount = Array.isArray(currentApplications) ? currentApplications.length : currentApplications

  console.log('📊 [checkHolidayFairness] 상세 정보:', {
    category,
    totalStaff: totalStaffInCategory,
    totalHolidayDays,
    totalRequiredSlots,
    baseRequirement: Math.round(baseRequirement * 100) / 100,
    currentHolidayDeviation: staff.fairnessScoreHoliday,
    adjustedRequirement,
    maxApplicationDays,
    applicationCount,
  })

  if (applicationCount > maxApplicationDays) {
    console.log('❌ [checkHolidayFairness] 날짜 개수 초과로 거부')
    return {
      allowed: false,
      reason: `공휴일 형평성 기준 초과: 현재 ${applicationCount}일 신청 중 (최대 ${maxApplicationDays}일)`,
      details: {
        category,
        totalStaff: totalStaffInCategory,
        totalHolidayDays,
        totalRequiredSlots,
        baseRequirement: Math.round(baseRequirement * 100) / 100,
        currentHolidayDeviation: staff.fairnessScoreHoliday,
        adjustedRequirement,
        maxApplicationDays,
        applicationCount,
      }
    }
  }

  console.log('✅ [checkHolidayFairness] 날짜 개수 여유 있음 - 통과')
  return { allowed: true }
}

/**
 * 공휴일 전후 형평성 필터
 * 공휴일 전날(금) 또는 후날(월) 근무 형평성
 */
export async function checkHolidayAdjacentFairness(
  clinicId: string,
  staffId: string,
  requestDate: Date,
  year: number,
  month: number,
  currentApplications: number | Date[]
): Promise<DynamicFairnessResult> {
  const fairnessSettings = await prisma.fairnessSettings.findUnique({
    where: { clinicId },
    select: {
      enableHolidayAdjacentFairness: true,
      fairnessThreshold: true
    }
  })

  if (!fairnessSettings?.enableHolidayAdjacentFairness) {
    return { allowed: true }
  }

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      categoryName: true,
      fairnessScoreHolidayAdjacent: true
    }
  })

  if (!staff || !staff.categoryName) {
    return { allowed: true }
  }

  const category = staff.categoryName

  const totalStaffInCategory = await prisma.staff.count({
    where: {
      clinicId,
      isActive: true,
      departmentName: '진료실',
      categoryName: category
    }
  })

  if (totalStaffInCategory === 0) {
    return { allowed: true }
  }

  // 공휴일 찾기
  const holidays = await prisma.holiday.findMany({
    where: {
      clinicId,
      date: {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0)
      }
    },
    select: {
      date: true
    }
  })

  // 공휴일 전날(금) 또는 후날(월) 날짜 찾기
  const adjacentDates = new Set<string>()
  for (const { date } of holidays) {
    const dayOfWeek = date.getDay()

    // 공휴일이 월요일(1)이면 전날 금요일도 체크
    if (dayOfWeek === 1) {
      const friday = new Date(date)
      friday.setDate(friday.getDate() - 3)
      adjacentDates.add(friday.toISOString().split('T')[0])
    }

    // 공휴일이 금요일(5)이면 다음날 월요일도 체크
    if (dayOfWeek === 5) {
      const monday = new Date(date)
      monday.setDate(monday.getDate() + 3)
      adjacentDates.add(monday.toISOString().split('T')[0])
    }
  }

  let totalRequiredSlots = 0

  for (const dateStr of adjacentDates) {
    const date = new Date(dateStr)

    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        date,
        schedule: {
          clinicId,
          year,
          month
        }
      },
      include: {
        doctor: {
          select: {
            shortName: true
          }
        }
      }
    })

    if (doctorSchedules.length === 0) continue

    const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
    const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

    const combination = await prisma.doctorCombination.findFirst({
      where: {
        clinicId,
        doctors: { equals: doctorShortNames },
        hasNightShift
      }
    })

    if (!combination) continue

    const departmentCategoryStaff = combination.departmentCategoryStaff as {
      [key: string]: {
        [key: string]: { count: number; minRequired: number }
      }
    }
    const treatmentDept = departmentCategoryStaff['진료실'] || {}
    const categoryData = treatmentDept[category]
    const categoryRequired = categoryData?.count || 0

    totalRequiredSlots += categoryRequired
  }

  // 기준: 총 슬롯 / 인원수 (일 단위)
  const baseRequirement = totalRequiredSlots / totalStaffInCategory
  const currentAdjacentDeviation = staff.fairnessScoreHolidayAdjacent || 0

  // 편차 적용: 기준 + 편차 = 최소 일해야 하는 날 수
  const adjustedRequirement = Math.max(0, Math.round(baseRequirement + currentAdjacentDeviation))

  // 최대 신청 가능 일수 = 전체 공휴일 전후일 - 일해야하는 날
  const totalAdjacentDays = adjacentDates.size
  const maxApplicationDays = Math.max(0, totalAdjacentDays - adjustedRequirement)

  // 현재 신청한 공휴일 전후일 수 (날짜 개수)
  const applicationCount = Array.isArray(currentApplications) ? currentApplications.length : currentApplications

  console.log('📊 [checkHolidayAdjacentFairness] 상세 정보:', {
    category,
    totalStaff: totalStaffInCategory,
    totalAdjacentDays,
    totalRequiredSlots,
    baseRequirement: Math.round(baseRequirement * 100) / 100,
    currentAdjacentDeviation: staff.fairnessScoreHolidayAdjacent,
    adjustedRequirement,
    maxApplicationDays,
    applicationCount,
  })

  if (applicationCount > maxApplicationDays) {
    console.log('❌ [checkHolidayAdjacentFairness] 날짜 개수 초과로 거부')
    return {
      allowed: false,
      reason: `공휴일 전후 형평성 기준 초과: 현재 ${applicationCount}일 신청 중 (최대 ${maxApplicationDays}일)`,
      details: {
        category,
        totalStaff: totalStaffInCategory,
        totalAdjacentDays,
        totalRequiredSlots,
        baseRequirement: Math.round(baseRequirement * 100) / 100,
        currentAdjacentDeviation: staff.fairnessScoreHolidayAdjacent,
        adjustedRequirement,
        maxApplicationDays,
        applicationCount,
      }
    }
  }

  console.log('✅ [checkHolidayAdjacentFairness] 날짜 개수 여유 있음 - 통과')
  return { allowed: true }
}

/**
 * 총 근무일 형평성 필터
 * 전체 근무일수 기반 형평성
 */
export async function checkTotalDaysFairness(
  clinicId: string,
  staffId: string,
  requestDate: Date,
  year: number,
  month: number,
  currentApplications: number | Date[] // 숫자 또는 날짜 배열
): Promise<DynamicFairnessResult> {
  // 총 근무일 형평성은 항상 체크 (설정 없음)
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      categoryName: true,
      fairnessScoreTotalDays: true
    }
  })

  if (!staff || !staff.categoryName) {
    return { allowed: true }
  }

  const category = staff.categoryName

  const totalStaffInCategory = await prisma.staff.count({
    where: {
      clinicId,
      isActive: true,
      departmentName: '진료실',
      categoryName: category
    }
  })

  if (totalStaffInCategory === 0) {
    return { allowed: true }
  }

  // 해당 월의 모든 근무일 찾기 (원장 스케줄이 있는 날)
  const workDays = await prisma.scheduleDoctor.findMany({
    where: {
      schedule: {
        clinicId,
        year,
        month
      }
    },
    select: {
      date: true
    },
    distinct: ['date']
  })

  let totalRequiredSlots = 0

  for (const { date } of workDays) {
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        date,
        schedule: {
          clinicId,
          year,
          month
        }
      },
      include: {
        doctor: {
          select: {
            shortName: true
          }
        }
      }
    })

    if (doctorSchedules.length === 0) continue

    const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
    const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

    const combination = await prisma.doctorCombination.findFirst({
      where: {
        clinicId,
        doctors: { equals: doctorShortNames },
        hasNightShift
      }
    })

    if (!combination) continue

    const departmentCategoryStaff = combination.departmentCategoryStaff as {
      [key: string]: {
        [key: string]: { count: number; minRequired: number }
      }
    }
    const treatmentDept = departmentCategoryStaff['진료실'] || {}
    const categoryData = treatmentDept[category]
    const categoryRequired = categoryData?.count || 0

    totalRequiredSlots += categoryRequired
  }

  const baseRequirement = totalRequiredSlots / totalStaffInCategory
  const currentTotalDaysDeviation = staff.fairnessScoreTotalDays || 0
  // 편차 적용: 기준 + 편차 = 최소 일해야 하는 슬롯 수
  const adjustedRequirement = Math.max(0, Math.round(baseRequirement + currentTotalDaysDeviation))
  const maxApplicationSlots = Math.max(0, totalRequiredSlots - adjustedRequirement)

  // 현재 신청의 실제 슬롯 수 계산
  let currentUsedSlots = 0

  if (Array.isArray(currentApplications)) {
    // 날짜 배열이 제공된 경우: 각 날짜의 실제 슬롯 수를 계산
    for (const appDate of currentApplications) {
      const doctorSchedules = await prisma.scheduleDoctor.findMany({
        where: {
          date: appDate,
          schedule: { clinicId, year, month }
        },
        include: {
          doctor: { select: { shortName: true } }
        }
      })

      if (doctorSchedules.length === 0) continue

      const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
      const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

      const combination = await prisma.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: { equals: doctorShortNames },
          hasNightShift
        }
      })

      if (combination) {
        const departmentCategoryStaff = combination.departmentCategoryStaff as {
          [key: string]: {
            [key: string]: { count: number; minRequired: number }
          }
        }
        const treatmentDept = departmentCategoryStaff['진료실'] || {}
        const categoryData = treatmentDept[category]
        const categoryRequired = categoryData?.count || 0
        currentUsedSlots += categoryRequired
      }
    }
  } else {
    // 숫자가 제공된 경우 (하위 호환성): 평균 슬롯 수로 추정
    const avgSlotsPerDay = workDays.length > 0 ? totalRequiredSlots / workDays.length : 0
    currentUsedSlots = currentApplications * avgSlotsPerDay
  }

  const applicationCount = Array.isArray(currentApplications) ? currentApplications.length : currentApplications

  if (currentUsedSlots >= maxApplicationSlots) {
    return {
      allowed: false,
      reason: `총 근무일 형평성 기준 초과: 현재 ${currentUsedSlots.toFixed(1)}슬롯 사용 중 (최대 ${maxApplicationSlots}슬롯)`,
      details: {
        category,
        totalStaff: totalStaffInCategory,
        requiredSlots: totalRequiredSlots,
        baseRequirement: Math.round(baseRequirement * 100) / 100,
        adjustedRequirement,
        currentApplications: applicationCount,
        maxApplicationSlots,
        currentUsedSlots: Math.round(currentUsedSlots * 100) / 100,
        totalOpportunities: workDays.length
      }
    }
  }

  return { allowed: true }
}

/**
 * 통합 형평성 검증 함수
 * 모든 개별 형평성 체크를 순차적으로 실행하고 첫 번째 실패 시 중단
 * @param pendingSelections - 아직 제출되지 않은, 프론트엔드에서 선택한 날짜들 (선택사항)
 */
export async function checkDynamicFairness(
  clinicId: string,
  staffId: string,
  requestDate: Date,
  year: number,
  month: number,
  pendingSelections: Date[] = []
): Promise<DynamicFairnessResult> {
  console.log('🔍 [checkDynamicFairness] 시작:', {
    requestDate: requestDate.toISOString().split('T')[0],
    dayOfWeek: requestDate.getDay()
  })

  // 형평성 설정 조회
  const settings = await prisma.fairnessSettings.findUnique({
    where: { clinicId }
  })

  if (!settings) {
    console.log('⚠️ [checkDynamicFairness] 형평성 설정 없음 - 통과')
    return { allowed: true }
  }

  console.log('📋 [checkDynamicFairness] 형평성 설정:', {
    enableWeekendFairness: settings.enableWeekendFairness,
    enableNightShiftFairness: settings.enableNightShiftFairness,
    enableHolidayFairness: settings.enableHolidayFairness,
    enableHolidayAdjacentFairness: settings.enableHolidayAdjacentFairness
  })

  // 직원 정보 조회
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      name: true,
      categoryName: true,
      departmentName: true,
      fairnessScoreTotalDays: true,
      fairnessScoreWeekend: true,
      fairnessScoreNight: true,
      fairnessScoreHoliday: true,
      fairnessScoreHolidayAdjacent: true,
    }
  })

  if (!staff) {
    return {
      allowed: false,
      reason: '직원 정보를 찾을 수 없습니다.',
      technicalReason: 'STAFF_NOT_FOUND'
    }
  }

  // 신청 기간 계산
  const leavePeriod = await prisma.leavePeriod.findFirst({
    where: { clinicId, year, month, isActive: true }
  })

  if (!leavePeriod) {
    return {
      allowed: false,
      reason: '신청 기간을 찾을 수 없습니다.',
      technicalReason: 'LEAVE_PERIOD_NOT_FOUND'
    }
  }

  let applicationStartDate = leavePeriod.startDate
  let applicationEndDate = leavePeriod.endDate

  // StaffAssignment 최종일 확인
  const lastStaffAssignment = await prisma.staffAssignment.findFirst({
    where: { schedule: { clinicId } },
    orderBy: { date: 'desc' }
  })

  if (lastStaffAssignment?.date) {
    const nextDay = new Date(lastStaffAssignment.date)
    nextDay.setDate(nextDay.getDate() + 1)
    if (nextDay > new Date(leavePeriod.startDate)) {
      applicationStartDate = nextDay
    }
  }

  // ScheduleDoctor 최종일 확인
  const lastDoctorSchedule = await prisma.scheduleDoctor.findFirst({
    where: { schedule: { clinicId } },
    orderBy: { date: 'desc' }
  })

  if (lastDoctorSchedule?.date) {
    const doctorEndDate = new Date(lastDoctorSchedule.date)
    const leavePeriodEndDate = new Date(leavePeriod.endDate)
    if (doctorEndDate < leavePeriodEndDate) {
      applicationEndDate = doctorEndDate
    }
  }

  // 기존 OFF 신청 조회 (DB에 저장된 것)
  const existingApplications = await prisma.leaveApplication.findMany({
    where: {
      staffId,
      leaveType: 'OFF',
      status: { in: ['CONFIRMED', 'PENDING'] },
      date: {
        gte: applicationStartDate,
        lte: applicationEndDate
      }
    },
    select: { date: true }
  })

  // DB에 저장된 날짜 + 아직 제출 안 된 선택 날짜들 (중복 제거)
  const existingDates = existingApplications.map(app => app.date)
  const allDates = [...existingDates, ...pendingSelections]

  console.log(`📊 [checkDynamicFairness] DB 저장된 OFF: ${existingDates.length}개, 선택 중인 OFF: ${pendingSelections.length}개`)

  // 1. 총 근무일 형평성 체크 (항상 실행)
  const totalDaysCheck = await checkTotalDaysFairness(
    clinicId,
    staffId,
    requestDate,
    year,
    month,
    [...allDates, requestDate]
  )

  if (!totalDaysCheck.allowed) {
    return totalDaysCheck
  }

  // 2. 주말 형평성 체크 (토요일이고 설정 활성화된 경우)
  if (settings.enableWeekendFairness && requestDate.getDay() === 6) {
    console.log('🔍 [checkDynamicFairness] 주말 형평성 체크 시작')
    // 기존 선택된 토요일 날짜들 (DB + pending)
    const existingSaturdays = allDates.filter(d => d.getDay() === 6)
    console.log(`📊 [checkDynamicFairness] 기존 토요일 OFF: ${existingSaturdays.length}개`, existingSaturdays.map(d => d.toISOString().split('T')[0]))

    const weekendCheck = await checkWeekendFairness(
      clinicId,
      staffId,
      requestDate,
      year,
      month,
      [...existingSaturdays, requestDate]
    )

    console.log('📋 [checkDynamicFairness] 주말 형평성 결과:', weekendCheck)

    if (!weekendCheck.allowed) {
      console.log('❌ [checkDynamicFairness] 주말 형평성 거부:', weekendCheck.reason)
      return weekendCheck
    }
    console.log('✅ [checkDynamicFairness] 주말 형평성 통과')
  }

  // 3. 야간 근무 형평성 체크 (야간 근무일이고 설정 활성화된 경우)
  console.log('🔍 [checkDynamicFairness] 야간 근무 형평성 설정:', settings.enableNightShiftFairness)

  if (settings.enableNightShiftFairness) {
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        date: requestDate,
        schedule: { clinicId, year, month }
      }
    })

    const hasNightShift = doctorSchedules.some(ds => ds.hasNightShift)
    console.log(`📋 [checkDynamicFairness] ${requestDate.toISOString().split('T')[0]} 야간 근무 여부:`, hasNightShift)
    console.log(`📋 [checkDynamicFairness] doctorSchedules 개수: ${doctorSchedules.length}`)

    if (hasNightShift) {
      console.log('🔍 [checkDynamicFairness] 야간 근무 형평성 체크 시작')
      console.log(`📊 [checkDynamicFairness] 전체 선택된 날짜 (DB + pending): ${allDates.length}개`)

      // 기존 선택된 야간 근무일들 (DB + pending)
      const existingNightShiftDates = []
      for (const date of allDates) {
        const ds = await prisma.scheduleDoctor.findMany({
          where: {
            date,
            schedule: { clinicId, year, month }
          }
        })
        if (ds.some(d => d.hasNightShift)) {
          existingNightShiftDates.push(date)
          console.log(`  ✅ ${date.toISOString().split('T')[0]} - 야간 근무일`)
        }
      }

      console.log(`📊 [checkDynamicFairness] 기존 야간 근무 OFF: ${existingNightShiftDates.length}개`)

      const nightShiftCheck = await checkNightShiftFairness(
        clinicId,
        staffId,
        requestDate,
        year,
        month,
        [...existingNightShiftDates, requestDate]
      )

      console.log('📋 [checkDynamicFairness] 야간 근무 형평성 결과:', nightShiftCheck)

      if (!nightShiftCheck.allowed) {
        console.log('❌ [checkDynamicFairness] 야간 근무 형평성 거부:', nightShiftCheck.reason)
        return nightShiftCheck
      }
      console.log('✅ [checkDynamicFairness] 야간 근무 형평성 통과')
    } else {
      console.log('⚠️ [checkDynamicFairness] 야간 근무일이 아님 - 야간 형평성 체크 스킵')
    }
  } else {
    console.log('⚠️ [checkDynamicFairness] 야간 근무 형평성 설정 비활성화')
  }

  // 4. 공휴일 형평성 체크 (공휴일이고 설정 활성화된 경우)
  if (settings.enableHolidayFairness) {
    const holiday = await prisma.holiday.findFirst({
      where: { clinicId, date: requestDate }
    })

    if (holiday) {
      // 기존 선택된 공휴일들 (DB + pending)
      const existingHolidays = []
      for (const date of allDates) {
        const h = await prisma.holiday.findFirst({
          where: { clinicId, date }
        })
        if (h) {
          existingHolidays.push(date)
        }
      }

      const holidayCheck = await checkHolidayFairness(
        clinicId,
        staffId,
        requestDate,
        year,
        month,
        [...existingHolidays, requestDate]
      )

      if (!holidayCheck.allowed) {
        return holidayCheck
      }
    }
  }

  // 5. 공휴일 인접 형평성 체크 (공휴일 전후일이고 설정 활성화된 경우)
  if (settings.enableHolidayAdjacentFairness) {
    const prevDay = new Date(requestDate)
    prevDay.setDate(prevDay.getDate() - 1)
    const nextDay = new Date(requestDate)
    nextDay.setDate(nextDay.getDate() + 1)

    const adjacentHoliday = await prisma.holiday.findFirst({
      where: {
        clinicId,
        date: { in: [prevDay, nextDay] }
      }
    })

    if (adjacentHoliday) {
      // 기존 선택된 공휴일 인접일들 (DB + pending)
      const existingAdjacentDates = []
      for (const date of allDates) {
        const prev = new Date(date)
        prev.setDate(prev.getDate() - 1)
        const next = new Date(date)
        next.setDate(next.getDate() + 1)

        const adj = await prisma.holiday.findFirst({
          where: {
            clinicId,
            date: { in: [prev, next] }
          }
        })
        if (adj) {
          existingAdjacentDates.push(date)
        }
      }

      const adjacentCheck = await checkHolidayAdjacentFairness(
        clinicId,
        staffId,
        requestDate,
        year,
        month,
        [...existingAdjacentDates, requestDate]
      )

      if (!adjacentCheck.allowed) {
        return adjacentCheck
      }
    }
  }

  return { allowed: true }
}
