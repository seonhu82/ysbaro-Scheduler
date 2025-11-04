/**
 * 10월만 근무일수 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 10월(1일~31일)만 근무일수 확인\n')

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
      fairnessScoreTotalDays: true
    },
    orderBy: {
      name: 'asc'
    }
  })

  console.log('이름'.padEnd(12) + '10월근무일'.padEnd(12) + 'Staff편차')
  console.log('='.repeat(40))

  for (const staff of staffList) {
    const octoberWorkDays = await prisma.staffAssignment.count({
      where: {
        staffId: staff.id,
        scheduleId: scheduleId,
        shiftType: { not: 'OFF' },
        date: {
          gte: new Date('2025-10-01'),
          lte: new Date('2025-10-31')
        }
      }
    })

    console.log(
      staff.name.padEnd(12) +
      (octoberWorkDays + '일').padEnd(12) +
      staff.fairnessScoreTotalDays.toFixed(2)
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
