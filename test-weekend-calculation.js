const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testWeekendCalculation() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const staffId = 'cmh6naxac000s12lynsqel2z3' // 혜숙
    const year = 2025
    const month = 11

    console.log('🧮 Detailed Weekend Fairness Calculation\n')

    // 1. Get staff info
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        name: true,
        categoryName: true,
        fairnessScoreWeekend: true
      }
    })

    console.log('👤 Staff:', staff.name, '(', staff.categoryName, ')')
    console.log('   Weekend deviation:', staff.fairnessScoreWeekend)

    // 2. Count staff in category
    const totalStaffInCategory = await prisma.staff.count({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실',
        categoryName: staff.categoryName
      }
    })

    console.log('\n👥 Total staff in category:', totalStaffInCategory)

    // 3. Find all Saturdays in November 2025 (한국 시간 기준)
    const saturdays = []
    const daysInMonth = new Date(year, month, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      // 한국 시간 기준으로 날짜 생성 (UTC)
      const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
      if (date.getUTCDay() === 6) {
        saturdays.push(date)
      }
    }

    console.log('\n📅 November 2025 Saturdays:', saturdays.length)

    // 4. Calculate required slots for each Saturday
    let totalRequiredSlots = 0

    console.log('\n🔍 Saturday-by-Saturday Analysis:')

    for (const saturday of saturdays) {
      const dateStr = saturday.toISOString().split('T')[0]
      console.log(`\n   ${dateStr} (${saturday.toLocaleDateString('ko-KR', { weekday: 'short' })})`)

      // Get doctor schedules for this date
      const doctorSchedules = await prisma.scheduleDoctor.findMany({
        where: {
          date: saturday,
          schedule: { clinicId, year, month }
        },
        include: {
          doctor: {
            select: { shortName: true }
          }
        }
      })

      if (doctorSchedules.length === 0) {
        console.log('     ⚠️ No doctor schedule')
        continue
      }

      const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
      const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

      console.log('     원장:', doctorShortNames.join(', '))
      console.log('     야간:', hasNightShift ? 'O' : 'X')

      // Find combination
      const combination = await prisma.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: { equals: doctorShortNames },
          hasNightShift
        }
      })

      if (!combination) {
        console.log('     ⚠️ No matching combination')
        continue
      }

      const departmentCategoryStaff = combination.departmentCategoryStaff
      const treatmentDept = departmentCategoryStaff['진료실'] || {}
      const categoryData = treatmentDept[staff.categoryName]
      const categoryRequired = categoryData?.count || 0

      console.log('     필요 인원 (진료실):', JSON.stringify(treatmentDept))
      console.log(`     ${staff.categoryName} 필요: ${categoryRequired}명 (전체 ${categoryData?.count || 0}명 중 최소 ${categoryData?.minRequired || 0}명)`)

      totalRequiredSlots += categoryRequired
    }

    console.log('\n📊 Total Required Slots:', totalRequiredSlots)
    console.log('   (= 모든 토요일에 팀장/실장 필요 인원 합계)')

    // 5. Calculate base requirement
    const baseRequirement = totalRequiredSlots / totalStaffInCategory

    console.log('\n🧮 Base Requirement Calculation:')
    console.log(`   ${totalRequiredSlots} (총 필요) ÷ ${totalStaffInCategory} (총 인원) = ${baseRequirement.toFixed(2)}`)

    // 6. Apply deviation
    const adjustedRequirement = Math.max(0, Math.floor(baseRequirement + staff.fairnessScoreWeekend))

    console.log('\n⚖️ Fairness Adjustment:')
    console.log(`   ${baseRequirement.toFixed(2)} (기준) + ${staff.fairnessScoreWeekend} (편차) = ${(baseRequirement + staff.fairnessScoreWeekend).toFixed(2)}`)
    console.log(`   floor(${(baseRequirement + staff.fairnessScoreWeekend).toFixed(2)}) = ${adjustedRequirement}`)
    console.log(`   → 최소 ${adjustedRequirement}번 근무해야 함`)

    // 7. Calculate max applications
    const maxApplications = Math.max(0, saturdays.length - adjustedRequirement)

    console.log('\n✅ Final Result:')
    console.log(`   ${saturdays.length} (총 토요일) - ${adjustedRequirement} (최소 근무) = ${maxApplications}`)
    console.log(`   → 최대 ${maxApplications}번 주말 OFF/연차 신청 가능`)

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testWeekendCalculation()
