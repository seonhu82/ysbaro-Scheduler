/**
 * on-hold-auto-approval-service 단위 테스트
 *
 * ON_HOLD 자동 승인 로직 테스트
 */

import { processOnHoldForDate } from '../on-hold-auto-approval-service'
import {
  mockPrisma,
  resetAllMocks,
  createMockLeaveApplication,
  createMockStaff,
  createMockUser,
  createMockDailySlot
} from '@/lib/test-utils'

// Mock dependencies
jest.mock('../category-slot-service')
jest.mock('../notification-helper')

import { checkCategoryAvailability } from '../category-slot-service'
import { notifyLeaveApproved } from '../notification-helper'

const mockCheckCategoryAvailability = checkCategoryAvailability as jest.MockedFunction<typeof checkCategoryAvailability>
const mockNotifyLeaveApproved = notifyLeaveApproved as jest.MockedFunction<typeof notifyLeaveApproved>

describe('on-hold-auto-approval-service', () => {
  beforeEach(() => {
    resetAllMocks()
    jest.clearAllMocks()
  })

  describe('processOnHoldForDate', () => {
    it('슬롯이 충분할 때 ON_HOLD 신청 자동 승인', async () => {
      // Given
      const clinicId = 'clinic-1'
      const date = new Date('2024-06-15')

      const staff = createMockStaff({
        id: 'staff-1',
        name: '김철수',
        categoryName: '위생사',
        user: createMockUser({ id: 'user-1' })
      })

      const onHoldApplication = createMockLeaveApplication({
        id: 'leave-1',
        staffId: 'staff-1',
        status: 'ON_HOLD',
        date,
        staff
      })

      const dailySlot = createMockDailySlot({
        date,
        requiredStaff: 5
      })

      // Mock: ON_HOLD 신청 조회
      mockPrisma.leaveApplication.findMany.mockResolvedValueOnce([onHoldApplication] as any)

      // Mock: DailySlot 조회
      mockPrisma.dailySlot.findFirst.mockResolvedValueOnce(dailySlot as any)

      // Mock: 슬롯 가용성 확인 (승인 가능)
      mockCheckCategoryAvailability.mockResolvedValueOnce({
        shouldHold: false,
        canApprove: true,
        message: '승인 가능',
        totalStaff: 3,
        approvedCount: 0,
        allowedCount: 1
      })

      // Mock: 신청 업데이트
      mockPrisma.leaveApplication.update.mockResolvedValueOnce(onHoldApplication as any)

      // When
      const result = await processOnHoldForDate(clinicId, date)

      // Then
      expect(result.totalOnHold).toBe(1)
      expect(result.approved).toBe(1)
      expect(result.remainingOnHold).toBe(0)
      expect(result.approvedApplications).toHaveLength(1)
      expect(result.approvedApplications[0].staffName).toBe('김철수')

      // 승인 처리 확인
      expect(mockPrisma.leaveApplication.update).toHaveBeenCalledWith({
        where: { id: 'leave-1' },
        data: {
          status: 'CONFIRMED',
          holdReason: null
        }
      })

      // 알림 전송 확인
      expect(mockNotifyLeaveApproved).toHaveBeenCalledWith(
        'user-1',
        '김철수',
        date,
        'ANNUAL'
      )
    })

    it('슬롯이 부족할 때 ON_HOLD 유지', async () => {
      // Given
      const clinicId = 'clinic-1'
      const date = new Date('2024-06-15')

      const staff = createMockStaff({
        id: 'staff-1',
        name: '이영희',
        categoryName: '위생사'
      })

      const onHoldApplication = createMockLeaveApplication({
        id: 'leave-1',
        staffId: 'staff-1',
        status: 'ON_HOLD',
        date,
        staff
      })

      const dailySlot = createMockDailySlot({
        date,
        requiredStaff: 5
      })

      // Mock: ON_HOLD 신청 조회
      mockPrisma.leaveApplication.findMany.mockResolvedValueOnce([onHoldApplication] as any)

      // Mock: DailySlot 조회
      mockPrisma.dailySlot.findFirst.mockResolvedValueOnce(dailySlot as any)

      // Mock: 슬롯 가용성 확인 (보류 필요)
      mockCheckCategoryAvailability.mockResolvedValueOnce({
        shouldHold: true,
        canApprove: false,
        message: '위생사 구분 1/3 도달',
        totalStaff: 3,
        approvedCount: 1,
        allowedCount: 1
      })

      // When
      const result = await processOnHoldForDate(clinicId, date)

      // Then
      expect(result.totalOnHold).toBe(1)
      expect(result.approved).toBe(0)
      expect(result.remainingOnHold).toBe(1)
      expect(result.failedApplications).toHaveLength(1)
      expect(result.failedApplications[0].reason).toContain('위생사')

      // 승인 처리 안 됨
      expect(mockPrisma.leaveApplication.update).not.toHaveBeenCalled()
    })

    it('DailySlot이 없을 때 모든 신청 실패 처리', async () => {
      // Given
      const clinicId = 'clinic-1'
      const date = new Date('2024-06-15')

      const staff = createMockStaff({ id: 'staff-1', name: '박민수' })

      const onHoldApplication = createMockLeaveApplication({
        id: 'leave-1',
        staffId: 'staff-1',
        status: 'ON_HOLD',
        date,
        staff
      })

      // Mock: ON_HOLD 신청 조회
      mockPrisma.leaveApplication.findMany.mockResolvedValueOnce([onHoldApplication] as any)

      // Mock: DailySlot 조회 (없음)
      mockPrisma.dailySlot.findFirst.mockResolvedValueOnce(null)

      // When
      const result = await processOnHoldForDate(clinicId, date)

      // Then
      expect(result.totalOnHold).toBe(1)
      expect(result.approved).toBe(0)
      expect(result.remainingOnHold).toBe(1)
      expect(result.failedApplications[0].reason).toContain('DailySlot')
    })

    it('ON_HOLD 신청이 없을 때 빈 결과 반환', async () => {
      // Given
      const clinicId = 'clinic-1'
      const date = new Date('2024-06-15')

      // Mock: ON_HOLD 신청 조회 (없음)
      mockPrisma.leaveApplication.findMany.mockResolvedValueOnce([])

      // When
      const result = await processOnHoldForDate(clinicId, date)

      // Then
      expect(result.totalOnHold).toBe(0)
      expect(result.approved).toBe(0)
      expect(result.remainingOnHold).toBe(0)
      expect(result.approvedApplications).toHaveLength(0)
      expect(result.failedApplications).toHaveLength(0)
    })

    it('여러 ON_HOLD 신청 중 일부만 승인', async () => {
      // Given
      const clinicId = 'clinic-1'
      const date = new Date('2024-06-15')

      const staff1 = createMockStaff({
        id: 'staff-1',
        name: '김철수',
        categoryName: '위생사',
        user: createMockUser({ id: 'user-1' })
      })

      const staff2 = createMockStaff({
        id: 'staff-2',
        name: '이영희',
        categoryName: '간호사',
        user: createMockUser({ id: 'user-2' })
      })

      const onHoldApplications = [
        createMockLeaveApplication({
          id: 'leave-1',
          staffId: 'staff-1',
          status: 'ON_HOLD',
          date,
          staff: staff1
        }),
        createMockLeaveApplication({
          id: 'leave-2',
          staffId: 'staff-2',
          status: 'ON_HOLD',
          date,
          staff: staff2
        })
      ]

      const dailySlot = createMockDailySlot({ date, requiredStaff: 5 })

      // Mock: ON_HOLD 신청 조회
      mockPrisma.leaveApplication.findMany.mockResolvedValueOnce(onHoldApplications as any)

      // Mock: DailySlot 조회
      mockPrisma.dailySlot.findFirst.mockResolvedValueOnce(dailySlot as any)

      // Mock: 첫 번째 승인 가능, 두 번째 보류
      mockCheckCategoryAvailability
        .mockResolvedValueOnce({
          shouldHold: false,
          canApprove: true,
          message: '승인 가능',
          totalStaff: 3,
          approvedCount: 0,
          allowedCount: 1
        })
        .mockResolvedValueOnce({
          shouldHold: true,
          canApprove: false,
          message: '간호사 구분 1/3 도달',
          totalStaff: 3,
          approvedCount: 1,
          allowedCount: 1
        })

      mockPrisma.leaveApplication.update.mockResolvedValue(onHoldApplications[0] as any)

      // When
      const result = await processOnHoldForDate(clinicId, date)

      // Then
      expect(result.totalOnHold).toBe(2)
      expect(result.approved).toBe(1)
      expect(result.remainingOnHold).toBe(1)
      expect(result.approvedApplications[0].staffName).toBe('김철수')
      expect(result.failedApplications[0].staffName).toBe('이영희')
    })
  })
})
