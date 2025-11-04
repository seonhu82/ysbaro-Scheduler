const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function resetFairnessScores() {
  try {
    console.log('\n🔄 형평성 점수 리셋 시작...\n')

    // 진료실 직원의 형평성 점수를 0으로 리셋
    const result = await prisma.staff.updateMany({
      where: {
        departmentName: '진료실',
        isActive: true
      },
      data: {
        fairnessScoreTotalDays: 0,
        fairnessScoreNight: 0,
        fairnessScoreWeekend: 0,
        fairnessScoreHoliday: 0,
        fairnessScoreHolidayAdjacent: 0
      }
    })

    console.log(`✅ ${result.count}명의 직원 형평성 점수 리셋 완료`)

    // FairnessScore 테이블도 삭제
    const deletedScores = await prisma.fairnessScore.deleteMany({
      where: {
        year: 2025,
        month: 10
      }
    })

    console.log(`✅ ${deletedScores.count}개의 10월 FairnessScore 레코드 삭제 완료\n`)

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

resetFairnessScores()
