// 주 범위 계산 테스트

function getWeekStart(date) {
  const d = new Date(date)
  // UTC 기준으로 요일 계산
  const day = d.getUTCDay()
  const diff = day === 0 ? 0 : -day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function getWeekEnd(date) {
  const weekStart = getWeekStart(date)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
  weekEnd.setUTCHours(23, 59, 59, 999)
  return weekEnd
}

// 테스트 날짜들
const testDates = [
  '2025-11-16', // 일요일
  '2025-11-17', // 월요일
  '2025-11-22', // 토요일
  '2025-11-23', // 일요일
  '2025-11-24', // 월요일
  '2025-11-28', // 금요일
  '2025-11-29', // 토요일
]

console.log('=== 주 범위 계산 테스트 ===\n')

testDates.forEach(dateStr => {
  const date = new Date(dateStr)
  const weekStart = getWeekStart(date)
  const weekEnd = getWeekEnd(date)

  console.log(`날짜: ${dateStr} (${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})`)
  console.log(`  입력 Date: ${date.toISOString()}`)
  console.log(`  주 시작: ${weekStart.toISOString().split('T')[0]} (${['일', '월', '화', '수', '목', '금', '토'][weekStart.getDay()]})`)
  console.log(`  주 종료: ${weekEnd.toISOString().split('T')[0]} (${['일', '월', '화', '수', '목', '금', '토'][weekEnd.getDay()]})`)
  console.log()
})

console.log('\n=== 기대되는 주 범위 ===')
console.log('11월 16일 ~ 11월 22일: 일요일(16일) ~ 토요일(22일)')
console.log('11월 23일 ~ 11월 29일: 일요일(23일) ~ 토요일(29일)')
