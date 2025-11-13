const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function clear() {
  const result = await prisma.schedule.updateMany({
    data: { weekPatterns: null }
  })
  
  console.log(`✅ ${result.count}개 Schedule의 weekPatterns 초기화 완료`)
  
  await prisma.$disconnect()
}

clear()
