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
  currentApplications: number // 이미 신청한 주말 OFF/연차 수
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
      rank: true,
      categoryName: true,
      fairnessScoreWeekend: true
    }
  })

  if (!staff || !staff.rank) {
    return { allowed: true, reason: '직원 정보를 찾을 수 없습니다' }
  }

  const category = staff.rank

  // 3. 해당 구분 총 인원 조회
  const totalStaffInCategory = await prisma.staff.count({
    where: {
      clinicId,
      isActive: true,
      departmentName: '진료실',
      rank: category
    }
  })

  if (totalStaffInCategory === 0) {
    return { allowed: true, reason: '해당 구분 직원이 없습니다' }
  }

  // 4. 해당 월의 모든 토요일 날짜 찾기
  const saturdays: Date[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    if (date.getDay() === 6) { // 토요일
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
    const departmentCategoryStaff = combination.departmentCategoryStaff as { [key: string]: { [key: string]: number } }

    const treatmentDept = departmentCategoryStaff['진료실'] || {}
    const categoryRequired = treatmentDept[category] || 0

    totalRequiredSlots += categoryRequired
  }

  // 6. 기준 근무 횟수 계산
  const baseRequirement = totalRequiredSlots / totalStaffInCategory

  // 7. 편차 적용
  const currentWeekendDeviation = staff.fairnessScoreWeekend || 0
  const threshold = fairnessSettings.fairnessThreshold || 0.5

  // 편차 적용: 기준 + 편차
  // 예: 기준 2.67, 편차 -0.5 → 2.67 + (-0.5) = 2.17 → 최소 2번 근무
  const adjustedRequirement = Math.max(0, Math.floor(baseRequirement + currentWeekendDeviation))

  // 8. 최대 신청 가능 주말 수
  const maxApplications = Math.max(0, saturdays.length - adjustedRequirement)

  // 9. 현재 신청 수 확인
  if (currentApplications >= maxApplications) {
    return {
      allowed: false,
      reason: `주말 형평성 기준 초과: 최대 ${maxApplications}번까지 주말 OFF/연차 신청 가능 (현재 ${currentApplications}번 신청)`,
      details: {
        category,
        totalStaff: totalStaffInCategory,
        requiredSlots: totalRequiredSlots,
        baseRequirement: Math.round(baseRequirement * 100) / 100,
        adjustedRequirement,
        currentApplications,
        maxApplications,
        totalOpportunities: saturdays.length
      }
    }
  }

  return {
    allowed: true,
    details: {
      category,
      totalStaff: totalStaffInCategory,
      requiredSlots: totalRequiredSlots,
      baseRequirement: Math.round(baseRequirement * 100) / 100,
      adjustedRequirement,
      currentApplications,
      maxApplications,
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
  currentApplications: number
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
      rank: true,
      categoryName: true,
      fairnessScoreNight: true
    }
  })

  if (!staff || !staff.rank) {
    return { allowed: true }
  }

  const category = staff.rank

  const totalStaffInCategory = await prisma.staff.count({
    where: {
      clinicId,
      isActive: true,
      departmentName: '진료실',
      rank: category
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

    const departmentCategoryStaff = combination.departmentCategoryStaff as { [key: string]: { [key: string]: number } }
    const treatmentDept = departmentCategoryStaff['진료실'] || {}
    const categoryRequired = treatmentDept[category] || 0

    totalRequiredSlots += categoryRequired
  }

  const baseRequirement = totalRequiredSlots / totalStaffInCategory
  const currentNightDeviation = staff.fairnessScoreNight || 0
  // 편차 적용: 기준 + 편차 = 최소 일해야 하는 횟수
  const adjustedRequirement = Math.max(0, Math.floor(baseRequirement + currentNightDeviation))
  const maxApplications = Math.max(0, nightShiftDates.length - adjustedRequirement)

  if (currentApplications >= maxApplications) {
    return {
      allowed: false,
      reason: `야간 형평성 기준 초과: 최대 ${maxApplications}번까지 야간 OFF/연차 신청 가능 (현재 ${currentApplications}번 신청)`,
      details: {
        category,
        totalStaff: totalStaffInCategory,
        requiredSlots: totalRequiredSlots,
        baseRequirement: Math.round(baseRequirement * 100) / 100,
        adjustedRequirement,
        currentApplications,
        maxApplications,
        totalOpportunities: nightShiftDates.length
      }
    }
  }

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
  currentApplications: number
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
      rank: true,
      categoryName: true,
      fairnessScoreHoliday: true
    }
  })

  if (!staff || !staff.rank) {
    return { allowed: true }
  }

  const category = staff.rank

  const totalStaffInCategory = await prisma.staff.count({
    where: {
      clinicId,
      isActive: true,
      departmentName: '진료실',
      rank: category
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

    const departmentCategoryStaff = combination.departmentCategoryStaff as { [key: string]: { [key: string]: number } }
    const treatmentDept = departmentCategoryStaff['진료실'] || {}
    const categoryRequired = treatmentDept[category] || 0

    totalRequiredSlots += categoryRequired
  }

  const baseRequirement = totalRequiredSlots / totalStaffInCategory
  const currentHolidayDeviation = staff.fairnessScoreHoliday || 0
  // 편차 적용: 기준 + 편차 = 최소 일해야 하는 횟수
  const adjustedRequirement = Math.max(0, Math.floor(baseRequirement + currentHolidayDeviation))
  const maxApplications = Math.max(0, holidays.length - adjustedRequirement)

  if (currentApplications >= maxApplications) {
    return {
      allowed: false,
      reason: `공휴일 형평성 기준 초과: 최대 ${maxApplications}번까지 공휴일 OFF/연차 신청 가능 (현재 ${currentApplications}번 신청)`,
      details: {
        category,
        totalStaff: totalStaffInCategory,
        requiredSlots: totalRequiredSlots,
        baseRequirement: Math.round(baseRequirement * 100) / 100,
        adjustedRequirement,
        currentApplications,
        maxApplications,
        totalOpportunities: holidays.length
      }
    }
  }

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
  currentApplications: number
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
      rank: true,
      categoryName: true,
      fairnessScoreHolidayAdjacent: true
    }
  })

  if (!staff || !staff.rank) {
    return { allowed: true }
  }

  const category = staff.rank

  const totalStaffInCategory = await prisma.staff.count({
    where: {
      clinicId,
      isActive: true,
      departmentName: '진료실',
      rank: category
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

    const departmentCategoryStaff = combination.departmentCategoryStaff as { [key: string]: { [key: string]: number } }
    const treatmentDept = departmentCategoryStaff['진료실'] || {}
    const categoryRequired = treatmentDept[category] || 0

    totalRequiredSlots += categoryRequired
  }

  const baseRequirement = totalRequiredSlots / totalStaffInCategory
  const currentAdjacentDeviation = staff.fairnessScoreHolidayAdjacent || 0
  // 편차 적용: 기준 + 편차 = 최소 일해야 하는 횟수
  const adjustedRequirement = Math.max(0, Math.floor(baseRequirement + currentAdjacentDeviation))
  const maxApplications = Math.max(0, adjacentDates.size - adjustedRequirement)

  if (currentApplications >= maxApplications) {
    return {
      allowed: false,
      reason: `공휴일 전후 형평성 기준 초과: 최대 ${maxApplications}번까지 공휴일 전후 OFF/연차 신청 가능 (현재 ${currentApplications}번 신청)`,
      details: {
        category,
        totalStaff: totalStaffInCategory,
        requiredSlots: totalRequiredSlots,
        baseRequirement: Math.round(baseRequirement * 100) / 100,
        adjustedRequirement,
        currentApplications,
        maxApplications,
        totalOpportunities: adjacentDates.size
      }
    }
  }

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
  currentApplications: number
): Promise<DynamicFairnessResult> {
  // 총 근무일 형평성은 항상 체크 (설정 없음)
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      rank: true,
      categoryName: true,
      fairnessScoreTotalDays: true
    }
  })

  if (!staff || !staff.rank) {
    return { allowed: true }
  }

  const category = staff.rank

  const totalStaffInCategory = await prisma.staff.count({
    where: {
      clinicId,
      isActive: true,
      departmentName: '진료실',
      rank: category
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

    const departmentCategoryStaff = combination.departmentCategoryStaff as { [key: string]: { [key: string]: number } }
    const treatmentDept = departmentCategoryStaff['진료실'] || {}
    const categoryRequired = treatmentDept[category] || 0

    totalRequiredSlots += categoryRequired
  }

  const baseRequirement = totalRequiredSlots / totalStaffInCategory
  const currentTotalDaysDeviation = staff.fairnessScoreTotalDays || 0
  // 편차 적용: 기준 + 편차 = 최소 일해야 하는 횟수
  const adjustedRequirement = Math.max(0, Math.floor(baseRequirement + currentTotalDaysDeviation))
  const maxApplications = Math.max(0, workDays.length - adjustedRequirement)

  if (currentApplications >= maxApplications) {
    return {
      allowed: false,
      reason: `총 근무일 형평성 기준 초과: 최대 ${maxApplications}번까지 OFF/연차 신청 가능 (현재 ${currentApplications}번 신청)`,
      details: {
        category,
        totalStaff: totalStaffInCategory,
        requiredSlots: totalRequiredSlots,
        baseRequirement: Math.round(baseRequirement * 100) / 100,
        adjustedRequirement,
        currentApplications,
        maxApplications,
        totalOpportunities: workDays.length
      }
    }
  }

  return { allowed: true }
}
