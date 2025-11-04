/**
 * 실제 근무일수와 편차 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 10월 실제 근무일수와 Staff 테이블 편차 확인\n')

  const scheduleId = 'cmhgmfchh02zp12wjh3abc4ku'

  const staffList = await prisma.staff.findMany({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      departmentName: '진료실',
      isActive: true
    },
    select: {
      id: true,
      name: true,
      fairnessScoreTotalDays: true,
      fairnessScoreNight: true,
      fairnessScoreWeekend: true
    },
    orderBy: {
      name: 'asc'
    }
  })

  console.log('이름'.padEnd(12) + '근무일'.padEnd(10) + '편차(총)'.padEnd(12) + '편차(야)'.padEnd(12) + '편차(주)')
  console.log('='.repeat(70))

  for (const staff of staffList) {
    const workDays = await prisma.staffAssignment.count({
      where: {
        staffId: staff.id,
        scheduleId: scheduleId,
        shiftType: { not: 'OFF' }
      }
    })

    const nightCount = await prisma.staffAssignment.count({
      where: {
        staffId: staff.id,
        scheduleId: scheduleId,
        shiftType: 'NIGHT'
      }
    })

    const weekendCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "StaffAssignment" sa
      WHERE sa."staffId" = ${staff.id}
        AND sa."scheduleId" = ${scheduleId}
        AND sa."shiftType" != 'OFF'
        AND EXTRACT(DOW FROM sa."date") IN (0, 6)
    `

    console.log(
      staff.name.padEnd(12) +
      (workDays + '일').padEnd(10) +
      staff.fairnessScoreTotalDays.toFixed(2).padEnd(12) +
      staff.fairnessScoreNight.toFixed(2).padEnd(12) +
      staff.fairnessScoreWeekend.toFixed(2)
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
