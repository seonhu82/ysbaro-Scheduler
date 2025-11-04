/**
 * API를 통해 Staff 테이블 형평성 점수 업데이트
 */

async function updateStaffFairness() {
  console.log('📊 Staff 테이블 형평성 점수 업데이트 API 호출\n')

  try {
    const response = await fetch('http://localhost:3000/api/fairness/update-staff-scores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clinicId: 'cmh697itv0001fw83azbrqe60',
        year: 2025,
        month: 10
      })
    })

    const data = await response.json()

    if (data.success) {
      console.log('✅ 업데이트 성공!')
      console.log(`   업데이트된 직원 수: ${data.updatedCount}명`)
    } else {
      console.log('❌ 업데이트 실패:', data.error)
    }
  } catch (error) {
    console.error('❌ API 호출 오류:', error.message)
  }
}

updateStaffFairness()
