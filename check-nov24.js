const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 11월 24일 소정, 정아 데이터 확인
  const date = new Date('2024-11-24T00:00:00.000Z')

  console.log('=== 11월 24일 StaffAssignment 확인 ===')
  const assignments = await prisma.staffAssignment.findMany({
    where: {
      date: date,
      staff: {
        name: { in: ['소정', '정아'] }
      }
    },
    include: {
      staff: {
        select: { name: true }
      },
      schedule: {
        select: { status: true, year: true, month: true }
      }
    }
  })

  console.log('StaffAssignment 결과:')
  assignments.forEach(a => {
    console.log(`- ${a.staff.name}: shiftType=${a.shiftType}, schedule=${a.schedule.year}-${a.schedule.month} (${a.schedule.status})`)
  })

  console.log('\n=== 11월 24일 LeaveApplication 확인 ===')
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

  console.log('LeaveApplication 결과:')
  leaves.forEach(l => {
    console.log(`- ${l.staff.name}: leaveType=${l.leaveType}, status=${l.status}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
