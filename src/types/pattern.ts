// 원장 패턴 관련 타입 정의

import type { DoctorPattern, DoctorPatternDay, Doctor } from '@prisma/client'

/**
 * 원장 패턴 (관계 포함)
 */
export interface DoctorPatternWithDays extends DoctorPattern {
  days: (DoctorPatternDay & {
    doctor: Doctor
  })[]
}

/**
 * 요일별 패턴 데이터
 */
export interface PatternDayData {
  dayOfWeek: number  // 0=일, 1=월, ..., 6=토
  doctorId: string
  isWorking: boolean
  hasNightShift: boolean
}

/**
 * 패턴 적용 요청
 */
export interface ApplyPatternRequest {
  year: number
  month: number
  overwrite?: boolean  // 기존 스케줄 덮어쓰기 여부
}

/**
 * 패턴 적용 결과
 */
export interface ApplyPatternResult {
  success: boolean
  createdCount: number
  updatedCount: number
  skippedCount: number
  errors: string[]
}
