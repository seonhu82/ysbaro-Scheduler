const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testFairnessFilter() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const staffId = 'cmh6naxac000s12lynsqel2z3' // 혜숙
    const year = 2025
    const month = 11

    console.log('🔍 Testing Fairness Filter\n')

    // 1. 직원 정보
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        name: true,
        categoryName: true,
        fairnessScoreTotalDays: true,
        fairnessScoreWeekend: true,
      }
    })

    console.log('👤 Staff:', staff.name)
    console.log('   Category:', staff.categoryName)
    console.log('   Total Days Score:', staff.fairnessScoreTotalDays)
    console.log('   Weekend Score:', staff.fairnessScoreWeekend)

    // 2. 현재 신청 내역
    const currentApplications = await prisma.leaveApplication.findMany({
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
      },
      orderBy: { date: 'asc' }
    })

    console.log('\n📋 Current Applications:', currentApplications.length)
    if (currentApplications.length > 0) {
      currentApplications.forEach(app => {
        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][app.date.getDay()]
        console.log(`   ${app.date.toISOString().split('T')[0]} (${dayOfWeek}) - ${app.leaveType} (${app.status})`)
      })
    }

    // 3. 신청 가능 기간 계산
    const leavePeriod = await prisma.leavePeriod.findFirst({
      where: { clinicId, year, month, isActive: true }
    })

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

    // 4. 같은 구분 직원
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실',
        categoryName: staff.categoryName
      }
    })

    // 5. 신청 가능 영업일 슬롯 계산
    const applicableDoctorSchedules = await prisma.scheduleDoctor.findMany({
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

    const workingDaySchedules = applicableDoctorSchedules.filter(ds => {
      const date = new Date(ds.date)
      return date.getDay() !== 0
    })

    let totalRequiredSlots = 0
    for (const schedule of workingDaySchedules) {
      const doctorSchedules = await prisma.scheduleDoctor.findMany({
        where: {
          date: schedule.date,
          schedule: { clinicId, year, month }
        },
        include: {
          doctor: { select: { shortName: true } }
        }
      })

      if (doctorSchedules.length === 0) continue

      const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
      const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

      const combination = await prisma.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: { equals: doctorShortNames },
          hasNightShift
        }
      })

      if (combination) {
        const departmentCategoryStaff = combination.departmentCategoryStaff
        const treatmentDept = departmentCategoryStaff['진료실'] || {}
        const categoryData = treatmentDept[staff.categoryName]
        const categoryRequired = categoryData?.count || 0
        totalRequiredSlots += categoryRequired
      }
    }

    const baseReq = totalRequiredSlots / allStaff.length
    const adjustedReq = Math.max(0, Math.floor(baseReq + staff.fairnessScoreTotalDays))
    const maxAllowedOff = totalRequiredSlots - adjustedReq

    console.log('\n📊 Total Days Fairness Limit:')
    console.log('   Total required slots:', totalRequiredSlots)
    console.log('   Staff count:', allStaff.length)
    console.log('   Base requirement:', baseReq.toFixed(2))
    console.log('   Adjusted requirement:', adjustedReq)
    console.log('   Max allowed OFF:', maxAllowedOff, '슬롯')
    console.log('   Current applications:', currentApplications.length, '일')
    console.log('   ⚠️  Note: 신청 1일 ≠ 슬롯 1개')

    // 6. 현재 신청한 날짜들의 실제 슬롯 계산
    let currentUsedSlots = 0
    for (const app of currentApplications) {
      const doctorSchedules = await prisma.scheduleDoctor.findMany({
        where: {
          date: app.date,
          schedule: { clinicId, year, month }
        },
        include: {
          doctor: { select: { shortName: true } }
        }
      })

      if (doctorSchedules.length === 0) continue

      const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
      const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

      const combination = await prisma.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: { equals: doctorShortNames },
          hasNightShift
        }
      })

      if (combination) {
        const departmentCategoryStaff = combination.departmentCategoryStaff
        const treatmentDept = departmentCategoryStaff['진료실'] || {}
        const categoryData = treatmentDept[staff.categoryName]
        const categoryRequired = categoryData?.count || 0
        currentUsedSlots += categoryRequired
      }
    }

    console.log('\n🔢 Current Used Slots:')
    console.log('   Current applications:', currentApplications.length, '일')
    console.log('   Current used slots:', currentUsedSlots, '슬롯')
    console.log('   Remaining slots:', maxAllowedOff - currentUsedSlots, '슬롯')

    // 7. 필터 작동 확인
    console.log('\n🚦 Filter Status:')
    if (currentUsedSlots >= maxAllowedOff) {
      console.log('   ❌ BLOCKED - 최대 신청 가능 슬롯 초과')
      console.log('   Current:', currentUsedSlots, '/', maxAllowedOff, '슬롯')
    } else {
      console.log('   ✅ ALLOWED - 추가 신청 가능')
      console.log('   Current:', currentUsedSlots, '/', maxAllowedOff, '슬롯')
      console.log('   Remaining:', maxAllowedOff - currentUsedSlots, '슬롯')
    }

    // 8. 주말 필터 확인
    const saturdaySchedules = applicableDoctorSchedules.filter(ds => {
      const date = new Date(ds.date)
      return date.getDay() === 6
    })

    let weekendRequiredSlots = 0
    for (const saturdaySchedule of saturdaySchedules) {
      const doctorSchedules = await prisma.scheduleDoctor.findMany({
        where: {
          date: saturdaySchedule.date,
          schedule: { clinicId, year, month }
        },
        include: {
          doctor: { select: { shortName: true } }
        }
      })

      if (doctorSchedules.length === 0) continue

      const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
      const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

      const combination = await prisma.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: { equals: doctorShortNames },
          hasNightShift
        }
      })

      if (combination) {
        const departmentCategoryStaff = combination.departmentCategoryStaff
        const treatmentDept = departmentCategoryStaff['진료실'] || {}
        const categoryData = treatmentDept[staff.categoryName]
        const categoryRequired = categoryData?.count || 0
        weekendRequiredSlots += categoryRequired
      }
    }

    const weekendBaseReq = weekendRequiredSlots / allStaff.length
    const weekendAdjustedReq = Math.max(0, Math.floor(weekendBaseReq + staff.fairnessScoreWeekend))
    const maxAllowedWeekendOff = weekendRequiredSlots - weekendAdjustedReq

    const weekendApplications = currentApplications.filter(app => {
      const dayOfWeek = app.date.getDay()
      return dayOfWeek === 6
    })

    let currentWeekendUsedSlots = 0
    for (const app of weekendApplications) {
      const doctorSchedules = await prisma.scheduleDoctor.findMany({
        where: {
          date: app.date,
          schedule: { clinicId, year, month }
        },
        include: {
          doctor: { select: { shortName: true } }
        }
      })

      if (doctorSchedules.length === 0) continue

      const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
      const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

      const combination = await prisma.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: { equals: doctorShortNames },
          hasNightShift
        }
      })

      if (combination) {
        const departmentCategoryStaff = combination.departmentCategoryStaff
        const treatmentDept = departmentCategoryStaff['진료실'] || {}
        const categoryData = treatmentDept[staff.categoryName]
        const categoryRequired = categoryData?.count || 0
        currentWeekendUsedSlots += categoryRequired
      }
    }

    console.log('\n📊 Weekend Fairness Limit:')
    console.log('   Total weekend slots:', weekendRequiredSlots)
    console.log('   Adjusted requirement:', weekendAdjustedReq)
    console.log('   Max allowed OFF:', maxAllowedWeekendOff, '슬롯')
    console.log('   Current weekend applications:', weekendApplications.length, '일')
    console.log('   Current weekend slots used:', currentWeekendUsedSlots, '슬롯')
    console.log('   Remaining weekend slots:', maxAllowedWeekendOff - currentWeekendUsedSlots, '슬롯')

    console.log('\n🚦 Weekend Filter Status:')
    if (currentWeekendUsedSlots >= maxAllowedWeekendOff) {
      console.log('   ❌ BLOCKED - 주말 최대 신청 가능 슬롯 초과')
      console.log('   Current:', currentWeekendUsedSlots, '/', maxAllowedWeekendOff, '슬롯')
    } else {
      console.log('   ✅ ALLOWED - 주말 추가 신청 가능')
      console.log('   Current:', currentWeekendUsedSlots, '/', maxAllowedWeekendOff, '슬롯')
      console.log('   Remaining:', maxAllowedWeekendOff - currentWeekendUsedSlots, '슬롯')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testFairnessFilter()
