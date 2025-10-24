/**
 * Category Slot Service
 *
 * 구분별 슬롯 관리 서비스
 * - 구분별 필요 인원 계산 (비율 기반)
 * - 구분별 신청 가능한 슬롯 계산
 * - 신청 승인 시 슬롯 차감
 */

import { prisma } from '@/lib/prisma'

export interface CategoryRatios {
  [categoryName: string]: number // percentage (0-100)
}

export interface CategorySlots {
  [categoryName: string]: {
    required: number      // 필요 인원
    available: number     // 신청 가능 인원 (오프/연차)
    approved: number      // 이미 승인된 오프/연차 인원
    onHold: number        // 보류 중인 신청 수
  }
}

/**
 * 구분별 필요 인원 계산
 * @param totalRequired 총 필요 인원
 * @param ratios 구분별 비율 (합이 100이어야 함)
 * @returns 구분별 필요 인원 (반올림)
 */
export function calculateCategoryRequirements(
  totalRequired: number,
  ratios: CategoryRatios
): Record<string, number> {
  const requirements: Record<string, number> = {}
  const categories = Object.keys(ratios)

  // 비율 검증
  const totalRatio = Object.values(ratios).reduce((sum, r) => sum + r, 0)
  if (Math.abs(totalRatio - 100) > 0.01) {
    throw new Error(`비율의 합이 100%가 아닙니다: ${totalRatio}%`)
  }

  // 각 구분별 필요 인원 계산 (반올림)
  let allocatedTotal = 0
  categories.forEach((category, index) => {
    if (index < categories.length - 1) {
      // 마지막 구분 제외하고 반올림
      const required = Math.round((totalRequired * ratios[category]) / 100)
      requirements[category] = required
      allocatedTotal += required
    }
  })

  // 마지막 구분은 나머지로 할당 (반올림 오차 보정)
  const lastCategory = categories[categories.length - 1]
  requirements[lastCategory] = totalRequired - allocatedTotal

  return requirements
}

/**
 * 구분별 신청 가능한 슬롯 계산
 *
 * @param clinicId 병원 ID
 * @param date 날짜
 * @param totalRequired 총 필요 인원
 * @param staffCategories 구분 목록
 * @returns 구분별 슬롯 정보
 */
export async function calculateCategorySlots(
  clinicId: string,
  date: Date,
  totalRequired: number,
  staffCategories: string[]
): Promise<CategorySlots> {
  // 1. 구분별 비율 설정 가져오기
  const ratioSettings = await prisma.categoryRatioSettings.findUnique({
    where: { clinicId }
  })

  if (!ratioSettings) {
    throw new Error('구분별 비율 설정이 없습니다')
  }

  const ratios = ratioSettings.ratios as CategoryRatios

  // 2. 구분별 필요 인원 계산
  const requirements = calculateCategoryRequirements(totalRequired, ratios)

  // 3. 각 구분별 현재 신청 현황 조회
  const slots: CategorySlots = {}

  for (const category of staffCategories) {
    const required = requirements[category] || 0

    // 해당 구분의 승인된 신청 수
    const approvedCount = await prisma.leaveApplication.count({
      where: {
        clinicId,
        date,
        status: 'CONFIRMED',
        staff: {
          categoryName: category
        }
      }
    })

    // 해당 구분의 보류 중인 신청 수
    const onHoldCount = await prisma.leaveApplication.count({
      where: {
        clinicId,
        date,
        status: 'ON_HOLD',
        staff: {
          categoryName: category
        }
      }
    })

    // 해당 구분의 총 직원 수
    const totalStaffCount = await prisma.staff.count({
      where: {
        clinicId,
        categoryName: category,
        isActive: true
      }
    })

    // 신청 가능 슬롯 = 총 직원 수 - 필요 인원
    const availableSlots = totalStaffCount - required

    slots[category] = {
      required,
      available: Math.max(0, availableSlots - approvedCount),
      approved: approvedCount,
      onHold: onHoldCount
    }
  }

  return slots
}

/**
 * 특정 구분의 신청 가능 여부 확인
 *
 * @param clinicId 병원 ID
 * @param date 날짜
 * @param totalRequired 총 필요 인원
 * @param categoryName 구분명
 * @returns { canApply: boolean, shouldHold: boolean, message: string }
 */
export async function checkCategoryAvailability(
  clinicId: string,
  date: Date,
  totalRequired: number,
  categoryName: string
): Promise<{ canApply: boolean; shouldHold: boolean; message: string }> {
  // 구분별 비율 설정 가져오기
  const ruleSettings = await prisma.ruleSettings.findUnique({
    where: { clinicId },
    select: { staffCategories: true }
  })

  if (!ruleSettings) {
    throw new Error('규칙 설정이 없습니다')
  }

  const slots = await calculateCategorySlots(
    clinicId,
    date,
    totalRequired,
    ruleSettings.staffCategories
  )

  const categorySlot = slots[categoryName]

  if (!categorySlot) {
    return {
      canApply: false,
      shouldHold: false,
      message: `구분 '${categoryName}'을 찾을 수 없습니다`
    }
  }

  // 신청 가능 슬롯이 남아있으면 즉시 승인
  if (categorySlot.available > 0) {
    return {
      canApply: true,
      shouldHold: false,
      message: '신청이 승인되었습니다'
    }
  }

  // 슬롯이 부족하면 보류
  return {
    canApply: true,
    shouldHold: true,
    message: `구분별 슬롯이 부족하여 신청이 보류되었습니다. 전체 스케줄 배치 후 승인 여부가 결정됩니다.`
  }
}

/**
 * 유연 배치 가능한 직원 조회
 *
 * @param clinicId 병원 ID
 * @param targetCategory 목표 구분 (부족한 구분)
 * @param excludeStaffIds 제외할 직원 ID 목록 (이미 배치된 직원)
 * @returns 유연 배치 가능한 직원 목록 (우선순위 순)
 */
export async function getFlexibleStaff(
  clinicId: string,
  targetCategory: string,
  excludeStaffIds: string[] = []
) {
  return await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true,
      id: { notIn: excludeStaffIds },
      flexibleForCategories: {
        has: targetCategory
      }
    },
    orderBy: [
      { flexibilityPriority: 'desc' }, // 우선순위 높은 순
      { categoryName: 'asc' }           // 구분명 오름차순
    ]
  })
}

/**
 * 보류된 신청 중 승인 가능한 신청 찾기
 *
 * @param clinicId 병원 ID
 * @param date 날짜
 * @param availableFlexibleCount 유연 배치 가능한 인원 수
 * @returns 승인 가능한 신청 ID 목록
 */
export async function findApprovableOnHoldApplications(
  clinicId: string,
  date: Date,
  availableFlexibleCount: number
): Promise<string[]> {
  // 보류된 신청을 신청 시간 순으로 조회
  const onHoldApplications = await prisma.leaveApplication.findMany({
    where: {
      clinicId,
      date,
      status: 'ON_HOLD'
    },
    orderBy: {
      createdAt: 'asc' // 먼저 신청한 순서대로
    },
    take: availableFlexibleCount, // 유연 배치 가능한 만큼만
    select: {
      id: true
    }
  })

  return onHoldApplications.map(app => app.id)
}
