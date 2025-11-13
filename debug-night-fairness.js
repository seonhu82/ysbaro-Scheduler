const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function debug() {
  // 1. 김소 직원 찾기
  const staff = await prisma.staff.findFirst({
    where: { name: '김소' },
    select: {
      id: true,
      name: true,
      categoryName: true,
      fairnessScoreNight: true
    }
  })

  if (!staff) {
    console.log('❌ 김소 직원을 찾을 수 없습니다')
    return
  }

  console.log('👤 김소 정보:')
  console.log('  구분:', staff.categoryName)
  console.log('  야간 형평성 점수:', staff.fairnessScoreNight)

  // 2. clinicId 찾기
  const staffWithClinic = await prisma.staff.findUnique({
    where: { id: staff.id },
    select: { clinicId: true }
  })

  // 같은 구분 총 인원
  const totalStaff = await prisma.staff.count({
    where: {
      clinicId: staffWithClinic.clinicId,
      isActive: true,
      departmentName: '진료실',
      categoryName: staff.categoryName
    }
  })

  console.log(`\n📊 ${staff.categoryName} 구분 총 인원: ${totalStaff}명`)

  // 3. 11월 야간 근무일 찾기
  const nightShiftDates = await prisma.scheduleDoctor.findMany({
    where: {
      schedule: {
        year: 2025,
        month: 11
      },
      hasNightShift: true
    },
    select: { date: true },
    distinct: ['date']
  })

  console.log(`\n🌙 11월 야간 근무일: ${nightShiftDates.length}일`)

  // 4. 각 야간일의 필요 슬롯 계산
  let totalRequiredSlots = 0

  for (const { date } of nightShiftDates) {
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

      console.log(`  ${date.toISOString().split('T')[0]}: 필요 ${staff.categoryName} ${required}명`)
    }
  }

  console.log(`\n📈 총 필요 슬롯: ${totalRequiredSlots}`)

  // 5. 형평성 계산
  const baseRequirement = totalRequiredSlots / totalStaff
  const adjustedRequirement = Math.max(0, Math.round(baseRequirement + (staff.fairnessScoreNight || 0)))
  const maxApplicationDays = Math.max(0, nightShiftDates.length - adjustedRequirement)

  console.log('\n💡 형평성 계산:')
  console.log('  기준 근무 횟수:', baseRequirement.toFixed(2))
  console.log('  야간 형평성 점수:', staff.fairnessScoreNight || 0)
  console.log('  조정된 최소 근무:', adjustedRequirement)
  console.log('  최대 신청 가능:', maxApplicationDays, '일')

  // 6. 김소로 기존 야간 신청 확인
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
    select: { date: true, status: true }
  })

  console.log(`\n📋 기존 OFF 신청: ${existingApplications.length}건`)

  // 야간 근무일인지 확인
  const nightShiftDateSet = new Set(nightShiftDates.map(d => d.date.toISOString().split('T')[0]))
  const nightApplications = existingApplications.filter(app =>
    nightShiftDateSet.has(app.date.toISOString().split('T')[0])
  )

  console.log(`🌙 야간 근무일 OFF 신청: ${nightApplications.length}건`)
  nightApplications.forEach(app => {
    console.log(`  - ${app.date.toISOString().split('T')[0]} (${app.status})`)
  })

  // 7. 26일이 야간 근무일인지 확인
  const nov26 = new Date('2025-11-26')
  const nov26Night = await prisma.scheduleDoctor.findMany({
    where: {
      date: nov26,
      schedule: { year: 2025, month: 11 }
    },
    select: { hasNightShift: true }
  })

  const isNov26Night = nov26Night.some(d => d.hasNightShift)
  console.log(`\n📅 11월 26일 야간 근무 여부: ${isNov26Night ? '야간 있음' : '야간 없음'}`)

  if (isNov26Night) {
    const wouldBeCount = nightApplications.length + 1
    console.log(`\n🔍 26일 신청 시 야간 OFF 개수: ${wouldBeCount}`)
    console.log(`   최대 가능: ${maxApplicationDays}`)
    console.log(`   ${wouldBeCount} > ${maxApplicationDays} = ${wouldBeCount > maxApplicationDays}`)
    console.log(`   결과: ${wouldBeCount > maxApplicationDays ? '❌ 거부' : '✅ 통과'}`)
  }

  await prisma.$disconnect()
}

debug()
