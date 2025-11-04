/**
 * Staff 테이블 형평성 업데이트 테스트
 * 자동 배치 후 Staff 테이블의 편차값이 올바르게 저장되는지 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 Staff 테이블 형평성 업데이트 테스트\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const year = 2025
  const month = 10

  // 1. 스케줄 확인
  const schedule = await prisma.schedule.findFirst({
    where: {
      clinicId,
      year,
      month
    }
  })

  if (!schedule) {
    console.log('❌ 10월 스케줄을 찾을 수 없습니다')
    return
  }

  console.log(`✅ 스케줄 ID: ${schedule.id}`)
  console.log(`   상태: ${schedule.status}`)
  console.log(`   previousMonthFairness 존재: ${schedule.previousMonthFairness ? 'Yes' : 'No'}\n`)

  // 2. 진료실 직원 3명의 편차 확인
  const staffList = await prisma.staff.findMany({
    where: {
      clinicId,
      departmentName: '진료실',
      isActive: true
    },
    select: {
      id: true,
      name: true,
      fairnessScoreTotalDays: true,
      fairnessScoreNight: true,
      fairnessScoreWeekend: true,
      fairnessScoreHoliday: true,
      fairnessScoreHolidayAdjacent: true
    },
    orderBy: {
      name: 'asc'
    },
    take: 5
  })

  console.log('📌 Staff 테이블 편차 데이터 (처음 5명):\n')
  console.log('이름'.padEnd(15) + '총근무일'.padEnd(12) + '야간'.padEnd(12) + '주말'.padEnd(12) + '공휴일')
  console.log('='.repeat(60))

  for (const staff of staffList) {
    console.log(
      staff.name.padEnd(15) +
      staff.fairnessScoreTotalDays.toFixed(2).padEnd(12) +
      staff.fairnessScoreNight.toFixed(2).padEnd(12) +
      staff.fairnessScoreWeekend.toFixed(2).padEnd(12) +
      staff.fairnessScoreHoliday.toFixed(2)
    )
  }

  // 3. 실제 배정 근무일수 확인
  console.log('\n📌 실제 배정 근무일수:\n')
  console.log('이름'.padEnd(15) + '근무일')
  console.log('='.repeat(30))

  for (const staff of staffList) {
    const workDays = await prisma.staffAssignment.count({
      where: {
        staffId: staff.id,
        scheduleId: schedule.id,
        shiftType: { not: 'OFF' }
      }
    })
    console.log(staff.name.padEnd(15) + workDays + '일')
  }

  console.log('\n✅ 테스트 완료')
  console.log('\n💡 기대 결과:')
  console.log('   - 같은 근무일수를 가진 직원들은 비슷한 편차를 가져야 합니다')
  console.log('   - 편차가 모두 0이 아니어야 합니다 (배정이 완료되었다면)')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
