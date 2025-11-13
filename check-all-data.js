const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkAllData() {
  try {
    console.log('=== 전체 데이터 현황 ===\n')

    const staff = await prisma.staff.count()
    const schedules = await prisma.schedule.count()
    const assignments = await prisma.staffAssignment.count()
    const doctorSchedules = await prisma.scheduleDoctor.count()
    const leaveApps = await prisma.leaveApplication.count()
    const leaveLinks = await prisma.applicationLink.count()
    const holidays = await prisma.holiday.count()

    console.log(`직원 (Staff): ${staff}명`)
    console.log(`스케줄 (Schedule): ${schedules}개`)
    console.log(`직원 배치 (StaffAssignment): ${assignments}건`)
    console.log(`의사 스케줄 (ScheduleDoctor): ${doctorSchedules}건`)
    console.log(`연차 신청 (LeaveApplication): ${leaveApps}건`)
    console.log(`연차 링크 (ApplicationLink): ${leaveLinks}개`)
    console.log(`공휴일 (Holiday): ${holidays}개`)

    console.log('\n=== 직원 샘플 ===')
    const staffSample = await prisma.staff.findMany({ take: 5 })
    staffSample.forEach(s => {
      console.log(`  ${s.name} (ID: ${s.id.substring(0, 8)}...)`)
    })

    if (assignments > 0) {
      console.log('\n=== 직원 배치 샘플 ===')
      const assignmentSample = await prisma.staffAssignment.findMany({
        take: 3,
        include: { staff: true }
      })
      assignmentSample.forEach(a => {
        console.log(`  날짜: ${a.date}, staffId: ${a.staffId.substring(0, 8)}..., 직원: ${a.staff ? a.staff.name : '❌ 삭제됨'}`)
      })
    }

    if (leaveApps > 0) {
      console.log('\n=== 연차 신청 샘플 ===')
      const leaveSample = await prisma.leaveApplication.findMany({
        take: 3,
        include: { staff: true }
      })
      leaveSample.forEach(a => {
        console.log(`  날짜: ${a.date}, staffId: ${a.staffId.substring(0, 8)}..., 직원: ${a.staff ? a.staff.name : '❌ 삭제됨'}`)
      })
    }

    await prisma.$disconnect()
  } catch (error) {
    console.error('오류:', error)
    await prisma.$disconnect()
  }
}

checkAllData()
