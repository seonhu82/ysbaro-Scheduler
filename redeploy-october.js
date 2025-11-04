const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function redeployOctober() {
  try {
    console.log('\n🔄 10월 스케줄 재배포 시작...\n')

    // 10월 스케줄 조회
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
    console.log(`   배포일: ${schedule.deployedAt}`)
    console.log(`   배포 범위: ${schedule.deployedStartDate} ~ ${schedule.deployedEndDate}`)

    // 1. Undeploy
    console.log('\n📦 Undeploy 중...')
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        status: 'DRAFT',
        deployedAt: null
      }
    })
    console.log('   ✅ Undeploy 완료')

    // 2. Deploy
    console.log('\n🚀 Deploy 중...')
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        status: 'DEPLOYED',
        deployedAt: new Date()
      }
    })
    console.log('   ✅ Deploy 완료')

    // 3. updateStaffFairnessScores 호출
    console.log('\n📊 형평성 점수 업데이트 중...')

    const { updateStaffFairnessScores } = require('./src/lib/services/fairness-score-update-service.ts')

    await updateStaffFairnessScores(
      schedule.clinicId,
      schedule.year,
      schedule.month
    )

    console.log('\n✅ 10월 스케줄 재배포 완료!\n')

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

redeployOctober()
