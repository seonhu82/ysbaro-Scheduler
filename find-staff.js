const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function find() {
  const allStaff = await prisma.staff.findMany({
    where: { isActive: true },
    select: { id: true, name: true }
  })

  console.log('전체 활성 직원:')
  allStaff.forEach(s => console.log(`  ${s.name} (${s.id})`))

  await prisma.$disconnect()
}

find()
