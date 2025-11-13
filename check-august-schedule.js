const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  const schedule = await prisma.schedule.findFirst({
    where: { year: 2025, month: 8 }
  })
  
  console.log('2025년 8월 스케줄:')
  console.log('  ID:', schedule.id)
  console.log('  Status:', schedule.status)
  console.log('  deployedAt:', schedule.deployedAt)
  console.log('  deployedStartDate:', schedule.deployedStartDate)
  console.log('  deployedEndDate:', schedule.deployedEndDate)
  
  await prisma.$disconnect()
}

check()
