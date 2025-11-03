/**
 * 11월 1일이 몇 주차로 계산되는지 확인
 */

function getWeekNumberInMonth(date, monthStart, monthEnd) {
  if (date < monthStart || date > monthEnd) {
    return null
  }

  // 월의 첫 날이 속한 주의 월요일 찾기
  const firstMonday = new Date(monthStart)
  const firstDayOfWeek = monthStart.getDay()
  const daysUntilMonday = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek
  firstMonday.setDate(monthStart.getDate() + daysUntilMonday)

  // date가 속한 주의 월요일 찾기
  const currentMonday = new Date(date)
  const currentDayOfWeek = date.getDay()
  const daysUntilCurrentMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek
  currentMonday.setDate(date.getDate() + daysUntilCurrentMonday)

  // 주차 계산 (1부터 시작)
  const weeksDiff = Math.floor((currentMonday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return weeksDiff + 1
}

const monthStart = new Date(2025, 10, 1) // 11월 1일
const monthEnd = new Date(2025, 10, 30)   // 11월 30일

console.log('11월 1일:', monthStart, '요일:', monthStart.getDay())

const week1 = getWeekNumberInMonth(new Date(2025, 10, 1), monthStart, monthEnd)
const week2Start = getWeekNumberInMonth(new Date(2025, 10, 3), monthStart, monthEnd)
const week2Mid = getWeekNumberInMonth(new Date(2025, 10, 7), monthStart, monthEnd)

console.log('11/1 (토):', week1, '주차')
console.log('11/3 (월):', week2Start, '주차')
console.log('11/7 (금):', week2Mid, '주차')
