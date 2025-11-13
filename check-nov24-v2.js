const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 11월 스케줄 먼저 확인
  console.log('=== 11월 스케줄 확인 ===')
  const schedules = await prisma.schedule.findMany({
    where: {
      year: { in: [2024, 2025] },
      month: 11
    },
    select: {
      id: true,
      year: true,
      month: true,
      status: true
    }
  })

  console.log('11월 스케줄:')
  schedules.forEach(s => {
    console.log(`- ${s.year}년 ${s.month}월: ${s.status} (ID: ${s.id})`)
  })

  if (schedules.length === 0) {
    console.log('11월 스케줄이 없습니다')
    return
  }

  // 가장 최신 스케줄의 24일 데이터 확인
  const latestSchedule = schedules[schedules.length - 1]
  const date = new Date(`${latestSchedule.year}-11-24T00:00:00.000Z`)

  console.log(`\n=== ${latestSchedule.year}년 11월 24일 데이터 확인 ===`)
  console.log('날짜:', date.toISOString())

  // StaffAssignment 확인
  const assignments = await prisma.staffAssignment.findMany({
    where: {
      scheduleId: latestSchedule.id,
      date: date
    },
    include: {
      staff: {
        select: { name: true }
      }
    }
  })

  console.log(`\nStaffAssignment 총 ${assignments.length}건`)

  // 소정, 정아만 필터링
  const targetStaff = assignments.filter(a =>
    a.staff.name === '소정' || a.staff.name === '정아'
  )

  console.log(`소정, 정아: ${targetStaff.length}건`)
  targetStaff.forEach(a => {
    console.log(`- ${a.staff.name}: shiftType=${a.shiftType}`)
  })

  // LeaveApplication 확인
  const leaves = await prisma.leaveApplication.findMany({
    where: {
      date: date,
      staff: {
        name: { in: ['소정', '정아'] }
      }
    },
    include: {
      staff: {
        select: { name: true }
      }
    }
  })

  console.log(`\nLeaveApplication: ${leaves.length}건`)
  leaves.forEach(l => {
    console.log(`- ${l.staff.name}: leaveType=${l.leaveType}, status=${l.status}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
