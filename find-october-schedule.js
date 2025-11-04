/**
 * 10월 스케줄 모두 찾기
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 10월 스케줄 찾기\n')

  const schedules = await prisma.schedule.findMany({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      year: 2025,
      month: 10
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  console.log(`총 ${schedules.length}개의 10월 스케줄 발견:\n`)

  for (const schedule of schedules) {
    console.log(`ID: ${schedule.id}`)
    console.log(`  상태: ${schedule.status}`)
    console.log(`  생성일: ${schedule.createdAt}`)
    console.log(`  배포일: ${schedule.deployedAt || 'N/A'}`)

    // 이 스케줄의 배정 수 확인
    const assignmentCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id
      }
    })

    console.log(`  배정 수: ${assignmentCount}개`)

    // 근무일수 샘플 확인
    if (assignmentCount > 0) {
      const sample = await prisma.$queryRaw`
        SELECT s.name, COUNT(*) as work_days
        FROM "StaffAssignment" sa
        JOIN "Staff" s ON s.id = sa."staffId"
        WHERE sa."scheduleId" = ${schedule.id}
          AND sa."shiftType" != 'OFF'
          AND s."departmentName" = '진료실'
        GROUP BY s.name
        ORDER BY s.name
        LIMIT 5
      `

      console.log('  샘플 근무일수:')
      for (const row of sample) {
        console.log(`    ${row.name}: ${row.work_days}일`)
      }
    }

    console.log()
  }
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
