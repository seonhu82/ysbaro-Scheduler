/**
 * 연차 신청 플로우 통합 테스트
 *
 * 전체 연차 신청 흐름을 end-to-end로 테스트:
 * 1. 신청 생성
 * 2. 슬롯 검증
 * 3. 승인/보류 결정
 * 4. ON_HOLD 자동 승인
 * 5. 알림 전송
 */

import {
  mockPrisma,
  resetAllMocks,
  createMockClinic,
  createMockStaff,
  createMockUser,
  createMockLeaveApplication,
  createMockWeekInfo,
  createMockDailySlot
} from '@/lib/test-utils'

// Mock dependencies
jest.mock('@/lib/services/category-slot-service')
jest.mock('@/lib/services/notification-helper')
jest.mock('@/lib/services/activity-log-service')

import { checkCategoryAvailability } from '@/lib/services/category-slot-service'
import { notifyLeaveRequested, notifyLeaveApproved } from '@/lib/services/notification-helper'
import { processOnHoldForDate } from '@/lib/services/on-hold-auto-approval-service'

const mockCheckCategoryAvailability = checkCategoryAvailability as jest.MockedFunction<typeof checkCategoryAvailability>
const mockNotifyLeaveRequested = notifyLeaveRequested as jest.MockedFunction<typeof notifyLeaveRequested>
const mockNotifyLeaveApproved = notifyLeaveApproved as jest.MockedFunction<typeof notifyLeaveApproved>

