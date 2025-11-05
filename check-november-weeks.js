/**
 * November 2025 주차 계산 확인
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

console.log('=== 2025년 11월 주차 계산 ===')
console.log('월 시작일:', monthStart.toLocaleDateString('ko-KR', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }))
console.log('월 종료일:', monthEnd.toLocaleDateString('ko-KR', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }))
console.log()

const weeks = getWeeksInMonth(monthStart, monthEnd)

weeks.forEach((week, index) => {
  const startStr = week.start.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' })
  const endStr = week.end.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' })

  // 주차의 날짜들이 11월에 속하는지 확인
  const startMonth = week.start.getMonth() + 1
  const endMonth = week.end.getMonth() + 1
  const startDate = week.start.getDate()
  const endDate = week.end.getDate()

  // 11월에 속한 날짜 개수 계산
  let novemberDays = 0
  let current = new Date(week.start)
  while (current <= week.end) {
    if (current.getMonth() === 10) { // 10 = 11월 (0-indexed)
      novemberDays++
    }
    current.setDate(current.getDate() + 1)
  }

  console.log(`제${index + 1}주: ${startStr} ~ ${endStr}`)
  console.log(`  - 시작: ${startMonth}월 ${startDate}일, 종료: ${endMonth}월 ${endDate}일`)
  console.log(`  - 11월에 속한 날짜 수: ${novemberDays}일 / 7일`)

  if (novemberDays === 0) {
    console.log(`  ⚠️ 이 주는 11월에 속한 날짜가 없습니다!`)
  } else if (novemberDays < 4) {
    console.log(`  ⚠️ 이 주는 11월에 속한 날짜가 절반 미만입니다!`)
  }

  console.log()
})

console.log(`총 주차 수: ${weeks.length}`)
