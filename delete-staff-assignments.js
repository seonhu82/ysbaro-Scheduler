const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function deleteStaffAssignments() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const year = 2025

    console.log('\n🗑️  1~4월 직원 배치 데이터 삭제 시작\n')
    console.log('='.repeat(60))

    // 1~4월 스케줄 조회
    const schedules = await prisma.schedule.findMany({
      where: {
        clinicId,
        year,
        month: {
          gte: 1,
          lte: 4
        }
      },
      orderBy: {
        month: 'asc'
      }
    })

    console.log(`\n📋 대상 스케줄: ${schedules.length}개`)
    schedules.forEach(s => {
      console.log(`   - ${s.year}년 ${s.month}월 (ID: ${s.id})`)
    })

    if (schedules.length === 0) {
      console.log('\n❌ 삭제할 스케줄이 없습니다.')
      return
    }

    const scheduleIds = schedules.map(s => s.id)

    // 각 스케줄별 배치 데이터 개수 확인
    console.log('\n📊 현재 배치 데이터:')
    for (const schedule of schedules) {
      const count = await prisma.staffAssignment.count({
        where: { scheduleId: schedule.id }
      })
      console.log(`   - ${schedule.year}년 ${schedule.month}월: ${count}건`)
    }

    // 삭제 확인
    const totalCount = await prisma.staffAssignment.count({
      where: {
        scheduleId: { in: scheduleIds }
      }
    })

    console.log(`\n⚠️  총 ${totalCount}건의 배치 데이터를 삭제합니다.`)
    console.log('\n🔄 삭제 중...')

    // StaffAssignment 삭제
    const result = await prisma.staffAssignment.deleteMany({
      where: {
        scheduleId: { in: scheduleIds }
      }
    })

    console.log(`\n✅ 삭제 완료: ${result.count}건`)

    // 각 스케줄의 monthlyFairness 초기화
    console.log('\n🔄 월별 형평성 데이터 초기화 중...')
    for (const schedule of schedules) {
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          monthlyFairness: {}
        }
      })
      console.log(`   - ${schedule.year}년 ${schedule.month}월 형평성 데이터 초기화 완료`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ 모든 작업 완료\n')

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

deleteStaffAssignments()
