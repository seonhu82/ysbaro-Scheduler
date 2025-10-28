/**
 * category-slot-service 단위 테스트
 *
 * 구분별 슬롯 가용성 검사 로직 테스트
 */

import { mockPrisma, resetAllMocks, createMockStaff } from '@/lib/test-utils'

// Mock prisma 모듈
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}))

import { checkCategoryAvailability } from '../category-slot-service'

describe('category-slot-service', () => {
  beforeEach(() => {
    resetAllMocks()

    // ruleSettings mock 추가 (기본값)
    ;(mockPrisma as any).ruleSettings = {
      findUnique: jest.fn().mockResolvedValue({
        staffCategories: {}
      })
    }
  })

  describe('checkCategoryAvailability', () => {
    it('슬롯이 충분할 때 승인 가능', async () => {
      // Given: 5명 필요, 현재 2명 신청, 위생사 1명 신청
      const clinicId = 'clinic-1'
      const date = new Date('2024-06-15')
      const requiredStaff = 5
      const categoryName = '위생사'

      // Mock: 전체 신청 수 = 2
      mockPrisma.leaveApplication.count.mockResolvedValueOnce(2)

      // Mock: 위생사 전체 = 3명
      mockPrisma.staff.count.mockResolvedValueOnce(3)

      // Mock: 위생사 신청 = 1명
      mockPrisma.leaveApplication.count.mockResolvedValueOnce(1)

      // When
      const result = await checkCategoryAvailability(
        clinicId,
        date,
        requiredStaff,
        categoryName,
        mockPrisma as any
      )

      // Then
      expect(result.shouldHold).toBe(false)
      expect(result.canApprove).toBe(true)
      expect(result.message).toContain('승인 가능')
    })

    it('전체 슬롯이 부족할 때 보류', async () => {
      // Given: 5명 필요, 현재 5명 신청 (슬롯 부족)
      const clinicId = 'clinic-1'
      const date = new Date('2024-06-15')
      const requiredStaff = 5
      const categoryName = '위생사'

      // Mock: 전체 신청 수 = 5 (이미 최대)
      mockPrisma.leaveApplication.count.mockResolvedValueOnce(5)

      // When
      const result = await checkCategoryAvailability(
        clinicId,
        date,
        requiredStaff,
        categoryName,
        mockPrisma as any
      )

      // Then
      expect(result.shouldHold).toBe(true)
      expect(result.canApprove).toBe(false)
      expect(result.message).toContain('슬롯 부족')
    })

    it('구분별 슬롯이 부족할 때 보류 (1/3 룰)', async () => {
      // Given: 위생사 3명 중 이미 1명 신청 (1/3 도달)
      const clinicId = 'clinic-1'
      const date = new Date('2024-06-15')
      const requiredStaff = 5
      const categoryName = '위생사'

      // Mock: 전체 신청 수 = 2 (충분)
      mockPrisma.leaveApplication.count.mockResolvedValueOnce(2)

      // Mock: 위생사 전체 = 3명
      mockPrisma.staff.count.mockResolvedValueOnce(3)

      // Mock: 위생사 신청 = 1명 (1/3 도달)
      mockPrisma.leaveApplication.count.mockResolvedValueOnce(1)

      // When
      const result = await checkCategoryAvailability(
        clinicId,
        date,
        requiredStaff,
        categoryName,
        mockPrisma as any
      )

      // Then
      expect(result.shouldHold).toBe(true)
      expect(result.canApprove).toBe(false)
      expect(result.message).toContain('위생사')
      expect(result.message).toContain('1/3')
    })

    it('구분이 없는 경우 전체 슬롯만 확인', async () => {
      // Given: 구분 없음
      const clinicId = 'clinic-1'
      const date = new Date('2024-06-15')
      const requiredStaff = 5
      const categoryName = ''

      // Mock: 전체 신청 수 = 2
      mockPrisma.leaveApplication.count.mockResolvedValueOnce(2)

      // When
      const result = await checkCategoryAvailability(
        clinicId,
        date,
        requiredStaff,
        categoryName,
        mockPrisma as any
      )

      // Then
      expect(result.shouldHold).toBe(false)
      expect(result.canApprove).toBe(true)
      expect(mockPrisma.staff.count).not.toHaveBeenCalled()
    })

    it('구분 인원이 1명인 경우 무조건 보류', async () => {
      // Given: 위생사 1명만 있음
      const clinicId = 'clinic-1'
      const date = new Date('2024-06-15')
      const requiredStaff = 5
      const categoryName = '위생사'

      // Mock: 전체 신청 수 = 1
      mockPrisma.leaveApplication.count.mockResolvedValueOnce(1)

      // Mock: 위생사 전체 = 1명
      mockPrisma.staff.count.mockResolvedValueOnce(1)

      // When
      const result = await checkCategoryAvailability(
        clinicId,
        date,
        requiredStaff,
        categoryName,
        mockPrisma as any
      )

      // Then
      expect(result.shouldHold).toBe(true)
      expect(result.canApprove).toBe(false)
      expect(result.message).toContain('1명뿐')
    })

    it('구분 인원이 2명이고 1명 신청 시 보류 (1/2 도달)', async () => {
      // Given: 위생사 2명 중 1명 신청
      const clinicId = 'clinic-1'
      const date = new Date('2024-06-15')
      const requiredStaff = 5
      const categoryName = '위생사'

      // Mock: 전체 신청 수 = 1
      mockPrisma.leaveApplication.count.mockResolvedValueOnce(1)

      // Mock: 위생사 전체 = 2명
      mockPrisma.staff.count.mockResolvedValueOnce(2)

      // Mock: 위생사 신청 = 1명
      mockPrisma.leaveApplication.count.mockResolvedValueOnce(1)

      // When
      const result = await checkCategoryAvailability(
        clinicId,
        date,
        requiredStaff,
        categoryName,
        mockPrisma as any
      )

      // Then
      expect(result.shouldHold).toBe(true)
      expect(result.canApprove).toBe(false)
      expect(result.message).toContain('1/2')
    })
  })
})
