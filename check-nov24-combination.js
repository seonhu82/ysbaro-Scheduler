// Check November 24 doctor combination details

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Get November 24 schedule via staff assignment
  const assignment = await prisma.staffAssignment.findFirst({
    where: {
      date: new Date('2025-11-24T00:00:00.000Z')
    },
    include: {
      schedule: {
        include: {
          doctors: {
            include: {
              doctor: true
            }
          }
        }
      }
    }
  })

  const schedule = assignment?.schedule

  console.log('=== 11월 24일 스케줄 ===')
  console.log('스케줄 ID:', schedule?.id)
  console.log('원장:', schedule?.doctors.map(sd => sd.doctor.shortName).join(', '))

  // Get doctor combination
  const doctorNames = schedule.doctors.map(sd => sd.doctor.shortName).sort()
  console.log('\n정렬된 원장 배열:', JSON.stringify(doctorNames))

  const combination = await prisma.doctorCombination.findFirst({
    where: {
      doctors: { equals: doctorNames }
    }
  })

  console.log('\n=== 매칭된 원장 조합 ===')
  console.log('조합 이름:', combination?.name)
  console.log('필요 직원 수 (total):', combination?.requiredStaff)
  console.log('부서별 필요 인원:', combination?.departmentRequiredStaff)
  console.log('\n부서별 구분 상세 인원:')
  console.log(JSON.stringify(combination?.departmentCategoryStaff, null, 2))

  // Check category ratio settings
  const ratioSettings = await prisma.categoryRatioSettings.findFirst({
    where: {
      clinicId: schedule.clinicId
    }
  })

  console.log('\n=== 구분별 비율 설정 ===')
  console.log(JSON.stringify(ratioSettings?.ratios, null, 2))

  // Calculate what the system would calculate
  if (combination && ratioSettings) {
    const totalRequired = combination.requiredStaff
    const ratios = ratioSettings.ratios

    console.log('\n=== 시스템이 계산하는 필요 인원 (비율 기반) ===')
    for (const [category, ratio] of Object.entries(ratios)) {
      const required = Math.round((totalRequired * ratio) / 100)
      console.log(`${category}: ${required}명 (${ratio}%)`)
    }
  }

  await prisma.$disconnect()
}

main().catch(console.error)
