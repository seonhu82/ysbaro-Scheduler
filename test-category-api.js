const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testCategoryAPI() {
  const categories = await prisma.staffCategory.findMany({
    where: { clinicId: 'cmh697itv0001fw83azbrqe60' },
    include: {
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ priority: 'asc' }, { order: 'asc' }],
  })

  console.log('API 응답 구조 (실제):', JSON.stringify(categories, null, 2))

  console.log('\n각 카테고리:')
  categories.forEach(cat => {
    console.log(`  - ${cat.name}:`)
    console.log(`    department 객체:`, cat.department)
    console.log(`    departmentName 필드:`, cat.departmentName)
  })

  await prisma.$disconnect()
}

testCategoryAPI().catch(console.error)
