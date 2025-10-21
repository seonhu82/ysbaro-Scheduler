/**
 * Date utility functions for 연세바로치과 스케줄러
 */

/**
 * Get the day of week in Korean
 * @param date - Date object
 * @returns Korean day name (e.g., "월요일")
 */
export function getKoreanDayName(date: Date): string {
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
  return days[date.getDay()]
}

/**
 * Get the short day of week in Korean
 * @param date - Date object
 * @returns Short Korean day name (e.g., "월")
 */
export function getKoreanDayShort(date: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return days[date.getDay()]
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

/**
 * Check if a date is Sunday
 */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

/**
 * Check if a date is Saturday
 */
export function isSaturday(date: Date): boolean {
  return date.getDay() === 6
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format date to Korean format (YYYY년 MM월 DD일)
 */
export function formatDateKorean(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}년 ${month}월 ${day}일`
}

/**
 * Format date with day of week (YYYY년 MM월 DD일 (요일))
 */
export function formatDateWithDay(date: Date): string {
  return `${formatDateKorean(date)} (${getKoreanDayShort(date)})`
}

/**
 * Get all dates in a month
 * @param year - Year (e.g., 2025)
 * @param month - Month (1-12)
 * @returns Array of Date objects
 */
export function getDatesInMonth(year: number, month: number): Date[] {
  const dates: Date[] = []
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(new Date(year, month - 1, day))
  }

  return dates
}

/**
 * Get week number of a date within a month (1-based)
 */
export function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const firstDayOfWeek = firstDay.getDay()
  const offsetDate = date.getDate() + firstDayOfWeek - 1
  return Math.floor(offsetDate / 7) + 1
}

/**
 * Get dates of a specific week in a month
 * @param year - Year
 * @param month - Month (1-12)
 * @param weekNumber - Week number (1-based)
 */
export function getDatesInWeek(year: number, month: number, weekNumber: number): Date[] {
  const allDates = getDatesInMonth(year, month)
  return allDates.filter(date => getWeekOfMonth(date) === weekNumber)
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * Check if a date is in the past
 */
export function isPastDate(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const compareDate = new Date(date)
  compareDate.setHours(0, 0, 0, 0)
  return compareDate < today
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

/**
 * Get month name in Korean
 */
export function getKoreanMonthName(month: number): string {
  return `${month}월`
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Get start of month
 */
export function getStartOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1)
}

/**
 * Get end of month
 */
export function getEndOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0)
}

/**
 * Parse YYYY-MM-DD string to Date
 */
export function parseDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Get time difference in days
 */
export function getDaysDifference(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check if a date is in a given year-month
 */
export function isInMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month - 1
}
