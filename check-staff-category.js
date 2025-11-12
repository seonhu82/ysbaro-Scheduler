const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkStaff() {
  const staff = await prisma.staff.findFirst({
    where: { id: 'cmh6naxac000s12lynsqel2z3' },
    select: {
      name: true,
      departmentName: true,
      categoryName: true,
      rank: true
    }
  })
  
  console.log('직원 정보:', staff)
  
  // 같은 구분 직원 수 확인
  const sameCategory = await prisma.staff.count({
    where: {
      clinicId: 'cmh697itv0001fw83azbrqe60',
      isActive: true,
      departmentName: staff.departmentName,
      categoryName: staff.categoryName
    }
  })
  
  console.log('같은 구분 직원 수:', sameCategory)
  
  await prisma.$disconnect()
}

checkStaff()
