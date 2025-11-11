const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkDepartments() {
  const departments = await prisma.department.findMany({
    where: { clinicId: 'cmh697itv0001fw83azbrqe60' },
    orderBy: { order: 'asc' }
  })

  console.log('DB에 등록된 부서:', departments.length)
  departments.forEach(d => {
    console.log(`  - ${d.name} (order: ${d.order}, 자동배치: ${d.useAutoAssignment ? '사용' : '미사용'})`)
  })

  await prisma.$disconnect()
}

checkDepartments().catch(console.error)
