const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkCombination() {
  const combination = await prisma.doctorCombination.findFirst({
    where: { clinicId: 'cmh697itv0001fw83azbrqe60' }
  })
  
  console.log('DoctorCombination 예시:')
  console.log('doctors:', combination.doctors)
  console.log('hasNightShift:', combination.hasNightShift)
  console.log('\ndepartmentCategoryStaff:')
  console.log(JSON.stringify(combination.departmentCategoryStaff, null, 2))
  
  await prisma.$disconnect()
}

checkCombination()