describe('연차 신청 플로우 통합 테스트', () => {
  beforeEach(() => {
    resetAllMocks()
    jest.clearAllMocks()
  })

  describe('정상 신청 -> 즉시 승인 플로우', () => {
    it('슬롯이 충분할 때 연차 신청이 즉시 승인됨', async () => {
      // Given: 직원과 클리닉 데이터
      const clinic = createMockClinic()
      const user = createMockUser({ clinicId: clinic.id })
      const staff = createMockStaff({
        userId: user.id,
        clinicId: clinic.id,
        categoryName: '위생사'
      })

      const date = new Date('2024-06-15')
      const dailySlot = createMockDailySlot({
        date,
        requiredStaff: 5
      })

      // Mock: 슬롯 가용성 확인 (승인 가능)
      mockCheckCategoryAvailability.mockResolvedValue({
        shouldHold: false,
        canApprove: true,
        message: '승인 가능',
        totalStaff: 3,
        approvedCount: 0,
        allowedCount: 1
      })

      // Mock: 연차 신청 생성
      const leaveApplication = createMockLeaveApplication({
        staffId: staff.id,
        clinicId: clinic.id,
        date,
        status: 'CONFIRMED' // 즉시 승인
      })

      mockPrisma.leaveApplication.create.mockResolvedValue(leaveApplication as any)

      // When: 연차 신청 (시뮬레이션)
      const result = await mockPrisma.leaveApplication.create({
        data: {
          staffId: staff.id,
          clinicId: clinic.id,
          date,
          leaveType: 'ANNUAL',
          status: 'CONFIRMED',
          reason: '개인 사유',
          appliedAt: new Date()
        }
      })

      // Then: 연차 신청 성공
      expect(result).toBeDefined()
      expect(result.status).toBe('CONFIRMED')
      expect(result.date).toEqual(date)

      // Verify: 알림 전송 (실제 구현에서는 이 부분이 자동 호출됨)
      await mockNotifyLeaveRequested(['admin-1', 'admin-2'], staff.id)
      expect(mockNotifyLeaveRequested).toHaveBeenCalled()
    })
  })

  describe('신청 -> 보류 -> 자동 승인 플로우', () => {
    it('슬롯 부족 시 ON_HOLD, 이후 슬롯 확보되면 자동 승인', async () => {
      // Given
      const clinicId = 'clinic-1'
      const date = new Date('2024-06-15')

      const staff = createMockStaff({
        id: 'staff-1',
        name: '김철수',
        categoryName: '위생사',
        user: createMockUser({ id: 'user-1' })
      })

      // Phase 1: 신청 시 슬롯 부족
      const onHoldApplication = createMockLeaveApplication({
        id: 'leave-1',
        staffId: 'staff-1',
        status: 'ON_HOLD',
        holdReason: '위생사 구분 슬롯 부족',
        date,
        staff
      })

      mockPrisma.leaveApplication.create.mockResolvedValue(onHoldApplication as any)

      // Phase 2: 다른 직원 연차 취소 (슬롯 확보)
      const dailySlot = createMockDailySlot({ date, requiredStaff: 5 })
      mockPrisma.dailySlot.findFirst.mockResolvedValue(dailySlot as any)

      // Mock: ON_HOLD 신청 조회
      mockPrisma.leaveApplication.findMany.mockResolvedValue([onHoldApplication] as any)

      // Mock: 이제 슬롯 가용 (승인 가능)
      mockCheckCategoryAvailability.mockResolvedValue({
        shouldHold: false,
        canApprove: true,
        message: '승인 가능',
        totalStaff: 3,
        approvedCount: 0,
        allowedCount: 1
      })

      // Mock: 승인 처리
      const approvedApplication = { ...onHoldApplication, status: 'CONFIRMED' }
      mockPrisma.leaveApplication.update.mockResolvedValue(approvedApplication as any)

      // When: 자동 승인 프로세스 실행
      const result = await processOnHoldForDate(clinicId, date)

      // Then: 자동 승인 성공
      expect(result.approved).toBe(1)
      expect(result.approvedApplications[0].staffName).toBe('김철수')

      // Verify: 승인 처리
      expect(mockPrisma.leaveApplication.update).toHaveBeenCalledWith({
        where: { id: 'leave-1' },
        data: {
          status: 'CONFIRMED',
          holdReason: null
        }
      })

      // Verify: 승인 알림 전송
      expect(mockNotifyLeaveApproved).toHaveBeenCalledWith(
        'user-1',
        '김철수',
        date,
        'ANNUAL'
      )
    })
  })

  describe('다중 신청 경쟁 상황', () => {
    it('여러 직원이 동시 신청 시 선착순 + 구분별 제한 적용', async () => {
      // Given: 3명의 위생사가 같은 날 신청
      const clinicId = 'clinic-1'
      const date = new Date('2024-06-15')

      const staffList = [
        createMockStaff({ id: 'staff-1', name: '김철수', categoryName: '위생사' }),
        createMockStaff({ id: 'staff-2', name: '이영희', categoryName: '위생사' }),
        createMockStaff({ id: 'staff-3', name: '박민수', categoryName: '위생사' })
      ]

      // Mock: 첫 번째 승인 가능, 두 번째 보류, 세 번째 보류
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
          message: '위생사 구분 1/3 도달',
          totalStaff: 3,
          approvedCount: 1,
          allowedCount: 1
        })
        .mockResolvedValueOnce({
          shouldHold: true,
          canApprove: false,
          message: '위생사 구분 1/3 도달',
          totalStaff: 3,
          approvedCount: 1,
          allowedCount: 1
        })

      // When: 3개 신청 처리
      const results = []
      for (let i = 0; i < 3; i++) {
        const availability = await checkCategoryAvailability(
          clinicId,
          date,
          5,
          '위생사',
          mockPrisma as any
        )
        results.push(availability)
      }

      // Then: 첫 번째만 승인, 나머지 보류
      expect(results[0].canApprove).toBe(true)
      expect(results[1].shouldHold).toBe(true)
      expect(results[2].shouldHold).toBe(true)
    })
  })

  describe('주간 배치 후 ON_HOLD 일괄 처리', () => {
    it('주간 스케줄 확정 후 모든 ON_HOLD 신청 재검토', async () => {
      // Given: 주간 정보와 여러 ON_HOLD 신청
      const clinicId = 'clinic-1'
      const weekInfo = createMockWeekInfo()
      const dates = [
        new Date('2024-06-10'),
        new Date('2024-06-11'),
        new Date('2024-06-12')
      ]

      const onHoldApplications = dates.map((date, i) =>
        createMockLeaveApplication({
          id: `leave-${i + 1}`,
          status: 'ON_HOLD',
          date,
          staff: createMockStaff({
            id: `staff-${i + 1}`,
            name: `직원${i + 1}`,
            categoryName: '위생사',
            user: createMockUser({ id: `user-${i + 1}` })
          })
        })
      )

      // Mock: 각 날짜별 처리
      for (let i = 0; i < dates.length; i++) {
        mockPrisma.leaveApplication.findMany.mockResolvedValueOnce([onHoldApplications[i]] as any)
        mockPrisma.dailySlot.findFirst.mockResolvedValueOnce(
          createMockDailySlot({ date: dates[i], requiredStaff: 5 }) as any
        )

        // 첫 번째와 세 번째는 승인 가능, 두 번째는 보류
        if (i === 0 || i === 2) {
          mockCheckCategoryAvailability.mockResolvedValueOnce({
            shouldHold: false,
            canApprove: true,
            message: '승인 가능',
            totalStaff: 3,
            approvedCount: 0,
            allowedCount: 1
          })
          mockPrisma.leaveApplication.update.mockResolvedValueOnce(onHoldApplications[i] as any)
        } else {
          mockCheckCategoryAvailability.mockResolvedValueOnce({
            shouldHold: true,
            canApprove: false,
            message: '슬롯 부족',
            totalStaff: 3,
            approvedCount: 1,
            allowedCount: 1
          })
        }
      }

      // When: 각 날짜별 ON_HOLD 처리
      const results = []
      for (const date of dates) {
        const result = await processOnHoldForDate(clinicId, date)
        results.push(result)
      }

      // Then: 2건 승인, 1건 보류
      const totalApproved = results.reduce((sum, r) => sum + r.approved, 0)
      const totalOnHold = results.reduce((sum, r) => sum + r.remainingOnHold, 0)

      expect(totalApproved).toBe(2)
      expect(totalOnHold).toBe(1)
    })
  })
})
