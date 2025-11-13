const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function debug() {
  const staff = await prisma.staff.findFirst({
    where: { name: '김소' },
    select: {
      id: true,
      name: true,
      categoryName: true,
      fairnessScoreTotalDays: true,
      clinicId: true
    }
  })

  console.log('👤 김소 정보:')
  console.log('  구분:', staff.categoryName)
  console.log('  총 근무일 형평성 점수:', staff.fairnessScoreTotalDays)

  // 11월 전체 근무일 수
  const allDates = await prisma.scheduleDoctor.findMany({
    where: {
      schedule: {
        clinicId: staff.clinicId,
        year: 2025,
        month: 11
      }
    },
    select: { date: true },
    distinct: ['date']
  })

  console.log(`\n📅 11월 전체 근무일: ${allDates.length}일`)

  // 각 날짜의 필요 슬롯 계산
  let totalRequiredSlots = 0

  for (const { date } of allDates) {
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: { date },
      include: {
        doctor: { select: { shortName: true } }
      }
    })

    const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
    const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

    const combination = await prisma.doctorCombination.findFirst({
      where: {
        doctors: { equals: doctorShortNames },
        hasNightShift
      }
    })

    if (combination) {
      const deptCatStaff = combination.departmentCategoryStaff
      const treatmentDept = deptCatStaff['진료실'] || {}
      const categoryData = treatmentDept[staff.categoryName]
      const required = categoryData?.count || 0
      totalRequiredSlots += required
    }
  }

  console.log(`📈 총 필요 슬롯: ${totalRequiredSlots}`)

  // 같은 구분 총 인원
  const totalStaff = await prisma.staff.count({
    where: {
      clinicId: staff.clinicId,
      isActive: true,
      departmentName: '진료실',
      categoryName: staff.categoryName
    }
  })

  console.log(`👥 ${staff.categoryName} 총 인원: ${totalStaff}명`)

  // 형평성 계산
  const baseRequirement = totalRequiredSlots / totalStaff
  const currentTotalDeviation = staff.fairnessScoreTotalDays || 0
  const adjustedRequirement = Math.max(0, Math.round(baseRequirement + currentTotalDeviation))
  const maxApplicationDays = Math.max(0, allDates.length - adjustedRequirement)

  console.log('\n💡 총 근무일 형평성 계산:')
  console.log('  기준 근무 횟수:', baseRequirement.toFixed(2))
  console.log('  총 근무일 형평성 점수:', currentTotalDeviation)
  console.log('  조정된 최소 근무:', adjustedRequirement)
  console.log('  최대 신청 가능:', maxApplicationDays, '일')

  // 기존 OFF 신청
  const existingApplications = await prisma.leaveApplication.findMany({
    where: {
      staffId: staff.id,
      leaveType: 'OFF',
      status: { in: ['CONFIRMED', 'PENDING'] },
      date: {
        gte: new Date('2025-11-01'),
        lte: new Date('2025-11-30')
      }
    },
    select: { date: true }
  })

  console.log(`\n📋 기존 OFF 신청: ${existingApplications.length}건`)
  existingApplications.forEach(app => {
    console.log(`  - ${app.date.toISOString().split('T')[0]}`)
  })

  const wouldBeCount = existingApplications.length + 1
  console.log(`\n🔍 26일 신청 시 총 OFF 개수: ${wouldBeCount}`)
  console.log(`   최대 가능: ${maxApplicationDays}`)
  console.log(`   ${wouldBeCount} > ${maxApplicationDays} = ${wouldBeCount > maxApplicationDays}`)
  console.log(`   결과: ${wouldBeCount > maxApplicationDays ? '❌ 거부' : '✅ 통과'}`)

  await prisma.$disconnect()
}

debug()
