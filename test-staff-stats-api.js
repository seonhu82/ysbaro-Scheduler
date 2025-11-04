/**
 * staff-stats API 응답 확인
 */

async function main() {
  console.log('📊 staff-stats API 응답 확인\n')

  try {
    const response = await fetch('http://localhost:3000/api/schedule/staff-stats?year=2025&month=10&status=CONFIRMED')

    if (!response.ok) {
      console.log('❌ API 호출 실패:', response.status, response.statusText)
      return
    }

    const data = await response.json()

    console.log('전체 응답 구조:')
    console.log('- success:', data.success)
    console.log('- stats 개수:', data.data?.stats?.length || 0)
    console.log('- enabledDimensions:', JSON.stringify(data.data?.enabledDimensions, null, 2))

    console.log('\n처음 5명의 편차 데이터:')
    console.log('='.repeat(100))

    const stats = data.data?.stats || []
    for (let i = 0; i < Math.min(5, stats.length); i++) {
      const stat = stats[i]
      console.log(`\n[${stat.staffName}] (${stat.categoryName})`)
      console.log(`  총근무: ${stat.totalDays}일`)
      console.log(`  야간: ${stat.nightShiftDays}일`)
      console.log(`  주말: ${stat.weekendDays}일`)
      console.log(`  공휴일: ${stat.holidayDays}일`)
      console.log(`  편차 - 총근무: ${stat.fairness?.total?.deviation}`)
      console.log(`  편차 - 야간: ${stat.fairness?.night?.deviation}`)
      console.log(`  편차 - 주말: ${stat.fairness?.weekend?.deviation}`)
      console.log(`  편차 - 공휴일: ${stat.fairness?.holiday?.deviation}`)
      console.log(`  편차 - 공휴일전후: ${stat.fairness?.holidayAdjacent?.deviation}`)
    }

    // -16, -6.6, -3.4 같은 값 찾기
    console.log('\n\n특이 값 검색:')
    console.log('='.repeat(100))

    const unusual = stats.filter(s => {
      const f = s.fairness || {}
      return Math.abs(f.total?.deviation || 0) > 5 ||
             Math.abs(f.night?.deviation || 0) > 5 ||
             Math.abs(f.weekend?.deviation || 0) > 5 ||
             Math.abs(f.holiday?.deviation || 0) > 5 ||
             Math.abs(f.holidayAdjacent?.deviation || 0) > 5
    })

    if (unusual.length > 0) {
      console.log(`\n절댓값 5 이상인 편차: ${unusual.length}명`)
      for (const stat of unusual) {
        const f = stat.fairness || {}
        console.log(`\n[${stat.staffName}]`)
        console.log(`  총근무 편차: ${f.total?.deviation}`)
        console.log(`  야간 편차: ${f.night?.deviation}`)
        console.log(`  주말 편차: ${f.weekend?.deviation}`)
        console.log(`  공휴일 편차: ${f.holiday?.deviation}`)
        console.log(`  공휴일전후 편차: ${f.holidayAdjacent?.deviation}`)
      }
    } else {
      console.log('절댓값 5 이상인 편차가 없습니다.')
    }

    console.log('\n✅ 확인 완료')
  } catch (error) {
    console.error('❌ 오류:', error.message)
  }
}

main()
