/**
 * Baseline 슬롯 계산 확인 스크립트
 * - 1차배치와 2차배치 슬롯이 모두 포함되는지 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 Baseline 슬롯 계산 확인\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const year = 2025
  const month = 10

  // 1. Schedule 조회
  const schedule = await prisma.schedule.findFirst({
    where: {
      clinicId,
      year,
      month,
      status: { in: ['DRAFT', 'CONFIRMED', 'DEPLOYED'] }
    }
  })

  if (!schedule) {
    console.log('❌ Schedule을 찾을 수 없습니다')
    return
  }

  console.log(`✅ Schedule 찾음: ${schedule.id} (status: ${schedule.status})`)

  // 2. 실제 날짜 범위 (StaffAssignment에서 min/max)
  const dateRange = await prisma.staffAssignment.aggregate({
    where: { scheduleId: schedule.id },
    _min: { date: true },
    _max: { date: true }
  })

  const actualStartDate = dateRange._min.date
  const actualEndDate = dateRange._max.date

  console.log(`\n📅 실제 배치 날짜 범위:`)
  console.log(`   시작: ${actualStartDate.toISOString().split('T')[0]}`)
  console.log(`   종료: ${actualEndDate.toISOString().split('T')[0]}`)

  // 3. 요청된 월의 시작/종료 날짜
  const monthStartDate = new Date(year, month - 1, 1)
  const monthEndDate = new Date(year, month, 0, 23, 59, 59, 999)

  console.log(`\n📅 요청된 월 범위:`)
  console.log(`   시작: ${monthStartDate.toISOString().split('T')[0]}`)
  console.log(`   종료: ${monthEndDate.toISOString().split('T')[0]}`)

  // 4. 진료실 직원 수
  const totalStaffInDepartment = await prisma.staff.count({
    where: {
      clinicId,
      departmentName: '진료실',
      isActive: true
    }
  })

  console.log(`\n👥 진료실 직원 수: ${totalStaffInDepartment}명`)

  // 5. 실제 날짜 범위로 총 배치 슬롯 계산
  const totalActualAssignments = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { gte: actualStartDate, lte: actualEndDate },
      shiftType: { not: 'OFF' }
    }
  })

  console.log(`\n📊 총 배치 슬롯 (실제 날짜 범위):`)
  console.log(`   totalActualAssignments: ${totalActualAssignments}`)

  // 6. 월 범위로 총 배치 슬롯 계산
  const totalMonthAssignments = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { gte: monthStartDate, lte: monthEndDate },
      shiftType: { not: 'OFF' }
    }
  })

  console.log(`\n📊 총 배치 슬롯 (월 범위):`)
  console.log(`   totalMonthAssignments: ${totalMonthAssignments}`)

  // 7. 연차 슬롯
  const totalLeaveCount = await prisma.leaveApplication.count({
    where: {
      clinicId,
      leaveType: 'OFF',
      status: 'CONFIRMED',
      date: { gte: actualStartDate, lte: actualEndDate }
    }
  })

  console.log(`\n🏖️ 연차 슬롯: ${totalLeaveCount}`)

  // 8. Baseline 계산
  const totalActualSlots = totalActualAssignments + totalLeaveCount
  const baseline = totalStaffInDepartment > 0 ? totalActualSlots / totalStaffInDepartment : 0

  console.log(`\n📈 Baseline 계산:`)
  console.log(`   totalActualSlots = ${totalActualAssignments} + ${totalLeaveCount} = ${totalActualSlots}`)
  console.log(`   baseline = ${totalActualSlots} / ${totalStaffInDepartment} = ${baseline.toFixed(2)}`)

  // 9. 날짜별 배치 슬롯 수
  const assignmentsByDate = await prisma.staffAssignment.groupBy({
    by: ['date'],
    where: {
      scheduleId: schedule.id,
      shiftType: { not: 'OFF' }
    },
    _count: { id: true },
    orderBy: { date: 'asc' }
  })

  console.log(`\n📅 날짜별 배치 슬롯 수:`)
  assignmentsByDate.forEach(({ date, _count }) => {
    console.log(`   ${date.toISOString().split('T')[0]}: ${_count.id}명`)
  })

  // 10. 한 명의 직원 편차 확인 (금환)
  const staff = await prisma.staff.findFirst({
    where: {
      clinicId,
      name: '금환',
      isActive: true
    }
  })

  if (staff) {
    const staffActualCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: schedule.id,
        date: { gte: actualStartDate, lte: actualEndDate },
        staffId: staff.id,
        shiftType: { not: 'OFF' }
      }
    })

    const previousDeviation = schedule.previousMonthFairness?.[staff.id]?.total ?? 0
    const deviation = previousDeviation + baseline - staffActualCount

    console.log(`\n👤 금환 직원 편차:`)
    console.log(`   previousDeviation: ${previousDeviation}`)
    console.log(`   baseline: ${baseline.toFixed(2)}`)
    console.log(`   actual: ${staffActualCount}`)
    console.log(`   deviation = ${previousDeviation} + ${baseline.toFixed(2)} - ${staffActualCount} = ${deviation.toFixed(2)}`)

    console.log(`\n   DB에 저장된 편차: ${staff.fairnessScoreTotalDays}`)
  }

  console.log(`\n✅ 확인 완료`)
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
