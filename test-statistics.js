const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testStatistics() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const staffId = 'cmh6naxac000s12lynsqel2z3' // 혜숙
    const year = 2025
    const month = 11

    console.log('📊 Testing Statistics Calculation\n')

    // LeavePeriod 조회
    const leavePeriod = await prisma.leavePeriod.findFirst({
      where: { clinicId, year, month, isActive: true }
    })

    console.log('1️⃣ LeavePeriod:')
    console.log('   startDate:', leavePeriod?.startDate)
    console.log('   endDate:', leavePeriod?.endDate)

    // 실제 신청 가능 기간 계산
    let applicationStartDate = leavePeriod.startDate
    let applicationEndDate = leavePeriod.endDate

    const lastStaffAssignment = await prisma.staffAssignment.findFirst({
      where: { schedule: { clinicId } },
      orderBy: { date: 'desc' },
      select: { date: true }
    })

    if (lastStaffAssignment?.date) {
      const nextDay = new Date(lastStaffAssignment.date)
      nextDay.setDate(nextDay.getDate() + 1)
      if (nextDay > new Date(leavePeriod.startDate)) {
        applicationStartDate = nextDay
      }
    }

    const lastDoctorSchedule = await prisma.scheduleDoctor.findFirst({
      where: { schedule: { clinicId } },
      orderBy: { date: 'desc' },
      select: { date: true }
    })

    if (lastDoctorSchedule?.date) {
      const doctorEndDate = new Date(lastDoctorSchedule.date)
      const leavePeriodEndDate = new Date(leavePeriod.endDate)
      if (doctorEndDate < leavePeriodEndDate) {
        applicationEndDate = doctorEndDate
      }
    }

    console.log('\n2️⃣ Application Period:')
    console.log('   startDate:', applicationStartDate)
    console.log('   endDate:', applicationEndDate)

    // 신청 가능 기간 내의 원장 스케줄만 조회 (중복 제거)
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        schedule: { clinicId, year, month },
        date: {
          gte: applicationStartDate,
          lte: applicationEndDate
        }
      },
      select: { date: true },
      distinct: ['date']
    })

    console.log('\n3️⃣ Doctor Schedules in Application Period:')
    console.log('   Total:', doctorSchedules.length)

    // 일별 조회
    const dateList = doctorSchedules.map(ds => {
      const d = new Date(ds.date)
      const dayNames = ['일', '월', '화', '수', '목', '금', '토']
      return `${d.toISOString().split('T')[0]} (${dayNames[d.getDay()]})`
    })
    console.log('   Dates:', dateList.slice(0, 10).join(', '), dateList.length > 10 ? '...' : '')

    // 일요일 제외한 영업일 계산
    const businessDays = doctorSchedules.filter(ds => {
      const date = new Date(ds.date)
      return date.getDay() !== 0
    })

    console.log('\n4️⃣ Business Days (일요일 제외):')
    console.log('   Total:', businessDays.length)

    // 병원 설정
    const ruleSettings = await prisma.ruleSettings.findUnique({
      where: { clinicId },
      select: {
        weekBusinessDays: true,
        defaultWorkDays: true
      }
    })

    const weekBusinessDays = ruleSettings?.weekBusinessDays || 6
    const defaultWorkDays = ruleSettings?.defaultWorkDays || 4

    console.log('\n5️⃣ Settings:')
    console.log('   주간 영업일:', weekBusinessDays)
    console.log('   기본 근무일:', defaultWorkDays)

    // 예상 OFF 일수 계산
    const expectedOffDays = Math.round(businessDays.length * (1 - defaultWorkDays / weekBusinessDays))

    console.log('\n6️⃣ Expected OFF Days:')
    console.log('   계산:', `${businessDays.length} × (1 - ${defaultWorkDays}/${weekBusinessDays})`)
    console.log('   계산:', `${businessDays.length} × ${(1 - defaultWorkDays / weekBusinessDays).toFixed(3)}`)
    console.log('   결과:', expectedOffDays)

    // 이미 신청한 내역
    const applications = await prisma.leaveApplication.findMany({
      where: {
        staffId,
        clinicId,
        date: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1)
        },
        status: { in: ['CONFIRMED', 'PENDING'] }
      },
      select: {
        date: true,
        leaveType: true,
        status: true
      }
    })

    console.log('\n7️⃣ Current Applications:')
    console.log('   Count:', applications.length)
    if (applications.length > 0) {
      console.log('   Details:', applications.map(a =>
        `${a.date.toISOString().split('T')[0]} (${a.leaveType}, ${a.status})`
      ))
    }

    console.log('\n✅ Summary:')
    console.log('   신청 가능 영업일:', businessDays.length, '일')
    console.log('   예상 OFF 일수:', expectedOffDays, '일')
    console.log('   현재 신청:', applications.length, '일')
    console.log('   자동 배치 예정:', Math.max(0, expectedOffDays - applications.length), '일')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testStatistics()
