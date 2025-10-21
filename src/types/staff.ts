// 직원 관련 타입 정의

import type { Staff, LeaveApplication, SpecialCondition, FairnessScore } from '@prisma/client'

/**
 * 직원 (관계 포함)
 */
export interface StaffWithRelations extends Staff {
  leaveApplications?: LeaveApplication[]
  specialConditions?: SpecialCondition[]
  fairnessScores?: FairnessScore[]
}

/**
 * 직원 등급 표시명
 */
export interface StaffRankDisplay {
  rank: 'LEADER' | 'SENIOR' | 'INTERMEDIATE' | 'JUNIOR'
  displayName: string
  level: number
}

/**
 * 직원 근무 통계
 */
export interface StaffWorkStats {
  staffId: string
  staffName: string
  rank: string
  totalDays: number
  nightShifts: number
  weekendShifts: number
  annualLeaveUsed: number
  annualLeaveRemaining: number
}

/**
 * 직원 일괄 등록 데이터
 */
export interface BulkStaffData {
  name: string
  rank: 'LEADER' | 'SENIOR' | 'INTERMEDIATE' | 'JUNIOR'
  birthDate: string  // YYYY-MM-DD
  phoneNumber?: string
  email?: string
}
