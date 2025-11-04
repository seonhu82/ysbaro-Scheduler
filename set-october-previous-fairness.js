/**
 * 10월 스케줄에 9월 전월 편차(0) 설정
 *
 * 9월은 첫 달이므로 전월 편차가 모두 0이어야 함
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 10월 스케줄에 9월 전월 편차(0) 설정\n')

  // 1. 10월 스케줄 조회
  const schedule = await prisma.schedule.findFirst({
    where: {
      year: 2025,
      month: 10
    }
  })

  if (!schedule) {
    console.log('❌ 10월 스케줄을 찾을 수 없습니다')
    return
  }

  console.log(`✅ 10월 스케줄 찾음: ${schedule.id}`)

  // 2. 모든 활성화된 직원 조회
  const staffList = await prisma.staff.findMany({
    where: {
      clinicId: schedule.clinicId,
      isActive: true
    },
    select: {
      id: true,
      name: true
    }
  })

  console.log(`✅ 활성화된 직원: ${staffList.length}명\n`)

  // 3. 전월 편차 객체 생성 (모두 0)
  const previousMonthFairness = {}
  for (const staff of staffList) {
    previousMonthFairness[staff.id] = {
      total: 0,
      night: 0,
      weekend: 0,
      holiday: 0,
      holidayAdjacent: 0
    }
    console.log(`   ${staff.name}: 전월편차 모두 0으로 설정`)
  }

  // 4. Schedule 테이블 업데이트
  await prisma.schedule.update({
    where: { id: schedule.id },
    data: {
      previousMonthFairness: previousMonthFairness
    }
  })

  console.log(`\n✅ 10월 스케줄에 전월 편차(9월) 설정 완료`)
  console.log(`   → ${staffList.length}명의 직원 전월 편차 = 0`)
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
