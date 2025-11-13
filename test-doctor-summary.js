const fetch = require('node-fetch')

async function test() {
  // 8월 데이터 확인
  const response = await fetch('http://localhost:3000/api/schedule/doctor-summary?year=2025&month=8', {
    headers: {
      'Cookie': 'next-auth.session-token=your-token-here'
    }
  })
  
  const data = await response.json()
  console.log('8월 doctor-summary 응답:')
  console.log('  hasSchedule:', data.hasSchedule)
  console.log('  weekPatterns:', data.weekPatterns)
  console.log('  slots 개수:', data.slots?.length)
}

test()
