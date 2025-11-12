const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function debugTotalSlots() {
  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const year = 2025
  const month = 11
  const categoryName = '팀장/실장'
  
  // 신청 가능 기간 계산
  const leavePeriod = await prisma.leavePeriod.findFirst({
    where: { clinicId, year, month, isActive: true }
  })
  
  let applicationStartDate = leavePeriod.startDate
  let applicationEndDate = leavePeriod.endDate
  
  // StaffAssignment 최종일 확인
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
  
  // ScheduleDoctor 최종일 확인
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
  
  console.log('신청 가능 기간:', applicationStartDate.toISOString().split('T')[0], '~', applicationEndDate.toISOString().split('T')[0])
  
  // 신청 가능 기간 내의 근무일만 계산
  const applicableDoctorSchedules = await prisma.scheduleDoctor.findMany({
    where: {
      schedule: { clinicId, year, month },
      date: { gte: applicationStartDate, lte: applicationEndDate }
    },
    select: { date: true },
    distinct: ['date']
  })
  
  console.log('총 근무일 수:', applicableDoctorSchedules.length)
  
  // 각 영업일에 필요한 해당 구분 인력 합산
  let totalRequiredSlots = 0
  let foundCount = 0
  let notFoundCount = 0
  
  for (const schedule of applicableDoctorSchedules) {
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        date: schedule.date,
        schedule: { clinicId, year, month }
      },
      include: { doctor: { select: { shortName: true } } }
    })
    
    if (doctorSchedules.length === 0) {
      notFoundCount++
      continue
    }
    
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
      const categoryData = treatmentDept[categoryName]
      const categoryRequired = categoryData?.count || 0
      totalRequiredSlots += categoryRequired
      if (categoryRequired > 0) foundCount++
    } else {
      notFoundCount++
    }
  }
  
  console.log('\n슬롯 계산 결과:')
  console.log('총 슬롯 합계:', totalRequiredSlots)
  console.log('슬롯 찾은 날:', foundCount)
  console.log('슬롯 못 찾은 날:', notFoundCount)
  
  // 직원 수
  const staffCount = 3
  console.log('\n형평성 계산:')
  console.log('필요 슬롯 총합:', totalRequiredSlots)
  console.log('직원 수:', staffCount)
  console.log('기준 근무:', (totalRequiredSlots / staffCount).toFixed(2))
  
  await prisma.$disconnect()
}

debugTotalSlots()
