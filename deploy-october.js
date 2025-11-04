const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function deployOctober() {
  try {
    console.log('\n🚀 10월 스케줄 배포 시작...\n')

    // 10월 스케줄 조회 (CONFIRMED 또는 DRAFT)
    const schedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 10
      }
    })

    if (!schedule) {
      console.log('❌ 10월 스케줄을 찾을 수 없습니다')
      return
    }

    console.log(`✅ 10월 스케줄 찾음: ${schedule.id}`)
    console.log(`   현재 상태: ${schedule.status}`)

    // 배포 날짜 범위 계산 (ScheduleDoctor의 최소/최대 날짜)
    const dateRange = await prisma.scheduleDoctor.aggregate({
      where: { scheduleId: schedule.id },
      _min: { date: true },
      _max: { date: true }
    })

    const deployedStartDate = dateRange._min.date
    const deployedEndDate = dateRange._max.date

    if (!deployedStartDate || !deployedEndDate) {
      console.log('❌ 원장 스케줄이 없어 배포할 수 없습니다')
      return
    }

    console.log(`   📅 배포 범위: ${deployedStartDate.toISOString().split('T')[0]} ~ ${deployedEndDate.toISOString().split('T')[0]}`)

    // Deploy
    console.log('\n🚀 Deploy 중...')
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        status: 'DEPLOYED',
        deployedAt: new Date(),
        deployedStartDate,
        deployedEndDate
      }
    })
    console.log('   ✅ Deploy 완료')

    // updateStaffFairnessScores 호출
    console.log('\n📊 형평성 점수 업데이트 중...')

    const { updateStaffFairnessScores } = require('./src/lib/services/fairness-score-update-service.ts')

    await updateStaffFairnessScores(
      schedule.clinicId,
      schedule.year,
      schedule.month
    )

    console.log('\n✅ 10월 스케줄 배포 완료!\n')

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

deployOctober()
