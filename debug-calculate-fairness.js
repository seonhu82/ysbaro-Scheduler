/**
 * 편차 계산 로직 디버깅
 * fairness-calculator-v2의 로직을 그대로 재현
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 편차 계산 로직 디버깅\n')

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

  console.log(`✅ Schedule: ${schedule.id} (status: ${schedule.status})`)

  // 2. getActualDateRange 로직 재현
  const dateRange = await prisma.staffAssignment.aggregate({
    where: { scheduleId: schedule.id },
    _min: { date: true },
    _max: { date: true }
  })

  const doctorDateRange = await prisma.scheduleDoctor.aggregate({
    where: { scheduleId: schedule.id },
    _min: { date: true },
    _max: { date: true }
  })

  const minDate = dateRange._min.date || doctorDateRange._min.date || new Date(year, month - 1, 1)
  const maxDate = dateRange._max.date || doctorDateRange._max.date || new Date(year, month, 0)

  const startDate = minDate
  const endDate = maxDate

  console.log(`\n📅 계산 날짜 범위:`)
  console.log(`   ${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`)

  // 3. 진료실 직원 수
  const totalStaffInDepartment = await prisma.staff.count({
    where: {
      clinicId,
      departmentName: '진료실',
      isActive: true
    }
  })

  console.log(`\n👥 진료실 직원 수: ${totalStaffInDepartment}명`)

  // 4. totalActualAssignments 계산
  const totalActualAssignments = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { gte: startDate, lte: endDate },
      shiftType: { not: 'OFF' }
    }
  })

  console.log(`\n📊 totalActualAssignments: ${totalActualAssignments}`)

  // 5. totalLeaveCount 계산
  const totalLeaveCount = await prisma.leaveApplication.count({
    where: {
      clinicId,
      leaveType: 'OFF',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate }
    }
  })

  console.log(`📊 totalLeaveCount: ${totalLeaveCount}`)

  // 6. Baseline 계산
  const totalActualSlots = totalActualAssignments + totalLeaveCount
  const baseline = totalStaffInDepartment > 0 ? totalActualSlots / totalStaffInDepartment : 0

  console.log(`\n📈 Baseline 계산:`)
  console.log(`   totalActualSlots = ${totalActualAssignments} + ${totalLeaveCount} = ${totalActualSlots}`)
  console.log(`   baseline = ${totalActualSlots} / ${totalStaffInDepartment} = ${baseline.toFixed(2)}`)

  // 7. 금환 직원 데이터
  const staff = await prisma.staff.findFirst({
    where: {
      clinicId,
      name: '금환',
      isActive: true
    }
  })

  if (!staff) {
    console.log('\n❌ 금환 직원을 찾을 수 없습니다')
    return
  }

  console.log(`\n👤 금환 직원: ${staff.id}`)

  // 8. 금환의 실제 근무
  const actualAssignments = await prisma.staffAssignment.count({
    where: {
      staffId: staff.id,
      scheduleId: schedule.id,
      date: { gte: startDate, lte: endDate },
      shiftType: { not: 'OFF' }
    }
  })

  const leaveCount = await prisma.leaveApplication.count({
    where: {
      staffId: staff.id,
      clinicId,
      leaveType: 'OFF',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate }
    }
  })

  const actual = actualAssignments + leaveCount

  console.log(`   actualAssignments: ${actualAssignments}`)
  console.log(`   leaveCount: ${leaveCount}`)
  console.log(`   actual = ${actualAssignments} + ${leaveCount} = ${actual}`)

  // 9. 전월 편차
  const previousMonthFairness = (schedule.previousMonthFairness || {})
  const previousDeviation = previousMonthFairness[staff.id]?.total ?? 0

  console.log(`\n📊 전월 편차:`)
  console.log(`   previousDeviation: ${previousDeviation}`)

  // 10. 편차 계산
  const deviation = previousDeviation + baseline - actual

  console.log(`\n📈 편차 계산:`)
  console.log(`   deviation = ${previousDeviation} + ${baseline.toFixed(2)} - ${actual}`)
  console.log(`   deviation = ${deviation.toFixed(2)}`)

  console.log(`\n💾 DB 저장값: ${staff.fairnessScoreTotalDays}`)

  // 11. 왜 다른지 분석
  if (Math.abs(deviation - staff.fairnessScoreTotalDays) > 0.01) {
    console.log(`\n⚠️  차이 발생! 계산=${deviation.toFixed(2)}, DB=${staff.fairnessScoreTotalDays}`)
    console.log(`   차이=${(deviation - staff.fairnessScoreTotalDays).toFixed(2)}`)
  } else {
    console.log(`\n✅ 계산과 DB값이 일치합니다`)
  }

  console.log(`\n✅ 디버깅 완료`)
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
