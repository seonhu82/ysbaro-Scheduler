const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testSlotBasedFairness() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const staffId = 'cmh6naxac000s12lynsqel2z3' // 혜숙
    const year = 2025
    const month = 11

    console.log('🧮 Testing Slot-Based Fairness Calculation\n')

    // 1. 직원 정보
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        name: true,
        categoryName: true,
        departmentName: true,
        fairnessScoreTotalDays: true,
        fairnessScoreWeekend: true,
        fairnessScoreNight: true,
      }
    })

    console.log('👤 Staff:', staff.name)
    console.log('   Category:', staff.categoryName)
    console.log('   Department:', staff.departmentName)
    console.log('   Total Days Score:', staff.fairnessScoreTotalDays)
    console.log('   Weekend Score:', staff.fairnessScoreWeekend)
    console.log('   Night Score:', staff.fairnessScoreNight)

    // 2. 신청 가능 기간 계산
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

    console.log('\n📅 Application Period:')
    console.log('   Start:', applicationStartDate.toISOString().split('T')[0])
    console.log('   End:', applicationEndDate.toISOString().split('T')[0])

    // 3. 같은 구분 직원
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: staff.departmentName,
        categoryName: staff.categoryName
      },
      select: {
        id: true,
        name: true,
        categoryName: true,
        fairnessScoreTotalDays: true,
        fairnessScoreWeekend: true,
      }
    })

    console.log('\n👥 All Staff in Category (', staff.categoryName, '):', allStaff.length)
    console.log('   Names:', allStaff.map(s => s.name).join(', '))

    // 4. 신청 가능 기간 내 영업일
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

    const workingDays = applicableDoctorSchedules.filter(ds => {
      const date = new Date(ds.date)
      return date.getDay() !== 0
    }).length

    console.log('\n📊 Total Working Days (신청 가능):', workingDays)

    // 5. 총 근무일 형평성 (슬롯 기반)
    console.log('\n🔍 Total Days Fairness (SLOT-BASED):')
    let totalRequiredSlots = 0
    for (const schedule of applicableDoctorSchedules) {
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

    console.log('   Working days:', workingDays, '일')
    console.log('   Total required SLOTS:', totalRequiredSlots, '슬롯')
    console.log('   Staff count:', allStaff.length)
    console.log('   Base requirement:', baseReq.toFixed(2), '=', totalRequiredSlots, '/', allStaff.length)
    console.log('   Staff score:', staff.fairnessScoreTotalDays)
    console.log('   Calculation:', baseReq.toFixed(2), '+', staff.fairnessScoreTotalDays, '=', (baseReq + staff.fairnessScoreTotalDays).toFixed(2))
    console.log('   Adjusted (floor):', adjustedReq)
    console.log('   Max allowed OFF:', totalRequiredSlots - adjustedReq, '슬롯')

    // 6. 주말 형평성 (슬롯 기반)
    console.log('\n🔍 Weekend Fairness (SLOT-BASED):')
    const saturdaySchedules = applicableDoctorSchedules.filter(ds => {
      const date = new Date(ds.date)
      return date.getDay() === 6
    })
    const saturdays = saturdaySchedules.length

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

    console.log('   Saturday dates:', saturdaySchedules.map(s => s.date.toISOString().split('T')[0]))
    console.log('   Total Saturdays:', saturdays, '일')
    console.log('   Total required SLOTS:', weekendRequiredSlots, '슬롯')
    console.log('   Staff count:', allStaff.length)
    console.log('   Base requirement:', weekendBaseReq.toFixed(2), '=', weekendRequiredSlots, '/', allStaff.length)
    console.log('   Staff weekend score:', staff.fairnessScoreWeekend)
    console.log('   Calculation:', weekendBaseReq.toFixed(2), '+', staff.fairnessScoreWeekend, '=', (weekendBaseReq + staff.fairnessScoreWeekend).toFixed(2))
    console.log('   Adjusted (floor):', weekendAdjustedReq)
    console.log('   Max allowed OFF:', weekendRequiredSlots - weekendAdjustedReq, '슬롯')

    // 7. 야간 형평성 (슬롯 기반)
    console.log('\n🔍 Night Shift Fairness (SLOT-BASED):')
    const nightShiftDatesData = await prisma.scheduleDoctor.findMany({
      where: {
        schedule: { clinicId, year, month },
        hasNightShift: true,
        date: {
          gte: applicationStartDate,
          lte: applicationEndDate
        }
      },
      select: { date: true },
      distinct: ['date']
    })
    const nightShiftDates = nightShiftDatesData.length

    let nightRequiredSlots = 0
    for (const nightSchedule of nightShiftDatesData) {
      const doctorSchedules = await prisma.scheduleDoctor.findMany({
        where: {
          date: nightSchedule.date,
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
        nightRequiredSlots += categoryRequired
      }
    }

    const nightBaseReq = nightRequiredSlots / allStaff.length
    const nightAdjustedReq = Math.max(0, Math.floor(nightBaseReq + staff.fairnessScoreNight))

    console.log('   Night shift dates:', nightShiftDatesData.map(s => s.date.toISOString().split('T')[0]))
    console.log('   Total Night shifts:', nightShiftDates, '일')
    console.log('   Total required SLOTS:', nightRequiredSlots, '슬롯')
    console.log('   Staff count:', allStaff.length)
    console.log('   Base requirement:', nightBaseReq.toFixed(2), '=', nightRequiredSlots, '/', allStaff.length)
    console.log('   Staff night score:', staff.fairnessScoreNight)
    console.log('   Calculation:', nightBaseReq.toFixed(2), '+', staff.fairnessScoreNight, '=', (nightBaseReq + staff.fairnessScoreNight).toFixed(2))
    console.log('   Adjusted (floor):', nightAdjustedReq)
    console.log('   Max allowed OFF:', nightRequiredSlots - nightAdjustedReq, '슬롯')

    console.log('\n✅ Summary:')
    console.log('   총 근무일 - 최소 근무:', adjustedReq, '슬롯, 최대 신청:', totalRequiredSlots - adjustedReq, '슬롯')
    console.log('   주말 - 최소 근무:', weekendAdjustedReq, '슬롯, 최대 신청:', weekendRequiredSlots - weekendAdjustedReq, '슬롯')
    console.log('   야간 - 최소 근무:', nightAdjustedReq, '슬롯, 최대 신청:', nightRequiredSlots - nightAdjustedReq, '슬롯')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testSlotBasedFairness()
