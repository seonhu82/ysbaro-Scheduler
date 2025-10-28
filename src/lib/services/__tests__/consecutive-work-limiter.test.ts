/**
 * consecutive-work-limiter 단위 테스트
 *
 * 연속 근무일 계산 및 제한 로직 테스트
 */

import {
  mockPrisma,
  resetAllMocks,
  createMockStaffAssignment,
  createMockLeaveApplication
} from '@/lib/test-utils'
import { subDays, addDays } from 'date-fns'

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}))

import {
  calculateConsecutiveWorkDays,
  validateConsecutiveWork,
  predictConsecutiveWorkDays
} from '../consecutive-work-limiter'

describe('consecutive-work-limiter', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  describe('calculateConsecutiveWorkDays', () => {
    it('연속 3일 근무 시 3 반환', async () => {
      // Given: 6월 15일 기준, 13~14일 근무
      const staffId = 'staff-1'
      const targetDate = new Date('2024-06-15')

      // Mock: 전날(14일) 근무
      mockPrisma.staffAssignment.findFirst
        .mockResolvedValueOnce(createMockStaffAssignment({
          date: new Date('2024-06-14'),
          shiftType: 'FULL'
        }) as any)
        // 전전날(13일) 근무
        .mockResolvedValueOnce(createMockStaffAssignment({
          date: new Date('2024-06-13'),
          shiftType: 'FULL'
        }) as any)
        // 12일은 오프
        .mockResolvedValueOnce(null)

      // Mock: 연차 없음
      mockPrisma.leaveApplication.findFirst.mockResolvedValue(null)

      // When
      const days = await calculateConsecutiveWorkDays(staffId, targetDate)

      // Then
      expect(days).toBe(2) // 13일, 14일 = 2일
    })

    it('중간에 오프가 있으면 연속일 리셋', async () => {
      // Given: 중간에 OFF
      const staffId = 'staff-1'
      const targetDate = new Date('2024-06-15')

      // Mock: 14일 근무, 13일 OFF, 12일 근무
      mockPrisma.staffAssignment.findFirst
        .mockResolvedValueOnce(createMockStaffAssignment({
          date: new Date('2024-06-14'),
          shiftType: 'FULL'
        }) as any)
        .mockResolvedValueOnce(createMockStaffAssignment({
          date: new Date('2024-06-13'),
          shiftType: 'OFF'
        }) as any)

      mockPrisma.leaveApplication.findFirst.mockResolvedValue(null)

      // When
      const days = await calculateConsecutiveWorkDays(staffId, targetDate)

      // Then: OFF 전까지만 카운트
      expect(days).toBe(1) // 14일만
    })

    it('중간에 연차가 있으면 연속일 리셋', async () => {
      // Given: 중간에 연차
      const staffId = 'staff-1'
      const targetDate = new Date('2024-06-15')

      // Mock: 14일 근무
      mockPrisma.staffAssignment.findFirst
        .mockResolvedValueOnce(createMockStaffAssignment({
          date: new Date('2024-06-14'),
          shiftType: 'FULL'
        }) as any)
        .mockResolvedValueOnce(createMockStaffAssignment({
          date: new Date('2024-06-13'),
          shiftType: 'FULL'
        }) as any)

      // Mock: 13일에 연차
      mockPrisma.leaveApplication.findFirst
        .mockResolvedValueOnce(null) // 14일 연차 없음
        .mockResolvedValueOnce(createMockLeaveApplication({
          date: new Date('2024-06-13'),
          status: 'CONFIRMED'
        }) as any) // 13일 연차 있음

      // When
      const days = await calculateConsecutiveWorkDays(staffId, targetDate)

      // Then: 연차 전까지만 카운트
      expect(days).toBe(1) // 14일만
    })

    it('연속 근무가 없으면 0 반환', async () => {
      // Given: 전날 오프
      const staffId = 'staff-1'
      const targetDate = new Date('2024-06-15')

      // Mock: 14일 오프
      mockPrisma.staffAssignment.findFirst.mockResolvedValueOnce(
        createMockStaffAssignment({ date: new Date('2024-06-14'), shiftType: 'OFF' }) as any
      )

      mockPrisma.leaveApplication.findFirst.mockResolvedValue(null)

      // When
      const days = await calculateConsecutiveWorkDays(staffId, targetDate)

      // Then
      expect(days).toBe(0)
    })
  })

  describe('validateConsecutiveWork', () => {
    it('연속 6일 이하일 때 검증 통과', async () => {
      // Given: 현재 4일 연속 근무
      const staffId = 'staff-1'
      const leaveDate = new Date('2024-06-15')

      // Mock: 4일 연속 근무
      mockPrisma.staffAssignment.findFirst
        .mockResolvedValueOnce(createMockStaffAssignment({ shiftType: 'FULL' }) as any)
        .mockResolvedValueOnce(createMockStaffAssignment({ shiftType: 'FULL' }) as any)
        .mockResolvedValueOnce(createMockStaffAssignment({ shiftType: 'FULL' }) as any)
        .mockResolvedValueOnce(createMockStaffAssignment({ shiftType: 'FULL' }) as any)
        .mockResolvedValueOnce(null)

      mockPrisma.leaveApplication.findFirst.mockResolvedValue(null)

      // When
      const result = await validateConsecutiveWork(staffId, leaveDate, 6)

      // Then
      expect(result.isValid).toBe(true)
      expect(result.consecutiveDays).toBe(4)
      expect(result.error).toBeUndefined()
    })

    it('연속 6일이면 경고 표시', async () => {
      // Given: 현재 5일 연속 근무
      const staffId = 'staff-1'
      const leaveDate = new Date('2024-06-15')

      // Mock: 5일 연속
      for (let i = 0; i < 5; i++) {
        mockPrisma.staffAssignment.findFirst.mockResolvedValueOnce(
          createMockStaffAssignment({ shiftType: 'FULL' }) as any
        )
      }
      mockPrisma.staffAssignment.findFirst.mockResolvedValueOnce(null)

      mockPrisma.leaveApplication.findFirst.mockResolvedValue(null)

      // When
      const result = await validateConsecutiveWork(staffId, leaveDate, 6)

      // Then
      expect(result.isValid).toBe(true)
      expect(result.consecutiveDays).toBe(5)
      expect(result.warning).toContain('6일 연속 근무')
      expect(result.warning).toContain('휴식을 권장')
    })

    it('연속 7일 이상이면 검증 실패', async () => {
      // Given: 현재 6일 연속 근무
      const staffId = 'staff-1'
      const leaveDate = new Date('2024-06-15')

      // Mock: 6일 연속
      for (let i = 0; i < 6; i++) {
        mockPrisma.staffAssignment.findFirst.mockResolvedValueOnce(
          createMockStaffAssignment({ shiftType: 'FULL' }) as any
        )
      }
      mockPrisma.staffAssignment.findFirst.mockResolvedValueOnce(null)

      mockPrisma.leaveApplication.findFirst.mockResolvedValue(null)

      // When
      const result = await validateConsecutiveWork(staffId, leaveDate, 6)

      // Then
      expect(result.isValid).toBe(false)
      expect(result.consecutiveDays).toBe(6)
      expect(result.error).toContain('연차 사용을 권장')
      expect(result.error).toContain('6일 연속 근무')
    })
  })

  describe('predictConsecutiveWorkDays', () => {
    it('미래 스케줄을 포함하여 연속일 예측', async () => {
      // Given: 과거 2일 + 미래 3일 근무 예정
      const staffId = 'staff-1'
      const startDate = new Date('2024-06-15')
      const endDate = new Date('2024-06-17')

      // Mock: 과거 2일 연속 (13~14일)
      mockPrisma.staffAssignment.findFirst
        .mockResolvedValueOnce(createMockStaffAssignment({ date: new Date('2024-06-14'), shiftType: 'FULL' }) as any)
        .mockResolvedValueOnce(createMockStaffAssignment({ date: new Date('2024-06-13'), shiftType: 'FULL' }) as any)
        .mockResolvedValueOnce(null)
        // 미래 15~17일 근무
        .mockResolvedValueOnce(createMockStaffAssignment({ date: new Date('2024-06-15'), shiftType: 'FULL' }) as any)
        .mockResolvedValueOnce(createMockStaffAssignment({ date: new Date('2024-06-16'), shiftType: 'FULL' }) as any)
        .mockResolvedValueOnce(createMockStaffAssignment({ date: new Date('2024-06-17'), shiftType: 'FULL' }) as any)

      mockPrisma.leaveApplication.findFirst.mockResolvedValue(null)

      // When
      const days = await predictConsecutiveWorkDays(staffId, startDate, endDate)

      // Then: 과거 2일 + 현재~미래 3일 = 5일
      expect(days).toBe(5)
    })

    it('미래에 오프가 있으면 리셋 예측', async () => {
      // Given: 과거 2일 + 미래 15일 근무, 16일 오프, 17일 근무
      const staffId = 'staff-1'
      const startDate = new Date('2024-06-15')
      const endDate = new Date('2024-06-17')

      // Mock: 과거
      mockPrisma.staffAssignment.findFirst
        .mockResolvedValueOnce(createMockStaffAssignment({ shiftType: 'FULL' }) as any)
        .mockResolvedValueOnce(createMockStaffAssignment({ shiftType: 'FULL' }) as any)
        .mockResolvedValueOnce(null)
        // 미래: 15일 근무, 16일 OFF, 17일 근무
        .mockResolvedValueOnce(createMockStaffAssignment({ shiftType: 'FULL' }) as any)
        .mockResolvedValueOnce(createMockStaffAssignment({ shiftType: 'OFF' }) as any)
        .mockResolvedValueOnce(createMockStaffAssignment({ shiftType: 'FULL' }) as any)

      mockPrisma.leaveApplication.findFirst.mockResolvedValue(null)

      // When
      const days = await predictConsecutiveWorkDays(staffId, startDate, endDate)

      // Then: 16일 OFF로 리셋되어 17일 1일만 카운트
      expect(days).toBe(1)
    })
  })
})
