/**
 * 주별 슬롯 계산 알고리즘
 *
 * 주요 기능:
 * 1. 주차 정보 생성 (월~토 6일 단위)
 * 2. 날짜별 슬롯 계산
 * 3. 오프 목표 계산 (workType 고려)
 * 4. 연차 가능 자리 계산
 */

import { WorkType } from '@prisma/client';

export interface WeekSlotCalculation {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  totalSlots: number;
  offTarget: number;
  annualAvailable: number;
  hasHoliday: boolean;
  dailySlots: DailySlotInfo[];
}

export interface DailySlotInfo {
  date: Date;
  dayOfWeek: number; // 0=월, 5=토, 6=일
  requiredStaff: number;
  availableSlots: number;
}

/**
 * 특정 월의 모든 주차 정보 생성
 */
export function calculateMonthWeeks(
  year: number,
  month: number,
  doctorSchedules: any[] // TODO: 타입 정의
): WeekSlotCalculation[] {
  // TODO: 구현 예정
  return [];
}

/**
 * 주차별 슬롯 계산
 */
export function calculateWeekSlots(
  weekStart: Date,
  weekEnd: Date,
  doctorSchedules: any[],
  workTypeSettings: { week4OffDays: number; week5OffDays: number }
): WeekSlotCalculation {
  // TODO: 구현 예정
  return {
    weekNumber: 1,
    weekStart,
    weekEnd,
    totalSlots: 0,
    offTarget: 0,
    annualAvailable: 0,
    hasHoliday: false,
    dailySlots: [],
  };
}

/**
 * 날짜별 가용 슬롯 계산
 */
export function calculateDailySlots(
  date: Date,
  requiredStaff: number,
  totalStaff: number = 20
): number {
  return totalStaff - requiredStaff;
}
