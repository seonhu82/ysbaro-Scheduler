const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkWeekPatterns() {
  try {
    console.log('📊 9월 스케줄 조회 중...\n')

    const schedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 9
      }
    })

    if (!schedule) {
      console.log('❌ 9월 스케줄이 없습니다.')
      return
    }

    console.log('✅ 9월 스케줄 발견:')
    console.log('   ID:', schedule.id)
    console.log('   Status:', schedule.status)
    console.log('   weekPatterns:', schedule.weekPatterns)
    console.log('   weekPatterns type:', typeof schedule.weekPatterns)
    console.log('   weekPatterns keys:', schedule.weekPatterns ? Object.keys(schedule.weekPatterns) : 'null')

    // 전체 패턴 목록 조회
    const patterns = await prisma.weeklyPattern.findMany()
    console.log('\n📋 전체 패턴 목록:')
    patterns.forEach(p => {
      console.log(`   ${p.id}: ${p.name}`)
    })

    // weekPatterns에 있는 패턴 ID로 실제 패턴 찾기
    if (schedule.weekPatterns) {
      console.log('\n🔍 weekPatterns 상세:')
      for (const [weekNum, patternId] of Object.entries(schedule.weekPatterns)) {
        const pattern = patterns.find(p => p.id === patternId)
        console.log(`   ${weekNum}주차: ${patternId} -> ${pattern ? pattern.name : '❌ 패턴 없음'}`)
      }
    }

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkWeekPatterns()
