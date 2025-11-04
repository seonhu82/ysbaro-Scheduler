/**
 * StaffAssignment 상세 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 StaffAssignment 상세 확인\n')

  const scheduleId = 'cmhgmfchh02zp12wjh3abc4ku'

  // 한 명의 직원 배정 전체 확인
  const staff = await prisma.staff.findFirst({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      departmentName: '진료실',
      isActive: true,
      name: '금환'
    }
  })

  console.log(`직원: ${staff.name} (${staff.id})\n`)

  const assignments = await prisma.staffAssignment.findMany({
    where: {
      staffId: staff.id,
      scheduleId: scheduleId
    },
    orderBy: {
      date: 'asc'
    }
  })

  console.log(`총 배정: ${assignments.length}개\n`)

  const shiftTypes = {}
  for (const a of assignments) {
    shiftTypes[a.shiftType] = (shiftTypes[a.shiftType] || 0) + 1
  }

  console.log('ShiftType별 개수:')
  for (const [type, count] of Object.entries(shiftTypes)) {
    console.log(`  ${type}: ${count}개`)
  }

  console.log('\n처음 10개 배정:')
  console.log('날짜'.padEnd(15) + 'ShiftType')
  console.log('='.repeat(30))
  for (let i = 0; i < Math.min(10, assignments.length); i++) {
    const a = assignments[i]
    console.log(a.date.toISOString().split('T')[0].padEnd(15) + a.shiftType)
  }

  console.log('\nOFF가 아닌 것:', assignments.filter(a => a.shiftType !== 'OFF').length + '개')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
