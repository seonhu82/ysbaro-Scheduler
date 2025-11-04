/**
 * 모든 직원의 raw deviation과 평균 편차 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 모든 직원의 raw deviation 확인\n')

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

  // 2. 날짜 범위
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

  console.log(`📅 계산 날짜 범위: ${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`)

  // 3. 진료실 직원 수
  const totalStaffInDepartment = await prisma.staff.count({
    where: {
      clinicId,
      departmentName: '진료실',
      isActive: true
    }
  })

  // 4. Baseline 계산
  const totalActualAssignments = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      date: { gte: startDate, lte: endDate },
      shiftType: { not: 'OFF' }
    }
  })

  const totalLeaveCount = await prisma.leaveApplication.count({
    where: {
      clinicId,
      leaveType: 'OFF',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate }
    }
  })

  const totalActualSlots = totalActualAssignments + totalLeaveCount
  const baseline = totalStaffInDepartment > 0 ? totalActualSlots / totalStaffInDepartment : 0

  console.log(`📊 Baseline: ${baseline.toFixed(2)}\n`)

  // 5. 모든 직원 조회
  const staffList = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      departmentName: true,
      fairnessScoreTotalDays: true
    },
    orderBy: {
      name: 'asc'
    }
  })

  // 6. 각 직원의 raw deviation 계산
  const rawDeviations = []

  console.log('직원별 계산:')
  console.log('----------------------------------------')

  for (const staff of staffList) {
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

    const previousDeviation = schedule.previousMonthFairness?.[staff.id]?.total ?? 0
    const rawDeviation = previousDeviation + baseline - actual

    rawDeviations.push(rawDeviation)

    console.log(
      `${staff.name.padEnd(6)} (${staff.departmentName.padEnd(6)}): ` +
      `prev=${previousDeviation.toFixed(2)}, baseline=${baseline.toFixed(2)}, actual=${actual}, ` +
      `raw=${rawDeviation.toFixed(2)}, DB=${staff.fairnessScoreTotalDays}`
    )
  }

  // 7. 평균 계산
  const avgDeviation = rawDeviations.reduce((sum, d) => sum + d, 0) / rawDeviations.length

  console.log('\n========================================')
  console.log(`평균 raw deviation: ${avgDeviation.toFixed(2)}`)

  // 8. 조정 후 값 계산 (진료실만)
  console.log('\n진료실 직원 조정 후:')
  console.log('----------------------------------------')

  const treatmentStaff = staffList.filter(s => s.departmentName === '진료실')
  const treatmentRawDeviations = []

  for (const staff of treatmentStaff) {
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
    const previousDeviation = schedule.previousMonthFairness?.[staff.id]?.total ?? 0
    const rawDeviation = previousDeviation + baseline - actual

    treatmentRawDeviations.push(rawDeviation)
  }

  const treatmentAvg = treatmentRawDeviations.reduce((sum, d) => sum + d, 0) / treatmentRawDeviations.length

  console.log(`진료실 평균 raw deviation: ${treatmentAvg.toFixed(2)}`)

  for (const staff of treatmentStaff) {
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
    const previousDeviation = schedule.previousMonthFairness?.[staff.id]?.total ?? 0
    const rawDeviation = previousDeviation + baseline - actual
    const adjustedDeviation = Math.round((rawDeviation - treatmentAvg) * 10) / 10

    console.log(
      `${staff.name.padEnd(6)}: raw=${rawDeviation.toFixed(2)}, ` +
      `adjusted=${adjustedDeviation.toFixed(2)}, DB=${staff.fairnessScoreTotalDays}`
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
