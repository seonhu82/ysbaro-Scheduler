// 스케줄 관련 타입 정의

import type { Schedule, ScheduleDoctor, StaffAssignment, Doctor, Staff } from '@prisma/client'

/**
 * 스케줄 (관계 포함)
 */
export interface ScheduleWithRelations extends Schedule {
  doctors: (ScheduleDoctor & {
    doctor: Doctor
  })[]
  staffAssignments: (StaffAssignment & {
    staff: Staff
  })[]
}

/**
 * 직원 배치 (관계 포함)
 */
export interface StaffAssignmentWithStaff extends StaffAssignment {
  staff: Staff
  schedule: Schedule
}

/**
 * 필수 인원 구조
 */
export interface RequiredStaff {
  leader: { min: number; max: number }
  senior: { min: number; max: number }
  intermediate: { min: number; max: number }
  junior: { min: number; max: number }
  total: { min: number; max: number }
}

/**
 * 배치 설정
 */
export interface AssignmentConfig {
  year: number
  month: number
  mode: 'full' | 'smart'  // 완전 재배치 vs 스마트 배치
  ratios?: {
    leader?: number
    senior?: number
    intermediate?: number
    junior?: number
  }
}

/**
 * 배치 결과
 */
export interface AssignmentResult {
  success: boolean
  totalSchedules: number
  successCount: number
  failedCount: number
  warnings: string[]
  fairnessScore: number
}

/**
 * 스케줄 검증 결과
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}
