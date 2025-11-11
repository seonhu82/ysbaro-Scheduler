const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkSpecificStaff() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const year = 2025
    const month = 4

    // 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: { clinicId, year, month }
    })

    if (!schedule) {
      console.log('❌ 스케줄을 찾을 수 없습니다.')
      return
    }

    // 대상 직원들
    const targetStaffNames = ['보은', '다애', '김소', '이소']

    const targetStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        name: { in: targetStaffNames },
        departmentName: '진료실'
      }
    })

    console.log(`\n📊 첫째 주 (3/31~4/5) 직원별 실제 배치 확인\n`)

    for (const staff of targetStaff) {
      console.log(`\n👤 ${staff.name} (${staff.id}):`)
      console.log('='.repeat(60))

      // 3/31 ~ 4/5 배치 조회
      const assignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          staffId: staff.id,
          date: {
            gte: new Date('2025-03-31'),
            lte: new Date('2025-04-05')
          }
        },
        orderBy: {
          date: 'asc'
        }
      })

      let workCount = 0
      let offCount = 0

      for (const assignment of assignments) {
        const date = new Date(assignment.date)
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]

        if (assignment.shiftType === 'OFF') {
          offCount++
          console.log(`  ${dateStr} (${dayOfWeek}): OFF`)
        } else {
          workCount++
          console.log(`  ${dateStr} (${dayOfWeek}): ${assignment.shiftType} 근무`)
        }
      }

      console.log(`\n  📈 합계: 근무 ${workCount}일, OFF ${offCount}일, 총 ${workCount + offCount}일`)

      if (workCount === 4) {
        console.log(`  ✅ 주4일 근무 충족`)
      } else if (workCount < 4) {
        console.log(`  ⚠️  주4일 미달 (${4 - workCount}일 부족)`)
      } else {
        console.log(`  📈 주4일 초과 (${workCount - 4}일 초과)`)
      }
    }

    console.log('\n' + '='.repeat(60) + '\n')

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSpecificStaff()
