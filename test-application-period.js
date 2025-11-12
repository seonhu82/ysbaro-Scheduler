const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testApplicationPeriod() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const year = 2025
    const month = 11

    console.log('📅 Testing Application Period Calculation\n')

    // LeavePeriod 조회
    const leavePeriod = await prisma.leavePeriod.findFirst({
      where: {
        clinicId,
        year,
        month,
        isActive: true
      }
    })

    console.log('1️⃣ LeavePeriod:')
    console.log('   startDate:', leavePeriod?.startDate)
    console.log('   endDate:', leavePeriod?.endDate)

    // StaffAssignment 최종일
    const lastStaffAssignment = await prisma.staffAssignment.findFirst({
      where: {
        schedule: { clinicId }
      },
      orderBy: {
        date: 'desc'
      },
      select: {
        date: true
      }
    })

    console.log('\n2️⃣ Last StaffAssignment:')
    console.log('   date:', lastStaffAssignment?.date)

    let applicationStartDate = leavePeriod?.startDate
    if (lastStaffAssignment?.date) {
      const nextDay = new Date(lastStaffAssignment.date)
      nextDay.setDate(nextDay.getDate() + 1)
      console.log('   nextDay:', nextDay)
      if (nextDay > new Date(leavePeriod.startDate)) {
        applicationStartDate = nextDay
      }
    }

    console.log('\n3️⃣ Calculated Application Start Date:')
    console.log('   ', applicationStartDate)

    // 11월 토요일 (전체)
    console.log('\n4️⃣ All Saturdays in November:')
    const allSaturdays = []
    const daysInMonth = new Date(year, month, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
      if (date.getUTCDay() === 6) {
        allSaturdays.push(date.toISOString().split('T')[0])
      }
    }
    console.log('   ', allSaturdays)

    // 신청 가능 토요일 (필터링)
    console.log('\n5️⃣ Applicable Saturdays (after', applicationStartDate?.toISOString().split('T')[0], '):')
    const applicableSaturdays = []
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
      if (date.getUTCDay() === 6) {
        if (applicationStartDate && date < applicationStartDate) {
          console.log('   ❌', date.toISOString().split('T')[0], '- Before application start date')
          continue
        }
        applicableSaturdays.push(date.toISOString().split('T')[0])
      }
    }
    console.log('   ✅', applicableSaturdays)
    console.log('\n📊 Result:')
    console.log('   Total Saturdays:', allSaturdays.length)
    console.log('   Applicable Saturdays:', applicableSaturdays.length)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testApplicationPeriod()
