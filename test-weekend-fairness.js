/**
 * 주말 형평성 필터 테스트
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testWeekendFairness() {
  const clinicId = 'cmh697itv0001fw83azbrqe60'
  const year = 2025
  const month = 11

  // 금환 직원 조회
  const staff = await prisma.staff.findFirst({
    where: {
      clinicId,
      name: '금환',
      isActive: true
    },
    select: {
      id: true,
      name: true,
      categoryName: true,
      fairnessScoreWeekend: true,
      departmentName: true
    }
  })

  console.log('👤 직원 정보:', staff)

  if (!staff) {
    console.log('❌ 직원을 찾을 수 없습니다')
    return
  }

  // 11월 토요일 날짜 찾기
  const saturdays = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
    if (date.getUTCDay() === 6) {
      saturdays.push(date)
    }
  }

  console.log('\n📅 11월 토요일:', saturdays.map(d => d.toISOString().split('T')[0]))

  // 각 토요일에 필요한 해당 구분 인력 계산
  let totalRequiredSlots = 0

  for (const saturday of saturdays) {
    const dateStr = saturday.toISOString().split('T')[0]

    // 해당 날짜의 원장 스케줄 조회
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        date: saturday,
        schedule: {
          clinicId,
          year,
          month
        }
      },
      include: {
        doctor: {
          select: {
            shortName: true
          }
        }
      }
    })

    if (doctorSchedules.length === 0) {
      console.log(`  ${dateStr}: 원장 스케줄 없음`)
      continue
    }

    // 원장 조합으로 필요 인원 찾기
    const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
    const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

    const combination = await prisma.doctorCombination.findFirst({
      where: {
        clinicId,
        doctors: { equals: doctorShortNames },
        hasNightShift
      }
    })

    if (!combination) {
      console.log(`  ${dateStr}: 원장 조합 없음 (${doctorShortNames.join(', ')})`)
      continue
    }

    const departmentCategoryStaff = combination.departmentCategoryStaff
    const treatmentDept = departmentCategoryStaff[staff.departmentName] || {}
    const categoryData = treatmentDept[staff.categoryName]
    const categoryRequired = categoryData?.count || 0

    console.log(`  ${dateStr}: 원장 ${doctorShortNames.join(',')} / 필요: ${categoryRequired}명`)
    totalRequiredSlots += categoryRequired
  }

  // 해당 구분 총 인원
  const totalStaffInCategory = await prisma.staff.count({
    where: {
      clinicId,
      isActive: true,
      departmentName: staff.departmentName,
      categoryName: staff.categoryName
    }
  })

  console.log('\n📊 계산:')
  console.log(`  구분: ${staff.categoryName}`)
  console.log(`  구분 총 인원: ${totalStaffInCategory}명`)
  console.log(`  총 필요 슬롯: ${totalRequiredSlots}`)
  console.log(`  기준 근무 횟수: ${totalRequiredSlots} / ${totalStaffInCategory} = ${(totalRequiredSlots / totalStaffInCategory).toFixed(2)}일/명`)
  console.log(`  현재 주말 편차: ${staff.fairnessScoreWeekend}`)

  const baseRequirement = totalRequiredSlots / totalStaffInCategory
  const adjustedRequirement = Math.max(0, Math.round(baseRequirement + staff.fairnessScoreWeekend))
  const totalSaturdayDays = saturdays.length
  const maxApplicationDays = Math.max(0, totalSaturdayDays - adjustedRequirement)

  console.log(`  조정된 최소 근무: ${adjustedRequirement}일`)
  console.log(`  총 토요일: ${totalSaturdayDays}일`)
  console.log(`  최대 신청 가능: ${maxApplicationDays}일`)

  // 토요일 3개 날짜 선택 시뮬레이션
  const selectedSaturdays = saturdays.slice(0, 3) // 처음 3개 토요일
  console.log('\n🧪 테스트: 토요일 3개 선택')
  console.log(`  선택 날짜: ${selectedSaturdays.map(d => d.toISOString().split('T')[0]).join(', ')}`)
  console.log(`  신청 날짜 수: ${selectedSaturdays.length}일`)
  console.log(`  최대 신청 가능: ${maxApplicationDays}일`)

  if (selectedSaturdays.length > maxApplicationDays) {
    console.log(`  ❌ 거부: 날짜 수 초과 (${selectedSaturdays.length}일 > ${maxApplicationDays}일)`)
  } else {
    console.log(`  ✅ 통과: 날짜 수 여유 있음 (${selectedSaturdays.length}일 <= ${maxApplicationDays}일)`)
  }
}

testWeekendFairness()
  .then(() => {
    console.log('\n✅ 테스트 완료')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ 에러:', error)
    process.exit(1)
  })
