const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function updateOctoberFairness() {
  try {
    console.log('\n📊 10월 형평성 점수 업데이트 시작...\n')

    const schedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 10,
        status: 'DEPLOYED'
      }
    })

    if (!schedule) {
      console.log('❌ 10월 배포된 스케줄을 찾을 수 없습니다')
      return
    }

    console.log(`✅ 10월 스케줄 찾음: ${schedule.id}`)

    const fairnessScores = await prisma.fairnessScore.findMany({
      where: {
        year: 2025,
        month: 10,
        staff: {
          clinicId: schedule.clinicId
        }
      },
      include: {
        staff: {
          select: {
            name: true
          }
        }
      }
    })

    console.log(`   → ${fairnessScores.length}명의 직원 점수 업데이트 중...`)

    let updatedCount = 0
    for (const fairnessScore of fairnessScores) {
      await prisma.staff.update({
        where: { id: fairnessScore.staffId },
        data: {
          fairnessScoreNight: fairnessScore.nightShiftCount,
          fairnessScoreWeekend: fairnessScore.weekendCount,
          fairnessScoreHoliday: fairnessScore.holidayCount,
          fairnessScoreHolidayAdjacent: fairnessScore.holidayAdjacentCount
        }
      })

      console.log(
        `   ✅ ${fairnessScore.staff.name}: ` +
          `야간=${fairnessScore.nightShiftCount}, ` +
          `주말=${fairnessScore.weekendCount}, ` +
          `공휴일=${fairnessScore.holidayCount}, ` +
          `공휴일전후=${fairnessScore.holidayAdjacentCount}`
      )

      updatedCount++
    }

    console.log(`\n✅ Staff 테이블 형평성 점수 업데이트 완료: ${updatedCount}명\n`)

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateOctoberFairness()
