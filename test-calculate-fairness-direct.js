/**
 * calculateStaffFairnessV2 직접 테스트
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 calculateStaffFairnessV2 직접 테스트\n')

  // 진료실 직원 한 명 선택
  const staff = await prisma.staff.findFirst({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      departmentName: '진료실',
      isActive: true
    }
  })

  if (!staff) {
    console.log('❌ 직원을 찾을 수 없습니다')
    return
  }

  console.log(`✅ 테스트 대상: ${staff.name}`)
  console.log(`   ID: ${staff.id}\n`)

  // 10월 스케줄 확인
  const schedule = await prisma.schedule.findFirst({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      year: 2025,
      month: 10
    }
  })

  console.log(`✅ 10월 스케줄 ID: ${schedule.id}`)
  console.log(`   previousMonthFairness 존재: ${schedule.previousMonthFairness ? 'Yes' : 'No'}`)

  if (schedule.previousMonthFairness) {
    const prevFairness = schedule.previousMonthFairness[staff.id]
    console.log(`   ${staff.name}의 전월 편차:`, prevFairness)
  }

  console.log('\n계산 중...\n')

  // 실제 근무일수 확인
  const actualDays = await prisma.staffAssignment.count({
    where: {
      staffId: staff.id,
      scheduleId: schedule.id,
      shiftType: { not: 'OFF' }
    }
  })

  console.log(`   실제 근무일: ${actualDays}일`)

  // TypeScript 함수를 CommonJS에서 호출할 수 없으므로
  // 대신 API를 통해 테스트하거나, 수동으로 계산 로직 확인

  console.log('\n⚠️  TypeScript 함수는 직접 호출할 수 없습니다.')
  console.log('   대신 서버 로그를 확인하거나 API를 통해 테스트하세요.')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
