const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  const schedules = await prisma.schedule.findMany({
    orderBy: { month: 'asc' }
  })
  
  console.log('=== Schedule weekPatterns 확인 ===\n')
  
  for (const s of schedules) {
    console.log(`${s.year}년 ${s.month}월 (${s.status}):`)
    console.log('  weekPatterns:', s.weekPatterns)
    console.log()
  }
  
  await prisma.$disconnect()
}

check()
