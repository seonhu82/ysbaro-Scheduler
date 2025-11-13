const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const date = new Date('2025-11-24T00:00:00.000Z')

  console.log('=== 11월 24일 타임라인 확인 ===\n')

  // 1. Schedule 생성 시간
  const schedule = await prisma.schedule.findFirst({
    where: {
      year: 2025,
      month: 11,
      status: 'DEPLOYED'
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      status: true
    }
  })

  console.log('1. Schedule 생성:')
  console.log(`   - createdAt: ${schedule?.createdAt}`)
  console.log(`   - updatedAt: ${schedule?.updatedAt}`)
  console.log(`   - status: ${schedule?.status}\n`)

  // 2. StaffAssignment 생성 시간
  const assignments = await prisma.staffAssignment.findMany({
    where: {
      scheduleId: schedule?.id,
      date: date,
      staff: {
        name: { in: ['소정', '정아'] }
      }
    },
    include: {
      staff: { select: { name: true } }
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  console.log('2. StaffAssignment 생성:')
  assignments.forEach(a => {
    console.log(`   - ${a.staff.name}: ${a.createdAt} (shiftType: ${a.shiftType})`)
  })

  // 3. LeaveApplication 생성/수정 시간
  const leaves = await prisma.leaveApplication.findMany({
    where: {
      date: date,
      staff: {
        name: { in: ['소정', '정아'] }
      }
    },
    include: {
      staff: { select: { name: true } }
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  console.log('\n3. LeaveApplication:')
  leaves.forEach(l => {
    console.log(`   - ${l.staff.name}:`)
    console.log(`     createdAt: ${l.createdAt}`)
    console.log(`     updatedAt: ${l.updatedAt}`)
    console.log(`     status: ${l.status}`)
    console.log(`     leaveType: ${l.leaveType}`)
  })

  console.log('\n=== 타임라인 분석 ===')
  if (schedule && assignments.length > 0 && leaves.length > 0) {
    const scheduleTime = schedule.createdAt.getTime()
    const assignmentTime = assignments[0].createdAt.getTime()
    const leaveCreatedTime = leaves[0].createdAt.getTime()
    const leaveUpdatedTime = leaves[0].updatedAt.getTime()

    console.log(`Schedule 생성: ${schedule.createdAt}`)
    console.log(`Assignment 생성: ${assignments[0].createdAt}`)
    console.log(`Leave 생성: ${leaves[0].createdAt}`)
    console.log(`Leave 수정: ${leaves[0].updatedAt}`)

    if (leaveCreatedTime < scheduleTime) {
      console.log('\n✅ LeaveApplication이 배치 **전**에 생성됨 → 배치가 이를 무시한 것 (버그)')
    } else if (leaveCreatedTime > assignmentTime) {
      console.log('\n⚠️  LeaveApplication이 배치 **후**에 생성됨 → 배치 후 신청됨')
    }

    if (leaveUpdatedTime > assignmentTime) {
      console.log(`⚠️  LeaveApplication이 배치 **후**에 승인됨 (${leaves[0].updatedAt})`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
