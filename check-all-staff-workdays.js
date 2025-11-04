/**
 * 전체 직원 실제 근무일수 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 10월 전체 직원 근무일수 확인\n')

  const scheduleId = 'cmhgmfchh02zp12wjh3abc4ku'

  const staffList = await prisma.staff.findMany({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      isActive: true
    },
    select: {
      id: true,
      name: true,
      departmentName: true,
      fairnessScoreTotalDays: true
    },
    orderBy: [
      { departmentName: 'asc' },
      { name: 'asc' }
    ]
  })

  console.log('부서'.padEnd(15) + '이름'.padEnd(12) + '근무일'.padEnd(10) + 'Staff편차')
  console.log('='.repeat(60))

  const workDayGroups = {}

  for (const staff of staffList) {
    const workDays = await prisma.staffAssignment.count({
      where: {
        staffId: staff.id,
        scheduleId: scheduleId,
        shiftType: { not: 'OFF' }
      }
    })

    console.log(
      staff.departmentName.padEnd(15) +
      staff.name.padEnd(12) +
      (workDays + '일').padEnd(10) +
      staff.fairnessScoreTotalDays.toFixed(2)
    )

    if (!workDayGroups[workDays]) {
      workDayGroups[workDays] = []
    }
    workDayGroups[workDays].push(staff.name)
  }

  console.log('\n📊 근무일수별 그룹:')
  console.log('='.repeat(60))
  for (const [days, names] of Object.entries(workDayGroups).sort((a, b) => b[0] - a[0])) {
    console.log(`${days}일: ${names.length}명 - ${names.join(', ')}`)
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
