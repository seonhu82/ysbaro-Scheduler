const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkHoldReason() {
  // 구,박,윤 조합 찾기
  const combination = await prisma.doctorCombination.findFirst({
    where: {
      doctors: { equals: ['구', '박', '윤'] },
      hasNightShift: false
    }
  })

  console.log('원장 조합: 구, 박, 윤')
  console.log('requiredStaff:', JSON.stringify(combination.requiredStaff, null, 2))

  // 유정의 구분 확인
  const staff = await prisma.staff.findFirst({
    where: { name: '유정' }
  })

  console.log('\n유정님 정보:')
  console.log('- categoryName:', staff.categoryName)
  console.log('- departmentName:', staff.departmentName)

  // 11월 24일 팀장/실장 구분 신청 수
  const applications = await prisma.leaveApplication.findMany({
    where: {
      date: new Date('2025-11-24'),
      staff: {
        categoryName: staff.categoryName
      }
    },
    include: {
      staff: {
        select: { name: true }
      }
    }
  })

  console.log(`\n11월 24일 "${staff.categoryName}" 구분 신청:`)
  applications.forEach(app => {
    console.log(`- ${app.staff.name}: ${app.leaveType} (${app.status})`)
  })
  console.log(`총 ${applications.length}명`)

  const requiredStaff = combination.requiredStaff
  const requiredForCategory = requiredStaff[staff.categoryName] || 0

  console.log(`\n필요 인원: ${requiredForCategory}명`)
  console.log(`신청 인원: ${applications.length}명`)
  console.log(`여유 슬롯: ${requiredForCategory - applications.length}명`)

  await prisma.$disconnect()
}

checkHoldReason().catch(console.error)
