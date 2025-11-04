/**
 * 월 경계 날짜가 편차에 미치는 영향 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('📊 월 경계 날짜 영향 확인\n')

  const scheduleId = 'cmhgmfchh02zp12wjh3abc4ku'

  // 1. 실제 배치 날짜 범위 (함수가 사용하는 방식)
  const dateRange = await prisma.staffAssignment.aggregate({
    where: { scheduleId },
    _min: { date: true },
    _max: { date: true }
  })

  const actualStartDate = dateRange._min.date
  const actualEndDate = dateRange._max.date

  console.log('📅 실제 배치 날짜 범위 (getActualDateRange):')
  console.log(`   ${actualStartDate.toISOString().split('T')[0]} ~ ${actualEndDate.toISOString().split('T')[0]}`)

  // 2. 월 범위
  const monthStartDate = new Date(2025, 9, 1)  // 2025-10-01
  const monthEndDate = new Date(2025, 9, 31, 23, 59, 59, 999)  // 2025-10-31

  console.log('\n📅 요청된 월 범위:')
  console.log(`   ${monthStartDate.toISOString().split('T')[0]} ~ ${monthEndDate.toISOString().split('T')[0]}`)

  // 3. 진료실 직원 수
  const totalStaff = await prisma.staff.count({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      departmentName: '진료실',
      isActive: true
    }
  })

  console.log(`\n👥 진료실 직원 수: ${totalStaff}명`)

  // 4. 실제 날짜 범위로 계산 (함수가 사용하는 방식)
  const totalActualWay = await prisma.staffAssignment.count({
    where: {
      scheduleId,
      date: { gte: actualStartDate, lte: actualEndDate },
      shiftType: { not: 'OFF' }
    }
  })

  const baselineActualWay = totalActualWay / totalStaff

  console.log(`\n📊 실제 날짜 범위 방식:`)
  console.log(`   총 슬롯: ${totalActualWay}`)
  console.log(`   baseline: ${baselineActualWay.toFixed(2)}`)

  // 5. 월 범위로 계산
  const totalMonthWay = await prisma.staffAssignment.count({
    where: {
      scheduleId,
      date: { gte: monthStartDate, lte: monthEndDate },
      shiftType: { not: 'OFF' }
    }
  })

  const baselineMonthWay = totalMonthWay / totalStaff

  console.log(`\n📊 월 범위 방식:`)
  console.log(`   총 슬롯: ${totalMonthWay}`)
  console.log(`   baseline: ${baselineMonthWay.toFixed(2)}`)

  // 6. 차이 계산
  const slotDiff = totalActualWay - totalMonthWay
  const baselineDiff = baselineActualWay - baselineMonthWay

  console.log(`\n📊 차이:`)
  console.log(`   슬롯 차이: ${slotDiff}개`)
  console.log(`   baseline 차이: ${baselineDiff.toFixed(2)}`)

  // 7. 월 경계 날짜의 배치 확인
  console.log(`\n📅 월 경계 날짜의 배치:`)

  const beforeMonthDates = ['2025-09-28', '2025-09-29']
  const afterMonthDates = ['2025-11-01']

  for (const dateStr of beforeMonthDates) {
    const count = await prisma.staffAssignment.count({
      where: {
        scheduleId,
        date: new Date(dateStr),
        shiftType: { not: 'OFF' }
      }
    })
    console.log(`   ${dateStr}: ${count}명`)
  }

  for (const dateStr of afterMonthDates) {
    const count = await prisma.staffAssignment.count({
      where: {
        scheduleId,
        date: new Date(dateStr),
        shiftType: { not: 'OFF' }
      }
    })
    console.log(`   ${dateStr}: ${count}명`)
  }

  // 8. 금환 직원으로 편차 계산
  const staff = await prisma.staff.findFirst({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      name: '금환',
      isActive: true
    }
  })

  if (staff) {
    // 실제 날짜 범위로 계산
    const actualCountActualWay = await prisma.staffAssignment.count({
      where: {
        scheduleId,
        staffId: staff.id,
        date: { gte: actualStartDate, lte: actualEndDate },
        shiftType: { not: 'OFF' }
      }
    })

    const deviationActualWay = 0 + baselineActualWay - actualCountActualWay

    console.log(`\n👤 금환 직원 (실제 날짜 범위):`)
    console.log(`   baseline: ${baselineActualWay.toFixed(2)}`)
    console.log(`   actual: ${actualCountActualWay}`)
    console.log(`   deviation: 0 + ${baselineActualWay.toFixed(2)} - ${actualCountActualWay} = ${deviationActualWay.toFixed(2)}`)

    // 월 범위로 계산
    const actualCountMonthWay = await prisma.staffAssignment.count({
      where: {
        scheduleId,
        staffId: staff.id,
        date: { gte: monthStartDate, lte: monthEndDate },
        shiftType: { not: 'OFF' }
      }
    })

    const deviationMonthWay = 0 + baselineMonthWay - actualCountMonthWay

    console.log(`\n👤 금환 직원 (월 범위):`)
    console.log(`   baseline: ${baselineMonthWay.toFixed(2)}`)
    console.log(`   actual: ${actualCountMonthWay}`)
    console.log(`   deviation: 0 + ${baselineMonthWay.toFixed(2)} - ${actualCountMonthWay} = ${deviationMonthWay.toFixed(2)}`)

    console.log(`\n   DB 저장값: ${staff.fairnessScoreTotalDays}`)
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
