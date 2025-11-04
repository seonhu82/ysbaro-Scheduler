/**
 * 공정성 API 호출 테스트 (직원별 근무일수 통계)
 */

const fetch = require('node-fetch')

async function testFairnessAPI() {
  console.log('📊 공정성 API 호출 테스트\n')

  try {
    // 먼저 로그인
    const loginResponse = await fetch('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@ysbaro.com',
        password: 'admin123',
        redirect: false
      })
    })

    const cookies = loginResponse.headers.get('set-cookie')
    console.log('✅ 로그인 성공')

    // 직원별 근무일수 통계 API 호출
    const statsResponse = await fetch('http://localhost:3000/api/schedule/staff-stats?year=2025&month=10&status=CONFIRMED', {
      headers: {
        'Cookie': cookies
      }
    })

    const statsData = await statsResponse.json()

    if (!statsData.success) {
      console.log('❌ API 호출 실패:', statsData.error)
      return
    }

    console.log('\n📊 직원별 근무일수 통계 (처음 3명)\n')

    for (let i = 0; i < Math.min(3, statsData.data.stats.length); i++) {
      const staff = statsData.data.stats[i]
      console.log(`${staff.staffName} (${staff.categoryName})`)
      console.log(`  총근무일: ${staff.totalDays}일`)
      console.log(`  야간: ${staff.nightShiftDays}회`)
      console.log(`  주말: ${staff.weekendDays}회`)
      console.log(`  공휴일: ${staff.holidayDays}회`)

      if (staff.fairness) {
        console.log(`  편차:`)
        console.log(`    - 총근무일: ${staff.fairness.total?.deviation ?? 'N/A'}`)
        console.log(`    - 야간: ${staff.fairness.night?.deviation ?? 'N/A'}`)
        console.log(`    - 주말: ${staff.fairness.weekend?.deviation ?? 'N/A'}`)
        console.log(`    - 공휴일: ${staff.fairness.holiday?.deviation ?? 'N/A'}`)
      } else {
        console.log(`  ❌ fairness 데이터 없음`)
      }
      console.log()
    }

    // 전체 통계
    console.log(`\n✅ 총 ${statsData.data.stats.length}명의 직원 데이터`)

  } catch (error) {
    console.error('❌ 오류:', error.message)
  }
}

testFairnessAPI()
