const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function clearScheduleData() {
  try {
    console.log('🗑️  스케줄 관련 데이터 삭제 시작...\n')

    // 1. StaffAssignment 삭제
    const deletedStaffAssignments = await prisma.staffAssignment.deleteMany({})
    console.log(`✅ StaffAssignment 삭제: ${deletedStaffAssignments.count}개`)

    // 2. ScheduleDoctor 삭제
    const deletedScheduleDoctors = await prisma.scheduleDoctor.deleteMany({})
    console.log(`✅ ScheduleDoctor 삭제: ${deletedScheduleDoctors.count}개`)

    // 3. Schedule 삭제
    const deletedSchedules = await prisma.schedule.deleteMany({})
    console.log(`✅ Schedule 삭제: ${deletedSchedules.count}개`)

    console.log('\n✨ 모든 스케줄 데이터가 삭제되었습니다!')
    console.log('\n📝 참고: 직원, 원장, 조합, 설정 데이터는 유지됩니다.')

  } catch (error) {
    console.error('❌ 에러 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearScheduleData()
