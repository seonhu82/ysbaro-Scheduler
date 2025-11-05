/**
 * 일요일을 근무일로 설정한 경우 주차 계산 확인
 */

function getWeeksInMonth(monthStart, monthEnd) {
  const weeks = []

  // 해당 월의 첫날이 속한 주의 일요일 찾기
  let weekStart = new Date(monthStart)
  const firstDayOfWeek = monthStart.getDay() // 0=일요일

  // 일요일로 조정
  if (firstDayOfWeek !== 0) {
    weekStart.setDate(weekStart.getDate() - firstDayOfWeek)
  }

  // 해당 월의 마지막 날이 속한 주의 토요일 찾기
  let weekEnd = new Date(monthEnd)
  const lastDayOfWeek = monthEnd.getDay()

  // 토요일로 조정
  if (lastDayOfWeek !== 6) {
    weekEnd.setDate(weekEnd.getDate() + (6 - lastDayOfWeek))
  }

  console.log(`weekStart: ${weekStart.toLocaleDateString('ko-KR')} (${['일','월','화','수','목','금','토'][weekStart.getDay()]})`)
  console.log(`weekEnd: ${weekEnd.toLocaleDateString('ko-KR')} (${['일','월','화','수','목','금','토'][weekEnd.getDay()]})`)
  console.log()

  // 주 단위로 생성 (일요일 ~ 토요일)
  let current = new Date(weekStart)

  while (current <= weekEnd) {
    const start = new Date(current)
    const end = new Date(current)
    end.setDate(end.getDate() + 6) // 일요일 + 6일 = 토요일

    // 마지막 주의 끝이 전체 종료일을 넘지 않도록
    if (end > weekEnd) {
      weeks.push({ start, end: new Date(weekEnd) })
      break
    } else {
      weeks.push({ start, end })
    }

    // 다음 주 (일요일)
    current.setDate(current.getDate() + 7)
  }

  return weeks
}

// 2025년 11월 계산
const monthStart = new Date(2025, 10, 1) // 11월 1일
const monthEnd = new Date(2025, 11, 0) // 11월 마지막 날

console.log('=== 2025년 11월 (일요일도 근무일로 가정) ===')
console.log('월 시작일:', monthStart.toLocaleDateString('ko-KR', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }))
console.log('월 종료일:', monthEnd.toLocaleDateString('ko-KR', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }))
console.log()

const weeks = getWeeksInMonth(monthStart, monthEnd)

console.log('생성된 주차:')
weeks.forEach((week, index) => {
  const startStr = week.start.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' })
  const endStr = week.end.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' })

  console.log(`제${index + 1}주: ${startStr} ~ ${endStr}`)
})

console.log()
console.log(`총 주차 수: ${weeks.length}`)
console.log()
console.log('✅ 일요일이 휴무든 근무일이든 상관없이')
console.log('✅ 11월 30일(일)이 포함된 주차는 12월 6일(토)까지 포함됩니다')
console.log('✅ 따라서 일요일을 근무일로 설정하면 11/30~12/6이 모두 세팅 가능합니다')
