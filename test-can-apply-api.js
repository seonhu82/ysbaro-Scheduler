// can-apply API 테스트

const testCases = [
  {
    name: '11월 28일 OFF 신청 (existingOffs 없음)',
    staffId: 'cmh6naxac000s12lynsqel2z3',
    date: '2025-11-28',
    type: 'OFF',
    existingOffsInWeek: ''
  },
  {
    name: '11월 28일 OFF 신청 (22일, 25일 이미 선택)',
    staffId: 'cmh6naxac000s12lynsqel2z3',
    date: '2025-11-28',
    type: 'OFF',
    existingOffsInWeek: '2025-11-22,2025-11-25'
  },
  {
    name: '11월 24일 OFF 신청',
    staffId: 'cmh6naxac000s12lynsqel2z3',
    date: '2025-11-24',
    type: 'OFF',
    existingOffsInWeek: ''
  }
]

async function testAPI() {
  const token = '34e9f4f17bc6fcc3ff0641b453fd9b85'

  for (const testCase of testCases) {
    console.log(`\n=== ${testCase.name} ===`)

    let url = `http://localhost:3000/api/leave-apply/${token}/can-apply?staffId=${testCase.staffId}&date=${testCase.date}&type=${testCase.type}`

    if (testCase.existingOffsInWeek) {
      url += `&existingOffsInWeek=${encodeURIComponent(testCase.existingOffsInWeek)}`
    }

    console.log('요청 URL:', url)

    try {
      const response = await fetch(url)
      const data = await response.json()

      console.log('응답 상태:', response.status)
      console.log('응답 데이터:', JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('오류:', error.message)
    }
  }
}

testAPI()
