/**
 * 자동배정 API 직접 호출 테스트
 */

async function testAutoAssign() {
  try {
    console.log('🚀 자동배정 API 호출 중...\n')

    const response = await fetch('http://localhost:3000/api/schedule/auto-assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'authjs.session-token=YOUR_TOKEN_HERE' // 실제 세션 토큰 필요
      },
      body: JSON.stringify({
        year: 2025,
        month: 10,
        forceRedeploy: true
      })
    })

    console.log('응답 상태:', response.status)
    const data = await response.json()

    if (data.success) {
      console.log('✅ 자동배정 성공!')
      console.log('총 배정:', data.result.totalAssignments)
      console.log('평균 형평성:', data.result.averageFairness)
      console.log('경고:', data.warnings?.length || 0, '건')

      if (data.warnings && data.warnings.length > 0) {
        console.log('\n경고 내용:')
        data.warnings.forEach(w => console.log('-', w))
      }
    } else {
      console.log('❌ 자동배정 실패:', data.error)
    }

  } catch (error) {
    console.error('❌ 에러:', error.message)
  }
}

testAutoAssign()
