/**
 * Staff 테이블의 실제 편차 값 확인 (raw data)
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 Staff 테이블 실제 데이터 확인\n')

  const staffList = await prisma.staff.findMany({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      departmentName: '진료실',
      isActive: true
    },
    select: {
      id: true,
      name: true,
      categoryName: true,
      fairnessScoreTotalDays: true,
      fairnessScoreNight: true,
      fairnessScoreWeekend: true,
      fairnessScoreHoliday: true,
      fairnessScoreHolidayAdjacent: true
    },
    orderBy: {
      name: 'asc'
    }
  })

  console.log('전체 직원 수:', staffList.length)
  console.log('\n상세 데이터:')
  console.log('='.repeat(100))

  for (const staff of staffList) {
    console.log(`\n[${staff.name}] (${staff.categoryName})`)
    console.log(`  ID: ${staff.id}`)
    console.log(`  총근무 편차: ${staff.fairnessScoreTotalDays}`)
    console.log(`  야간 편차: ${staff.fairnessScoreNight}`)
    console.log(`  주말 편차: ${staff.fairnessScoreWeekend}`)
    console.log(`  공휴일 편차: ${staff.fairnessScoreHoliday}`)
    console.log(`  공휴일전후 편차: ${staff.fairnessScoreHolidayAdjacent}`)
  }

  // -16, -6.6, -3.4 같은 값 찾기
  console.log('\n\n특이 값 검색:')
  console.log('='.repeat(100))

  const unusual = staffList.filter(s =>
    Math.abs(s.fairnessScoreTotalDays) > 5 ||
    Math.abs(s.fairnessScoreNight) > 5 ||
    Math.abs(s.fairnessScoreWeekend) > 5 ||
    Math.abs(s.fairnessScoreHoliday) > 5 ||
    Math.abs(s.fairnessScoreHolidayAdjacent) > 5
  )

  if (unusual.length > 0) {
    console.log(`\n절댓값 5 이상인 편차를 가진 직원: ${unusual.length}명`)
    for (const staff of unusual) {
      console.log(`\n[${staff.name}]`)
      console.log(`  총근무: ${staff.fairnessScoreTotalDays}`)
      console.log(`  야간: ${staff.fairnessScoreNight}`)
      console.log(`  주말: ${staff.fairnessScoreWeekend}`)
      console.log(`  공휴일: ${staff.fairnessScoreHoliday}`)
      console.log(`  공휴일전후: ${staff.fairnessScoreHolidayAdjacent}`)
    }
  } else {
    console.log('절댓값 5 이상인 편차를 가진 직원이 없습니다.')
  }

  console.log('\n✅ 확인 완료')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
