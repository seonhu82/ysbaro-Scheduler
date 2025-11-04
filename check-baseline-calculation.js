/**
 * baseline 계산 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 baseline 계산 확인\n')

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

  // 실제 배치된 총 근무 슬롯 (OFF 제외)
  const totalActualAssignments = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      shiftType: { not: 'OFF' }
    }
  })

  // 진료실 직원 수
  const totalStaffInDepartment = await prisma.staff.count({
    where: {
      clinicId,
      departmentName: '진료실',
      isActive: true
    }
  })

  const baseline = totalActualAssignments / totalStaffInDepartment

  console.log(`총 근무 슬롯: ${totalActualAssignments}개`)
  console.log(`진료실 직원 수: ${totalStaffInDepartment}명`)
  console.log(`baseline: ${baseline.toFixed(2)}일`)

  // 개별 직원 actual 확인
  console.log('\n직원별 actual:')
  const staff = await prisma.staff.findMany({
    where: {
      clinicId,
      departmentName: '진료실',
      isActive: true
    },
    take: 5
  })

  for (const s of staff) {
    const actual = await prisma.staffAssignment.count({
      where: {
        staffId: s.id,
        scheduleId: schedule.id,
        shiftType: { not: 'OFF' }
      }
    })
    const deviation = 0 + baseline - actual
    console.log(`${s.name}: actual=${actual}, deviation=${deviation.toFixed(2)}`)
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
