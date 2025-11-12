const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testFairnessCutoff() {
  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const staffId = 'cmh6naxac000s12lynsqel2z3'
  const year = 2025
  const month = 11
  
  // 직원 정보
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, clinicId, isActive: true },
    select: {
      name: true,
      categoryName: true,
      departmentName: true,
      fairnessScoreTotalDays: true,
      fairnessScoreNight: true,
      fairnessScoreWeekend: true,
    }
  })
  
  console.log('직원:', staff.name, '/', staff.categoryName)
  console.log('편차 - 총:', staff.fairnessScoreTotalDays, '야간:', staff.fairnessScoreNight, '주말:', staff.fairnessScoreWeekend)
  
  // 같은 구분 직원 수
  const allStaff = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true,
      departmentName: staff.departmentName,
      categoryName: staff.categoryName
    }
  })
  
  console.log('\n같은 구분 직원 수:', allStaff.length)
  
  // 신청 기간
  const leavePeriod = await prisma.leavePeriod.findFirst({
    where: { clinicId, year, month, isActive: true }
  })
  
  let applicationStartDate = leavePeriod.startDate
  let applicationEndDate = leavePeriod.endDate
  
  const lastStaffAssignment = await prisma.staffAssignment.findFirst({
    where: { schedule: { clinicId } },
    orderBy: { date: 'desc' }
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
    orderBy: { date: 'desc' }
  })
  
  if (lastDoctorSchedule?.date) {
    const doctorEndDate = new Date(lastDoctorSchedule.date)
    const leavePeriodEndDate = new Date(leavePeriod.endDate)
    if (doctorEndDate < leavePeriodEndDate) {
      applicationEndDate = doctorEndDate
    }
  }
  
  console.log('\n신청 기간:', applicationStartDate.toISOString().split('T')[0], '~', applicationEndDate.toISOString().split('T')[0])
  
  // 근무일 조회
  const applicableDoctorSchedules = await prisma.scheduleDoctor.findMany({
    where: {
      schedule: { clinicId, year, month },
      date: { gte: applicationStartDate, lte: applicationEndDate }
    },
    select: { date: true },
    distinct: ['date']
  })
  
  const workingDays = applicableDoctorSchedules.filter(ds => {
    const date = new Date(ds.date)
    return date.getDay() !== 0
  }).length
  
  console.log('근무일 수:', workingDays)
  
  // 총 슬롯 계산
  let totalRequiredSlots = 0
  for (const schedule of applicableDoctorSchedules) {
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        date: schedule.date,
        schedule: { clinicId, year, month }
      },
      include: { doctor: { select: { shortName: true } } }
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
  
  console.log('\n총 슬롯 합계:', totalRequiredSlots)
  
  // 형평성 계산
  const baseReq = totalRequiredSlots / allStaff.length
  const adjustedReq = Math.max(0, Math.round(baseReq + staff.fairnessScoreTotalDays))
  const maxAllowedSlots = Math.max(0, totalRequiredSlots - adjustedReq)
  
  console.log('\n형평성 계산:')
  console.log('기준 근무 (baseReq):', baseReq.toFixed(2))
  console.log('조정 근무 (adjustedReq):', adjustedReq)
  console.log('최대 신청 (maxAllowedSlots):', maxAllowedSlots)
  
  console.log('\n커트라인:')
  console.log('total:', workingDays)
  console.log('minRequired:', adjustedReq)
  console.log('maxAllowed:', maxAllowedSlots)
  
  await prisma.$disconnect()
}

testFairnessCutoff()
