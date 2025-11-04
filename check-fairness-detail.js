/**
 * 편차 상세 정보 확인 (기준, 실제, 편차)
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 편차 상세 정보 확인\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const year = 2025
  const month = 10

  const schedule = await prisma.schedule.findFirst({
    where: { clinicId, year, month }
  })

  if (!schedule) {
    console.log('❌ 스케줄 없음')
    return
  }

  // 전체 통계
  const totalActualAssignments = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      shiftType: { not: 'OFF' }
    }
  })

  const totalStaffInDepartment = await prisma.staff.count({
    where: {
      clinicId,
      departmentName: '진료실',
      isActive: true
    }
  })

  const baseline = totalActualAssignments / totalStaffInDepartment

  console.log(`📌 전체 통계:`)
  console.log(`   총 근무 슬롯: ${totalActualAssignments}개`)
  console.log(`   진료실 직원 수: ${totalStaffInDepartment}명`)
  console.log(`   기준(baseline): ${baseline.toFixed(2)}일\n`)

  // 직원별 상세
  const staffList = await prisma.staff.findMany({
    where: {
      clinicId,
      departmentName: '진료실',
      isActive: true
    },
    orderBy: {
      name: 'asc'
    }
  })

  console.log('이름'.padEnd(12) + '실제근무'.padEnd(12) + '기준'.padEnd(12) + '편차')
  console.log('='.repeat(60))

  for (const staff of staffList) {
    const actual = await prisma.staffAssignment.count({
      where: {
        staffId: staff.id,
        scheduleId: schedule.id,
        shiftType: { not: 'OFF' }
      }
    })

    const deviation = 0 + baseline - actual

    console.log(
      staff.name.padEnd(12) +
      (actual + '일').padEnd(12) +
      baseline.toFixed(2).padEnd(12) +
      deviation.toFixed(2)
    )
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
