/**
 * 태블릿 API 테스트
 * SUPER_ADMIN으로 로그인 후 세션 쿠키를 사용하여 API를 테스트합니다.
 */

const fetch = require('node-fetch')

async function testTabletsAPI() {
  try {
    console.log('Testing tablets API...')

    // 실제 브라우저의 쿠키를 사용해야 함
    // 브라우저에서 개발자 도구 -> Application -> Cookies에서 복사
    const response = await fetch('http://localhost:3000/api/admin/tablets', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 여기에 브라우저의 쿠키를 복사 붙여넣기
        // 'Cookie': 'next-auth.session-token=...'
      },
    })

    const data = await response.json()
    console.log('Status:', response.status)
    console.log('Response:', JSON.stringify(data, null, 2))

    if (data.success && data.data) {
      console.log(`\n✓ Found ${data.data.length} clinics:`)
      data.data.forEach(tablet => {
        console.log(`\n병원: ${tablet.clinic.name}`)
        console.log(`  - 사용자: ${tablet.clinic.userCount}명`)
        console.log(`  - 직원: ${tablet.clinic.staffCount}명`)
        console.log(`  - 출퇴근 태블릿: ${tablet.tablets.attendance.status}`)
        console.log(`  - 생체인식: ${tablet.tablets.biometric.status}`)
        console.log(`  - 수동 배치: ${tablet.tablets.manualAssign.status}`)
      })
    }
  } catch (error) {
    console.error('Error:', error.message)
  }
}

console.log('⚠️  이 스크립트는 브라우저에서 로그인한 상태의 쿠키가 필요합니다.')
console.log('브라우저에서:')
console.log('1. SUPER_ADMIN으로 로그인')
console.log('2. F12 -> Application -> Cookies -> localhost:3000')
console.log('3. next-auth.session-token 값 복사')
console.log('4. 이 파일의 Cookie 헤더에 붙여넣기')
console.log('')

testTabletsAPI()
