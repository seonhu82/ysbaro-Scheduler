/**
 * 2025년 1월 주차 계산 확인
 * 1월 31일(금) 근무일이 있는 경우 2월 1일(토)까지 포함되는지 확인
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

// 2025년 1월 계산
const monthStart = new Date(2025, 0, 1) // 1월 1일
const monthEnd = new Date(2025, 1, 0) // 1월 마지막 날

console.log('=== 2025년 1월 주차 계산 ===')
console.log('월 시작일:', monthStart.toLocaleDateString('ko-KR', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }))
console.log('월 종료일:', monthEnd.toLocaleDateString('ko-KR', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }))
console.log()

const weeks = getWeeksInMonth(monthStart, monthEnd)

weeks.forEach((week, index) => {
  const startStr = week.start.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' })
  const endStr = week.end.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' })

  const startMonth = week.start.getMonth() + 1
  const endMonth = week.end.getMonth() + 1
  const startDate = week.start.getDate()
  const endDate = week.end.getDate()

  console.log(`제${index + 1}주: ${startStr} ~ ${endStr}`)
  console.log(`  - 시작: ${startMonth}월 ${startDate}일, 종료: ${endMonth}월 ${endDate}일`)

  // 1월 31일(금)이 포함되어 있는지 확인
  if (week.start <= new Date(2025, 0, 31) && week.end >= new Date(2025, 0, 31)) {
    console.log(`  ✅ 이 주는 1월 31일(금) 근무일을 포함합니다`)
    if (endMonth === 2 && endDate >= 1) {
      console.log(`  ✅ 2월 1일(토)까지 포함되어 1월 스케줄에서 함께 세팅됩니다`)
    }
  }

  console.log()
})

console.log(`총 주차 수: ${weeks.length}`)
console.log()
console.log('결론: 1월 31일(금) 근무일이 있으면 해당 주차(~2/1 토)가 1월 스케줄에 포함됩니다.')
