const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkLeaveAssignments() {
  try {
    const scheduleId = 'cmhgmfchh02zp12wjh3abc4ku'
    const clinicId = 'cmh697itv0001fw83azbrqe60'

    // 연차 신청 조회
    const leaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: {
          gte: new Date('2025-09-28'),
          lte: new Date('2025-11-01')
        },
        status: 'CONFIRMED'
      },
      include: {
        staff: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    console.log(`\n확정된 연차/오프: ${leaves.length}건`)

    for (const leave of leaves) {
      const dateKey = leave.date.toISOString().split('T')[0]

      // 해당 날짜 assignment 확인
      const assignment = await prisma.staffAssignment.findFirst({
        where: {
          scheduleId,
          staffId: leave.staffId,
          date: leave.date
        }
      })

      console.log(`\n${leave.staff.name} - ${dateKey} (${leave.leaveType}):`)
      if (assignment) {
        console.log(`  Assignment 있음: ${assignment.shiftType}`)
      } else {
        console.log(`  ❌ Assignment 없음 - 이것이 문제!`)
      }
    }

  } catch (error) {
    console.error('에러:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkLeaveAssignments()
