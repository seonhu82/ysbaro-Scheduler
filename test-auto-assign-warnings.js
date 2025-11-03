/**
 * 자동 배정 API 호출 및 경고 확인
 */

async function testAutoAssign() {
  try {
    const response = await fetch('http://localhost:3000/api/schedule/auto-assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        year: 2025,
        month: 10,
        forceRedeploy: true
      })
    })

    const data = await response.json()

    console.log('\n📊 자동 배정 결과:\n')
    console.log('성공 여부:', data.success)
    console.log('총 배정:', data.result?.totalAssignments)
    console.log('평균 형평성:', data.result?.averageFairness)

    if (data.warnings && data.warnings.length > 0) {
      console.log('\n⚠️  경고 목록:')
      data.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning}`)
      })
    } else {
      console.log('\n✅ 경고 없음')
    }

    if (data.error) {
      console.log('\n❌ 오류:', data.error)
      console.log('메시지:', data.message)
    }

  } catch (error) {
    console.error('❌ 요청 실패:', error.message)
  }
}

testAutoAssign()
