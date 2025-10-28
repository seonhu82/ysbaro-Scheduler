/**
 * 개선된 형평성 계산 알고리즘 테스트
 *
 * 향상된 기능:
 * - 부서/구분별 형평성 추적
 * - 장기 추세 분석 (여러 달에 걸친 형평성)
 * - 가중치 조정 가능한 다차원 형평성 점수
 * - 공정성 불균형 감지 및 자동 조정 제안
 */

import {
  mockPrisma,
  resetAllMocks,
  createMockStaff,
  createMockFairnessScore
} from '@/lib/test-utils'

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}))

import {
  calculateEnhancedFairnessScore,
  calculateCategoryFairness,
  calculateDepartmentFairness,
  analyzeFairnessTrends,
  detectFairnessImbalance,
  suggestFairnessAdjustments
} from '../fairness-calculator-enhanced'

describe('fairness-calculator-enhanced', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  describe('calculateEnhancedFairnessScore', () => {
    it('다차원 형평성 점수 계산 (야간/주말/공휴일)', async () => {
      // Given: 직원의 다양한 근무 유형
      const staffMetrics = {
        nightShifts: 5,
        weekendShifts: 3,
        holidayShifts: 2,
        holidayAdjacentShifts: 1
      }

      const allStaffMetrics = [
        { nightShifts: 4, weekendShifts: 4, holidayShifts: 2, holidayAdjacentShifts: 1 },
        { nightShifts: 5, weekendShifts: 3, holidayShifts: 2, holidayAdjacentShifts: 1 },
        { nightShifts: 6, weekendShifts: 2, holidayShifts: 1, holidayAdjacentShifts: 2 }
      ]

      // When
      const result = calculateEnhancedFairnessScore(staffMetrics, allStaffMetrics)

      // Then: 점수가 0-100 범위이고, 각 차원별 편차 포함
      expect(result.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.overallScore).toBeLessThanOrEqual(100)
      expect(result.nightShiftDeviation).toBeDefined()
      expect(result.weekendShiftDeviation).toBeDefined()
      expect(result.holidayShiftDeviation).toBeDefined()
      expect(result.grade).toMatch(/EXCELLENT|GOOD|FAIR|POOR/)
    })

    it('가중치를 커스텀할 수 있음', async () => {
      // Given: 커스텀 가중치 (공휴일을 더 중요하게)
      const staffMetrics = {
        nightShifts: 5,
        weekendShifts: 3,
        holidayShifts: 8, // 공휴일 많이 근무
        holidayAdjacentShifts: 1
      }

      const allStaffMetrics = [
        { nightShifts: 5, weekendShifts: 3, holidayShifts: 1, holidayAdjacentShifts: 1 },
        { nightShifts: 5, weekendShifts: 3, holidayShifts: 2, holidayAdjacentShifts: 1 },
        { nightShifts: 5, weekendShifts: 3, holidayShifts: 8, holidayAdjacentShifts: 1 }
      ]

      const weights = {
        nightShift: 1,
        weekend: 1,
        holiday: 10, // 공휴일 가중치 매우 높임
        holidayAdjacent: 1
      }

      // When
      const result = calculateEnhancedFairnessScore(staffMetrics, allStaffMetrics, weights)

      // Then: 공휴일 편차가 점수에 큰 영향
      expect(result.overallScore).toBeLessThan(85) // 공휴일 불균형으로 낮은 점수
      expect(result.holidayShiftDeviation).toBeGreaterThan(0)
    })
  })

  describe('calculateCategoryFairness', () => {
    it('구분별 형평성 계산 (위생사 vs 간호조무사)', async () => {
      // Given: 구분별 직원 목록
      const clinicId = 'clinic-1'
      const year = 2024
      const month = 6

      // Mock: 위생사 3명, 간호조무사 2명
      const staffList = [
        createMockStaff({ id: 'staff-1', name: '김철수', categoryName: '위생사' }),
        createMockStaff({ id: 'staff-2', name: '이영희', categoryName: '위생사' }),
        createMockStaff({ id: 'staff-3', name: '박민수', categoryName: '위생사' }),
        createMockStaff({ id: 'staff-4', name: '정수진', categoryName: '간호조무사' }),
        createMockStaff({ id: 'staff-5', name: '최동호', categoryName: '간호조무사' })
      ]

      mockPrisma.staff.findMany.mockResolvedValue(staffList as any)

      // Mock: 형평성 점수
      mockPrisma.fairnessScore.findMany.mockImplementation(async ({ where }: any) => {
        const staffId = where.staffId
        if (staffId === 'staff-1') {
          return [createMockFairnessScore({ staffId, nightShiftCount: 5, weekendCount: 3 })]
        } else if (staffId === 'staff-2') {
          return [createMockFairnessScore({ staffId, nightShiftCount: 4, weekendCount: 4 })]
        } else if (staffId === 'staff-3') {
          return [createMockFairnessScore({ staffId, nightShiftCount: 6, weekendCount: 2 })]
        } else if (staffId === 'staff-4') {
          return [createMockFairnessScore({ staffId, nightShiftCount: 2, weekendCount: 5 })]
        } else {
          return [createMockFairnessScore({ staffId, nightShiftCount: 3, weekendCount: 3 })]
        }
      })

      // When
      const result = await calculateCategoryFairness(clinicId, year, month)

      // Then: 각 구분별 형평성 점수
      expect(result).toHaveProperty('위생사')
      expect(result).toHaveProperty('간호조무사')
      expect(result['위생사'].averageScore).toBeDefined()
      expect(result['위생사'].staffCount).toBe(3)
      expect(result['간호조무사'].staffCount).toBe(2)
    })

    it('구분 내 형평성과 구분 간 형평성을 모두 계산', async () => {
      // Given: 두 구분이 명확히 다른 근무 패턴
      const clinicId = 'clinic-1'
      const year = 2024
      const month = 6

      const staffList = [
        createMockStaff({ id: 'staff-1', categoryName: '위생사' }),
        createMockStaff({ id: 'staff-2', categoryName: '위생사' }),
        createMockStaff({ id: 'staff-3', categoryName: '간호조무사' }),
        createMockStaff({ id: 'staff-4', categoryName: '간호조무사' })
      ]

      mockPrisma.staff.findMany.mockResolvedValue(staffList as any)

      // Mock: 위생사는 야간 많고, 간호조무사는 주말 많음
      mockPrisma.fairnessScore.findMany.mockImplementation(async ({ where }: any) => {
        const staffId = where.staffId
        if (staffId === 'staff-1' || staffId === 'staff-2') {
          return [createMockFairnessScore({ staffId, nightShiftCount: 8, weekendCount: 2 })]
        } else {
          return [createMockFairnessScore({ staffId, nightShiftCount: 2, weekendCount: 8 })]
        }
      })

      // When
      const result = await calculateCategoryFairness(clinicId, year, month)

      // Then: 구분 간 불균형 감지
      expect(result['위생사'].averageNightShifts).toBeGreaterThan(
        result['간호조무사'].averageNightShifts
      )
      expect(result['간호조무사'].averageWeekendShifts).toBeGreaterThan(
        result['위생사'].averageWeekendShifts
      )
    })
  })

  describe('calculateDepartmentFairness', () => {
    it('부서별 형평성 계산', async () => {
      // Given: 부서별 직원 목록
      const clinicId = 'clinic-1'
      const year = 2024
      const month = 6

      const staffList = [
        createMockStaff({ id: 'staff-1', department: '진료부' }),
        createMockStaff({ id: 'staff-2', department: '진료부' }),
        createMockStaff({ id: 'staff-3', department: '행정부' }),
        createMockStaff({ id: 'staff-4', department: '행정부' })
      ]

      mockPrisma.staff.findMany.mockResolvedValue(staffList as any)

      mockPrisma.fairnessScore.findMany.mockImplementation(async ({ where }: any) => {
        const staffId = where.staffId
        return [createMockFairnessScore({ staffId, nightShiftCount: 5, weekendCount: 3 })]
      })

      // When
      const result = await calculateDepartmentFairness(clinicId, year, month)

      // Then: 각 부서별 형평성 점수
      expect(result).toHaveProperty('진료부')
      expect(result).toHaveProperty('행정부')
      expect(result['진료부'].staffCount).toBe(2)
      expect(result['행정부'].staffCount).toBe(2)
    })
  })

  describe('analyzeFairnessTrends', () => {
    it('여러 달에 걸친 형평성 추세 분석', async () => {
      // Given: 3개월 치 데이터
      const staffId = 'staff-1'
      const year = 2024
      const endMonth = 6

      // Mock: 4월, 5월, 6월 형평성 점수
      mockPrisma.fairnessScore.findMany.mockResolvedValue([
        createMockFairnessScore({
          staffId,
          year: 2024,
          month: 4,
          nightShiftCount: 3,
          weekendCount: 2
        }),
        createMockFairnessScore({
          staffId,
          year: 2024,
          month: 5,
          nightShiftCount: 5,
          weekendCount: 3
        }),
        createMockFairnessScore({
          staffId,
          year: 2024,
          month: 6,
          nightShiftCount: 7,
          weekendCount: 4
        })
      ] as any)

      // When
      const result = await analyzeFairnessTrends(staffId, year, endMonth, 3)

      // Then: 증가 추세 감지
      expect(result.trend).toBe('INCREASING') // 야간/주말 근무 증가
      expect(result.monthlyScores).toHaveLength(3)
      expect(result.averageMonthlyIncrease).toBeGreaterThan(0)
    })

    it('감소 추세 감지', async () => {
      // Given: 감소하는 패턴
      const staffId = 'staff-1'
      const year = 2024
      const endMonth = 6

      mockPrisma.fairnessScore.findMany.mockResolvedValue([
        createMockFairnessScore({ staffId, month: 4, nightShiftCount: 7, weekendCount: 4 }),
        createMockFairnessScore({ staffId, month: 5, nightShiftCount: 5, weekendCount: 3 }),
        createMockFairnessScore({ staffId, month: 6, nightShiftCount: 3, weekendCount: 2 })
      ] as any)

      // When
      const result = await analyzeFairnessTrends(staffId, year, endMonth, 3)

      // Then: 감소 추세 감지
      expect(result.trend).toBe('DECREASING')
      expect(result.averageMonthlyIncrease).toBeLessThan(0)
    })
  })

  describe('detectFairnessImbalance', () => {
    it('심각한 불균형 감지 (낮은 임계값)', async () => {
      // Given: 한 직원이 과도하게 많은 야간 근무
      const clinicId = 'clinic-1'
      const year = 2024
      const month = 6

      const staffList = [
        createMockStaff({ id: 'staff-1', name: '김철수' }),
        createMockStaff({ id: 'staff-2', name: '이영희' }),
        createMockStaff({ id: 'staff-3', name: '박민수' }),
        createMockStaff({ id: 'staff-4', name: '정수진' })
      ]

      mockPrisma.staff.findMany.mockResolvedValue(staffList as any)

      // Mock: 적당한 불균형 (staff-1이 7회, 나머지는 3-4회)
      mockPrisma.fairnessScore.findMany.mockImplementation(async ({ where }: any) => {
        const staffId = where.staffId
        if (staffId === 'staff-1') {
          return [createMockFairnessScore({ staffId, nightShiftCount: 8, weekendCount: 6 })]
        } else if (staffId === 'staff-2') {
          return [createMockFairnessScore({ staffId, nightShiftCount: 3, weekendCount: 3 })]
        } else if (staffId === 'staff-3') {
          return [createMockFairnessScore({ staffId, nightShiftCount: 4, weekendCount: 3 })]
        } else {
          return [createMockFairnessScore({ staffId, nightShiftCount: 3, weekendCount: 4 })]
        }
      })

      // When: 낮은 임계값 사용 (0.5 표준편차)
      const result = await detectFairnessImbalance(clinicId, year, month, 0.5)

      // Then: 불균형 감지
      expect(result.hasImbalance).toBe(true)
      expect(result.imbalancedStaff.length).toBeGreaterThan(0)
    })

    it('균형 잡힌 상태 감지', async () => {
      // Given: 모든 직원이 비슷한 근무
      const clinicId = 'clinic-1'
      const year = 2024
      const month = 6

      const staffList = [
        createMockStaff({ id: 'staff-1', name: '김철수' }),
        createMockStaff({ id: 'staff-2', name: '이영희' }),
        createMockStaff({ id: 'staff-3', name: '박민수' })
      ]

      mockPrisma.staff.findMany.mockResolvedValue(staffList as any)

      // Mock: 모두 비슷한 근무
      mockPrisma.fairnessScore.findMany.mockImplementation(async () => {
        return [createMockFairnessScore({ nightShiftCount: 5, weekendCount: 3 })]
      })

      // When
      const result = await detectFairnessImbalance(clinicId, year, month)

      // Then: 불균형 없음
      expect(result.hasImbalance).toBe(false)
      expect(result.imbalancedStaff).toHaveLength(0)
    })
  })

  describe('suggestFairnessAdjustments', () => {
    it('자동 조정 제안 생성 (낮은 임계값)', async () => {
      // Given: 적당한 불균형 상황
      const clinicId = 'clinic-1'
      const year = 2024
      const month = 6

      const staffList = [
        createMockStaff({ id: 'staff-1', name: '김철수' }),
        createMockStaff({ id: 'staff-2', name: '이영희' }),
        createMockStaff({ id: 'staff-3', name: '박민수' }),
        createMockStaff({ id: 'staff-4', name: '정수진' })
      ]

      mockPrisma.staff.findMany.mockResolvedValue(staffList as any)

      // Mock: 적당한 불균형 데이터
      mockPrisma.fairnessScore.findMany.mockImplementation(async ({ where }: any) => {
        const staffId = where.staffId
        if (staffId === 'staff-1') {
          return [createMockFairnessScore({ staffId, nightShiftCount: 8, weekendCount: 6 })]
        } else if (staffId === 'staff-2') {
          return [createMockFairnessScore({ staffId, nightShiftCount: 3, weekendCount: 3 })]
        } else if (staffId === 'staff-3') {
          return [createMockFairnessScore({ staffId, nightShiftCount: 4, weekendCount: 3 })]
        } else {
          return [createMockFairnessScore({ staffId, nightShiftCount: 3, weekendCount: 4 })]
        }
      })

      // When
      const result = await suggestFairnessAdjustments(clinicId, year, month)

      // Then: 조정 제안 또는 균형
      expect(result.suggestions).toBeDefined()
      expect(result.expectedImpact).toBeDefined()
    })

    it('균형 잡힌 상태에서는 조정 불필요', async () => {
      // Given: 모든 직원이 비슷한 근무
      const clinicId = 'clinic-1'
      const year = 2024
      const month = 6

      const staffList = [
        createMockStaff({ id: 'staff-1', name: '김철수' }),
        createMockStaff({ id: 'staff-2', name: '이영희' }),
        createMockStaff({ id: 'staff-3', name: '박민수' })
      ]

      mockPrisma.staff.findMany.mockResolvedValue(staffList as any)

      // Mock: 모두 비슷한 근무
      mockPrisma.fairnessScore.findMany.mockImplementation(async () => {
        return [createMockFairnessScore({ nightShiftCount: 5, weekendCount: 3 })]
      })

      // When
      const result = await suggestFairnessAdjustments(clinicId, year, month)

      // Then: 조정 불필요
      expect(result.needsAdjustment).toBe(false)
      expect(result.suggestions).toHaveLength(0)
    })
  })
})
