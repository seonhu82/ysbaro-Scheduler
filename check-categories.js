const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkCategories() {
  const categories = await prisma.staffCategory.findMany({
    where: { clinicId: 'cmh697itv0001fw83azbrqe60' }
  })

  console.log('DB에 등록된 구분(categories):', categories.length)
  categories.forEach(c => {
    console.log(`  - ${c.name} (부서: ${c.departmentName || '공통'})`)
  })

  await prisma.$disconnect()
}

checkCategories().catch(console.error)
