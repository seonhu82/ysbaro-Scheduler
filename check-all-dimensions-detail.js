/**
 * 모든 차원의 기준, 실제, 편차 상세 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 모든 차원 상세 정보 확인\n')

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

  // 진료실 직원 수
  const totalStaffInDepartment = await prisma.staff.count({
    where: {
      clinicId,
      departmentName: '진료실',
      isActive: true
    }
  })

  // 공휴일 조회
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)
  const holidays = await prisma.holiday.findMany({
    where: {
      clinicId,
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  })

  const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))

  // 1. 총 근무일수
  const totalActualSlots = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      shiftType: { not: 'OFF' }
    }
  })
  const totalBaseline = totalActualSlots / totalStaffInDepartment

  console.log('=' .repeat(80))
  console.log('📌 총 근무일수')
  console.log('=' .repeat(80))
  console.log(`총 근무 슬롯: ${totalActualSlots}개`)
  console.log(`진료실 직원 수: ${totalStaffInDepartment}명`)
  console.log(`기준(baseline): ${totalBaseline.toFixed(2)}일\n`)

  // 2. 야간 근무
  const nightActualSlots = await prisma.staffAssignment.count({
    where: {
      scheduleId: schedule.id,
      shiftType: 'NIGHT'
    }
  })
  const nightBaseline = nightActualSlots / totalStaffInDepartment

  console.log('=' .repeat(80))
  console.log('🌙 야간 근무')
  console.log('=' .repeat(80))
  console.log(`총 야간 슬롯: ${nightActualSlots}개`)
  console.log(`진료실 직원 수: ${totalStaffInDepartment}명`)
  console.log(`기준(baseline): ${nightBaseline.toFixed(2)}일\n`)

  // 3. 주말 근무
  const allAssignments = await prisma.staffAssignment.findMany({
    where: {
      scheduleId: schedule.id,
      shiftType: { not: 'OFF' }
    }
  })

  const weekendAssignments = allAssignments.filter(a => {
    const day = new Date(a.date).getDay()
    return day === 0 || day === 6
  })
  const weekendActualSlots = weekendAssignments.length
  const weekendBaseline = weekendActualSlots / totalStaffInDepartment

  console.log('=' .repeat(80))
  console.log('📅 주말 근무')
  console.log('=' .repeat(80))
  console.log(`총 주말 슬롯: ${weekendActualSlots}개`)
  console.log(`진료실 직원 수: ${totalStaffInDepartment}명`)
  console.log(`기준(baseline): ${weekendBaseline.toFixed(2)}일\n`)

  // 4. 공휴일 근무
  const holidayAssignments = allAssignments.filter(a => {
    const dateKey = new Date(a.date).toISOString().split('T')[0]
    return holidayDates.has(dateKey)
  })
  const holidayActualSlots = holidayAssignments.length
  const holidayBaseline = holidayActualSlots / totalStaffInDepartment

  console.log('=' .repeat(80))
  console.log('🎉 공휴일 근무')
  console.log('=' .repeat(80))
  console.log(`총 공휴일 슬롯: ${holidayActualSlots}개`)
  console.log(`진료실 직원 수: ${totalStaffInDepartment}명`)
  console.log(`기준(baseline): ${holidayBaseline.toFixed(2)}일\n`)

  // 5. 공휴일 전후 근무
  const holidayAdjacentAssignments = allAssignments.filter(a => {
    const assignmentDate = new Date(a.date)
    const dateKey = assignmentDate.toISOString().split('T')[0]

    // 공휴일 당일은 제외
    if (holidayDates.has(dateKey)) return false

    // 전날 또는 다음날이 공휴일인지 확인
    const prevDay = new Date(assignmentDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const nextDay = new Date(assignmentDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    return holidayDates.has(prevDay) || holidayDates.has(nextDay)
  })
  const holidayAdjacentActualSlots = holidayAdjacentAssignments.length
  const holidayAdjacentBaseline = holidayAdjacentActualSlots / totalStaffInDepartment

  console.log('=' .repeat(80))
  console.log('📌 공휴일 전후 근무')
  console.log('=' .repeat(80))
  console.log(`총 공휴일 전후 슬롯: ${holidayAdjacentActualSlots}개`)
  console.log(`진료실 직원 수: ${totalStaffInDepartment}명`)
  console.log(`기준(baseline): ${holidayAdjacentBaseline.toFixed(2)}일\n`)

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

  console.log('\n' + '=' .repeat(80))
  console.log('👥 직원별 상세 (처음 5명)')
  console.log('=' .repeat(80))
  console.log(
    '이름'.padEnd(12) +
    '총근무'.padEnd(10) +
    '야간'.padEnd(10) +
    '주말'.padEnd(10) +
    '공휴일'.padEnd(10) +
    '공휴일전후'
  )
  console.log('-'.repeat(80))

  for (const staff of staffList.slice(0, 5)) {
    // 총 근무
    const totalActual = await prisma.staffAssignment.count({
      where: {
        staffId: staff.id,
        scheduleId: schedule.id,
        shiftType: { not: 'OFF' }
      }
    })

    // 야간
    const nightActual = await prisma.staffAssignment.count({
      where: {
        staffId: staff.id,
        scheduleId: schedule.id,
        shiftType: 'NIGHT'
      }
    })

    // 주말
    const staffAssignments = await prisma.staffAssignment.findMany({
      where: {
        staffId: staff.id,
        scheduleId: schedule.id,
        shiftType: { not: 'OFF' }
      }
    })

    const weekendActual = staffAssignments.filter(a => {
      const day = new Date(a.date).getDay()
      return day === 0 || day === 6
    }).length

    // 공휴일
    const holidayActual = staffAssignments.filter(a => {
      const dateKey = new Date(a.date).toISOString().split('T')[0]
      return holidayDates.has(dateKey)
    }).length

    // 공휴일 전후
    const holidayAdjacentActual = staffAssignments.filter(a => {
      const assignmentDate = new Date(a.date)
      const dateKey = assignmentDate.toISOString().split('T')[0]

      if (holidayDates.has(dateKey)) return false

      const prevDay = new Date(assignmentDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const nextDay = new Date(assignmentDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      return holidayDates.has(prevDay) || holidayDates.has(nextDay)
    }).length

    console.log(
      staff.name.padEnd(12) +
      `${totalActual}일`.padEnd(10) +
      `${nightActual}일`.padEnd(10) +
      `${weekendActual}일`.padEnd(10) +
      `${holidayActual}일`.padEnd(10) +
      `${holidayAdjacentActual}일`
    )
  }

  console.log('\n' + '=' .repeat(80))
  console.log('📊 편차 계산 (처음 5명)')
  console.log('=' .repeat(80))
  console.log(
    '이름'.padEnd(12) +
    '총근무편차'.padEnd(12) +
    '야간편차'.padEnd(12) +
    '주말편차'.padEnd(12) +
    '공휴일편차'.padEnd(12) +
    '전후편차'
  )
  console.log('-'.repeat(80))

  for (const staff of staffList.slice(0, 5)) {
    // 총 근무
    const totalActual = await prisma.staffAssignment.count({
      where: {
        staffId: staff.id,
        scheduleId: schedule.id,
        shiftType: { not: 'OFF' }
      }
    })
    const totalDeviation = 0 + totalBaseline - totalActual

    // 야간
    const nightActual = await prisma.staffAssignment.count({
      where: {
        staffId: staff.id,
        scheduleId: schedule.id,
        shiftType: 'NIGHT'
      }
    })
    const nightDeviation = 0 + nightBaseline - nightActual

    // 주말
    const staffAssignments = await prisma.staffAssignment.findMany({
      where: {
        staffId: staff.id,
        scheduleId: schedule.id,
        shiftType: { not: 'OFF' }
      }
    })

    const weekendActual = staffAssignments.filter(a => {
      const day = new Date(a.date).getDay()
      return day === 0 || day === 6
    }).length
    const weekendDeviation = 0 + weekendBaseline - weekendActual

    // 공휴일
    const holidayActual = staffAssignments.filter(a => {
      const dateKey = new Date(a.date).toISOString().split('T')[0]
      return holidayDates.has(dateKey)
    }).length
    const holidayDeviation = 0 + holidayBaseline - holidayActual

    // 공휴일 전후
    const holidayAdjacentActual = staffAssignments.filter(a => {
      const assignmentDate = new Date(a.date)
      const dateKey = assignmentDate.toISOString().split('T')[0]

      if (holidayDates.has(dateKey)) return false

      const prevDay = new Date(assignmentDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const nextDay = new Date(assignmentDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      return holidayDates.has(prevDay) || holidayDates.has(nextDay)
    }).length
    const holidayAdjacentDeviation = 0 + holidayAdjacentBaseline - holidayAdjacentActual

    console.log(
      staff.name.padEnd(12) +
      totalDeviation.toFixed(2).padEnd(12) +
      nightDeviation.toFixed(2).padEnd(12) +
      weekendDeviation.toFixed(2).padEnd(12) +
      holidayDeviation.toFixed(2).padEnd(12) +
      holidayAdjacentDeviation.toFixed(2)
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
