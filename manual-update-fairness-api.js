/**
 * API를 통한 Staff 테이블 편차 수동 업데이트
 */

async function main() {
  console.log('📊 Staff 테이블 편차 수동 업데이트 (API 호출)\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const year = 2025
  const month = 10

  try {
    // auto-assign API 호출 (이미 배치된 상태에서 다시 호출하면 편차만 업데이트됨)
    const response = await fetch('http://localhost:3000/api/schedule/auto-assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        year,
        month,
        scheduleId: 'cmhgmfchh02zp12wjh3abc4ku'
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ API 호출 실패:', error)
      return
    }

    const result = await response.json()
    console.log('✅ API 호출 성공')
    console.log('결과:', JSON.stringify(result, null, 2))

  } catch (error) {
    console.error('❌ 오류:', error)
  }
}

main()
