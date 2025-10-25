/**
 * 주별 슬롯 계산 알고리즘
 *
 * 주요 기능:
 * 1. 주차 정보 생성 (월~토 6일 단위)
 * 2. 날짜별 슬롯 계산
 * 3. 오프 목표 계산 (workType 고려)
 * 4. 연차 가능 자리 계산
 */

import { WorkType } from '@prisma/client'

export interface WeekSlotCalculation {
  weekNumber: number
  weekStart: Date
  weekEnd: Date
  totalSlots: number
  offTarget: number
  annualAvailable: number
  hasHoliday: boolean
  dailySlots: DailySlotInfo[]
}

export interface DailySlotInfo {
  date: Date
  dayOfWeek: number // 0=일, 1=월, 6=토
  requiredStaff: number
  availableSlots: number
}

interface DoctorSchedule {
  doctorId: string
  workDays: number[] // 0=일, 1=월, ..., 6=토
}

interface Holiday {
  date: Date
  name: string
}

/**
 * 특정 월의 모든 주차 정보 생성
 * 월~일 7일 단위로 주차 구분
 */
export function calculateMonthWeeks(
  year: number,
  month: number,
  doctorSchedules: DoctorSchedule[],
  holidays: Holiday[] = [],
  workTypeSettings: { week4OffDays: number; week5OffDays: number } = {
    week4OffDays: 2,
    week5OffDays: 1
  }
): WeekSlotCalculation[] {
  const weeks: WeekSlotCalculation[] = []

  // 해당 월의 첫날과 마지막날
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)

  // 첫 주의 시작일 (월요일 기준)
  let currentWeekStart = new Date(firstDay)
  const firstDayOfWeek = firstDay.getDay() // 0=일, 1=월

  // 첫날이 월요일이 아니면 이전 월요일로 이동
  if (firstDayOfWeek !== 1) {
    const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
    currentWeekStart.setDate(currentWeekStart.getDate() - daysToMonday)
  }

  let weekNumber = 1

  while (currentWeekStart <= lastDay) {
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 6) // 일요일까지

    const weekCalc = calculateWeekSlots(
      currentWeekStart,
      weekEnd,
      doctorSchedules,
      holidays,
      workTypeSettings
    )

    weeks.push({
      ...weekCalc,
      weekNumber
    })

    // 다음 주 월요일로 이동
    currentWeekStart = new Date(weekEnd)
    currentWeekStart.setDate(currentWeekStart.getDate() + 1)
    weekNumber++
  }

  return weeks
}

/**
 * 주차별 슬롯 계산
 */
export function calculateWeekSlots(
  weekStart: Date,
  weekEnd: Date,
  doctorSchedules: DoctorSchedule[],
  holidays: Holiday[] = [],
  workTypeSettings: { week4OffDays: number; week5OffDays: number }
): WeekSlotCalculation {
  const dailySlots: DailySlotInfo[] = []
  let totalSlots = 0
  let hasHoliday = false

  // 주의 각 날짜별로 슬롯 계산
  const currentDate = new Date(weekStart)

  while (currentDate <= weekEnd) {
    const dayOfWeek = currentDate.getDay() // 0=일, 1=월, ..., 6=토

    // 해당 날짜에 근무하는 원장 수 계산
    const workingDoctors = doctorSchedules.filter((schedule) =>
      schedule.workDays.includes(dayOfWeek)
    ).length

    // 해당 날짜가 공휴일인지 확인
    const isHoliday = holidays.some(
      (holiday) =>
        holiday.date.getFullYear() === currentDate.getFullYear() &&
        holiday.date.getMonth() === currentDate.getMonth() &&
        holiday.date.getDate() === currentDate.getDate()
    )

    if (isHoliday) {
      hasHoliday = true
    }

    // 필요 인력: 원장 1명당 2명의 스태프 필요 (기본 가정)
    const requiredStaff = workingDoctors * 2

    // 가용 슬롯: 전체 스태프 - 필요 인력
    // 전체 스태프는 20명으로 가정 (실제로는 DB에서 조회)
    const availableSlots = calculateDailySlots(currentDate, requiredStaff, 20)

    dailySlots.push({
      date: new Date(currentDate),
      dayOfWeek,
      requiredStaff,
      availableSlots
    })

    totalSlots += availableSlots
    currentDate.setDate(currentDate.getDate() + 1)
  }

  // 오프 목표 계산 (주4일: 2일, 주5일: 1일)
  // 실제로는 스태프별 workType을 확인해야 하지만, 여기서는 평균값 사용
  const week4Count = 10 // 예시: 주4일 근무자 10명
  const week5Count = 10 // 예시: 주5일 근무자 10명

  const offTarget = Math.round(
    (week4Count * workTypeSettings.week4OffDays +
     week5Count * workTypeSettings.week5OffDays) /
    (week4Count + week5Count)
  )

  // 연차 가능 자리: 공휴일이 있으면 추가 슬롯 제공
  const annualAvailable = hasHoliday ? Math.floor(totalSlots * 0.2) : Math.floor(totalSlots * 0.1)

  return {
    weekNumber: 1, // calculateMonthWeeks에서 재설정됨
    weekStart: new Date(weekStart),
    weekEnd: new Date(weekEnd),
    totalSlots,
    offTarget,
    annualAvailable,
    hasHoliday,
    dailySlots
  }
}

/**
 * 날짜별 가용 슬롯 계산
 */
export function calculateDailySlots(
  date: Date,
  requiredStaff: number,
  totalStaff: number = 20
): number {
  return Math.max(0, totalStaff - requiredStaff)
}
