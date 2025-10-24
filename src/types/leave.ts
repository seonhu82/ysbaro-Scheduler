// 연차 관련 타입 정의

import type { LeaveApplication, Staff, ApplicationLink } from '@prisma/client'

/**
 * 연차 신청 (관계 포함)
 */
export interface LeaveApplicationWithStaff extends LeaveApplication {
  staff: Staff
  link: ApplicationLink
}

/**
 * 신청 링크 (관계 포함)
 */
export interface ApplicationLinkWithRelations extends ApplicationLink {
  applications: LeaveApplicationWithStaff[]
  
}

/**
 * 슬롯 현황
 */
export interface SlotStatus {
  date: string  // YYYY-MM-DD
  dayOfWeek: number  // 0=일요일
  current: number
  max: number
  isFull: boolean
  isHoliday: boolean  // 휴일 여부
  holidayName?: string  // 공휴일명
}

/**
 * 주간 오프 현황
 */
export interface WeeklyOffCount {
  weekStart: string  // 'M월 d일'
  weekEnd: string
  count: number
  maxAllowed: number  // 2일
}

/**
 * 연차 신청 생성 데이터
 */
export interface CreateLeaveApplicationData {
  linkId: string
  staffId: string
  leaveDate: Date
  leaveType: 'ANNUAL' | 'OFF'
  ipAddress: string
  userAgent: string
}

/**
 * 슬롯 가용성
 */
export interface SlotAvailability {
  available: boolean
  current: number
  max: number
  remaining: number
}
