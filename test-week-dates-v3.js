// 2025년 10월 기준으로 테스트
// 10월 1일 = 수요일 (dow=3)
// 첫 주 일요일 = 9월 28일

function getWeekDates(year, month, week) {
  const dates = []

  // 해당 월의 1일
  const monthStart = new Date(year, month - 1, 1)
  const firstDayOfWeek = monthStart.getDay() // 0=일요일, 1=월요일, ..., 6=토요일

  // 해당 월의 1일이 속한 주의 일요일 날짜 계산
  const firstSundayDate = 1 - firstDayOfWeek

  // 요청한 주차의 일요일 날짜 계산 (week는 1부터 시작)
  const weekStartDate = firstSundayDate + (week - 1) * 7

  // 해당 주의 7일 생성 (일요일~토요일)
  for (let i = 0; i < 7; i++) {
    const date = new Date(year, month - 1, weekStartDate + i)
    dates.push(date)
  }

  return dates
}

const dayNames = ['일', '월', '화', '수', '목', '금', '토']

console.log('=== 2025년 10월 테스트 ===')
console.log('10월 1일:', new Date(2025, 9, 1).toLocaleDateString('ko-KR'), '(' + dayNames[new Date(2025, 9, 1).getDay()] + ')')
console.log('')

for (let week = 1; week <= 5; week++) {
  console.log(`\n${week}주차:`)
  const dates = getWeekDates(2025, 10, week)
  dates.forEach((date, i) => {
    const dow = date.getDay()
    // 로컬 날짜 기준으로 표시
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const dayName = dayNames[dow]
    console.log(`  ${dateStr} (${dayName}) - dow=${dow}`)
  })
}

console.log('\n=== 실제 2025년 10월 토요일들 확인 ===')
const saturdays = [4, 11, 18, 25]
saturdays.forEach(day => {
  const d = new Date(2025, 9, day)
  console.log(`10/${day} :`, d.toLocaleDateString('ko-KR'), '- dow=' + d.getDay(), '(' + dayNames[d.getDay()] + ')')
})
