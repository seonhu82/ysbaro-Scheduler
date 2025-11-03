const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkCombinations() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'

    const combinations = await prisma.doctorCombination.findMany({
      where: {
        clinicId
      },
      orderBy: {
        name: 'asc'
      }
    })

    console.log('\n등록된 의사 조합:')
    combinations.forEach(c => {
      const doctors = c.doctors.sort().join(',')
      console.log(`  ${doctors} | night: ${c.hasNightShift} | ${c.dayOfWeek} | ${c.name}`)
    })

    // 박,효 조합 찾기
    console.log('\n박,효 조합 검색:')
    const parkHyo = combinations.filter(c => {
      const sorted = c.doctors.sort().join(',')
      return sorted === '박,효'
    })

    if (parkHyo.length === 0) {
      console.log('  ❌ 없음 - 이것이 문제입니다!')
    } else {
      console.log(`  ✅ ${parkHyo.length}개 발견:`)
      parkHyo.forEach(c => {
        console.log(`    - ${c.dayOfWeek}, night: ${c.hasNightShift}`)
      })
    }

  } catch (error) {
    console.error('에러:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkCombinations()
