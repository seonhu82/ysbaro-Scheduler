// Test if November 24 category calculation is now fixed

async function testNov24() {
  const token = '34e9f4f17bc6fcc3ff0641b453fd9b85'
  const staffId = 'cmh6naxac000s12lynsqel2z3' // 팀장/실장 직원
  const date = '2025-11-24'
  const type = 'OFF'

  console.log('=== 11월 24일 OFF 신청 테스트 ===')
  console.log(`직원 ID: ${staffId}`)
  console.log(`날짜: ${date}`)
  console.log(`타입: ${type}`)

  const url = `http://localhost:3000/api/leave-apply/${token}/can-apply?staffId=${staffId}&date=${date}&type=${type}`
  console.log(`\n요청 URL: ${url}`)

  try {
    const response = await fetch(url)
    const data = await response.json()

    console.log(`\n응답 상태: ${response.status}`)
    console.log('응답 데이터:')
    console.log(JSON.stringify(data, null, 2))

    if (data.simulation) {
      console.log('\n=== 시뮬레이션 결과 ===')
      console.log('신청 가능:', data.simulation.canApply)
      console.log('사유:', data.simulation.reason)

      if (data.simulation.details) {
        console.log('\n상세 정보:')
        console.log('  구분:', data.simulation.details.category)
        console.log('  필요 인원:', data.simulation.details.required)
        console.log('  신청 가능:', data.simulation.details.available)
        console.log('  이미 신청:', data.simulation.details.approved)
      }
    }

    // 결과 확인
    if (response.status === 200 && data.simulation) {
      if (data.simulation.reason === 'CATEGORY_SHORTAGE') {
        const required = data.simulation.details?.required
        console.log(`\n⚠️  여전히 CATEGORY_SHORTAGE 오류 발생!`)
        console.log(`   필요 인원: ${required}명 (2명이어야 함)`)
        console.log(`   수정 실패: 여전히 비율 기반 계산을 사용하고 있음`)
      } else if (data.simulation.canApply) {
        console.log(`\n✅ 수정 성공: 신청 가능함`)
      } else {
        console.log(`\n⚠️  다른 사유로 신청 불가: ${data.simulation.reason}`)
      }
    }

  } catch (error) {
    console.error('오류:', error.message)
  }
}

testNov24()
