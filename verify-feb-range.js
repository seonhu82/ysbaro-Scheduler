const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function verifyFebAutoAssignRange() {
  console.log('=== 2월 자동 배정 범위 검증 ===\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'

  // 2월 DRAFT 스케줄 조회
  const febSchedule = await prisma.schedule.findFirst({
    where: {
      clinicId,
      year: 2025,
      month: 2,
      status: 'DRAFT'
    },
    include: {
      doctors: {
        orderBy: {
          date: 'asc'
        }
      }
    }
  })

  if (!febSchedule) {
    console.log('❌ 2월 DRAFT 스케줄 없음')
    await prisma.$disconnect()
    return
  }

  console.log('📋 2월 DRAFT 스케줄 ID:', febSchedule.id)
  console.log('   doctors 수:', febSchedule.doctors.length)
  console.log()

  // 원장 스케줄 범위 계산 (auto-assign 로직 복제)
  const doctorDates = febSchedule.doctors.map(d => new Date(d.date))
  const scheduleMinDate = new Date(Math.min(...doctorDates.map(d => d.getTime())))
  const scheduleMaxDate = new Date(Math.max(...doctorDates.map(d => d.getTime())))

  console.log('📅 2월 원장 스케줄 범위:')
  console.log('   scheduleMinDate:', scheduleMinDate.toISOString().split('T')[0])
  console.log('   scheduleMaxDate:', scheduleMaxDate.toISOString().split('T')[0])
  console.log()

  // 주차 기준 확장 (auto-assign 로직)
  const firstDayOfWeek = scheduleMinDate.getDay()
  const firstWeekSunday = new Date(scheduleMinDate)
  firstWeekSunday.setDate(scheduleMinDate.getDate() - firstDayOfWeek)

  const lastDayOfWeek = scheduleMaxDate.getDay()
  const lastWeekSaturday = new Date(scheduleMaxDate)
  lastWeekSaturday.setDate(scheduleMaxDate.getDate() + (6 - lastDayOfWeek))

  console.log('🔄 주차 확장 범위:')
  console.log('   firstWeekSunday:', firstWeekSunday.toISOString().split('T')[0], `(${['일','월','화','수','목','금','토'][firstWeekSunday.getDay()]})`)
  console.log('   lastWeekSaturday:', lastWeekSaturday.toISOString().split('T')[0], `(${['일','월','화','수','목','금','토'][lastWeekSaturday.getDay()]})`)
  console.log()

  // actualDateRange 계산
  const actualDateRange = {
    min: firstWeekSunday,
    max: lastWeekSaturday
  }

  console.log('📆 최종 배치 범위 (actualDateRange):')
  console.log('   min:', actualDateRange.min.toISOString().split('T')[0])
  console.log('   max:', actualDateRange.max.toISOString().split('T')[0])
  console.log()

  // allDatesInRange 생성
  const allDatesInRange = []
  const currentDateIter = new Date(actualDateRange.min)
  while (currentDateIter <= actualDateRange.max) {
    allDatesInRange.push(currentDateIter.toISOString().split('T')[0])
    currentDateIter.setDate(currentDateIter.getDate() + 1)
  }

  console.log('📋 allDatesInRange:')
  console.log('   총 날짜 수:', allDatesInRange.length)
  console.log('   첫 날짜:', allDatesInRange[0])
  console.log('   마지막 날짜:', allDatesInRange[allDatesInRange.length - 1])
  console.log()

  // 1월 31일이 포함되어 있는지 확인
  const hasJan31 = allDatesInRange.includes('2025-01-31')
  console.log('🔍 1월 31일 포함 여부:', hasJan31 ? 'O (문제 발생!)' : 'X (정상)')
  console.log()

  if (hasJan31) {
    console.log('❌ 문제 발견!')
    console.log('   2월 자동 배정이 1월 31일을 포함하고 있습니다.')
    console.log('   이로 인해 1월 31일의 모든 직원이 OFF로 배정되었습니다.')
    console.log()
    console.log('💡 원인:')
    console.log('   2월 1일이 토요일이라서, 주차 확장 로직이 해당 주의 일요일(1월 26일)부터')
    console.log('   토요일(2월 1일)까지를 배치 범위로 잡습니다.')
    console.log('   하지만 2월 원장 스케줄에 1월 26~30일은 없고, 1월 31일만 있어서')
    console.log('   1월 31일이 "원장 근무 없음"으로 처리되어 모든 직원이 OFF 배정됩니다.')
  }

  // 2월 원장 스케줄에 1월 날짜가 있는지 확인
  console.log('🔍 2월 원장 스케줄 중 1월 날짜:')
  const janDoctors = febSchedule.doctors.filter(d => {
    const date = new Date(d.date)
    return date.getMonth() === 0 // January = 0
  })

  if (janDoctors.length > 0) {
    console.log('   발견:', janDoctors.length, '일')
    janDoctors.forEach(d => {
      console.log('     -', d.date.toISOString().split('T')[0])
    })
  } else {
    console.log('   없음 (정상)')
  }
  console.log()

  // 1월 DEPLOYED 스케줄 조회
  const janSchedule = await prisma.schedule.findFirst({
    where: {
      clinicId,
      year: 2025,
      month: 1,
      status: 'DEPLOYED'
    },
    include: {
      doctors: {
        where: {
          date: new Date('2025-01-31')
        }
      }
    }
  })

  if (janSchedule) {
    console.log('📋 1월 DEPLOYED 스케줄의 1월 31일 원장 근무:')
    console.log('   doctors 수:', janSchedule.doctors.length)
    if (janSchedule.doctors.length > 0) {
      console.log('   ✅ 1월 31일에 원장 근무 있음 (정상)')
    }
  }

  await prisma.$disconnect()
}

verifyFebAutoAssignRange().catch(console.error)
