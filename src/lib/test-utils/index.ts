/**
 * 테스트 유틸리티
 *
 * 테스트에서 공통으로 사용하는 헬퍼 함수들
 */

import { PrismaClient } from '@prisma/client'

/**
 * Prisma Mock 클라이언트
 */
export const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  clinic: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  staff: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  leaveApplication: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  weekInfo: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  dailySlot: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
  },
  staffAssignment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  activityLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  attendanceRecord: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  fairnessScore: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
} as unknown as PrismaClient

/**
 * 날짜 생성 헬퍼
 */
export function createDate(dateString: string): Date {
  return new Date(dateString)
}

/**
 * 테스트용 Clinic 데이터
 */
export function createMockClinic(overrides = {}) {
  return {
    id: 'clinic-1',
    name: '연세바로치과',
    email: 'test@clinic.com',
    phone: '02-1234-5678',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * 테스트용 User 데이터
 */
export function createMockUser(overrides = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: '테스트 사용자',
    role: 'STAFF' as const,
    clinicId: 'clinic-1',
    accountStatus: 'APPROVED' as const,
    passwordHash: 'hashed-password',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * 테스트용 Staff 데이터
 */
export function createMockStaff(overrides = {}) {
  return {
    id: 'staff-1',
    userId: 'user-1',
    clinicId: 'clinic-1',
    name: '김철수',
    rank: '치과위생사',
    departmentName: '진료부',
    categoryName: '위생사',
    hireDate: new Date('2023-01-01'),
    employmentType: 'FULL_TIME' as const,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * 테스트용 LeaveApplication 데이터
 */
export function createMockLeaveApplication(overrides = {}) {
  return {
    id: 'leave-1',
    staffId: 'staff-1',
    clinicId: 'clinic-1',
    date: new Date('2024-06-15'),
    leaveType: 'ANNUAL' as const,
    status: 'PENDING' as const,
    reason: '개인 사유',
    emergencyContact: '010-1234-5678',
    appliedAt: new Date('2024-06-01'),
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  }
}

/**
 * 테스트용 WeekInfo 데이터
 */
export function createMockWeekInfo(overrides = {}) {
  return {
    id: 'week-1',
    clinicId: 'clinic-1',
    weekStart: new Date('2024-06-10'),
    weekEnd: new Date('2024-06-16'),
    year: 2024,
    weekNumber: 24,
    status: 'DRAFT' as const,
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  }
}

/**
 * 테스트용 DailySlot 데이터
 */
export function createMockDailySlot(overrides = {}) {
  return {
    id: 'slot-1',
    weekId: 'week-1',
    date: new Date('2024-06-15'),
    requiredStaff: 5,
    isHoliday: false,
    holidayName: null,
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  }
}

/**
 * 테스트용 FairnessScore 데이터
 */
export function createMockFairnessScore(overrides = {}) {
  return {
    id: 'fairness-1',
    staffId: 'staff-1',
    year: 2024,
    month: 6,
    nightShiftCount: 0,
    weekendCount: 0,
    holidayCount: 0,
    holidayAdjacentCount: 0,
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  }
}

/**
 * 테스트용 StaffAssignment 데이터
 */
export function createMockStaffAssignment(overrides = {}) {
  return {
    id: 'assignment-1',
    staffId: 'staff-1',
    date: new Date('2024-06-15'),
    shiftType: 'FULL' as const,
    assignedBy: 'AUTO' as const,
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  }
}

/**
 * Mock 함수 리셋
 */
export function resetAllMocks() {
  jest.clearAllMocks()
  Object.values(mockPrisma).forEach((model: any) => {
    if (model && typeof model === 'object') {
      Object.values(model).forEach((method: any) => {
        if (typeof method?.mockReset === 'function') {
          method.mockReset()
        }
      })
    }
  })
}

/**
 * 비동기 함수 지연 실행 (테스트용)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 랜덤 문자열 생성
 */
export function randomString(length = 10): string {
  return Math.random().toString(36).substring(2, length + 2)
}

/**
 * 날짜 범위 생성
 */
export function createDateRange(start: string, end: string): Date[] {
  const dates: Date[] = []
  const current = new Date(start)
  const endDate = new Date(end)

  while (current <= endDate) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}
