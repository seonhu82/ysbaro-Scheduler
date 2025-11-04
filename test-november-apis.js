/**
 * 11월 API 테스트
 * 1. doctor-summary: weeksWithData가 [1] 포함하는지 확인
 * 2. staff-stats: 형평성 점수가 0이 아닌지 확인
 */

async function testNovemberAPIs() {
  console.log('\n🧪 11월 API 테스트 시작...\n')

  // 1. doctor-summary API 테스트
  console.log('📊 1. Doctor Summary API 테스트')
  try {
    const response = await fetch('http://localhost:3000/api/schedule/doctor-summary?year=2025&month=11')
    const data = await response.json()

    console.log('   Response:', {
      success: data.success,
      hasSchedule: data.hasSchedule,
      weeksWithData: data.weeksWithData,
      schedule: data.schedule
    })

    if (data.weeksWithData && data.weeksWithData.includes(1)) {
      console.log('   ✅ weeksWithData에 1주차 포함됨 (11/1 배포 데이터 감지)')
    } else {
      console.log('   ❌ weeksWithData에 1주차 없음:', data.weeksWithData)
    }
  } catch (error) {
    console.error('   ❌ Doctor Summary API 오류:', error.message)
  }

  console.log('\n📊 2. Staff Stats API 테스트 (10월 DEPLOYED)')
  try {
    const response = await fetch('http://localhost:3000/api/schedule/staff-stats?year=2025&month=10&status=DEPLOYED')
    const data = await response.json()

    if (data.success && data.stats && data.stats.length > 0) {
      const firstStaff = data.stats[0]
      console.log('   첫 번째 직원:', {
        name: firstStaff.staffName,
        totalDays: firstStaff.totalDays,
        fairness: firstStaff.fairness ? {
          totalScore: firstStaff.fairness.total?.score,
          totalActual: firstStaff.fairness.total?.actual,
          nightScore: firstStaff.fairness.night?.score,
          weekendScore: firstStaff.fairness.weekend?.score
        } : 'MISSING'
      })

      if (firstStaff.fairness && firstStaff.fairness.total) {
        console.log('   ✅ 형평성 점수 계산됨')
      } else {
        console.log('   ❌ 형평성 점수 없음')
      }

      // 상위 3명 확인
      console.log('\n   상위 3명 형평성 점수:')
      data.stats.slice(0, 3).forEach(staff => {
        console.log(`   - ${staff.staffName}: 총근무=${staff.totalDays}, 형평성점수=${staff.fairness?.total?.score || 'N/A'}`)
      })
    } else {
      console.log('   ❌ Stats 데이터 없음:', data)
    }
  } catch (error) {
    console.error('   ❌ Staff Stats API 오류:', error.message)
  }

  console.log('\n✅ 테스트 완료\n')
}

testNovemberAPIs()
